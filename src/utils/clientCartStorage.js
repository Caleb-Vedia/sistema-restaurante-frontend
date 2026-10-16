/**
 * Persistencia local del carrito del cliente — sobrevive a un refresh de
 * la pestaña (F5) e incluso al cierre accidental de la pestaña/navegador,
 * mientras la sesión de mesa subyacente siga siendo la misma.
 *
 * localStorage, no sessionStorage
 * --------------------------------
 * A diferencia de la sesión de mesa (`clientTableSessionStorage.js`) y los
 * snapshots de pedidos (`clientOrderStorage.js`) — que usan sessionStorage
 * a propósito, para no perpetuar un token/pedido de una visita anterior de
 * la pestaña — el carrito usa localStorage deliberadamente: si el cliente
 * cierra la pestaña por accidente (o el navegador la mata en segundo
 * plano, algo frecuente en mobile) mientras su mesa sigue `ocupada` con el
 * MISMO token, volver a entrar no debería perder lo que ya había armado.
 * El aislamiento sigue siendo tan estricto como con sessionStorage: la
 * comparación de `token` (ver `readCart`) es la que decide si el carrito
 * guardado sigue perteneciendo a esta visita, sin importar qué storage se
 * use por debajo.
 *
 * Aislamiento por visita
 * -----------------------
 * Mismo criterio que el resto del módulo cliente: la key de localStorage
 * lleva el `tableId`, y el registro guardado lleva el `token`. Si el token
 * guardado no coincide con el actual (mesa nueva, o misma mesa con una
 * sesión distinta), el carrito guardado NO se usa — pertenece a otra
 * visita. La decisión de qué hacer en ese caso (vaciar) vive en
 * useCarrito.sincronizarSesion, no acá: este archivo es solo
 * almacenamiento.
 *
 * Todas las funciones son best-effort: localStorage puede fallar (modo
 * privado agresivo, cuota llena, entorno sin storage). Un fallo de
 * lectura o escritura NUNCA debe romper la UI — el carrito sigue
 * funcionando en memoria vía Zustand aunque no se pueda persistir.
 */

const CART_STORAGE_PREFIX = 'restaurant-client-cart:';

const storageKey = (tableId) => `${CART_STORAGE_PREFIX}${tableId}`;

/**
 * Lee el carrito guardado para `tableId`, solo si pertenece a la visita
 * con este `token` exacto. Devuelve el array de `items`, o `null` si no
 * hay nada guardado, si el token no coincide, si el JSON está corrupto, o
 * si localStorage no está disponible — nunca lanza.
 */
export function readCart(tableId, token) {
  try {
    const raw = localStorage.getItem(storageKey(tableId));
    if (!raw) return null;

    const registro = JSON.parse(raw);
    if (!registro || typeof registro !== 'object') return null;
    if (registro.token !== token) return null;
    if (!Array.isArray(registro.items)) return null;

    return registro.items;
  } catch {
    return null;
  }
}

/**
 * Guarda el carrito ACTUAL de esta visita (`tableId` + `token`). Escritura
 * best-effort: no lanza si localStorage falla, simplemente no persiste —
 * el carrito en memoria no se ve afectado por ese fallo.
 *
 * Se llama con cada cambio de `items` (ver el `subscribe` en
 * useCarrito.js), incluida una lista vacía: un carrito vaciado
 * explícitamente, o vaciado línea por línea tras un checkout exitoso,
 * debe persistir como vacío — no debe quedar reapareciendo desde una
 * copia vieja en storage.
 */
export function saveCart(tableId, token, items) {
  try {
    localStorage.setItem(storageKey(tableId), JSON.stringify({ token, items }));
  } catch {
    // No crítico: ver comentario de más arriba.
  }
}
