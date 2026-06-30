import { useEffect, useRef, useState, useCallback } from 'react';
 
/**
 * Hook para conectarse a un canal WebSocket del backend.
 *
 * Flujo:
 * 1. Al montar el componente, abre la conexión WebSocket
 * 2. Actualiza `data` cada vez que llega un mensaje del backend
 * 3. Al desmontar el componente, cierra la conexión (cleanup)
 *
 * Retorna:
 * - data:   último mensaje recibido del backend (objeto JS)
 * - status: 'connecting' | 'connected' | 'disconnected' | 'error'
 * - send:   función para enviar mensajes al backend
 *
 * Uso:
 *   const { data, status, send } = useWebSocket('kitchen');
 *
 *   useEffect(() => {
 *     if (data) setOrders(prev => [...prev, data]);
 *   }, [data]);
 *
 * El backend de FastAPI debe tener los endpoints en:
 *   ws://localhost:8000/ws/kitchen
 *   ws://localhost:8000/ws/bar
 *   ws://localhost:8000/ws/cashier
 */
 
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
 
export function useWebSocket(channel) {
  const [data, setData]     = useState(null);
  const [status, setStatus] = useState('disconnected');
  const socketRef           = useRef(null);
 
  useEffect(() => {
    if (!channel) return;
 
    const socket = new WebSocket(`${WS_BASE_URL}/ws/${channel}`);
    socketRef.current = socket;
    setStatus('connecting');
 
    socket.onopen = () => {
      setStatus('connected');
    };
 
    socket.onmessage = (event) => {
      try {
        setData(JSON.parse(event.data));
      } catch {
        console.warn('[useWebSocket] Mensaje inválido recibido:', event.data);
      }
    };
 
    socket.onerror = () => {
      setStatus('error');
    };
 
    socket.onclose = () => {
      setStatus('disconnected');
    };
 
    // Cleanup: se ejecuta cuando el componente se desmonta o cambia `channel`
    return () => {
      socket.close();
    };
  }, [channel]);
 
  const send = useCallback((payload) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      console.warn('[useWebSocket] No se puede enviar: el socket no está conectado.');
    }
  }, []);
 
  return { data, status, send };
}
 