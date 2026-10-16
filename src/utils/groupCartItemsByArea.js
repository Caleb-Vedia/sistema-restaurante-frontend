/**
 * Agrupa las líneas del carrito por área de producción.
 *
 * `POST /pedidos` crea UN pedido para UNA sola `idAreaProducto`: el backend
 * rechaza con 400 un body que mezcle áreas. El carrito, en cambio, SÍ puede
 * contener productos de varias áreas — es intencional (ver useCarrito) y no
 * se bloquea. La traducción entre ambas realidades ocurre acá: un checkout
 * con productos de cocina y de bebidas se convierte en dos grupos, y cada
 * grupo será un POST independiente.
 *
 * Ejemplo:
 *   [Silpancho(área 1), Sopa(área 1), Coca Cola(área 2), Jugo(área 2)]
 *   → [ { idAreaProducto: 1, items: [Silpancho, Sopa] },
 *       { idAreaProducto: 2, items: [Coca Cola, Jugo] } ]
 *
 * Función pura: NO muta `items` ni las líneas que contiene — solo las
 * reagrupa dentro de arrays nuevos.
 *
 * El orden es determinista en dos niveles, gracias a `Map`:
 *   - las áreas salen en orden de PRIMERA APARICIÓN en el carrito
 *   - dentro de cada área, las líneas conservan su orden original
 * Importa porque los grupos se envían de a uno y en ese orden: para un
 * mismo carrito, la secuencia de pedidos creados es siempre la misma.
 *
 * No se traduce el id a un nombre ("Cocina"/"Bebidas"): al cliente no se le
 * muestra el área y el pedido tampoco la envía — acá el id sirve
 * únicamente como criterio de corte.
 */
export function groupCartItemsByArea(items) {
  const porArea = new Map();

  for (const item of items) {
    const grupo = porArea.get(item.idAreaProducto);
    if (grupo) {
      grupo.push(item);
    } else {
      porArea.set(item.idAreaProducto, [item]);
    }
  }

  return Array.from(porArea, ([idAreaProducto, itemsDelArea]) => ({
    idAreaProducto,
    items: itemsDelArea,
  }));
}
