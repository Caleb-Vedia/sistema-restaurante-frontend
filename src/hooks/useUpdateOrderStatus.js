import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { kdsOrdersKey } from './useKdsOrders';

/**
 * Mutación de cambio de estado de un pedido: PATCH /pedidos/:id/estado.
 * Compartida por Cocina y Bebidas — recibe `area` para invalidar únicamente
 * la query de esa área (['pedidos', area]) tras un cambio exitoso, nunca la
 * del área que no originó la mutación.
 *
 * La respuesta del PATCH NO tiene el mismo shape que el GET del listado
 * (pierde nombreMesa, agrega otros campos), así que nunca se usa para
 * actualizar la cache directamente. onSuccess invalida la query del área
 * y deja que React Query vuelva a pedir el estado canónico.
 *
 * onSuccess devuelve la promesa de invalidateQueries a propósito (mismo
 * patrón que useLogin): la mutación sigue "pending" hasta que el refetch
 * del listado haya terminado, así el botón de la card no se reactiva un
 * instante antes de que el nuevo estado esté realmente en pantalla.
 *
 * Se llama una vez por card (una instancia de useMutation por pedido), así
 * que isPending/isError quedan naturalmente aislados a esa card — no hace
 * falta rastrear "qué pedido está mutando" a mano.
 *
 * Uso:
 *   const updateStatus = useUpdateOrderStatus(area);
 *   updateStatus.mutate({ idPedido, estado: 'preparacion' });
 */
export function useUpdateOrderStatus(area) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idPedido, estado }) =>
      api.patch(`/pedidos/${idPedido}/estado`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kdsOrdersKey(area) }),
  });
}
