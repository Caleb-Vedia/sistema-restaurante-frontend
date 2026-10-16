import { CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import DifferenceLabel from './close/DifferenceLabel';
import { formatCurrency, formatDateTime } from '../../utils';
import { diferenciaTotalDelResumen } from '../../utils/arqueoCaja';

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-bold text-foreground">{value}</p>
    </div>
  );
}

/**
 * Resultado del arqueo, mostrado después de un cierre exitoso.
 *
 * Renderiza TODOS los elementos de `resultado.detalle` sin cruzarlos contra
 * la lista de métodos activos: el backend puede incluir un método que fue
 * dado de baja lógica después de haber recibido pagos durante el turno, y
 * ese movimiento tiene que verse igual. El nombre sale del propio response.
 *
 * `totalContado` y `montoContado` pueden ser null (nada declarado): se
 * muestran como "No declarado" / "No contado", nunca como Bs 0.00, y no se
 * reconstruyen sumando el detalle.
 *
 * La diferencia POR MÉTODO llega calculada del backend. La diferencia TOTAL es
 * lo único que este resumen no recibe hecho (a diferencia del preview, que sí
 * trae `diferenciaTotal`): se reconstruye con diferenciaTotalDelResumen, que
 * respeta la misma semántica del backend — null si no se declaró nada.
 *
 * Props:
 * - resultado: response del PATCH /caja/cerrar
 * - onFinish: descarta el resumen y devuelve al flujo normal de Caja
 */
export default function CashRegisterCloseResult({ resultado, onFinish }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3" role="status">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-foreground" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-success-foreground">Arqueo finalizado</p>
          <p className="mt-1 text-sm text-success-foreground/80">
            La caja quedó cerrada. Este es el resumen calculado por el sistema.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Resumen del turno</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <SummaryItem label="Apertura" value={formatDateTime(resultado.abiertoEl)} />
            <SummaryItem label="Cierre" value={formatDateTime(resultado.cerradoEl)} />
            <SummaryItem
              label="Fondo inicial"
              value={formatCurrency(resultado.montoInicialEfectivo)}
            />
            <SummaryItem label="Total esperado" value={formatCurrency(resultado.totalEsperado)} />
            <SummaryItem
              label="Total verificado"
              value={
                resultado.totalContado == null ? (
                  <span className="text-muted-foreground">No declarado</span>
                ) : (
                  formatCurrency(resultado.totalContado)
                )
              }
            />
            <SummaryItem
              label="Diferencia total"
              value={<DifferenceLabel diferencia={diferenciaTotalDelResumen(resultado)} />}
            />
          </div>

          {resultado.observacionDiferencia && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Observación de la diferencia</p>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground/80">
                {resultado.observacionDiferencia}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Detalle por método</CardTitle>
        </CardHeader>
        <CardContent>
          {resultado.detalle.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              El turno no registró movimientos por método de pago.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {resultado.detalle.map((item) => (
                <div
                  key={item.idMetodoPago}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{item.nombreMetodo}</span>
                    <DifferenceLabel diferencia={item.diferencia} />
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Esperado{' '}
                      <span className="font-medium text-foreground">
                        {formatCurrency(item.montoEsperado)}
                      </span>
                    </span>
                    <span>
                      Contado{' '}
                      {item.montoContado == null ? (
                        <span className="font-medium text-muted-foreground">No contado</span>
                      ) : (
                        <span className="font-medium text-foreground">
                          {formatCurrency(item.montoContado)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button type="button" onClick={onFinish} className="h-10 self-end">
        Finalizar
      </Button>
    </div>
  );
}
