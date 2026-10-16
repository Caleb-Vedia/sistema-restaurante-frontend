import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import Spinner from '../ui/Spinner';
import { Input } from '../ui/input';
import { Button } from '../ui/Button';
import { formatCurrency, toCents, fromCents } from '../../utils';

/** Monto positivo con hasta 2 decimales, igual que valida el backend. */
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Mismas clases visuales que el `<Input>` de ui/, para que el <select> nativo de método combine sin serlo. */
const selectClass =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

/**
 * Valida una fila con las mismas reglas que el DTO del backend:
 * método elegido, monto numérico > 0 y máximo 2 decimales.
 * El regex corre sobre el string crudo para no depender de la precisión
 * de float al detectar "más de 2 decimales".
 */
function validateRow(row) {
  if (!row.idMetodoPago) return { valid: false, cents: 0 };

  const monto = row.monto.trim();
  if (!AMOUNT_PATTERN.test(monto)) return { valid: false, cents: 0 };

  const cents = toCents(monto);
  if (cents <= 0) return { valid: false, cents: 0 };

  return { valid: true, cents };
}

/**
 * Filas de cobro. Se monta solo cuando los métodos ya cargaron, así que
 * puede inicializar la primera fila con un método real desde el arranque.
 *
 * El saldo objetivo NO se copia a estado local: sigue llegando por props
 * desde useTableBalance (React Query es la fuente de verdad de la deuda).
 * Si el saldo cambia mientras el cajero distribuye, la comparación en
 * centavos deja de coincidir y el botón se deshabilita solo.
 *
 * `registerPayment` llega por props en vez de instanciarse acá (antes era
 * `const registerPayment = useRegisterPayment()` local a este componente) —
 * ver CashierPage para el motivo: este componente se desmonta como
 * consecuencia normal de un cobro exitoso (la mesa deja de tener saldo
 * pendiente o se libera), y con la mutación viviendo acá, ese desmontaje
 * podía ganarle de mano al callback `onSuccess` de la propia llamada,
 * perdiendo el aviso aunque el pago ya estuviera guardado en el backend.
 */
function PaymentFormFields({ idMesa, saldoPendiente, metodos, onPaid, registerPayment }) {
  const nextRowId = useRef(1);

  const createRow = () => ({
    key: nextRowId.current++,
    idMetodoPago: String(metodos[0]?.idMetodoPago ?? ''),
    monto: '',
    nroRecibo: '',
  });

  const [rows, setRows] = useState(() => [createRow()]);

  const isPending = registerPayment.isPending;

  const targetCents = toCents(saldoPendiente);
  const validations = rows.map(validateRow);
  const distributedCents = validations.reduce((sum, v) => sum + v.cents, 0);
  const diffCents = distributedCents - targetCents;

  const allRowsValid = rows.length > 0 && validations.every((v) => v.valid);
  const amountMatches = distributedCents === targetCents;
  const canSubmit = !isPending && allRowsValid && amountMatches && targetCents > 0;

  const updateRow = (key, patch) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((current) => [...current, createRow()]);

  const removeRow = (key) => {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    // nroRecibo es opcional para TODOS los métodos: se omite del payload si
    // quedó vacío o solo con espacios, en vez de mandar un string en blanco.
    const pagos = rows.map((row) => {
      const item = {
        idMetodoPago: Number(row.idMetodoPago),
        montoPagado: Number(row.monto.trim()),
      };
      const recibo = row.nroRecibo.trim();
      if (recibo !== '') item.nroRecibo = recibo;
      return item;
    });

    registerPayment.mutate(
      { idMesa, pagos },
      // Este callback corre después de que el hook terminó de refetchear,
      // así la pantalla ya tiene el estado real cuando reacciona al resultado.
      { onSuccess: (data) => onPaid(data) },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const isRowInvalid = !validations[index].valid && row.monto.trim() !== '';

          return (
            <div key={row.key} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
              <div className="min-w-[8rem] flex-1">
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`metodo-${row.key}`}>
                  Método
                </label>
                <select
                  id={`metodo-${row.key}`}
                  className={selectClass}
                  value={row.idMetodoPago}
                  disabled={isPending}
                  onChange={(event) => updateRow(row.key, { idMetodoPago: event.target.value })}
                >
                  {metodos.map((metodo) => (
                    <option key={metodo.idMetodoPago} value={metodo.idMetodoPago}>
                      {metodo.nombreMetodo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-28">
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`monto-${row.key}`}>
                  Monto
                </label>
                <Input
                  id={`monto-${row.key}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  aria-invalid={isRowInvalid}
                  value={row.monto}
                  disabled={isPending}
                  onChange={(event) => updateRow(row.key, { monto: event.target.value })}
                />
              </div>

              <div className="w-32">
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`recibo-${row.key}`}>
                  Nro. recibo <span className="text-muted-foreground/70">(opcional)</span>
                </label>
                <Input
                  id={`recibo-${row.key}`}
                  type="text"
                  value={row.nroRecibo}
                  disabled={isPending}
                  onChange={(event) => updateRow(row.key, { nroRecibo: event.target.value })}
                />
              </div>

              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => removeRow(row.key)}
                  disabled={isPending}
                  aria-label="Quitar método"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        disabled={isPending}
        className="h-9 self-start"
      >
        <Plus className="h-3.5 w-3.5" /> Agregar método
      </Button>

      <dl className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
        <div className="flex items-baseline justify-between">
          <dt className="text-muted-foreground">Saldo a cobrar</dt>
          <dd className="text-base font-bold text-foreground">{formatCurrency(saldoPendiente)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-muted-foreground">Distribuido</dt>
          <dd className="font-semibold text-foreground">{formatCurrency(fromCents(distributedCents))}</dd>
        </div>
        {diffCents !== 0 && (
          <div className="flex items-baseline justify-between border-t border-border pt-1.5">
            <dt className={diffCents > 0 ? 'font-medium text-destructive' : 'font-medium text-warning-foreground'}>
              {diffCents > 0 ? 'Exceso' : 'Restante por asignar'}
            </dt>
            <dd className={`text-base font-bold ${diffCents > 0 ? 'text-destructive' : 'text-warning-foreground'}`}>
              {formatCurrency(fromCents(Math.abs(diffCents)))}
            </dd>
          </div>
        )}
      </dl>

      {registerPayment.isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {registerPayment.error?.message || 'No se pudo registrar el cobro. Revisá los datos e intentá de nuevo.'}
        </p>
      )}

      <Button type="submit" disabled={!canSubmit} className="h-11 w-full">
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner size="sm" />
            Cobrando...
          </span>
        ) : (
          'Cobrar'
        )}
      </Button>
    </form>
  );
}

/**
 * Formulario de cobro de una mesa. Solo arma los campos cuando los métodos
 * de pago cargaron correctamente; mientras tanto (o si fallaron) muestra un
 * estado contenido, sin bloquear el resto de la pantalla de Caja.
 *
 * Props:
 * - idMesa: mesa a cobrar
 * - saldoPendiente: objetivo exacto de la distribución (NO totalAdeudado:
 *   el backend suma los pagos previos por su cuenta)
 * - onPaid: recibe la respuesta del POST para que la pantalla decida qué
 *   hacer según `mesaLiberada`
 * - registerPayment: mutation de useRegisterPayment(), instanciada en
 *   CashierPage (ver PaymentFormFields para el motivo) y pasada tal cual
 *   hasta acá — este componente no la toca, solo la reenvía.
 */
export default function PaymentForm({ idMesa, saldoPendiente, onPaid, registerPayment }) {
  const { data: metodos, isLoading, isError, refetch } = usePaymentMethods();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner size="sm" className="text-muted-foreground" />
      </div>
    );
  }

  if (isError || !metodos?.length) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
        <span className="text-sm text-muted-foreground">
          No se pudieron cargar los métodos de pago, así que no es posible cobrar todavía.
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()} className="shrink-0">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <PaymentFormFields
      idMesa={idMesa}
      saldoPendiente={saldoPendiente}
      metodos={metodos}
      onPaid={onPaid}
      registerPayment={registerPayment}
    />
  );
}
