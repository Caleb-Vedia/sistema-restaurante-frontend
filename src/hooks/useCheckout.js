import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useCarrito from '../store/useCarrito';
import { MENU_KEY } from './useMenu';
import { useCreateOrder, isAmbiguousError } from './useCreateOrder';
import { groupCartItemsByArea } from '../utils/groupCartItemsByArea';
import {
  saveClientOrder,
  readAmbiguousMarker,
  markAmbiguousResult,
  clearAmbiguousResult,
} from '../utils/clientOrderStorage';

/**
 * Orquesta el checkout del cliente: convierte un carrito (que puede tener
 * varias áreas) en N pedidos reales, uno por área.
 *
 * SECUENCIAL, nunca Promise.all
 * -----------------------------
 * Los grupos se envían de a uno, con `await`, y la secuencia se DETIENE en
 * el primer fallo. En paralelo, si cocina falla, bebidas ya estaría creando
 * un pedido sin que sepamos todavía qué pasó — y cada POST es atómico por
 * separado: no hay transacción que los una ni forma de deshacer el que sí
 * se creó.
 *
 * SNAPSHOT al pulsar enviar
 * -------------------------
 * Los grupos se calculan UNA vez, sobre los items del momento del click, y
 * la iteración trabaja sobre ese snapshot. Es necesario porque cada grupo
 * exitoso borra sus propias líneas del carrito: si los grupos se
 * recalcularan sobre el store en vivo, esas bajas modificarían la
 * iteración pendiente mientras está corriendo.
 *
 * ORDEN por grupo exitoso (importa)
 * ---------------------------------
 *   1. el pedido se considera confirmado
 *   2. se guarda el response en sessionStorage (única copia recuperable)
 *   3. se quitan del carrito SOLO los items de ESE grupo
 *   4. se registra el pedido para mostrarlo en pantalla
 *   5. se sigue con el grupo siguiente
 * No se espera al final para limpiar: si cocina ya se creó y bebidas falla,
 * cocina no puede quedar en el carrito, porque un reenvío lo duplicaría.
 * Nunca se llama a `vaciarCarrito()` — con cada grupo borrando lo suyo, un
 * éxito total deja el carrito vacío por consecuencia, no por barrido.
 *
 * Nada se reintenta automáticamente, en ningún caso.
 */
export function useCheckout({ tableId, token }) {
  const queryClient = useQueryClient();
  const createOrder = useCreateOrder();
  const eliminarItem = useCarrito((state) => state.eliminarItem);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Pedidos creados en ESTE intento, para mostrarlos en la pantalla.
  const [createdOrders, setCreatedOrders] = useState([]);
  // Cómo terminó el intento cuando no terminó bien:
  //   { kind: 'rechazado', status, message } → el servidor respondió y no creó el pedido
  //   { kind: 'incierto' }                   → no sabemos si el pedido se creó
  const [failure, setFailure] = useState(null);
  // idPedido de los pedidos cuyo POST fue exitoso pero cuyo
  // saveClientOrder falló: OrderStatusPage (/order/:orderId) no va a poder
  // recuperarlos después, así que CartPage usa esta lista para no ofrecer
  // un link "Ver pedido" que no puede cumplir su promesa.
  const [storageFailedIds, setStorageFailedIds] = useState([]);

  // El marcador de resultado incierto se lee de sessionStorage al montar:
  // CartPage puede desmontarse y volver (el usuario vuelve al menú y
  // regresa) mientras el Zustand sigue vivo, y el bloqueo tiene que
  // sobrevivir a eso. Se relee si cambia la visita (tableId o token): un
  // token nuevo es otra sesión y el marcador viejo ya no aplica.
  const [ambiguous, setAmbiguous] = useState(() => readAmbiguousMarker(tableId, token));

  useEffect(() => {
    setAmbiguous(readAmbiguousMarker(tableId, token));
  }, [tableId, token]);

  // Guarda de reentrada real contra el doble submit. El botón también se
  // deshabilita con `isSubmitting`, pero eso es estado de React: dos clicks
  // en el mismo tick verían el valor viejo. El ref cambia al instante.
  const enviandoRef = useRef(false);

  const enviarPedido = async ({ nombreComensal }) => {
    if (enviandoRef.current) return;

    const snapshot = useCarrito.getState().items;
    const grupos = groupCartItemsByArea(snapshot);
    if (grupos.length === 0) return;

    enviandoRef.current = true;
    setIsSubmitting(true);
    setCreatedOrders([]);
    setFailure(null);
    setStorageFailedIds([]);

    try {
      for (const grupo of grupos) {
        let pedido;

        try {
          pedido = await createOrder.mutateAsync({ token, nombreComensal, items: grupo.items });
        } catch (error) {
          if (isAmbiguousError(error)) {
            // No sabemos si el backend lo creó: los items de este grupo NO
            // se tocan y queda el marcador que bloquea un reenvío a ciegas.
            // Se identifican por `lineKey`, no por `idProducto`: si el
            // carrito tiene dos variantes del mismo producto en grupos
            // distintos, bloquear por `idProducto` bloquearía (o
            // desbloquearía) la variante equivocada.
            setAmbiguous(
              markAmbiguousResult(
                tableId,
                token,
                grupo.items.map((item) => item.lineKey),
              ),
            );
            setFailure({ kind: 'incierto' });
          } else {
            // Rechazo confirmado (4xx): este grupo NO se creó, así que sus
            // items siguen en el carrito tal cual estaban.
            setFailure({ kind: 'rechazado', status: error?.status, message: error?.message });

            // 409 puede ser un producto que dejó de estar disponible desde
            // que se cargó el menú. GET /menu es una lectura pública, así
            // que refrescar el catálogo es seguro y ayuda a reconciliar.
            // El carrito NO se toca: sacar el producto rechazado es una
            // decisión del usuario, no automática.
            if (error?.status === 409) {
              queryClient.invalidateQueries({ queryKey: MENU_KEY });
            }
          }

          // Se corta la secuencia: los grupos que faltaban no se envían.
          return;
        }

        const persistido = saveClientOrder(tableId, token, pedido);
        // El pedido YA existe en el backend: que sessionStorage falle no lo
        // convierte en un error de creación. Se sigue igual (se quitan los
        // items, se muestra el pedido) y solo se avisa como advertencia
        // secundaria.
        if (!persistido) setStorageFailedIds((previos) => [...previos, pedido.idPedido]);

        // `lineKey`, no `idProducto`: borra exactamente la variante
        // confirmada, nunca otra variante del mismo producto que haya
        // quedado en un grupo posterior o en un intento anterior.
        grupo.items.forEach((item) => eliminarItem(item.lineKey));

        setCreatedOrders((previos) => [...previos, pedido]);
      }
    } finally {
      enviandoRef.current = false;
      setIsSubmitting(false);
    }
  };

  /**
   * El usuario reconoce la advertencia de resultado incierto (consultó al
   * personal) y desbloquea el envío. Es la ÚNICA forma de sacar el
   * marcador: nunca se limpia solo, ni se "comprueba" contra el backend —
   * no existe ningún endpoint de cliente con el que reconciliar.
   */
  const reconocerResultadoIncierto = () => {
    clearAmbiguousResult(tableId, token);
    setAmbiguous(null);
  };

  return {
    isSubmitting,
    createdOrders,
    failure,
    storageFailedIds,
    ambiguous,
    enviarPedido,
    reconocerResultadoIncierto,
  };
}
