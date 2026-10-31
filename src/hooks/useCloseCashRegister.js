import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { CURRENT_CASH_REGISTER_KEY } from './useCurrentCashRegister';
import { CURRENT_SHIFT_ACTIVITY_KEY } from './useShiftActivity';

/**
 * Cierre de caja: PATCH /caja/cerrar. Paso 4 —y único irreversible— del cierre
 * en 4 pasos (ver CloseCashRegisterWizard).
 *
 * El body es el MISMO que se mandó a POST /caja/cierre/preview (el backend usa
 * un solo DTO para los dos): los montos verificados que el cajero declaró, más
 * la observación de diferencia si corresponde. El arqueo completo (esperado,
 * contado, diferencias) lo calcula el backend y viene en la respuesta. El
 * frontend no calcula ni reconstruye ninguno de esos valores.
 *
 * El backend NO confía en el preview: revalida todo bajo lock y puede
 * responder 409 aunque el preview dijera que se podía cerrar. Por eso este
 * hook nunca asume éxito — quien llama se queda en Conciliación con el mensaje
 * real.
 *
 * Sin optimistic update y sin retry: cerrar caja no es idempotente desde la
 * perspectiva del usuario, y un segundo intento sobre una caja ya cerrada
 * devuelve 409.
 *
 * El resultado se entrega desde onSuccess DEL HOOK: TanStack lo ejecuta
 * aunque el polling haya desmontado el wizard antes de llegar el PATCH.
 * onClosed conserva el resumen en CashierPage antes de invalidar la caja.
 * No se espera esa invalidación ni se depende del callback de mutate().
 *
 * Solo se invalida ['caja','actual']: cerrar caja no cambia mesas, ni
 * historial de pagos, ni nada del KDS o de auth. Las sesiones abiertas
 * tampoco se tocan (reglas A y B: una caja cerrada no libera mesas), así que
 * ['mesas'] queda igual y no hay nada que refrescar ahí.
 *
 * ['caja','actividad'] se ELIMINA (no se invalida) en vez de refetchearse:
 * pertenecía al turno que se acaba de cerrar, así que ya no hay ningún
 * ['caja','actual'] activo bajo el cual tenga sentido pedirla (el próximo
 * GET /caja/actividad daría 409). Si se dejara la cache vieja y luego se
 * abre un turno nuevo, ShiftActivity se remontaría mostrando por un
 * instante los datos del turno YA CERRADO mientras llega el refetch — se
 * elimina para que ese remount arranque limpio (`isLoading`), sin ese
 * parpadeo. Es seguro hacerlo acá porque en el momento del cierre exitoso
 * ShiftActivity no está montado (el wizard está en Conciliación), así que el
 * removeQueries no dispara ningún refetch.
 *
 * ['caja','cierre','contexto'] NO se toca desde acá: useCloseContext usa
 * `gcTime: 0`, así que se descarta solo al desmontarse el wizard. Eliminarla
 * en este hook forzaría un refetch mientras el wizard sigue montado —
 * justamente lo que pasa con el 409 de la regla C, donde el turno sigue
 * abierto y el wizard tiene que conservar su lista de métodos.
 *
 * Uso:
 *   const closeCashRegister = useCloseCashRegister();
 *   closeCashRegister.mutate({ detalle: [...], observacionDiferencia: '...' });
 */
export function useCloseCashRegister({ onClosed } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body) => api.patch('/caja/cerrar', body),

    onSuccess: (resumen) => {
      onClosed?.(resumen);
      queryClient.invalidateQueries({ queryKey: CURRENT_CASH_REGISTER_KEY });
      queryClient.removeQueries({ queryKey: CURRENT_SHIFT_ACTIVITY_KEY });
    },

    // Un 409 puede significar dos cosas MUY distintas y el status solo no las
    // distingue: que otra terminal ya cerró el turno, o que la regla C lo
    // bloquea (turno todavía abierto). Por eso acá solo se refresca
    // ['caja','actual'], que es correcto en ambos casos: si el turno ya no
    // existe, la pantalla pasa sola a "Abrir caja"; si sigue abierto, la query
    // vuelve con el mismo objeto y el wizard se queda donde está. Nada del
    // turno se descarta, porque en el caso de la regla C sigue siendo válido.
    onError: (error) => {
      if (error?.status === 409) {
        return queryClient.invalidateQueries({ queryKey: CURRENT_CASH_REGISTER_KEY });
      }
    },
  });
}
