import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCT_CATEGORIES_KEY } from './useProductCategories';

/**
 * Alta de categoría: POST /categorias-producto.
 * Sin optimistic update: onSuccess invalida el listado y deja que React
 * Query traiga el estado real (incluido el idCategoriaProducto asignado).
 *
 * Uso:
 *   const createCategory = useCreateProductCategory();
 *   createCategory.mutate({ nombreCategoria });
 */
export function useCreateProductCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ nombreCategoria }) =>
      api.post('/categorias-producto', { nombreCategoria }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCT_CATEGORIES_KEY }),
  });
}
