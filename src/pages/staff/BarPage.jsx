import { CupSoda } from 'lucide-react';
import KdsPage from '../../components/kds/KdsPage';

/**
 * KDS de Bebidas. Wrapper de KdsPage con area="bebidas": mismo núcleo que
 * Cocina (mismo contrato de backend, mismas transiciones, misma card);
 * solo cambia el endpoint/queryKey (vía area) y el ícono/texto de "sin pedidos".
 */
export default function BarPage() {
  return (
    <KdsPage
      area="bebidas"
      emptyIcon={<CupSoda />}
      emptyTitle="No hay pedidos pendientes en bebidas"
    />
  );
}
