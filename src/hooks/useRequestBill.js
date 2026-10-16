import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { tableSessionKey } from './useTableSession';
import { saveTableSession } from '../utils/clientTableSessionStorage';

/**
 * Solicitar la cuenta de la mesa: PATCH /mesas/pedir-cuenta.
 *
 * Sin `:id` en la URL, sin body: la mesa/sesión se resuelve exclusivamente
 * por el header `X-Table-Token`, igual criterio que `POST /pedidos` (ver
 * useCreateOrder) — NO usa JWT ni la cookie de staff, y el header se pasa
 * por request a propósito: es específico del módulo cliente y no debe
 * viajar en el resto de las llamadas de la app (por eso no se agregó
 * global en api.js).
 *
 * Efecto real en backend: solo funciona con la mesa en `ocupada` y la deja
 * en `cuenta_solicitada`. NO cierra la mesa, no cobra, no calcula cuenta,
 * no cancela pedidos — eso lo hace Caja después, en un flujo aparte.
 *
 * `retry: false` explícito: el endpoint NO es idempotente a nivel HTTP (una
 * segunda llamada sobre una mesa ya en `cuenta_solicitada` es un 409), así
 * que reintentar solo automáticamente arriesga convertir un éxito ambiguo
 * en un 409 confuso. La UI decide expresamente si vuelve a intentar.
 *
 * Sincronización tras el 200 (no antes: nunca optimistic update)
 * -----------------------------------------------------------------
 * El response es `{ idMesa, estado }` — nada de token ni nombreMesa. La
 * sesión local se actualiza por FUSIÓN, no por reemplazo: se parte de la
 * `session` vigente (recibida en `mutate`) y solo se pisa `estado` con el
 * valor confirmado del backend. `token`, `idMesa` y `nombreMesa` quedan
 * intactos.
 *
 * Esa sesión fusionada se escribe en DOS lugares, ambos ya existentes — no
 * se inventa un tercer mecanismo:
 *   - la cache de React Query, en la MISMA key que usa useTableSession
 *     (`tableSessionKey`), vía `setQueryData`. Es válido acá porque ya
 *     tenemos un 200 autoritativo del backend (no es optimistic): al
 *     escribir ahí, `ClientLayout`, `MenuPage` y `CartPage` —todos
 *     suscriptos a esa misma query— ven `cuenta_solicitada` de inmediato,
 *     sin ningún request adicional (nunca se llama a
 *     `POST /mesas/:id/sesion` para "refrescar").
 *   - sessionStorage, con el `saveTableSession` que ya usa useTableSession
 *     — así un F5 posterior en /cart o /order/:orderId (rutas que ya no
 *     abren sesión propia, ver ClientLayout) sigue viendo
 *     `cuenta_solicitada` sin volver a golpear el backend.
 *
 * Uso:
 *   const requestBill = useRequestBill();
 *   requestBill.mutate({ token, tableId, session });
 */
export function useRequestBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ token }) => api.patch('/mesas/pedir-cuenta', undefined, { headers: { 'X-Table-Token': token } }),
    retry: false,
    onSuccess: (response, { tableId, session }) => {
      const sesionActualizada = { ...session, estado: response.estado };
      queryClient.setQueryData(tableSessionKey(tableId), sesionActualizada);
      saveTableSession(tableId, sesionActualizada);
    },
  });
}
