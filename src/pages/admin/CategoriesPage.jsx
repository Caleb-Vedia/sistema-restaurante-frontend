import { useState } from 'react';
import { useProductCategories } from '../../hooks/useProductCategories';
import { useCreateProductCategory } from '../../hooks/useCreateProductCategory';
import { useUpdateProductCategory } from '../../hooks/useUpdateProductCategory';
import { useDeleteProductCategory } from '../../hooks/useDeleteProductCategory';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
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

/** Requerido + trim no vacío. El DTO no define un largo máximo, así que no se inventa uno. */
function parseNombreCategoria(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { error: 'El nombre es obligatorio.' };
  return { value: trimmed };
}

/**
 * Formulario de alta/edición, compartido: la única diferencia real entre
 * crear y editar es qué mutation dispara y si el campo arranca precargado.
 * Se remonta por `key` desde el padre (categoría distinta, o alta) para que
 * el estado del input y el de la mutation arranquen limpios cada vez —
 * evita depender de un useEffect solo para resetear el formulario.
 */
function CategoryFormDialog({ open, category, onOpenChange, onSaved }) {
  const createCategory = useCreateProductCategory();
  const updateCategory = useUpdateProductCategory();
  const mutation = category ? updateCategory : createCategory;

  const [nombre, setNombre] = useState(category?.nombreCategoria ?? '');
  const [validationError, setValidationError] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mutation.isPending) return;

    const result = parseNombreCategoria(nombre);
    if (result.error) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);

    const payload = category
      ? { idCategoriaProducto: category.idCategoriaProducto, nombreCategoria: result.value }
      : { nombreCategoria: result.value };

    mutation.mutate(payload, {
      onSuccess: () =>
        onSaved(category ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.'),
    });
  };

  const errorMessage =
    validationError ??
    (mutation.isError ? mutation.error?.message || 'No se pudo guardar la categoría. Intentá de nuevo.' : null);

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          <DialogDescription>
            {category
              ? 'Modificá el nombre de la categoría.'
              : 'Creá una nueva categoría para organizar el catálogo de productos.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="nombreCategoria" className="text-sm font-medium text-foreground">
              Nombre de la categoría
            </label>
            <Input
              id="nombreCategoria"
              autoFocus
              value={nombre}
              disabled={mutation.isPending}
              onChange={(event) => {
                setNombre(event.target.value);
                if (validationError) setValidationError(null);
              }}
            />
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
                ? category
                  ? 'Guardando...'
                  : 'Creando...'
                : category
                  ? 'Guardar cambios'
                  : 'Crear categoría'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirmación de baja. El backend no verifica productos asociados ni
 * ofrece restauración — por eso la advertencia es explícita sobre esa
 * limitación, sin afirmar que existan asociaciones reales (no se consulta
 * Productos para averiguarlo).
 */
function DeleteCategoryDialog({ category, onOpenChange, onDeleted }) {
  const deleteCategory = useDeleteProductCategory();

  const handleConfirm = () => {
    if (deleteCategory.isPending) return;
    deleteCategory.mutate(category.idCategoriaProducto, {
      onSuccess: () => onDeleted('Categoría eliminada correctamente.'),
    });
  };

  return (
    <Dialog open={!!category} onOpenChange={(next) => !deleteCategory.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar categoría?</DialogTitle>
          <DialogDescription>
            Vas a eliminar <span className="font-semibold text-foreground">{category?.nombreCategoria}</span>.
            Esta acción dará de baja la categoría del catálogo.
            <br />
            <br />
            El sistema backend no impide eliminar categorías que todavía puedan estar asociadas
            a productos.
          </DialogDescription>
        </DialogHeader>

        {deleteCategory.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {deleteCategory.error?.message || 'No se pudo eliminar la categoría. Intentá de nuevo.'}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={deleteCategory.isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleteCategory.isPending}>
            {deleteCategory.isPending ? 'Eliminando...' : 'Eliminar categoría'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * CRUD de categorías de producto. Primera pantalla del módulo Admin.
 *
 * React Query es la única fuente de verdad del listado — sin Zustand, sin
 * copiarlo a useState, sin optimistic updates. Las tres mutaciones
 * (crear/editar/eliminar) solo invalidan ['categorias-producto'] al
 * terminar; ninguna reescribe la cache a mano.
 */
export default function CategoriesPage() {
  const { data: categorias, isLoading, isError, refetch } = useProductCategories();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const openCreate = () => {
    setFeedback(null);
    setEditingCategory(null);
    setCreateOpen(true);
  };

  const openEdit = (categoria) => {
    setFeedback(null);
    setCreateOpen(false);
    setEditingCategory(categoria);
  };

  const openDelete = (categoria) => {
    setFeedback(null);
    setDeletingCategory(categoria);
  };

  const handleFormClose = (open) => {
    if (!open) {
      setCreateOpen(false);
      setEditingCategory(null);
    }
  };

  const handleSaved = (message) => {
    setCreateOpen(false);
    setEditingCategory(null);
    setFeedback(message);
  };

  const handleDeleted = (message) => {
    setDeletingCategory(null);
    setFeedback(message);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900">Categorías de productos</h1>
        <Button onClick={openCreate}>Nueva categoría</Button>
      </div>

      {feedback && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <AlertDescription className="text-emerald-700">{feedback}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" className="text-gray-300" />
        </div>
      )}

      {isError && (
        <EmptyState
          icon="⚠️"
          title="No se pudieron cargar las categorías"
          description="Hubo un problema al conectar con el servidor."
        >
          <Button onClick={() => refetch()}>Reintentar</Button>
        </EmptyState>
      )}

      {!isLoading && !isError && categorias.length === 0 && (
        <EmptyState
          icon="🏷️"
          title="No hay categorías registradas"
          description="Creá la primera categoría para empezar a organizar el catálogo."
        />
      )}

      {!isLoading && !isError && categorias.length > 0 && (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {categorias.map((categoria) => (
            <div
              key={categoria.idCategoriaProducto}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="text-sm font-medium text-gray-900">{categoria.nombreCategoria}</span>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(categoria)}>
                  Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => openDelete(categoria)}>
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryFormDialog
        key={editingCategory ? `edit-${editingCategory.idCategoriaProducto}` : createOpen ? 'create' : 'closed'}
        open={createOpen || !!editingCategory}
        category={editingCategory}
        onOpenChange={handleFormClose}
        onSaved={handleSaved}
      />

      <DeleteCategoryDialog
        key={deletingCategory?.idCategoriaProducto ?? 'none'}
        category={deletingCategory}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
