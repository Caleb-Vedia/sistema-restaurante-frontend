import { Loader2 } from 'lucide-react';

/**
 * Spinner de carga, con tamaños e color heredado de currentColor (className).
 *
 * Props:
 * - size: 'sm' | 'md' | 'lg'  (default: 'md')
 * - className: clases adicionales (útil para cambiar color con text-*)
 *
 * Uso:
 *   <Spinner />
 *   <Spinner size="lg" className="text-primary" />
 */

const SIZES = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

export default function Spinner({ size = 'md', className = '' }) {
  return <Loader2 className={`animate-spin ${SIZES[size]} ${className}`} aria-hidden="true" />;
}
