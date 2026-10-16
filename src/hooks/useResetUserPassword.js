import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { USERS_KEY } from './useUsers';

/**
 * Restablecer contraseña de un usuario de staff: PATCH /usuarios/:id/password.
 *
 * Body EXACTO: `{ passwordNueva }`. El admin no necesita (ni envía) la
 * contraseña actual del usuario — es un reseteo administrativo, no un
 * cambio de contraseña autogestionado.
 *
 * El backend NO invalida los JWT/cookies ya emitidos al cambiar la
 * contraseña: una sesión que ya estaba abierta en otro dispositivo sigue
 * activa después de este PATCH. Este hook no simula ningún logout remoto
 * — eso sería mentirle a la UI sobre un comportamiento que el backend no
 * tiene (ver el texto que muestra ResetPasswordDialog).
 *
 * No invalida ['usuarios']: el response no cambia ningún campo visible en
 * el listado (nombre/email/rol/activo quedan iguales).
 *
 * 404: mismo criterio que el resto de las mutaciones sobre :id — se
 * invalida ['usuarios'] además de mostrar el mensaje del backend, por si
 * el usuario ya no existe.
 *
 * Uso:
 *   const resetPassword = useResetUserPassword();
 *   resetPassword.mutate({ idUsuario, passwordNueva });
 */
export function useResetUserPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idUsuario, passwordNueva }) => api.patch(`/usuarios/${idUsuario}/password`, { passwordNueva }),
    onError: (error) => {
      if (error?.status === 404) {
        queryClient.invalidateQueries({ queryKey: USERS_KEY });
      }
    },
  });
}
