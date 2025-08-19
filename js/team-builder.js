render(allPlayers) {
        const container = document.getElementById('team-builder-screen');
        container.innerHTML = `<h2>Armar Equipos</h2><div class="three-column-layout"><div class="input-column"><h3>Jugadores de Hoy</h3><p>Pega la lista numerada de jugadores aquí:</p><textarea id="player-list-input" placeholder="1. Nico A\n2. Pala\n3. Nico"></textarea><button id="generate-teams-btn">Generar Equipos</button></div><div class="pitch-column"><div class="pitch-container"><div id="pitch-display" class="pitch"></div></div><div id="match-controls" class="hidden" style="text-align:center; margin-top:1rem;"><button id="rearm-btn">Rearmar Equipos</button><button id="start-match-btn">Comenzar Partido</button></div></div><div class="roster-column" id="roster-column"></div></div>`;
        document.getElementById('generate-teams-btn').addEventListener('click', () => this.processPlayerList(allPlayers));
    },
    cleanPastedNames(text) { return text.split('\n').map(line => line.replace(/^\d+\.?[)\]\s]*/, '').trim()).filter(Boolean); },
    async processPlayerList(allPlayers) {
        const input = document.getElementById('player-list-input').value; const pastedNames = this.cleanPastedNames(input);
        let playersForToday = []; let availablePlayers = [...allPlayers];
        for (const name of pastedNames) {
            const results = this.findPlayer(name, availablePlayers); let chosenPlayer;
            if (results.length === 1 && results[0].score < 0.01) { chosenPlayer = results[0].player; }
            else if (results.length === 1) { chosenPlayer = await this.confirmSingleMatch(name, results[0].player, availablePlayers); }
            else if (results.length > 1) { chosenPlayer = await this.resolveAmbiguity(name, results.map(r => r.player)); }
            else { chosenPlayer = await this.resolveUnmatchedPlayer(name, availablePlayers); }
            if (chosenPlayer) { playersForToday.push(chosenPlayer); availablePlayers = availablePlayers.filter(p => p.id !== chosenPlayer.id); }
            else { alert(`Proceso cancelado. No se pudo resolver al jugador "${name}".`); return; }
        }
        if (playersForToday.length < 18) { alert(`Se necesitan 18 jugadores. Solo se resolvieron ${playersForToday.length}.`); return; }
        const { teamA, teamB } = this.balanceTeams(playersForToday.slice(0, 18));
        const { positionsA, positionsB } = this.assignFinalPositionsAndNumbers(teamA, teamB);
        this.displayTeamsOnPitch(positionsA, positionsB); this.displayTeamLists(positionsA, positionsB);
        this.currentMatchup = { teamA: positionsA.map(p => p.player), teamB: positionsB.map(p => p.player) };
        document.getElementById('match-controls').classList.remove('hidden');
        document.getElementById('start-match-btn').onclick = () => this.startMatch();
        document.getElementById('rearm-btn').onclick = () => this.processPlayerList(allPlayers);
    },
    findPlayer(name, playerPool) {
        const options = {
            keys: [{ name: 'nombre', weight: 0.5 }, { name: 'apellido', weight: 0.3 }, { name: 'apodo', weight: 0.7 }],
            includeScore: true,
            threshold: 0.4,
        };
        const fuse = new Fuse(playerPool, options);
        const results = fuse.search(name);
        if (results.length === 0) return [];
        const bestScore = results[0].score;
        return results
            .filter(result => result.score < bestScore + 0.1) // Un poco más de margen para agrupar similares
            .map(result => ({ player: result.item, score: result.score }));
    },

    // NUEVO: Modal para confirmar una única coincidencia "difusa"
    confirmSingleMatch(name, potentialMatch, availablePlayers) {
        return new Promise(resolve => {
            const modalContainer = document.getElementById('modal-container');
            const modalContent = document.getElementById('modal-content');
            modalContent.innerHTML = `
                <h3>Confirmar Jugador</h3>
                <p>Para <strong>"${name}"</strong>, ¿te refieres a <strong>${potentialMatch.nombre} ${potentialMatch.apellido}</strong>?</p>
                <button id="confirm-yes">Sí, es correcto</button>
                <button id="confirm-no" class="cancel-btn">No, buscar otro o crear</button>
            `;
            modalContainer.classList.remove('hidden');

            document.getElementById('confirm-yes').onclick = () => {
                modalContainer.classList.add('hidden');
                resolve(potentialMatch);
            };
            document.getElementById('confirm-no').onclick = async () => {
                // Si el usuario dice que no, reutilizamos el modal de búsqueda/creación
                const player = await this.resolveUnmatchedPlayer(name, availablePlayers);
                resolve(player);
            };
        });
    },

    resolveAmbiguity(name, matches) {
        return new Promise(resolve => {
            const modalContainer = document.getElementById('modal-container');
            const modalContent = document.getElementById('modal-content');
            const optionsHtml = matches.map(p => `
                <label class="ambiguity-item">
                    <input type="radio" name="ambiguous_player" value="${p.id}">
                    <span>${p.nombre} ${p.apellido} (${p.puntajeGeneral})</span>
                </label>
            `).join('');
            modalContent.innerHTML = `
                <h3>Coincidencia Múltiple para "${name}"</h3>
                <p>¿A cuál de los siguientes jugadores te refieres?</p>
                <div class="ambiguity-list">${optionsHtml}</div>
                <button id="confirm-ambiguity">Confirmar Selección</button>
                <button id="cancel-ambiguity" class="cancel-btn">Cancelar</button>
            `;
            modalContainer.classList.remove('hidden');
            document.getElementById('confirm-ambiguity').onclick = () => {
                const selectedRadio = document.querySelector('input[name="ambiguous_player"]:checked');
                if (selectedRadio) {
                    const chosenPlayer = matches.find(p => p.id === selectedRadio.value);
                    modalContainer.classList.add('hidden');
                    resolve(chosenPlayer);
                } else { alert("Por favor, selecciona un jugador."); }
            };
            document.getElementById('cancel-ambiguity').onclick = () => {
                modalContainer.classList.add('hidden');
                resolve(null);
            };
        });
    },

 resolveUnmatchedPlayer(name, availablePlayers) {
        return new Promise(resolve => {
            const modalContainer = document.getElementById('modal-container');
            const modalContent = document.getElementById('modal-content');
            modalContent.innerHTML = `
                <h3>No se encontró a "${name}"</h3>
                <p>Busca un jugador existente o crea uno nuevo.</p>
                <input type="text" id="search-player-input" placeholder="Escribe para buscar...">
                <div id="search-results" class="search-results-container"></div>
                <hr style="margin: 1rem 0;">
                <button id="show-create-new-player">Crear Jugador Nuevo</button>
                <div id="create-new-player-form" class="hidden">
                    <h4>Crear: ${name}</h4>
                    <input id="new-player-nombre" type="text" placeholder="Nombre" value="${name.split(' ')[0] || ''}">
                    <input id="new-player-apellido" type="text" placeholder="Apellido" value="${name.split(' ')[1] || ''}">
                    <input id="new-player-apodo" type="text" placeholder="Apodo (Opcional)">
                    <select id="new-player-pos1"><option value="">Posición Primaria</option><option>Arquero</option><option>Defensa Central</option><option>Defensa Lateral</option><option>Volante Central</option><option>Volante Lateral</option><option>Atacante</option></select>
                    <select id="new-player-pos2"><option value="">Posición Secundaria (Opcional)</option><option>Arquero</option><option>Defensa Central</option><option>Defensa Lateral</option><option>Volante Central</option><option>Volante Lateral</option><option>Atacante</option></select>
                    <label for="new-player-habilidad">Puntaje General (1.0 - 5.0)</label>
                    <input id="new-player-habilidad" type="number" step="0.1" min="1" max="5" placeholder="ej: 3.5">
                    <button id="save-new-player">Guardar Nuevo Jugador</button>
                </div>
                <button id="cancel-unmatched" class="cancel-btn">Cancelar</button>
            `;
            modalContainer.classList.remove('hidden');
            
            const searchInput = document.getElementById('search-player-input');
            const searchResultsContainer = document.getElementById('search-results');
            const renderResults = (query) => {
                searchResultsContainer.innerHTML = '';
                if (!query) return;
                const filtered = availablePlayers.filter(p => `${p.nombre} ${p.apellido}`.toLowerCase().includes(query.toLowerCase()));
                filtered.forEach(player => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.textContent = `${player.nombre} ${player.apellido} (${player.puntajeGeneral})`;
                    item.onclick = () => { modalContainer.classList.add('hidden'); resolve(player); };
                    searchResultsContainer.appendChild(item);
                });
            };
            searchInput.addEventListener('keyup', (e) => renderResults(e.target.value));

            document.getElementById('show-create-new-player').onclick = () => {
                document.getElementById('create-new-player-form').classList.remove('hidden');
            };
            
            document.getElementById('save-new-player').onclick = async () => {
                const puntaje = parseFloat(document.getElementById('new-player-habilidad').value);
                if (isNaN(puntaje) || puntaje < 1 || puntaje > 5) {
                    alert("Por favor, ingresa un puntaje válido entre 1.0 y 5.0.");
                    return;
                }
                const newPlayerData = {
                    nombre: document.getElementById('new-player-nombre').value,
                    apellido: document.getElementById('new-player-apellido').value,
                    apodo: document.getElementById('new-player-apodo').value,
                    posPrimaria: document.getElementById('new-player-pos1').value,
                    posSecundaria: document.getElementById('new-player-pos2').value,
                    puntajeGeneral: puntaje
                };
                await api.post({ action: 'addPlayer', player: newPlayerData });
                // Volvemos a cargar TODOS los jugadores para que la lista global esté actualizada
                window.appState.players = await api.get('getPlayers'); 
                const addedPlayer = window.appState.players.find(p => p.nombre === newPlayerData.nombre && p.apellido === newPlayerData.apellido);
                modalContainer.classList.add('hidden');
                resolve(addedPlayer);
            };
            
            document.getElementById('cancel-unmatched').onclick = () => {
                modalContainer.classList.add('hidden');
                resolve(null);
            };
        });
    },
    
    // CORREGIDO: Algoritmo de balanceo reescrito para evitar duplicados y seguir reglas
   balanceTeams(players) {
        let teamA = { players: [], score: 0 };
        let teamB = { players: [], score: 0 };
        let available = [...players];

        available.forEach(p => {
            p.tempScore = parseFloat(p.puntajeGeneral);
        });
        
        const assignPlayer = (player, team) => {
            team.players.push(player);
            available = available.filter(p => p.id !== player.id);
        };

        const getTeamDefenseScore = (team) => team.players.filter(p => p.posPrimaria.includes('Defensa') || p.posPrimaria === 'Arquero').reduce((sum, p) => sum + p.tempScore, 0);

        // --- 1. Distribuir Defensores Centrales y Arquero ---
        let keyDefenders = available.filter(p => p.posPrimaria === 'Defensa Central' || p.posPrimaria === 'Arquero').sort((a,b) => b.tempScore - a.tempScore);
        if (keyDefenders.length === 1) {
            assignPlayer(keyDefenders.shift(), teamA);
        } else if (keyDefenders.length === 2) {
            assignPlayer(keyDefenders.shift(), teamA); // El mejor a A
            assignPlayer(keyDefenders.shift(), teamB); // El segundo a B
        } else if (keyDefenders.length >= 3) {
            const best = keyDefenders.shift();
            const worst = keyDefenders.pop();
            const middle = keyDefenders.shift();
            assignPlayer(best, teamA); // El mejor solo en A
            assignPlayer(worst, teamB); // El peor con el medio en B
            assignPlayer(middle, teamB);
        }
        
        // --- 2. Distribuir Defensores Laterales ---
        let lateralDefendersPool = available.filter(p => p.posPrimaria === 'Defensa Lateral' && !p.posSecundaria).sort((a,b) => b.tempScore - a.tempScore);
        let otherLateralDefenders = available.filter(p => (p.posPrimaria === 'Defensa Lateral' && p.posSecundaria) || p.posSecundaria === 'Defensa Lateral').sort((a,b) => b.tempScore - a.tempScore);
        let allLateralDefenders = [...lateralDefendersPool, ...otherLateralDefenders];

        // Decidir qué equipo empieza a recibir laterales
        let startingTeam = getTeamDefenseScore(teamA) <= getTeamDefenseScore(teamB) ? teamA : teamB;
        let otherTeam = startingTeam === teamA ? teamB : teamA;
        
        if (allLateralDefenders.length > 0) assignPlayer(allLateralDefenders.shift(), startingTeam);

        while (teamA.players.length + teamB.players.length < 8 && allLateralDefenders.length > 0) {
            const player = allLateralDefenders.shift();
            if (getTeamDefenseScore(teamA) <= getTeamDefenseScore(teamB)) {
                assignPlayer(player, teamA);
            } else {
                assignPlayer(player, teamB);
            }
        }
        
        // --- 3. Distribuir Atacantes ---
        let attackersPool = available.filter(p => p.posPrimaria === 'Atacante').sort((a,b) => b.tempScore - a.tempScore);
        let secondaryAttackers = available.filter(p => p.posSecundaria === 'Atacante').sort((a,b) => b.tempScore - a.tempScore);
        let allAttackers = [...attackersPool, ...secondaryAttackers];
        
        if (allAttackers.length > 0) assignPlayer(allAttackers.shift(), teamA);
        if (allAttackers.length > 0) assignPlayer(allAttackers.shift(), teamB);
        
        // --- 4. Distribuir Volantes Centrales ---
        let centralMids = available.filter(p => p.posPrimaria === 'Volante Central').sort((a,b) => b.tempScore - a.tempScore);
        const teamA_attackerScore = teamA.players.find(p => p.posPrimaria.includes('Atacante'))?.tempScore || 0;
        const teamB_attackerScore = teamB.players.find(p => p.posPrimaria.includes('Atacante'))?.tempScore || 0;
        
        let midStartingTeam = teamA_attackerScore >= teamB_attackerScore ? teamA : teamB;
        let midOtherTeam = midStartingTeam === teamA ? teamB : teamA;
        
        if (centralMids.length > 0) assignPlayer(centralMids.shift(), midStartingTeam);
        if (centralMids.length > 0) assignPlayer(centralMids.shift(), midOtherTeam);
        if (centralMids.length > 0) assignPlayer(centralMids.shift(), midStartingTeam);
        if (centralMids.length > 0) assignPlayer(centralMids.shift(), midOtherTeam);

        // --- 5. Distribuir Volantes Laterales ---
        let lateralMids = available.filter(p => p.posPrimaria === 'Volante Lateral').sort((a,b) => b.tempScore - a.tempScore);
        while (teamA.players.length + teamB.players.length < 18 && lateralMids.length > 0) {
             const player = lateralMids.shift();
             const scoreA = teamA.players.filter(p => p.posPrimaria.includes('Volante')).reduce((sum, p) => sum + p.tempScore, 0);
             const scoreB = teamB.players.filter(p => p.posPrimaria.includes('Volante')).reduce((sum, p) => sum + p.tempScore, 0);
             if (scoreA <= scoreB) { assignPlayer(player, teamA); }
             else { assignPlayer(player, teamB); }
        }

        // --- 6. Relleno Final con los sobrantes ---
        while (teamA.players.length < 9 && available.length > 0) assignPlayer(available.shift(), teamA);
        while (teamB.players.length < 9 && available.length > 0) assignPlayer(available.shift(), teamB);
        
        players.forEach(p => { delete p.tempScore; });
        return { teamA: teamA.players, teamB: teamB.players };
    },
    
    // NUEVO: Función separada para asignar posiciones y números al final
    assignFinalPositionsAndNumbers(teamAPlayers, teamBPlayers) {
        const assignToTeam = (team) => {
            const positions = [];
            const assigned = new Set();
            const findAndAssign = (number, condition, posName) => {
                const player = team.find(p => condition(p) && !assigned.has(p.id));
                if (player) {
                    positions.push({ player, number, finalPosition: posName });
                    assigned.add(player.id);
                }
            };
            // Asignar posiciones clave
            findAndAssign(9, p => p.posPrimaria === 'Atacante', 'Delantero');
            findAndAssign(2, p => p.posPrimaria === 'Defensa Central', 'Defensor Central');
            findAndAssign(5.1, p => p.posPrimaria === 'Volante Central', 'Volante Central');
            findAndAssign(5.2, p => p.posPrimaria === 'Volante Central', 'Volante Central');
            // ... (resto de la lógica de asignación)
            const remaining = team.filter(p => !assigned.has(p.id));
            const neededNumbers = [3, 6, 4, 7, 8].filter(num => !positions.some(p => Math.floor(p.number) === num));
            neededNumbers.forEach(num => {
                if(remaining.length > 0) {
                    const player = remaining.shift();
                    const posName = num === 7 || num === 8 ? 'Volante Lateral' : 'Defensor Lateral';
                    positions.push({player, number: num, finalPosition: posName});
                    assigned.add(player.id);
                }
            });
            return positions;
        };
        return { positionsA: assignToTeam(teamAPlayers), positionsB: assignToTeam(teamBPlayers) };
    },

    // CORREGIDO: Lógica de posicionamiento y numeración precisa
    displayTeamsOnPitch(positionsA, positionsB) {
        const pitchDisplay = document.getElementById('pitch-display');
        pitchDisplay.innerHTML = '';

        const posCoords = {
            // Defensas (Columna 1)
            3: { x: 18, y: 20 }, 2: { x: 18, y: 40 }, 6: { x: 18, y: 60 }, 4: { x: 18, y: 80 },
            // Volantes (Columna 2) - Más cerca de la defensa
            7: { x: 38, y: 20 }, 5.1: { x: 38, y: 40 }, 5.2: { x: 38, y: 60 }, 8: { x: 38, y: 80 },
            // Delantero (Columna 3) - Más alejado
            9: { x: 52, y: 50 }
        };

        const drawTeam = (positions, teamClass) => {
            const teamDisplay = document.createElement('div');
            teamDisplay.className = `team-display ${teamClass}`;
            positions.forEach(({ player, number }) => {
                let coords = posCoords[number];
                if (teamClass === 'teamB') coords = { x: 100 - coords.x, y: coords.y };
                const playerToken = document.createElement('div');
                playerToken.className = 'player-token';
                playerToken.style.left = `${coords.x}%`;
                playerToken.style.top = `${coords.y}%`;
                playerToken.innerHTML = `<img src="${player.foto || 'assets/images/default-player.png'}" alt="${player.nombre}"><span>[${Math.floor(number)}] ${player.nombre} ${player.apellido}</span>`;
                teamDisplay.appendChild(playerToken);
            });
            pitchDisplay.appendChild(teamDisplay);
        };
        
        drawTeam(positionsA, 'teamA');
        drawTeam(positionsB, 'teamB');
    },

    // CORREGIDO: Muestra listas según la posición final asignada
    displayTeamLists(positionsA, positionsB) {
        const container = document.getElementById('roster-column');
        const generateDetailedList = (positions, teamName, teamClass) => {
            positions.forEach(({player}) => player.tempScore = parseFloat(player.puntajeGeneral));
            
            const defenders = positions.filter(p => p.finalPosition.includes('Defensor'));
            const midfielders = positions.filter(p => p.finalPosition.includes('Volante'));
            const attackers = positions.filter(p => p.finalPosition.includes('Delantero'));

            const calculateAverage = (arr) => {
                if (arr.length === 0) return 'N/A';
                const sum = arr.reduce((acc, {player}) => acc + player.tempScore, 0);
                return (sum / arr.length).toFixed(1);
            };

            let html = `<div class="roster-details"><h4>${teamName}</h4>`;
            html += `<div class="roster-section"><strong>Defensa (Prom: ${calculateAverage(defenders)})</strong><ul class="team-roster-list ${teamClass}">`;
            defenders.sort((a,b) => a.number - b.number).forEach(({player, number}) => { html += `<li>[${Math.floor(number)}] ${player.nombre} ${player.apellido} - <strong>${player.tempScore.toFixed(1)}</strong></li>`; });
            html += `</ul></div>`;
            
            html += `<div class="roster-section"><strong>Volantes (Prom: ${calculateAverage(midfielders)})</strong><ul class="team-roster-list ${teamClass}">`;
            midfielders.sort((a,b) => a.number - b.number).forEach(({player, number}) => { html += `<li>[${Math.floor(number)}] ${player.nombre} ${player.apellido} - <strong>${player.tempScore.toFixed(1)}</strong></li>`; });
            html += `</ul></div>`;

            html += `<div class="roster-section"><strong>Delanteros (Prom: ${calculateAverage(attackers)})</strong><ul class="team-roster-list ${teamClass}">`;
            attackers.sort((a,b) => a.number - b.number).forEach(({player, number}) => { html += `<li>[${Math.floor(number)}] ${player.nombre} ${player.apellido} - <strong>${player.tempScore.toFixed(1)}</strong></li>`; });
            html += `</ul></div></div>`;
            return html;
        };
        
        container.innerHTML = generateDetailedList(positionsA, "Equipo A", "teamA") + generateDetailedList(positionsB, "Equipo B", "teamB");
    },
    
    async startMatch() {
        if (this.currentMatchup) {
            await api.post({ action: 'addMatch', match: this.currentMatchup });
            alert('¡Partido guardado! Ahora puedes cargar el resultado en la sección "Resultados".');
            window.appState.matches = await api.get('getMatches');
            this.render(window.appState.players);
        }
    }
};










