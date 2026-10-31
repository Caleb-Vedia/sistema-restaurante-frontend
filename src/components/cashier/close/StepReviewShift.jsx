import { Card, CardHeader, CardTitle, CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import ShiftActivity from '../ShiftActivity';
import SessionWarnings from './SessionWarnings';
import { formatCurrency, formatDateTime } from '../../../utils';

function DatoTurno({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

/**
 * Paso 1 — Revisar turno.
 *
 * Lectura pura: nada de lo que se muestra acá dispara ninguna operación
 * irreversible. Se puede volver a Operación en cualquier momento.
 *
 * La actividad del turno se muestra reusando el componente ShiftActivity tal
 * cual — es el mismo dato (GET /caja/actividad, misma query key), así que no
 * se duplica ni se reimplementa: si ya estaba cacheado por Operación, se
 * pinta sin esperar.
 *
 * Props:
 * - contexto: respuesta de GET /caja/cierre/contexto
 * - onNext / onCancel
 */
export default function StepReviewShift({ contexto, onNext, onCancel }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Turno a cerrar
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DatoTurno label="Apertura" value={formatDateTime(contexto.abiertoEl)} />
          <DatoTurno
            label="Fondo inicial en efectivo"
            value={formatCurrency(contexto.montoInicialEfectivo)}
          />
        </CardContent>
      </Card>

      <ShiftActivity idCierre={contexto.idCierre} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Mesas abiertas al cerrar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SessionWarnings
            sesiones={contexto.sesiones}
            resumenSesiones={contexto.resumenSesiones}
            puedeCerrar={contexto.puedeCerrar}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="h-10" onClick={onCancel}>
          Volver a Operación
        </Button>
        <Button type="button" className="h-10" onClick={onNext}>
          Continuar al arqueo
        </Button>
      </div>
    </div>
  );
}
