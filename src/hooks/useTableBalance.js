import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache de la deuda de una mesa puntual. */
export const tableBalanceKey = (idMesa) => ['pagos', 'total', idMesa];

/**
 * Deuda de una mesa: GET /pagos/total/:idMesa.
 *
 * Se llama solo con la mesa que la cajera seleccionó — nunca dentro de un
 * .map() sobre todo el listado de /mesas. Evitar ese N+1 es una decisión
 * explícita de esta fase: la deuda se consulta recién cuando hay una
 * selección concreta.
 *
 * `enabled: idMesa != null` es lo único que controla el disparo automático:
 * el criterio de negocio "solo si la mesa tiene sesionActiva" vive en quien
 * llama a este hook (CashierPage decide qué idMesa pasarle, o `null` si la
 * mesa elegida está libre), no acá, porque este hook no conoce el objeto
 * mesa completo, solo el id.
 */
export function useTableBalance(idMesa) {
  return useQuery({
    queryKey: tableBalanceKey(idMesa),
    queryFn: () => api.get(`/pagos/total/${idMesa}`),
    enabled: idMesa != null,
  });
}
