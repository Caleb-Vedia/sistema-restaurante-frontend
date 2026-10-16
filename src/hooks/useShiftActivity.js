import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache de la actividad del turno de caja en curso. */
export const CURRENT_SHIFT_ACTIVITY_KEY = ['caja', 'actividad'];

/**
 * Actividad del turno en curso: GET /caja/actividad. Visitas (sesiones) que
 * intersectaron el turno, con sus pedidos y pagos del turno y el consumo
 * completo de cada una.
 *
 * Este componente solo se monta dentro de la rama "caja abierta" de
 * CashierPage (igual que PaymentMethodsSection), así que no necesita
 * `enabled`: si se llegó a montar, ya hay caja abierta y el 409 del backend
 * ("no hay caja abierta") no es un caso esperable acá — si ocurriera (otra
 * terminal cerró el turno un instante antes), es un error real que se
 * muestra como tal, igual que cualquier otro fallo de red.
 *
 * Sin polling: mismo criterio que el resto de Caja (useTables, useTableBalance).
 */
export function useShiftActivity() {
  return useQuery({
    queryKey: CURRENT_SHIFT_ACTIVITY_KEY,
    queryFn: () => api.get('/caja/actividad'),
  });
}
