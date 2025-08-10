const api = {
    get: async (action) => {
        try {
            // NOTA: Hemos quitado 'credentials: "omit"' porque ya no es necesario
            // y a veces puede interferir si no hay conflicto de cuentas.
            const response = await fetch(`${API_URL}?action=${action}`);
            
            if (!response.ok) {
                // Si la respuesta no es 'ok', lanzamos un error para ser capturado por el catch.
                throw new Error(`Error en la solicitud. Estado: ${response.status}`);
            }
            
            // Intentamos convertir la respuesta a JSON.
            const data = await response.json();
            return data;

        } catch (error) {
            console.error(`Error en API GET (${action}):`, error);
            // Mostramos la alerta que ya estabas viendo.
            alert(`No se pudieron cargar los datos: ${action}. Revisa la consola para más detalles.`);
            return null;
        }
    },

    post: async (data) => {
        try {
            // La función POST para Google Sheets sigue siendo igual.
            const response = await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return { status: 'success' };
        } catch (error) {
            console.error('Error en API POST:', error);
            alert('Hubo un error al enviar los datos. Revisa la consola.');
            return { status: 'error', error };
        }
    }
};
