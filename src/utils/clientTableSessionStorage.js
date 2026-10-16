/**
 * Snapshot local de la sesión de mesa: lo que guarda `useTableSession` cada
 * vez que `POST /mesas/:id/sesion` responde con éxito.
 *
 * Por qué existe (separado del propio hook)
 * ------------------------------------------
 * `useTableSession` sigue siendo el ÚNICO lugar que llama al POST — este
 * archivo no ejecuta red, solo lee/escribe el snapshot. Se extrae a un
 * módulo aparte porque ahora hay DOS consumidores de la lectura: el propio
 * hook (para reescribir tras cada POST exitoso) y `ClientLayout` (para
 * poder mostrar una ruta hija — /cart, /order/:orderId — en un hard
 * refresh, sin volver a golpear el backend). Mantener la key y el shape en
 * un solo lugar evita que ambos lados diverjan.
 *
 * sessionStorage, no localStorage: sobrevive a navegar entre /menu, /cart,
 * /order y a un refresh de la pestaña, pero no perpetúa indefinidamente el
 * token de una visita anterior del navegador.
 *
 * El valor leído puede estar VENCIDO — Caja pudo haber cerrado esa sesión
 * después de guardarse. Eso es aceptable acá: este helper es solo
 * almacenamiento, no valida vigencia contra el backend. La decisión de qué
 * hacer con un snapshot posiblemente vencido es de quien lo consume (ver
 * ClientLayout: nunca se usa para decidir si hace falta abrir sesión, y un
 * 401 más adelante en /pedidos nunca dispara una reapertura automática).
 */

const SESSION_STORAGE_PREFIX = 'restaurant-table-session:';

const storageKey = (tableId) => `${SESSION_STORAGE_PREFIX}${tableId}`;

/**
 * Lee el snapshot guardado para una mesa. Devuelve `null` si no hay nada,
 * si el JSON está corrupto, si le falta `token`, o si sessionStorage no
 * está disponible — nunca lanza.
 */
export function readTableSession(tableId) {
  try {
    const raw = sessionStorage.getItem(storageKey(tableId));
    if (!raw) return null;

    const session = JSON.parse(raw);
    if (!session || typeof session !== 'object' || !session.token) return null;

    return session;
  } catch {
    return null;
  }
}

/**
 * Guarda el snapshot de una respuesta real de `POST /mesas/:id/sesion`.
 * Escritura best-effort (sessionStorage puede fallar: modo privado
 * agresivo, cuota llena) — no lanza.
 */
export function saveTableSession(tableId, session) {
  try {
    sessionStorage.setItem(
      storageKey(tableId),
      JSON.stringify({
        token: session.token,
        idMesa: session.idMesa,
        nombreMesa: session.nombreMesa,
        estado: session.estado,
      }),
    );
  } catch {
    // No crítico: ver comentario de más arriba.
  }
}
