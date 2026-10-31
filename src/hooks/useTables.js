import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del listado de mesas. */
export const TABLES_KEY = ['mesas'];

/**
 * Listado de mesas para Caja: GET /mesas.
 *
 * Caja habilita polling explícitamente; los demás consumidores conservan
 * las lecturas e invalidaciones habituales.
 */
export function useTables({ enabled = true, refetchInterval = false } = {}) {
  return useQuery({
    queryKey: TABLES_KEY,
    queryFn: ({ signal }) => api.get('/mesas', { signal }),
    enabled,
    refetchInterval,
  });
}
