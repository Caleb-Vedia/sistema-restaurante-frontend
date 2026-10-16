import { useState } from 'react';
import { useSalesReport } from '../../hooks/useSalesReport';
import { useTopSellingProductsReport } from '../../hooks/useTopSellingProductsReport';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/input';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { formatCurrency, formatDateDisplay, toLocalDateString } from '../../utils';

const LIMIT_OPTIONS = [5, 10, 20, 50];

const selectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * Rango inicial: primer día del mes actual → hoy, calculado dinámicamente
 * (nunca hardcodeado). Usa toLocalDateString, no toISOString().slice(0,10):
 * este último convierte a UTC primero y puede correr el día según la hora
 * local, y estos filtros se mandan tal cual al backend como días calendario.
 */
function getDefaultFilters() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    desde: toLocalDateString(firstOfMonth),
    hasta: toLocalDateString(today),
    limite: 10,
  };
}

/** Comparación lexicográfica de "YYYY-MM-DD" ya es comparación cronológica — no hace falta parsear a Date. */
function validateFilters({ desde, hasta }) {
  if (!desde) return 'La fecha inicial es obligatoria.';
  if (!hasta) return 'La fecha final es obligatoria.';
  if (desde > hasta) return 'La fecha inicial no puede ser posterior a la fecha final.';
  return null;
}

function KpiCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

/**
 * Serie diaria como tabla — acceso textual completo a fecha/ingresos/tickets
 * garantizado por ser una <table> real, no un canvas. La barra es un adorno
 * puramente visual (ancho proporcional al ingreso del día vs. el máximo del
 * período), no reemplaza ni oculta ningún dato de la fila.
 */
function DailySeriesTable({ serie }) {
  const maxIngresos = Math.max(...serie.map((dia) => dia.ingresos), 0);

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="py-2 pr-3 font-medium">Fecha</th>
            <th className="py-2 pr-3 font-medium">Ingresos</th>
            <th className="py-2 pr-3 font-medium">Tickets</th>
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {serie.map((dia) => (
            <tr key={dia.fecha} className="border-b border-gray-50 last:border-0">
              <td className="py-2 pr-3 text-gray-700">{formatDateDisplay(dia.fecha)}</td>
              <td className="py-2 pr-3 font-medium text-gray-900">{formatCurrency(dia.ingresos)}</td>
              <td className="py-2 pr-3 text-gray-500">{dia.cantidadTickets}</td>
              <td className="w-28 py-2">
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{ width: maxIngresos > 0 ? `${(dia.ingresos / maxIngresos) * 100}%` : '0%' }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * KPIs + método de pago + serie diaria. Todos los valores vienen tal cual
 * del backend (resumen.ingresosTotales, resumen.ticketPromedio, etc.) — no
 * se recalcula nada acá, solo se formatea y presenta.
 */
function SalesSection({ query }) {
  const { data, isLoading, isFetching, isError, error, refetch } = query;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
        <Spinner size="lg" className="text-gray-300" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white">
        <EmptyState
          icon="⚠️"
          title="No se pudo cargar el reporte de ventas"
          description={error?.message || 'Hubo un problema al conectar con el servidor.'}
        >
          <Button onClick={() => refetch()}>Reintentar</Button>
        </EmptyState>
      </div>
    );
  }

  const { resumen, porMetodoPago, serieDiaria } = data;

  return (
    <div className="flex flex-col gap-4">
      {isFetching && <p className="text-xs text-gray-400">Actualizando...</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Ingresos totales" value={formatCurrency(resumen.ingresosTotales)} />
        <KpiCard label="Tickets" value={resumen.cantidadTickets} />
        <KpiCard label="Ticket promedio" value={formatCurrency(resumen.ticketPromedio)} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Ventas por método de pago</h2>
        {porMetodoPago.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">No hubo pagos en este período.</p>
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

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Serie diaria</h2>
        {serieDiaria.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">No hay ventas diarias para mostrar.</p>
        ) : (
          <DailySeriesTable serie={serieDiaria} />
        )}
      </div>
    </div>
  );
}

/**
 * Ranking de platos más vendidos. El backend ya ordena por cantidadVendida
 * DESC — no se reordena por ingreso ni por ningún otro criterio. El número
 * de posición (#1, #2...) es presentación de frontend (index + 1), no un
 * dato del backend.
 */
function TopProductsSection({ query }) {
  const { data, isLoading, isFetching, isError, error, refetch } = query;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
        <Spinner size="lg" className="text-gray-300" />
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
        <h2 className="text-sm font-semibold text-gray-900">Platos más vendidos</h2>
        {isFetching && <p className="text-xs text-gray-400">Actualizando...</p>}
      </div>

      {platos.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">No hay platos vendidos en este período.</p>
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
    </div>
  );
}

/**
 * Reportes de administración: ventas + platos más vendidos. Son los dos
 * únicos reportes reales que expone el backend — no hay reporte de
 * cierres, mesas, pedidos ni exportación.
 *
 * draftFilters/appliedFilters: los inputs editan draftFilters libremente
 * sin disparar ningún request; solo "Aplicar filtros" copia draftFilters a
 * appliedFilters, y las dos queries usan exclusivamente appliedFilters.
 * Si la validación falla, appliedFilters no cambia — el último reporte
 * válido sigue visible tal cual estaba.
 */
export default function ReportsPage() {
  const [draftFilters, setDraftFilters] = useState(getDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(getDefaultFilters);
  const [filterError, setFilterError] = useState(null);

  const salesReport = useSalesReport(appliedFilters.desde, appliedFilters.hasta);
  const topProductsReport = useTopSellingProductsReport(
    appliedFilters.desde,
    appliedFilters.hasta,
    appliedFilters.limite,
  );

  const handleApply = (event) => {
    event.preventDefault();

    const validationMessage = validateFilters(draftFilters);
    if (validationMessage) {
      setFilterError(validationMessage);
      return;
    }

    setFilterError(null);
    setAppliedFilters(draftFilters);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-gray-900">Reportes</h1>

      <form
        onSubmit={handleApply}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div className="space-y-1.5">
          <label htmlFor="reporteDesde" className="text-sm font-medium text-gray-700">
            Desde
          </label>
          <Input
            id="reporteDesde"
            type="date"
            value={draftFilters.desde}
            onChange={(event) => setDraftFilters((filters) => ({ ...filters, desde: event.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reporteHasta" className="text-sm font-medium text-gray-700">
            Hasta
          </label>
          <Input
            id="reporteHasta"
            type="date"
            value={draftFilters.hasta}
            onChange={(event) => setDraftFilters((filters) => ({ ...filters, hasta: event.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reporteLimite" className="text-sm font-medium text-gray-700">
            Top platos
          </label>
          <select
            id="reporteLimite"
            className={selectClass}
            value={draftFilters.limite}
            onChange={(event) =>
              setDraftFilters((filters) => ({ ...filters, limite: Number(event.target.value) }))
            }
          >
            {LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit">Aplicar filtros</Button>

        {filterError && (
          <Alert variant="destructive" className="w-full">
            <AlertDescription>{filterError}</AlertDescription>
          </Alert>
        )}
      </form>

      <SalesSection query={salesReport} />
      <TopProductsSection query={topProductsReport} />
    </div>
  );
}
