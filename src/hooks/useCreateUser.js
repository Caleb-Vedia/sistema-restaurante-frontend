import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { USERS_KEY } from './useUsers';

/**
 * Alta de usuario de staff: POST /usuarios.
 *
 * Body exacto y completo — `nombre`, `email`, `password`, `rol` son
 * requeridos, sin excepción; `telefono` es opcional (string o `null`). NO
 * se envía `activo`: todo usuario nuevo nace activo por default del
 * backend, así que agregarlo acá sería un campo extra que el DTO no
 * espera.
 *
 * Sin optimistic update: onSuccess invalida el listado y deja que React
 * Query traiga el estado real (incluido el idUsuario asignado).
 *
 * Uso:
 *   const createUser = useCreateUser();
 *   createUser.mutate({ nombre, email, password, rol, telefono });
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ nombre, email, password, rol, telefono }) =>
      api.post('/usuarios', { nombre, email, password, rol, telefono }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
