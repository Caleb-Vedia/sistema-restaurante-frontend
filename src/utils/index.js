/**
 * Utilidades generales del frontend.
 * Solo funciones puras sin efectos secundarios.
 */
 
/**
 * Formatea un número como moneda boliviana.
 * Ejemplo: formatCurrency(25.5) → "Bs 25,50"
 */
export const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-BO', {
    style:    'currency',
    currency: 'BOB',
  }).format(amount);
 
/**
 * Convierte un monto (número o string) a centavos enteros.
 *
 * Todo cálculo o comparación monetaria debe hacerse en centavos: comparar
 * floats directamente da falsos negativos (0.1 + 0.2 !== 0.3), y el backend
 * exige que la suma de pagos coincida EXACTAMENTE con lo adeudado.
 *
 * Ejemplo: toCents("65.40") → 6540
 */
export const toCents = (amount) => Math.round(Number(amount) * 100);

/**
 * Inverso de toCents: pasa centavos enteros a monto, para mostrarlo.
 * Ejemplo: fromCents(6540) → 65.4
 */
export const fromCents = (cents) => cents / 100;

/**
 * Formatea una fecha ISO a hora local (HH:MM).
 * Ejemplo: formatTime("2024-01-15T14:30:00Z") → "14:30"
 */
export const formatTime = (isoString) =>
  new Intl.DateTimeFormat('es-BO', {
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
 
/**
 * Formatea una fecha ISO a fecha y hora local (DD/MM HH:MM).
 *
 * Se usa donde la hora sola es ambigua — por ejemplo un arqueo que abre un
 * día y cierra pasada la medianoche.
 * Ejemplo: formatDateTime("2024-01-15T14:30:00Z") → "15/01, 14:30"
 */
export const formatDateTime = (isoString) =>
  new Intl.DateTimeFormat('es-BO', {
    day:    '2-digit',
    month:  '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));

/**
 * Fecha LOCAL (no UTC) en formato YYYY-MM-DD, a partir de un Date.
 *
 * `date.toISOString().slice(0, 10)` convierte a UTC primero y puede correr
 * el día si la hora local está cerca de la medianoche (ej. en Bolivia,
 * UTC-4: a las 23:00 del día 19, toISOString ya está en el día 20 UTC).
 * Este helper arma el string a mano con los getters LOCALES para evitar
 * ese desplazamiento — necesario para los filtros de reportes, que se
 * envían tal cual al backend como días calendario en America/La_Paz.
 *
 * Ejemplo: toLocalDateString(new Date(2026, 7, 1)) → "2026-08-01"
 */
export const toLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * "YYYY-MM-DD" (tal como lo devuelve el backend) a "DD/MM/YYYY" para
 * mostrar. Manipula el string directamente, sin construir un Date — un
 * `new Date("YYYY-MM-DD")` se interpreta como medianoche UTC y podría
 * mostrar el día anterior según la zona horaria del navegador.
 *
 * Ejemplo: formatDateDisplay("2026-08-01") → "01/08/2026"
 */
export const formatDateDisplay = (isoDate) => {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Une clases de Tailwind filtrando valores falsy.
 * Evita condicionales verbosos en className.
 *
 * Ejemplo:
 *   cn('base-class', isActive && 'active-class', undefined)
 *   → "base-class active-class"
 */
export const cn = (...classes) => classes.filter(Boolean).join(' ');
 
