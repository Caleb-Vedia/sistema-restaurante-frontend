import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCT_CATEGORIES_KEY } from './useProductCategories';

/**
 * Edición de categoría: PATCH /categorias-producto/:id.
 * El body lleva únicamente `nombreCategoria` — idCategoriaProducto solo se
 * usa para armar la URL, y borradoEl nunca se envía (el backend lo maneja
 * exclusivamente vía DELETE).
 *
 * Uso:
 *   const updateCategory = useUpdateProductCategory();
 *   updateCategory.mutate({ idCategoriaProducto, nombreCategoria });
 */
export function useUpdateProductCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idCategoriaProducto, nombreCategoria }) =>
      api.patch(`/categorias-producto/${idCategoriaProducto}`, { nombreCategoria }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCT_CATEGORIES_KEY }),
  });
}
