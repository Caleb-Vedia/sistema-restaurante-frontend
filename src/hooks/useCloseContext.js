import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { assertCashierContext } from '../utils/cashierQueryContext';

/** Clave de cache del contexto de cierre del turno en curso. */
export const CLOSE_CONTEXT_KEY = ['caja', 'cierre', 'contexto'];

/**
 * Contexto del cierre: GET /caja/cierre/contexto.
 *
 * Es el MISMO shape que POST /caja/cierre/preview (CierrePreviewResponse en el
 * backend): el contexto es literalmente el preview con el conteo vacío. De acá
 * salen tres cosas para el wizard:
 *
 * - la lista de métodos sobre la que se arma el arqueo ciego (`detalle`), que
 *   incluye métodos activos sin movimiento y también métodos dados de baja a
 *   mitad de turno que igual cobraron — por eso NO se usa /metodos-pago para
 *   construir esa lista;
 * - las sesiones abiertas ya clasificadas por el backend (reglas A/B/C) y su
 *   `resumenSesiones`;
 * - `puedeCerrar`, el gate informativo de la regla C.
 *
 * Lectura pura: no persiste nada y puede repetirse cuantas veces haga falta.
 *
 * `gcTime: 0` para que, al cerrar y reabrir el wizard, el Paso 1 arranque en
 * `isLoading` con una foto nueva del turno en vez de pintar por un instante la
 * del intento anterior — entre un intento y otro pudo entrar un cobro o una
 * mesa pudo pedir la cuenta, y esa foto vieja es justo la que no sirve.
 *
 * `enabled` permite montarlo sin disparar la consulta: solo se pide cuando el
 * wizard está efectivamente abierto.
 */
export function useCloseContext({ idCierre, enabled = true, refetchInterval = false } = {}) {
  return useQuery({
    queryKey: [...CLOSE_CONTEXT_KEY, idCierre],
    queryFn: async ({ signal }) => {
      const contexto = await api.get('/caja/cierre/contexto', { signal });
      assertCashierContext(contexto.idCierre, idCierre);
      return contexto;
    },
    enabled: enabled && idCierre != null,
    refetchInterval,
    gcTime: 0,
  });
}
