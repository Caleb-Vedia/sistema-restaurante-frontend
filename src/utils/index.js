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
 * Formatea una fecha ISO a hora local (HH:MM).
 * Ejemplo: formatTime("2024-01-15T14:30:00Z") → "14:30"
 */
export const formatTime = (isoString) =>
  new Intl.DateTimeFormat('es-BO', {
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
 
/**
 * Une clases de Tailwind filtrando valores falsy.
 * Evita condicionales verbosos en className.
 *
 * Ejemplo:
 *   cn('base-class', isActive && 'active-class', undefined)
 *   → "base-class active-class"
 */
export const cn = (...classes) => classes.filter(Boolean).join(' ');
 
