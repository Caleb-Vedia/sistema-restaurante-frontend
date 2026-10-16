import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { USERS_KEY } from './useUsers';

/**
 * Activar/desactivar usuario de staff: PATCH /usuarios/:id/activo.
 *
 * Es un SET explícito, no un toggle de backend: quien llama calcula el
 * valor deseado (`activo: true` o `false`) y lo manda tal cual en el body
 * — nunca un request vacío esperando que el backend invierta el estado.
 *
 * Sin optimistic update: el badge de estado sigue reflejando el valor
 * actual hasta que la invalidación trae el usuario ya actualizado.
 *
 * 404: mismo criterio que useUpdateUser — se invalida ['usuarios'] además
 * de mostrar el mensaje del backend, para reconciliar una fila que otra
 * sesión admin ya modificó.
 *
 * Uso:
 *   const setUserActive = useSetUserActive();
 *   setUserActive.mutate({ idUsuario, activo: false });
 */
export function useSetUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idUsuario, activo }) => api.patch(`/usuarios/${idUsuario}/activo`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
    onError: (error) => {
      if (error?.status === 404) {
        queryClient.invalidateQueries({ queryKey: USERS_KEY });
      }
    },
  });
}
