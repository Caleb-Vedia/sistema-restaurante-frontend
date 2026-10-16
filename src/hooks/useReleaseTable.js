import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { TABLES_KEY } from './useTables';
import { tableBalanceKey } from './useTableBalance';
import { consumoActualKey } from './useTableConsumption';
import { CURRENT_SHIFT_ACTIVITY_KEY } from './useShiftActivity';
import { CLOSE_CONTEXT_KEY } from './useCloseContext';

/**
 * PATCH /mesas/:id/cerrar-sesion, sin body — el ÚNICO camino de la app para
 * liberar una mesa sin cobrar. Dos disparadores hoy:
 *
 *   - Recovery de un cobro con `mesaLiberada: false` (el pago YA está
 *     persistido; esto recupera solo el paso que falló después).
 *   - "Liberar mesa" desde Caja/Operación o desde el Paso 1 del cierre en 4
 *     pasos (ReleaseTableAction, sesión de regla A: activa y sin saldo). Acá
 *     no hay ningún pago que recuperar — la sesión simplemente no debe nada.
 *
 * Ambos casos son el MISMO PATCH sin distinción en el body: el backend decide
 * con la misma regla económica (`saldoPendiente === 0`) si corresponde
 * liberar, sin importar por qué la UI lo ofreció.
 *
 * Reconciliación del 404
 * ----------------------
 * El endpoint NO es idempotente: la primera llamada devuelve 200 y la
 * segunda 404, porque ya no queda sesión activa. Otra terminal también pudo
 * haber cerrado la mesa antes. Por eso un 404 del PATCH no se reporta como
 * fallo sin antes mirar el estado real con GET /mesas/:id:
 *
 * - libre + sesionActiva null → la liberación ya ocurrió: se resuelve como
 *   éxito funcional (`yaEstabaLibre: true`)
 * - la mesa no existe (el GET también 404) → error real, se propaga
 * - mesa no libre, o con sesión activa → NO se asume éxito ni se intenta
 *   otro PATCH: se lanza un error controlado para revisión manual
 *
 * Sin optimistic update, sin setQueryData y sin retry automático: cerrar la
 * sesión equivocada sería destructivo, así que cada intento es explícito.
 *
 * Uso:
 *   const releaseTable = useReleaseTable();
 *   releaseTable.mutate({ idMesa });
 */
export function useReleaseTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ idMesa }) => {
      try {
        const mesa = await api.patch(`/mesas/${idMesa}/cerrar-sesion`);
        return { mesa, yaEstabaLibre: false };
      } catch (err) {
        if (err.status !== 404) throw err;

        // 404 del PATCH: "ya no hay sesión activa". Hay que ver por qué.
        const mesa = await api.get(`/mesas/${idMesa}`);

        if (mesa.estado === 'libre' && mesa.sesionActiva === null) {
          return { mesa, yaEstabaLibre: true };
        }

        const error = new Error(
          mesa.sesionActiva
            ? 'La mesa tiene ahora una sesión activa distinta. No se puede liberar automáticamente sin arriesgar cerrar la sesión equivocada: requiere revisión manual.'
            : 'La mesa no quedó liberada y su estado no es consistente. Requiere revisión manual.',
        );
        error.status = err.status;
        throw error;
      }
    },

    onSuccess: (_data, { idMesa }) => {
      // La sesión quedó cerrada: su saldo no debe volver a consultarse
      // (daría 404), y la data vieja no debe sobrevivir para una sesión futura.
      // Mismo criterio para el consumo actual de esa mesa.
      queryClient.removeQueries({ queryKey: tableBalanceKey(idMesa) });
      queryClient.removeQueries({ queryKey: consumoActualKey(idMesa) });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
        // La sesión liberada puede ser una de las que muestra la actividad
        // del turno (cerradaEl pasa de null a una fecha): sin esto quedaría
        // marcada "Activa" ahí después de liberarse.
        queryClient.invalidateQueries({ queryKey: CURRENT_SHIFT_ACTIVITY_KEY }),
        // Mismo motivo: el contexto del cierre (Paso 1 del wizard) clasifica
        // esta sesión como regla A (activa + saldo 0) mientras siga abierta.
        // Sin esto, "Liberar mesa" desde ahí no la sacaría de la lista hasta
        // que el usuario reabriera el wizard. Invalidar acá es un no-op
        // barato si el wizard no está montado (queryKey ni siquiera existe en
        // cache todavía).
        queryClient.invalidateQueries({ queryKey: CLOSE_CONTEXT_KEY }),
      ]);
    },

    // Se refresca el listado para que las guardas de la UI vuelvan a
    // evaluarse contra el estado canónico antes de ofrecer otro intento. Si
    // el PATCH falló porque el estado quedó stale (ej. una mesa "sin saldo"
    // en la foto del wizard ya no lo está), el contexto del cierre también
    // se refresca para que esa fila muestre su clasificación real.
    onError: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
        queryClient.invalidateQueries({ queryKey: CLOSE_CONTEXT_KEY }),
      ]),
  });
}
