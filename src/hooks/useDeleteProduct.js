import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCTS_KEY } from './useProducts';

/**
 * Baja de producto: DELETE /productos/:id (soft-delete, 204 No Content).
 * Sin restauración. La confirmación vive en la UI (DeleteProductDialog),
 * no acá. Sin body, sin optimistic update: el ítem se quita de la lista
 * recién cuando el refetch confirma que ya no vuelve en el GET.
 *
 * Uso:
 *   const deleteProduct = useDeleteProduct();
 *   deleteProduct.mutate(idProducto);
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idProducto) => api.delete(`/productos/${idProducto}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
