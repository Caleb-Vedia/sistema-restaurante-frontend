import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck, DoorOpen, RefreshCw, Wallet } from 'lucide-react';
import { useCurrentCashRegister } from '../../hooks/useCurrentCashRegister';
import { useOpenCashRegister } from '../../hooks/useOpenCashRegister';
import { TABLES_KEY, useTables } from '../../hooks/useTables';
import { useTableBalance } from '../../hooks/useTableBalance';
import { useRegisterPayment } from '../../hooks/useRegisterPayment';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/Button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import PaymentForm from '../../components/cashier/PaymentForm';
import PaymentHistory from '../../components/cashier/PaymentHistory';
import CloseCashRegisterWizard from '../../components/cashier/close/CloseCashRegisterWizard';
import CashRegisterCloseResult from '../../components/cashier/CashRegisterCloseResult';
import PaymentRecovery from '../../components/cashier/PaymentRecovery';
import ReleaseTableAction from '../../components/cashier/ReleaseTableAction';
import TableConsumption from '../../components/cashier/TableConsumption';
import ShiftActivity from '../../components/cashier/ShiftActivity';
import { formatCurrency, formatTime } from '../../utils';

/**
 * Fila compacta de "no se pudo cargar X + reintentar", repetida varias veces
 * en este archivo (mesas, saldo, historial, métodos...). Se extrae UNA vez
 * acá porque las 5 copias son idénticas dentro del mismo archivo — no se
 * exporta ni se comparte con otros componentes de Caja (PaymentForm,
 * PaymentHistory, ShiftActivity siguen con su propia copia local, mismo
 * criterio de "duplicar entre archivos, no entre usos del mismo archivo"
 * que ya sigue el resto del módulo).
 */
function InlineRetry({ message, onRetry }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
      <span className="text-sm text-muted-foreground">{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="shrink-0">
        <RefreshCw className="h-3.5 w-3.5" /> Reintentar
      </Button>
    </div>
  );
}

/**
 * Valida el monto inicial en efectivo con las mismas reglas que el backend
 * (requerido, número, >= 0, máximo 2 decimales) para dar feedback inmediato
 * sin depender de un roundtrip al servidor. Un regex sobre el string crudo
 * evita los problemas de precisión de comparar decimales con Math.round.
 */
function parseMontoInicial(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { error: 'El monto es obligatorio.' };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { error: 'Ingresá un número válido, mayor o igual a 0, con hasta 2 decimales.' };
  }
  return { value: Number(trimmed) };
}

/**
 * Formulario para iniciar el turno cuando GET /caja/actual devolvió null.
 * Tras el éxito no navega a ningún lado: useOpenCashRegister invalida
 * ['caja','actual'] y CashierPage, suscripta a esa misma query, pasa sola
 * al estado "caja abierta" en cuanto el refetch trae el objeto de caja.
 */
function OpenCashRegisterForm() {
  const openCashRegister = useOpenCashRegister();
  const [monto, setMonto] = useState('');
  const [validationError, setValidationError] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (openCashRegister.isPending) return;

    const result = parseMontoInicial(monto);
    if (result.error) {
      setValidationError(result.error);
      return;
    }

    setValidationError(null);
    openCashRegister.mutate({ montoInicialEfectivo: result.value });
  };

  const errorMessage = validationError
    ?? (openCashRegister.isError
      ? openCashRegister.error?.message || 'No se pudo abrir la caja. Intentá de nuevo.'
      : null);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </div>
          <CardTitle>Abrir caja</CardTitle>
          <CardDescription>
            Registrá el monto inicial en efectivo para empezar el turno. Vas a poder ver
            las mesas y cobrar recién después de abrir caja.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="montoInicial" className="text-sm font-medium text-foreground">
                Monto inicial en efectivo
              </label>
              <Input
                id="montoInicial"
                name="montoInicial"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={monto}
                onChange={(event) => {
                  setMonto(event.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={openCashRegister.isPending}
              />
            </div>

            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="h-10 w-full" disabled={openCashRegister.isPending}>
              {openCashRegister.isPending ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  Abriendo...
                </span>
              ) : (
                'Abrir caja'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Resumen compacto del turno. Solo campos reales de /caja/actual — nada de
 * monto esperado, ventas ni cajero: el backend no los expone mientras la
 * caja está abierta, y el arqueo se conoce recién al cerrar.
 *
 * `action` permite colgar la acción de cierre en la misma barra, sin
 * inventar otra estructura paralela.
 */
function CashRegisterSummary({ caja, action }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-success-foreground">
        <span className="h-2 w-2 rounded-full bg-success" />
        Caja abierta
      </span>
      <span className="text-sm text-muted-foreground">
        Desde las <span className="font-medium text-foreground">{formatTime(caja.abiertoEl)}</span>
      </span>
      <span className="text-sm text-muted-foreground">
        Fondo inicial{' '}
        <span className="font-medium text-foreground">{formatCurrency(caja.montoInicialEfectivo)}</span>
      </span>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

/** Mesa: libre → neutro, ocupada → info, cuenta_solicitada → warning. Mismo mapeo semántico que usa el módulo Cliente. */
const MESA_ESTADO_CONFIG = {
  libre: { label: 'Libre', className: 'border-border bg-muted text-muted-foreground' },
  ocupada: { label: 'Ocupada', className: 'border-info/30 bg-info/15 text-info-foreground' },
  cuenta_solicitada: { label: 'Cuenta solicitada', className: 'border-warning/30 bg-warning/15 text-warning-foreground' },
};

/**
 * Fila de una mesa. Todas las mesas son seleccionables — incluida `libre`:
 * aunque una mesa libre no tenga deuda ni cobro posible, su última sesión
 * (cerrada) sigue teniendo historial de pagos consultable. Lo que cambia
 * según `sesionActiva` es qué se muestra en el panel de detalle, no si la
 * fila se puede clickear.
 *
 * No se muestra saldo en esta fila: `/mesas` no lo trae (evitar el N+1 de
 * pedirle el saldo a cada mesa del listado es una decisión explícita del
 * backend, ver useTableBalance) — solo la mesa SELECCIONADA lo consulta.
 */
function TableRow({ mesa, isSelected, onSelect }) {
  const estadoConfig = MESA_ESTADO_CONFIG[mesa.estado] ?? MESA_ESTADO_CONFIG.libre;

  return (
    <button
      type="button"
      onClick={() => onSelect(mesa)}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        isSelected ? 'border-primary/50 bg-primary/10' : 'border-border bg-card hover:bg-muted/60'
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{mesa.nombreMesa}</p>
        {mesa.sesionActiva && (
          <p className="truncate text-xs text-muted-foreground">
            Abierta desde {formatTime(mesa.sesionActiva.abiertaEl)}
          </p>
        )}
      </div>
      <Badge variant="outline" className={`shrink-0 ${estadoConfig.className}`}>
        {estadoConfig.label}
      </Badge>
    </button>
  );
}

/**
 * Listado de mesas, con su propio loading/error/vacío — un fallo acá no debe
 * tumbar el resumen de caja abierta.
 *
 * Recibe `mesas`/`isLoading`/`isError`/`refetch` por props en vez de llamar
 * a useTables() acá adentro: CashierPage necesita ese mismo listado para
 * derivar `selectedMesa` por id (ver comentario en CashierPage), así que la
 * consulta vive una sola vez arriba y se comparte.
 */
function TablesPanel({ mesas, isLoading, isError, refetch, selectedMesa, onSelectMesa }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Mesas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Spinner size="md" className="text-muted-foreground" />
          </div>
        )}

        {isError && <InlineRetry message="No se pudieron cargar las mesas." onRetry={refetch} />}

        {!isLoading && !isError && mesas.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No hay mesas registradas.</p>
        )}

        {!isLoading && !isError && mesas.length > 0 && (
          <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[38rem]">
            {mesas.map((mesa) => (
              <TableRow
                key={mesa.idMesa}
                mesa={mesa}
                isSelected={selectedMesa?.idMesa === mesa.idMesa}
                onSelect={onSelectMesa}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Total / Pagado / Saldo de la mesa con sesión activa — máxima jerarquía
 * visual del panel: son los tres números que la cajera necesita leer de un
 * vistazo antes de cobrar.
 */
function BalanceSummary({ balance }) {
  if (balance.totalAdeudado === 0 && balance.saldoPendiente === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
        Sin consumos registrados
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">Total</p>
        <p className="mt-1 text-lg font-bold text-foreground sm:text-xl">{formatCurrency(balance.totalAdeudado)}</p>
      </div>
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">Pagado</p>
        <p className="mt-1 text-lg font-bold text-foreground sm:text-xl">{formatCurrency(balance.totalPagado)}</p>
      </div>
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
        <p className="text-xs text-muted-foreground">Saldo</p>
        <p className="mt-1 text-lg font-bold text-primary sm:text-xl">{formatCurrency(balance.saldoPendiente)}</p>
      </div>
    </div>
  );
}

/**
 * Mesa seleccionada: nombre, estado/saldo y consumo actual. Todo READ-ONLY
 * salvo la lectura del saldo en sí — el cobro y el historial viven en
 * `TableBillingPanel`, columna aparte a partir de `xl` (ver CashierPage),
 * para que Cobro tenga su propio espacio y no quede aplastado debajo de
 * todo lo demás en pantallas anchas.
 *
 * `balance`/`isLoading`/`isError`/`refetch` llegan por props: la query vive
 * una sola vez en CashierPage (useTableBalance), compartida con
 * TableBillingPanel — no se duplica la consulta entre las dos columnas.
 */
function TableSummaryPanel({ selectedMesa, tieneSesionActiva, balance, isLoading, isError, refetch }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Mesa seleccionada</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!selectedMesa && (
          <EmptyState
            icon={<ClipboardCheck />}
            title="Elegí una mesa"
            description="Seleccioná una mesa para ver su cuenta y su consumo actual."
          />
        )}

        {selectedMesa && !tieneSesionActiva && (
          <>
            <div>
              <p className="text-lg font-bold leading-tight text-foreground">{selectedMesa.nombreMesa}</p>
              <p className="text-xs text-muted-foreground">
                Estado: {MESA_ESTADO_CONFIG[selectedMesa.estado]?.label ?? selectedMesa.estado}
              </p>
            </div>
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
              Sin sesión activa. No hay una cuenta pendiente para cobrar.
            </p>
          </>
        )}

        {selectedMesa && tieneSesionActiva && isLoading && (
          <div className="flex items-center justify-center py-10">
            <Spinner size="md" className="text-muted-foreground" />
          </div>
        )}

        {selectedMesa && tieneSesionActiva && isError && (
          <InlineRetry
            message="No se pudo consultar la cuenta. La sesión pudo haberse cerrado mientras tanto."
            onRetry={refetch}
          />
        )}

        {selectedMesa && tieneSesionActiva && !isLoading && !isError && balance && (
          <>
            <div>
              <p className="text-lg font-bold leading-tight text-foreground">{balance.nombreMesa}</p>
              <p className="text-xs text-muted-foreground">Sesión abierta desde {formatTime(balance.abiertaEl)}</p>
            </div>

            <BalanceSummary balance={balance} />

            <TableConsumption idMesa={balance.idMesa} idSesion={balance.idSesion} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Cobro + liberar mesa de la mesa seleccionada — la zona de acción
 * principal de Caja. Mismas condiciones exactas que antes decidía
 * `TableDetailPanel` (no se tocó ninguna regla, solo se separó en su propia
 * columna): con saldo pendiente se ofrece cobrar, con saldo en 0 se ofrece
 * liberar, y ninguna de las dos si `cobroBloqueado` (recuperación de un
 * cobro previo sin liberar, ver PaymentRecovery en CashierPage).
 *
 * El historial vive en `PaymentHistory`, card HERMANA (no anidada acá
 * abajo): ese componente ya trae su propio `Card`, y anidar un Card dentro
 * de otro Card duplicaría el marco/ring sin necesidad — ver `TableBillingPanel`.
 *
 * `registerPayment` se recibe desde CashierPage y se reenvía tal cual a
 * `PaymentForm` — ver el comentario en CashierPage sobre por qué la
 * mutación vive ahí arriba y no dentro del formulario.
 */
function CobroPanel({ selectedMesa, tieneSesionActiva, balance, isLoading, isError, cobroBloqueado, onPaid, onReleased, registerPayment }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Cobro</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!selectedMesa && (
          <p className="py-6 text-center text-sm text-muted-foreground">Elegí una mesa para ver el cobro.</p>
        )}

        {selectedMesa && !tieneSesionActiva && (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin sesión activa: no hay nada que cobrar.</p>
        )}

        {selectedMesa && tieneSesionActiva && isLoading && (
          <div className="flex items-center justify-center py-10">
            <Spinner size="md" className="text-muted-foreground" />
          </div>
        )}

        {selectedMesa && tieneSesionActiva && isError && (
          <p className="py-6 text-center text-sm text-muted-foreground">No se pudo consultar la cuenta de esta mesa.</p>
        )}

        {selectedMesa && tieneSesionActiva && !isLoading && balance && (
          <>
            {cobroBloqueado && (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning-foreground">
                Hay un cobro reciente pendiente de resolver arriba antes de seguir operando esta mesa.
              </p>
            )}

            {balance.saldoPendiente > 0 && !cobroBloqueado && (
              <PaymentForm
                idMesa={balance.idMesa}
                idSesion={balance.idSesion}
                disabled={isError}
                saldoPendiente={balance.saldoPendiente}
                onPaid={onPaid}
                registerPayment={registerPayment}
              />
            )}

            {balance.saldoPendiente === 0 && !cobroBloqueado && !isError && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  Sin saldo pendiente.
                </p>
                <ReleaseTableAction idMesa={balance.idMesa} nombreMesa={balance.nombreMesa} onReleased={onReleased} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Envuelve `CobroPanel` + `PaymentHistory` como dos cards apiladas: es lo
 * que ocupa la segunda sub-columna de `xl` en CashierPage. El historial se
 * muestra siempre que haya una mesa elegida (activa o no — igual que en el
 * comportamiento original, `/pagos?idMesa=` no exige sesión activa).
 */
function TableBillingPanel(props) {
  const { selectedMesa, idCierre } = props;
  return (
    <div className="flex flex-col gap-4">
      <CobroPanel {...props} />
      {selectedMesa && <PaymentHistory idMesa={selectedMesa.idMesa} idSesion={selectedMesa.sesionActiva?.idSesion ?? null} idCierre={idCierre} />}
    </div>
  );
}

/**
 * Sección informativa de métodos de pago. Todavía no arma inputs de cobro
 * (eso es de la próxima fase): solo lista los métodos activos, y si la
 * consulta falla queda contenido acá — nunca bloquea el resto de la
 * pantalla (mesas, resumen de caja).
 */
function PaymentMethodsSection() {
  const { data: metodos, isLoading, isError, refetch } = usePaymentMethods();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Métodos de pago disponibles</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Spinner size="sm" className="text-muted-foreground" />
          </div>
        )}

        {isError && <InlineRetry message="No se pudieron cargar los métodos de pago." onRetry={refetch} />}

        {!isLoading && !isError && (
          <ul className="flex flex-wrap gap-2">
            {metodos.map((metodo) => (
              <li key={metodo.idMetodoPago}>
                <Badge variant="outline">{metodo.nombreMetodo}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Cobro cerrado limpiamente (mesaLiberada true). Feedback efímero de UI, no
 * datos del servidor: React Query sigue siendo la fuente de verdad.
 *
 * El caso mesaLiberada false NO se muestra acá: tiene su propio componente
 * (PaymentRecovery), porque además del aviso ofrece la recuperación.
 */
function PaymentOutcomeBanner() {
  return (
    <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success-foreground" role="status">
      Cobro registrado correctamente.
    </div>
  );
}

/**
 * Pantalla de Caja. Dos estados principales según GET /caja/actual:
 * sin caja abierta (formulario de apertura) o con caja abierta (resumen +
 * mesas + detalle de la mesa elegida + cobro + métodos de pago).
 *
 * Tema: light global (los mismos tokens de :root que usa el módulo
 * Cliente — crema/blanco, carbón, terracota, success/warning/destructive/
 * info), NO la clase `dark`. Caja usó `.dark` en un fix visual anterior
 * (activaba los tokens oscuros de index.css dentro de este subárbol) pero
 * se retiró a pedido: Operación ahora pinta su propio `bg-background`
 * claro para separarse limpiamente del slate-900 de StaffLayout (compartido
 * con Cocina/Bebidas, que sigue sin tocarse) — mismo mecanismo de "una
 * capa de color propia sobre el fondo del layout" que antes usaba `.dark`,
 * solo que ahora resuelve a los valores CLAROS de `:root` porque ningún
 * ancestro tiene la clase `dark`. Los tokens `.dark` de index.css NO se
 * tocan ni se eliminan: siguen ahí para quien los active en el futuro,
 * Caja simplemente ya no lo hace.
 *
 * Estructura del wrapper: exterior full-width con el fondo → interior
 * centrado con max-width. `<main>` de StaffLayout le da a Caja (y solo a
 * Caja: Cocina/Bebidas reciben su propio wrapper `max-w-7xl` DENTRO de
 * `<main>`, ver ese archivo) el ancho completo sin ningún `max-w` propio, así
 * que el div exterior de acá (`flex-1 bg-background`) puede pintar ese fondo
 * claro hasta el borde real del layout, sin dejar gutters del slate-900 de
 * StaffLayout visibles a los costados cuando el contenido llega a su
 * max-width — el bug que motivó este cambio. El centrado real del contenido
 * (`mx-auto max-w-7xl p-4`) se mueve a un div interior, así el ancho
 * "razonable" de lectura no se pierde, solo deja de estar atado al ancho del
 * FONDO. Nada de `100vw`, márgenes negativos ni alturas artificiales: el
 * exterior ya es genuinamente full-width porque su ancestro dejó de topearlo.
 *
 * El exterior sigue usando `flex-1` (no un `min-h` adivinado): `<main>` sigue
 * siendo `flex flex-col`, así que este div tiene un alto real definido por el
 * propio layout y lo llena exacto, sin resto de slate-900 abajo.
 *
 * El wizard de cierre y su resultado (CloseCashRegisterWizard,
 * CashRegisterCloseResult) usan esta MISMA estructura de dos capas — ya no
 * quedan "fuera" del tema claro de Caja ni de su ancho completo.
 */
function CashierTurn({ caja, onClosed }) {
  const queryClient = useQueryClient();
  const [closingOpen, setClosingOpen] = useState(false);
  const tablesQuery = useTables({ enabled: !closingOpen, refetchInterval: closingOpen ? false : 4000 });
  const {
    data: mesas,
    isLoading: mesasLoading,
    isError: mesasError,
    refetch: refetchMesas,
  } = tablesQuery;

  // Se guarda solo el id, no el objeto mesa completo: así `selectedMesa` se
  // deriva del listado ['mesas'] en cada render (mismo patrón que
  // PaymentRecovery con `outcome.idMesa`). Guardar un snapshot del objeto
  // dejaría la mesa seleccionada mostrando estado viejo (p. ej. LIBRE)
  // después de un refetch que ya trae CUENTA_SOLICITADA — como puede pasar
  // al anular un pago que reabre la sesión.
  const [selectedMesaId, setSelectedMesaId] = useState(null);
  const selectedMesa = mesas?.find((m) => m.idMesa === selectedMesaId) ?? null;

  // Antes vivía dentro de TableDetailPanel; se sube acá para que
  // TableSummaryPanel y TableBillingPanel (columnas separadas desde `xl`)
  // compartan la MISMA consulta sin duplicarla.
  const tieneSesionActiva = !!selectedMesa?.sesionActiva;
  const idMesaParaSaldo = tieneSesionActiva ? selectedMesa.idMesa : null;
  const idSesion = selectedMesa?.sesionActiva?.idSesion ?? null;
  const selectionKey = [selectedMesaId, idSesion ?? 'libre'].join(':');
  const { data: balance, isLoading: balanceLoading, isError: balanceError, refetch: refetchBalance } =
    useTableBalance(idMesaParaSaldo, idSesion, { enabled: !closingOpen });

  // Vive ACÁ, no dentro de PaymentForm, a propósito: un cobro exitoso hace
  // que la mesa deje de tener saldo pendiente (o se libere), lo que
  // desmonta PaymentForm como consecuencia normal del propio éxito. Si la
  // mutación viviera ahí adentro, ese desmontaje podía ganarle de mano al
  // callback `onSuccess` pasado a `mutate(...)`, perdiendo el aviso aunque
  // el pago ya estuviera guardado en el backend (causa confirmada en QA).
  // CashierPage nunca se desmonta por cambios de selección/saldo, así que
  // el mismo observer de la mutation sobrevive hasta que el callback corre,
  // sin importar qué pase con los componentes hijos mientras tanto.
  const registerPayment = useRegisterPayment();

  const [paymentOutcome, setPaymentOutcome] = useState(null);

  // Cambiar de mesa descarta el feedback del cobro anterior: ese aviso
  // pertenece a la operación que se acaba de hacer, no a la nueva selección.
  // `registerPayment.reset()` limpia isError/isSuccess/data de un intento
  // previo — necesario ahora que la mutation es compartida entre
  // selecciones (ver comentario más arriba): sin esto, un cobro fallido en
  // la mesa A podía seguir mostrando ese error al elegir la mesa B.
  const handleSelectMesa = (mesa) => {
    setPaymentOutcome(null);
    registerPayment.reset();
    setSelectedMesaId(mesa.idMesa);
  };

  const handlePaid = (data) => {
    if (data?.mesaLiberada) {
      // El POST puede terminar después de seleccionar otra mesa o de que
      // empiece otra visita. No descartar ese nuevo contexto por el cobro viejo.
      const idMesaPagada = data.mesa.idMesa;
      const mesaActual = queryClient.getQueryData(TABLES_KEY)?.find((m) => m.idMesa === idMesaPagada);
      const otraSesion = mesaActual?.sesionActiva != null
        && mesaActual.sesionActiva.idSesion !== data.idSesion;
      if (!otraSesion) setSelectedMesaId((id) => id === idMesaPagada ? null : id);
      setPaymentOutcome({ type: 'success' });
      return;
    }

    // Se conservan idMesa e idSesion del response REAL del POST: el recovery
    // solo puede cerrar la sesión si sigue siendo exactamente esta. idSesion
    // no se toma de ninguna otra fuente — si faltara, ninguna guarda daría
    // "misma sesión" y el botón de liberar nunca se ofrecería.
    setPaymentOutcome({
      type: 'not-released',
      idMesa: data?.mesa?.idMesa ?? selectedMesa?.idMesa,
      idSesion: data?.idSesion,
      nombreMesa: data?.mesa?.nombreMesa ?? selectedMesa?.nombreMesa ?? 'la mesa',
    });
  };

  // La sesión quedó cerrada: se suelta la selección para no consultar el
  // saldo de una sesión que ya no existe.
  const handleTableReleased = () => setSelectedMesaId(null);

  const handleRecoveryDismiss = () => {
    setPaymentOutcome(null);
    setSelectedMesaId(null);
  };

  // El cierre en 4 pasos TOMA la pantalla en vez de abrirse encima de
  // Operación. No es una decisión estética: el Paso 2 es un arqueo ciego, y
  // Operación muestra en la misma vista los "Ingresos del turno"
  // (ShiftActivity) y el saldo de la mesa seleccionada — dejarla visible al
  // costado filtraría justamente el monto que la cajera no tiene que ver
  // mientras cuenta. Operación no se modifica: se oculta mientras el wizard
  // está abierto y vuelve intacta al salir.
  if (closingOpen) {
    return (
      <div className="flex-1 bg-background text-foreground">
        <div className="mx-auto w-full max-w-7xl p-4">
          <CloseCashRegisterWizard
            caja={caja}
            onClosed={onClosed}
            onCancel={() => setClosingOpen(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4">
        <CashRegisterSummary
          caja={caja}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => setClosingOpen(true)}
              className="h-10 border-warning/40 text-warning-foreground hover:bg-warning/10"
            >
              Cerrar caja
            </Button>
          }
        />

        {paymentOutcome?.type === 'success' && <PaymentOutcomeBanner />}

        {paymentOutcome?.type === 'not-released' && (
          <PaymentRecovery
            key={paymentOutcome.idSesion}
            outcome={paymentOutcome}
            onReleased={handleTableReleased}
            onDismiss={handleRecoveryDismiss}
            tablesQuery={tablesQuery}
          />
        )}

        {/*
          Jerarquía pedida: Mesas → Mesa seleccionada/Consumo → Cobro.
          - <1024px (mobile/tablet chico): todo en una sola columna, en ese
            mismo orden (el wrapper de la derecha es un simple flex-col acá).
          - 1024–1279px (lg): 2 columnas — Mesas fija a la izquierda, el
            resto (resumen+cobro apilados) a la derecha.
          - ≥1280px (xl): el wrapper de la derecha se abre en 2 sub-columnas
            propias — Mesa/Consumo | Cobro+Historial — para que Cobro tenga
            su propio espacio real en vez de quedar aplastado al final de
            una columna larga.
        */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
          <TablesPanel
            mesas={mesas}
            isLoading={mesasLoading}
            isError={mesasError}
            refetch={refetchMesas}
            selectedMesa={selectedMesa}
            onSelectMesa={handleSelectMesa}
          />

          <div className="flex flex-col gap-4 xl:grid xl:grid-cols-2 xl:items-start">
            <TableSummaryPanel
              selectedMesa={selectedMesa}
              tieneSesionActiva={tieneSesionActiva}
              balance={balance}
              isLoading={balanceLoading}
              isError={balanceError}
              refetch={refetchBalance}
            />

            <TableBillingPanel
              key={selectionKey}
              idCierre={caja.idCierre}
              selectedMesa={selectedMesa}
              tieneSesionActiva={tieneSesionActiva}
              balance={balance}
              isLoading={balanceLoading}
              isError={balanceError}
              cobroBloqueado={paymentOutcome?.type === 'not-released'}
              onPaid={handlePaid}
              onReleased={handleTableReleased}
              registerPayment={registerPayment}
            />
          </div>
        </div>

        <ShiftActivity idCierre={caja.idCierre} />

        <PaymentMethodsSection />
      </div>
    </div>
  );
}

/** La identidad del turno separa selección, formularios y cierre de cada caja. */
export default function CashierPage() {
  const { data: caja, isLoading, isError, refetch } = useCurrentCashRegister({ refetchInterval: 4000 });
  // La identidad persiste también cuando /caja/actual devuelve null. Así una
  // respuesta tardía no puede sustituir el resumen de otro turno observado.
  const [closeFeedback, setCloseFeedback] = useState({ idCierre: null, resultado: null });
  if (caja && caja.idCierre !== closeFeedback.idCierre) {
    setCloseFeedback({ idCierre: caja.idCierre, resultado: null });
  }
  const lastCloseResult = closeFeedback.resultado;
  const handleClosed = (resultado) => {
    setCloseFeedback((actual) => actual.idCierre === resultado.idCierre
      ? { ...actual, resultado }
      : actual);
  };

  if (lastCloseResult) {
    return (
      <div className="flex-1 bg-background text-foreground">
        <div className="mx-auto w-full max-w-7xl p-4">
          <CashRegisterCloseResult resultado={lastCloseResult}
            onFinish={() => setCloseFeedback((actual) => ({ ...actual, resultado: null }))} />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background px-4 py-24 text-foreground">
        <Spinner size="lg" className="text-muted-foreground" />
      </div>
    );
  }

  if (isError && caja == null) {
    return (
      <div className="flex-1 bg-background text-foreground">
        <div className="mx-auto w-full max-w-7xl p-4">
          <EmptyState icon={<AlertTriangle />} title="No se pudo consultar el estado de caja"
            description="Hubo un problema al conectar con el servidor. Probá de nuevo.">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" /> Reintentar
            </Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  if (caja === null) {
    return (
      <div className="flex-1 bg-background text-foreground">
        <div className="mx-auto w-full max-w-7xl p-4"><OpenCashRegisterForm /></div>
      </div>
    );
  }

  return (
    <>
      {isError && (
        <div className="bg-background px-4 py-2">
          <InlineRetry message="No se pudo actualizar el estado del turno." onRetry={refetch} />
        </div>
      )}
      <CashierTurn key={caja.idCierre} caja={caja} onClosed={handleClosed} />
    </>
  );
}
