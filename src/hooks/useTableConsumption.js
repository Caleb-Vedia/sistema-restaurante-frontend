import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { assertCashierContext } from '../utils/cashierQueryContext';

export const consumoActualKey = (idMesa, idSesion) =>
  ['pedidos', 'consumo-actual', idMesa, ...(idSesion === undefined ? [] : [idSesion])];

/** GET de la sesión activa; un 404 por cierre concurrente sigue siendo vacío. */
export function useTableConsumption(idMesa, idSesion) {
  return useQuery({
    queryKey: consumoActualKey(idMesa, idSesion),
    queryFn: async ({ signal }) => {
      try {
        const consumo = await api.get(`/pedidos/mesa/${idMesa}/consumo-actual`, { signal });
        assertCashierContext(consumo.idSesion, idSesion);
        return consumo;
      } catch (err) {
        if (err.status === 404) return null;
        throw err;
      }
    },
    enabled: idMesa != null && idSesion != null,
    refetchInterval: 4000,
    gcTime: 0,
  });
}
