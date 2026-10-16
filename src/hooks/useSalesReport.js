import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del reporte de ventas para un rango puntual. */
export const salesReportKey = (desde, hasta) => ['reportes', 'ventas', desde, hasta];

/**
 * Reporte de ventas: GET /reportes/ventas?desde=&hasta=.
 *
 * `desde`/`hasta` son strings "YYYY-MM-DD" tal como los eligió el admin en
 * el filtro — el backend interpreta esos días calendario en
 * America/La_Paz. Nunca se convierten a Date/UTC acá, se mandan tal cual
 * en la query string.
 *
 * `placeholderData: keepPreviousData` deja el reporte anterior visible
 * mientras se resuelve uno nuevo (cambio de filtro): sin esto, cambiar de
 * fechas vaciaría la sección a loading en cada aplicación de filtros, ya
 * que la query key cambia. `isFetching` en el consumidor permite mostrar
 * un indicador discreto de actualización sin bloquear la sección.
 *
 * Solo se dispara cuando ambos filtros están presentes.
 */
export function useSalesReport(desde, hasta) {
  return useQuery({
    queryKey: salesReportKey(desde, hasta),
    queryFn: () => api.get(`/reportes/ventas?${new URLSearchParams({ desde, hasta })}`),
    enabled: !!desde && !!hasta,
    placeholderData: keepPreviousData,
  });
}
