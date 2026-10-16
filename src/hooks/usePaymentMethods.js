import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache de los métodos de pago activos. */
export const PAYMENT_METHODS_KEY = ['metodos-pago'];

/**
 * Métodos de pago activos: GET /metodos-pago.
 *
 * Esta fase todavía no construye el formulario de cobro — la query queda
 * lista y se usa solo para una sección informativa mientras la caja está
 * abierta, preparando el terreno para la siguiente fase (distribución de
 * montos por método).
 */
export function usePaymentMethods() {
  return useQuery({
    queryKey: PAYMENT_METHODS_KEY,
    queryFn: () => api.get('/metodos-pago'),
  });
}
