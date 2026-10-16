import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useShiftActivity } from '../../hooks/useShiftActivity';
import Spinner from '../ui/Spinner';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { formatCurrency, formatTime } from '../../utils';

/** pendiente → warning, preparación → info, listo → success — mismo mapeo semántico que TableConsumption. */
const ESTADO_PEDIDO_CONFIG = {
  pendiente: { label: 'Pendiente', className: 'border-warning/30 bg-warning/15 text-warning-foreground' },
  preparacion: { label: 'En preparación', className: 'border-info/30 bg-info/15 text-info-foreground' },
  listo: { label: 'Listo', className: 'border-success/30 bg-success/15 text-success-foreground' },
};

function OrderStatusTag({ estado }) {
  const config = ESTADO_PEDIDO_CONFIG[estado] ?? { label: estado, className: 'border-border bg-muted text-muted-foreground' };
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.className}`}>
      {config.label}
    </span>
  );
}

function VisitOrderRow({ pedido }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/30 px-2.5 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground/80">Pedido #{pedido.nroOrden}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{formatTime(pedido.creadoEl)}</span>
          <OrderStatusTag estado={pedido.estado} />
        </div>
      </div>
      <ul className="mt-1 space-y-0.5">
        {pedido.detalles.map((detalle) => (
          <li key={detalle.idDetalle} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2 text-foreground/60">
              <span>
                {detalle.cantidad} × {detalle.nombreProducto}
              </span>
              <span>{formatCurrency(detalle.cantidad * detalle.precioActual)}</span>
            </div>
            {detalle.observacion && (
              <p className="whitespace-pre-line text-[10px] text-muted-foreground">{detalle.observacion}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Un pago del turno. Los anulados se muestran DIFERENCIADOS (opacidad +
 * etiqueta), nunca omitidos: la anulación es parte de la actividad del
 * turno (ver ActividadTurnoResponse en el backend) y ocultarla dejaría el
 * movimiento sin explicación — mismo criterio visual que PaymentHistoryRow.
 */
function VisitPaymentRow({ pago }) {
  const isCancelled = pago.anuladoEl !== null;
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
        isCancelled ? 'border-border/50 bg-muted/20 opacity-60' : 'border-border/70 bg-muted/30'
      }`}
    >
      <span className="flex items-center gap-1.5 text-foreground/70">
        {pago.nombreMetodo}
        <Badge
          variant="outline"
          className={isCancelled ? 'border-border text-muted-foreground' : 'border-success/30 bg-success/15 text-success-foreground'}
        >
          {isCancelled ? 'Anulado' : 'Vigente'}
        </Badge>
      </span>
      <span className={`font-medium ${isCancelled ? 'text-muted-foreground line-through' : 'text-foreground/80'}`}>
        {formatCurrency(pago.montoPagado)}
      </span>
    </div>
  );
}

/**
 * Una visita (SesionMesa) del turno, desplegable. Colapsada por defecto:
 * con varias mesas activas, expandir todo de entrada satura la pantalla
 * (regla no negociable). La cabecera sola ya contiene lo esencial (mesa,
 * horario, estado, origen, total) para escanear la lista sin abrir nada.
 */
function VisitCard({ sesion }) {
  const [open, setOpen] = useState(false);
  const activa = sesion.cerradaEl === null;

  return (
    <div className="rounded-lg border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{sesion.nombreMesa}</span>
          <Badge
            variant="outline"
            className={activa ? 'border-info/30 bg-info/15 text-info-foreground' : 'border-border text-muted-foreground'}
          >
            {activa ? 'Activa' : 'Cerrada'}
          </Badge>
          {sesion.comenzoEnTurnoAnterior && (
            <Badge variant="outline" className="border-warning/30 bg-warning/15 text-warning-foreground">
              Turno anterior
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {formatTime(sesion.abiertaEl)}
            {sesion.cerradaEl && ` – ${formatTime(sesion.cerradaEl)}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">{formatCurrency(sesion.totalSesion)}</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pedidos del turno
            </p>
            {sesion.pedidos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin pedidos nuevos en este turno.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sesion.pedidos.map((pedido) => (
                  <VisitOrderRow key={pedido.idPedido} pedido={pedido} />
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pagos del turno
            </p>
            {sesion.pagos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin pagos registrados en este turno.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sesion.pagos.map((pago) => (
                  <VisitPaymentRow key={pago.idPago} pago={pago} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Actividad del turno de caja en curso: visitas (sesiones) que intersectaron
 * el turno, agrupadas por SESIÓN — no por mesa: la misma mesa puede aparecer
 * dos veces si tuvo dos visitas distintas dentro del turno (cada una es una
 * `idSesion` propia, ver `key`).
 *
 * `totalIngresosTurno` es el único número que se muestra como "ingresos":
 * nunca se suman los `totalSesion` de las filas (esos son consumo, no
 * ingreso — ver comentario en el backend, ActividadTurnoResponse).
 *
 * Sección secundaria a propósito: cada visita arranca colapsada (ver
 * VisitCard) para no saturar la pantalla con varias sesiones activas a la
 * vez — es la propia lista, no un acordeón nuevo, la que evita la
 * sobrecarga.
 *
 * READ-ONLY: ninguna fila ofrece acciones (ni de KDS ni de pagos). Solo
 * lectura para entender el turno.
 */
export default function ShiftActivity() {
  const { data: actividad, isLoading, isError, refetch } = useShiftActivity();

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Actividad del turno</CardTitle>
        {actividad && (
          <span className="text-sm">
            <span className="text-muted-foreground">Ingresos del turno: </span>
            <span className="font-bold text-success-foreground">{formatCurrency(actividad.totalIngresosTurno)}</span>
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Spinner size="sm" className="text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <span className="text-sm text-muted-foreground">No se pudo cargar la actividad del turno.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()} className="shrink-0">
              Reintentar
            </Button>
          </div>
        )}

        {!isLoading && !isError && actividad?.sesiones.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin actividad todavía en este turno.</p>
        )}

        {!isLoading && !isError && actividad?.sesiones.length > 0 && (
          <div className="flex flex-col gap-2">
            {actividad.sesiones.map((sesion) => (
              <VisitCard key={sesion.idSesion} sesion={sesion} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
