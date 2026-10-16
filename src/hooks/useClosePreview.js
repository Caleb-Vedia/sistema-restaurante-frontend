import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Preview del cierre: POST /caja/cierre/preview.
 *
 * Paso 3 del cierre en 4 pasos. Es el mismo cálculo que el contexto, ahora con
 * los montos verificados, y devuelve el mismo shape (CierrePreviewResponse).
 *
 * Es una mutation y no una query aunque NO modifique nada: se dispara por una
 * acción explícita ("Continuar" desde el arqueo, "Recalcular" en conciliación)
 * y lleva body. El backend no persiste nada acá — no crea detalle, no toca
 * `cerradaEl`, no toca mesas — así que repetirlo es gratis y NO cierra caja.
 *
 * Sin invalidaciones de ningún tipo, justamente porque no cambió nada del
 * servidor. El único endpoint irreversible del flujo es PATCH /caja/cerrar
 * (useCloseCashRegister).
 *
 * El body es EXACTAMENTE el mismo que después recibe el cierre definitivo
 * (backend: CerrarCajaDto compartido), así que no hay forma de que lo
 * previsualizado y lo cerrado difieran por el contrato.
 *
 * Uso:
 *   const preview = useClosePreview();
 *   preview.mutate({ detalle: [...], observacionDiferencia: '...' });
 */
export function useClosePreview() {
  return useMutation({
    mutationFn: (body) => api.post('/caja/cierre/preview', body),
  });
}
