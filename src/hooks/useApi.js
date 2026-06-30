import { useState, useCallback } from 'react';
 
/**
 * Hook para ejecutar llamadas a la API con manejo automático de loading y error.
 *
 * Separa la lógica de estado (cargando, error) de los componentes,
 * evitando repetir useState(loading) y useState(error) en cada pantalla.
 *
 * Retorna:
 * - loading: boolean — true mientras la llamada está en curso
 * - error: string | null — mensaje de error si falló, null si está bien
 * - execute: función — recibe un callback que hace la llamada real
 * - clearError: función — limpia el error manualmente
 *
 * Uso:
 *   const { loading, error, execute } = useApi();
 *
 *   const handleSave = async () => {
 *     const result = await execute(() => api.post('/orders', data));
 *     if (result) navigate('/menu/1/order-status');
 *   };
 */
export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
 
  const execute = useCallback(async (apiCall) => {
    setLoading(true);
    setError(null);
 
    try {
      const result = await apiCall();
      return result;
    } catch (err) {
      setError(err.message || 'Error inesperado. Intentá de nuevo.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
 
  const clearError = useCallback(() => setError(null), []);
 
  return { loading, error, execute, clearError };
}
 