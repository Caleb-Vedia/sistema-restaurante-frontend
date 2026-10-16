import { useTables } from '../../hooks/useTables';
import { useReleaseTable } from '../../hooks/useReleaseTable';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/Button';

/**
 * Clasifica la situación de la mesa comparando el estado canónico de
 * ['mesas'] contra la sesión que quedó colgada en el cobro.
 *
 * El backend cierra "la sesión activa de la mesa" — el endpoint no recibe
 * idSesion. Por eso la única situación en la que es seguro llamarlo es
 * cuando la sesión activa sigue siendo EXACTAMENTE la del cobro fallido:
 * en cualquier otro caso podríamos cerrar una sesión nueva de otros
 * comensales.
 */
function clasificarSituacion(mesa, idSesion) {
  if (!mesa) return 'sin-mesa';
  if (mesa.sesionActiva?.idSesion === idSesion) return 'misma-sesion';
  if (mesa.estado === 'libre' && mesa.sesionActiva === null) return 'ya-libre';
  if (mesa.sesionActiva != null) return 'sesion-distinta';
  return 'inconsistente';
}

function ResolvedPanel({ nombreMesa, mensaje, onDismiss }) {
  return (
    <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3" role="status">
      <p className="text-sm font-semibold text-success-foreground">Pago registrado · {nombreMesa}</p>
      <p className="mt-1 text-sm text-success-foreground/80">{mensaje}</p>
      <Button className="mt-3 h-10" onClick={onDismiss}>
        Continuar
      </Button>
    </div>
  );
}

/**
 * Estado de recuperación de un cobro con `mesaLiberada: false`.
 *
 * El pago ya está confirmado en la base: acá NUNCA se vuelve a llamar
 * POST /pagos. Lo único que se ofrece es cerrar la sesión que quedó abierta,
 * y solo cuando es demostrablemente segura (misma idSesion del cobro).
 *
 * Props:
 * - outcome: { idMesa, idSesion, nombreMesa } tomados del response real del POST
 * - onReleased: aviso de que la sesión quedó cerrada (la página suelta la selección)
 * - onDismiss: descarta el estado de recuperación ya resuelto
 */
export default function PaymentRecovery({ outcome, onReleased, onDismiss }) {
  const { data: mesas, isLoading, isError, refetch } = useTables();
  const releaseTable = useReleaseTable();

  // Resuelto vía PATCH (o vía reconciliación de un 404 que confirmó que la
  // mesa ya estaba libre). No se ofrece ninguna acción que pueda repetirlo.
  if (releaseTable.isSuccess) {
    return (
      <ResolvedPanel
        nombreMesa={outcome.nombreMesa}
        mensaje={
          releaseTable.data?.yaEstabaLibre
            ? 'La mesa ya estaba liberada. El cobro había quedado registrado correctamente.'
            : 'La mesa fue liberada correctamente.'
        }
        onDismiss={onDismiss}
      />
    );
  }

  const mesa = mesas?.find((m) => m.idMesa === outcome.idMesa);
  const situacion = clasificarSituacion(mesa, outcome.idSesion);

  // Caso B: otra vía ya resolvió la liberación. No hace falta ningún PATCH.
  if (!isLoading && !isError && situacion === 'ya-libre') {
    return (
      <ResolvedPanel
        nombreMesa={outcome.nombreMesa}
        mensaje="El pago fue registrado y la mesa ya quedó liberada."
        onDismiss={onDismiss}
      />
    );
  }

  const handleRelease = () => {
    if (releaseTable.isPending) return;
    releaseTable.mutate(
      { idMesa: outcome.idMesa },
      { onSuccess: () => onReleased() },
    );
  };

  return (
    <div className="rounded-xl border-2 border-warning/40 bg-warning/10 px-4 py-3" role="alert">
      <p className="text-sm font-semibold text-warning-foreground">Pago registrado · {outcome.nombreMesa}</p>
      <p className="mt-1 text-sm text-warning-foreground/80">
        El cobro ya fue guardado, pero la mesa no pudo liberarse.{' '}
        <span className="font-semibold">No vuelvas a cobrar esta cuenta.</span>
      </p>

      {isLoading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-warning-foreground/80">
          <Spinner size="sm" />
          Verificando el estado de la mesa...
        </div>
      )}

      {isError && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-warning-foreground/80">No se pudo verificar el estado actual de la mesa.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !isError && situacion === 'misma-sesion' && (
        <Button className="mt-3 h-10" onClick={handleRelease} disabled={releaseTable.isPending}>
          {releaseTable.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              Liberando...
            </span>
          ) : (
            'Liberar mesa'
          )}
        </Button>
      )}

      {!isLoading && !isError && situacion === 'sesion-distinta' && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          La mesa ahora tiene una sesión distinta. No se puede ejecutar la recuperación
          automática de forma segura.
        </p>
      )}

      {!isLoading && !isError && situacion === 'inconsistente' && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          El estado de la mesa no es consistente. Requiere revisión manual.
        </p>
      )}

      {!isLoading && !isError && situacion === 'sin-mesa' && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          La mesa ya no aparece en el listado. Requiere revisión manual.
        </p>
      )}

      {releaseTable.isError && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo liberar la mesa: {releaseTable.error?.message || 'error inesperado.'}
          <br />
          El cobro sigue registrado; esto afecta solo a la liberación de la mesa.
        </p>
      )}
    </div>
  );
}
