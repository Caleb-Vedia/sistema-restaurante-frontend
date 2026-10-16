import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { USERS_KEY } from './useUsers';

/**
 * Edición de usuario de staff: PATCH /usuarios/:id.
 *
 * El body admite ÚNICAMENTE `nombre`, `email`, `rol`, `telefono` —
 * `idUsuario` solo arma la URL, nunca viaja en el body. `password` y
 * `activo` quedan fuera a propósito: cada uno tiene su propio endpoint y
 * su propio hook (useResetUserPassword, useSetUserActive) con su propia
 * UI — mezclarlos acá sería enviar campos que este endpoint no espera.
 *
 * 404 (el usuario ya no existe, ej. lo tocó otra sesión admin): además del
 * mensaje del backend, se invalida ['usuarios'] para que la fila stale se
 * reconcilie sola en el próximo refetch, en vez de quedar fantasma en la
 * lista.
 *
 * Uso:
 *   const updateUser = useUpdateUser();
 *   updateUser.mutate({ idUsuario, nombre, email, rol, telefono });
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idUsuario, nombre, email, rol, telefono }) =>
      api.patch(`/usuarios/${idUsuario}`, { nombre, email, rol, telefono }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
    onError: (error) => {
      if (error?.status === 404) {
        queryClient.invalidateQueries({ queryKey: USERS_KEY });
      }
    },
  });
}
