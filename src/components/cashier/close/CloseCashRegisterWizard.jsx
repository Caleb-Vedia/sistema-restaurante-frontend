import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useCloseContext } from '../../../hooks/useCloseContext';
import { useClosePreview } from '../../../hooks/useClosePreview';
import { useCloseCashRegister } from '../../../hooks/useCloseCashRegister';
import { usePaymentMethods } from '../../../hooks/usePaymentMethods';
import Spinner from '../../ui/Spinner';
import EmptyState from '../../ui/EmptyState';
import { Card, CardContent } from '../../ui/Card';
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
import StepReviewShift from './StepReviewShift';
import StepBlindCount from './StepBlindCount';
import StepReconciliation from './StepReconciliation';
import { buildCierreBody } from '../../../utils/arqueoCaja';
import { formatCurrency, formatDateTime } from '../../../utils';

const PASOS = [
  { numero: 1, label: 'Revisar turno' },
  { numero: 2, label: 'Arqueo ciego' },
  { numero: 3, label: 'Conciliación' },
  { numero: 4, label: 'Cierre definitivo' },
];

/**
 * Indicador de progreso. El paso 4 solo se marca "en curso" mientras el PATCH
 * está en vuelo: hasta entonces el flujo entero es reversible.
 */
function StepIndicator({ pasoActual, cerrando }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {PASOS.map((paso, indice) => {
        const activo = paso.numero === pasoActual || (paso.numero === 4 && cerrando);
        const completado = paso.numero < pasoActual;

        return (
          <li key={paso.numero} className="flex items-center gap-2">
            {indice > 0 && <span className="text-muted-foreground/40">›</span>}
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                activo
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : completado
                    ? 'border-success/30 bg-success/15 text-success-foreground'
                    : 'border-border bg-muted text-muted-foreground'
              }`}
            >
              <span className="font-bold">{completado ? '✓' : paso.numero}</span>
              {paso.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function WizardShell({ caja, pasoActual, cerrando, children }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-foreground">Cierre de caja</h2>
            <p className="text-xs text-muted-foreground">
              Turno abierto: {formatDateTime(caja.abiertoEl)} · Fondo inicial:{' '}
              {formatCurrency(caja.montoInicialEfectivo)}
            </p>
          </div>
          <StepIndicator pasoActual={pasoActual} cerrando={cerrando} />
        </CardContent>
      </Card>

      {children}
    </div>
  );
}

/**
 * Cierre de caja en 4 pasos.
 *
 *   1. Revisar turno   — GET /caja/actividad + GET /caja/cierre/contexto
 *   2. Arqueo ciego    — sin red: solo carga de montos verificados
 *   3. Conciliación    — POST /caja/cierre/preview (repetible, no persiste)
 *   4. Cierre defintivo— PATCH /caja/cerrar (ÚNICA operación irreversible)
 *
 * Los pasos 1 a 3 son reversibles y no escriben nada. El PATCH solo puede
 * dispararse desde el diálogo de confirmación del paso 4, al que únicamente se
 * llega desde Conciliación: no hay ningún otro camino en este archivo que lo
 * llame.
 *
 * Estado del arqueo
 * -----------------
 * `montos` y `observacion` viven acá, no dentro de los pasos, para que volver
 * 3 → 2 a corregir CONSERVE lo cargado. En cambio `preview` se descarta al
 * volver: un preview calculado con otros montos no puede quedar en pantalla.
 *
 * El último preview exitoso se guarda en estado propio en vez de leerlo de la
 * mutation: al "Recalcular", React Query limpia `data` mientras la nueva
 * llamada está en vuelo, y la pantalla quedaría sin números a mitad del paso 3.
 *
 * Props:
 * - caja: objeto de /caja/actual (para la cabecera)
 * - onClosed: recibe el resumen del PATCH exitoso
 * - onCancel: sale del wizard sin cerrar nada
 */
export default function CloseCashRegisterWizard({ caja, onClosed, onCancel }) {
  const metodosPago = usePaymentMethods();
  const preview = useClosePreview();
  const closeCashRegister = useCloseCashRegister({ onClosed });

  const [paso, setPaso] = useState(1);
  // Solo el paso de revisión se refresca; no alterar métodos/conteos mientras
  // se completa el arqueo ni recalcular previews automáticamente.
  const contexto = useCloseContext({ idCierre: caja.idCierre, refetchInterval: paso === 1 ? 4000 : false });
  const [montos, setMontos] = useState({});
  const [observacion, setObservacion] = useState('');
  const [ultimoPreview, setUltimoPreview] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /**
   * Métodos del arqueo, proyectados a lo MÍNIMO que el paso 2 necesita.
   *
   * La lista sale de `contexto.detalle` (fuente del backend: métodos activos
   * más los dados de baja que igual cobraron en el turno), nunca de una lista
   * fija. De /metodos-pago se toma SOLO el `codigo`, que el detalle del cierre
   * no incluye y que decide la etiqueta del campo; un método que no esté ahí
   * (dado de baja) queda con codigo null y cae en la etiqueta genérica.
   *
   * `montoEsperado` se descarta a propósito acá: así el arqueo ciego no lo
   * recibe siquiera como prop.
   */
  const codigoPorMetodo = new Map(
    (metodosPago.data ?? []).map((metodo) => [metodo.idMetodoPago, metodo.codigo ?? null]),
  );
  const metodosArqueo = (contexto.data?.detalle ?? []).map((fila) => ({
    idMetodoPago: fila.idMetodoPago,
    nombreMetodo: fila.nombreMetodo,
    codigo: codigoPorMetodo.get(fila.idMetodoPago) ?? null,
  }));

  const hayDiferencia =
    ultimoPreview?.diferenciaTotal != null && ultimoPreview.diferenciaTotal !== 0;

  const construirBody = () =>
    buildCierreBody({
      idsMetodos: metodosArqueo.map((metodo) => metodo.idMetodoPago),
      montos,
      observacion,
      // La nota solo viaja si la pantalla la está ofreciendo, es decir si el
      // preview vigente dio diferencia distinta de cero. Si el usuario la
      // escribió y después corrigió los montos hasta cuadrar, no se manda —
      // pero tampoco se borra del formulario, por si vuelve a diferir.
      incluirObservacion: hayDiferencia,
    });

  const irAConciliacion = () => {
    closeCashRegister.reset();
    preview.mutate(construirBody(), {
      onSuccess: (resultado) => {
        setUltimoPreview(resultado);
        setPaso(3);
      },
    });
  };

  const recalcular = () => {
    closeCashRegister.reset();
    preview.mutate(construirBody(), {
      onSuccess: (resultado) => setUltimoPreview(resultado),
    });
  };

  // Volver a corregir descarta el preview: lo que se ve en Conciliación tiene
  // que corresponder siempre a los montos actuales.
  const volverAlArqueo = () => {
    closeCashRegister.reset();
    preview.reset();
    setUltimoPreview(null);
    setPaso(2);
  };

  const volverARevisar = () => {
    closeCashRegister.reset();
    preview.reset();
    setUltimoPreview(null);
    setPaso(1);
    // El turno pudo moverse mientras se cargaba el arqueo (un cobro, una mesa
    // que pidió la cuenta): se vuelve con la foto al día, no con la de antes.
    contexto.refetch();
  };

  /**
   * Paso 4. Único punto del flujo que llama a PATCH /caja/cerrar.
   *
   * No confía en el preview: si el backend revalidó y devolvió 409 (una mesa
   * pidió la cuenta después del preview, u otra terminal cerró el turno), NO
   * se muestra ningún éxito — el usuario se queda en Conciliación con el
   * mensaje real del backend, y se vuelve a pedir el preview para que el
   * estado en pantalla refleje lo que ahora bloquea el cierre.
   */
  const confirmarCierre = () => {
    setConfirmOpen(false);
    closeCashRegister.mutate(construirBody(), {
      onError: () => {
        preview.mutate(construirBody(), {
          onSuccess: (resultado) => setUltimoPreview(resultado),
        });
      },
    });
  };

  if (contexto.isLoading || metodosPago.isLoading) {
    return (
      <WizardShell caja={caja} pasoActual={paso} cerrando={false}>
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" className="text-muted-foreground" />
        </div>
      </WizardShell>
    );
  }

  if (contexto.isError || metodosPago.isError) {
    return (
      <WizardShell caja={caja} pasoActual={paso} cerrando={false}>
        <Card>
          <CardContent>
            <EmptyState
              icon={<AlertTriangle />}
              title="No se pudo preparar el cierre"
              description={
                contexto.error?.message ||
                metodosPago.error?.message ||
                'Hubo un problema al conectar con el servidor.'
              }
            >
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Volver a Operación
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    contexto.refetch();
                    metodosPago.refetch();
                  }}
                >
                  Reintentar
                </Button>
              </div>
            </EmptyState>
          </CardContent>
        </Card>
      </WizardShell>
    );
  }

  return (
    <WizardShell caja={caja} pasoActual={paso} cerrando={closeCashRegister.isPending}>
      {paso === 1 && (
        <StepReviewShift
          contexto={contexto.data}
          onNext={() => setPaso(2)}
          onCancel={onCancel}
        />
      )}

      {paso === 2 && (
        <StepBlindCount
          metodos={metodosArqueo}
          montos={montos}
          onChangeMonto={(idMetodoPago, valor) =>
            setMontos((actuales) => ({ ...actuales, [idMetodoPago]: valor }))
          }
          onNext={irAConciliacion}
          onBack={() => setPaso(1)}
          isPending={preview.isPending}
          errorMessage={
            preview.isError
              ? preview.error?.message || 'No se pudo calcular la conciliación.'
              : null
          }
        />
      )}

      {paso === 3 && ultimoPreview && (
        <StepReconciliation
          preview={ultimoPreview}
          observacion={observacion}
          onChangeObservacion={setObservacion}
          onRecalcular={recalcular}
          onBackToCount={volverAlArqueo}
          onBackToReview={volverARevisar}
          onConfirmar={() => setConfirmOpen(true)}
          isRecalculando={preview.isPending}
          isCerrando={closeCashRegister.isPending}
          errorMessage={
            closeCashRegister.isError
              ? closeCashRegister.error?.message || 'No se pudo cerrar la caja.'
              : preview.isError
                ? preview.error?.message || 'No se pudo recalcular la conciliación.'
                : null
          }
        />
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar el turno definitivamente?</DialogTitle>
            <DialogDescription>
              Esta es la única acción irreversible del cierre: el turno queda cerrado con
              el arqueo que acabás de conciliar y no se puede editar después.
              <br />
              <br />
              Las mesas que sigan abiertas NO se liberan ni se cobran: continúan en el
              turno siguiente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Volver a conciliación</Button>
            </DialogClose>
            <Button onClick={confirmarCierre} className="bg-warning text-warning-foreground hover:bg-warning/90">
              Cerrar caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WizardShell>
  );
}
