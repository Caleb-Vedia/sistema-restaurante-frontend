/**
 * Identidad de una línea del carrito — Fase de personalización estructurada.
 *
 * Antes, una línea se identificaba únicamente por `idProducto` (ver
 * useCarrito.js histórico): agregar el mismo producto dos veces, con o sin
 * personalización, siempre fusionaba en una sola fila. Eso ya no alcanza:
 * "1x Hamburguesa" y "1x Hamburguesa — Sin cebolla" tienen que poder
 * convivir como líneas independientes, y dos personalizaciones que
 * terminan siendo EQUIVALENTES (mismos ingredientes quitados, misma nota
 * normalizada) tienen que fusionarse en una sola.
 *
 * La clave combina:
 *   - `idProducto`
 *   - los ids de `ingredientesQuitados`, ORDENADOS (el orden en que el
 *     cliente tildó los checkboxes no debe crear variantes distintas)
 *   - `otraIndicacion` NORMALIZADA (trim + lowercase) — la normalización es
 *     solo para COMPARAR identidad; el texto original (con su casing/
 *     espacios) se conserva aparte en el item para mostrar/enviar.
 *
 * Función pura, sin dependencias del store: la reutilizan useCarrito.js
 * (crear/fusionar líneas) y useCheckout.js (saber qué línea exacta borrar
 * tras un POST exitoso, sin arriesgar borrar otra variante del mismo
 * producto).
 */

/** trim + lowercase — SOLO para comparar identidad, nunca para mostrar/enviar. */
export function normalizarIndicacion(texto) {
  return (texto ?? '').trim().toLowerCase();
}

/**
 * `ingredientesQuitados` es un array de `{ id, nombre }` (mismo shape que
 * `MenuIngredienteResponse` de GET /menu) — acá solo se usan los `id`.
 */
export function buildLineKey({ idProducto, ingredientesQuitados, otraIndicacion }) {
  const idsOrdenados = [...(ingredientesQuitados ?? [])]
    .map((ingrediente) => ingrediente.id)
    .sort((a, b) => a - b)
    .join(',');

  return `${idProducto}::${idsOrdenados}::${normalizarIndicacion(otraIndicacion)}`;
}
