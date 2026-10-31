/**
 * Almacenamiento local de los pedidos que el cliente creó en ESTA visita.
 *
 * Conserva snapshots para el tracking y el intento pendiente para recuperar
 * respuestas inciertas por su clave en GET /pedidos/mis-pedidos.
 *
 * Se guarda el response REAL del backend, tal cual: `idPedido`, `nroOrden`,
 * `nombreComensal`, `estado`, `creadoEl`, `detalles`. Nada inventado — ni
 * total, ni área, ni un estado local de seguimiento.
 *
 * sessionStorage, no localStorage: igual criterio que la sesión de mesa
 * (useTableSession). Sobrevive a navegar entre pantallas y a refrescar la
 * pestaña, pero no perpetúa los pedidos de una visita anterior del
 * navegador.
 *
 * Aislamiento por visita
 * ----------------------
 * La identidad de una visita es `tableId` + `session.token`, el mismo
 * criterio que usa el carrito. La key de sessionStorage lleva el tableId y
 * el registro guardado lleva el token; si el token guardado NO coincide con
 * el actual, lo almacenado pertenece a una visita anterior de esa misma
 * mesa y se descarta por completo (colección nueva) en vez de mezclarse.
 *
 * Marcador de resultado incierto
 * ------------------------------
 * En el mismo registro vive `ambiguous`: el rastro de un envío cuyo
 * resultado NO se pudo confirmar (error de red / 5xx). No es un error
 * "falló": es "no sabemos si el backend lo creó". Se persiste porque
 * CartPage puede desmontarse y volver a montarse, y el bloqueo de reenvío
 * no puede depender solo de un useState que se pierde en ese remonte.
 * Guarda `createdAt`, la clave del intento y las `lineKey` (identidad de línea/variante
 * del carrito — ver cartLineKey.js, no `idProducto`: dos variantes del
 * mismo producto pueden estar en grupos distintos, y bloquear por
 * `idProducto` bloquearía/desbloquearía la variante equivocada) del grupo
 * afectado. `pendingAttempt` conserva además el payload exacto enviado.
 *
 * sessionStorage puede fallar: guardar el intento ANTES del POST es obligatorio.
 * Un fallo posterior al envío no significa que el pedido no se creó.
 */

const CLIENT_ORDERS_STORAGE_PREFIX = 'restaurant-client-orders:';

const storageKey = (tableId) => `${CLIENT_ORDERS_STORAGE_PREFIX}${tableId}`;

const REGISTRO_VACIO = { orders: [], ambiguous: null };

/**
 * Lee el registro crudo de la mesa, ya validado en su forma. Devuelve null
 * si no hay nada guardado, si el JSON está corrupto o si sessionStorage no
 * está disponible.
 */
function leerRegistro(tableId) {
  try {
    const raw = sessionStorage.getItem(storageKey(tableId));
    if (!raw) return null;

    const registro = JSON.parse(raw);
    if (!registro || typeof registro !== 'object' || !Array.isArray(registro.orders)) {
      return null;
    }
    return registro;
  } catch {
    return null;
  }
}

/** Escritura best-effort. `true` si quedó persistido, `false` si falló. */
function escribirRegistro(tableId, registro) {
  try {
    sessionStorage.setItem(storageKey(tableId), JSON.stringify(registro));
    return true;
  } catch {
    return false;
  }
}

/**
 * Registro de la visita ACTUAL: si el token guardado es otro (o no hay
 * nada), devuelve uno vacío en vez de la colección de la visita anterior.
 */
function leerRegistroDeLaVisita(tableId, token) {
  const registro = leerRegistro(tableId);
  if (!registro || registro.token !== token) return null;
  return registro;
}

/**
 * Pedidos guardados de esta visita, con el marcador de resultado incierto.
 * Nunca lanza: ante cualquier problema devuelve la colección vacía.
 */
export function readClientOrders(tableId, token) {
  const registro = leerRegistroDeLaVisita(tableId, token);
  if (!registro) return REGISTRO_VACIO;

  return {
    orders: registro.orders,
    ambiguous: registro.ambiguous ?? null,
  };
}

/**
 * Guarda un PedidoResponse exitoso. Devuelve `true` si quedó persistido.
 *
 * Dedup por `idPedido`: si ese pedido ya está en la colección local, no se
 * duplica. Es protección del almacenamiento local y NADA MÁS — no es
 * idempotencia de red ni una excusa para reintentar un POST.
 *
 * Si el token guardado pertenece a otra visita, se empieza colección nueva.
 */
export function saveClientOrder(tableId, token, pedido) {
  const registro = leerRegistroDeLaVisita(tableId, token);
  const orders = registro?.orders ?? [];

  const yaGuardado =
    pedido?.idPedido != null && orders.some((guardado) => guardado?.idPedido === pedido.idPedido);

  if (yaGuardado) return true;

  return escribirRegistro(tableId, {
    ...registro,
    token,
    orders: [...orders, pedido],
    ambiguous: registro?.ambiguous ?? null,
  });
}

/**
 * Busca UN pedido guardado de esta visita por `idPedido` — es la lectura
 * que usa OrderStatusPage (/order/:orderId) para mostrar el detalle de un
 * pedido ya creado. Reutiliza `leerRegistroDeLaVisita`, el mismo criterio
 * de aislamiento (tableId + token) que el resto del archivo: nunca busca
 * en la colección de otra visita ni recorre otras keys de sessionStorage.
 *
 * Solo lectura: no modifica storage ni ejecuta ningún request. Devuelve el
 * PedidoResponse guardado tal cual, o `null` si no está — ya sea porque el
 * token no coincide, el JSON está corrupto, o simplemente ese id nunca se
 * guardó en este dispositivo.
 */
export function getClientOrder(tableId, token, idPedido) {
  const registro = leerRegistroDeLaVisita(tableId, token);
  if (!registro) return null;

  return registro.orders.find((pedido) => pedido?.idPedido === idPedido) ?? null;
}

/**
 * Actualiza el pedido guardado con el mismo `idPedido` que `pedido`,
 * REEMPLAZANDO la entrada completa por el response más reciente (o
 * agregándolo si por algún motivo no estaba). Lo usa el tracking de
 * OrderStatusPage: cada `GET /pedidos/:id` exitoso trae información
 * potencialmente más nueva que el snapshot congelado del POST original
 * (típicamente `estado`), y ese avance debe quedar reflejado acá para que
 * sobreviva a un F5 sobre /order/:orderId.
 *
 * A diferencia de `saveClientOrder` — que deduplica SIN pisar una entrada
 * existente, porque ahí "ya guardado" significa "no hay nada nuevo que
 * decir" — acá el caso de uso es el opuesto: siempre hay algo nuevo que
 * decir (la respuesta que se acaba de recibir), así que si el id ya existe
 * se reemplaza en vez de ignorarse.
 *
 * Devuelve `true` si quedó persistido, `false` si falló (best-effort,
 * igual que el resto del archivo — un fallo de storage acá NUNCA debe
 * romper el tracking: la UI sigue mostrando la respuesta recién recibida
 * aunque no haya quedado guardada).
 */
export function updateClientOrder(tableId, token, pedido) {
  const registro = leerRegistroDeLaVisita(tableId, token);
  const orders = registro?.orders ?? [];

  const yaExiste = pedido?.idPedido != null && orders.some((guardado) => guardado?.idPedido === pedido.idPedido);

  const nuevasOrders = yaExiste
    ? orders.map((guardado) => (guardado?.idPedido === pedido.idPedido ? pedido : guardado))
    : [...orders, pedido];

  return escribirRegistro(tableId, {
    ...registro,
    token,
    orders: nuevasOrders,
    ambiguous: registro?.ambiguous ?? null,
  });
}

/**
 * Marcador de "no sabemos si este grupo se creó" para esta visita.
 * Devuelve el marcador o null si no hay ninguno vigente.
 */
export function readAmbiguousMarker(tableId, token) {
  const registro = leerRegistroDeLaVisita(tableId, token);
  if (registro?.ambiguous) return registro.ambiguous;
  const intento = registro?.pendingAttempt;
  // Una recarga durante el POST no sabe si hubo commit: nunca crea otra clave.
  return intento ? {
    createdAt: intento.createdAt,
    itemIds: intento.lines.map(line => line.lineKey),
    claveIdempotencia: intento.claveIdempotencia,
  } : null;
}

/**
 * Deja registrado que el resultado del último envío es incierto.
 *
 * Devuelve SIEMPRE el marcador construido, aunque sessionStorage haya
 * fallado: el bloqueo de reenvío tiene que aplicarse igual durante la vida
 * de la pantalla. Persistirlo solo agrega que sobreviva a un remonte.
 */
export function markAmbiguousResult(tableId, token, itemIds) {
  const registro = leerRegistroDeLaVisita(tableId, token);
  const ambiguous = { createdAt: new Date().toISOString(), itemIds,
    ...(registro?.pendingAttempt ? { claveIdempotencia: registro.pendingAttempt.claveIdempotencia } : {}),
  };

  escribirRegistro(tableId, {
    ...registro,
    token,
    orders: registro?.orders ?? [],
    ambiguous,
  });

  return ambiguous;
}

/**
 * Borra el marcador de resultado incierto, conservando los pedidos
 * guardados. Se llama solo cuando el usuario reconoce explícitamente la
 * advertencia — nunca de forma automática.
 */
export function clearAmbiguousResult(tableId, token) {
  const registro = leerRegistroDeLaVisita(tableId, token);
  if (registro?.pendingAttempt) return false;
  if (!registro?.ambiguous) return;

  escribirRegistro(tableId, {
    ...registro,
    token,
    orders: registro.orders,
    ambiguous: null,
  });
}

function localAttemptError(message) {
  const error = new Error(message);
  error.code = 'ORDER_ATTEMPT_NOT_SENT';
  return error;
}

function nuevaClave() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // getRandomValues también está disponible en el despliegue HTTP sin contexto seguro.
  if (!globalThis.crypto?.getRandomValues) throw localAttemptError('El navegador no permite identificar el pedido de forma segura.');
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function readPendingAttempt(tableId, token) {
  return leerRegistroDeLaVisita(tableId, token)?.pendingAttempt ?? null;
}

export function prepareOrderAttempt(tableId, token, area, payload, items) {
  const registro = leerRegistroDeLaVisita(tableId, token);
  if (registro?.pendingAttempt) {
    if (JSON.stringify(registro.pendingAttempt.payload) !== JSON.stringify(payload)) {
      throw localAttemptError('Hay un intento pendiente. Consultá su resultado antes de cambiar el pedido.');
    }
    return registro.pendingAttempt;
  }
  const intento = {
    claveIdempotencia: nuevaClave(), area, payload,
    lines: items.map(item => ({ lineKey: item.lineKey, cantidad: item.cantidad })),
    createdAt: new Date().toISOString(),
  };
  if (!escribirRegistro(tableId, { ...registro, token, orders: registro?.orders ?? [], ambiguous: null, pendingAttempt: intento })) {
    throw localAttemptError('No se envió el pedido: no se pudo guardar la identidad del intento en este navegador.');
  }
  return intento;
}

export function discardRejectedAttempt(tableId, token) {
  const registro = leerRegistroDeLaVisita(tableId, token);
  if (!registro) return true;
  return escribirRegistro(tableId, { ...registro, pendingAttempt: null, ambiguous: null });
}

export function completeOrderAttempt(tableId, token, clave, pedido) {
  const registro = leerRegistroDeLaVisita(tableId, token);
  if (registro?.pendingAttempt?.claveIdempotencia !== clave) return false;
  const orders = registro.orders.filter(order => order?.idPedido !== pedido.idPedido);
  return escribirRegistro(tableId, { ...registro, orders: [...orders, pedido], pendingAttempt: null, ambiguous: null });
}
