// Centraliza todas las llamadas a la API de Google Scripts
const api = {
    get: async (action) => {
        try {
            const response = await fetch(`${API_URL}?action=${action}`);
            if (!response.ok) throw new Error(`Error en la solicitud GET ${action}`);
            return await response.json();
        } catch (error) {
            console.error(`Error en API GET (${action}):`, error);
            alert(`No se pudieron cargar los datos: ${action}. Revisa la consola para más detalles.`);
            return null;
        }
    },
    post: async (data) => {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors', // Requerido para Google Scripts en modo simple
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return { status: 'success' }; // En modo no-cors no se puede leer la respuesta.
        } catch (error) {
            console.error('Error en API POST:', error);
            alert('Hubo un error al enviar los datos. Revisa la consola.');
            return { status: 'error', error };
        }
    }
};