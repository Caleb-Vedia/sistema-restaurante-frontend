import { Link, useOutletContext, useParams } from 'react-router-dom';
import { CheckCircle2, ChefHat, Clock, CircleMinus, MessageSquareText, SearchX, XCircle } from 'lucide-react';
import EmptyState from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDateTime } from '../../utils';
import { getClientOrder } from '../../utils/clientOrderStorage';
import { useOrderTracking, sigueEnSeguimiento } from '../../hooks/useOrderTracking';
import { isAmbiguousError } from '../../hooks/useCreateOrder';

/**
 * El backend puede devolver estos tres valores en `estado`. `listo` es
 * terminal: una vez ahí, `useOrderTracking` deja de consultar (ver ese
 * hook y `sigueEnSeguimiento`).
 *
 * Mapeo de color: pendiente → warning, preparación → info, listo →
 * success (tokens de la fundación visual, Fix 1/2 — nunca colores sueltos).
 * `ESTADO_ORDEN`/`ESTADO_META` alimentan el stepper de abajo: son 3
 * posiciones REALES, nunca un progreso interpolado o inventado — si
 * `pedido.estado` no es ninguna de las tres (no debería pasar, pero el
 * badge de abajo igual tiene su propio fallback), el stepper simplemente
 * no se renderiza en vez de mostrar algo incorrecto.
 */
const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  preparacion: 'En preparación',
  listo: 'Listo',
};

const ESTADO_STYLES = {
  pendiente: 'border-warning/30 bg-warning/15 text-warning-foreground',
  preparacion: 'border-info/30 bg-info/15 text-info-foreground',
  listo: 'border-success/30 bg-success/15 text-success-foreground',
};

const ESTADO_ORDEN = ['pendiente', 'preparacion', 'listo'];

const ESTADO_ICONS = {
  pendiente: Clock,
  preparacion: ChefHat,
  listo: CheckCircle2,
};

/** Clases completas (nunca fragmentos armados en runtime, para que Tailwind las detecte al compilar). */
const TONE_CLASSES = {
  pendiente: { circle: 'border-warning bg-warning/15 text-warning-foreground', ring: 'ring-warning/20', line: 'bg-warning/50' },
  preparacion: { circle: 'border-info bg-info/15 text-info-foreground', ring: 'ring-info/20', line: 'bg-info/50' },
  listo: { circle: 'border-success bg-success/15 text-success-foreground', ring: 'ring-success/20', line: 'bg-success/50' },
};

/**
 * Stepper "Pendiente → En preparación → Listo": el estado ACTUAL es el
 * protagonista (círculo más marcado, con halo). Los pasos ya alcanzados
 * quedan iluminados en su propio color (no se apagan a gris), los que
 * todavía no llegan quedan neutros. Nunca interpola nada entre pasos —
 * solo 3 posiciones discretas que existen de verdad en el contrato.
 */
function EstadoStepper({ estado }) {
  const currentIndex = ESTADO_ORDEN.indexOf(estado);
  if (currentIndex === -1) return null;

  return (
    <div className="flex items-start" role="list" aria-label="Progreso del pedido">
      {ESTADO_ORDEN.map((paso, index) => {
        const Icon = ESTADO_ICONS[paso];
        const tone = TONE_CLASSES[paso];
        const alcanzado = index <= currentIndex;
        const esActual = index === currentIndex;

        return (
          <div key={paso} className="flex flex-1 items-start last:flex-none" role="listitem">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                  alcanzado ? tone.circle : 'border-border bg-muted text-muted-foreground'
                } ${esActual ? `ring-4 ${tone.ring}` : ''}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span
                className={`w-16 text-center text-[11px] font-medium leading-tight ${
                  alcanzado ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {ESTADO_LABELS[paso]}
              </span>
            </div>
            {index < ESTADO_ORDEN.length - 1 && (
              <span
                className={`mx-1 mt-5 h-0.5 flex-1 rounded-full ${index < currentIndex ? tone.line : 'bg-border'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * `detalle.observacion` ya viene armado como `"Sin: ...\nNota: ..."` (ver
 * buildObservacion en useCreateOrder.js) — acá solo se muestra, respetando
 * los saltos de línea existentes y con un ícono por línea reconocida,
 * mismo lenguaje visual que el carrito y Mis pedidos.
 */
function ObservacionTexto({ texto }) {
  return (
    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {texto.split('\n').map((linea, index) => {
        const Icon = linea.startsWith('Sin:') ? CircleMinus : linea.startsWith('Nota:') ? MessageSquareText : null;
        return (
          <p key={index} className="flex items-start gap-1.5">
            {Icon && <Icon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />}
            <span>{linea}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Una línea de `pedido.detalles`. `precioActual` ya es el precio CONFIRMADO por el backend, no un estimado. */
function DetalleRow({ detalle }) {
  const subtotal = detalle.cantidad * detalle.precioActual;

  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{detalle.nombreProducto}</p>
        <span className="whitespace-nowrap text-sm font-bold text-foreground">{formatCurrency(subtotal)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {detalle.cantidad} × {formatCurrency(detalle.precioActual)}
      </p>
      {detalle.observacion && <ObservacionTexto texto={detalle.observacion} />}
    </div>
  );
}

/**
 * Detalle de UN pedido — Fase 5: tracking real vía GET /pedidos/:id.
 *
 * El módulo cliente SÍ tiene ahora una lectura de pedido: `useOrderTracking`
 * consulta `GET /pedidos/:id` con polling mientras el estado sigue en
 * curso (`pendiente`/`preparacion`), y se detiene solo al llegar a `listo`
 * o ante un 401/404 confirmado — ver ese hook para el detalle completo de
 * cuándo sigue y cuándo para.
 *
 * El polling permanece discreto a propósito: no hay ningún loader ligado
 * a `tracking.isFetching`. La pantalla siempre tiene algo que mostrar
 * desde el primer render (`tracking.data ?? pedidoLocal`), así que un
 * refetch de fondo nunca reemplaza el contenido por un spinner — solo
 * actualiza los datos en el momento en que resuelve.
 *
 * El snapshot local (`getClientOrder`, guardado por `useCheckout` cuando
 * el POST original respondió 2xx) sigue siendo indispensable como
 * RESPALDO: es lo único que existe antes de que resuelva el primer GET, y
 * sigue siendo lo que se muestra si un fetch posterior falla (red/5xx) —
 * nunca se inventa un estado nuevo sin un response exitoso de por medio.
 * Por eso la fuente que se renderiza es `tracking.data ?? pedidoLocal`:
 * React Query conserva el último `data` exitoso aunque un refetch
 * posterior falle, así que ese fallback ya cubre "conservar el último
 * snapshot conocido" sin lógica propia. Cada GET exitoso también
 * actualiza el snapshot local (`updateClientOrder`, dentro del propio
 * hook), para que sobreviva a un F5 sobre esta misma ruta.
 *
 * Sin snapshot local no hay nada de qué partir: si `getClientOrder` no
 * encuentra el id, se sigue mostrando "Pedido no disponible en este
 * dispositivo" tal como en la fase anterior, y el tracking ni se activa
 * (`enabled` en useOrderTracking).
 *
 * Fuente de la sesión
 * --------------------
 * `tableId` y `session` llegan por Outlet context, ya resueltos por
 * ClientLayout (cache de React Query o sessionStorage — ver ese
 * componente). Esta página NO vuelve a llamar useTableSession ni abre
 * sesión nueva: si `session.token` está vencido, el GET de tracking
 * responde 401 y se muestra tal cual (ver más abajo) — nunca se reabre
 * sesión automáticamente.
 *
 * Aislamiento
 * -----------
 * `getClientOrder`/`updateClientOrder` operan únicamente dentro de los
 * pedidos guardados para tableId + token actuales — mismo criterio que el
 * resto de clientOrderStorage.js.
 */
export default function OrderStatusPage() {
  const { tableId, session } = useOutletContext();
  const { orderId } = useParams();

  const isValidOrderId = /^[1-9]\d*$/.test(String(orderId ?? ''));
  const idPedido = isValidOrderId ? Number(orderId) : null;

  const pedidoLocal = idPedido != null ? getClientOrder(tableId, session.token, idPedido) : null;

  // Se llama siempre (regla de hooks), pero solo queda activo cuando hay
  // un snapshot local del que partir — sin eso no hay nada que trackear.
  const tracking = useOrderTracking({
    tableId,
    idPedido,
    token: session.token,
    enabled: !!pedidoLocal,
  });

  if (!isValidOrderId) {
    return (
      <div className="px-4 py-8">
        <EmptyState icon={<XCircle />} title="Pedido no válido" description="El enlace de este pedido no es correcto." />
      </div>
    );
  }

  if (!pedidoLocal) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={<SearchX />}
          title="Pedido no disponible en este dispositivo"
          description="No encontramos la información guardada de este pedido. El sistema no permite recuperarla nuevamente desde el servidor."
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild className="h-10">
              <Link to={`/menu/${tableId}`}>Volver al menú</Link>
            </Button>
            <Button asChild variant="outline" className="h-10">
              <Link to={`/menu/${tableId}/cart`}>Ver carrito</Link>
            </Button>
          </div>
        </EmptyState>
      </div>
    );
  }

  // React Query conserva `data` del último fetch exitoso aunque uno
  // posterior falle — este fallback alcanza para "mostrar lo último
  // confirmado" sin ningún estado propio. Antes del primer GET (o si
  // nunca llegó a resolver ninguno), cae al snapshot local.
  const pedido = tracking.data ?? pedidoLocal;

  const trackingError = tracking.error;
  const esSesionInvalida = trackingError?.status === 401;
  const esPedidoNoDisponibleParaSesion = trackingError?.status === 404;
  const esErrorTransitorio = !!trackingError && !esSesionInvalida && !esPedidoNoDisponibleParaSesion;

  const enSeguimiento = !esSesionInvalida && !esPedidoNoDisponibleParaSesion && sigueEnSeguimiento(pedido.estado);
  const estaListo = pedido.estado === 'listo';

  const tieneDetalles = pedido.detalles?.length > 0;
  const total = tieneDetalles
    ? pedido.detalles.reduce((acumulado, detalle) => acumulado + detalle.cantidad * detalle.precioActual, 0)
    : 0;

  const estadoLabel = ESTADO_LABELS[pedido.estado] ?? pedido.estado;
  const estadoStyle = ESTADO_STYLES[pedido.estado] ?? 'border-border bg-muted text-muted-foreground';

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="px-4 pt-4">
        <p className="text-sm text-muted-foreground">Pedido registrado</p>
        <h1 className="text-lg font-bold text-foreground">Pedido #{pedido.nroOrden}</h1>
      </div>

      <div
        className={`mx-4 flex flex-col gap-4 rounded-xl border p-4 shadow-sm ${
          estaListo ? 'border-success/40 bg-success/5' : 'border-border bg-card'
        }`}
      >
        <EstadoStepper estado={pedido.estado} />

        <div className="flex flex-col gap-2">
          <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${estadoStyle}`}>
            {estadoLabel}
          </span>

          {estaListo && (
            <p className="text-sm font-semibold text-success-foreground">¡Tu pedido está listo!</p>
          )}

          {enSeguimiento && <p className="text-xs text-muted-foreground">El estado se actualiza automáticamente.</p>}

          {esSesionInvalida && (
            <p className="text-xs text-destructive" role="alert">
              La sesión de esta mesa ya no está activa. No podemos seguir actualizando este pedido — la
              información mostrada es la última disponible.
            </p>
          )}

          {esPedidoNoDisponibleParaSesion && (
            <p className="text-xs text-destructive" role="alert">
              Este pedido ya no está disponible para actualizarse. Seguimos mostrando la última información
              guardada.
            </p>
          )}

          {esErrorTransitorio && (
            <p className="text-xs text-muted-foreground">
              {isAmbiguousError(trackingError)
                ? 'No se pudo actualizar el estado del pedido. Mostrando la última información disponible.'
                : trackingError.message || 'No se pudo actualizar el estado del pedido.'}
            </p>
          )}
        </div>

        {(pedido.nombreComensal || pedido.creadoEl) && (
          <div className="flex flex-col gap-0.5 border-t border-border pt-3 text-sm text-foreground">
            {pedido.nombreComensal && <p>Comensal: {pedido.nombreComensal}</p>}
            {pedido.creadoEl && <p className="text-xs text-muted-foreground">Registrado: {formatDateTime(pedido.creadoEl)}</p>}
          </div>
        )}
      </div>

      <div className="mx-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        {tieneDetalles ? (
          pedido.detalles.map((detalle) => <DetalleRow key={detalle.idDetalle} detalle={detalle} />)
        ) : (
          <p className="text-sm text-muted-foreground">No hay detalles guardados para este pedido.</p>
        )}
      </div>

      {tieneDetalles && (
        <div className="mx-4 flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-sm font-semibold text-muted-foreground">Total de este pedido</span>
          <span className="text-base font-bold text-foreground">{formatCurrency(total)}</span>
        </div>
      )}

      <div className="px-4">
        <Button asChild className="h-10">
          <Link to={`/menu/${tableId}`}>Volver al menú</Link>
        </Button>
      </div>
    </div>
  );
}
