import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { saveTableSession } from '../utils/clientTableSessionStorage';

export const tableSessionKey = (tableId) => ['mesa-sesion', tableId];

/**
 * Abre o recupera la sesión de una mesa: POST /mesas/:tableId/sesion.
 *
 * Público — sin JWT, sin cookie de staff. El backend ya resuelve
 * concurrencia: si la mesa está libre crea una sesión nueva; si ya está
 * `ocupada` o `cuenta_solicitada` devuelve la sesión activa existente con
 * el mismo token. Por eso ese estado NUNCA se trata como error acá.
 *
 * Se modela como useQuery (no useMutation) a propósito: aunque el verbo
 * HTTP es POST, repetir la llamada es seguro (el backend documenta que
 * devuelve la sesión vigente) y necesitamos el "fetch automático al montar
 * + refetch con botón" que useQuery da de fábrica, igual que el resto de
 * los hooks de este proyecto.
 *
 * El backend es la fuente de verdad: mientras este hook está habilitado,
 * nunca confía en un token viejo de sessionStorage para decidir si hace
 * falta pedir sesión — solo LEE ese snapshot un nivel más arriba
 * (ClientLayout, vía `readTableSession`) como fallback cuando este hook
 * está deliberadamente deshabilitado. Cuando la respuesta del POST llega,
 * se guarda/reemplaza en sessionStorage — así, si la sesión anterior fue
 * cerrada y el backend ya generó una nueva, no queda dando vueltas el
 * token viejo.
 *
 * `tableId` se valida como entero positivo ANTES de habilitar la query: un
 * tableId con formato inválido (ej. "/menu/abc") nunca dispara el POST.
 *
 * Segundo parámetro `enabled` (default `true`): permite que quien llama
 * apague la query sin dejar de usar el hook — el caso real es
 * `ClientLayout` en las rutas hijas (/cart, /order/:orderId), que NUNCA
 * deben disparar este POST por su cuenta (ni en un hard refresh, ni en una
 * entrada directa), a diferencia de la ruta índice /menu/:tableId, que sí
 * es la puerta legítima de "entrar al flujo". El resultado efectivo que se
 * usa para habilitar la query es `isValidTableId && enabled`: un tableId
 * con formato inválido nunca dispara el POST, sin importar `enabled`.
 */
export function useTableSession(tableId, enabled = true) {
  const isValidTableId = /^[1-9]\d*$/.test(String(tableId ?? ''));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: tableSessionKey(tableId),
    queryFn: async () => {
      const session = await api.post(`/mesas/${tableId}/sesion`);
      saveTableSession(tableId, session);
      return session;
    },
    enabled: isValidTableId && enabled,
    retry: false,
    // Este POST no es una lectura pura: si la mesa está libre crea una
    // sesión nueva y la ocupa. Por eso NO puede repetirse por eventos
    // automáticos de React Query — solo debe ejecutarse al entrar al flujo
    // (mount con la query habilitada) o cuando el usuario pulsa
    // "Reintentar" (refetch() explícito, que ignora estas banderas).
    //
    // Nota sobre `enabled`: alternar esta bandera de `false` a `true` (ej.
    // el usuario vuelve del carrito a /menu/:tableId con "Seguir viendo el
    // menú") SÍ dispara un fetch nuevo — es el comportamiento de fábrica de
    // React Query con `staleTime` en 0 (el default, sin tocar) y es
    // exactamente lo que corresponde acá: esa navegación es la misma
    // "entrada al flujo" que un mount, así que debe re-ejecutar el POST
    // igual que si fuera la primera vez. Lo que este hook garantiza es que
    // NUNCA se dispara solo, sin que `enabled` haya sido `true` — ni al
    // montar deshabilitado, ni por foco de ventana, ni por reconexión.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // refetchOnMount y staleTime se dejan en su default (true / 0) a
    // propósito: refetchOnMount=true es justamente el disparador legítimo
    // de "entrar al flujo cliente" (coincide con que el backend es la
    // fuente de verdad, según el resto de este hook), y con
    // refetchOnWindowFocus/refetchOnReconnect ya en false, staleTime deja
    // de influir en si se repite el POST — no hace falta tocarlo.
  });

  return { session: data, isValidTableId, isLoading, isError, error, refetch };
}
