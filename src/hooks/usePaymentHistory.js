import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del historial de pagos de una mesa. */
export const paymentHistoryKey = (idMesa) => ['pagos', 'historial', idMesa];

/**
 * Historial de pagos de la última sesión de una mesa: GET /pagos?idMesa=.
 *
 * A diferencia de /pagos/total/:idMesa, este endpoint NO exige sesión
 * activa: devuelve el historial de la sesión con mayor idSesion de la mesa
 * (la activa si existe, o la última cerrada si la mesa está libre). Por eso
 * sirve para cualquier estado de mesa, no solo ocupada/cuenta_solicitada.
 *
 * Un 404 acá tiene un significado puntual: la mesa nunca tuvo ninguna
 * sesión registrada. Para la UI es un estado vacío legítimo, no un error
 * — el queryFn lo convierte en `[]` en vez de dejar que React Query lo
 * marque como isError. Cualquier otro status se relanza normalmente. Este
 * tratamiento es específico de este endpoint: no se generaliza a otros
 * hooks (por ejemplo useTableBalance sí trata su 404 como error real).
 *
 * Se ejecuta solo cuando hay una mesa seleccionada (`enabled`).
 */
export function usePaymentHistory(idMesa) {
  return useQuery({
    queryKey: paymentHistoryKey(idMesa),
    queryFn: async () => {
      try {
        return await api.get(`/pagos?idMesa=${idMesa}`);
      } catch (err) {
        if (err.status === 404) return [];
        throw err;
      }
    },
    enabled: idMesa != null,
  });
}
