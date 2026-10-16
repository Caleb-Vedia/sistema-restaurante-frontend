import { useMemo, useState } from 'react';
import { useUsers } from '../../hooks/useUsers';
import { useAuth } from '../../hooks/useAuth';
import { useSetUserActive } from '../../hooks/useSetUserActive';
import UserFormDialog from '../../components/admin/UserFormDialog';
import ResetPasswordDialog from '../../components/admin/ResetPasswordDialog';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/input';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../../components/ui/dialog';
import { USER_ROLES, USER_ROLE_LABELS } from '../../utils/userRoles';

const selectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

const ROLE_FILTER_OPTIONS = [{ value: 'todos', label: 'Todos' }, ...USER_ROLES];
const STATUS_FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
];

/**
 * Activar/desactivar un usuario. Instancia su propio useSetUserActive():
 * pending/error quedan aislados a ESTA fila (mismo criterio que
 * AvailabilityAction en ProductsPage), sin bloquear el resto de la lista.
 *
 * `blockedReason` cubre las dos protecciones de UX de la Fase de Usuarios
 * (ver comentario largo en UserFormDialog: NINGUNA de las dos es una regla
 * de backend, el PATCH /usuarios/:id/activo real no las impide):
 *   - `isSelf`: no ofrecer que el admin logueado se desactive a sí mismo
 *   - `isLastActiveAdmin`: no ofrecer desactivar al único admin activo
 * Cuando aplica alguna, el botón "Desactivar" queda deshabilitado con el
 * motivo visible debajo (y como `title` nativo) — nunca oculto: el admin
 * tiene que entender por qué no puede.
 */
function SetUserActiveAction({ usuario, isSelf, isLastActiveAdmin, onChanged }) {
  const setActive = useSetUserActive();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isPending = setActive.isPending;

  const errorMessage = setActive.isError
    ? setActive.error?.message || 'No se pudo actualizar el estado del usuario. Intentá de nuevo.'
    : null;

  if (!usuario.activo) {
    const handleActivate = () => {
      if (isPending) return;
      setActive.mutate(
        { idUsuario: usuario.idUsuario, activo: true },
        { onSuccess: () => onChanged('Usuario activado correctamente.') },
      );
    };

    return (
      <div className="flex flex-col items-end gap-1">
        <Button variant="outline" size="sm" disabled={isPending} onClick={handleActivate}>
          {isPending ? 'Actualizando...' : 'Activar'}
        </Button>
        {errorMessage && <p className="max-w-48 text-right text-xs text-destructive">{errorMessage}</p>}
      </div>
    );
  }

  const blockedReason = isSelf
    ? 'No podés desactivar tu propia cuenta desde esta pantalla.'
    : isLastActiveAdmin
      ? 'Debe existir al menos un administrador activo.'
      : null;

  if (blockedReason) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button variant="outline" size="sm" disabled title={blockedReason}>
          Desactivar
        </Button>
        <p className="max-w-48 text-right text-xs text-gray-400">{blockedReason}</p>
      </div>
    );
  }

  const handleConfirmDeactivate = () => {
    setConfirmOpen(false);
    setActive.mutate(
      { idUsuario: usuario.idUsuario, activo: false },
      { onSuccess: () => onChanged('Usuario desactivado correctamente.') },
    );
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" disabled={isPending} onClick={() => setConfirmOpen(true)}>
        {isPending ? 'Actualizando...' : 'Desactivar'}
      </Button>

      {errorMessage && <p className="max-w-48 text-right text-xs text-destructive">{errorMessage}</p>}

      <Dialog open={confirmOpen} onOpenChange={(next) => !isPending && setConfirmOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Desactivar usuario?</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{usuario.nombre}</span> perderá acceso al
              sistema desde su próxima solicitud.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDeactivate} disabled={isPending}>
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserRow({ usuario, isSelf, isLastActiveAdmin, onEdit, onResetPassword, onActiveChanged }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{usuario.nombre}</span>
          {isSelf && <Badge variant="outline">Tú</Badge>}
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">{usuario.email}</p>
        {usuario.telefono && <p className="mt-0.5 truncate text-xs text-gray-400">{usuario.telefono}</p>}
      </div>

      <span className="w-28 shrink-0 text-sm text-gray-600">
        {USER_ROLE_LABELS[usuario.rol] ?? usuario.rol}
      </span>

      <Badge variant={usuario.activo ? 'default' : 'secondary'} className="shrink-0">
        {usuario.activo ? 'Activo' : 'Inactivo'}
      </Badge>

      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(usuario)}>
          Editar
        </Button>
        <Button variant="outline" size="sm" onClick={() => onResetPassword(usuario)}>
          Restablecer contraseña
        </Button>
      </div>

      <SetUserActiveAction
        usuario={usuario}
        isSelf={isSelf}
        isLastActiveAdmin={isLastActiveAdmin}
        onChanged={onActiveChanged}
      />
    </div>
  );
}

/**
 * CRUD de usuarios de staff. Mismo esqueleto que CategoriesPage/ProductsPage:
 * React Query (useUsers) es la única fuente de verdad del listado — sin
 * copiarlo a useState, sin optimistic updates. Cada mutación (crear/editar/
 * activar/desactivar/resetear contraseña) solo invalida ['usuarios'] al
 * terminar.
 *
 * No hay DELETE /usuarios en el backend — por eso no existe acción
 * "Eliminar" en ninguna fila, ni un botón deshabilitado simulándola.
 *
 * Búsqueda y filtros (rol, estado) son enteramente locales sobre el array
 * ya cargado: GET /usuarios no tiene paginación ni query params de
 * backend, así que no se dispara ningún request nuevo al escribir o
 * cambiar un filtro — ni siquiera con debounce, alcanza con recalcular en
 * cada render. El orden que devuelve el backend (idUsuario ASC) se
 * conserva tal cual después de filtrar: `.filter()` no reordena.
 */
export default function UsersPage() {
  const { data: usuarios, isLoading, isError, error, refetch } = useUsers();
  const { usuario: authUser } = useAuth();

  const [search, setSearch] = useState('');
  const [rolFilter, setRolFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');

  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Protección de "último admin activo" (ver SetUserActiveAction /
  // UserFormDialog): agregación puramente local sobre el listado ya
  // cargado, sin ningún request adicional. Es protección de UX, no
  // garantía transaccional — si dos sesiones admin modifican datos al
  // mismo tiempo, el backend sigue siendo la autoridad real y esta cuenta
  // local puede quedar desactualizada por un instante; no se intenta
  // resolver esa concurrencia acá.
  const activeAdminCount = useMemo(
    () => (usuarios ?? []).filter((usuario) => usuario.rol === 'admin' && usuario.activo).length,
    [usuarios],
  );

  const filteredUsers = useMemo(() => {
    if (!usuarios) return [];
    const term = search.trim().toLowerCase();

    return usuarios.filter((usuario) => {
      if (rolFilter !== 'todos' && usuario.rol !== rolFilter) return false;
      if (statusFilter === 'activos' && !usuario.activo) return false;
      if (statusFilter === 'inactivos' && usuario.activo) return false;
      if (term && !usuario.nombre.toLowerCase().includes(term) && !usuario.email.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [usuarios, search, rolFilter, statusFilter]);

  const hasFiltersApplied = search.trim() !== '' || rolFilter !== 'todos' || statusFilter !== 'todos';

  const openCreate = () => {
    setFeedback(null);
    setEditingUser(null);
    setCreateOpen(true);
  };

  const openEdit = (usuario) => {
    setFeedback(null);
    setCreateOpen(false);
    setEditingUser(usuario);
  };

  const openResetPassword = (usuario) => {
    setFeedback(null);
    setResettingUser(usuario);
  };

  const handleFormClose = (open) => {
    if (!open) {
      setCreateOpen(false);
      setEditingUser(null);
    }
  };

  const handleSaved = (message) => {
    setCreateOpen(false);
    setEditingUser(null);
    setFeedback(message);
  };

  const handleReset = (message) => {
    setResettingUser(null);
    setFeedback(message);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
        <Button onClick={openCreate}>Nuevo usuario</Button>
      </div>

      {feedback && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <AlertDescription className="text-emerald-700">{feedback}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && usuarios.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <label htmlFor="buscarUsuario" className="text-xs font-medium text-gray-500">
              Buscar por nombre o email
            </label>
            <Input
              id="buscarUsuario"
              placeholder="Ej: Juan o juan@correo.com"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filtroRol" className="text-xs font-medium text-gray-500">
              Rol
            </label>
            <select
              id="filtroRol"
              className={selectClass}
              value={rolFilter}
              onChange={(event) => setRolFilter(event.target.value)}
            >
              {ROLE_FILTER_OPTIONS.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filtroEstado" className="text-xs font-medium text-gray-500">
              Estado
            </label>
            <select
              id="filtroEstado"
              className={selectClass}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_FILTER_OPTIONS.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" className="text-gray-300" />
        </div>
      )}

      {isError && (
        <EmptyState
          icon="⚠️"
          title="No se pudieron cargar los usuarios"
          description={error?.message || 'Hubo un problema al conectar con el servidor.'}
        >
          <Button onClick={() => refetch()}>Reintentar</Button>
        </EmptyState>
      )}

      {!isLoading && !isError && usuarios.length === 0 && (
        <EmptyState
          icon="👤"
          title="No hay usuarios registrados"
          description="Creá el primer usuario para empezar a dar acceso al sistema."
        />
      )}

      {!isLoading && !isError && usuarios.length > 0 && filteredUsers.length === 0 && (
        <EmptyState icon="🔍" title="No hay usuarios que coincidan con los filtros." />
      )}

      {!isLoading && !isError && filteredUsers.length > 0 && (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="hidden items-center gap-4 bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-400 sm:flex">
            <span className="min-w-0 flex-1">Nombre / Email</span>
            <span className="w-28 shrink-0">Rol</span>
            <span className="w-20 shrink-0">Estado</span>
            <span className="shrink-0">Acciones</span>
          </div>

          {filteredUsers.map((usuario) => {
            const isSelf = authUser?.idUsuario === usuario.idUsuario;
            const isLastActiveAdmin = usuario.rol === 'admin' && usuario.activo && activeAdminCount === 1;

            return (
              <UserRow
                key={usuario.idUsuario}
                usuario={usuario}
                isSelf={isSelf}
                isLastActiveAdmin={isLastActiveAdmin}
                onEdit={openEdit}
                onResetPassword={openResetPassword}
                onActiveChanged={setFeedback}
              />
            );
          })}
        </div>
      )}

      {hasFiltersApplied && !isLoading && !isError && usuarios.length > 0 && (
        <p className="text-xs text-gray-400">
          Mostrando {filteredUsers.length} de {usuarios.length} usuarios.
        </p>
      )}

      <UserFormDialog
        key={editingUser ? `edit-${editingUser.idUsuario}` : createOpen ? 'create' : 'closed'}
        open={createOpen || !!editingUser}
        user={editingUser}
        isSelf={!!editingUser && authUser?.idUsuario === editingUser.idUsuario}
        isLastActiveAdmin={
          !!editingUser && editingUser.rol === 'admin' && editingUser.activo && activeAdminCount === 1
        }
        onOpenChange={handleFormClose}
        onSaved={handleSaved}
      />

      <ResetPasswordDialog
        key={resettingUser?.idUsuario ?? 'none'}
        user={resettingUser}
        onOpenChange={(open) => !open && setResettingUser(null)}
        onReset={handleReset}
      />
    </div>
  );
}
