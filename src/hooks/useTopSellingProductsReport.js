import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del reporte de platos más vendidos para un rango/límite puntual. */
export const topSellingProductsReportKey = (desde, hasta, limite) => [
  'reportes',
  'platos-mas-vendidos',
  desde,
  hasta,
  limite,
];

/**
 * Platos más vendidos: GET /reportes/platos-mas-vendidos?desde=&hasta=&limite=.
 *
 * `limite` se manda siempre explícito (el default de esta UI es 10, no se
 * confía en el default del backend) para que la query key refleje
 * exactamente lo pedido. No depende de useProducts: el reporte ya trae
 * `nombreProducto`, no hace falta cruzar catálogos.
 *
 * Mismo criterio que useSalesReport: `keepPreviousData` para no vaciar la
 * sección en cada cambio de filtro, solo se dispara con desde/hasta presentes.
 */
export function useTopSellingProductsReport(desde, hasta, limite) {
  return useQuery({
    queryKey: topSellingProductsReportKey(desde, hasta, limite),
    queryFn: () =>
      api.get(`/reportes/platos-mas-vendidos?${new URLSearchParams({ desde, hasta, limite: String(limite) })}`),
    enabled: !!desde && !!hasta,
    placeholderData: keepPreviousData,
  });
}
