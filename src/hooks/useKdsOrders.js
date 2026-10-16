import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Construye la query key del listado de un área de KDS: ['pedidos', area].
 * Se exporta para que useUpdateOrderStatus invalide exactamente la entrada
 * del área que originó la mutación — nunca la de otra área.
 */
export const kdsOrdersKey = (area) => ['pedidos', area];

/**
 * Hook genérico del KDS. Cocina y Bebidas comparten exactamente el mismo
 * contrato de backend (mismo shape de respuesta, mismos estados, mismo
 * polling): lo único que cambia entre ambos es el área ('cocina' | 'bebidas'),
 * que determina el endpoint y la query key.
 *
 * No hay WebSocket/SSE en el backend: la actualización "en vivo" se resuelve
 * con polling — React Query vuelve a pedir GET /pedidos/:area cada 4
 * segundos mientras algún componente use este hook. No hay setInterval
 * manual ni copia del array en useState: React Query es la única fuente de
 * verdad de los pedidos.
 *
 * El backend ya devuelve los pedidos ordenados (creadoEl ASC, idDetalle ASC)
 * y excluye los que están en estado "listo" — no se reordena ni filtra acá.
 *
 * Retorna directamente el resultado de useQuery (data, isLoading, isError,
 * error, refetch, ...) para que la pantalla decida qué mostrar en cada estado.
 */
export function useKdsOrders(area) {
  return useQuery({
    queryKey: kdsOrdersKey(area),
    queryFn: () => api.get(`/pedidos/${area}`),
    refetchInterval: 4000,
  });
}
