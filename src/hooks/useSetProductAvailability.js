import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCTS_KEY } from './useProducts';

/**
 * Cambio de disponibilidad: PATCH /productos/:id/disponibilidad.
 *
 * Es un SET explícito, no un toggle de backend: quien llama calcula el
 * valor deseado (típicamente `!producto.disponible`) y lo manda tal cual
 * en el body — nunca se envía un request vacío esperando que el backend
 * invierta el estado.
 *
 * Sin optimistic update: el badge sigue reflejando el estado actual hasta
 * que la invalidación trae el producto ya actualizado.
 *
 * Uso:
 *   const setAvailability = useSetProductAvailability();
 *   setAvailability.mutate({ idProducto, disponible: !producto.disponible });
 */
export function useSetProductAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idProducto, disponible }) =>
      api.patch(`/productos/${idProducto}/disponibilidad`, { disponible }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
