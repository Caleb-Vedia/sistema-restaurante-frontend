import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { TABLES_KEY } from './useTables';

/**
 * Edición de mesa: PATCH /mesas/:id.
 *
 * Body EXACTO: `{ nombreMesa }`. `idMesa` solo arma la URL, nunca viaja en
 * el body. NUNCA se envían `estado`, `sesionActiva` ni `idSesion` — el
 * estado de una mesa es de solo lectura en Admin (lo administran el flujo
 * QR/Cliente, Pedir cuenta, y Caja al cobrar); este endpoint tampoco los
 * acepta.
 *
 * El backend permite este PATCH aunque la mesa esté `ocupada` o
 * `cuenta_solicitada` — cambiar el nombre no toca la sesión activa en
 * absoluto, así que no hace falta bloquear ni confirmar nada especial acá
 * (la nota informativa vive en la UI, ver TablesPage).
 *
 * 404 (la mesa ya no existe, ej. otra sesión admin la borró): además del
 * mensaje del backend, se invalida ['mesas'] para que la fila stale se
 * reconcilie sola en el próximo refetch.
 *
 * Uso:
 *   const updateTable = useUpdateTable();
 *   updateTable.mutate({ idMesa, nombreMesa });
 */
export function useUpdateTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idMesa, nombreMesa }) => api.patch(`/mesas/${idMesa}`, { nombreMesa }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
    onError: (error) => {
      if (error?.status === 404) {
        queryClient.invalidateQueries({ queryKey: TABLES_KEY });
      }
    },
  });
}
