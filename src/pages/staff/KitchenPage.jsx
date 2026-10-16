import { UtensilsCrossed } from 'lucide-react';
import KdsPage from '../../components/kds/KdsPage';

/**
 * KDS de Cocina. Wrapper de KdsPage con area="cocina": mismo comportamiento
 * que antes de compartir el núcleo con Bebidas — GET/PATCH /pedidos/cocina,
 * query key ['pedidos','cocina'], polling de 4s.
 */
export default function KitchenPage() {
  return (
    <KdsPage
      area="cocina"
      emptyIcon={<UtensilsCrossed />}
      emptyTitle="No hay pedidos pendientes en cocina"
    />
  );
}
