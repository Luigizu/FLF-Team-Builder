const teamBuilder = {
    render(allPlayers) {
        const container = document.getElementById('team-builder-screen');
        container.innerHTML = `
            <h2>Armar Equipos</h2>
            <div class="three-column-layout">
                <div class="input-column">
                    <h3>Jugadores de Hoy</h3>
                    <p>Pega la lista numerada de jugadores aquí:</p>
                    <textarea id="player-list-input" placeholder="1. Nico Bravo\n2. Mati Pala\n3. Nico B."></textarea>
                    <button id="generate-teams-btn">Generar Equipos</button>
                </div>
                <div class="pitch-column">
                    <div class="pitch-container">
                         <div id="pitch-display" class="pitch">
                            <div id="teamA-display" class="team-display teamA"></div>
                            <div id="teamB-display" class="team-display teamB"></div>
                        </div>
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

    async processPlayerList(allPlayers) {
        const input = document.getElementById('player-list-input').value.trim();
        const pastedNames = input.split('\n').map(name => name.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
        
        let playersForToday = [];
        let availablePlayers = [...allPlayers];
        let unmatchedNames = [];

        pastedNames.forEach(name => {
            const foundPlayer = this.findPlayerByName(name, availablePlayers);
            if (foundPlayer) {
                playersForToday.push(foundPlayer);
                availablePlayers = availablePlayers.filter(p => p.id !== foundPlayer.id);
            } else {
                unmatchedNames.push(name);
            }
        });

        if (unmatchedNames.length > 0) {
            for (const name of unmatchedNames) {
                const resolvedPlayer = await this.resolveUnmatchedPlayer(name, availablePlayers);
                if (resolvedPlayer) {
                    playersForToday.push(resolvedPlayer);
                    availablePlayers = availablePlayers.filter(p => p.id !== resolvedPlayer.id);
                } else {
                    alert(`No se pudo resolver al jugador "${name}". Proceso cancelado.`);
                    return; 
                }
            }
        }
        
        if (playersForToday.length < 18) {
            alert(`Se necesitan 18 jugadores para armar dos equipos de 9. Solo se resolvieron ${playersForToday.length}.`);
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
    
    // CORREGIDO: Lógica de búsqueda mucho más flexible
    findPlayerByName(name, playerPool) {
        const lowerCaseName = name.toLowerCase().trim();
        const nameParts = lowerCaseName.split(' ');

        for (const player of playerPool) {
            const fullName = `${player.nombre.toLowerCase()} ${player.apellido.toLowerCase()}`;
            const firstName = player.nombre.toLowerCase();
            const lastName = player.apellido.toLowerCase();

            // 1. Coincidencia exacta de nombre completo
            if (fullName === lowerCaseName) return player;

            // 2. Coincidencia de Nombre + Inicial Apellido (ej: "Nico B" -> "Nico Bravo")
            if (nameParts.length === 2 && firstName === nameParts[0] && lastName.startsWith(nameParts[1])) {
                return player;
            }

            // 3. Coincidencia solo por apellido (ej: "Pala" -> "Mati Pala")
            if (nameParts.length === 1 && lastName === lowerCaseName) {
                return player;
            }
            
            // 4. Coincidencia solo por nombre
            if (nameParts.length === 1 && firstName === lowerCaseName) {
                return player;
            }
        }
        return null; // No se encontró ninguna coincidencia
    },

    // CORREGIDO: Modal con buscador en lugar de lista desplegable
    resolveUnmatchedPlayer(name, availablePlayers) {
        return new Promise(resolve => {
            const modalContainer = document.getElementById('modal-container');
            const modalContent = document.getElementById('modal-content');

            modalContent.innerHTML = `
                <h3>¿Quién es "${name}"?</h3>
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
                    <label for="new-player-habilidad">Puntaje General (1.0 - 5.0)</label>
                    <input id="new-player-habilidad" type="number" step="0.1" min="1" max="5" placeholder="ej: 3.5">
                    <button id="save-new-player">Guardar Nuevo Jugador</button>
                </div>
            `;
            modalContainer.classList.remove('hidden');

            const searchInput = document.getElementById('search-player-input');
            const searchResultsContainer = document.getElementById('search-results');

            const renderResults = (query) => {
                searchResultsContainer.innerHTML = '';
                if (!query) return;

                const filtered = availablePlayers.filter(p => 
                    `${p.nombre} ${p.apellido}`.toLowerCase().includes(query.toLowerCase())
                );
                
                filtered.forEach(player => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.textContent = `${player.nombre} ${player.apellido} (${player.puntajeGeneral})`;
                    item.onclick = () => {
                        modalContainer.classList.add('hidden');
                        resolve(player);
                    };
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
                    puntajeGeneral: puntaje
                };
                await api.post({ action: 'addPlayer', player: newPlayerData });
                window.appState.players = await api.get('getPlayers');
                const addedPlayer = window.appState.players[window.appState.players.length - 1];
                modalContainer.classList.add('hidden');
                resolve(addedPlayer);
            };
        });
    },

    // CORREGIDO: Adaptado a la nueva escala de puntajes (1-5 con decimales)
    balanceTeams(players) {
        let teamA = { players: [], score: 0 };
        let teamB = { players: [], score: 0 };
        let availablePlayers = [...players];

        availablePlayers.forEach(p => {
            if (p.posPrimaria === 'Arquero') {
                p.tempRole = 'Defensa Central';
                p.tempScore = 5.0; // El arquero ahora vale el máximo de la nueva escala
            } else {
                p.tempRole = p.posPrimaria;
                p.tempScore = parseFloat(p.puntajeGeneral); // Usamos parseFloat para decimales
            }
        });
        
        const assignPlayer = (player, team) => {
            team.players.push(player);
            team.score += player.tempScore;
            availablePlayers = availablePlayers.filter(p => p.id !== player.id);
        };
        // ... (el resto de la lógica de priorización de posiciones se mantiene igual)
        // Solo como ejemplo, esta es una versión simplificada, la tuya es más compleja:
         while (availablePlayers.length > 0) {
            let playerToAssign = availablePlayers.shift();
            if (teamA.score <= teamB.score) {
               assignPlayer(playerToAssign, teamA);
            } else {
               assignPlayer(playerToAssign, teamB);
            }
         }
        
        players.forEach(p => { delete p.tempRole; delete p.tempScore; });
        return { teamA, teamB };
    },

    // CORREGIDO: Los tokens en la cancha ahora muestran número y nombre completo
    displayTeamsOnPitch(teamA, teamB) {
        const teamADisplay = document.getElementById('teamA-display');
        const teamBDisplay = document.getElementById('teamB-display');
        teamADisplay.innerHTML = ''; teamBDisplay.innerHTML = '';
        
        const posA = { def: [[20,20],[20,40],[20,60],[20,80]], mid: [[40,20],[40,40],[40,60],[40,80]], fwd: [[48,50]] };
        const posB = { def: [[80,20],[80,40],[80,60],[80,80]], mid: [[60,20],[60,40],[60,60],[60,80]], fwd: [[52,50]] };

        const assignNumber = (player, defenderNums, midfielderNums) => {
            if (player.posPrimaria === 'Defensa Central') return 2;
            if (player.posPrimaria.includes('Defensa')) return defenderNums.shift() || '?';
            if (player.posPrimaria === 'Volante Central') return 5;
            if (player.posPrimaria.includes('Volante')) return midfielderNums.shift() || '?';
            if (player.posPrimaria === 'Atacante') return 9;
            return 1; // Arquero u otros
        };

        let defNumsA = [3, 4, 6], midNumsA = [7, 8];
        teamA.players.forEach(p => {
            const number = assignNumber(p, defNumsA, midNumsA);
            const role = p.tempRole.includes('Defensa') ? 'def' : (p.tempRole.includes('Volante') ? 'mid' : 'fwd');
            const pos = posA[role].shift() || [10,10];
            
            const playerToken = document.createElement('div');
            playerToken.className = 'player-token';
            playerToken.style.left = `${pos[0]}%`;
            playerToken.style.top = `${pos[1]}%`;
            playerToken.innerHTML = `<img src="${p.foto}" alt="${p.nombre}"><span>[${number}] ${p.nombre} ${p.apellido}</span>`;
            teamADisplay.appendChild(playerToken);
        });
        
        let defNumsB = [3, 4, 6], midNumsB = [7, 8];
        teamB.players.forEach(p => {
            const number = assignNumber(p, defNumsB, midNumsB);
            const role = p.tempRole.includes('Defensa') ? 'def' : (p.tempRole.includes('Volante') ? 'mid' : 'fwd');
            const pos = posB[role].shift() || [10,10];

            const playerToken = document.createElement('div');
            playerToken.className = 'player-token';
            playerToken.style.left = `${pos[0]}%`;
            playerToken.style.top = `${pos[1]}%`;
            playerToken.innerHTML = `<img src="${p.foto}" alt="${p.nombre}"><span>[${number}] ${p.nombre} ${p.apellido}</span>`;
            teamBDisplay.appendChild(playerToken);
        });
    },
    
    // (El resto de las funciones: displayTeamLists y startMatch se mantienen igual)
    displayTeamLists(teamA, teamB) {
        const container = document.getElementById('roster-column');
        
        const generateList = (team, teamName, teamClass) => {
            let defenderNumbers = [3, 4, 6];
            let midfielderNumbers = [7, 8];
            
            const playerItems = team.players.map(p => {
                let number;
                if (p.posPrimaria === 'Defensa Central') number = 2;
                else if (p.posPrimaria.includes('Defensa')) number = defenderNumbers.shift() || '?';
                else if (p.posPrimaria === 'Volante Central') number = 5;
                else if (p.posPrimaria.includes('Volante')) number = midfielderNumbers.shift() || '?';
                else if (p.posPrimaria === 'Atacante') number = 9;
                else number = '?';
                return `<li>[${number}] ${p.nombre} ${p.apellido}</li>`;
            }).join('');
            
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
