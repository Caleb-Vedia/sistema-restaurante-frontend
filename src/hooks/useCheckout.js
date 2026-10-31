import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useCarrito from '../store/useCarrito';
import { MENU_KEY } from './useMenu';
import { useCreateOrder, isAmbiguousError, buildOrderPayload } from './useCreateOrder';
import { useMisPedidos } from './useMisPedidos';
import { groupCartItemsByArea } from '../utils/groupCartItemsByArea';
import { isOrderConfirmation } from '../utils/orderConfirmation';
import {
  readAmbiguousMarker, markAmbiguousResult, clearAmbiguousResult,
  readPendingAttempt, prepareOrderAttempt, discardRejectedAttempt, completeOrderAttempt,
} from '../utils/clientOrderStorage';

// Un intento persistido por área. La secuencia se detiene ante cualquier duda:
// ni desmontar la pantalla ni recargar autoriza a generar otra identidad.
export function useCheckout({ tableId, token }) {
  const queryClient = useQueryClient();
  const createOrder = useCreateOrder();
  const misPedidos = useMisPedidos({ tableId, token, enabled: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrders, setCreatedOrders] = useState([]);
  const [failure, setFailure] = useState(null);
  const [storageFailedIds, setStorageFailedIds] = useState([]);
  const [ambiguous, setAmbiguous] = useState(() => readAmbiguousMarker(tableId, token));
  const [canRetry, setCanRetry] = useState(false);
  const enviandoRef = useRef(false);
  const visitaRef = useRef({ tableId, token });
  visitaRef.current = { tableId, token };

  useEffect(() => {
    setAmbiguous(readAmbiguousMarker(tableId, token));
    setCreatedOrders([]);
    setFailure(null);
    setStorageFailedIds([]);
    setCanRetry(false);
  }, [tableId, token]);

  const sigueEnVisita = () => {
    const cart = useCarrito.getState();
    return visitaRef.current.tableId === tableId && visitaRef.current.token === token
      && String(cart.tableId) === String(tableId) && cart.token === token;
  };

  const incierto = (intento) => {
    setAmbiguous(markAmbiguousResult(tableId, token, intento.lines.map(line => line.lineKey)));
    setFailure({ kind: 'incierto' });
  };

  const siguePendiente = (intento) =>
    readPendingAttempt(tableId, token)?.claveIdempotencia === intento.claveIdempotencia;

  const confirmar = (intento, pedido) => {
    // No retirar silenciosamente una cantidad editada mientras el resultado era incierto.
    const actuales = useCarrito.getState().items;
    if (intento.lines.some(line => actuales.some(item => item.lineKey === line.lineKey && item.cantidad !== line.cantidad))) {
      incierto(intento);
      setFailure({ kind: 'local', message: 'El pedido está registrado. Revisá y retirá las líneas confirmadas cuya cantidad cambiaste antes de volver a consultar.' });
      return false;
    }
    if (!completeOrderAttempt(tableId, token, intento.claveIdempotencia, pedido)) {
      incierto(intento);
      setStorageFailedIds(prev => [...prev, pedido.idPedido]);
      setFailure({ kind: 'local', message: 'El pedido está registrado, pero no se pudo guardar su confirmación. Conservamos el intento: volvé a consultar antes de enviar.' });
      return false;
    }
    intento.lines.forEach(line => useCarrito.getState().eliminarItem(line.lineKey));
    setCreatedOrders(prev => [...prev.filter(order => order.idPedido !== pedido.idPedido), pedido]);
    setAmbiguous(null);
    setFailure(null);
    setCanRetry(false);
    return true;
  };

  const enviarIntento = async (intento, recuperando = false) => {
    try {
      const pedido = await createOrder.mutateAsync({ token, payload: intento.payload, claveIdempotencia: intento.claveIdempotencia });
      // Otra instancia de la pantalla pudo recuperar este intento mientras
      // llegaba la respuesta original. Esa respuesta tardía no toca el siguiente.
      if (!sigueEnVisita() || !siguePendiente(intento)) return false;
      if (!isOrderConfirmation(pedido) || pedido.claveIdempotencia !== intento.claveIdempotencia) {
        const error = new Error('No se pudo confirmar la información del pedido registrado.');
        error.code = 'INVALID_ORDER_CONFIRMATION';
        throw error;
      }
      return confirmar(intento, pedido);
    } catch (error) {
      if (!sigueEnVisita() || !siguePendiente(intento)) return false;
      // Un rechazo actual durante la recuperación no demuestra que el intento
      // original nunca se haya creado: no descartar su identidad.
      if (recuperando || isAmbiguousError(error)) {
        incierto(intento);
      } else if (discardRejectedAttempt(tableId, token)) {
        setAmbiguous(null);
        setFailure({ kind: 'rechazado', status: error?.status, message: error?.message });
        if (error?.status === 409) queryClient.invalidateQueries({ queryKey: MENU_KEY });
      } else {
        incierto(intento);
      }
      return false;
    }
  };

  const enviarPedido = async ({ nombreComensal }) => {
    if (enviandoRef.current || !sigueEnVisita()) return;
    const snapshot = useCarrito.getState().items;
    const pendiente = readAmbiguousMarker(tableId, token) ?? ambiguous;
    if (pendiente && (pendiente.claveIdempotencia || snapshot.some(item => pendiente.itemIds.includes(item.lineKey)))) return;
    const grupos = groupCartItemsByArea(snapshot);
    if (grupos.length === 0) return;
    enviandoRef.current = true;
    setIsSubmitting(true);
    setCreatedOrders([]);
    setFailure(null);
    setStorageFailedIds([]);
    try {
      for (const grupo of grupos) {
        const intento = prepareOrderAttempt(tableId, token, grupo.idAreaProducto,
          buildOrderPayload({ nombreComensal, items: grupo.items }), grupo.items);
        if (!await enviarIntento(intento)) return;
      }
    } catch (error) {
      if (sigueEnVisita()) setFailure({ kind: 'local', message: error.message });
    } finally {
      enviandoRef.current = false;
      setIsSubmitting(false);
    }
  };

  // El reconocimiento explícito consulta por la clave exacta, sin deducir
  // identidad por contenido/horas ni borrar a ciegas la identidad persistida.
  const reconocerResultadoIncierto = async () => {
    if (enviandoRef.current || !sigueEnVisita()) return;
    const intento = readPendingAttempt(tableId, token);
    if (!intento) {
      clearAmbiguousResult(tableId, token); // Marcadores anteriores sin clave.
      setAmbiguous(readAmbiguousMarker(tableId, token));
      return;
    }
    enviandoRef.current = true;
    setIsSubmitting(true);
    setCanRetry(false);
    try {
      const result = await misPedidos.refetch();
      if (!sigueEnVisita() || !siguePendiente(intento)) return;
      if (result.error || !Array.isArray(result.data)) throw new Error('No se pudo consultar el pedido. Conservamos el intento pendiente.');
      const pedido = result.data.find(order => order.claveIdempotencia === intento.claveIdempotencia);
      if (pedido) {
        if (!isOrderConfirmation(pedido)) throw new Error('La confirmación recibida está incompleta. Conservamos el intento pendiente.');
        confirmar(intento, pedido);
      } else {
        setCanRetry(true);
        setFailure({ kind: 'local', message: 'El intento todavía no aparece registrado. Podés reenviar explícitamente el mismo intento, con su contenido y clave originales.' });
      }
    } catch (error) {
      if (sigueEnVisita()) setFailure({ kind: 'local', message: error.message });
    } finally {
      enviandoRef.current = false;
      setIsSubmitting(false);
    }
  };

  const reintentarMismoIntento = async () => {
    if (!canRetry || enviandoRef.current || !sigueEnVisita()) return;
    const intento = readPendingAttempt(tableId, token);
    if (!intento) return;
    enviandoRef.current = true;
    setIsSubmitting(true);
    setCanRetry(false);
    try { await enviarIntento(intento, true); }
    finally { enviandoRef.current = false; setIsSubmitting(false); }
  };

  return { isSubmitting, createdOrders, failure, storageFailedIds, ambiguous,
    enviarPedido, reconocerResultadoIncierto, canRetry, reintentarMismoIntento };
}
