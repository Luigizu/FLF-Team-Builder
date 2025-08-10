const results = {
    render(matches, players) {
        const container = document.getElementById('results-screen');
        if (!matches || matches.length === 0) {
            container.innerHTML = '<h2>Resultados</h2><p>Aún no se han jugado partidos.</p>';
            return;
        }

        const matchesHtml = matches.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).map(match => `
            <tr>
                <td>${new Date(match.fecha).toLocaleDateString()}</td>
                <td>${match.estado === 'PENDIENTE' ? 'PENDIENTE' : `${match.resultado_equipoA} - ${match.resultado_equipoB}`}</td>
                <td>
                    ${match.estado === 'PENDIENTE' 
                        ? `<button class="result-btn" data-match-id="${match.id}">Cargar Resultado</button>` 
                        : `<button class="details-btn" data-match-id="${match.id}">Ver Detalles</button>`
                    }
                </td>
            </tr>
            <tr id="details-${match.id}" class="details-row hidden"><td colspan="3"></td></tr>
        `).join('');

        container.innerHTML = `
            <h2>Resultados</h2>
            <table class="results-table">
                <thead><tr><th>Fecha</th><th>Resultado</th><th>Acciones</th></tr></thead>
                <tbody>${matchesHtml}</tbody>
            </table>
        `;

        document.querySelectorAll('.result-btn').forEach(btn => btn.addEventListener('click', (e) => this.promptForResult(e.target.dataset.matchId)));
        document.querySelectorAll('.details-btn').forEach(btn => btn.addEventListener('click', (e) => this.showMatchDetails(e.target.dataset.matchId, matches, players)));
    },

    promptForResult(matchId) {
        const scoreA = prompt(`Resultado Equipo A para el partido ${matchId}:`);
        const scoreB = prompt(`Resultado Equipo B para el partido ${matchId}:`);
        if (scoreA !== null && scoreB !== null) {
            this.updateResult(matchId, scoreA, scoreB);
        }
    },

    async updateResult(matchId, scoreA, scoreB) {
        await api.post({ action: 'updateMatchResult', matchId, scoreA, scoreB });
        alert('Resultado guardado.');
        // Recargar datos para reflejar el cambio
        window.appState.matches = await api.get('getMatches');
        this.render(window.appState.matches, window.appState.players);
    },

    showMatchDetails(matchId, matches, allPlayers) {
        const detailRow = document.getElementById(`details-${matchId}`);
        const match = matches.find(m => m.id === matchId);
        
        if (detailRow.classList.toggle('hidden')) return;

        const teamAPlayers = JSON.parse(match.equipoA_jugadores).map(id => allPlayers.find(p => p.id === id)?.nombre || 'N/A').join(', ');
        const teamBPlayers = JSON.parse(match.equipoB_jugadores).map(id => allPlayers.find(p => p.id === id)?.nombre || 'N/A').join(', ');

        detailRow.querySelector('td').innerHTML = `
            <p><strong>Equipo A:</strong> ${teamAPlayers}</p>
            <p><strong>Equipo B:</strong> ${teamBPlayers}</p>
        `;
    }
};