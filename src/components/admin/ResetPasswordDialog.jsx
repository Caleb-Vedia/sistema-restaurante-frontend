import { useState } from 'react';
import { useResetUserPassword } from '../../hooks/useResetUserPassword';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../ui/dialog';

/** Sin trim: los espacios podrían ser parte deliberada de la contraseña. */
function parseNewPassword(password, confirmPassword) {
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  if (password !== confirmPassword) return { error: 'Las contraseñas no coinciden.' };
  return { value: password };
}

/**
 * Reseteo administrativo de contraseña: PATCH /usuarios/:id/password.
 *
 * Dialog independiente de UserFormDialog a propósito (ver comentario de
 * useResetUserPassword): el admin no ve ni pide la contraseña actual, solo
 * define una nueva — dos campos (nueva + confirmación), sin trim, sin
 * mostrar el valor en texto plano por default (type="password").
 *
 * El aviso sobre sesiones existentes es deliberadamente literal al
 * comportamiento real del backend: el JWT/cookie ya emitido NO se invalida
 * al cambiar la contraseña, así que NUNCA se dice "se cerrarán sus
 * sesiones" — eso sería prometer un logout remoto que esta acción no hace.
 */
export default function ResetPasswordDialog({ user, onOpenChange, onReset }) {
  const resetPassword = useResetUserPassword();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (resetPassword.isPending) return;

    const result = parseNewPassword(password, confirmPassword);
    if (result.error) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);

    resetPassword.mutate(
      { idUsuario: user.idUsuario, passwordNueva: result.value },
      { onSuccess: () => onReset('Contraseña restablecida correctamente.') },
    );
  };

  const errorMessage =
    validationError ??
    (resetPassword.isError
      ? resetPassword.error?.message || 'No se pudo restablecer la contraseña. Intentá de nuevo.'
      : null);

  return (
    <Dialog open={!!user} onOpenChange={(next) => !resetPassword.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>
            Vas a definir una nueva contraseña para{' '}
            <span className="font-semibold text-foreground">{user?.nombre}</span>. El usuario podrá iniciar
            sesión con esta nueva contraseña.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="passwordNueva" className="text-sm font-medium text-foreground">
              Nueva contraseña
            </label>
            <Input
              id="passwordNueva"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              disabled={resetPassword.isPending}
              onChange={(event) => {
                setPassword(event.target.value);
                if (validationError) setValidationError(null);
              }}
            />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="passwordConfirmar" className="text-sm font-medium text-foreground">
              Confirmar contraseña
            </label>
            <Input
              id="passwordConfirmar"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              disabled={resetPassword.isPending}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (validationError) setValidationError(null);
              }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Las sesiones que ya estén abiertas no se cerrarán automáticamente.
          </p>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={resetPassword.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? 'Restableciendo...' : 'Restablecer contraseña'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
