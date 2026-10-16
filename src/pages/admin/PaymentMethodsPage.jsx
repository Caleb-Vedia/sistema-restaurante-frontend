import { useMemo, useState } from 'react';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { useCreatePaymentMethod } from '../../hooks/useCreatePaymentMethod';
import { useUpdatePaymentMethod } from '../../hooks/useUpdatePaymentMethod';
import { useDeletePaymentMethod } from '../../hooks/useDeletePaymentMethod';
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

/**
 * Único código protegido HOY. La protección se identifica EXCLUSIVAMENTE
 * por `codigo`, nunca por `nombreMetodo` — el nombre visible sí puede
 * cambiarse (ver PaymentMethodFormDialog), así que compararlo sería
 * detectar la protección por algo que no es estable. `codigo` es interno
 * y no editable vía API: no hay riesgo de que dejar de coincidir por una
 * edición de nombre.
 */
const CODIGO_EFECTIVO = 'efectivo';

/**
 * Requerido + trim no vacío. El backend SÍ exige nombre único (case-insensitive
 * + trim, entre métodos no eliminados) y responde 409 si hay conflicto — pero
 * esa regla no se duplica acá: el backend es la única fuente de verdad, este
 * formulario solo valida que el campo no esté vacío y deja que
 * `mutation.error?.message` (ver más abajo) muestre el mensaje real del
 * backend si el nombre ya existe.
 */
function parseNombreMetodo(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { error: 'El nombre es obligatorio.' };
  return { value: trimmed };
}

/**
 * Formulario de alta/edición, compartido — mismo criterio que
 * CategoryFormDialog/TableFormDialog: un único campo, y la diferencia real
 * entre crear y editar es qué mutation dispara. El padre
 * (PaymentMethodsPage) lo remonta por `key` en cada apertura para que el
 * estado arranque limpio.
 *
 * Edición del método `efectivo`: SÍ se permite cambiar el nombre — Caja lo
 * identifica por `metodo.codigo`, nunca por el nombre visible, así que no
 * hay razón real para bloquearlo. Se muestra una nota informativa (no
 * alarmista) explicando el rol del método y que el código interno no
 * cambia. `codigo` en sí nunca aparece como campo editable ni como valor
 * técnico crudo — la única señal visible es la etiqueta "Método del
 * sistema".
 *
 * Nota de histórico: el backend no guarda un snapshot de `nombreMetodo` en
 * cada Pago — resuelve el nombre por relación al método actual. Renombrar
 * CUALQUIER método (no solo efectivo) cambia también cómo se ven los pagos
 * históricos ya registrados con ese método — se explica siempre en Editar,
 * sin bloquear el envío por eso.
 */
function PaymentMethodFormDialog({ open, metodo, onOpenChange, onSaved }) {
  const createPaymentMethod = useCreatePaymentMethod();
  const updatePaymentMethod = useUpdatePaymentMethod();
  const mutation = metodo ? updatePaymentMethod : createPaymentMethod;

  const [nombreMetodo, setNombreMetodo] = useState(metodo?.nombreMetodo ?? '');
  const [validationError, setValidationError] = useState(null);

  const esEfectivo = metodo?.codigo === CODIGO_EFECTIVO;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mutation.isPending) return;

    const result = parseNombreMetodo(nombreMetodo);
    if (result.error) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);

    const payload = metodo
      ? { idMetodoPago: metodo.idMetodoPago, nombreMetodo: result.value }
      : { nombreMetodo: result.value };

    mutation.mutate(payload, {
      onSuccess: () =>
        onSaved(metodo ? 'Método de pago actualizado correctamente.' : 'Método de pago creado correctamente.'),
    });
  };

  const errorMessage =
    validationError ??
    (mutation.isError ? mutation.error?.message || 'No se pudo guardar el método de pago. Intentá de nuevo.' : null);

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{metodo ? 'Editar método de pago' : 'Nuevo método de pago'}</DialogTitle>
          <DialogDescription>
            {metodo
              ? 'Modificá el nombre del método de pago.'
              : 'Creá un nuevo método de pago disponible para Caja.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="nombreMetodo" className="text-sm font-medium text-foreground">
              Nombre del método
            </label>
            <Input
              id="nombreMetodo"
              autoFocus
              placeholder="Ej: Efectivo, Tarjeta, QR"
              value={nombreMetodo}
              disabled={mutation.isPending}
              onChange={(event) => {
                setNombreMetodo(event.target.value);
                if (validationError) setValidationError(null);
              }}
            />
          </div>

          {esEfectivo && (
            <p className="text-xs text-muted-foreground">
              Este es el método interno que usa Caja para operaciones en efectivo. Cambiar el nombre también
              cambia cómo se muestra en Caja y en históricos, pero Caja lo sigue identificando por su código
              interno — que no cambia.
            </p>
          )}

          {metodo && (
            <p className="text-xs text-muted-foreground">
              Cambiar el nombre también cambiará cómo se muestra este método en pagos e informes históricos,
              ya que el sistema utiliza el nombre actual.
            </p>
          )}

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
                ? metodo
                  ? 'Guardando...'
                  : 'Creando...'
                : metodo
                  ? 'Guardar cambios'
                  : 'Crear método'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirmación de baja. Explica el efecto real: deja de poder elegirse
 * para cobros nuevos, los pagos históricos que ya lo usaron se conservan
 * intactos, y no existe restore desde el sistema — nunca se promete lo
 * contrario.
 */
function DeletePaymentMethodDialog({ metodo, onOpenChange, onDeleted }) {
  const deletePaymentMethod = useDeletePaymentMethod();

  const handleConfirm = () => {
    if (deletePaymentMethod.isPending) return;
    deletePaymentMethod.mutate(metodo.idMetodoPago, {
      onSuccess: () => onDeleted('Método de pago eliminado correctamente.'),
    });
  };

  return (
    <Dialog open={!!metodo} onOpenChange={(next) => !deletePaymentMethod.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar este método de pago?</DialogTitle>
          <DialogDescription>
            Vas a eliminar <span className="font-semibold text-foreground">{metodo?.nombreMetodo}</span>.
            Dejará de estar disponible para nuevos cobros en Caja. Los pagos históricos que ya lo usaron se
            conservan sin cambios.
            <br />
            <br />
            Esta acción no puede deshacerse desde el sistema.
          </DialogDescription>
        </DialogHeader>

        {deletePaymentMethod.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {deletePaymentMethod.error?.message || 'No se pudo eliminar el método de pago. Intentá de nuevo.'}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={deletePaymentMethod.isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={deletePaymentMethod.isPending}>
            {deletePaymentMethod.isPending ? 'Eliminando...' : 'Eliminar método'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Fila de un método de pago. `codigo` nunca se muestra crudo — solo se usa
 * para decidir si corresponde la etiqueta "Método del sistema" y bloquear
 * Eliminar. Un `codigo === null` (método normal) no muestra ninguna
 * etiqueta especial ni el texto "null".
 */
function PaymentMethodRow({ metodo, onEdit, onDelete }) {
  const esEfectivo = metodo.codigo === CODIGO_EFECTIVO;
  const blockedReason = esEfectivo ? 'Caja depende de este método para operaciones en efectivo.' : null;

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{metodo.nombreMetodo}</span>
          {esEfectivo && <Badge variant="outline">Método del sistema</Badge>}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(metodo)}>
            Editar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={esEfectivo}
            title={blockedReason ?? undefined}
            onClick={() => onDelete(metodo)}
          >
            Eliminar
          </Button>
        </div>
        {blockedReason && <p className="max-w-48 text-right text-xs text-gray-400">{blockedReason}</p>}
      </div>
    </div>
  );
}

/**
 * CRUD de métodos de pago. Mismo esqueleto que CategoriesPage/UsersPage/
 * TablesPage: `usePaymentMethods()` (ya usado por Caja — CashierPage,
 * PaymentForm, el arqueo del cierre) es la ÚNICA fuente de verdad del
 * listado, misma key `PAYMENT_METHODS_KEY` (`['metodos-pago']`), sin
 * duplicar la query. Ninguna mutación hace optimistic update; todas
 * invalidan esa misma key al terminar.
 *
 * No existe concepto de activo/inactivo en este recurso — no se agrega
 * uno del lado frontend. Tampoco hay filtro de estado en la barra de
 * filtros por esa misma razón (solo búsqueda por nombre).
 *
 * Búsqueda por `nombreMetodo` es enteramente local sobre el array ya
 * cargado — sin query params nuevos (el backend no los soporta), sin
 * paginación, y conservando el orden ASC que ya trae el backend
 * (`.filter()` no reordena).
 */
export default function PaymentMethodsPage() {
  const { data: metodos, isLoading, isError, error, refetch } = usePaymentMethods();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [deletingMethod, setDeletingMethod] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const filteredMethods = useMemo(() => {
    if (!metodos) return [];
    const term = search.trim().toLowerCase();
    if (!term) return metodos;
    return metodos.filter((metodo) => metodo.nombreMetodo.toLowerCase().includes(term));
  }, [metodos, search]);

  const hasFiltersApplied = search.trim() !== '';

  const openCreate = () => {
    setFeedback(null);
    setEditingMethod(null);
    setCreateOpen(true);
  };

  const openEdit = (metodo) => {
    setFeedback(null);
    setCreateOpen(false);
    setEditingMethod(metodo);
  };

  const openDelete = (metodo) => {
    setFeedback(null);
    setDeletingMethod(metodo);
  };

  const handleFormClose = (open) => {
    if (!open) {
      setCreateOpen(false);
      setEditingMethod(null);
    }
  };

  const handleSaved = (message) => {
    setCreateOpen(false);
    setEditingMethod(null);
    setFeedback(message);
  };

  const handleDeleted = (message) => {
    setDeletingMethod(null);
    setFeedback(message);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Métodos de pago</h1>
          <p className="text-sm text-gray-500">Gestioná los métodos de pago disponibles para Caja.</p>
        </div>
        <Button onClick={openCreate}>Nuevo método</Button>
      </div>

      {feedback && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <AlertDescription className="text-emerald-700">{feedback}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && metodos.length > 0 && (
        <div className="min-w-48 max-w-sm space-y-1.5">
          <label htmlFor="buscarMetodo" className="text-xs font-medium text-gray-500">
            Buscar
          </label>
          <Input
            id="buscarMetodo"
            placeholder="Ej: Efectivo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
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
          title="No se pudieron cargar los métodos de pago"
          description={error?.message || 'Hubo un problema al conectar con el servidor.'}
        >
          <Button onClick={() => refetch()}>Reintentar</Button>
        </EmptyState>
      )}

      {!isLoading && !isError && metodos.length === 0 && (
        <EmptyState
          icon="💳"
          title="No hay métodos de pago registrados"
          description="Creá el primer método para que Caja pueda empezar a cobrar."
        />
      )}

      {!isLoading && !isError && metodos.length > 0 && filteredMethods.length === 0 && (
        <EmptyState icon="🔍" title="No hay métodos de pago que coincidan con la búsqueda." />
      )}

      {!isLoading && !isError && filteredMethods.length > 0 && (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {filteredMethods.map((metodo) => (
            <PaymentMethodRow key={metodo.idMetodoPago} metodo={metodo} onEdit={openEdit} onDelete={openDelete} />
          ))}
        </div>
      )}

      {hasFiltersApplied && !isLoading && !isError && metodos.length > 0 && (
        <p className="text-xs text-gray-400">
          Mostrando {filteredMethods.length} de {metodos.length} métodos.
        </p>
      )}

      <PaymentMethodFormDialog
        key={editingMethod ? `edit-${editingMethod.idMetodoPago}` : createOpen ? 'create' : 'closed'}
        open={createOpen || !!editingMethod}
        metodo={editingMethod}
        onOpenChange={handleFormClose}
        onSaved={handleSaved}
      />

      <DeletePaymentMethodDialog
        key={deletingMethod?.idMetodoPago ?? 'none'}
        metodo={deletingMethod}
        onOpenChange={(open) => !open && setDeletingMethod(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
