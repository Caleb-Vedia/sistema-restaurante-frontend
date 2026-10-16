import { useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTables } from '../../hooks/useTables';
import { useCreateTable } from '../../hooks/useCreateTable';
import { useUpdateTable } from '../../hooks/useUpdateTable';
import { useDeleteTable } from '../../hooks/useDeleteTable';
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
import { formatDateTime } from '../../utils';

const selectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * Estado real de una mesa: SOLO LECTURA en este CRUD. El backend no acepta
 * `estado` en POST/PATCH /mesas — lo administran otros flujos por completo
 * ajenos a Admin (sesión de mesa vía QR, "Pedir cuenta" del cliente, cobro
 * en Caja). Por eso no hay ningún `<select>` de estado en esta pantalla, ni
 * acciones para forzar una transición.
 */
const TABLE_ESTADO_LABELS = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  cuenta_solicitada: 'Cuenta solicitada',
};

const TABLE_ESTADO_BADGE_VARIANT = {
  libre: 'secondary',
  ocupada: 'default',
  cuenta_solicitada: 'destructive',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'libre', label: 'Libre' },
  { value: 'ocupada', label: 'Ocupada' },
  { value: 'cuenta_solicitada', label: 'Cuenta solicitada' },
];

/**
 * URL pública de acceso de una mesa: exactamente `{origin}/menu/:idMesa`,
 * la misma ruta índice que ya resuelve `ClientLayout` — sin token, sin
 * `idSesion`, sin ningún dato interno. Escanear este QR entra al flujo
 * Cliente existente tal cual: `useTableSession` crea/recupera la sesión
 * al llegar a `/menu/:tableId` (ver ese hook) — este archivo no toca nada
 * de esa lógica, solo construye el link de entrada.
 *
 * `window.location.origin` en vez de una URL hardcodeada: así el mismo QR
 * generado en desarrollo, staging o producción apunta siempre al origen
 * real desde el que se sirve Admin.
 */
const buildTableMenuUrl = (idMesa) => `${window.location.origin}/menu/${idMesa}`;

/** Escapa HTML antes de interpolar texto libre (nombreMesa) en el documento de impresión (ver handlePrint). */
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/**
 * QR de acceso de una mesa. Disponible para CUALQUIER estado (libre,
 * ocupada, cuenta_solicitada): el QR representa la MESA, no una sesión
 * puntual — sigue siendo válido y apunta al mismo lugar sin importar si
 * hay una visita en curso.
 *
 * Imprimir usa el mecanismo nativo del navegador (`window.print()`), pero
 * NO sobre esta página: se abre una ventana nueva con un documento mínimo
 * y autocontenido (nombre + QR + URL), y se imprime esa ventana. Evita
 * agregar CSS de impresión global a `index.css` que tendría que ocuparse
 * de ocultar el sidebar/resto de Admin en cualquier página futura que
 * imprima algo — acá el documento a imprimir ya nace conteniendo
 * ÚNICAMENTE lo que se pidió mostrar.
 *
 * El SVG del QR ya renderizado se serializa con `.outerHTML` (el ref de
 * `QRCodeSVG` apunta directo al `<svg>`) y se inyecta tal cual en el
 * documento nuevo — no hace falta volver a montar React ahí. `nombreMesa`
 * SÍ es texto libre editable por el admin, así que se escapa antes de
 * interpolarlo en el HTML de esa ventana (ver `escapeHtml`) para no abrir
 * una vía de HTML/script injection vía el nombre de una mesa.
 */
function TableQrDialog({ mesa, onOpenChange }) {
  const svgRef = useRef(null);
  const [printError, setPrintError] = useState(null);

  const url = mesa ? buildTableMenuUrl(mesa.idMesa) : '';

  const handlePrint = () => {
    setPrintError(null);
    const svgMarkup = svgRef.current?.outerHTML;
    const printWindow = svgMarkup ? window.open('', '_blank', 'width=420,height=560') : null;

    if (!printWindow) {
      setPrintError(
        'No se pudo abrir la ventana de impresión. Verificá que tu navegador no esté bloqueando ventanas emergentes.',
      );
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>QR — ${escapeHtml(mesa.nombreMesa)}</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 32px 16px; }
            h1 { font-size: 20px; margin: 0 0 20px; }
            .qr { margin: 0 auto 16px; }
            .url { font-size: 12px; color: #555; word-break: break-all; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(mesa.nombreMesa)}</h1>
          <div class="qr">${svgMarkup}</div>
          <p class="url">${escapeHtml(url)}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <Dialog open={!!mesa} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Código QR — {mesa?.nombreMesa}</DialogTitle>
          <DialogDescription>
            Los clientes escanean este código para acceder al menú de esta mesa.
          </DialogDescription>
        </DialogHeader>

        {mesa && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <QRCodeSVG ref={svgRef} value={url} size={200} />
            </div>
            <p className="max-w-full break-all text-center text-xs text-gray-500">{url}</p>
          </div>
        )}

        {printError && (
          <Alert variant="destructive">
            <AlertDescription>{printError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cerrar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handlePrint}>
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Requerido + trim no vacío. El backend SÍ exige nombre único (case-insensitive
 * + trim, entre mesas no eliminadas) y responde 409 si hay conflicto — pero esa
 * regla no se duplica acá: el backend es la única fuente de verdad, este
 * formulario solo valida que el campo no esté vacío y deja que
 * `mutation.error?.message` (ver más abajo) muestre el mensaje real del
 * backend si el nombre ya existe.
 */
function parseNombreMesa(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { error: 'El nombre es obligatorio.' };
  return { value: trimmed };
}

/**
 * Formulario de alta/edición, compartido — mismo criterio que
 * CategoryFormDialog en CategoriesPage: un único campo, y la diferencia
 * real entre crear y editar es qué mutation dispara. El padre (TablesPage)
 * lo remonta por `key` en cada apertura para que el estado arranque limpio.
 *
 * `mesa.estado` no se edita ni se muestra como control — solo se usa para
 * decidir si corresponde la nota informativa de sesión activa (punto 12 de
 * la fase): cambiar el nombre nunca toca la sesión, así que la nota es
 * puramente aclaratoria, sin confirmación alarmista.
 */
function TableFormDialog({ open, mesa, onOpenChange, onSaved }) {
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();
  const mutation = mesa ? updateTable : createTable;

  const [nombreMesa, setNombreMesa] = useState(mesa?.nombreMesa ?? '');
  const [validationError, setValidationError] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mutation.isPending) return;

    const result = parseNombreMesa(nombreMesa);
    if (result.error) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);

    const payload = mesa
      ? { idMesa: mesa.idMesa, nombreMesa: result.value }
      : { nombreMesa: result.value };

    mutation.mutate(payload, {
      onSuccess: () => onSaved(mesa ? 'Mesa actualizada correctamente.' : 'Mesa creada correctamente.'),
    });
  };

  const errorMessage =
    validationError ??
    (mutation.isError ? mutation.error?.message || 'No se pudo guardar la mesa. Intentá de nuevo.' : null);

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mesa ? 'Editar mesa' : 'Nueva mesa'}</DialogTitle>
          <DialogDescription>
            {mesa ? 'Modificá el nombre de la mesa.' : 'Creá una nueva mesa para el restaurante.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="nombreMesa" className="text-sm font-medium text-foreground">
              Nombre de la mesa
            </label>
            <Input
              id="nombreMesa"
              autoFocus
              placeholder="Ej: Mesa 1, Terraza 2, VIP"
              value={nombreMesa}
              disabled={mutation.isPending}
              onChange={(event) => {
                setNombreMesa(event.target.value);
                if (validationError) setValidationError(null);
              }}
            />
          </div>

          {mesa && mesa.estado !== 'libre' && (
            <p className="text-xs text-muted-foreground">
              Esta mesa tiene una sesión activa. Cambiar el nombre no cerrará ni modificará la sesión.
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
                ? mesa
                  ? 'Guardando...'
                  : 'Creando...'
                : mesa
                  ? 'Guardar cambios'
                  : 'Crear mesa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirmación de baja. Explica el efecto real y verificado contra el
 * contrato actual: el borrado hace que `POST /mesas/:id/sesion` empiece a
 * responder 404 de inmediato (el QR deja de funcionar), y NO existe
 * restore — por eso nunca se promete "se podrá restaurar".
 */
function DeleteTableDialog({ mesa, onOpenChange, onDeleted }) {
  const deleteTable = useDeleteTable();

  const handleConfirm = () => {
    if (deleteTable.isPending) return;
    deleteTable.mutate(mesa.idMesa, {
      onSuccess: () => onDeleted('Mesa eliminada correctamente.'),
    });
  };

  return (
    <Dialog open={!!mesa} onOpenChange={(next) => !deleteTable.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar esta mesa?</DialogTitle>
          <DialogDescription>
            Vas a eliminar <span className="font-semibold text-foreground">{mesa?.nombreMesa}</span>. Esta
            acción quitará la mesa del sistema y su código QR dejará de funcionar.
            <br />
            <br />
            Esta acción no puede deshacerse desde el sistema.
          </DialogDescription>
        </DialogHeader>

        {deleteTable.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {deleteTable.error?.message || 'No se pudo eliminar la mesa. Intentá de nuevo.'}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={deleteTable.isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleteTable.isPending}>
            {deleteTable.isPending ? 'Eliminando...' : 'Eliminar mesa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Fila de una mesa. `canDelete` refleja la regla real del backend (solo
 * borra mesas `libre`) — es guía de UX, no una garantía: si hay una
 * carrera y el backend igual rechaza con 409, `DeleteTableDialog` lo
 * muestra tal cual (ver useDeleteTable).
 */
function TableRow({ mesa, onEdit, onDelete, onViewQr }) {
  const canDelete = mesa.estado === 'libre';
  const blockedReason = canDelete ? null : 'No se puede eliminar una mesa con una sesión activa.';

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold text-gray-900">{mesa.nombreMesa}</span>
      </div>

      <Badge variant={TABLE_ESTADO_BADGE_VARIANT[mesa.estado] ?? 'secondary'} className="w-fit shrink-0">
        {TABLE_ESTADO_LABELS[mesa.estado] ?? mesa.estado}
      </Badge>

      <div className="w-44 shrink-0 text-xs text-gray-500">
        {mesa.sesionActiva ? (
          <>
            <p className="font-medium text-gray-600">Sesión activa</p>
            <p>Desde: {formatDateTime(mesa.sesionActiva.abiertaEl)}</p>
          </>
        ) : (
          <p>Sin sesión activa</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onViewQr(mesa)}>
            QR
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(mesa)}>
            Editar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!canDelete}
            title={blockedReason ?? undefined}
            onClick={() => onDelete(mesa)}
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
 * CRUD de mesas. Mismo esqueleto que CategoriesPage/UsersPage: `useTables`
 * (ya usado por Caja) es la ÚNICA fuente de verdad del listado — misma key
 * `['mesas']`, sin duplicar la query. Ninguna mutación hace optimistic
 * update; todas invalidan esa misma key al terminar.
 *
 * Deliberadamente NO expone:
 *   - cerrar sesión / liberar mesa (`PATCH /mesas/:id/cerrar-sesion`): ese
 *     endpoint no verifica que la cuenta esté pagada, y ya tiene su lugar
 *     específico en la recuperación de cobro de Caja (useReleaseTable) —
 *     trasladarlo acá permitiría liberar una mesa con consumo pendiente.
 *   - cambio manual de estado (marcar libre/ocupada, pedir cuenta): esas
 *     transiciones las controlan el flujo QR/Cliente y Caja; el backend
 *     tampoco las acepta vía este PATCH.
 *
 * El QR de acceso (ver TableQrDialog) es puramente frontend: construye
 * `{origin}/menu/:idMesa` con `window.location.origin`, sin token ni
 * `idSesion`, y no modifica en nada el flujo de sesión de Cliente
 * existente — escanearlo entra por la misma puerta de siempre.
 *
 * Búsqueda (nombreMesa) y filtro de estado son enteramente locales sobre
 * el array ya cargado — sin query params nuevos, sin paginación, y
 * conservando el orden ASC que ya trae el backend (`.filter()` no
 * reordena).
 */
export default function TablesPage() {
  const { data: mesas, isLoading, isError, error, refetch } = useTables();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [deletingTable, setDeletingTable] = useState(null);
  const [viewingQrTable, setViewingQrTable] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const filteredTables = useMemo(() => {
    if (!mesas) return [];
    const term = search.trim().toLowerCase();

    return mesas.filter((mesa) => {
      if (statusFilter !== 'todos' && mesa.estado !== statusFilter) return false;
      if (term && !mesa.nombreMesa.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [mesas, search, statusFilter]);

  const hasFiltersApplied = search.trim() !== '' || statusFilter !== 'todos';

  const openCreate = () => {
    setFeedback(null);
    setEditingTable(null);
    setCreateOpen(true);
  };

  const openEdit = (mesa) => {
    setFeedback(null);
    setCreateOpen(false);
    setEditingTable(mesa);
  };

  const openDelete = (mesa) => {
    setFeedback(null);
    setDeletingTable(mesa);
  };

  const openQr = (mesa) => {
    setFeedback(null);
    setViewingQrTable(mesa);
  };

  const handleFormClose = (open) => {
    if (!open) {
      setCreateOpen(false);
      setEditingTable(null);
    }
  };

  const handleSaved = (message) => {
    setCreateOpen(false);
    setEditingTable(null);
    setFeedback(message);
  };

  const handleDeleted = (message) => {
    setDeletingTable(null);
    setFeedback(message);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mesas</h1>
          <p className="text-sm text-gray-500">Gestioná las mesas disponibles del restaurante.</p>
        </div>
        <Button onClick={openCreate}>Nueva mesa</Button>
      </div>

      {feedback && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <AlertDescription className="text-emerald-700">{feedback}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && mesas.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <label htmlFor="buscarMesa" className="text-xs font-medium text-gray-500">
              Buscar
            </label>
            <Input
              id="buscarMesa"
              placeholder="Ej: Mesa 1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filtroEstadoMesa" className="text-xs font-medium text-gray-500">
              Estado
            </label>
            <select
              id="filtroEstadoMesa"
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
          title="No se pudieron cargar las mesas"
          description={error?.message || 'Hubo un problema al conectar con el servidor.'}
        >
          <Button onClick={() => refetch()}>Reintentar</Button>
        </EmptyState>
      )}

      {!isLoading && !isError && mesas.length === 0 && (
        <EmptyState
          icon="🪑"
          title="No hay mesas registradas"
          description="Creá la primera mesa para empezar a operar."
        />
      )}

      {!isLoading && !isError && mesas.length > 0 && filteredTables.length === 0 && (
        <EmptyState icon="🔍" title="No hay mesas que coincidan con los filtros." />
      )}

      {!isLoading && !isError && filteredTables.length > 0 && (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="hidden items-center gap-4 bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-400 sm:flex">
            <span className="min-w-0 flex-1">Nombre</span>
            <span className="w-24 shrink-0">Estado</span>
            <span className="w-44 shrink-0">Sesión</span>
            <span className="shrink-0">Acciones</span>
          </div>

          {filteredTables.map((mesa) => (
            <TableRow key={mesa.idMesa} mesa={mesa} onEdit={openEdit} onDelete={openDelete} onViewQr={openQr} />
          ))}
        </div>
      )}

      {hasFiltersApplied && !isLoading && !isError && mesas.length > 0 && (
        <p className="text-xs text-gray-400">
          Mostrando {filteredTables.length} de {mesas.length} mesas.
        </p>
      )}

      <TableFormDialog
        key={editingTable ? `edit-${editingTable.idMesa}` : createOpen ? 'create' : 'closed'}
        open={createOpen || !!editingTable}
        mesa={editingTable}
        onOpenChange={handleFormClose}
        onSaved={handleSaved}
      />

      <DeleteTableDialog
        key={deletingTable?.idMesa ?? 'none'}
        mesa={deletingTable}
        onOpenChange={(open) => !open && setDeletingTable(null)}
        onDeleted={handleDeleted}
      />

      <TableQrDialog
        key={viewingQrTable?.idMesa ?? 'none'}
        mesa={viewingQrTable}
        onOpenChange={(open) => !open && setViewingQrTable(null)}
      />
    </div>
  );
}
