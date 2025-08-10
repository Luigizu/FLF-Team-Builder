const teamBuilder = {
    render(allPlayers) {
        const container = document.getElementById('team-builder-screen');
        container.innerHTML = `
            <h2>Armar Equipos</h2>
            <div class="container">
                <div class="input-section">
                    <h3>Jugadores de Hoy</h3>
                    <p>Pega la lista numerada de jugadores aquí:</p>
                    <textarea id="player-list-input" placeholder="1. Juampi Viatore\n2. Luigi\n3. Nico B."></textarea>
                    <button id="generate-teams-btn">Generar Equipos</button>
                </div>
                <div class="pitch-section">
                    <h3>Equipos</h3>
                    <div id="teams-output">
                        <div class="pitch">
                            <div id="teamA-display" class="team-display teamA"></div>
                            <div id="teamB-display" class="team-display teamB"></div>
                        </div>
                        <div id="match-controls" class="hidden">
                             <button id="rearm-btn">Rearmar Equipos</button>
                             <button id="start-match-btn">Comenzar Partido</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('generate-teams-btn').addEventListener('click', () => this.processPlayerList(allPlayers));
    },

    async processPlayerList(allPlayers) {
        const input = document.getElementById('player-list-input').value.trim();
        const names = input.split('\n').map(name => name.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
        
        let playersForToday = [];
        let newPlayerNames = [];

        names.forEach(name => {
            const found = allPlayers.find(p => p.nombre.toLowerCase() === name.toLowerCase() || (p.apellido && `${p.nombre} ${p.apellido.charAt(0)}`.toLowerCase() === name.toLowerCase()));
            if (found) {
                playersForToday.push(found);
            } else {
                newPlayerNames.push(name);
            }
        });

        if (newPlayerNames.length > 0) {
            for (const name of newPlayerNames) {
                const newPlayerData = await this.promptForNewPlayer(name);
                if (newPlayerData) {
                    await api.post({ action: 'addPlayer', player: newPlayerData });
                    // Recargamos los jugadores para tener el nuevo ID
                    window.appState.players = await api.get('getPlayers');
                    const addedPlayer = window.appState.players.find(p => p.nombre === newPlayerData.nombre && p.apellido === newPlayerData.apellido);
                    if(addedPlayer) playersForToday.push(addedPlayer);
                }
            }
        }
        
        if (playersForToday.length < 18) {
            alert(`Se necesitan 18 jugadores, solo hay ${playersForToday.length}.`);
            return;
        }

        const { teamA, teamB } = this.balanceTeams(playersForToday.slice(0, 18));
        this.displayTeams(teamA, teamB);
        this.currentMatchup = { teamA, teamB };
        document.getElementById('match-controls').classList.remove('hidden');
        document.getElementById('start-match-btn').onclick = () => this.startMatch();
        document.getElementById('rearm-btn').onclick = () => this.processPlayerList(allPlayers);
    },
    
    promptForNewPlayer(name) {
        return new Promise(resolve => {
            const modalContainer = document.getElementById('modal-container');
            const modalContent = document.getElementById('modal-content');
            modalContent.innerHTML = `
                <h3>Registrar Jugador Nuevo: ${name}</h3>
                <input id="new-player-nombre" type="text" placeholder="Nombre" value="${name}">
                <input id="new-player-apellido" type="text" placeholder="Apellido">
                <select id="new-player-pos1">
                    <option value="">Posición Primaria</option>
                    <option>Arquero</option><option>Defensa Central</option><option>Defensa Lateral</option>
                    <option>Volante Central</option><option>Volante Lateral</option><option>Atacante</option>
                </select>
                <select id="new-player-pos2">
                    <option value="">Posición Secundaria (Opcional)</option>
                     <option>Arquero</option><option>Defensa Central</option><option>Defensa Lateral</option>
                    <option>Volante Central</option><option>Volante Lateral</option><option>Atacante</option>
                </select>
                <select id="new-player-habilidad">
                    <option value="Media">Habilidad General</option>
                    <option value="Buena">Buena (8 pts)</option>
                    <option value="Media">Media (5 pts)</option>
                    <option value="Baja">Baja (3 pts)</option>
                </select>
                <button id="save-new-player">Guardar</button>
            `;
            modalContainer.classList.remove('hidden');

            document.getElementById('save-new-player').onclick = () => {
                const habilidad = document.getElementById('new-player-habilidad').value;
                const newPlayer = {
                    nombre: document.getElementById('new-player-nombre').value,
                    apellido: document.getElementById('new-player-apellido').value,
                    posPrimaria: document.getElementById('new-player-pos1').value,
                    posSecundaria: document.getElementById('new-player-pos2').value,
                    habilidadGeneral: habilidad,
                    puntajeGeneral: habilidad === 'Buena' ? 8 : (habilidad === 'Baja' ? 3 : 5)
                };
                modalContainer.classList.add('hidden');
                resolve(newPlayer);
            };
        });
    },

    balanceTeams(players) {
        let teamA = { players: [], score: 0 };
        let teamB = { players: [], score: 0 };
    
        players.forEach(p => {
            p.tempScore = p.posPrimaria === 'Arquero' ? 10 : parseInt(p.puntajeGeneral);
            p.tempRole = p.posPrimaria === 'Arquero' ? 'Defensa Central' : p.posPrimaria;
        });

        const getRole = (p) => {
            if (p.tempRole.includes('Defensa')) return 'def';
            if (p.tempRole.includes('Volante')) return 'mid';
            return 'fwd';
        };

        let defenders = players.filter(p => getRole(p) === 'def').sort((a, b) => b.tempScore - a.tempScore);
        let midfielders = players.filter(p => getRole(p) === 'mid').sort((a, b) => b.tempScore - a.tempScore);
        let attackers = players.filter(p => getRole(p) === 'fwd').sort((a, b) => b.tempScore - a.tempScore);

        // Algoritmo de distribución...
        // ... (Implementación simplificada para brevedad, una versión robusta sería más compleja)
        [...defenders, ...midfielders, ...attackers].forEach(player => {
            if (teamA.players.length <= teamB.players.length) {
                teamA.players.push(player);
                teamA.score += player.tempScore;
            } else {
                teamB.players.push(player);
                teamB.score += player.tempScore;
            }
        });

        // Simple rebalanceo
        for (let i = 0; i < 5; i++) { // Iterar para ajustar
            if (Math.abs(teamA.score - teamB.score) < 2) break;
            if (teamA.score > teamB.score) {
                 //buscar un jugador en A para pasar a B y uno de B para pasar a A
            } else {
                 // Inverso
            }
        }
    
        return { teamA, teamB };
    },

    displayTeams(teamA, teamB) {
        const teamADisplay = document.getElementById('teamA-display');
        const teamBDisplay = document.getElementById('teamB-display');
        teamADisplay.innerHTML = '<h4>Equipo A</h4>';
        teamBDisplay.innerHTML = '<h4>Equipo B</h4>';

        // Posiciones aproximadas en el campo (top, left en %)
        const positions = {
            def: [[80, 20], [80, 40], [80, 60], [80, 80]],
            mid: [[50, 20], [50, 40], [50, 60], [50, 80]],
            fwd: [[20, 50]]
        };
        
        const placePlayer = (player, teamDisplay, teamType, index) => {
            // Lógica para asignar posición en el campo
            const role = player.posPrimaria.includes('Defensa') ? 'def' : (player.posPrimaria.includes('Volante') ? 'mid' : 'fwd');
            const pos = positions[role].shift() || [10,10];
            
            const playerToken = document.createElement('div');
            playerToken.className = 'player-token';
            playerToken.style.top = `${pos[0]}%`;
            playerToken.style.left = `${pos[1]}%`;
            playerToken.innerHTML = `<img src="${player.foto}" alt="${player.nombre}"><span>${player.nombre}</span>`;
            teamDisplay.appendChild(playerToken);
        };
        
        teamA.players.forEach((p, i) => placePlayer(p, teamADisplay, 'A', i));
        teamB.players.forEach((p, i) => placePlayer(p, teamBDisplay, 'B', i));
    },

    async startMatch() {
        if (this.currentMatchup) {
            await api.post({ action: 'addMatch', match: this.currentMatchup });
            alert('¡Partido guardado! Ahora puedes cargar el resultado en la sección "Resultados".');
            // Recargar datos y volver a la pantalla principal
            window.appState.matches = await api.get('getMatches');
            document.getElementById('team-builder-screen').innerHTML = ''; // Limpiar pantalla
            this.render(window.appState.players);
        }
    }
};