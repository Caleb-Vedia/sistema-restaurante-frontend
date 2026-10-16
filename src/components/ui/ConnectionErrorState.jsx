import { WifiOff } from 'lucide-react';
import EmptyState from './EmptyState';
import { Button } from './Button';

/**
 * Estado de error cuando GET /auth/me falla por una razón real (5xx, red)
 * y no por falta de sesión (401, que useAuth ya resuelve como usuario null).
 *
 * Compartido por ProtectedRoute y LoginPage: ambos necesitan la misma
 * pantalla ("no se pudo verificar la sesión" + botón Reintentar) en el
 * mismo punto del flujo de auth, solo que en contextos distintos.
 *
 * No muestra el mensaje crudo del backend ni detalles técnicos.
 *
 * Props:
 * - onRetry: función a invocar al hacer click en "Reintentar" (típicamente `refetch`)
 */
export default function ConnectionErrorState({ onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <EmptyState
        icon={<WifiOff />}
        title="No se pudo verificar tu sesión"
        description="Hubo un problema al conectar con el servidor. Probá de nuevo."
      >
        <Button onClick={onRetry}>Reintentar</Button>
      </EmptyState>
    </div>
  );
}
