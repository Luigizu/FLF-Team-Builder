const teamBuilder = {
    render(allPlayers) {
        const container = document.getElementById('team-builder-screen');
        container.innerHTML = `
            <h2>Armar Equipos</h2>
            <div class="three-column-layout">
                <div class="input-column">
                    <h3>Jugadores de Hoy</h3>
                    <p>Pega la lista numerada de jugadores aquí:</p>
                    <textarea id="player-list-input" placeholder="1. Nico A\n2. Pala\n3. Nico"></textarea>
                    <button id="generate-teams-btn">Generar Equipos</button>
                </div>
                <div class="pitch-column">
                    <div class="pitch-container">
                         <div id="pitch-display" class="pitch"></div>
                    </div>
                    <div id="match-controls" class="hidden" style="text-align:center; margin-top:1rem;">
                         <button id="rearm-btn">Rearmar Equipos</button>
                         <button id="start-match-btn">Comenzar Partido</button>
                    </div>
                </div>
                <div class="roster-column" id="roster-column"></div>
            </div>
        `;
        document.getElementById('generate-teams-btn').addEventListener('click', () => this.processPlayerList(allPlayers));
    },

    cleanPastedNames(text) {
        return text.split('\n')
            .map(line => line.replace(/^\d+\.?[)\]\s]*/, '').trim())
            .filter(Boolean);
    },

    async processPlayerList(allPlayers) {
        const input = document.getElementById('player-list-input').value;
        const pastedNames = this.cleanPastedNames(input);
        
        let playersForToday = [];
        let availablePlayers = [...allPlayers];

        for (const name of pastedNames) {
            const results = this.findPlayer(name, availablePlayers);
            let chosenPlayer;

            if (results.length === 1 && results[0].score < 0.01) { // Coincidencia casi perfecta, se acepta automáticamente
                chosenPlayer = results[0].player;
            } else if (results.length === 1) { // Una sola coincidencia, pero no es perfecta. Pedir confirmación.
                chosenPlayer = await this.confirmSingleMatch(name, results[0].player, availablePlayers);
            } else if (results.length > 1) { // Múltiples coincidencias
                chosenPlayer = await this.resolveAmbiguity(name, results.map(r => r.player));
            } else { // Sin coincidencias
                chosenPlayer = await this.resolveUnmatchedPlayer(name, availablePlayers);
            }

            if (chosenPlayer) {
                playersForToday.push(chosenPlayer);
                availablePlayers = availablePlayers.filter(p => p.id !== chosenPlayer.id);
            } else {
                alert(`Proceso cancelado. No se pudo resolver al jugador "${name}".`);
                return;
            }
        }
        
        if (playersForToday.length < 18) {
            alert(`Se necesitan 18 jugadores. Solo se resolvieron ${playersForToday.length}.`);
            return;
        }

        const { teamA, teamB } = this.balanceTeams(playersForToday.slice(0, 18));
        this.displayTeamsOnPitch(teamA, teamB);
        this.displayTeamLists(teamA, teamB);

        this.currentMatchup = { teamA, teamB };
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
                    posPrimaria: document.getElementById('new-player-pos1').value,
                    posSecundaria: document.getElementById('new-player-pos2').value,
                    puntajeGeneral: puntaje,
                    apodo: ''
                };
                await api.post({ action: 'addPlayer', player: newPlayerData });
                window.appState.players = await api.get('getPlayers');
                const addedPlayer = window.appState.players[window.appState.players.length - 1];
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
        let available = [...players]; // Copia de la lista de jugadores que se irá reduciendo

        available.forEach(p => {
            p.tempScore = p.posPrimaria === 'Arquero' ? 5.0 : parseFloat(p.puntajeGeneral);
        });
        
        // Función auxiliar para asignar un jugador y removerlo de la lista de disponibles
        const assignPlayer = (player, team) => {
            team.players.push(player);
            team.score += player.tempScore;
            available = available.filter(p => p.id !== player.id);
        };

        // Categorizamos a TODOS los jugadores disponibles UNA SOLA VEZ
        let defenders = available.filter(p => p.posPrimaria.includes('Defensa') || p.posPrimaria === 'Arquero').sort((a,b) => b.tempScore - a.tempScore);
        let midfielders = available.filter(p => p.posPrimaria.includes('Volante')).sort((a,b) => b.tempScore - a.tempScore);
        let attackers = available.filter(p => p.posPrimaria.includes('Atacante')).sort((a,b) => b.tempScore - a.tempScore);
        
        // --- PROCESO DE ARMADO SECUENCIAL ---

        // 1. DEFENSAS (4 por equipo)
        for (let i = 0; i < 8; i++) {
            if (defenders.length === 0) break;
            const player = defenders.shift(); // Saca al mejor defensor disponible
            const scoreA = teamA.players.filter(p => p.posPrimaria.includes('Defensa')).reduce((acc, p) => acc + p.tempScore, 0);
            const scoreB = teamB.players.filter(p => p.posPrimaria.includes('Defensa')).reduce((acc, p) => acc + p.tempScore, 0);
            
            if (teamA.players.filter(p => p.posPrimaria.includes('Defensa')).length <= teamB.players.filter(p => p.posPrimaria.includes('Defensa')).length) {
                assignPlayer(player, teamA);
            } else {
                assignPlayer(player, teamB);
            }
        }

        // 2. VOLANTES (4 por equipo, con reglas)
        for (let i = 0; i < 8; i++) {
            if (midfielders.length === 0) break;
            
            const teamACentralMids = teamA.players.filter(p => p.posPrimaria === 'Volante Central').length;
            const teamBCentralMids = teamB.players.filter(p => p.posPrimaria === 'Volante Central').length;

            // Busca un jugador que NO rompa la regla de los 2 volantes centrales
            let playerIndex = midfielders.findIndex(p => 
                (teamA.players.filter(pl => pl.posPrimaria.includes('Volante')).length < 4 && (p.posPrimaria !== 'Volante Central' || teamACentralMids < 2)) ||
                (teamB.players.filter(pl => pl.posPrimaria.includes('Volante')).length < 4 && (p.posPrimaria !== 'Volante Central' || teamBCentralMids < 2))
            );
            if (playerIndex === -1) playerIndex = 0; // Si todos rompen la regla, toma el primero
            
            const player = midfielders.splice(playerIndex, 1)[0];
            
             if (teamA.players.filter(p => p.posPrimaria.includes('Volante')).length <= teamB.players.filter(p => p.posPrimaria.includes('Volante')).length) {
                if (player.posPrimaria !== 'Volante Central' || teamACentralMids < 2) {
                    assignPlayer(player, teamA);
                } else { // Si no puede ir a A, intenta en B
                    if (teamBCentralMids < 2) assignPlayer(player, teamB);
                    else midfielders.push(player); // Devuelve al pool si no cabe en ningún lado
                }
            } else {
                if (player.posPrimaria !== 'Volante Central' || teamBCentralMids < 2) {
                    assignPlayer(player, teamB);
                } else {
                    if (teamACentralMids < 2) assignPlayer(player, teamA);
                    else midfielders.push(player);
                }
            }
        }

        // 3. DELANTEROS (1 por equipo, para compensar)
        for (let i = 0; i < 2; i++) {
            if (attackers.length === 0) break;
            const player = attackers.shift();
            if(teamA.players.length < 9 && teamB.players.length < 9) {
                 if (teamA.score <= teamB.score) assignPlayer(player, teamA);
                 else assignPlayer(player, teamB);
            } else if (teamA.players.length < 9) {
                 assignPlayer(player, teamA);
            } else {
                 assignPlayer(player, teamB);
            }
        }
        
        // 4. RELLENO FINAL (con lo que sobre de cualquier posición)
        const leftovers = [...defenders, ...midfielders, ...attackers, ...available.filter(p => !p.posPrimaria)];
        leftovers.sort((a,b) => b.tempScore - a.tempScore);
        
        while (teamA.players.length < 9 && leftovers.length > 0) {
            assignPlayer(leftovers.shift(), teamA);
        }
        while (teamB.players.length < 9 && leftovers.length > 0) {
            assignPlayer(leftovers.shift(), teamB);
        }

        players.forEach(p => { delete p.tempScore; });
        return { teamA, teamB };
    },
    
    displayTeamsOnPitch(teamA, teamB) {
        const pitchDisplay = document.getElementById('pitch-display');
        pitchDisplay.innerHTML = '';

        // Definimos la grilla de coordenadas EXACTA
        const posCoords = {
            // Defensas (Columna 1)
            3: { x: 15, y: 20 },
            2: { x: 15, y: 40 },
            6: { x: 15, y: 60 },
            4: { x: 15, y: 80 },
            // Volantes (Columna 2)
            7: { x: 35, y: 20 }, // Delante del 3
            5.1: { x: 35, y: 40 }, // Delante del 2 (usamos .1 y .2 para diferenciar los dos 5)
            5.2: { x: 35, y: 60 }, // Delante del 6
            8: { x: 35, y: 80 }, // Delante del 4
            // Delantero (Columna 3)
            9: { x: 47, y: 50 }
        };

        const assignPositions = (team) => {
            const assignedPlayers = new Set();
            let positions = [];

            const findAndAssign = (posNumber, condition) => {
                const player = team.find(p => condition(p) && !assignedPlayers.has(p.id));
                if (player) {
                    positions.push({ player, number: posNumber });
                    assignedPlayers.add(player.id);
                }
            };

            // Asignar posiciones clave primero
            findAndAssign(9, p => p.posPrimaria === 'Atacante');
            findAndAssign(2, p => p.posPrimaria === 'Defensa Central');
            findAndAssign(5.1, p => p.posPrimaria === 'Volante Central');
            findAndAssign(5.2, p => p.posPrimaria === 'Volante Central');
            findAndAssign(7, p => p.posPrimaria === 'Volante Lateral');
            findAndAssign(8, p => p.posPrimaria === 'Volante Lateral');
            findAndAssign(3, p => p.posPrimaria === 'Defensa Lateral');
            findAndAssign(4, p => p.posPrimaria === 'Defensa Lateral');
            findAndAssign(6, p => p.posPrimaria.includes('Defensa')); // El que quede
            
            // Rellenar los huecos con los jugadores restantes
            const remainingPlayers = team.filter(p => !assignedPlayers.has(p.id));
            const neededNumbers = [3,2,6,4,7,5.1,5.2,8,9].filter(num => !positions.some(p => p.number === num));
            
            neededNumbers.forEach(num => {
                if (remainingPlayers.length > 0) {
                    const player = remainingPlayers.shift();
                    positions.push({ player, number: num });
                    assignedPlayers.add(player.id);
                }
            });
            return positions;
        };

        const drawTeam = (positions, teamClass) => {
            const teamDisplay = document.createElement('div');
            teamDisplay.className = `team-display ${teamClass}`;

            positions.forEach(({ player, number }) => {
                const displayNum = Math.floor(number); // Quita el decimal para mostrar (5.1 -> 5)
                let coords = posCoords[number];

                if (teamClass === 'teamB') {
                    coords = { x: 100 - coords.x, y: coords.y };
                }

                const playerToken = document.createElement('div');
                playerToken.className = 'player-token';
                playerToken.style.left = `${coords.x}%`;
                playerToken.style.top = `${coords.y}%`;
                playerToken.innerHTML = `<img src="${player.foto || 'assets/images/default-player.png'}" alt="${player.nombre}"><span>[${displayNum}] ${player.nombre} ${player.apellido}</span>`;
                teamDisplay.appendChild(playerToken);
            });
            pitchDisplay.appendChild(teamDisplay);
        };

        const positionsA = assignPositions(teamA.players);
        const positionsB = assignPositions(teamB.players);
        
        drawTeam(positionsA, 'teamA');
        drawTeam(positionsB, 'teamB');
    },

    displayTeamLists(teamA, teamB) {
        const container = document.getElementById('roster-column');

        const generateDetailedList = (team, teamName, teamClass) => {
            team.forEach(p => p.tempScore = p.posPrimaria === 'Arquero' ? 5.0 : parseFloat(p.puntajeGeneral));

            const defenders = team.filter(p => p.posPrimaria.includes('Defensa') || p.posPrimaria === 'Arquero');
            const midfielders = team.filter(p => p.posPrimaria.includes('Volante'));
            const attackers = team.filter(p => p.posPrimaria.includes('Atacante'));

            const calculateAverage = (arr) => {
                if (arr.length === 0) return 'N/A';
                const sum = arr.reduce((acc, p) => acc + p.tempScore, 0);
                return (sum / arr.length).toFixed(1);
            };

            let html = `<div class="roster-details"><h4>${teamName}</h4>`;

            // Sección Defensa
            html += `<div class="roster-section"><strong>Defensa (Prom: ${calculateAverage(defenders)})</strong>`;
            html += `<ul class="team-roster-list ${teamClass}">`;
            defenders.forEach(p => { html += `<li>${p.nombre} ${p.apellido} - <strong>${p.tempScore.toFixed(1)}</strong></li>`; });
            html += `</ul></div>`;

            // Sección Volantes
            html += `<div class="roster-section"><strong>Volantes (Prom: ${calculateAverage(midfielders)})</strong>`;
            html += `<ul class="team-roster-list ${teamClass}">`;
            midfielders.forEach(p => { html += `<li>${p.nombre} ${p.apellido} - <strong>${p.tempScore.toFixed(1)}</strong></li>`; });
            html += `</ul></div>`;

            // Sección Delanteros
            html += `<div class="roster-section"><strong>Delanteros (Prom: ${calculateAverage(attackers)})</strong>`;
            html += `<ul class="team-roster-list ${teamClass}">`;
            attackers.forEach(p => { html += `<li>${p.nombre} ${p.apellido} - <strong>${p.tempScore.toFixed(1)}</strong></li>`; });
            html += `</ul></div>`;
            
            html += `</div>`;
            return html;
        };
        
        container.innerHTML = generateDetailedList(teamA.players, "Equipo A", "teamA") + generateDetailedList(teamB.players, "Equipo B", "teamB");
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







