import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PAYMENT_METHODS_KEY } from './usePaymentMethods';

/**
 * Edición de método de pago: PATCH /metodos-pago/:id.
 *
 * Body EXACTO: `{ nombreMetodo }`. `idMetodoPago` solo arma la URL, nunca
 * viaja en el body. NUNCA se envía `codigo` — es exclusivamente interno,
 * no modificable vía API, y tampoco existen `activo`/`disponible`/
 * `habilitado` en este recurso.
 *
 * Se permite editar el nombre aunque `codigo === 'efectivo'`: Caja
 * identifica ese método por `codigo`, nunca por `nombreMetodo` — ver la
 * nota que muestra PaymentMethodFormDialog para ese caso.
 *
 * El backend no guarda snapshot de `nombreMetodo` en Pago (lo resuelve por
 * relación al nombre ACTUAL) — renombrar un método cambia también cómo se
 * ven los pagos históricos ya registrados con ese método. Ese efecto se
 * explica en la UI (PaymentMethodFormDialog), no se bloquea acá.
 *
 * 404 (el método ya no existe, ej. otra sesión admin lo borró): además del
 * mensaje del backend, se invalida `PAYMENT_METHODS_KEY` para que la fila
 * stale se reconcilie sola en el próximo refetch.
 *
 * Uso:
 *   const updatePaymentMethod = useUpdatePaymentMethod();
 *   updatePaymentMethod.mutate({ idMetodoPago, nombreMetodo });
 */
export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idMetodoPago, nombreMetodo }) =>
      api.patch(`/metodos-pago/${idMetodoPago}`, { nombreMetodo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY }),
    onError: (error) => {
      if (error?.status === 404) {
        queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY });
      }
    },
  });
}
