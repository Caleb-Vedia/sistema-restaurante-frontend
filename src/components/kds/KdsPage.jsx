import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useKdsOrders } from '../../hooks/useKdsOrders';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import { Button } from '../ui/Button';
import OrderCard from './OrderCard';

/**
 * Núcleo compartido del KDS (Cocina/Bebidas). Ambas áreas comparten
 * exactamente: shape de respuesta, estados, transiciones, card, polling,
 * mutación PATCH y lógica de error — lo único que varía es el área
 * ('cocina' | 'bebidas'), que decide el endpoint/queryKey, y el ícono/texto
 * del estado vacío. KitchenPage y BarPage son wrappers de una línea sobre
 * esto.
 *
 * Loading/error/vacío reusan el mismo lenguaje visual que Cliente/Caja
 * (`EmptyState`, tokens semánticos) — ya no hace falta un panel oscuro
 * aparte (`KdsStatePanel`, eliminado) porque KDS dejó de tener su propia
 * paleta.
 *
 * Props:
 * - area: 'cocina' | 'bebidas'
 * - emptyIcon: elemento Lucide del estado "sin pedidos", propio de cada área
 * - emptyTitle: texto del estado "sin pedidos", propio de cada área
 */
export default function KdsPage({ area, emptyIcon, emptyTitle }) {
  const { data: pedidos, isLoading, isError, refetch } = useKdsOrders(area);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title="No se pudieron cargar los pedidos"
        description="Hubo un problema al conectar con el servidor. Probá de nuevo."
      >
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Reintentar
        </Button>
      </EmptyState>
    );
  }

  if (pedidos.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description="Los pedidos nuevos van a aparecer acá automáticamente."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {pedidos.map((pedido) => (
        <OrderCard key={pedido.idPedido} pedido={pedido} area={area} />
      ))}
    </div>
  );
}
