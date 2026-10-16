import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { TABLES_KEY } from './useTables';
import { tableBalanceKey } from './useTableBalance';
import { CURRENT_CASH_REGISTER_KEY } from './useCurrentCashRegister';
import { PAYMENT_METHODS_KEY } from './usePaymentMethods';
import { consumoActualKey } from './useTableConsumption';
import { CURRENT_SHIFT_ACTIVITY_KEY } from './useShiftActivity';

/**
 * Registro del cobro de una mesa: POST /pagos.
 *
 * Sin optimistic update y sin reintento automático: el backend valida que la
 * suma recibida coincida exactamente con lo adeudado, y un POST repetido
 * sobre una sesión ya cobrada no es inocuo. El estado real de mesas y saldos
 * se recupera siempre refetcheando, nunca escribiendo la respuesta en cache
 * a mano.
 *
 * Invalidaciones según el resultado:
 *
 * - mesaLiberada true  → la sesión quedó cerrada. Se invalida ['mesas'] y se
 *   ELIMINA de cache el saldo de esa mesa (removeQueries, no invalidate):
 *   volver a pedir /pagos/total/:idMesa para una sesión cerrada devolvería
 *   404, y además la data vieja no debe sobrevivir para una sesión futura.
 *
 * - mesaLiberada false → el pago SÍ quedó registrado, solo falló liberar la
 *   mesa. La sesión sigue activa, así que su saldo se invalida para que
 *   refleje que ya está pagada.
 *
 * - error → puede ser que el saldo cambió (409), que la caja se cerró desde
 *   otra terminal, o que la sesión desapareció. Se refetchea todo lo que
 *   pudo haber quedado desactualizado para que la UI descubra el estado real.
 *
 * Además, en ÉXITO (los dos casos) se invalida ['caja','actividad']: un
 * cobro ocurrido en este turno cambia sus pagos y su totalIngresosTurno.
 * ['pedidos','consumo-actual', idMesa] no se invalida — un pago no altera
 * Pedido/DetallePedido, así que esa vista no queda stale — salvo cuando
 * mesaLiberada es true, donde se ELIMINA (no invalida) el mismo criterio que
 * ya aplica tableBalanceKey: la sesión terminó, y una consulta futura para
 * esa mesa será de una sesión nueva.
 *
 * Uso:
 *   const registerPayment = useRegisterPayment();
 *   registerPayment.mutate({ idMesa, pagos });
 */
export function useRegisterPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idMesa, pagos }) => api.post('/pagos', { idMesa, pagos }),

    onSuccess: (data, { idMesa }) => {
      if (data?.mesaLiberada) {
        queryClient.removeQueries({ queryKey: tableBalanceKey(idMesa) });
        queryClient.removeQueries({ queryKey: consumoActualKey(idMesa) });
        return Promise.all([
          queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
          queryClient.invalidateQueries({ queryKey: CURRENT_SHIFT_ACTIVITY_KEY }),
        ]);
      }

      return Promise.all([
        queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
        queryClient.invalidateQueries({ queryKey: tableBalanceKey(idMesa) }),
        queryClient.invalidateQueries({ queryKey: CURRENT_SHIFT_ACTIVITY_KEY }),
      ]);
    },

    onError: (error, { idMesa }) => {
      const refetches = [
        queryClient.invalidateQueries({ queryKey: tableBalanceKey(idMesa) }),
        queryClient.invalidateQueries({ queryKey: CURRENT_CASH_REGISTER_KEY }),
        queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
      ];

      // 404 puede significar que un método de pago dejó de estar activo entre
      // el GET y el submit. Solo en ese caso vale la pena revalidar la lista.
      if (error?.status === 404) {
        refetches.push(queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY }));
      }

      return Promise.all(refetches);
    },
  });
}
