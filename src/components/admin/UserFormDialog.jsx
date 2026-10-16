import { useState } from 'react';
import { useCreateUser } from '../../hooks/useCreateUser';
import { useUpdateUser } from '../../hooks/useUpdateUser';
import { USER_ROLES } from '../../utils/userRoles';
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

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

function parseNombre(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { error: 'El nombre es obligatorio.' };
  return { value: trimmed };
}

/** Solo no-vacío + `type="email"` para el nudge nativo del navegador — sin regex propia ni normalización. */
function parseEmail(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { error: 'El email es obligatorio.' };
  return { value: trimmed };
}

/**
 * Opcional, sin estructura impuesta (admite "+", espacios, etc. — números
 * bolivianos válidos no deben quedar afuera). El backend es la única
 * autoridad de validación real; acá solo se trimea y se convierte un campo
 * vacío en `null`, mismo criterio que `descripcion` en ProductFormDialog.
 */
function parseTelefono(raw) {
  const trimmed = raw.trim();
  return { value: trimmed === '' ? null : trimmed };
}

function parsePassword(raw) {
  if (raw.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  return { value: raw };
}

/**
 * Formulario de alta/edición de usuario de staff, compartido — mismo
 * criterio que CategoryFormDialog/ProductFormDialog: la diferencia real
 * entre crear y editar es qué mutation dispara, si los campos arrancan
 * precargados, y que Editar no tiene campo de contraseña (tiene su propio
 * dialog independiente, ResetPasswordDialog). El padre (UsersPage) lo
 * remonta por `key` en cada apertura para que el estado arranque limpio.
 *
 * Bloqueo de rol (protección de UX, NO regla de backend)
 * -------------------------------------------------------
 * `isSelf` e `isLastActiveAdmin` los calcula UsersPage a partir de
 * useAuth() y del propio listado de usuarios — el backend PERMITE que un
 * admin se quite su propio rol admin, o que se quede la cuenta sin ningún
 * admin activo; nada de esto está protegido del lado del servidor. Acá
 * solo se evita el accidente más evidente desde ESTA pantalla: si el
 * usuario que se está editando es admin Y (es el usuario logueado O es el
 * único admin activo), el select de rol queda fijo en 'admin' y
 * deshabilitado, con el motivo explicado debajo. Nombre y email NUNCA se
 * bloquean por esto.
 */
export default function UserFormDialog({ open, user, isSelf, isLastActiveAdmin, onOpenChange, onSaved }) {
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const mutation = user ? updateUser : createUser;

  const [nombre, setNombre] = useState(user?.nombre ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState(user?.rol ?? USER_ROLES[0].value);
  const [telefono, setTelefono] = useState(user?.telefono ?? '');
  const [validationError, setValidationError] = useState(null);

  const roleLocked = !!user && user.rol === 'admin' && (isSelf || isLastActiveAdmin);
  const roleLockedReason = isSelf
    ? 'No podés cambiar tu propio rol administrativo desde esta pantalla.'
    : 'Debe existir al menos un administrador activo.';

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mutation.isPending) return;

    const nombreResult = parseNombre(nombre);
    if (nombreResult.error) {
      setValidationError(nombreResult.error);
      return;
    }

    const emailResult = parseEmail(email);
    if (emailResult.error) {
      setValidationError(emailResult.error);
      return;
    }

    if (!user) {
      const passwordResult = parsePassword(password);
      if (passwordResult.error) {
        setValidationError(passwordResult.error);
        return;
      }
    }

    if (!USER_ROLES.some((opcion) => opcion.value === rol)) {
      setValidationError('Elegí un rol válido.');
      return;
    }

    setValidationError(null);

    const telefonoResult = parseTelefono(telefono);

    const payload = user
      ? {
          idUsuario: user.idUsuario,
          nombre: nombreResult.value,
          email: emailResult.value,
          rol,
          telefono: telefonoResult.value,
        }
      : {
          nombre: nombreResult.value,
          email: emailResult.value,
          password,
          rol,
          telefono: telefonoResult.value,
        };

    mutation.mutate(payload, {
      onSuccess: () => onSaved(user ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.'),
    });
  };

  const errorMessage =
    validationError ??
    (mutation.isError ? mutation.error?.message || 'No se pudo guardar el usuario. Intentá de nuevo.' : null);

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            {user
              ? 'Modificá los datos del usuario.'
              : 'Completá los datos para dar de alta un nuevo usuario de staff.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="nombreUsuario" className="text-sm font-medium text-foreground">
              Nombre
            </label>
            <Input
              id="nombreUsuario"
              autoFocus
              value={nombre}
              disabled={mutation.isPending}
              onChange={(event) => {
                setNombre(event.target.value);
                if (validationError) setValidationError(null);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emailUsuario" className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              id="emailUsuario"
              type="email"
              autoComplete="email"
              value={email}
              disabled={mutation.isPending}
              onChange={(event) => {
                setEmail(event.target.value);
                if (validationError) setValidationError(null);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="telefonoUsuario" className="text-sm font-medium text-foreground">
              Teléfono / WhatsApp <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Input
              id="telefonoUsuario"
              type="tel"
              autoComplete="tel"
              value={telefono}
              disabled={mutation.isPending}
              onChange={(event) => {
                setTelefono(event.target.value);
                if (validationError) setValidationError(null);
              }}
            />
          </div>

          {!user && (
            <div className="space-y-1.5">
              <label htmlFor="passwordUsuario" className="text-sm font-medium text-foreground">
                Contraseña
              </label>
              <Input
                id="passwordUsuario"
                type="password"
                autoComplete="new-password"
                value={password}
                disabled={mutation.isPending}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (validationError) setValidationError(null);
                }}
              />
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="rolUsuario" className="text-sm font-medium text-foreground">
              Rol
            </label>
            <select
              id="rolUsuario"
              className={selectClass}
              value={rol}
              disabled={mutation.isPending || roleLocked}
              onChange={(event) => {
                setRol(event.target.value);
                if (validationError) setValidationError(null);
              }}
            >
              {USER_ROLES.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
            {roleLocked && <p className="text-xs text-muted-foreground">{roleLockedReason}</p>}
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? user
                  ? 'Guardando...'
                  : 'Creando...'
                : user
                  ? 'Guardar cambios'
                  : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
