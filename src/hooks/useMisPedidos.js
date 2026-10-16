import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { sigueEnSeguimiento } from './useOrderTracking';

/**
 * Query key PROPIA — no reutiliza orderTrackingKey (esa es por idPedido
 * individual). Incluye el TOKEN, no solo `tableId`: una misma mesa puede
 * tener sesiones sucesivas con tokens distintos (la sesión anterior se
 * cerró y se abrió una visita nueva — mismo criterio de identidad que
 * useCarrito.sincronizarSesion y clientOrderStorage). Sin el token acá, al
 * pasar de un token viejo a uno nuevo la cache de React Query seguiría
 * devolviendo (aunque sea por un instante, mientras el nuevo fetch está en
 * vuelo) los pedidos de la visita anterior bajo la misma key — exactamente
 * lo que esta key evita: `tableId` + token nuevo cae en una entrada de
 * cache totalmente aparte, que arranca en `data: undefined` (loading) en
 * vez de heredar nada de la sesión previa.
 */
export const misPedidosKey = (tableId, token) => ['pedidos-sesion', tableId, token];

const POLLING_INTERVAL_MS = 4000;

/**
 * Todos los pedidos de la sesión activa de la mesa: GET /pedidos/mis-pedidos.
 *
 * Backend es la fuente autoritativa acá — a diferencia de OrderStatusPage
 * (que necesita un snapshot local para saber QUÉ id trackear), este hook no
 * depende de ningún dato local para poder consultar: siempre intenta el
 * backend primero. El fallback a snapshots locales (readClientOrders) es
 * responsabilidad de quien llama (MyOrdersPage), no de este hook — mismo
 * reparto de responsabilidades que useOrderTracking/OrderStatusPage
 * (`tracking.data ?? pedidoLocal`).
 *
 * Header, no sesión nueva
 * ------------------------
 * `X-Table-Token` viaja SOLO en esta request (mismo criterio que
 * useOrderTracking/useCreateOrder/useRequestBill) — no se agrega global en
 * api.js. Este hook NUNCA abre ni reabre sesión de mesa.
 *
 * `retry: false` explícito, igual criterio que el resto del módulo cliente:
 * el polling ya se encarga de reintentar en el próximo intervalo normal.
 *
 * Polling — mismo criterio que useOrderTracking
 * -----------------------------------------------
 * - Si CUALQUIER pedido de la lista sigue "en seguimiento" (pendiente o
 *   preparacion, ver sigueEnSeguimiento) → sigue cada ~4s.
 * - Si todos están `listo` → se detiene.
 * - Un error con `status === 401` (token inválido o sesión cerrada) detiene
 *   el polling — insistir con el mismo token no tiene sentido. Cualquier
 *   otro error (red, 5xx) NO detiene el polling: puede ser transitorio.
 *
 * Uso:
 *   const misPedidos = useMisPedidos({ tableId, token, enabled });
 */
export function useMisPedidos({ tableId, token, enabled }) {
  return useQuery({
    queryKey: misPedidosKey(tableId, token),
    queryFn: () => api.get('/pedidos/mis-pedidos', { headers: { 'X-Table-Token': token } }),
    enabled: enabled && !!token,
    retry: false,
    refetchInterval: (query) => {
      const error = query.state.error;
      if (error) {
        return error.status === 401 ? false : POLLING_INTERVAL_MS;
      }
      const pedidos = query.state.data ?? [];
      return pedidos.some((pedido) => sigueEnSeguimiento(pedido.estado)) ? POLLING_INTERVAL_MS : false;
    },
  });
}
