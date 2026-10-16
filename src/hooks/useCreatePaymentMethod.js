import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PAYMENT_METHODS_KEY } from './usePaymentMethods';

/**
 * Alta de método de pago: POST /metodos-pago.
 *
 * Body EXACTO: `{ nombreMetodo }` — único campo que el DTO acepta. El
 * backend NO recibe `codigo` (todo método nuevo nace con `codigo: null`,
 * el código es exclusivamente interno) ni ningún concepto de
 * activo/disponible/habilitado, que no existe en este recurso.
 *
 * Sin optimistic update: onSuccess invalida `PAYMENT_METHODS_KEY`
 * (`['metodos-pago']`) — la MISMA key que ya usa `usePaymentMethods` para
 * Caja (CashierPage, PaymentForm, el arqueo del cierre) — y deja que React
 * Query traiga el estado real, incluido el idMetodoPago asignado.
 *
 * Uso:
 *   const createPaymentMethod = useCreatePaymentMethod();
 *   createPaymentMethod.mutate({ nombreMetodo });
 */
export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ nombreMetodo }) => api.post('/metodos-pago', { nombreMetodo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY }),
  });
}
