import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCT_CATEGORIES_KEY } from './useProductCategories';

/**
 * Baja de categoría: DELETE /categorias-producto/:id (soft-delete, 204).
 * El backend no verifica productos asociados ni ofrece restauración — la
 * confirmación de esta acción vive en la UI (DeleteCategoryDialog), no acá.
 * Sin body, sin optimistic update: el ítem se quita de la lista recién
 * cuando el refetch confirma que ya no vuelve en el GET.
 *
 * Uso:
 *   const deleteCategory = useDeleteProductCategory();
 *   deleteCategory.mutate(idCategoriaProducto);
 */
export function useDeleteProductCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idCategoriaProducto) =>
      api.delete(`/categorias-producto/${idCategoriaProducto}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCT_CATEGORIES_KEY }),
  });
}
