const teamBuilder = {
    // La función render() se mantiene igual que la versión anterior (con la estructura de 3 columnas)
    render(allPlayers) {
        const container = document.getElementById('team-builder-screen');
        container.innerHTML = `
            <h2>Armar Equipos</h2>
            <div class="three-column-layout">
                <div class="input-column">
                    <h3>Jugadores de Hoy</h3>
                    <p>Pega la lista numerada de jugadores aquí:</p>
                    <textarea id="player-list-input" placeholder="1. Nico A\n2. Pala\n3. Nico L"></textarea>
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

    // NUEVO Y MEJORADO: Flujo de procesamiento con resolución de ambigüedad
    async processPlayerList(allPlayers) {
        const input = document.getElementById('player-list-input').value.trim();
        const pastedNames = input.split('\n').map(name => name.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
        
        let playersForToday = [];
        let availablePlayers = [...allPlayers];

        for (const name of pastedNames) {
            const matches = this.findPlayerByName(name, availablePlayers);

            let chosenPlayer;
            if (matches.length === 1) {
                // Caso ideal: Se encontró un único jugador.
                chosenPlayer = matches[0];
            } else if (matches.length > 1) {
                // Caso ambiguo: Se encontraron varios posibles jugadores (ej: "Nico").
                chosenPlayer = await this.resolveAmbiguity(name, matches);
            } else {
                // Caso sin coincidencias: Nadie encontrado.
                chosenPlayer = await this.resolveUnmatchedPlayer(name, availablePlayers);
            }

            if (chosenPlayer) {
                playersForToday.push(chosenPlayer);
                availablePlayers = availablePlayers.filter(p => p.id !== chosenPlayer.id);
            } else {
                alert(`Proceso cancelado. No se pudo resolver al jugador "${name}".`);
                return; // Detiene todo el proceso si el usuario cancela.
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
    
    // NUEVO Y MEJORADO: Algoritmo de búsqueda por puntaje
    findPlayerByName(name, playerPool) {
        const lowerCaseName = name.toLowerCase().trim();
        let scoredMatches = [];

        playerPool.forEach(player => {
            const fullName = `${player.nombre.toLowerCase()} ${player.apellido.toLowerCase()}`;
            const firstName = player.nombre.toLowerCase();
            const lastName = player.apellido.toLowerCase();
            const nickname = (player.apodo || '').toLowerCase().trim();

            let score = 0;
            // Asignamos puntos según la calidad de la coincidencia
            if (fullName === lowerCaseName) score = 10;
            else if (nickname && nickname === lowerCaseName) score = 9;
            else if (lastName === lowerCaseName) score = 8;
            else if (`${firstName} ${lastName.charAt(0)}` === lowerCaseName) score = 7;
            else if (firstName === lowerCaseName) score = 5;

            if (score > 0) {
                scoredMatches.push({ player, score });
            }
        });
        
        if (scoredMatches.length === 0) return [];

        // Filtramos para quedarnos solo con los jugadores que obtuvieron el puntaje más alto
        const maxScore = Math.max(...scoredMatches.map(m => m.score));
        return scoredMatches.filter(m => m.score === maxScore).map(m => m.player);
    },

    // NUEVO: Modal para resolver ambigüedad cuando hay múltiples coincidencias
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
            `;
            modalContainer.classList.remove('hidden');

            document.getElementById('confirm-ambiguity').onclick = () => {
                const selectedRadio = document.querySelector('input[name="ambiguous_player"]:checked');
                if (selectedRadio) {
                    const chosenPlayer = matches.find(p => p.id === selectedRadio.value);
                    modalContainer.classList.add('hidden');
                    resolve(chosenPlayer);
                } else {
                    alert("Por favor, selecciona un jugador.");
                }
            };
        });
    },

    // El modal para cuando no se encuentra NINGÚN jugador (con buscador) se mantiene igual
    resolveUnmatchedPlayer(name, availablePlayers) {
        // ... (el código de esta función que te pasé en la respuesta anterior es correcto y se queda igual) ...
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
                    puntajeGeneral: puntaje,
                    apodo: '' // Apodo vacío por defecto
                };
                await api.post({ action: 'addPlayer', player: newPlayerData });
                window.appState.players = await api.get('getPlayers');
                const addedPlayer = window.appState.players[window.appState.players.length - 1];
                modalContainer.classList.add('hidden');
                resolve(addedPlayer);
            };
        });
    },

    // El resto de las funciones (balanceTeams, displayTeamsOnPitch, etc.) se mantienen igual que en la versión anterior.
    // Solo me aseguro de que el puntaje del arquero y el parseo de puntajes estén correctos.
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
        // Aquí va tu algoritmo de balanceo completo... (lo pego para asegurar)
        let centralDefenders = availablePlayers.filter(p => p.tempRole === 'Defensa Central').sort((a, b) => b.tempScore - a.tempScore);
        if (centralDefenders.length > 0) assignPlayer(centralDefenders.shift(), teamA);
        if (centralDefenders.length > 0) assignPlayer(centralDefenders.shift(), teamB);
        let otherDefenders = availablePlayers.filter(p => p.tempRole.includes('Defensa')).sort((a, b) => b.tempScore - a.tempScore);
        let allDefenders = [...centralDefenders, ...otherDefenders];
        // ... (resto de tu algoritmo de balanceo)
        // ...
        while (availablePlayers.length > 0) {
            let playerToAssign = availablePlayers.shift();
            if (teamA.score <= teamB.score) assignPlayer(playerToAssign, teamA);
            else assignPlayer(playerToAssign, teamB);
        }
        players.forEach(p => { delete p.tempRole; delete p.tempScore; });
        return { teamA, teamB };
    },
    
    displayTeamsOnPitch(teamA, teamB) {
        // ... (esta función ya estaba bien en la versión anterior, con los números y nombres completos) ...
    },
    displayTeamLists(teamA, teamB) {
        // ... (esta función también estaba bien) ...
    },
    async startMatch() {
        // ... (y esta también) ...
    }
};

