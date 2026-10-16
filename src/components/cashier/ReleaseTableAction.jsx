import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useReleaseTable } from '../../hooks/useReleaseTable';
import { tableBalanceKey } from '../../hooks/useTableBalance';
import { TABLES_KEY } from '../../hooks/useTables';
import { Button } from '../ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../ui/dialog';

/**
 * "Liberar mesa": cierra una sesión activa SIN saldo pendiente, sin
 * registrar ningún pago. Caso típico: un QR escaneado donde el cliente se
 * fue sin pedir nada (sesión con `totalAdeudado` 0), pero cubre cualquier
 * sesión con `saldoPendiente === 0` — la misma regla económica que ya
 * aplica el backend.
 *
 * Reutiliza EXACTAMENTE el mismo PATCH /mesas/:id/cerrar-sesion y el mismo
 * hook (useReleaseTable) que ya usa PaymentRecovery para la recuperación
 * post-pago: es la misma operación de backend, solo que acá el disparador
 * es "no hay nada que cobrar" en vez de "el pago se registró pero la mesa
 * no se liberó". No se toca el hook ni se reimplementa el PATCH.
 *
 * El backend sigue siendo la única autoridad real: `saldoPendiente === 0`
 * en el frontend es solo la condición para OFRECER el botón, nunca una
 * garantía. Si cambió entretanto (un pedido nuevo, otra terminal que cobró
 * distinto), el PATCH responde 409 y acá se muestra `error.message` tal
 * cual — sin reintento automático, sin asumir éxito. Un 409 puede significar
 * que el estado canónico cambió desde que Caja cargó los datos, así que acá
 * se reconcilian explícitamente AMBAS queries compartidas ante error —
 * ['mesas'] (estado/sesión de la mesa) y ['pagos','total',idMesa] (saldo) —
 * sin tocar el comportamiento del hook compartido con PaymentRecovery.
 *
 * Props:
 * - idMesa, nombreMesa: de la mesa/sesión seleccionada en CashierPage
 * - onReleased: aviso de que la sesión quedó cerrada (la página suelta la selección)
 */
export default function ReleaseTableAction({ idMesa, nombreMesa, onReleased }) {
  const queryClient = useQueryClient();
  const releaseTable = useReleaseTable();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isPending = releaseTable.isPending;

  const handleConfirm = () => {
    releaseTable.mutate(
      { idMesa },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          onReleased();
        },
        onError: () => {
          queryClient.invalidateQueries({ queryKey: tableBalanceKey(idMesa) });
          queryClient.invalidateQueries({ queryKey: TABLES_KEY });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-10"
        disabled={isPending}
        onClick={() => setConfirmOpen(true)}
      >
        Liberar mesa
      </Button>

      {releaseTable.isError && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {releaseTable.error?.message || 'No se pudo liberar la mesa. Intentá de nuevo.'}
        </p>
      )}

      <Dialog open={confirmOpen} onOpenChange={(next) => !isPending && setConfirmOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Liberar esta mesa?</DialogTitle>
            <DialogDescription>
              La sesión de <span className="font-semibold text-foreground">{nombreMesa}</span>{' '}
              se cerrará sin registrar ningún pago porque no existe saldo pendiente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-10" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="button" className="h-10" onClick={handleConfirm} disabled={isPending}>
              {isPending ? 'Liberando...' : 'Liberar mesa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
