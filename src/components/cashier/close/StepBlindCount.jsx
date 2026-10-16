import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/Card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/Button';
import Spinner from '../../ui/Spinner';
import { MONTO_VERIFICADO_PATTERN, etiquetaMontoVerificado } from '../../../utils/arqueoCaja';

/**
 * Paso 2 — Arqueo ciego.
 *
 * La cajera declara ÚNICAMENTE lo que verificó. Este componente no muestra
 * —ni puede mostrar— monto esperado, diferencia ni total esperado: recibe
 * `metodos` ya proyectado a `{ idMetodoPago, nombreMetodo, codigo }` por el
 * wizard, así que `montoEsperado` no existe en sus props. Es una garantía
 * estructural y no una regla de estilo: no hay forma de filtrar el esperado
 * acá aunque alguien lo intente por descuido más adelante.
 *
 * La lista sale del contexto del backend (métodos activos + los dados de baja
 * que igual cobraron en el turno), nunca de una lista fija en el frontend. Lo
 * único que se resuelve por `codigo` es la ETIQUETA del campo.
 *
 * Los montos viven como strings crudos en el estado del wizard para poder
 * distinguir "" (no declarado) de "0" (declarado en cero): el backend trata
 * `montoContado: null` y `montoContado: 0` como cosas distintas.
 *
 * Props:
 * - metodos: [{ idMetodoPago, nombreMetodo, codigo }]
 * - montos / onChangeMonto: estado controlado por el wizard (se conserva al
 *   volver desde Conciliación para poder corregir)
 * - isPending: hay un preview en vuelo
 * - errorMessage: fallo del preview, si lo hubo
 */
export default function StepBlindCount({
  metodos,
  montos,
  onChangeMonto,
  onNext,
  onBack,
  isPending,
  errorMessage,
}) {
  const raw = (idMetodoPago) => (montos[idMetodoPago] ?? '').trim();
  const isInvalid = (idMetodoPago) =>
    raw(idMetodoPago) !== '' && !MONTO_VERIFICADO_PATTERN.test(raw(idMetodoPago));

  const hayInvalidos = metodos.some((metodo) => isInvalid(metodo.idMetodoPago));
  const declarados = metodos.filter((metodo) => raw(metodo.idMetodoPago) !== '').length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Arqueo ciego
          </CardTitle>
          <CardDescription>
            Ingresá solo lo que verificaste en cada método. Todavía no vas a ver el monto
            esperado ni las diferencias: eso se calcula en el paso siguiente, después de
            declarar. Los campos que dejes vacíos quedan como{' '}
            <span className="font-medium text-foreground/80">No contado</span>.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {metodos.map((metodo) => (
              <div
                key={metodo.idMetodoPago}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
              >
                <span className="text-sm font-semibold text-foreground">{metodo.nombreMetodo}</span>
                <div className="w-48">
                  <label
                    className="mb-1 block text-xs text-muted-foreground"
                    htmlFor={`verificado-${metodo.idMetodoPago}`}
                  >
                    {etiquetaMontoVerificado(metodo.codigo)}{' '}
                    <span className="text-muted-foreground/70">(opcional)</span>
                  </label>
                  <Input
                    id={`verificado-${metodo.idMetodoPago}`}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    aria-invalid={isInvalid(metodo.idMetodoPago)}
                    value={montos[metodo.idMetodoPago] ?? ''}
                    disabled={isPending}
                    onChange={(event) =>
                      onChangeMonto(metodo.idMetodoPago, event.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {hayInvalidos && (
            <p className="text-xs text-destructive" role="alert">
              Revisá los montos: tienen que ser números mayores o iguales a 0, con hasta 2
              decimales.
            </p>
          )}

          {declarados === 0 && !hayInvalidos && (
            <p className="text-xs text-warning-foreground/80">
              Todavía no declaraste ningún monto. Podés continuar igual: el arqueo quedará
              sin diferencias calculadas.
            </p>
          )}

          {errorMessage && (
            <p
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {errorMessage}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="h-10" onClick={onBack} disabled={isPending}>
          Volver a revisar turno
        </Button>
        <Button type="button" className="h-10" onClick={onNext} disabled={hayInvalidos || isPending}>
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              Calculando...
            </span>
          ) : (
            'Ver conciliación'
          )}
        </Button>
      </div>
    </div>
  );
}
