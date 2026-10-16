import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { updateClientOrder } from '../utils/clientOrderStorage';

export const orderTrackingKey = (idPedido) => ['pedido-tracking', idPedido];

const POLLING_INTERVAL_MS = 4000;

/** Estados en los que todavía tiene sentido seguir consultando. `listo` es terminal para este tracking. */
const ESTADOS_EN_SEGUIMIENTO = ['pendiente', 'preparacion'];

/**
 * ¿Corresponde seguir consultando este pedido? Se exporta porque
 * OrderStatusPage necesita la MISMA regla para su propio copy ("se
 * actualiza automáticamente" vs. no) — una sola fuente de verdad en vez de
 * repetir la lista de estados en dos archivos.
 */
export function sigueEnSeguimiento(estado) {
  return ESTADOS_EN_SEGUIMIENTO.includes(estado);
}

/**
 * Tracking real de un pedido: GET /pedidos/:id, con polling mientras el
 * estado sigue en curso.
 *
 * Header, no sesión nueva
 * ------------------------
 * `X-Table-Token` viaja por request (mismo criterio que useCreateOrder /
 * useRequestBill) — NO se agrega global en api.js. Este hook NO abre ni
 * reabre sesión de mesa: usa el `token` que ya resolvió ClientLayout (cache
 * de React Query o sessionStorage) y que llega acá tal cual desde
 * OrderStatusPage. Si no hay sesión local, OrderStatusPage nunca llega a
 * montar esta pantalla (ClientLayout corta antes con "Sesión no
 * disponible") — ver ese componente.
 *
 * `retry: false` explícito, igual que el resto de las llamadas del módulo
 * cliente: un fallo de ESTE intento no debe reintentarse solo un instante
 * después por su cuenta — el polling ya se encarga de volver a intentar en
 * el próximo intervalo normal (ver `refetchInterval`), así que un retry
 * inmediato adicional sería redundante.
 *
 * Polling — cuándo sigue y cuándo se detiene
 * --------------------------------------------
 * `refetchInterval` es una función (API nativa de React Query, sin
 * setInterval manual propio) que decide en cada tick si programar el
 * próximo fetch:
 *   - `estado === 'listo'`             → se detiene (false)
 *   - error con `status` 401 o 404     → se detiene (false): son
 *     rechazos CONFIRMADOS del servidor, no tiene sentido seguir
 *     insistiendo con el mismo token/id
 *   - cualquier otro caso (pendiente/preparacion, o un error de red/5xx
 *     transitorio) → sigue cada ~4s
 * Un error de red/5xx NUNCA detiene el polling — es exactamente el caso
 * "permitir que el polling vuelva a intentar normalmente" (no se sabe si
 * fue un bache pasajero). `data` de React Query conserva el ÚLTIMO
 * response exitoso aunque un fetch posterior falle: no hace falta lógica
 * propia para "conservar el último snapshot conocido", es el
 * comportamiento de fábrica.
 *
 * Persistencia
 * ------------
 * Cada GET exitoso se guarda con `updateClientOrder` (reemplaza la entrada
 * existente por `idPedido`, no la ignora como haría `saveClientOrder`) —
 * mismo storage que ya usa el resto del módulo cliente, sin un sistema
 * paralelo. Se persiste DENTRO de `queryFn`, no en un callback `onSuccess`
 * de `useQuery` (React Query v5 ya no lo tiene) — mismo patrón que
 * `useTableSession`.
 *
 * Uso:
 *   const tracking = useOrderTracking({ tableId, idPedido, token, enabled });
 */
export function useOrderTracking({ tableId, idPedido, token, enabled }) {
  return useQuery({
    queryKey: orderTrackingKey(idPedido),
    queryFn: async () => {
      const pedido = await api.get(`/pedidos/${idPedido}`, { headers: { 'X-Table-Token': token } });
      updateClientOrder(tableId, token, pedido);
      return pedido;
    },
    enabled: enabled && idPedido != null && !!token,
    retry: false,
    refetchInterval: (query) => {
      const error = query.state.error;
      if (error) {
        return error.status === 401 || error.status === 404 ? false : POLLING_INTERVAL_MS;
      }
      return sigueEnSeguimiento(query.state.data?.estado) ? POLLING_INTERVAL_MS : false;
    },
  });
}
