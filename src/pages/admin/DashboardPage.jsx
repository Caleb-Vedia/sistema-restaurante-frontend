import { useState } from 'react';
import { useOperationalDay } from '../../hooks/useOperationalDay';
import { Link } from 'react-router-dom';
import { useSalesReport } from '../../hooks/useSalesReport';
import { useTopSellingProductsReport } from '../../hooks/useTopSellingProductsReport';
import { useCurrentCashRegister } from '../../hooks/useCurrentCashRegister';
import { useTables } from '../../hooks/useTables';
import { useKdsOrders } from '../../hooks/useKdsOrders';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDateDisplay, formatDateTime } from '../../utils';

function KpiCard({ label, value, note }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-400">{note}</p>}
    </div>
  );
}

function RetryButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 text-xs font-medium text-indigo-600 hover:underline"
    >
      Reintentar
    </button>
  );
}

/**
 * KPIs de ventas de hoy: 3 celdas del grid superior (Ingresos/Tickets/Ticket
 * promedio), todas derivadas de la MISMA query (useSalesReport) — comparten
 * loading/error como una unidad, igual que ya hace SalesSection en
 * ReportsPage. Ningún valor se recalcula: se leen tal cual de
 * `resumen.*`, el backend ya los entrega calculados.
 */
function SalesKpis({ query }) {
  const { data, isLoading, isFetching, isError, error, refetch } = query;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-8 sm:col-span-2 lg:col-span-3">
        <Spinner size="md" className="text-gray-300" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white sm:col-span-2 lg:col-span-3">
        <EmptyState
          icon="⚠️"
          title="No se pudieron cargar las ventas de hoy"
          description={error?.message || 'Hubo un problema al conectar con el servidor.'}
        >
          <Button onClick={() => refetch()}>Reintentar</Button>
        </EmptyState>
      </div>
    );
  }

  const { resumen } = data;

  return (
    <>
      <KpiCard
        label="Ingresos de hoy"
        value={formatCurrency(resumen.ingresosTotales)}
        note={isFetching ? 'Actualizando...' : null}
      />
      <KpiCard label="Tickets de hoy" value={resumen.cantidadTickets} />
      <KpiCard
        label="Ticket promedio"
        value={formatCurrency(resumen.ticketPromedio)}
        note="Promedio gastado por cuenta pagada."
      />
    </>
  );
}

/**
 * Estado de la caja del turno. Solo muestra lo que GET /caja/actual
 * realmente entrega (abiertoEl, montoInicialEfectivo) — nunca esperado,
 * ventas desde apertura, diferencia ni arqueo: ese endpoint no los expone,
 * y no se inventan acá (el arqueo real solo existe al cerrar caja, en /cashier).
 */
function CashRegisterCard({ query }) {
  const { data, isLoading, isError, error, refetch } = query;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-4">
        <Spinner size="sm" className="text-gray-300" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Caja</p>
        <p className="mt-1 text-sm text-destructive">
          {error?.message || 'No se pudo consultar el estado de caja.'}
        </p>
        <RetryButton onClick={() => refetch()} />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Caja</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">Cerrada</p>
        <p className="mt-1 text-xs text-gray-400">No hay una caja abierta actualmente.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Caja</p>
      <p className="mt-1 text-2xl font-bold text-emerald-600">Abierta</p>
      <p className="mt-1 text-xs text-gray-500">Apertura: {formatDateTime(data.abiertoEl)}</p>
      <p className="text-xs text-gray-500">Fondo inicial: {formatCurrency(data.montoInicialEfectivo)}</p>
    </div>
  );
}

/**
 * Estado de mesas. GET /mesas entrega el listado crudo (sin agregador en
 * el backend) — contar por `estado` es la única agregación local aceptada
 * en este Dashboard, porque es una operación trivial sobre datos ya
 * traídos, no un cálculo de negocio (no toca montos ni cantidades vendidas).
 */
function TablesSection({ query }) {
  const { data: mesas, isLoading, isError, error, refetch } = query;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
        <Spinner size="md" className="text-gray-300" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white">
        <EmptyState
          icon="⚠️"
          title="No se pudieron cargar las mesas"
          description={error?.message || 'Hubo un problema al conectar con el servidor.'}
        >
          <Button onClick={() => refetch()}>Reintentar</Button>
        </EmptyState>
      </div>
    );
  }

  if (mesas.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Mesas</h2>
        <p className="mt-3 text-sm text-gray-400">No hay mesas registradas.</p>
      </div>
    );
  }

  const total = mesas.length;
  const rows = [
    { label: 'Libres', count: mesas.filter((mesa) => mesa.estado === 'libre').length, barClass: 'bg-gray-300' },
    { label: 'Ocupadas', count: mesas.filter((mesa) => mesa.estado === 'ocupada').length, barClass: 'bg-sky-500' },
    {
      label: 'Cuenta solicitada',
      count: mesas.filter((mesa) => mesa.estado === 'cuenta_solicitada').length,
      barClass: 'bg-amber-500',
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Mesas</h2>
        <span className="text-xs text-gray-400">Total: {total}</span>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-sm text-gray-700">{row.label}</span>
            <div className="h-2 flex-1 rounded-full bg-gray-100">
              <div
                className={`h-2 rounded-full ${row.barClass}`}
                style={{ width: total > 0 ? `${(row.count / total) * 100}%` : '0%' }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-sm font-semibold text-gray-900">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Conteo compacto de comandas de UNA área (Cocina o Bebidas). "Comandas":
 * término pedido explícitamente para este resumen, para no confundirlo con
 * "pedidos" tal como se usa en otras pantallas del cliente.
 *
 * Solo Pendientes + En preparación — nunca "Listas"
 * ----------------------------------------------------
 * `GET /pedidos/cocina` y `GET /pedidos/bebidas` (el mismo endpoint que ya
 * consumen KitchenPage/BarPage vía useKdsOrders) EXCLUYEN del lado del
 * backend los pedidos en estado "listo" — salen de la cola del KDS apenas
 * se marcan, y no existe ningún endpoint que devuelva un conteo de
 * comandas listas hoy. Por eso acá se muestran únicamente los dos estados
 * que el GET realmente entrega; no se inventa un tercer número.
 */
function KdsAreaCard({ label, query }) {
  const { data: pedidos, isLoading, isError, error, refetch } = query;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-4">
        <Spinner size="sm" className="text-gray-300" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-1 text-sm text-destructive">
          {error?.message || 'No se pudieron cargar las comandas.'}
        </p>
        <RetryButton onClick={() => refetch()} />
      </div>
    );
  }

  const pendientes = pedidos.filter((pedido) => pedido.estado === 'pendiente').length;
  const enPreparacion = pedidos.filter((pedido) => pedido.estado === 'preparacion').length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-2 flex items-center gap-5">
        <div>
          <p className="text-2xl font-bold text-gray-900">{pendientes}</p>
          <p className="text-xs text-gray-400">Pendientes</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{enPreparacion}</p>
          <p className="text-xs text-gray-400">En preparación</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Resumen operativo de Cocina y Bebidas. Reutiliza useKdsOrders tal cual —
 * mismo hook, misma query key ['pedidos', area] y mismo polling de 4s que
 * ya usan KitchenPage/BarPage — sin request nuevo, sin key duplicada, sin
 * timer propio. Cada área instancia su propia query (igual que
 * KitchenPage/BarPage con area='cocina'/'bebidas'), así que comparten
 * cache con esas pantallas: si el admin tiene /kitchen abierto en otra
 * pestaña, esta sección ve exactamente los mismos datos, no una copia.
 *
 * Sin detalle de pedido a propósito — eso vive en /kitchen y /bar.
 */
function KdsSummarySection({ cocinaQuery, bebidasQuery }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Comandas activas</h2>
      <p className="mt-0.5 text-xs text-gray-400">
        Comandas que Cocina y Bebidas todavía tienen en cola. Las que ya están listas salen de este conteo.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KdsAreaCard label="Cocina" query={cocinaQuery} />
        <KdsAreaCard label="Bebidas" query={bebidasQuery} />
      </div>
    </div>
  );
}

/**
 * Ingresos por método de pago de hoy: usa `porMetodoPago` de la MISMA
 * useSalesReport ya consumida arriba por SalesKpis — no dispara ningún
 * request adicional, no consulta GET /metodos-pago (el nombre ya viene
 * embebido en cada elemento del reporte).
 */
function PaymentMethodsSection({ query }) {
  const { data, isLoading, isError, error, refetch } = query;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-8">
        <Spinner size="md" className="text-gray-300" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white">
        <EmptyState
          icon="⚠️"
          title="No se pudieron cargar los métodos de pago de hoy"
          description={error?.message || 'Hubo un problema al conectar con el servidor.'}
        >
          <Button onClick={() => refetch()}>Reintentar</Button>
        </EmptyState>
      </div>
    );
  }

  const { porMetodoPago } = data;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Ingresos por método</h2>
      {porMetodoPago.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">No hubo pagos registrados hoy.</p>
      ) : (
        <div className="mt-3 divide-y divide-gray-100">
          {porMetodoPago.map((metodo) => (
            <div key={metodo.idMetodoPago} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">{metodo.nombreMetodo}</span>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(metodo.ingresos)}</p>
                <p className="text-xs text-gray-400">{metodo.cantidadPagos} pagos</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Top 5 platos de hoy. El backend ya ordena por cantidadVendida DESC y ya
 * limita a 5 (se manda `limite=5` explícito) — no se reordena, no se
 * vuelve a recortar el array. El número de posición es presentación de
 * frontend (index + 1). Incluye el único acceso contextual del Dashboard,
 * a /admin/reports, para no duplicar el nav de AdminLayout.
 */
function TopProductsSection({ query }) {
  const { data, isLoading, isFetching, isError, error, refetch } = query;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
        <Spinner size="md" className="text-gray-300" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white">
        <EmptyState
          icon="⚠️"
          title="No se pudo cargar el reporte de platos más vendidos"
          description={error?.message || 'Hubo un problema al conectar con el servidor.'}
        >
          <Button onClick={() => refetch()}>Reintentar</Button>
        </EmptyState>
      </div>
    );
  }

  const { platos } = data;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Top platos de hoy</h2>
        {isFetching && <p className="text-xs text-gray-400">Actualizando...</p>}
      </div>

      {platos.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">No hay platos vendidos hoy.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {platos.map((plato, index) => (
            <li
              key={plato.idProducto}
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                #{index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{plato.nombreProducto}</p>
                <p className="text-xs text-gray-400">{plato.cantidadVendida} vendidos</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-gray-900">
                {formatCurrency(plato.ingresoGenerado)}
              </p>
            </li>
          ))}
        </ol>
      )}

      <Link to="/admin/reports" className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline">
        Ver reportes →
      </Link>
    </div>
  );
}

/**
 * Dashboard principal del administrador. Vistazo operativo de HOY,
 * compuesto exclusivamente con endpoints reales ya usados en otras
 * pantallas — no existe /dashboard en el backend, y este componente no lo
 * simula: reutiliza useSalesReport/useTopSellingProductsReport/
 * useCurrentCashRegister/useTables/useKdsOrders tal cual, sin modificarlos.
 *
 * `hoy` sigue el día operativo de America/La_Paz y se reutiliza como
 * desde/hasta en ambos reportes y en el encabezado.
 *
 * A propósito NO incluye serieDiaria (ReportsPage ya la muestra, y en un
 * rango de un solo día no aporta) ni selector de fechas: para otros
 * períodos ya existe /admin/reports.
 */
export default function DashboardPage() {
  const [hoy, refreshDay] = useOperationalDay();

  const salesReport = useSalesReport(hoy, hoy);
  const topProductsReport = useTopSellingProductsReport(hoy, hoy, 5);
  // Los hooks compartidos conservan filtros anteriores en ReportsPage. Aquí
  // no presentar cifras de ayer bajo el encabezado de hoy durante la carga.
  const salesToday = salesReport.isPlaceholderData
    ? { ...salesReport, data: undefined, isLoading: true } : salesReport;
  const topToday = topProductsReport.isPlaceholderData
    ? { ...topProductsReport, data: undefined, isLoading: true } : topProductsReport;
  const cashRegister = useCurrentCashRegister();
  const tables = useTables();
  const cocinaOrders = useKdsOrders('cocina');
  const bebidasOrders = useKdsOrders('bebidas');

  const [refreshing, setRefreshing] = useState(false);

  // Refetch manual de las queries en paralelo.
  // cocinaOrders/bebidasOrders ya pollean solas cada 4s (useKdsOrders); se
  // incluyen igual acá para que "Actualizar" refresque todo el Dashboard
  // como una sola acción, igual criterio que el resto de las secciones.
  // Se deshabilita mientras está en curso para evitar disparos repetidos.
  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const currentDay = refreshDay();
      await Promise.all([
        // Si cambió el día, React Query cargará las nuevas claves al renderizar.
        // Refetchear estos observers ahora pediría otra vez el día anterior.
        ...(currentDay === hoy ? [salesReport.refetch(), topProductsReport.refetch()] : []),
        cashRegister.refetch(),
        tables.refetch(),
        cocinaOrders.refetch(),
        bebidasOrders.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Resumen de hoy · {formatDateDisplay(hoy)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={refreshing}>
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SalesKpis query={salesToday} />
        <CashRegisterCard query={cashRegister} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TablesSection query={tables} />
        <PaymentMethodsSection query={salesToday} />
      </div>

      <KdsSummarySection cocinaQuery={cocinaOrders} bebidasQuery={bebidasOrders} />

      <TopProductsSection query={topToday} />
    </div>
  );
}
