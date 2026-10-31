const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = value => Number.isSafeInteger(value) && value > 0;
const isNullableString = value => value === null || typeof value === 'string';

// PedidoResponse/DetallePedidoResponse de NestJS, serializados como JSON.
// Solo valida la confirmación; no recalcula importes ni decide reglas de negocio.
export function isOrderConfirmation(pedido) {
  return isRecord(pedido)
    && isId(pedido.idPedido)
    && isId(pedido.nroOrden)
    && isNullableString(pedido.nombreComensal)
    && ['pendiente', 'preparacion', 'listo'].includes(pedido.estado)
    && typeof pedido.creadoEl === 'string'
    && Number.isFinite(Date.parse(pedido.creadoEl))
    && Array.isArray(pedido.detalles)
    && pedido.detalles.length > 0
    && pedido.detalles.every(detalle => isRecord(detalle)
      && isId(detalle.idDetalle)
      && isId(detalle.idProducto)
      && typeof detalle.nombreProducto === 'string'
      && isId(detalle.cantidad)
      && typeof detalle.precioActual === 'number'
      && Number.isFinite(detalle.precioActual)
      && isNullableString(detalle.observacion));
}
