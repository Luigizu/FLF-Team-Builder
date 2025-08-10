const players = {
    render(allPlayers) {
        const container = document.getElementById('players-screen');
        const cardsHtml = allPlayers.map(p => `
            <div class="player-card" data-player-id="${p.id}">
                <img src="${p.foto}" alt="${p.nombre}" style="width:80px; height:80px; border-radius:50%; margin-bottom:1rem;">
                <h3>${p.nombre} ${p.apellido || ''}</h3>
                <p>Puntaje: ${p.puntajeGeneral}</p>
                <p>${p.posPrimaria}</p>
            </div>
        `).join('');

        container.innerHTML = `
            <h2>Ver Jugadores</h2>
            <div class="card-grid">${cardsHtml}</div>
            <div id="player-detail-view" class="hidden"></div>
        `;
        
        document.querySelectorAll('.player-card').forEach(card => {
            card.addEventListener('click', (e) => this.showPlayerDetail(e.currentTarget.dataset.playerId, allPlayers));
        });
    },

    showPlayerDetail(playerId, allPlayers) {
        const player = allPlayers.find(p => p.id === playerId);
        const detailContainer = document.getElementById('player-detail-view');
        
        const chartCategories = {
            'Generales': ['juegoAereo', 'sueltaPelota', 'velocidad', 'resistencia', 'controlPelota', 'juegoCuerpo'],
            'Defensivas': ['intercepciones', 'duelosGanados', 'despejes', 'posicionamiento'],
            'Volantes': ['precisionPases', 'visionJuego', 'salirJugando'],
            'Delanteros': ['regate', 'goles']
        };
        const labels = Object.values(chartCategories).flat();
        const data = labels.map(stat => player[stat] || 5); // Default to 5 if stat not present

        detailContainer.innerHTML = `
             <div class="modal-container">
                <div class="modal-content" style="max-width: 800px;">
                    <button id="close-detail-view" style="position:absolute; top:1rem; right:1rem;">X</button>
                    <h2>${player.nombre} ${player.apellido}</h2>
                    <div style="display:flex; gap: 2rem;">
                         <div style="flex:1;">
                            <img src="${player.foto}" style="width:150px; border-radius:10px;">
                            <p><strong>Puntaje General:</strong> ${player.puntajeGeneral}</p>
                            <p><strong>Posición:</strong> ${player.posPrimaria}</p>
                            <p><strong>Victorias:</strong> ${player.victorias}</p>
                            <p><strong>Derrotas:</strong> ${player.derrotas}</p>
                         </div>
                         <div style="flex:2;">
                            <canvas id="player-star-chart"></canvas>
                         </div>
                    </div>
                </div>
            </div>
        `;
        detailContainer.classList.remove('hidden');
        document.getElementById('close-detail-view').onclick = () => detailContainer.classList.add('hidden');

        const ctx = document.getElementById('player-star-chart').getContext('2d');
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: player.nombre,
                    data: data,
                    fill: true,
                    backgroundColor: 'rgba(0, 191, 255, 0.2)',
                    borderColor: 'rgb(0, 191, 255)',
                    pointBackgroundColor: 'rgb(0, 191, 255)',
                }]
            },
            options: {
                scales: {
                    r: { angleLines: { color: 'rgba(255,255,255,0.2)' }, grid: { color: 'rgba(255,255,255,0.2)' }, pointLabels: { color: 'white' }, suggestedMin: 0, suggestedMax: 10, ticks: { display: false } }
                },
                plugins: { legend: { labels: { color: 'white' } } }
            }
        });
    }
};