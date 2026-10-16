import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del listado de mesas. */
export const TABLES_KEY = ['mesas'];

/**
 * Listado de mesas para Caja: GET /mesas.
 *
 * El backend ya ordena por idMesa ASC — no se reordena acá. Sin polling:
 * no hay un requisito de tiempo real para esta fase (a diferencia del KDS);
 * la cajera puede refrescar la vista con las herramientas por defecto de
 * React Query (refoco de ventana, refetch manual).
 */
export function useTables() {
  return useQuery({
    queryKey: TABLES_KEY,
    queryFn: () => api.get('/mesas'),
  });
}
