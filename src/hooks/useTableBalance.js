import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { assertCashierContext } from '../utils/cashierQueryContext';

// Sin idSesion sigue siendo el prefijo que invalidan las mutaciones locales.
export const tableBalanceKey = (idMesa, idSesion) =>
  ['pagos', 'total', idMesa, ...(idSesion === undefined ? [] : [idSesion])];

/** Solo se consulta la mesa seleccionada con sesión activa, nunca un N+1. */
export function useTableBalance(idMesa, idSesion, { enabled = true } = {}) {
  return useQuery({
    queryKey: tableBalanceKey(idMesa, idSesion),
    queryFn: async ({ signal }) => {
      const balance = await api.get(`/pagos/total/${idMesa}`, { signal });
      assertCashierContext(balance.idSesion, idSesion);
      return balance;
    },
    enabled: enabled && idMesa != null && idSesion != null,
    refetchInterval: 4000,
    gcTime: 0,
  });
}
