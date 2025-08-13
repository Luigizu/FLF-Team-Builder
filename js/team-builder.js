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
            const matches = this.findPlayer(name, availablePlayers);
            let chosenPlayer;
            if (matches.length === 1) {
                chosenPlayer = matches[0];
            } else if (matches.length > 1) {
                chosenPlayer = await this.resolveAmbiguity(name, matches);
            } else {
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
            .filter(result => result.score < bestScore + 0.05)
            .map(result => result.item);
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
                <div id="create-new-player-form" class="hidden">...</div>
                <button id="cancel-unmatched" class="cancel-btn">Cancelar</button>
            `;
            //... la lógica interna de este modal se mantiene igual ...
            document.getElementById('cancel-unmatched').onclick = () => {
                modalContainer.classList.add('hidden');
                resolve(null);
            };
        });
    },
    
    balanceTeams(players) {
        let teamA = { players: [], score: 0 }; let teamB = { players: [], score: 0 };
        let availablePlayers = [...players];
        availablePlayers.forEach(p => {
            p.tempScore = p.posPrimaria === 'Arquero' ? 5.0 : parseFloat(p.puntajeGeneral);
            p.tempRole = p.posPrimaria === 'Arquero' ? 'Defensa Central' : p.posPrimaria;
        });
        const assignPlayer = (player, team) => {
            team.players.push(player);
            team.score += player.tempScore;
            availablePlayers = availablePlayers.filter(p => p.id !== player.id);
        };
        const getPlayerType = (player) => {
            if (player.tempRole.includes('Defensa')) return 'def';
            if (player.tempRole.includes('Volante')) return 'mid';
            if (player.tempRole.includes('Atacante')) return 'fwd';
            return 'other';
        }

        // 1. Asignar Defensores Centrales prioritarios
        let centralDefenders = availablePlayers.filter(p => p.tempRole === 'Defensa Central').sort((a, b) => b.tempScore - a.tempScore);
        if (centralDefenders.length > 0) assignPlayer(centralDefenders.shift(), teamA);
        if (centralDefenders.length > 0) assignPlayer(centralDefenders.shift(), teamB);

        // 2. Equilibrar resto de la defensa
        let otherDefenders = availablePlayers.filter(p => p.tempRole.includes('Defensa')).sort((a, b) => b.tempScore - a.tempScore);
        let allDefenders = [...centralDefenders, ...otherDefenders];
        while ((teamA.players.filter(p => getPlayerType(p) === 'def').length < 4 || teamB.players.filter(p => getPlayerType(p) === 'def').length < 4) && allDefenders.length > 0) {
            let playerToAssign = allDefenders.shift();
            let teamADefenseScore = teamA.players.filter(p => getPlayerType(p) === 'def').reduce((sum, p) => sum + p.tempScore, 0);
            let teamBDefenseScore = teamB.players.filter(p => getPlayerType(p) === 'def').reduce((sum, p) => sum + p.tempScore, 0);
            if (teamADefenseScore <= teamBDefenseScore) {
                assignPlayer(playerToAssign, teamA);
            } else {
                assignPlayer(playerToAssign, teamB);
            }
        }
        
        // 3. Asignar Volantes Centrales prioritarios
        let centralMidfielders = availablePlayers.filter(p => p.tempRole === 'Volante Central').sort((a, b) => b.tempScore - a.tempScore);
        if (centralMidfielders.length > 0) assignPlayer(centralMidfielders.shift(), teamA);
        if (centralMidfielders.length > 0) assignPlayer(centralMidfielders.shift(), teamB);
        
        // 4. Equilibrar resto del mediocampo
        let otherMidfielders = availablePlayers.filter(p => p.tempRole.includes('Volante')).sort((a, b) => b.tempScore - a.tempScore);
        let allMidfielders = [...centralMidfielders, ...otherMidfielders];
        while ((teamA.players.filter(p => getPlayerType(p) === 'mid').length < 4 || teamB.players.filter(p => getPlayerType(p) === 'mid').length < 4) && allMidfielders.length > 0) {
            let playerToAssign = allMidfielders.shift();
            let teamAMidfieldScore = teamA.players.filter(p => getPlayerType(p) === 'mid').reduce((sum, p) => sum + p.tempScore, 0);
            let teamBMidfieldScore = teamB.players.filter(p => getPlayerType(p) === 'mid').reduce((sum, p) => sum + p.tempScore, 0);
            if (teamAMidfieldScore <= teamBMidfieldScore) {
                assignPlayer(playerToAssign, teamA);
            } else {
                assignPlayer(playerToAssign, teamB);
            }
        }

        // 5. Asignar Delanteros para compensar
        let attackers = availablePlayers.filter(p => getPlayerType(p) === 'fwd').sort((a, b) => b.tempScore - a.tempScore);
        while ((teamA.players.filter(p => getPlayerType(p) === 'fwd').length < 1 || teamB.players.filter(p => getPlayerType(p) === 'fwd').length < 1) && attackers.length > 0) {
            let playerToAssign = attackers.shift();
            if (teamA.score <= teamB.score) {
                assignPlayer(playerToAssign, teamA);
            } else {
                assignPlayer(playerToAssign, teamB);
            }
        }
        
        // 6. Rellenar con los sobrantes para balancear puntaje final
       while (availablePlayers.length > 0) {
            let playerToAssign = availablePlayers.shift();
            if (teamA.score <= teamB.score) assignPlayer(playerToAssign, teamA);
            else assignPlayer(playerToAssign, teamB);
        }
        players.forEach(p => { delete p.tempRole; delete p.tempScore; });
        return { teamA, teamB };
    },
    
    displayTeamsOnPitch(teamA, teamB) {
        const pitchDisplay = document.getElementById('pitch-display');
        pitchDisplay.innerHTML = `<div id="teamA-display" class="team-display teamA"></div><div id="teamB-display" class="team-display teamB"></div>`;
        const teamADisplay = document.getElementById('teamA-display');
        const teamBDisplay = document.getElementById('teamB-display');
        
        const posA = { def: [[20,20],[20,40],[20,60],[20,80]], mid: [[40,20],[40,40],[40,60],[40,80]], fwd: [[48,50]] };
        const posB = { def: [[80,20],[80,40],[80,60],[80,80]], mid: [[60,20],[60,40],[60,60],[60,80]], fwd: [[52,50]] };

        const assignNumber = (p, defenderNums, midfielderNums) => {
            if (p.posPrimaria === 'Defensa Central') return 2;
            if (p.posPrimaria.includes('Defensa')) return defenderNums.shift() || '?';
            if (p.posPrimaria === 'Volante Central') return 5;
            if (p.posPrimaria.includes('Volante')) return midfielderNums.shift() || '?';
            if (p.posPrimaria === 'Atacante') return 9;
            return 1;
        };

        const placePlayer = (player, teamDisplay, posMap, number) => {
            const role = player.posPrimaria.includes('Defensa') ? 'def' : (player.posPrimaria.includes('Volante') ? 'mid' : 'fwd');
            const pos = posMap[role].shift() || [10,10];
            const playerToken = document.createElement('div');
            playerToken.className = 'player-token';
            playerToken.style.left = `${pos[0]}%`;
            playerToken.style.top = `${pos[1]}%`;
            // CORRECCIÓN APLICADA AQUÍ: Se usa `player` en todo el string.
            playerToken.innerHTML = `<img src="${player.foto || 'assets/images/default-player.png'}" alt="${player.nombre}"><span>[${number}] ${player.nombre} ${player.apellido}</span>`;
            teamDisplay.appendChild(playerToken);
        };
        
        let defNumsA = [3, 4, 6], midNumsA = [7, 8];
        teamA.players.forEach(p => placePlayer(p, teamADisplay, posA, assignNumber(p, defNumsA, midNumsA)));
        
        let defNumsB = [3, 4, 6], midNumsB = [7, 8];
        teamB.players.forEach(p => placePlayer(p, teamBDisplay, posB, assignNumber(p, defNumsB, midNumsB)));
    },

    displayTeamLists(teamA, teamB) {
        const container = document.getElementById('roster-column');
        const generateList = (team, teamName, teamClass) => {
            let defenderNumbers = [3, 4, 6], midfielderNumbers = [7, 8];
            const assignNumber = (player) => {
                if (player.posPrimaria === 'Defensa Central') return 2;
                if (player.posPrimaria.includes('Defensa')) return defenderNumbers.shift() || '?';
                if (player.posPrimaria === 'Volante Central') return 5;
                if (player.posPrimaria.includes('Volante')) return midfielderNumbers.shift() || '?';
                if (player.posPrimaria === 'Atacante') return 9;
                return '?';
            };
            const playerItems = team.players.map(p => `<li>[${assignNumber(p)}] ${p.nombre} ${p.apellido}</li>`).join('');
            return `<h4>${teamName}</h4><ul class="team-roster-list ${teamClass}">${playerItems}</ul>`;
        };
        container.innerHTML = generateList(teamA, "Equipo A", "teamA") + generateList(teamB, "Equipo B", "teamB");
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



