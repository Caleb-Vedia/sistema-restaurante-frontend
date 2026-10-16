import { toCents, fromCents } from './index';

/**
 * Helpers puros del cierre de caja en 4 pasos.
 *
 * Nada de esto reimplementa una regla de negocio del backend: el arqueo
 * (esperado, contado, diferencias) y las reglas A/B/C se calculan ENTERAS del
 * lado del servidor (ConciliacionCajaService) y llegan ya resueltas en el
 * preview. Acá solo vive lo que es estrictamente de presentación y de armado
 * del body.
 */

/**
 * Monto verificado: número >= 0 con hasta 2 decimales.
 *
 * Un 0 explícito es un valor legítimo ("conté y no había nada"), a diferencia
 * del formulario de cobro que exige > 0. Lo que NO es lo mismo es dejar el
 * campo vacío: eso viaja como "no declarado" y el backend lo deja en null.
 */
export const MONTO_VERIFICADO_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Mismo tope que OBSERVACION_DIFERENCIA_MAX_LENGTH del backend
 * (CerrarCajaDto). Se replica acá solo para poder frenar el input antes del
 * roundtrip; la validación real sigue siendo la del servidor.
 */
export const OBSERVACION_DIFERENCIA_MAX_LENGTH = 120;

/**
 * Etiqueta del campo de conteo, resuelta por el `codigo` interno del método
 * (columna estable del backend) y NUNCA por `nombreMetodo`: el admin puede
 * renombrar "Efectivo" a gusto y el arqueo no debe cambiar de terminología por
 * eso — es el mismo criterio con el que el backend decide a qué método sumarle
 * el fondo inicial.
 *
 * Hoy el único `codigo` que la base tiene seeded es 'efectivo' (migración
 * AddCodigoMetodoPago: Tarjeta y QR/Transferencia quedaron con codigo NULL, y
 * el campo no se puede setear por API). El caso 'tarjeta' queda contemplado
 * para cuando exista esa fila; mientras tanto tarjeta cae —correctamente— en
 * la etiqueta genérica, que es la que aplica a QR/transferencia/otros.
 */
export const etiquetaMontoVerificado = (codigo) => {
  switch (codigo) {
    case 'efectivo':
      return 'Efectivo contado';
    case 'tarjeta':
      return 'Monto verificado en terminal';
    default:
      return 'Monto verificado';
  }
};

/**
 * Arma el body que comparten POST /caja/cierre/preview y PATCH /caja/cerrar
 * (el backend usa el MISMO DTO para los dos, así que previsualizar y cerrar no
 * pueden divergir).
 *
 * - `detalle` lleva SOLO los métodos con un valor declarado. Un campo vacío se
 *   omite (queda "no contado" del lado del backend) en vez de mandarse como 0,
 *   que significaría algo completamente distinto. Si no se declaró ninguno se
 *   omite la clave entera: el DTO define `detalle` como opcional justamente
 *   para ese caso.
 * - `observacionDiferencia` se manda trimeada y solo si quedó texto. El
 *   backend igual la normaliza (trim, '' -> null); se hace también acá para no
 *   mandar ruido y para que el contador del input coincida con lo que se
 *   guarda.
 *
 * `incluirObservacion` es el gate de "solo si hay diferencia": lo decide quien
 * llama, a partir del `diferenciaTotal` del ÚLTIMO preview (lo que el usuario
 * está viendo en pantalla), no de una cuenta hecha acá.
 */
export const buildCierreBody = ({
  idsMetodos,
  montos,
  observacion = '',
  incluirObservacion = false,
}) => {
  const detalle = idsMetodos
    .filter((idMetodoPago) => (montos[idMetodoPago] ?? '').trim() !== '')
    .map((idMetodoPago) => ({
      idMetodoPago,
      montoContado: Number(montos[idMetodoPago].trim()),
    }));

  const body = {};
  if (detalle.length > 0) body.detalle = detalle;

  const observacionTrimeada = observacion.trim();
  if (incluirObservacion && observacionTrimeada !== '') {
    body.observacionDiferencia = observacionTrimeada;
  }

  return body;
};

/**
 * Lo cobrado durante el turno, según el MISMO preview que se está mostrando.
 *
 * El backend no expone este número suelto en el preview, pero sí define
 * exactamente cómo se compone `totalEsperado`: es la suma de los pagos no
 * anulados de la ventana del turno MÁS el fondo inicial, que se suma
 * únicamente a la fila de efectivo (ConciliacionCajaService.calcularDetalle).
 * Restarle el fondo inicial no reimplementa ninguna regla: descompone un total
 * que ya vino calculado, en sus dos partes documentadas.
 *
 * Se hace sobre el propio preview y NO con el `totalIngresosTurno` de
 * GET /caja/actividad —que es la misma definición— a propósito: los dos
 * endpoints se generan en instantes distintos, y en la pantalla de
 * conciliación los números tienen que sumar exactamente entre sí
 * (fondo inicial + cobrado = total esperado).
 *
 * En centavos enteros, igual que el backend.
 */
export const cobradoEnTurno = ({ totalEsperado, montoInicialEfectivo }) =>
  fromCents(toCents(totalEsperado) - toCents(montoInicialEfectivo));

/**
 * Diferencia total del RESUMEN del cierre definitivo.
 *
 * El preview trae `diferenciaTotal` ya calculado, pero el resumen de
 * PATCH /caja/cerrar (CierreCajaResumenResponse) solo trae `totalEsperado` y
 * `totalContado`. Esto reconstruye ese único número para el resumen final,
 * respetando exactamente la semántica del backend (calcularTotales):
 * `totalContado: null` (nada declarado) => diferencia null, no 0.
 *
 * La resta va en centavos enteros, igual que el backend (dinero.util), para no
 * arrastrar el error de coma flotante.
 */
export const diferenciaTotalDelResumen = ({ totalEsperado, totalContado }) =>
  totalContado == null
    ? null
    : fromCents(toCents(totalContado) - toCents(totalEsperado));
