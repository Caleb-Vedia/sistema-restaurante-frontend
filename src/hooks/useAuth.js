import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { AUTH_ME_KEY } from '../services/queryClient';

/**
 * Clave de cache de la sesión actual.
 * Se exporta para que useLogin / useLogout invaliden exactamente la misma
 * entrada sin repetir el array literal en cada archivo.
 */
export { AUTH_ME_KEY };

/**
 * Hook de sesión del staff.
 *
 * La auth vive en una cookie httpOnly (access_token) que el frontend no puede
 * leer: la única forma de saber si hay sesión es preguntarle al backend con
 * GET /auth/me, que viaja con `credentials: 'include'` desde services/api.js.
 *
 * "Sin sesión" NO es un error de aplicación: un 401 significa simplemente que
 * el usuario no está logueado, y debe producir un estado limpio (usuario null)
 * en vez de una pantalla de error. Cualquier otro error (5xx, error de red)
 * SÍ es un fallo real y se re-lanza para que React Query lo trate como tal:
 * queda expuesto acá como `isError` / `error` para que la UI (ProtectedRoute,
 * LoginPage) pueda mostrar un estado de "no se pudo verificar la sesión"
 * en vez de confundirlo con "no hay sesión".
 *
 * Retorna:
 * - usuario:         objeto del usuario autenticado, o null si no hay sesión
 * - rol:             rol del usuario ('cocina' | 'bebidas' | 'caja' | 'admin'), o null
 * - isLoading:       true mientras se resuelve la primera consulta
 * - isAuthenticated: true si hay un usuario en sesión
 * - isError:         true si /auth/me falló por una razón real (no 401)
 * - error:           el Error real (uso interno/logging, no mostrar el mensaje crudo al usuario)
 * - refetch:         vuelve a consultar /auth/me (para un botón "Reintentar")
 */
export function useAuth() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: async ({ signal }) => {
      try {
        return await api.get('/auth/me', { signal });
      } catch (err) {
        // 401: no hay sesión, es un resultado válido, no un fallo.
        if (err.status === 401) return null;
        // Cualquier otro error (5xx, red): fallo real, que lo maneje React Query.
        throw err;
      }
    },
  });

  const usuario = data ?? null;

  return {
    usuario,
    rol: usuario?.rol ?? null,
    isLoading,
    isAuthenticated: !!usuario,
    isError,
    error,
    refetch,
  };
}
