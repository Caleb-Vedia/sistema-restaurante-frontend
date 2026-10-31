import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Construye el string `observacion` que espera el backend a partir de la
 * personalización ESTRUCTURADA de una línea (`ingredientesQuitados` +
 * `otraIndicacion`) — este es el ÚNICO lugar de toda la app donde esa
 * estructura se aplana a un string. El carrito nunca guarda este string
 * como fuente de verdad (ver useCarrito.js): se deriva acá, recién al
 * armar el POST, para no tener que volver a parsearlo si el cliente
 * reabre el diálogo de personalización para editar esa línea.
 *
 * Formato (salto de línea entre bloques si ambos están presentes):
 *   Sin: papa frita, cebolla
 *   Nota: salsa aparte
 *
 * Devuelve `undefined` (no `''`) si la línea no tiene ninguna
 * personalización — el backend rechaza `observacion: ""` como si fuera un
 * valor no vacío inválido, así que este campo se omite del todo, nunca se
 * envía vacío (ver `buildOrderPayload`).
 */
function buildObservacion(item) {
  const bloques = [];

  if (item.ingredientesQuitados?.length > 0) {
    bloques.push(`Sin: ${item.ingredientesQuitados.map((ingrediente) => ingrediente.nombre).join(', ')}`);
  }

  const nota = item.otraIndicacion?.trim();
  if (nota) {
    bloques.push(`Nota: ${nota}`);
  }

  return bloques.length > 0 ? bloques.join('\n') : undefined;
}

/**
 * Arma el body de POST /pedidos a partir de un grupo del carrito.
 *
 * Este es el ÚNICO lugar que conoce el contrato de red del pedido, y lo
 * hace por lista blanca: de cada línea del carrito solo se copian
 * `idProducto`, `cantidad` y (si aplica, ya aplanada por `buildObservacion`)
 * `observacion`.
 *
 * Explícitamente NO se envía: `precio` (el backend lee `Producto.precio`
 * vigente en el instante del POST y lo congela en `detalle.precioActual`;
 * el subtotal del carrito es solo un estimado de UX), `idAreaProducto` (el
 * área es implícita — el grupo ya es de una sola área), `idMesa`,
 * `idSesion` (la mesa y la sesión las resuelve el backend con el header
 * X-Table-Token), `urlImagen`, `nombreProducto`, `lineKey` ni la
 * estructura cruda de ingredientes quitados/otra indicación.
 *
 * Campos opcionales que quedan vacíos se OMITEN, no se mandan vacíos: el
 * backend valida `nombreComensal` como string no vacío CUANDO está
 * presente, así que `{ nombreComensal: "" }` sería un 400. Mismo criterio
 * para `observacion`.
 *
 * Dos líneas del carrito con el mismo `idProducto` (variantes distintas
 * del mismo producto) se mapean a DOS entradas independientes acá — el
 * backend no las fusiona ni las rechaza (ver PedidosService.crearPedido:
 * itera `dto.items` tal cual, sin deduplicar por idProducto; el `Set` que
 * usa internamente es solo para la consulta de productos, no para los
 * detalles que crea).
 */
export function buildOrderPayload({ nombreComensal, items }) {
  const nombre = nombreComensal?.trim();

  return {
    ...(nombre ? { nombreComensal: nombre } : {}),
    items: items.map((item) => {
      const observacion = buildObservacion(item);
      return {
        idProducto: item.idProducto,
        cantidad: item.cantidad,
        ...(observacion ? { observacion } : {}),
      };
    }),
  };
}

/**
 * ¿El resultado de este POST es INCIERTO (no sabemos si el pedido se creó)?
 *
 * Hay que distinguir "el servidor respondió y rechazó" de "no sabemos si
 * respondió". api.js da esa información de forma estructurada, sin tener
 * que adivinar por el texto del mensaje: solo adjunta `error.status`
 * cuando hubo una respuesta HTTP real. Si el fetch falla en transporte
 * (red caída, conexión cortada, abort), el error que se propaga es el del
 * navegador y NO trae `status`.
 *
 * Se consideran inciertos:
 *   - error sin `status` → falla de transporte: el POST pudo haber llegado
 *     y haberse commiteado antes de que se cortara la respuesta
 *   - `status >= 500` → el contrato actual no permite demostrar que la
 *     operación no quedó persistida
 *
 * Un 4xx común es un rechazo confirmado. Los códigos de idempotencia son
 * diferentes: puede existir un pedido anterior y no se debe borrar su clave.
 *
 * Ante la duda se prefiere el lado seguro (incierto), porque el costo de
 * equivocarse es duplicar un pedido real en la cocina.
 */
export function isAmbiguousError(error) {
  return ['IDEMPOTENCY_CONTENT_MISMATCH', 'IDEMPOTENCY_PENDING'].includes(error?.code)
    || typeof error?.status !== 'number' || error.status >= 500;
}

/**
 * Creación de UN pedido: POST /pedidos.
 *
 * Un pedido = un área. El backend rechaza un body que mezcle
 * `idAreaProducto`, así que este hook representa exactamente un POST, para
 * un solo grupo ya homogéneo. La secuencia de varios grupos (checkout
 * multiárea) no vive acá — la orquesta useCheckout.
 *
 * Autenticación: header `X-Table-Token` con el token de la sesión de mesa.
 * NO usa JWT ni la cookie de staff, y el header se pasa por request a
 * propósito: es específico del módulo cliente y no debe viajar en el resto
 * de las llamadas de la app (por eso NO se agregó global en api.js).
 *
 * `retry: false` explícito: incluso con clave, la recuperación y el reenvío
 * son decisiones explícitas del cliente. Se conserva el payload del intento.
 *
 * Uso:
 *   const createOrder = useCreateOrder();
 *   await createOrder.mutateAsync({ token, nombreComensal, items });
 */
export function useCreateOrder() {
  return useMutation({
    mutationFn: ({ token, nombreComensal, items, payload, claveIdempotencia }) =>
      api.post('/pedidos', { ...(payload ?? buildOrderPayload({ nombreComensal, items })), claveIdempotencia }, {
        headers: { 'X-Table-Token': token },
      }),
    retry: false,
  });
}
