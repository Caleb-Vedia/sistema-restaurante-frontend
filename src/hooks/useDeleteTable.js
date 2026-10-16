import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { TABLES_KEY } from './useTables';

/**
 * Baja de mesa: DELETE /mesas/:id (204, sin body).
 *
 * El backend solo permite borrar una mesa en `estado === 'libre'` — la UI
 * usa eso para deshabilitar la acción en mesas ocupadas/con cuenta
 * solicitada (ver TablesPage), pero es guía de UX, no una garantía: puede
 * haber una carrera real (un cliente escanea el QR justo entre que el
 * admin ve la fila y confirma el delete) y el backend sigue siendo la
 * autoridad — un 409 en ese caso es un resultado esperado, no un bug.
 *
 * Sin optimistic update, sin restore: no existe endpoint de recuperación,
 * así que la fila desaparece del listado recién cuando la invalidación
 * confirma el 204 real.
 *
 * Uso:
 *   const deleteTable = useDeleteTable();
 *   deleteTable.mutate(idMesa);
 */
export function useDeleteTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idMesa) => api.delete(`/mesas/${idMesa}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
    // 409 (carrera: la mesa dejó de estar libre entre el listado y el
    // click) también reconcilia: sin esto la fila seguiría mostrándose
    // como si el delete pudiera reintentarse tal cual.
    onError: () => queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
  });
}
