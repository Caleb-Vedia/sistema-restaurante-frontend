import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useReleaseTable } from '../../../hooks/useReleaseTable';
import ReleaseTableAction from '../ReleaseTableAction';
import { Button } from '../../ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../../ui/dialog';
import { formatCurrency, formatTime } from '../../../utils';

/**
 * Presentación de las reglas A/B/C. El frontend NO las recalcula: cada sesión
 * llega del backend con su `clasificacion` y su `bloqueaCierre` ya resueltos
 * (ConciliacionCajaService.evaluarSesionesDelCierre), y el gate global es
 * `puedeCerrar`. Acá solo se traduce cada valor a texto y color.
 *
 * Si apareciera una clasificación desconocida (backend nuevo, frontend viejo)
 * se muestra el valor crudo en tono neutro en vez de romper: es información
 * del turno, no vale perderla por no tener el color.
 */
const CLASIFICACION_CONFIG = {
  activa_sin_saldo: {
    regla: 'A',
    label: 'Sin saldo',
    className: 'border-border bg-muted text-muted-foreground',
    ayuda: 'Mesa abierta sin deuda. No bloquea el cierre y no se libera automáticamente: liberarla es una acción aparte.',
  },
  ocupada_con_saldo: {
    regla: 'B',
    label: 'Consumo sin cobrar',
    className: 'border-warning/30 bg-warning/15 text-warning-foreground',
    ayuda: 'Hay consumo sin cobrar y el cliente todavía no pidió la cuenta. No bloquea el cierre: la visita continúa en el turno siguiente.',
  },
  cuenta_solicitada_con_saldo: {
    regla: 'C',
    label: 'Cuenta pedida con deuda',
    className: 'border-destructive/30 bg-destructive/15 text-destructive',
    ayuda: 'El cliente pidió la cuenta y todavía debe. Bloquea el cierre: hay alguien esperando pagar en este turno.',
  },
};

const configDe = (clasificacion) =>
  CLASIFICACION_CONFIG[clasificacion] ?? {
    regla: '?',
    label: clasificacion,
    className: 'border-border bg-muted text-muted-foreground',
    ayuda: null,
  };

/**
 * `onReleased` de ReleaseTableAction no necesita hacer nada acá: la fila
 * desaparece sola cuando `contexto` se refetchea (useReleaseTable ya invalida
 * CLOSE_CONTEXT_KEY en su onSuccess) y el padre vuelve a renderizar con la
 * lista de sesiones actualizada — no hay estado local que limpiar ni que
 * filtrar a mano.
 */
const NOOP = () => {};

function SessionRow({ sesion }) {
  const config = configDe(sesion.clasificacion);
  // Único disparador de "liberar": la clasificación que YA calculó el
  // backend (regla A). Nunca se reevalúa saldo/estado acá — B y C jamás
  // ofrecen esta acción, sin importar su saldoPendiente.
  const esLiberable = sesion.clasificacion === 'activa_sin_saldo';

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
        sesion.bloqueaCierre ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{sesion.nombreMesa}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.className}`}
        >
          {config.label}
        </span>
        <span className="text-xs text-muted-foreground">Desde {formatTime(sesion.abiertaEl)}</span>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <span className="text-sm font-bold text-foreground">
          {sesion.saldoPendiente > 0 ? (
            formatCurrency(sesion.saldoPendiente)
          ) : (
            <span className="text-muted-foreground">Sin saldo</span>
          )}
        </span>

        {esLiberable && (
          <ReleaseTableAction
            idMesa={sesion.idMesa}
            nombreMesa={sesion.nombreMesa}
            onReleased={NOOP}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Libera en SECUENCIA todas las sesiones de regla A visibles (activa + saldo
 * 0). Reusa el mismo hook y el mismo PATCH /mesas/:id/cerrar-sesion que el
 * botón individual (ReleaseTableAction/useReleaseTable) — no hay endpoint
 * nuevo ni cálculo de saldo propio: el backend sigue siendo la única
 * autoridad de qué mesa realmente puede liberarse.
 *
 * Secuencial y no en paralelo: cada PATCH revalida su propia sesión contra el
 * estado real en ese instante. Si una falla (ej. entró un pedido nuevo entre
 * que se armó esta lista y el click, y esa mesa ya no tiene saldo 0), se seguí
 * con el resto — un fallo puntual no debe frenar las demás liberaciones
 * válidas.
 *
 * Nunca se dispara sin confirmación explícita, y nunca toca el paso del
 * wizard ni la caja: es exactamente la misma operación que el botón
 * individual, repetida N veces.
 */
function ReleaseAllFreeSessionsAction({ sesiones }) {
  const releaseTable = useReleaseTable();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [fallidas, setFallidas] = useState([]);

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setProcesando(true);
    setFallidas([]);

    const errores = [];
    for (const sesion of sesiones) {
      try {
        // await dentro del loop es intencional: secuencial, no en paralelo
        // (ver comentario del componente).
        await releaseTable.mutateAsync({ idMesa: sesion.idMesa });
      } catch (err) {
        errores.push({
          idMesa: sesion.idMesa,
          nombreMesa: sesion.nombreMesa,
          message: err?.message,
        });
      }
    }

    setFallidas(errores);
    setProcesando(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={procesando}
        onClick={() => setConfirmOpen(true)}
      >
        {procesando ? 'Liberando...' : `Liberar sesiones sin deuda (${sesiones.length})`}
      </Button>

      {fallidas.length > 0 && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          <p className="font-semibold">No se pudieron liberar {fallidas.length} mesa(s):</p>
          <ul className="mt-1 list-disc pl-4">
            {fallidas.map((fallo) => (
              <li key={fallo.idMesa}>
                {fallo.nombreMesa}: {fallo.message || 'No se pudo liberar. Intentá de nuevo.'}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={(next) => !procesando && setConfirmOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Liberar {sesiones.length} mesas sin deuda?</DialogTitle>
            <DialogDescription>
              Se cerrará la sesión de cada una de estas mesas, sin registrar ningún pago
              (ninguna tiene saldo pendiente):{' '}
              <span className="font-semibold text-foreground">
                {sesiones.map((sesion) => sesion.nombreMesa).join(', ')}
              </span>
              .
              <br />
              <br />
              Si el estado de alguna cambió mientras tanto (por ejemplo, un pedido nuevo), esa
              mesa en particular no se liberará y se va a mostrar el motivo — el resto sí se
              libera igual.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={procesando}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleConfirm} disabled={procesando}>
              Liberar mesas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResumenChip({ label, cantidad, className }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
        cantidad > 0 ? className : 'border-border bg-muted text-muted-foreground/60'
      }`}
    >
      {label}: <span className="font-bold">{cantidad}</span>
    </span>
  );
}

/**
 * Estado de las sesiones abiertas al momento de cerrar, con las advertencias
 * A/B/C tal como las devolvió el backend.
 *
 * Props:
 * - sesiones / resumenSesiones / puedeCerrar: campos del contexto o del
 *   preview (mismo shape en los dos)
 * - mostrarBloqueo: en Conciliación el bloqueo de la regla C se muestra como
 *   barrera del cierre; en Revisar turno alcanza con informarlo.
 */
export default function SessionWarnings({
  sesiones,
  resumenSesiones,
  puedeCerrar,
  mostrarBloqueo = false,
}) {
  const bloqueantes = sesiones.filter((sesion) => sesion.bloqueaCierre);
  // Regla A: la ÚNICA que ofrece liberación desde acá. Se deriva de la misma
  // `clasificacion` que ya trae cada sesión del backend — no se recalcula
  // saldo ni estado en el frontend.
  const liberables = sesiones.filter(
    (sesion) => sesion.clasificacion === 'activa_sin_saldo',
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ResumenChip
            label="Activas sin saldo"
            cantidad={resumenSesiones.activasSinSaldo}
            className="border-border bg-muted text-muted-foreground"
          />
          <ResumenChip
            label="Con consumo sin cobrar"
            cantidad={resumenSesiones.ocupadasConSaldo}
            className="border-warning/30 bg-warning/15 text-warning-foreground"
          />
          <ResumenChip
            label="Cuenta pedida con deuda"
            cantidad={resumenSesiones.cuentaSolicitadaConSaldo}
            className="border-destructive/30 bg-destructive/15 text-destructive"
          />
        </div>

        {/* Solo con 2+: una sola A ya tiene su botón individual en la fila. */}
        {liberables.length > 1 && <ReleaseAllFreeSessionsAction sesiones={liberables} />}
      </div>

      {mostrarBloqueo && !puedeCerrar && (
        <div
          className="rounded-lg border-2 border-destructive/50 bg-destructive/10 px-3 py-2.5"
          role="alert"
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            No se puede cerrar caja todavía
          </p>
          <p className="mt-1 text-sm text-destructive/80">
            {bloqueantes.length} mesa(s) pidieron la cuenta y siguen con saldo pendiente
            ({bloqueantes.map((sesion) => sesion.nombreMesa).join(', ')}). Cobralas o resolvé
            su cuenta y volvé a recalcular.
          </p>
        </div>
      )}

      {resumenSesiones.ocupadasConSaldo > 0 && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground/80">
          {CLASIFICACION_CONFIG.ocupada_con_saldo.ayuda}
        </p>
      )}

      {resumenSesiones.activasSinSaldo > 0 && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {CLASIFICACION_CONFIG.activa_sin_saldo.ayuda}
        </p>
      )}

      {sesiones.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
          No quedan mesas abiertas.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sesiones.map((sesion) => (
            <SessionRow key={sesion.idSesion} sesion={sesion} />
          ))}
        </div>
      )}
    </div>
  );
}
