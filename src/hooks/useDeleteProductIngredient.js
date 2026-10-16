import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCTS_KEY } from './useProducts';

/**
 * Baja de ingrediente: DELETE /productos/:id/ingredientes/:ingredienteId
 * (soft-delete, 204 sin body, no espera Producto de vuelta). Sin
 * restauración: al invalidar ['productos'], el ingrediente simplemente
 * deja de venir en el próximo GET.
 *
 * Un 404 (ya eliminado por otra terminal, o no pertenece al producto)
 * también invalida ['productos'] para reconciliar la lista visible con el
 * servidor, en vez de dejar el ingrediente mostrado como si siguiera
 * existiendo. No hay retry automático.
 *
 * Uso:
 *   const deleteIngredient = useDeleteProductIngredient();
 *   deleteIngredient.mutate({ idProducto, idIngrediente });
 */
export function useDeleteProductIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idProducto, idIngrediente }) =>
      api.delete(`/productos/${idProducto}/ingredientes/${idIngrediente}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
    onError: (error) => {
      if (error?.status === 404) {
        queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      }
    },
  });
}
