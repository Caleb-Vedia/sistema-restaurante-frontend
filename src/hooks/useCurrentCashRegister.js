import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del estado de caja del turno actual. */
export const CURRENT_CASH_REGISTER_KEY = ['caja', 'actual'];

/**
 * Estado de la caja del turno actual: GET /caja/actual.
 *
 * El backend responde 200 con body `null` cuando no hay caja abierta — es
 * un resultado válido (mismo criterio que useAuth con /auth/me y su 401),
 * no un error: `data` queda en `null` de forma natural, sin try/catch.
 *
 * Sin polling: abrir caja es una acción explícita de la cajera al empezar
 * el turno, no algo que cambie por fuera de esta pantalla en tiempo real
 * (a diferencia del KDS, que sí necesita reflejar pedidos de otros roles).
 */
export function useCurrentCashRegister() {
  return useQuery({
    queryKey: CURRENT_CASH_REGISTER_KEY,
    queryFn: () => api.get('/caja/actual'),
  });
}
