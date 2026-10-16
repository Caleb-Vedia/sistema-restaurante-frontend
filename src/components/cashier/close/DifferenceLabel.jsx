import { formatCurrency } from '../../../utils';

/**
 * Renderiza una diferencia de arqueo TAL COMO la calculó el backend.
 *
 * Nunca se recomputa acá: el preview trae `diferencia` por método y
 * `diferenciaTotal`, y el resumen del cierre trae la diferencia por método.
 * Esto solo traduce el número a su lectura operativa (cuadra / sobrante /
 * faltante), con `null` como "no calculada" — que NO es lo mismo que 0.
 *
 * Lo comparten el Paso 3 (conciliación, sobre el preview) y el resumen final
 * del cierre, para que un mismo número no se lea distinto según la pantalla.
 */
export default function DifferenceLabel({ diferencia, className = '' }) {
  if (diferencia == null) {
    return <span className={`text-muted-foreground ${className}`}>No calculada</span>;
  }
  if (diferencia === 0) {
    return <span className={`font-semibold text-success-foreground ${className}`}>Cuadra</span>;
  }
  if (diferencia > 0) {
    return (
      <span className={`font-semibold text-info-foreground ${className}`}>
        Sobrante {formatCurrency(diferencia)}
      </span>
    );
  }
  return (
    <span className={`font-semibold text-destructive ${className}`}>
      Faltante {formatCurrency(Math.abs(diferencia))}
    </span>
  );
}
