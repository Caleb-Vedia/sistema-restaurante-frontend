import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { TABLES_KEY } from './useTables';

/**
 * Alta de mesa: POST /mesas.
 *
 * Body EXACTO: `{ nombreMesa }`. NO se envía `estado` — el backend crea
 * toda mesa nueva en `libre`, así que agregarlo sería un campo que el DTO
 * no espera.
 *
 * Sin optimistic update: onSuccess invalida ['mesas'] (la misma key que ya
 * usa useTables para Caja) y deja que React Query traiga el estado real,
 * incluido el idMesa asignado.
 *
 * Uso:
 *   const createTable = useCreateTable();
 *   createTable.mutate({ nombreMesa });
 */
export function useCreateTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ nombreMesa }) => api.post('/mesas', { nombreMesa }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
  });
}
