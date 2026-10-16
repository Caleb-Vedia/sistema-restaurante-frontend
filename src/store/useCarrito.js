import { create } from 'zustand'
import { readCart, saveCart } from '../utils/clientCartStorage'
import { buildLineKey } from '../utils/cartLineKey'

/**
 * Carrito del cliente — Zustand en memoria, con persistencia en
 * localStorage acotada a la visita actual (ver clientCartStorage.js). El
 * store en sí sigue siendo la única fuente de verdad para la UI en cada
 * render; el storage solo se usa para REHIDRATAR `items` cuando
 * `sincronizarSesion` adopta una sesión (por ejemplo, tras un F5, que
 * recrea este módulo desde cero con `items: []`), y para guardar cada
 * cambio posterior — ver el `subscribe` al final del archivo.
 *
 * Identidad de línea — Fase de personalización estructurada
 * ------------------------------------------------------------
 * Una línea YA NO se identifica solo por `idProducto`: dos variantes del
 * mismo producto con distinta personalización (ingredientes quitados y/o
 * "otra indicación") son líneas independientes. La identidad real es
 * `item.lineKey` (ver cartLineKey.js), derivada de `idProducto` +
 * ingredientes quitados (ordenados) + indicación normalizada. Todas las
 * acciones que operan sobre "una línea" (incrementar, decrementar,
 * eliminar, editar) reciben `lineKey`, NUNCA `idProducto` — usar
 * `idProducto` para eso volvería a fusionar variantes que deben quedar
 * separadas.
 *
 * `lineKey` se recalcula cada vez que cambia la personalización de una
 * línea (`editarPersonalizacion`): si la nueva clave coincide con la de
 * otra línea ya existente, ambas se fusionan sumando `cantidad` — nunca
 * quedan dos filas con la misma identidad.
 *
 * El carrito PUEDE contener productos de distintas `idAreaProducto` — es
 * intencional: la separación por área ocurre recién en el checkout
 * (Fase 2B). Por eso cada línea conserva `idAreaProducto`, aunque no se
 * muestre al cliente.
 *
 * Aislamiento por SESIÓN, no solo por mesa: la identidad real de una
 * "visita" del cliente la define el backend con `session.token`, no el
 * número de mesa. Dos tokens distintos sobre la misma mesa son dos visitas
 * distintas (la sesión anterior se cerró y se abrió una nueva) y no deben
 * compartir carrito, aunque `tableId` no haya cambiado — por eso la
 * ownership se guarda como `tableId` + `token` por separado (dos campos,
 * no una key concatenada: evita tener que volver a partir un string para
 * persistir, y un token no puede confundirse con parte de un tableId).
 * `sincronizarSesion(tableId, token)` compara ambos campos contra los
 * guardados — si difieren (mesa distinta O mismo mesa con token nuevo),
 * descarta el carrito en memoria y busca en localStorage si hay uno
 * persistido para la sesión NUEVA (mismo tableId + token exactos); si no
 * hay nada persistido, arranca vacío. `estado` (ocupada/cuenta_solicitada)
 * deliberadamente NO forma parte de la identidad: un cambio de estado
 * sobre la misma sesión no es una sesión nueva, y el carrito debe
 * sobrevivirlo (incluida `cuenta_solicitada`, que bloquea NUEVOS pedidos
 * pero no vacía lo que ya había).
 */

/** Entero >= 1. Storage corrupto (string rara, negativo, NaN) cae a 1 en vez de romper la UI. */
function coerceCantidad(valor) {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero >= 1 ? Math.floor(numero) : 1
}

/** Filtra cualquier entrada de `ingredientesQuitados` que no tenga al menos un `id` numérico. */
function coerceIngredientesQuitados(valor) {
  if (!Array.isArray(valor)) return []
  return valor
    .filter((ingrediente) => ingrediente && typeof ingrediente.id === 'number')
    .map((ingrediente) => ({
      id: ingrediente.id,
      nombre: typeof ingrediente.nombre === 'string' ? ingrediente.nombre : '',
    }))
}

/**
 * Normaliza UNA línea cruda (de storage, propia o legacy) al shape actual,
 * recalculando siempre `lineKey` — nunca se confía en un `lineKey` ya
 * persistido, para no arrastrar una identidad calculada con una versión
 * anterior de `buildLineKey`.
 *
 * Compatibilidad con storage legacy
 * -----------------------------------
 * Antes de esta fase, una línea tenía `observacion` (string libre) en vez
 * de `ingredientesQuitados`/`otraIndicacion`. Si `ingredientesQuitados` no
 * viene en la línea cruda (shape viejo) pero SÍ había `observacion`, ese
 * texto se conserva TAL CUAL como `otraIndicacion` — nunca se intenta
 * parsear ("sin cebolla" no se traduce a un ingrediente quitado real,
 * porque no hay forma confiable de mapear texto libre a un id de
 * ingrediente sin arriesgar interpretar mal la instrucción del cliente).
 * La instrucción original queda preservada, solo que ahora vive en el
 * campo "otra indicación" en vez de en un campo `observacion` que ya no
 * existe.
 *
 * Devuelve `null` si la línea cruda no tiene ni siquiera un `idProducto`
 * numérico válido — storage corrupto se descarta línea por línea, nunca
 * rompe el resto del carrito.
 */
function normalizarItem(itemCrudo) {
  if (!itemCrudo || typeof itemCrudo !== 'object') return null

  const idProducto = Number(itemCrudo.idProducto)
  if (!Number.isFinite(idProducto)) return null

  const ingredientesQuitados = coerceIngredientesQuitados(itemCrudo.ingredientesQuitados)

  const otraIndicacion =
    typeof itemCrudo.otraIndicacion === 'string'
      ? itemCrudo.otraIndicacion.trim()
      : typeof itemCrudo.observacion === 'string' // legacy
        ? itemCrudo.observacion.trim()
        : ''

  return {
    idProducto,
    nombreProducto: typeof itemCrudo.nombreProducto === 'string' ? itemCrudo.nombreProducto : '',
    precio: Number(itemCrudo.precio) || 0,
    urlImagen: itemCrudo.urlImagen ?? null,
    idAreaProducto: itemCrudo.idAreaProducto,
    cantidad: coerceCantidad(itemCrudo.cantidad),
    ingredientesQuitados,
    otraIndicacion,
    lineKey: buildLineKey({ idProducto, ingredientesQuitados, otraIndicacion }),
  }
}

/**
 * Normaliza TODAS las líneas persistidas y fusiona por `lineKey` (sumando
 * `cantidad`) cualquier colisión resultante. En la práctica esto solo
 * puede pasar con storage corrupto o con una fusión que un bug futuro deje
 * a medio hacer — el store en uso normal nunca deja dos líneas con la
 * misma identidad, pero rehidratar no debe confiar en eso.
 */
function migrarItems(itemsCrudos) {
  if (!Array.isArray(itemsCrudos)) return []

  const porKey = new Map()
  for (const crudo of itemsCrudos) {
    let item
    try {
      item = normalizarItem(crudo)
    } catch {
      item = null
    }
    if (!item) continue

    const existente = porKey.get(item.lineKey)
    if (existente) {
      existente.cantidad += item.cantidad
    } else {
      porKey.set(item.lineKey, item)
    }
  }
  return [...porKey.values()]
}

const useCarrito = create((set, get) => ({
  tableId: null,
  token: null,
  items: [],

  /**
   * Garantiza que el carrito pertenece a la sesión (tableId + token)
   * actual. Se llama desde ClientLayout solo cuando useTableSession ya
   * resolvió una sesión real — nunca con un token undefined/null/'' — para
   * no fijar una identidad incompleta antes de que el backend responda.
   *
   * Si la sesión dueña actual es distinta, intenta REHIDRATAR desde
   * localStorage el carrito de la sesión nueva (mismo tableId + token
   * exactos) en vez de vaciar directo — así un F5 sobre la misma visita no
   * pierde lo que ya había. Si no hay nada persistido para esa sesión
   * exacta (mesa distinta, token nuevo, o simplemente nunca se guardó
   * nada), arranca en `[]`; nunca migra items de la sesión anterior.
   *
   * `migrarItems` corre siempre sobre lo leído de storage — tanto para
   * convertir líneas legacy (`observacion` suelto) al shape nuevo, como
   * para recalcular `lineKey` de líneas ya persistidas en el shape actual.
   */
  sincronizarSesion: (tableId, token) => {
    const actual = get()
    if (actual.tableId === tableId && actual.token === token) return

    const itemsPersistidos = readCart(tableId, token)
    set({ tableId, token, items: migrarItems(itemsPersistidos ?? []) })
  },

  /**
   * Agrega un producto del menú (shape crudo de GET /menu: `producto.id`,
   * `producto.nombre`, ...), con una personalización opcional.
   *
   * `personalizacion` es `{ ingredientesQuitados?: [{id,nombre}],
   * otraIndicacion?: string }` — el "Agregar" rápido del menú lo omite por
   * completo (equivale a `{}`, personalización vacía). Se calcula la
   * `lineKey` resultante y, si YA existe una línea con esa identidad
   * exacta, se incrementa su `cantidad`; si no, se crea una línea nueva.
   * Una personalización vacía SIEMPRE cae en la misma línea "sin
   * personalización" del producto — no hace falta un caso especial: la
   * `lineKey` de `{ingredientesQuitados: [], otraIndicacion: ''}` es
   * idéntica sea que venga de "Agregar" o de "Personalizar" con el diálogo
   * vacío.
   *
   * `producto.id` se traduce a `idProducto` ACÁ — es el único lugar donde
   * ocurre esa traducción, para no confundir ambos nombres en el resto de
   * la app (el id del menú es `id`; el id que le importa al pedido es
   * `idProducto`).
   */
  agregarItem: (producto, personalizacion = {}) => {
    const ingredientesQuitados = personalizacion.ingredientesQuitados ?? []
    const otraIndicacion = (personalizacion.otraIndicacion ?? '').trim()
    const lineKey = buildLineKey({ idProducto: producto.id, ingredientesQuitados, otraIndicacion })

    const { items } = get()
    const existente = items.find((item) => item.lineKey === lineKey)

    if (existente) {
      set({
        items: items.map((item) =>
          item.lineKey === lineKey ? { ...item, cantidad: item.cantidad + 1 } : item,
        ),
      })
      return
    }

    set({
      items: [
        ...items,
        {
          idProducto: producto.id,
          nombreProducto: producto.nombre,
          precio: producto.precio,
          urlImagen: producto.urlImagen,
          idAreaProducto: producto.idAreaProducto,
          cantidad: 1,
          ingredientesQuitados,
          otraIndicacion,
          lineKey,
        },
      ],
    })
  },

  /** Sin máximo declarado por backend; siempre +1 entero. Identifica la línea por `lineKey`, no por `idProducto`. */
  incrementarCantidad: (lineKey) => {
    set({
      items: get().items.map((item) =>
        item.lineKey === lineKey ? { ...item, cantidad: item.cantidad + 1 } : item,
      ),
    })
  },

  /** Cantidad mínima 1 — no baja de ahí; para eso está eliminarItem. Identifica la línea por `lineKey`. */
  decrementarCantidad: (lineKey) => {
    const { items } = get()
    const item = items.find((i) => i.lineKey === lineKey)
    if (!item || item.cantidad <= 1) return
    set({
      items: items.map((i) => (i.lineKey === lineKey ? { ...i, cantidad: i.cantidad - 1 } : i)),
    })
  },

  /**
   * Identifica la línea por `lineKey`, no por `idProducto` — crítico para
   * useCheckout: tras un POST exitoso, borrar SOLO la variante que se
   * confirmó, sin arrastrarse otra variante del mismo producto que haya
   * quedado pendiente en un grupo distinto o en un reintento posterior.
   */
  eliminarItem: (lineKey) => {
    set({ items: get().items.filter((item) => item.lineKey !== lineKey) })
  },

  /**
   * Edita la personalización de una línea existente (desde el diálogo
   * reutilizable, abierto desde Carrito). Recalcula `lineKey` con los
   * nuevos valores:
   *
   *   - Si la nueva clave es IGUAL a la actual (el cliente reabrió el
   *     diálogo y no cambió nada que afecte la identidad), solo se
   *     actualizan los campos in place.
   *   - Si la nueva clave coincide con la de OTRA línea ya existente
   *     (la edición hizo que esta variante pase a ser equivalente a otra),
   *     se fusionan: la cantidad de la línea editada se suma a la línea
   *     colisionada, y la línea editada desaparece — nunca quedan dos
   *     filas con la misma identidad.
   *   - Si no colisiona con nada, la línea simplemente cambia de
   *     `lineKey` y conserva su `cantidad` tal cual.
   *
   * En ningún caso se tocan otras líneas del mismo `idProducto` que no
   * sean exactamente la editada o la colisionada.
   */
  editarPersonalizacion: (lineKey, personalizacion = {}) => {
    const { items } = get()
    const item = items.find((i) => i.lineKey === lineKey)
    if (!item) return

    const ingredientesQuitados = personalizacion.ingredientesQuitados ?? []
    const otraIndicacion = (personalizacion.otraIndicacion ?? '').trim()
    const nuevaKey = buildLineKey({ idProducto: item.idProducto, ingredientesQuitados, otraIndicacion })

    if (nuevaKey === lineKey) {
      set({
        items: items.map((i) => (i.lineKey === lineKey ? { ...i, ingredientesQuitados, otraIndicacion } : i)),
      })
      return
    }

    const colision = items.find((i) => i.lineKey === nuevaKey)

    if (colision) {
      set({
        items: items
          .filter((i) => i.lineKey !== lineKey)
          .map((i) => (i.lineKey === nuevaKey ? { ...i, cantidad: i.cantidad + item.cantidad } : i)),
      })
      return
    }

    set({
      items: items.map((i) =>
        i.lineKey === lineKey ? { ...i, ingredientesQuitados, otraIndicacion, lineKey: nuevaKey } : i,
      ),
    })
  },

  vaciarCarrito: () => set({ items: [] }),
}))

/**
 * Persiste `items` en localStorage con CADA cambio, para la sesión que
 * esté activa en ese momento (`tableId` + `token` del propio estado) —
 * incluye vaciarCarrito (persiste `[]`, no debe quedar reapareciendo una
 * copia vieja) y las bajas línea por línea que hace useCheckout tras cada
 * grupo confirmado del checkout multiárea (cada `eliminarItem` dispara
 * este mismo `set`, así que un éxito parcial persiste exactamente los
 * items que quedan pendientes, sin tocar useCheckout.js para lograrlo).
 *
 * Se ignora cualquier cambio mientras `tableId`/`token` todavía son `null`
 * (antes de que ClientLayout llame a `sincronizarSesion` con una sesión
 * real) — persistir ahí no tendría dueño válido.
 *
 * `saveCart` es best-effort (ver clientCartStorage.js): si falla, el
 * carrito en memoria no se entera ni se ve afectado, solo no queda
 * guardado para un F5 futuro.
 */
useCarrito.subscribe((state, previousState) => {
  if (state.items === previousState.items) return
  if (state.tableId == null || !state.token) return

  saveCart(state.tableId, state.token, state.items)
})

/** Suma de unidades de todas las líneas — Silpancho x2 + Coca Cola x1 → 3. */
export const getCantidadTotalCarrito = (items) =>
  items.reduce((total, item) => total + item.cantidad, 0)

/**
 * Subtotal ESTIMADO sumando precio del menú * cantidad. Es solo para UX del
 * carrito local: el backend vuelve a leer Producto.precio al crear el
 * pedido y ese es el precio real — este número nunca debe tratarse como
 * fuente de verdad ni enviarse como "precio garantizado".
 */
export const getSubtotalCarrito = (items) =>
  items.reduce((total, item) => total + item.precio * item.cantidad, 0)

export default useCarrito
