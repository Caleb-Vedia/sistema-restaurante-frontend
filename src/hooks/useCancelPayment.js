import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { paymentHistoryKey } from './usePaymentHistory';
import { tableBalanceKey } from './useTableBalance';
import { TABLES_KEY } from './useTables';
import { CURRENT_SHIFT_ACTIVITY_KEY } from './useShiftActivity';

/**
 * Anulación de un pago: PATCH /pagos/:id/anular, sin body.
 *
 * Sin optimistic update: no se marca el pago como anulado en cache a mano.
 * El resultado real (anuladoEl seteado por el backend, y el posible efecto
 * sobre sesión/mesa) llega invalidando las queries afectadas y dejando que
 * React Query las vuelva a pedir.
 *
 * El backend ahora puede reabrir la sesión y volver a poner la mesa en
 * CUENTA_SOLICITADA cuando la anulación hace reaparecer saldo pendiente (ver
 * PATCH /pagos/:id/anular). Por eso ya no hay ninguna invalidación
 * condicionada a si la sesión estaba activa ANTES de anular — ese supuesto
 * dejó de ser válido: siempre se invalidan historial, saldo y listado de
 * mesas, y es la UI que lee cada query la que decide qué mostrar según el
 * estado real que traiga el refetch.
 *
 * No se invalida ['caja','actual']: el resumen de Caja actual solo muestra
 * abiertoEl/montoInicialEfectivo (ver CashierPage), ninguno de los cuales
 * depende de pagos vigentes.
 *
 * Sí se invalida ['caja','actividad']: el pago anulado (y, si reabrió la
 * sesión, su `cerradaEl`) son campos que esa vista muestra directamente, y
 * anular puede cambiar totalIngresosTurno si el pago caía dentro del turno.
 *
 * Uso:
 *   const cancelPayment = useCancelPayment();
 *   cancelPayment.mutate({ idPago, idMesa });
 */
export function useCancelPayment() {
  const queryClient = useQueryClient();

  const invalidateAfectadas = (idMesa) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: paymentHistoryKey(idMesa) }),
      queryClient.invalidateQueries({ queryKey: tableBalanceKey(idMesa) }),
      queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
      queryClient.invalidateQueries({ queryKey: CURRENT_SHIFT_ACTIVITY_KEY }),
    ]);

  return useMutation({
    mutationFn: ({ idPago }) => api.patch(`/pagos/${idPago}/anular`),

    onSuccess: (_data, { idMesa }) => invalidateAfectadas(idMesa),

    // 409 (turno cerrado, otra sesión activa, ya estaba anulado) o 404 (pago
    // inexistente): el backend no cambió nada (rollback completo en el caso
    // de conflicto de sesión), así que alcanza con refrescar el historial
    // para que la fila vuelva a su estado real. El mensaje real del backend
    // ya llega en error.message (ver services/api.js) y PaymentHistoryRow lo
    // muestra tal cual, sin sustituirlo por un mensaje genérico.
    onError: (_error, { idMesa }) =>
      queryClient.invalidateQueries({ queryKey: paymentHistoryKey(idMesa) }),
  });
}
