import { RefreshCw } from 'lucide-react';
import Spinner from '../../ui/Spinner';
import { Button } from '../../ui/Button';
import { Textarea } from '../../ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/Card';
import SessionWarnings from './SessionWarnings';
import DifferenceLabel from './DifferenceLabel';
import { formatCurrency, formatTime } from '../../../utils';
import { OBSERVACION_DIFERENCIA_MAX_LENGTH, cobradoEnTurno } from '../../../utils/arqueoCaja';

function TotalItem({ label, value, destacado = false }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        destacado ? 'border-primary/25 bg-primary/5' : 'border-border bg-muted/40'
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-bold text-foreground">{value}</p>
    </div>
  );
}

/**
 * Paso 3 — Conciliación.
 *
 * Muestra el resultado de POST /caja/cierre/preview: sistema vs. verificado
 * por método, y los totales del turno. Todos los números salen del preview
 * — el frontend no calcula ninguna diferencia (ver DifferenceLabel).
 *
 * Acá TODAVÍA no se cierra nada. El preview se puede repetir ("Recalcular")
 * y se puede volver a corregir el conteo o a revisar el turno sin perder los
 * valores cargados.
 *
 * Si `puedeCerrar` es false (regla C) el cierre definitivo no se ofrece: el
 * bloqueo se muestra explícito y el botón queda deshabilitado. Igual el
 * backend revalida por su cuenta al cerrar — este gate es de UI, no la
 * barrera real.
 *
 * El botón final usa el tono `warning` (no `destructive`): todavía es
 * reversible — solo abre el diálogo de confirmación — y el rojo se reserva
 * para lo que realmente bloquea (regla C, errores).
 *
 * Props:
 * - preview: respuesta de POST /caja/cierre/preview
 * - observacion / onChangeObservacion: nota opcional de diferencia
 * - onRecalcular / onBackToCount / onBackToReview / onConfirmar
 * - isRecalculando / isCerrando
 * - errorMessage: fallo del preview o del cierre definitivo (incluido el 409)
 */
export default function StepReconciliation({
  preview,
  observacion,
  onChangeObservacion,
  onRecalcular,
  onBackToCount,
  onBackToReview,
  onConfirmar,
  isRecalculando,
  isCerrando,
  errorMessage,
}) {
  const hayDiferencia = preview.diferenciaTotal != null && preview.diferenciaTotal !== 0;
  const ocupado = isRecalculando || isCerrando;
  const observacionRestante = OBSERVACION_DIFERENCIA_MAX_LENGTH - observacion.length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Conciliación por método
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Calculado {formatTime(preview.generadoEl)}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onRecalcular} disabled={ocupado}>
              <RefreshCw className="h-3.5 w-3.5" />
              {isRecalculando ? 'Recalculando...' : 'Recalcular'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 font-semibold">Método</th>
                <th className="pb-2 pr-3 text-right font-semibold">Sistema</th>
                <th className="pb-2 pr-3 text-right font-semibold">Verificado</th>
                <th className="pb-2 text-right font-semibold">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {preview.detalle.map((fila) => (
                <tr key={fila.idMetodoPago} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3 font-medium text-foreground">{fila.nombreMetodo}</td>
                  <td className="py-2 pr-3 text-right text-foreground/80">{formatCurrency(fila.montoEsperado)}</td>
                  <td className="py-2 pr-3 text-right text-foreground/80">
                    {fila.montoContado == null ? (
                      <span className="text-muted-foreground">No contado</span>
                    ) : (
                      formatCurrency(fila.montoContado)
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <DifferenceLabel diferencia={fila.diferencia} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Totales del turno
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <TotalItem
              label="Fondo inicial"
              value={formatCurrency(preview.montoInicialEfectivo)}
            />
            <TotalItem label="Cobrado en el turno" value={formatCurrency(cobradoEnTurno(preview))} />
            <TotalItem
              label="Total esperado"
              value={formatCurrency(preview.totalEsperado)}
              destacado
            />
            <TotalItem
              label="Total verificado"
              value={
                preview.totalContado == null ? (
                  <span className="text-muted-foreground">No declarado</span>
                ) : (
                  formatCurrency(preview.totalContado)
                )
              }
              destacado
            />
            <TotalItem
              label="Diferencia total"
              value={<DifferenceLabel diferencia={preview.diferenciaTotal} />}
              destacado
            />
          </div>

          {hayDiferencia && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="observacionDiferencia"
                  className="text-xs font-medium text-foreground/80"
                >
                  Observación de la diferencia{' '}
                  <span className="text-muted-foreground/70">(opcional)</span>
                </label>
                <span
                  className={`text-[11px] ${
                    observacionRestante < 0 ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {observacion.length}/{OBSERVACION_DIFERENCIA_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="observacionDiferencia"
                rows={2}
                maxLength={OBSERVACION_DIFERENCIA_MAX_LENGTH}
                placeholder="Ej. Faltan Bs 5; se revisó el efectivo."
                value={observacion}
                disabled={ocupado}
                onChange={(event) => onChangeObservacion(event.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Se guarda con el cierre, sin espacios sobrantes al principio ni al final. Si
                queda vacía no se guarda ninguna nota.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Mesas abiertas al cerrar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SessionWarnings
            sesiones={preview.sesiones}
            resumenSesiones={preview.resumenSesiones}
            puedeCerrar={preview.puedeCerrar}
            mostrarBloqueo
          />
        </CardContent>
      </Card>

      {errorMessage && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="h-10" onClick={onBackToReview} disabled={ocupado}>
          Volver a revisar turno
        </Button>
        <Button type="button" variant="outline" className="h-10" onClick={onBackToCount} disabled={ocupado}>
          Corregir arqueo
        </Button>
        <Button
          type="button"
          className="h-10 bg-warning text-warning-foreground hover:bg-warning/90"
          onClick={onConfirmar}
          disabled={ocupado || !preview.puedeCerrar}
        >
          {isCerrando ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              Cerrando...
            </span>
          ) : (
            'Cerrar caja'
          )}
        </Button>
      </div>
    </div>
  );
}
