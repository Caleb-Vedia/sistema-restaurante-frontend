import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del consumo actual (pedidos de la sesión activa) de una mesa. */
export const consumoActualKey = (idMesa) => ['pedidos', 'consumo-actual', idMesa];

/**
 * Consumo actual de una mesa: GET /pedidos/mesa/:idMesa/consumo-actual.
 *
 * De dónde sale el saldo que muestra useTableBalance — los pedidos de la
 * sesión activa, con sus detalles a precio congelado. Es staff/JWT, no
 * X-Table-Token (endpoint distinto del Cliente).
 *
 * El backend responde 404 cuando la mesa no tiene sesión activa — es un
 * resultado ESPERADO (mismo criterio que useCurrentCashRegister con el
 * `null` de /caja/actual), no un error: se traduce a `data: null` en vez de
 * dejar que React Query lo marque como `isError`. En el uso normal ni
 * siquiera llega a pedirse (ver `enabled`, gateado por `tieneSesionActiva`
 * en TableDetailPanel, igual que useTableBalance); el catch cubre además la
 * carrera donde la sesión se cerró justo antes de que la respuesta llegara.
 *
 * `enabled: idMesa != null` sigue el mismo patrón que useTableBalance: quien
 * llama decide CUÁNDO tiene sentido pedir el consumo (mesa seleccionada con
 * sesión activa), este hook no conoce el objeto mesa completo.
 */
export function useTableConsumption(idMesa) {
  return useQuery({
    queryKey: consumoActualKey(idMesa),
    queryFn: async () => {
      try {
        return await api.get(`/pedidos/mesa/${idMesa}/consumo-actual`);
      } catch (err) {
        if (err.status === 404) return null;
        throw err;
      }
    },
    enabled: idMesa != null,
  });
}
