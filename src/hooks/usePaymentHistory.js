import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { assertCashierContext } from '../utils/cashierQueryContext';

export const paymentHistoryKey = (idMesa, idSesion, idCierre) =>
  ['pagos', 'historial', idMesa,
    ...(idSesion === undefined ? [] : [idSesion ?? 'ultima-cerrada', idCierre])];

/**
 * El endpoint devuelve la última sesión, incluso para una mesa libre.
 * /mesas solo expone el id de la activa: sin ella se consulta explícitamente
 * "ultima-cerrada", sin reutilizar esa entrada al aparecer una sesión activa.
 * gcTime: 0 descarta esa foto al cambiar de contexto/selección.
 */
export function usePaymentHistory(idMesa, idSesion, idCierre) {
  return useQuery({
    queryKey: paymentHistoryKey(idMesa, idSesion, idCierre),
    queryFn: async ({ signal }) => {
      try {
        const pagos = await api.get(`/pagos?idMesa=${idMesa}`, { signal });
        if (idSesion != null) {
          pagos.forEach((pago) => assertCashierContext(pago.idSesion, idSesion));
        }
        return pagos;
      } catch (err) {
        if (err.status === 404) return [];
        throw err;
      }
    },
    enabled: idMesa != null && idCierre != null,
    refetchInterval: 4000,
    gcTime: 0,
  });
}
