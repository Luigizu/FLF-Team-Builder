const teamBuilder = {
    render(allPlayers) {
        const container = document.getElementById('team-builder-screen');
        container.innerHTML = `
            <h2>Armar Equipos</h2>
            <div class="three-column-layout">
                <!-- Columna Izquierda: Input de jugadores -->
                <div class="input-column">
                    <h3>Jugadores de Hoy</h3>
                    <p>Pega la lista numerada de jugadores aquí:</p>
                    <textarea id="player-list-input" placeholder="1. Juampi Viatore\n2. Luigi\n3. Nico B."></textarea>
                    <button id="generate-teams-btn">Generar Equipos</button>
                </div>

                <!-- Columna Central: Cancha -->
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

                <!-- Columna Derecha: Listas de Equipos -->
                <div class="roster-column" id="roster-column">
                    <!-- Las listas de equipos se generarán aquí -->
                </div>
            </div>
        `;
        document.getElementById('generate-teams-btn').addEventListener('click', () => this.processPlayerList(allPlayers));
    },

    // NUEVA LÓGICA DE PROCESAMIENTO
    async processPlayerList(allPlayers) {
        const input = document.getElementById('player-list-input').value.trim();
        const pastedNames = input.split('\n').map(name => name.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
        
        let playersForToday = [];
        let availablePlayers = [...allPlayers];
        let unmatchedNames = [];

        // Primer intento: buscar coincidencias directas
        pastedNames.forEach(name => {
            const foundPlayer = this.findPlayerByName(name, availablePlayers);
            if (foundPlayer) {
                playersForToday.push(foundPlayer);
                availablePlayers = availablePlayers.filter(p => p.id !== foundPlayer.id);
            } else {
                unmatchedNames.push(name);
            }
        });

        // Segundo intento: resolver nombres no encontrados
        if (unmatchedNames.length > 0) {
            for (const name of unmatchedNames) {
                const resolvedPlayer = await this.resolveUnmatchedPlayer(name, availablePlayers);
                if (resolvedPlayer) {
                    playersForToday.push(resolvedPlayer);
                    availablePlayers = availablePlayers.filter(p => p.id !== resolvedPlayer.id);
                } else {
                    // El usuario canceló o no se pudo resolver, paramos.
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
    
    // NUEVO: Lógica de búsqueda de jugadores más inteligente
    findPlayerByName(name, playerPool) {
        const lowerCaseName = name.toLowerCase();
        // Prioridad 1: Nombre + Apellido
        let found = playerPool.find(p => `${p.nombre.toLowerCase()} ${p.apellido.toLowerCase()}` === lowerCaseName);
        if (found) return found;
        
        // Prioridad 2: Nombre + Inicial del Apellido
        found = playerPool.find(p => `${p.nombre.toLowerCase()} ${p.apellido.charAt(0).toLowerCase()}` === lowerCaseName);
        if (found) return found;

        // Prioridad 3: Solo Nombre
        found = playerPool.find(p => p.nombre.toLowerCase() === lowerCaseName);
        if (found) return found;
        
        // Prioridad 4: Solo Apellido
        found = playerPool.find(p => p.apellido.toLowerCase() === lowerCaseName);
        if (found) return found;

        return null;
    },

    // NUEVO: Modal para elegir o crear jugador
    resolveUnmatchedPlayer(name, availablePlayers) {
        return new Promise(resolve => {
            const modalContainer = document.getElementById('modal-container');
            const modalContent = document.getElementById('modal-content');
            
            const options = availablePlayers.map(p => `<option value="${p.id}">${p.nombre} ${p.apellido}</option>`).join('');

            modalContent.innerHTML = `
                <h3>¿Quién es "${name}"?</h3>
                <p>Elige un jugador existente o crea uno nuevo.</p>
                <select id="select-existing-player">
                    <option value="">-- Elegir jugador existente --</option>
                    ${options}
                </select>
                <button id="confirm-existing-player">Confirmar Selección</button>
                <hr style="margin: 1rem 0;">
                <button id="show-create-new-player">Crear Jugador Nuevo</button>
                <div id="create-new-player-form" class="hidden">
                    <input id="new-player-nombre" type="text" placeholder="Nombre" value="${name.split(' ')[0] || ''}">
                    <input id="new-player-apellido" type="text" placeholder="Apellido" value="${name.split(' ')[1] || ''}">
                    <select id="new-player-pos1"><option value="">Posición Primaria</option><option>Arquero</option><option>Defensa Central</option><option>Defensa Lateral</option><option>Volante Central</option><option>Volante Lateral</option><option>Atacante</option></select>
                    <select id="new-player-habilidad"><option value="Media">Habilidad</option><option value="Buena">Buena (8)</option><option value="Media">Media (5)</option><option value="Baja">Baja (3)</option></select>
                    <button id="save-new-player">Guardar Nuevo Jugador</button>
                </div>
            `;
            modalContainer.classList.remove('hidden');

            document.getElementById('show-create-new-player').onclick = () => {
                document.getElementById('create-new-player-form').classList.remove('hidden');
            };

            document.getElementById('confirm-existing-player').onclick = () => {
                const selectedId = document.getElementById('select-existing-player').value;
                if (selectedId) {
                    const player = availablePlayers.find(p => p.id === selectedId);
                    modalContainer.classList.add('hidden');
                    resolve(player);
                }
            };
            
            document.getElementById('save-new-player').onclick = async () => {
                const habilidad = document.getElementById('new-player-habilidad').value;
                const newPlayerData = {
                    nombre: document.getElementById('new-player-nombre').value,
                    apellido: document.getElementById('new-player-apellido').value,
                    posPrimaria: document.getElementById('new-player-pos1').value,
                    posSecundaria: '',
                    habilidadGeneral: habilidad,
                    puntajeGeneral: habilidad === 'Buena' ? 8 : (habilidad === 'Baja' ? 3 : 5)
                };
                await api.post({ action: 'addPlayer', player: newPlayerData });
                window.appState.players = await api.get('getPlayers'); // Recargamos para tener el ID
                const addedPlayer = window.appState.players.find(p => p.nombre === newPlayerData.nombre && p.apellido === newPlayerData.apellido);
                modalContainer.classList.add('hidden');
                resolve(addedPlayer);
            };
        });
    },

    // Algoritmo de balanceo (sin cambios)
    // js/team-builder.js (Solo la función balanceTeams)

    balanceTeams(players) {
        // Inicializamos los equipos y las listas de roles
        let teamA = { players: [], score: 0, defenseScore: 0, midfieldScore: 0 };
        let teamB = { players: [], score: 0, defenseScore: 0, midfieldScore: 0 };
        let availablePlayers = [...players];

        // Mapeamos a los jugadores con un puntaje temporal para el balanceo
        // El arquero cuenta como un defensor de 10 puntos para este cálculo
        availablePlayers.forEach(p => {
            if (p.posPrimaria === 'Arquero') {
                p.tempRole = 'Defensa Central';
                p.tempScore = 10;
            } else {
                p.tempRole = p.posPrimaria;
                p.tempScore = parseInt(p.puntajeGeneral);
            }
        });
        
        // Función auxiliar para asignar un jugador a un equipo
        const assignPlayer = (player, team) => {
            team.players.push(player);
            team.score += player.tempScore;
            // Quitamos al jugador de la lista de disponibles
            availablePlayers = availablePlayers.filter(p => p.id !== player.id);
        };

        // --- INICIO DEL ALGORITMO DE ARMADO ---

        // 1. PRIORIDAD: Asignar un buen Defensa Central a cada equipo
        let centralDefenders = availablePlayers
            .filter(p => p.tempRole === 'Defensa Central')
            .sort((a, b) => b.tempScore - a.tempScore); // De mejor a peor
        
        if (centralDefenders.length > 0) assignPlayer(centralDefenders.shift(), teamA);
        if (centralDefenders.length > 0) assignPlayer(centralDefenders.shift(), teamB);

        // 2. EQUILIBRAR LA DEFENSA (hasta tener 4 defensores por equipo)
        let otherDefenders = availablePlayers
            .filter(p => p.tempRole.includes('Defensa'))
            .sort((a, b) => b.tempScore - a.tempScore);
        
        // Juntamos los centrales que sobraron con el resto
        let allDefenders = [...centralDefenders, ...otherDefenders];

        while ((teamA.players.filter(p => p.tempRole.includes('Defensa')).length < 4 || teamB.players.filter(p => p.tempRole.includes('Defensa')).length < 4) && allDefenders.length > 0) {
            let playerToAssign = allDefenders.shift();
            // Asigna al equipo con la defensa más débil
            if (teamA.defenseScore <= teamB.defenseScore) {
                assignPlayer(playerToAssign, teamA);
                teamA.defenseScore += playerToAssign.tempScore;
            } else {
                assignPlayer(playerToAssign, teamB);
                teamB.defenseScore += playerToAssign.tempScore;
            }
        }
        
        // 3. PRIORIDAD: Asignar un buen Volante Central a cada equipo
        let centralMidfielders = availablePlayers
            .filter(p => p.tempRole === 'Volante Central')
            .sort((a, b) => b.tempScore - a.tempScore);

        if (centralMidfielders.length > 0) assignPlayer(centralMidfielders.shift(), teamA);
        if (centralMidfielders.length > 0) assignPlayer(centralMidfielders.shift(), teamB);
        
        // 4. EQUILIBRAR EL MEDIOCAMPO (hasta tener 4 volantes por equipo)
        let otherMidfielders = availablePlayers
            .filter(p => p.tempRole.includes('Volante'))
            .sort((a, b) => b.tempScore - a.tempScore);
            
        let allMidfielders = [...centralMidfielders, ...otherMidfielders];
        
        while ((teamA.players.filter(p => p.tempRole.includes('Volante')).length < 4 || teamB.players.filter(p => p.tempRole.includes('Volante')).length < 4) && allMidfielders.length > 0) {
            let playerToAssign = allMidfielders.shift();
            // Asigna al equipo con el mediocampo más débil
            if (teamA.midfieldScore <= teamB.midfieldScore) {
                assignPlayer(playerToAssign, teamA);
                teamA.midfieldScore += playerToAssign.tempScore;
            } else {
                assignPlayer(playerToAssign, teamB);
                teamB.midfieldScore += playerToAssign.tempScore;
            }
        }

        // 5. ASIGNAR DELANTEROS PARA COMPENSAR (hasta tener 1 por equipo)
        let attackers = availablePlayers
            .filter(p => p.tempRole === 'Atacante')
            .sort((a, b) => b.tempScore - a.tempScore);

        while ((teamA.players.filter(p => p.tempRole.includes('Atacante')).length < 1 || teamB.players.filter(p => p.tempRole.includes('Atacante')).length < 1) && attackers.length > 0) {
            let playerToAssign = attackers.shift();
            // Asigna al equipo que tiene MENOS PUNTOS en total para compensar
            if (teamA.score <= teamB.score) {
                assignPlayer(playerToAssign, teamA);
            } else {
                assignPlayer(playerToAssign, teamB);
            }
        }
        
        // 6. RELLENAR CON JUGADORES RESTANTES (si faltan)
        // Se asignan para balancear el puntaje total del equipo
        while (availablePlayers.length > 0) {
            let playerToAssign = availablePlayers.shift();
            if (teamA.players.length <= teamB.players.length) {
                // Si el equipo A tiene menos jugadores, o los mismos, se le asigna a él
                // para balancear el puntaje general.
                 if (teamA.score <= teamB.score) {
                    assignPlayer(playerToAssign, teamA);
                 } else {
                    assignPlayer(playerToAssign, teamB);
                 }
            } else {
                assignPlayer(playerToAssign, teamB);
            }
        }
        
        // Limpiamos las propiedades temporales que añadimos
        players.forEach(p => {
            delete p.tempRole;
            delete p.tempScore;
        });

        return { teamA, teamB };
    },
    // NUEVO: Ubicación horizontal de jugadores en la cancha
    displayTeamsOnPitch(teamA, teamB) {
        const teamADisplay = document.getElementById('teamA-display');
        const teamBDisplay = document.getElementById('teamB-display');
        teamADisplay.innerHTML = ''; teamBDisplay.innerHTML = '';
        
        const posA = { def: [[20,20],[20,40],[20,60],[20,80]], mid: [[40,20],[40,40],[40,60],[40,80]], fwd: [[48,50]] };
        const posB = { def: [[80,20],[80,40],[80,60],[80,80]], mid: [[60,20],[60,40],[60,60],[60,80]], fwd: [[52,50]] };

        const placePlayer = (player, teamDisplay, posMap) => {
            const role = player.posPrimaria.includes('Defensa') ? 'def' : (player.posPrimaria.includes('Volante') ? 'mid' : 'fwd');
            const pos = posMap[role].shift() || [10,10]; // Saca la primera posición disponible
            
            const playerToken = document.createElement('div');
            playerToken.className = 'player-token';
            playerToken.style.left = `${pos[0]}%`;
            playerToken.style.top = `${pos[1]}%`;
            playerToken.innerHTML = `<img src="${player.foto}" alt="${player.nombre}"><span>${player.nombre.split(' ')[0]}</span>`;
            teamDisplay.appendChild(playerToken);
        };
        
        teamA.players.forEach(p => placePlayer(p, teamADisplay, posA));
        teamB.players.forEach(p => placePlayer(p, teamBDisplay, posB));
    },

    // NUEVO: Muestra las listas de equipos en la columna derecha
    displayTeamLists(teamA, teamB) {
        const container = document.getElementById('roster-column');
        
        const generateList = (team, teamName, teamClass) => {
            let defenderNumbers = [3, 4, 6]; // Números disponibles para defensas no-centrales
            let midfielderNumbers = [7, 8]; // Números para volantes laterales
            
            const playerItems = team.players.map(p => {
                let number;
                if (p.posPrimaria === 'Defensa Central') number = 2;
                else if (p.posPrimaria.includes('Defensa')) number = defenderNumbers.shift() || '?';
                else if (p.posPrimaria === 'Volante Central') number = 5;
                else if (p.posPrimaria.includes('Volante')) number = midfielderNumbers.shift() || '?';
                else if (p.posPrimaria === 'Atacante') number = 9;
                else number = '?'; // Para arqueros u otros
                return `<li>[${number}] ${p.nombre} ${p.apellido}</li>`;
            }).join('');
            
            return `<h4>${teamName}</h4><ul class="team-roster-list ${teamClass}">${playerItems}</ul>`;
        };
        
        container.innerHTML = generateList(teamA, "Equipo A", "teamA") + generateList(teamB, "Equipo B", "teamB");
    },
    
    // Función de comenzar partido (sin cambios)
    async startMatch() {
        if (this.currentMatchup) {
            await api.post({ action: 'addMatch', match: this.currentMatchup });
            alert('¡Partido guardado! Ahora puedes cargar el resultado en la sección "Resultados".');
            window.appState.matches = await api.get('getMatches');
            this.render(window.appState.players);
        }
    }
};

