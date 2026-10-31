import { useTableConsumption } from '../../hooks/useTableConsumption';
import Spinner from '../ui/Spinner';
import { formatCurrency, formatTime } from '../../utils';

/** pendiente → warning, preparación → info, listo → success — mismo mapeo semántico que el resto de la app. */
const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', className: 'border-warning/30 bg-warning/15 text-warning-foreground' },
  preparacion: { label: 'En preparación', className: 'border-info/30 bg-info/15 text-info-foreground' },
  listo: { label: 'Listo', className: 'border-success/30 bg-success/15 text-success-foreground' },
};

function OrderStatusTag({ estado }) {
  const config = ESTADO_CONFIG[estado] ?? { label: estado, className: 'border-border bg-muted text-muted-foreground' };
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.className}`}>
      {config.label}
    </span>
  );
}

/**
 * Un ítem del pedido: producto, cantidad, subtotal (cantidad × precioActual,
 * derivado acá — el backend no lo manda) y observación con sus saltos de
 * línea respetados (whitespace-pre-line: el backend ya arma "Sin: .../Nota:
 * ..." con \n entre bloques, ver buildObservacion en useCreateOrder.js del
 * módulo Cliente — acá NO se reparsea, solo se muestra tal cual).
 */
function OrderItemRow({ detalle }) {
  const subtotal = detalle.cantidad * detalle.precioActual;
  return (
    <div className="flex flex-col gap-0.5 py-1 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-foreground/80">
          {detalle.cantidad} × {detalle.nombreProducto}
        </span>
        <span className="shrink-0 font-medium text-foreground/70">{formatCurrency(subtotal)}</span>
      </div>
      {detalle.observacion && (
        <p className="whitespace-pre-line text-[11px] text-muted-foreground">{detalle.observacion}</p>
      )}
    </div>
  );
}

/** Un pedido agrupado — la agrupación por pedido es la que aporta claridad acá: sin ella sería una lista plana de ítems sin contexto de a qué comanda pertenecen. */
function OrderBlock({ pedido }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground/80">
          Pedido #{pedido.nroOrden}
          {pedido.nombreComensal && <span className="font-normal text-muted-foreground"> · {pedido.nombreComensal}</span>}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{formatTime(pedido.creadoEl)}</span>
          <OrderStatusTag estado={pedido.estado} />
        </div>
      </div>
      <div className="mt-1.5 divide-y divide-border/60">
        {pedido.detalles.map((detalle) => (
          <OrderItemRow key={detalle.idDetalle} detalle={detalle} />
        ))}
      </div>
    </div>
  );
}

/**
 * Consumo actual de la mesa SELECCIONADA: de dónde sale el saldo que ya
 * muestra el panel de arriba (los totales de useTableBalance). Solo se monta
 * dentro de la rama "con sesión activa" de TableSummaryPanel — la rama sin
 * sesión ya tiene su propio aviso ("Sin sesión activa..."), así que no hace
 * falta un segundo estado vacío acá para ese caso (evita duplicar mensaje y
 * mantiene la pantalla compacta).
 *
 * Sin `Card` propia a propósito: siempre vive anidado dentro del Card "Mesa
 * seleccionada" — envolverlo en otro Card apilaría dos marcos/rings uno
 * dentro del otro. Solo un título de sub-sección + la lista.
 *
 * READ-ONLY: no ofrece ninguna acción de KDS (cambiar estado, cancelar). Es
 * puramente informativo para la cajera — presentación compacta, no un
 * segundo KDS.
 */
export default function TableConsumption({ idMesa, idSesion }) {
  const { data: consumo, isLoading, isError, refetch } = useTableConsumption(idMesa, idSesion);

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consumo actual</h3>

      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Spinner size="sm" className="text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <span className="text-sm text-muted-foreground">No se pudo cargar el consumo de la mesa.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* `consumo === null`: la sesión se cerró justo antes de que llegara la
          respuesta (404 esperado, ver useTableConsumption) — estado vacío
          normal, no un error. */}
      {!isLoading && !isError && consumo === null && (
        <p className="py-4 text-center text-sm text-muted-foreground">La sesión se cerró. No hay consumo que mostrar.</p>
      )}

      {!isLoading && !isError && consumo && consumo.pedidos.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">Sin pedidos registrados en esta sesión</p>
      )}

      {!isLoading && !isError && consumo && consumo.pedidos.length > 0 && (
        <div className="flex flex-col gap-2">
          {consumo.pedidos.map((pedido) => (
            <OrderBlock key={pedido.idPedido} pedido={pedido} />
          ))}
        </div>
      )}
    </div>
  );
}
