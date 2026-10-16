import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { CURRENT_CASH_REGISTER_KEY } from './useCurrentCashRegister';

/**
 * Apertura de caja: POST /caja/abrir.
 *
 * La respuesta tiene el mismo shape que /caja/actual, pero igual se
 * descarta y se invalida la query en su lugar (mismo criterio que
 * useUpdateOrderStatus en el KDS): un único punto de verdad para el estado
 * de caja, sin copiar el objeto en dos lugares.
 *
 * onSuccess devuelve la promesa de invalidateQueries a propósito (mismo
 * patrón que useLogin): la mutación sigue "pending" hasta que /caja/actual
 * se haya refrescado, así el formulario no se reactiva ni desaparece un
 * instante antes de que la pantalla realmente pase a "caja abierta".
 *
 * Uso:
 *   const openCashRegister = useOpenCashRegister();
 *   openCashRegister.mutate({ montoInicialEfectivo });
 */
export function useOpenCashRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ montoInicialEfectivo }) =>
      api.post('/caja/abrir', { montoInicialEfectivo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENT_CASH_REGISTER_KEY }),
  });
}
