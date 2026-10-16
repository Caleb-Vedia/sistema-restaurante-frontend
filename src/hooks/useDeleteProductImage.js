import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCTS_KEY } from './useProducts';

/**
 * Eliminación de imagen: DELETE /productos/:id/imagen.
 *
 * Responde 200 + Producto completo (con urlImagen: null) — NO 204, a
 * diferencia de DELETE /productos/:id. `api.delete` ya maneja ambos casos
 * (204 → null, o el body real si lo hay) sin nada especial acá; solo
 * importa no asumir que la respuesta viene vacía en ningún punto que la use.
 *
 * Sin optimistic update.
 *
 * Uso:
 *   const deleteImage = useDeleteProductImage();
 *   deleteImage.mutate(idProducto);
 */
export function useDeleteProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idProducto) => api.delete(`/productos/${idProducto}/imagen`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
