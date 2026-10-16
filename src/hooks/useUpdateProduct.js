import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCTS_KEY } from './useProducts';

/**
 * Edición de producto: PATCH /productos/:id.
 *
 * El body lleva únicamente los campos editables de este formulario
 * (nombreProducto, descripcion, precio, idAreaProducto, idCategoriaProducto).
 * `idProducto` solo arma la URL, nunca viaja en el body. `disponible`,
 * `ingredientes`, `borradoEl` y `urlImagen` quedan fuera de esta fase: no
 * se leen, no se envían, no se tocan.
 *
 * Uso:
 *   const updateProduct = useUpdateProduct();
 *   updateProduct.mutate({ idProducto, nombreProducto, descripcion, precio, idAreaProducto, idCategoriaProducto });
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idProducto, ...body }) => api.patch(`/productos/${idProducto}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
