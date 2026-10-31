import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del estado de caja del turno actual. */
export const CURRENT_CASH_REGISTER_KEY = ['caja', 'actual'];

/**
 * Estado de la caja del turno actual: GET /caja/actual.
 *
 * Sin caja abierta, Nest puede enviar 200 vacío en lugar de JSON `null`.
 * api.get normaliza ese caso específico a null; no oculta respuestas ilegibles
 * ni errores de red/HTTP. El hook conserva sus condiciones e intervalo.
 *
 * Caja solicita polling para detectar aperturas/cierres externos. El
 * dashboard conserva su comportamiento actual, sin polling.
 */
export function useCurrentCashRegister({ refetchInterval = false } = {}) {
  return useQuery({
    queryKey: CURRENT_CASH_REGISTER_KEY,
    queryFn: ({ signal }) => api.get('/caja/actual', { signal }),
    refetchInterval,
  });
}
