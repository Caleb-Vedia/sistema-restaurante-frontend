import { useState } from 'react';
import { Ban } from 'lucide-react';
import { usePaymentHistory } from '../../hooks/usePaymentHistory';
import { useCancelPayment } from '../../hooks/useCancelPayment';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../ui/dialog';
import { formatCurrency, formatTime } from '../../utils';

/**
 * Fila de un pago del historial. Instancia su propio useCancelPayment(): así
 * `isPending`/`isError` quedan aislados a ESTE pago (mismo criterio que el
 * OrderCard del KDS con useUpdateOrderStatus) — anular uno no bloquea el
 * resto del historial ni el resto de Caja.
 *
 * La confirmación usa el Dialog de ui/ ya existente. El PATCH recién se
 * dispara al confirmar dentro del diálogo, nunca al primer click.
 *
 * "Anular" queda deliberadamente discreta (ghost + rojo) — es una acción
 * peligrosa y secundaria, no compite con el resto de la fila.
 */
function PaymentHistoryRow({ pago, idMesa }) {
  const cancelPayment = useCancelPayment();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isCancelled = pago.anuladoEl !== null;

  const handleConfirm = () => {
    setConfirmOpen(false);
    cancelPayment.mutate({ idPago: pago.idPago, idMesa });
  };

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 ${
        isCancelled ? 'border-border/60 bg-muted/20 opacity-60' : 'border-border bg-muted/30'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{pago.nombreMetodo}</span>
          <Badge
            variant="outline"
            className={isCancelled ? 'border-border text-muted-foreground' : 'border-success/30 bg-success/15 text-success-foreground'}
          >
            {isCancelled ? 'Anulado' : 'Vigente'}
          </Badge>
        </div>
        <span className="text-sm font-bold text-foreground">{formatCurrency(pago.montoPagado)}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {formatTime(pago.creadoEl)}
          {pago.nroRecibo && ` · Recibo ${pago.nroRecibo}`}
          {isCancelled && ` · Anulado ${formatTime(pago.anuladoEl)}`}
        </span>

        {!isCancelled && (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={cancelPayment.isPending}
                className="h-7 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Ban className="h-3.5 w-3.5" />
                {cancelPayment.isPending ? 'Anulando...' : 'Anular'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>¿Anular este pago?</DialogTitle>
                <DialogDescription>
                  {pago.nombreMetodo} · {formatCurrency(pago.montoPagado)}
                  {pago.nroRecibo && ` · Recibo ${pago.nroRecibo}`}.
                  <br />
                  <br />
                  Si la anulación vuelve a generar saldo pendiente, la cuenta de la mesa podrá
                  reabrirse para volver a cobrarla.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" className="h-10">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button variant="destructive" className="h-10" onClick={handleConfirm}>
                  Anular pago
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {cancelPayment.isError && (
        <p className="text-xs text-destructive" role="alert">
          {cancelPayment.error?.message || 'No se pudo anular el pago. Intentá de nuevo.'}
        </p>
      )}
    </div>
  );
}

/**
 * Historial de pagos de la mesa seleccionada (última sesión, activa o
 * cerrada). Sirve para cualquier estado de mesa — libre, ocupada o
 * cuenta_solicitada — por eso vive separado del panel de saldo/cobro, que
 * solo aplica a mesas con sesión activa.
 *
 * Props:
 * - idMesa: mesa cuyo historial se consulta. Se pasa tal cual a
 *   useCancelPayment, que siempre invalida historial/saldo/mesas de esta
 *   mesa tras anular — anular ya no depende de si la sesión seguía activa,
 *   porque puede reabrirla.
 */
export default function PaymentHistory({ idMesa }) {
  const { data: pagos, isLoading, isError, refetch } = usePaymentHistory(idMesa);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Historial de pagos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Spinner size="sm" className="text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <span className="text-sm text-muted-foreground">No se pudo cargar el historial de pagos.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()} className="shrink-0">
              Reintentar
            </Button>
          </div>
        )}

        {!isLoading && !isError && pagos?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">Sin pagos registrados</p>
        )}

        {!isLoading && !isError && pagos?.length > 0 && (
          <div className="flex flex-col gap-2">
            {pagos.map((pago) => (
              <PaymentHistoryRow key={pago.idPago} pago={pago} idMesa={idMesa} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
