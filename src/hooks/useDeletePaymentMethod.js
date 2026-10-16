import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PAYMENT_METHODS_KEY } from './usePaymentMethods';

/**
 * Baja de método de pago: DELETE /metodos-pago/:id (204, sin body).
 * Soft-delete — no existe restore.
 *
 * El backend ahora rechaza con 409 el borrado del método protegido
 * (`codigo === 'efectivo'`, ver PaymentMethodsPage), como red de
 * seguridad server-side. La UI ya deshabilita esa acción en la fila, pero
 * esta mutation la maneja igual por si hay una carrera (datos stale, otra
 * sesión admin) — nunca se asume que un 409 significa otra cosa, se
 * propaga `error.message` del backend tal cual.
 *
 * Sin optimistic update: la fila desaparece del listado recién cuando la
 * invalidación confirma el 204 real.
 *
 * Uso:
 *   const deletePaymentMethod = useDeletePaymentMethod();
 *   deletePaymentMethod.mutate(idMetodoPago);
 */
export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idMetodoPago) => api.delete(`/metodos-pago/${idMetodoPago}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY }),
    // Cualquier error (409 por protección de 'efectivo', o una carrera de
    // estado) reconcilia igual: un refetch de la colección real es
    // siempre seguro y evita que la fila quede mostrando un estado que ya
    // no es cierto.
    onError: () => queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY }),
  });
}
