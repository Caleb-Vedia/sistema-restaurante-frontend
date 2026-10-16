import { AlertTriangle, ChevronRight, CircleMinus, ClipboardList, Lock, MessageSquareText } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { useMisPedidos } from '../../hooks/useMisPedidos';
import { readClientOrders } from '../../utils/clientOrderStorage';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatDateTime } from '../../utils';

/**
 * Mismas etiquetas/estilos que OrderStatusPage (tracking individual) —
 * duplicadas acá a propósito, en vez de exportarlas desde ese archivo: son
 * 3 entradas cada una, y tocar OrderStatusPage para extraerlas arriesgaría
 * ese flujo ya probado por una ganancia mínima. Si algún día divergen los
 * estados de pedido, cada pantalla ya tendría su propia copia editable.
 *
 * Mapeo de color: pendiente → warning, preparación → info, listo →
 * success (tokens de la fundación visual, Fix 1/2 — nunca colores sueltos).
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

function EstadoBadge({ estado }) {
  return (
    <Badge variant="outline" className={`shrink-0 ${ESTADO_STYLES[estado] ?? 'border-border bg-muted text-muted-foreground'}`}>
      {ESTADO_LABELS[estado] ?? estado}
    </Badge>
  );
}

/**
 * `detalle.observacion` ya viene armado como `"Sin: ...\nNota: ..."` (ver
 * buildObservacion en useCreateOrder.js) — acá solo se muestra, respetando
 * los saltos de línea existentes (`whitespace-pre-line`, si no el
 * navegador los colapsaría) y con un ícono por línea reconocida, mismo
 * lenguaje visual que el resumen de personalización del carrito.
 */
function ObservacionTexto({ texto }) {
  return (
    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {texto.split('\n').map((linea, index) => {
        const Icon = linea.startsWith('Sin:') ? CircleMinus : linea.startsWith('Nota:') ? MessageSquareText : null;
        return (
          <p key={index} className="flex items-start gap-1.5 whitespace-pre-line">
            {Icon && <Icon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />}
            <span>{linea}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Una tarjeta por pedido: número, estado, líneas con cantidad/observación, y total. */
function PedidoCard({ pedido, tableId }) {
  const detalles = pedido.detalles ?? [];
  const total = detalles.reduce((acumulado, detalle) => acumulado + detalle.cantidad * detalle.precioActual, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Pedido #{pedido.nroOrden}</p>
          {pedido.creadoEl && <p className="text-xs text-muted-foreground">{formatDateTime(pedido.creadoEl)}</p>}
        </div>
        <EstadoBadge estado={pedido.estado} />
      </div>

      {detalles.length > 0 ? (
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {detalles.map((detalle) => (
            <li key={detalle.idDetalle} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-foreground">
                  {detalle.cantidad} × {detalle.nombreProducto}
                </p>
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  {formatCurrency(detalle.cantidad * detalle.precioActual)}
                </span>
              </div>
              {detalle.observacion && <ObservacionTexto texto={detalle.observacion} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Sin detalles guardados.</p>
      )}

      {detalles.length > 0 && (
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="text-xs font-medium text-muted-foreground">Total de este pedido</span>
          <span className="text-sm font-bold text-foreground">{formatCurrency(total)}</span>
        </div>
      )}

      <Link
        to={`/menu/${tableId}/order/${pedido.idPedido}`}
        className="mt-3 flex w-fit items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
      >
        Ver seguimiento detallado <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

/**
 * Mis pedidos: todos los pedidos de la sesión ACTUAL de la mesa —
 * GET /pedidos/mis-pedidos, con polling mientras algo siga en curso (ver
 * useMisPedidos).
 *
 * `tableId`/`session` llegan por Outlet context, ya resueltos por
 * ClientLayout (igual que CartPage/OrderStatusPage): esta pantalla NUNCA
 * llama useTableSession ni POST /mesas/:id/sesion. Si no hubiera sesión
 * disponible (ni cache de React Query ni sessionStorage), ClientLayout ya
 * corta antes de montar esta ruta con el panel "Sesión no disponible" — acá
 * no hace falta reimplementar ese caso.
 *
 * Sigue accesible con `cuenta_solicitada`: esta pantalla no lee
 * `session.estado` en absoluto (a diferencia de RequestBillAction/
 * MenuPage/CartPage) — el backend ya garantiza que la consulta funciona
 * mientras la sesión siga abierta, sin importar el estado de la mesa. El
 * aviso de "cuenta solicitada" ya es visible arriba, en el header
 * compartido de ClientLayout — no se repite acá.
 *
 * `misPedidos.isLoading` (no `isFetching`) es a propósito lo único que
 * dispara el spinner de carga: es `true` solo en el fetch inicial sin data
 * todavía. Los refetches del polling posterior son `isFetching` sin
 * `isLoading`, así que nunca vuelven a mostrar un loader — el polling
 * permanece discreto, tal como ya lo garantizaba este hook antes del
 * rediseño visual.
 *
 * Backend autoritativo, snapshot local SOLO como fallback de error NO-401
 * ---------------------------------------------------------------------
 * `misPedidos.data` es `undefined` hasta el primer fetch exitoso, y
 * React Query conserva el ÚLTIMO `data` exitoso aunque un refetch
 * posterior falle (igual que useOrderTracking/OrderStatusPage) — así que
 * "no hay data todavía" (`data === undefined`) es la señal de "nunca hubo
 * una respuesta válida del backend". Una respuesta real `[]` del backend
 * es un array DEFINIDO: nunca cae en ninguna rama de error, se muestra tal
 * cual como "no hay pedidos" real.
 *
 * PERO `data === undefined` por sí solo NO alcanza para decidir el
 * fallback: un `401` (token inválido o sesión cerrada) es un rechazo
 * CONFIRMADO del servidor, no una duda de red — mostrar el snapshot local
 * ahí haría parecer vigente una lista que pertenece a una sesión que el
 * backend ya no reconoce. Por eso el 401 se resuelve ANTES y aparte, con
 * el mismo patrón que ClientLayout ("Sesión no disponible"): estado
 * explícito, sin snapshot, sin reabrir sesión. El snapshot local solo se
 * consulta para el resto de
 * los errores (red / timeout / 5xx / cualquier error ambiguo), que sí son
 * dudas genuinas sobre si el backend respondería distinto en un rato.
 */
export default function MyOrdersPage() {
  const { tableId, session } = useOutletContext();

  const misPedidos = useMisPedidos({ tableId, token: session.token, enabled: true });

  if (misPedidos.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  // 401 CONFIRMADO por el servidor: la sesión de esta mesa ya no es válida
  // para el backend. Se resuelve ANTES que cualquier lógica de snapshot —
  // un rechazo confirmado nunca debe disfrazarse de "lista vigente" con
  // datos locales, y el polling ya se detuvo solo (ver refetchInterval en
  // useMisPedidos). Mismo patrón que ClientLayout ("Sesión no disponible"):
  // estado explícito, link a volver al menú, NUNCA reabre sesión sola.
  if (misPedidos.error?.status === 401) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={<Lock />}
          title="Sesión no disponible"
          description="La sesión de esta mesa ya no está activa. Para empezar una nueva visita, volvé al menú."
        >
          <Button asChild className="h-10">
            <Link to={`/menu/${tableId}`}>Ir al menú</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  // Nunca hubo un fetch exitoso y NO es un 401 (ya se resolvió arriba): es
  // una duda genuina (red / timeout / 5xx / error ambiguo) — acá, y SOLO
  // acá, se recurre al snapshot local de esta visita.
  if (misPedidos.data === undefined) {
    const snapshot = readClientOrders(tableId, session.token).orders;

    if (snapshot.length > 0) {
      return (
        <div className="flex flex-col gap-4 pb-6">
          <div className="px-4 pt-4">
            <h1 className="text-lg font-bold text-foreground">Mis pedidos</h1>
            <p className="mt-1 text-xs text-warning-foreground">
              No pudimos confirmar esta lista con el servidor. Mostrando la última información guardada en
              este dispositivo.
            </p>
          </div>
          <div className="flex flex-col gap-3 px-4">
            {snapshot.map((pedido) => (
              <PedidoCard key={pedido.idPedido} pedido={pedido} tableId={tableId} />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={<AlertTriangle />}
          title="No se pudieron cargar tus pedidos"
          description={misPedidos.error?.message || 'Hubo un problema al conectar con el servidor.'}
        >
          <Button onClick={() => misPedidos.refetch()}>Reintentar</Button>
        </EmptyState>
      </div>
    );
  }

  // Respuesta real del backend (incluso [] vacío): se respeta tal cual,
  // nunca se reemplaza por el snapshot local.
  const pedidos = misPedidos.data;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-bold text-foreground">Mis pedidos</h1>
        <p className="text-sm text-muted-foreground">Mesa {session.nombreMesa}</p>
      </div>

      {pedidos.length === 0 ? (
        <div className="px-4 py-8">
          <EmptyState icon={<ClipboardList />} title="Todavía no hiciste ningún pedido en esta visita.">
            <Button asChild className="h-10">
              <Link to={`/menu/${tableId}`}>Ver menú</Link>
            </Button>
          </EmptyState>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4">
          {pedidos.map((pedido) => (
            <PedidoCard key={pedido.idPedido} pedido={pedido} tableId={tableId} />
          ))}
        </div>
      )}
    </div>
  );
}
