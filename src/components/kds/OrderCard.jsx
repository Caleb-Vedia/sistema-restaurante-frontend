import { CircleMinus, MessageSquareText } from 'lucide-react';
import { useUpdateOrderStatus } from '../../hooks/useUpdateOrderStatus';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import Spinner from '../ui/Spinner';
import { formatTime } from '../../utils';

/** Etiqueta visible por estado. Solo "pendiente"/"preparacion" llegan del GET. */
const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  preparacion: 'En preparación',
};

/** Mismo mapeo semántico que el resto de la app: pendiente → warning, preparación → info. */
const ESTADO_BADGE_CLASS = {
  pendiente: 'border-warning/30 bg-warning/15 text-warning-foreground',
  preparacion: 'border-info/30 bg-info/15 text-info-foreground',
};

/** Acento sutil en el borde izquierdo — refuerza el estado sin pintar toda la card. */
const ESTADO_ACCENT_CLASS = {
  pendiente: 'border-l-warning',
  preparacion: 'border-l-info',
};

/**
 * Acciones disponibles por estado, siguiendo el flujo normal del KDS (no el
 * de admin, que puede forzar transiciones desde otras pantallas): pendiente
 * puede saltar directo a "listo" o pasar primero por "preparación";
 * preparación solo puede cerrar a "listo". Nunca se ofrece volver atrás ni
 * repetir el estado actual. Igual para Cocina y Bebidas.
 *
 * `primary`: marca la acción recomendada del flujo normal (mayor jerarquía
 * visual, botón lleno) frente a la alternativa (outline, sigue accesible).
 * No cambia ninguna transición ni agrega estados — solo qué tan grande se ve
 * cada botón.
 */
const ACTIONS_BY_ESTADO = {
  pendiente: [
    { estado: 'preparacion', label: 'Iniciar preparación', primary: true },
    { estado: 'listo', label: 'Marcar listo', primary: false },
  ],
  preparacion: [
    { estado: 'listo', label: 'Marcar listo', primary: true },
  ],
};

/**
 * `detalle.observacion` ya viene armado como `"Sin: ...\nNota: ..."` (ver
 * buildObservacion en useCreateOrder.js, lado Cliente) — mismo ícono por
 * línea que ya usa MyOrdersPage, para no crear un segundo lenguaje visual.
 * Acá con más peso que en Cliente (`text-sm`, no `text-xs`): en KDS es
 * información operativa que cocina/barra tiene que poder leer de un
 * vistazo, no un resumen de consulta — y nunca se trunca.
 */
function ObservacionTexto({ texto }) {
  return (
    <div className="mt-1 space-y-0.5">
      {texto.split('\n').map((linea, index) => {
        const Icon = linea.startsWith('Sin:') ? CircleMinus : linea.startsWith('Nota:') ? MessageSquareText : null;
        return (
          <p key={index} className="flex items-start gap-1.5 whitespace-pre-line text-sm font-medium text-foreground/80">
            {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span>{linea}</span>
          </p>
        );
      })}
    </div>
  );
}

/**
 * Card de un pedido, compartida por Cocina y Bebidas. Cada card instancia su
 * propio useUpdateOrderStatus(area): eso aísla isPending/isError a esta card
 * sin ningún estado local manual, y evita doble click porque los botones de
 * ESTA card se deshabilitan mientras SU mutación está en curso (las demás
 * cards no se ven afectadas). `area` determina a qué query ['pedidos', area]
 * se invalida tras el PATCH — nunca se invalida el área que no corresponde.
 *
 * Jerarquía de lectura: mesa (más grande) → comensal/hora → estado (badge) →
 * productos con cantidad en línea propia → observación como texto secundario
 * pero legible → acciones. Nada de esto cambia el contrato de datos ni las
 * transiciones, solo el peso visual de cada parte.
 *
 * Props:
 * - pedido: objeto del contrato GET /pedidos/:area (idPedido, nroOrden,
 *   nombreMesa, nombreComensal, estado, creadoEl, detalles[])
 * - area: 'cocina' | 'bebidas'
 */
export default function OrderCard({ pedido, area }) {
  const updateStatus = useUpdateOrderStatus(area);
  const actions = ACTIONS_BY_ESTADO[pedido.estado] ?? [];
  const targetEstado = updateStatus.isPending ? updateStatus.variables?.estado : null;

  return (
    <Card className={`border-l-4 ${ESTADO_ACCENT_CLASS[pedido.estado] ?? 'border-l-border'}`}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-foreground">
              #{pedido.nroOrden} · {pedido.nombreMesa}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              {pedido.nombreComensal && (
                <>
                  <span>{pedido.nombreComensal}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>{formatTime(pedido.creadoEl)}</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 ${ESTADO_BADGE_CLASS[pedido.estado] ?? 'border-border bg-muted text-muted-foreground'}`}
          >
            {ESTADO_LABEL[pedido.estado] ?? pedido.estado}
          </Badge>
        </div>

        <ul className="flex flex-col gap-2.5 border-t border-border pt-3">
          {pedido.detalles.map((detalle) => (
            <li key={detalle.idDetalle}>
              <p className="text-[0.95rem] font-semibold text-foreground">
                {detalle.cantidad} × {detalle.nombreProducto}
              </p>
              {detalle.observacion && detalle.observacion.trim() !== '' && (
                <ObservacionTexto texto={detalle.observacion} />
              )}
            </li>
          ))}
        </ul>

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {actions.map((action) => (
              <Button
                key={action.estado}
                type="button"
                variant={action.primary ? 'default' : 'outline'}
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ idPedido: pedido.idPedido, estado: action.estado })}
                className="h-11 flex-1 text-sm"
              >
                {targetEstado === action.estado ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Guardando...
                  </span>
                ) : (
                  action.label
                )}
              </Button>
            ))}
          </div>
        )}

        {updateStatus.isError && (
          <p className="text-xs text-destructive" role="alert">
            {updateStatus.error?.message || 'No se pudo actualizar el pedido. Intentá de nuevo.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
