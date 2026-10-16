import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { CircleMinus, MessageSquareText, Minus, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import useCarrito, { getCantidadTotalCarrito, getSubtotalCarrito } from '../../store/useCarrito';
import { useCheckout } from '../../hooks/useCheckout';
import { useMenu } from '../../hooks/useMenu';
import ProductImage from '../../components/client/ProductImage';
import ProductPersonalizationDialog from '../../components/client/ProductPersonalizationDialog';
import EmptyState from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../../components/ui/dialog';
import { formatCurrency } from '../../utils';

/**
 * Resumen legible de la personalización de una línea — mismo formato
 * conceptual que termina viendo Cocina/Bebidas en el KDS (ver
 * buildObservacion en useCreateOrder.js), pero acá es solo UI: no se
 * arma ningún string, se lee directo de `ingredientesQuitados`/
 * `otraIndicacion`.
 */
function PersonalizacionResumen({ item }) {
  const tieneQuitados = item.ingredientesQuitados?.length > 0;
  const nota = item.otraIndicacion?.trim();

  if (!tieneQuitados && !nota) {
    return <p className="text-xs text-muted-foreground">Sin personalización</p>;
  }

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {tieneQuitados && (
        <p className="flex items-start gap-1.5">
          <CircleMinus className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Sin: {item.ingredientesQuitados.map((ingrediente) => ingrediente.nombre).join(', ')}</span>
        </p>
      )}
      {nota && (
        <p className="flex items-start gap-1.5">
          <MessageSquareText className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Nota: {nota}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Una línea del carrito. Cantidad con [-]/[+] (mínimo 1: "-" se deshabilita
 * en 1, para bajar de ahí está el botón Eliminar), resumen de
 * personalización de solo lectura, y "Editar" que abre el mismo diálogo
 * reutilizable que Menú (ver CartPage, que lo instancia una sola vez a
 * nivel de página).
 *
 * TODAS las acciones de esta fila (+, -, Eliminar, Editar) identifican la
 * línea por `item.lineKey`, NUNCA por `item.idProducto` — dos variantes
 * del mismo producto son líneas independientes y tienen que poder
 * modificarse sin afectarse entre sí (ver useCarrito.js).
 *
 * `disabled` llega desde CartPage mientras el checkout está corriendo: la
 * secuencia trabaja sobre un snapshot tomado al pulsar enviar, así que
 * editar el carrito en el medio haría que lo que se ve deje de coincidir
 * con lo que se está enviando.
 */
function CartItemRow({ item, disabled, onEdit }) {
  const incrementarCantidad = useCarrito((state) => state.incrementarCantidad);
  const decrementarCantidad = useCarrito((state) => state.decrementarCantidad);
  const eliminarItem = useCarrito((state) => state.eliminarItem);

  const subtotalLinea = item.precio * item.cantidad;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex gap-3">
        <ProductImage urlImagen={item.urlImagen} nombreProducto={item.nombreProducto} className="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-snug text-foreground">{item.nombreProducto}</p>
            <span className="shrink-0 text-base font-bold text-foreground">{formatCurrency(subtotalLinea)}</span>
          </div>
          <p className="text-xs text-muted-foreground">{formatCurrency(item.precio)} c/u</p>
        </div>
      </div>

      <PersonalizacionResumen item={item} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => decrementarCantidad(item.lineKey)}
            disabled={disabled || item.cantidad <= 1}
            aria-label="Restar unidad"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="w-6 text-center text-sm font-semibold text-foreground">{item.cantidad}</span>
          <button
            type="button"
            onClick={() => incrementarCantidad(item.lineKey)}
            disabled={disabled}
            aria-label="Sumar unidad"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
            disabled={disabled}
            onClick={() => onEdit(item)}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={disabled}
            onClick={() => eliminarItem(item.lineKey)}
            aria-label="Eliminar producto"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pedidos efectivamente creados en este intento.
 *
 * Se muestra `nroOrden`, no `idPedido`: el correlativo visible de la sesión
 * es lo que el cliente puede decirle al mozo. `idPedido` sí se usa, pero
 * solo puertas adentro, como parte de la URL de "Ver pedido"
 * (/order/:orderId) — es lo que identifica al pedido en el storage local.
 *
 * "Ver pedido" se omite para los pedidos en `storageFailedIds`: si
 * `saveClientOrder` falló para ese pedido, /order/:orderId no va a poder
 * encontrarlo (es la única copia local que existe) — no tiene sentido
 * ofrecer un link que no puede cumplir su promesa.
 */
function PedidosCreados({ pedidos, tableId, huboFallo, storageFailedIds }) {
  const titulo = huboFallo
    ? 'Parte del pedido fue enviada.'
    : pedidos.length === 1
      ? 'Pedido enviado correctamente.'
      : `Se registraron ${pedidos.length} pedidos para preparar tus productos.`;

  return (
    <div className="mx-4 rounded-xl border border-success/30 bg-success/10 p-4" role="status">
      <p className="text-sm font-semibold text-success-foreground">{titulo}</p>
      <ul className="mt-2 space-y-1">
        {pedidos.map((pedido) => (
          <li key={pedido.idPedido} className="flex items-center justify-between gap-3 text-sm text-success-foreground">
            <span>Pedido #{pedido.nroOrden} registrado</span>
            {!storageFailedIds.includes(pedido.idPedido) && (
              <Link
                to={`/menu/${tableId}/order/${pedido.idPedido}`}
                className="text-xs font-semibold underline hover:opacity-80"
              >
                Ver pedido
              </Link>
            )}
          </li>
        ))}
      </ul>
      {!huboFallo && (
        <Button asChild className="mt-3 h-10">
          <Link to={`/menu/${tableId}`}>Volver al menú</Link>
        </Button>
      )}
    </div>
  );
}

/**
 * Rechazo CONFIRMADO por el servidor (4xx): el pedido de ese grupo no se
 * creó y sus productos siguen intactos en el carrito.
 *
 * El 401 lleva un texto propio y explícito — "no fue enviado" — porque es
 * la única forma de que el cliente entienda qué pasó sin que la app intente
 * recuperarse sola (no se reabre la sesión de mesa ni se refetchea nada:
 * eso podría abrir una sesión nueva si Caja ya cerró la anterior). El
 * mensaje del backend se muestra igual, como detalle secundario. Para el
 * resto de los códigos el mensaje del backend ES el texto principal: ya
 * viene redactado para el caso concreto (producto no disponible, DTO
 * inválido, mesa que no acepta más pedidos).
 */
function PedidoRechazado({ failure, huboExitoPrevio }) {
  const esSesionInvalida = failure.status === 401;

  return (
    <div className="mx-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">
      <p className="text-sm font-semibold text-destructive">
        {huboExitoPrevio ? 'El resto del pedido no pudo enviarse.' : 'El pedido no pudo enviarse.'}
      </p>

      {esSesionInvalida ? (
        <>
          <p className="mt-1 text-sm text-destructive">
            La sesión de esta mesa ya no está activa. El pedido no fue enviado.
          </p>
          {failure.message && <p className="mt-1 text-xs text-destructive">{failure.message}</p>}
          <p className="mt-2 text-xs text-destructive">Pedile ayuda a un mozo para continuar.</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-destructive">{failure.message || 'El servidor rechazó el pedido.'}</p>
      )}

      {failure.status === 409 && (
        <p className="mt-2 text-xs text-destructive">
          Se actualizó el menú por si algún producto dejó de estar disponible. Revisá tu carrito antes de
          volver a enviar.
        </p>
      )}

      <p className="mt-2 text-xs text-destructive">Tus productos siguen en el carrito.</p>
    </div>
  );
}

/**
 * Resultado INCIERTO: el envío no recibió respuesta (red cortada, 5xx). No
 * se dice "el pedido falló" porque no lo sabemos — el restaurante pudo
 * haberlo recibido.
 *
 * No hay botón de "comprobar pedido": el módulo cliente no tiene ningún
 * endpoint de lectura de pedidos con el que reconciliar, y fingir uno sería
 * peor que no tenerlo. La única salida honesta es consultar al personal.
 *
 * El aviso sobrevive a que la pantalla se desmonte (vive en sessionStorage)
 * y solo se va cuando el usuario lo reconoce explícitamente.
 */
function ResultadoIncierto({ bloqueaEnvio, onReconocer }) {
  return (
    <div className="mx-4 rounded-xl border-2 border-warning/40 bg-warning/10 p-4" role="alert">
      <p className="text-sm font-bold text-warning-foreground">No se pudo confirmar el resultado del último envío.</p>
      <p className="mt-2 text-sm text-warning-foreground">
        Es posible que este pedido haya sido recibido por el restaurante. No lo vuelvas a enviar para evitar
        duplicados.
      </p>
      <p className="mt-2 text-sm font-semibold text-warning-foreground">Consultá al personal antes de intentar nuevamente.</p>

      {bloqueaEnvio && (
        <p className="mt-2 text-xs text-warning-foreground">
          El envío queda bloqueado para estos productos hasta que confirmes que ya consultaste.
        </p>
      )}

      <Button variant="outline" size="sm" className="mt-3 h-9" onClick={onReconocer}>
        Ya consulté al personal
      </Button>
    </div>
  );
}

/**
 * Carrito del cliente y checkout real (Fase 2B). La sesión de mesa ya está
 * garantizada por ClientLayout — `tableId` y `session` llegan por Outlet
 * context, sin volver a validarlos acá.
 *
 * El carrito puede tener productos de varias áreas; el checkout los separa
 * en un POST /pedidos por área y los envía de a uno (ver useCheckout). Toda
 * la confirmación del resultado vive en ESTA pantalla: no se navega
 * automáticamente a /order/:orderId, porque un checkout multiárea produce
 * varios pedidos y esa ruta singular no los representa.
 *
 * El subtotal sigue siendo explícitamente ESTIMADO: el backend vuelve a
 * leer el precio real de cada producto al crear el pedido. Tampoco se
 * muestra un "total de la mesa" — el cliente no tiene endpoint para eso.
 *
 * El resumen (unidades/subtotal) + CTA de enviar quedan en una barra
 * `sticky bottom-0`: al ser sticky (no fixed) sigue ocupando su lugar en
 * el flujo del documento, así que nunca tapa el último ítem de la lista —
 * solo se mantiene anclada al fondo del viewport mientras hay contenido
 * de sobra para scrollear (carritos largos), y con pocos ítems simplemente
 * queda justo debajo de ellos, sin espacio muerto raro.
 */
export default function CartPage() {
  const { tableId, session } = useOutletContext();
  const items = useCarrito((state) => state.items);
  const vaciarCarrito = useCarrito((state) => state.vaciarCarrito);
  const editarPersonalizacion = useCarrito((state) => state.editarPersonalizacion);
  const [confirmVaciarOpen, setConfirmVaciarOpen] = useState(false);
  const [nombreComensal, setNombreComensal] = useState('');
  const [editingLineKey, setEditingLineKey] = useState(null);

  const {
    isSubmitting,
    createdOrders,
    failure,
    storageFailedIds,
    ambiguous,
    enviarPedido,
    reconocerResultadoIncierto,
  } = useCheckout({ tableId, token: session.token });

  // Solo para resolver `producto.ingredientes` al editar una línea (ver
  // `ingredientesDisponiblesParaEdicion` más abajo) — misma query/cache que
  // ya usa MenuPage (`MENU_KEY`), sin duplicar el request.
  const { data: categorias } = useMenu();
  const productosDelMenuPorId = useMemo(() => {
    const mapa = new Map();
    (categorias ?? []).forEach((categoria) => {
      (categoria.productos ?? []).forEach((producto) => mapa.set(producto.id, producto));
    });
    return mapa;
  }, [categorias]);

  const editingItem = items.find((item) => item.lineKey === editingLineKey) ?? null;

  // Unión del catálogo ACTUAL de ingredientes del producto (si el menú ya
  // cargó) + lo que la línea ya tenía tildado — así, si un ingrediente fue
  // dado de baja en el catálogo después de que el cliente lo eligió, el
  // checkbox sigue apareciendo (tildado) en vez de desaparecer en
  // silencio y perder esa parte de la personalización.
  const ingredientesDisponiblesParaEdicion = useMemo(() => {
    if (!editingItem) return [];
    const catalogo = productosDelMenuPorId.get(editingItem.idProducto)?.ingredientes ?? [];
    const idsDelCatalogo = new Set(catalogo.map((ingrediente) => ingrediente.id));
    const faltantes = editingItem.ingredientesQuitados.filter((ingrediente) => !idsDelCatalogo.has(ingrediente.id));
    return [...catalogo, ...faltantes];
  }, [editingItem, productosDelMenuPorId]);

  const handleConfirmEdicion = (personalizacion) => {
    editarPersonalizacion(editingLineKey, personalizacion);
    setEditingLineKey(null);
  };

  const cantidadTotal = getCantidadTotalCarrito(items);
  const subtotalEstimado = getSubtotalCarrito(items);
  const isEmpty = items.length === 0;

  const cuentaSolicitada = session.estado === 'cuenta_solicitada';

  // El bloqueo por resultado incierto aplica a las MISMAS líneas/variantes
  // del grupo que quedó sin confirmar (identificadas por `lineKey`, no por
  // `idProducto`: dos variantes del mismo producto no deben bloquearse
  // entre sí) — si siguen en el carrito, reenviarlas es exactamente el
  // riesgo de duplicado que se quiere evitar. Si el usuario ya las sacó, el
  // aviso se sigue mostrando pero no bloquea un carrito que ya es otro.
  const bloqueadoPorResultadoIncierto =
    !!ambiguous && items.some((item) => ambiguous.itemIds.includes(item.lineKey));

  const puedeEnviar = !isEmpty && !cuentaSolicitada && !isSubmitting && !bloqueadoPorResultadoIncierto;

  // Tras un éxito total el carrito queda vacío por consecuencia (cada grupo
  // borró lo suyo). En ese caso no corresponde el estado vacío genérico: lo
  // que hay que ver es la confirmación de los pedidos creados.
  const mostrarCarritoVacio = isEmpty && createdOrders.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-bold text-foreground">Carrito</h1>
        <p className="text-sm text-muted-foreground">Mesa {session.nombreMesa}</p>
      </div>

      {ambiguous && (
        <ResultadoIncierto
          bloqueaEnvio={bloqueadoPorResultadoIncierto}
          onReconocer={reconocerResultadoIncierto}
        />
      )}

      {createdOrders.length > 0 && (
        <PedidosCreados
          pedidos={createdOrders}
          tableId={tableId}
          huboFallo={!!failure}
          storageFailedIds={storageFailedIds}
        />
      )}

      {storageFailedIds.length > 0 && (
        <p className="mx-4 text-xs text-muted-foreground">
          El pedido fue registrado, pero no pudo guardarse localmente para consultarlo después.
        </p>
      )}

      {failure?.kind === 'rechazado' && (
        <PedidoRechazado failure={failure} huboExitoPrevio={createdOrders.length > 0} />
      )}

      {mostrarCarritoVacio ? (
        <div className="px-4 py-8">
          <EmptyState icon={<ShoppingCart />} title="Tu carrito está vacío.">
            <Button asChild className="h-10">
              <Link to={`/menu/${tableId}`}>Ver menú</Link>
            </Button>
          </EmptyState>
        </div>
      ) : (
        !isEmpty && (
          <>
            <div className="flex flex-col gap-3 px-4">
              {items.map((item) => (
                <CartItemRow
                  key={item.lineKey}
                  item={item}
                  disabled={isSubmitting}
                  onEdit={(itemAEditar) => setEditingLineKey(itemAEditar.lineKey)}
                />
              ))}
            </div>

            {!cuentaSolicitada && (
              <div className="mx-4 space-y-1">
                <label htmlFor="nombre-comensal" className="text-xs font-medium text-muted-foreground">
                  Nombre del comensal (opcional)
                </label>
                <Input
                  id="nombre-comensal"
                  placeholder="Ej: Juan"
                  value={nombreComensal}
                  disabled={isSubmitting}
                  onChange={(event) => setNombreComensal(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Sirve para que el mozo sepa de quién es el pedido.</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 px-4">
              {isSubmitting ? (
                <span className="text-sm font-medium text-muted-foreground">← Seguir viendo el menú</span>
              ) : (
                <Link to={`/menu/${tableId}`} className="text-sm font-medium text-primary hover:underline">
                  ← Seguir viendo el menú
                </Link>
              )}
              <button
                type="button"
                onClick={() => setConfirmVaciarOpen(true)}
                disabled={isSubmitting}
                className="text-xs font-medium text-destructive hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
              >
                Vaciar carrito
              </button>
            </div>

            <div className="sticky bottom-0 z-10 border-t border-border bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_-4px_rgb(35_20_10_/_0.08)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  {cantidadTotal} {cantidadTotal === 1 ? 'unidad' : 'unidades'}
                </span>
                <span className="text-lg font-bold text-foreground">{formatCurrency(subtotalEstimado)}</span>
              </div>

              {cuentaSolicitada ? (
                <p
                  className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-center text-sm font-medium text-warning-foreground"
                  role="alert"
                >
                  La cuenta ya fue solicitada y no se pueden realizar pedidos nuevos.
                </p>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="h-11 w-full"
                    disabled={!puedeEnviar}
                    onClick={() => enviarPedido({ nombreComensal })}
                  >
                    {isSubmitting ? 'Enviando pedido...' : 'Enviar pedido'}
                  </Button>
                  <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                    El precio final se confirma al enviar el pedido.
                  </p>
                </>
              )}
            </div>

            <Dialog open={confirmVaciarOpen} onOpenChange={setConfirmVaciarOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>¿Vaciar el carrito?</DialogTitle>
                  <DialogDescription>
                    Se van a eliminar los {cantidadTotal} productos que agregaste. Esta acción no se puede
                    deshacer.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="h-10">
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    className="h-10"
                    onClick={() => {
                      vaciarCarrito();
                      setConfirmVaciarOpen(false);
                    }}
                  >
                    Vaciar carrito
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <ProductPersonalizationDialog
              key={editingLineKey ?? 'none'}
              open={!!editingItem}
              nombreProducto={editingItem?.nombreProducto}
              ingredientesDisponibles={ingredientesDisponiblesParaEdicion}
              valorInicial={
                editingItem
                  ? {
                      ingredientesQuitados: editingItem.ingredientesQuitados,
                      otraIndicacion: editingItem.otraIndicacion,
                    }
                  : undefined
              }
              confirmLabel="Guardar cambios"
              onOpenChange={(next) => !next && setEditingLineKey(null)}
              onConfirm={handleConfirmEdicion}
            />
          </>
        )
      )}
    </div>
  );
}
