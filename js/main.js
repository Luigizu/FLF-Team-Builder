document.addEventListener('DOMContentLoaded', () => {
    // Estado global de la aplicación
    const state = {
        players: [],
        matches: [],
        currentScreen: 'team-builder-screen',
    };

    // Referencias a elementos del DOM para no buscarlos todo el tiempo
    const selectors = {
        loader: document.getElementById('loader'),
        loginScreen: document.getElementById('login-screen'),
        mainContent: document.getElementById('main-content'),
        passwordInput: document.getElementById('password-input'),
        loginButton: document.getElementById('login-button'),
        loginError: document.getElementById('login-error'),
        navButtons: document.querySelectorAll('.nav-btn'),
        appBody: document.getElementById('app-body'),
        musicPlayer: document.getElementById('background-music'),
        musicToggle: document.getElementById('music-toggle'),
    };

    // Lista de canciones
    const songs = [
        'assets/music/cancion1.mp3',
        'assets/music/cancion2.mp3',
    ];

    // Función principal que se ejecuta al cargar la página
    async function initializeApp() {
        const [playersData, matchesData] = await Promise.all([
            api.get('getPlayers'),
            api.get('getMatches')
        ]);
        
        if (playersData === null || matchesData === null) {
            selectors.loader.querySelector('p').textContent = 'Error al cargar. Refresca la página.';
            selectors.loader.querySelector('.spinner').style.display = 'none';
            return;
        }
        
        state.players = playersData;
        state.matches = matchesData;

        // Oculta el loader y muestra la pantalla de login
        selectors.loader.classList.remove('active');
        selectors.loginScreen.classList.add('active');
    }

    function switchScreen(targetId) {
        document.querySelectorAll('#app-body .screen').forEach(s => s.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        selectors.navButtons.forEach(b => {
            b.classList.toggle('active', b.dataset.target === targetId);
        });
        state.currentScreen = targetId;
        renderCurrentScreen();
    }

    function renderCurrentScreen() {
        switch (state.currentScreen) {
            case 'team-builder-screen':
                teamBuilder.render(state.players);
                break;
            case 'results-screen':
                results.render(state.matches, state.players);
                break;
            case 'players-screen':
                players.render(state.players);
                break;
        }
    }

    function playRandomSong() {
        if (songs.length === 0) return;
        const randomIndex = Math.floor(Math.random() * songs.length);
        selectors.musicPlayer.src = songs[randomIndex];
        selectors.musicPlayer.play().catch(() => {});
    }

    // --- Event Listeners ---
    selectors.loginButton.addEventListener('click', () => {
        if (selectors.passwordInput.value === '!!LASFLORES2010') {
            selectors.loginScreen.classList.remove('active');
            selectors.mainContent.classList.remove('hidden');
            playRandomSong();
            switchScreen('team-builder-screen');
        } else {
            selectors.loginError.textContent = 'Código incorrecto.';
        }
    });

    selectors.navButtons.forEach(button => {
        button.addEventListener('click', () => switchScreen(button.dataset.target));
    });

    selectors.musicToggle.addEventListener('click', () => {
        if (selectors.musicPlayer.paused) {
            selectors.musicPlayer.play();
            selectors.musicToggle.textContent = '❚❚';
        } else {
            selectors.musicPlayer.pause();
            selectors.musicToggle.textContent = '►';
        }
    });
    
    // --- Inicialización ---
    initializeApp();
    window.appState = state; // Hacemos el estado accesible globalmente para debugging si es necesario
});
});
