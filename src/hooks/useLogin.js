import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { AUTH_ME_KEY } from './useAuth';

/**
 * Mutación de login del staff.
 *
 * El backend responde seteando la cookie httpOnly; no hay token que guardar
 * acá. Lo único que hace falta del lado del frontend es volver a preguntar
 * por la sesión para que useAuth refleje al usuario recién logueado.
 *
 * `onSuccess` devuelve la promesa de invalidateQueries a propósito: así la
 * mutación sigue en estado pending hasta que /auth/me se haya refrescado,
 * y la pantalla de login puede navegar sabiendo que la sesión ya está en cache
 * (evita el parpadeo de rebotar a /login por un instante).
 *
 * Uso:
 *   const login = useLogin();
 *   login.mutate({ email, password });
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }) =>
      api.post('/auth/login', { email, password }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_ME_KEY }),
  });
}
