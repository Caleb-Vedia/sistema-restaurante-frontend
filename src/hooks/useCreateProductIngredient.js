import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCTS_KEY } from './useProducts';

/**
 * Alta de ingrediente: POST /productos/:id/ingredientes.
 *
 * producto.ingredientes ya viene embebido en GET /productos — no existe (ni
 * hace falta) una query independiente de ingredientes; esta mutación solo
 * invalida ['productos'] para que React Query traiga el array actualizado
 * dentro del producto.
 *
 * El backend NO hace trim del nombre — se recorta acá antes de enviar, para
 * no persistir espacios accidentales. Los duplicados están permitidos (el
 * backend no valida unicidad), así que no se bloquean en el frontend.
 *
 * Uso:
 *   const createIngredient = useCreateProductIngredient();
 *   createIngredient.mutate({ idProducto, nombreIngrediente });
 */
export function useCreateProductIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idProducto, nombreIngrediente }) =>
      api.post(`/productos/${idProducto}/ingredientes`, { nombreIngrediente }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
