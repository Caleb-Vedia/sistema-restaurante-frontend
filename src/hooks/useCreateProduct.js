import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCTS_KEY } from './useProducts';

/**
 * Alta de producto: POST /productos.
 * Crear un producto no modifica los catálogos de áreas/categorías, así que
 * solo se invalida ['productos'] — no hace falta tocar esas otras queries.
 * Sin optimistic update.
 *
 * Uso:
 *   const createProduct = useCreateProduct();
 *   createProduct.mutate({ nombreProducto, descripcion, precio, idAreaProducto, idCategoriaProducto });
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body) => api.post('/productos', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
