import { useState } from 'react';
import { useRequestBill } from '../../hooks/useRequestBill';
import { isAmbiguousError } from '../../hooks/useCreateOrder';
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
 * Mensaje de error para un intento de "pedir cuenta" que no terminó en
 * éxito. Distingue tres casos, cada uno con su propio texto — nunca se
 * inventa "la cuenta ya fue solicitada" a partir de un 409: ese código
 * significa "la mesa no estaba `ocupada`" (puede ser `cuenta_solicitada` u
 * otro estado), pero el backend no devuelve cuál, así que se muestra
 * `error.message` tal cual en vez de adivinar y pisar el estado local.
 */
function mensajeError(error) {
  if (isAmbiguousError(error)) {
    return 'No se pudo confirmar si la cuenta fue solicitada. Consultá al personal antes de continuar.';
  }
  if (error.status === 401) {
    return 'La sesión de esta mesa ya no está activa.';
  }
  return error.message || 'No se pudo solicitar la cuenta.';
}

/**
 * Acción "Pedir cuenta" — PATCH /mesas/pedir-cuenta (Fase 4).
 *
 * Vive en ClientLayout (una sola instancia, visible en /menu, /cart y
 * /order/:orderId a la vez, porque ClientLayout no se desmonta entre esas
 * rutas) en vez de duplicarse por página: la acción representa a toda la
 * sesión de mesa, no una pantalla puntual.
 *
 * Este componente decide TODO su propio contenido a partir de
 * `session.estado`:
 *   - `ocupada`           → botón + Dialog de confirmación
 *   - `cuenta_solicitada` → estado informativo, sin botón (repetir el
 *     PATCH sobre una mesa que ya no está `ocupada` es un 409 seguro)
 *
 * Confirmación con Dialog, nunca window.confirm() — mismo patrón que el
 * resto de la app para operaciones con efecto real (ver ProductsPage,
 * CartPage). Mientras la mutation está pendiente, `onOpenChange` ignora el
 * intento de cerrar (mismo guard `!isPending && ...` que ya usan los
 * diálogos de administración) para no perder el resultado de un click
 * accidental fuera del diálogo.
 *
 * Éxito: `useRequestBill` ya deja `session.estado` en `cuenta_solicitada`
 * en la cache de React Query y en sessionStorage (ver ese hook) — este
 * componente se entera solo por la prop `session` que le pasa ClientLayout
 * y cambia de rama en el siguiente render, sin lógica propia de
 * sincronización. `justConfirmed` es únicamente para mostrar el aviso
 * "Cuenta solicitada correctamente." en ESTE momento puntual (se pierde en
 * un remount/F5 a propósito: en ese caso alcanza con el estado persistente
 * "Cuenta solicitada").
 */
export default function RequestBillAction({ tableId, session }) {
  const [open, setOpen] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const requestBill = useRequestBill();

  if (session.estado === 'cuenta_solicitada') {
    return (
      <div className="border-t border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning-foreground" role="status">
        <p className="font-semibold">Cuenta solicitada</p>
        {justConfirmed && <p>Cuenta solicitada correctamente.</p>}
        <p>El personal de caja atenderá tu mesa.</p>
      </div>
    );
  }

  const isPending = requestBill.isPending;

  const handleConfirm = () => {
    requestBill.mutate(
      { token: session.token, tableId, session },
      { onSuccess: () => setJustConfirmed(true) },
    );
  };

  return (
    <div className="border-t border-border px-4 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">¿Ya terminaste de pedir?</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 items-center rounded-full px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Pedir cuenta
        </button>
      </div>

      <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Solicitar la cuenta?</DialogTitle>
            <DialogDescription>
              Después de solicitar la cuenta no podrás realizar nuevos pedidos en esta mesa. Los pedidos que
              ya fueron enviados continuarán preparándose normalmente.
            </DialogDescription>
          </DialogHeader>

          {requestBill.isError && (
            // Dentro del Dialog, no afuera: es acá donde el usuario está
            // parado cuando decide si reintenta o cancela — un error
            // detrás del overlay no ayudaría a esa decisión. El Dialog NO
            // se cierra solo ante un error (a diferencia del éxito, que sí
            // lo hace porque `session.estado` cambia de rama): así el
            // usuario puede leer por qué falló y, si corresponde, pulsar
            // "Solicitar cuenta" de nuevo sin salir — un reintento
            // explícito, nunca automático.
            <p className="text-xs text-destructive">{mensajeError(requestBill.error)}</p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handleConfirm} disabled={isPending}>
              {isPending ? 'Solicitando...' : 'Solicitar cuenta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
