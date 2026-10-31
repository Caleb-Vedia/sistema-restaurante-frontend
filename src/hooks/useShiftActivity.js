import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { assertCashierContext } from '../utils/cashierQueryContext';

// Prefijo conservado para las invalidaciones de cobro/anulación/liberación.
export const CURRENT_SHIFT_ACTIVITY_KEY = ['caja', 'actividad'];

export function useShiftActivity(idCierre) {
  return useQuery({
    queryKey: [...CURRENT_SHIFT_ACTIVITY_KEY, idCierre],
    queryFn: async ({ signal }) => {
      const actividad = await api.get('/caja/actividad', { signal });
      assertCashierContext(actividad.idCierre, idCierre);
      return actividad;
    },
    enabled: idCierre != null,
    refetchInterval: 4000,
    gcTime: 0,
  });
}
