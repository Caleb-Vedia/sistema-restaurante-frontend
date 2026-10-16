import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCTS_KEY } from './useProducts';

/**
 * Edición de ingrediente: PATCH /productos/:id/ingredientes/:ingredienteId.
 * Único campo editable: nombreIngrediente. El backend ya valida que el
 * ingrediente pertenezca al producto de la URL — no se duplica esa
 * comprobación acá.
 *
 * Un 404 en este endpoint puede significar un cambio concurrente (otro
 * admin ya lo editó/eliminó): en ese caso se invalida ['productos'] igual
 * que en éxito, para que la UI reconcilie con el estado real del servidor
 * en vez de quedarse mostrando datos obsoletos. No hay retry automático.
 *
 * Uso:
 *   const updateIngredient = useUpdateProductIngredient();
 *   updateIngredient.mutate({ idProducto, idIngrediente, nombreIngrediente });
 */
export function useUpdateProductIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idProducto, idIngrediente, nombreIngrediente }) =>
      api.patch(`/productos/${idProducto}/ingredientes/${idIngrediente}`, { nombreIngrediente }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
    onError: (error) => {
      if (error?.status === 404) {
        queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      }
    },
  });
}
