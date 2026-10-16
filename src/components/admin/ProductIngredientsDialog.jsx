import { useState } from 'react';
import { useCreateProductIngredient } from '../../hooks/useCreateProductIngredient';
import { useUpdateProductIngredient } from '../../hooks/useUpdateProductIngredient';
import { useDeleteProductIngredient } from '../../hooks/useDeleteProductIngredient';
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

/** Requerido + trim no vacío. El backend no hace trim; se hace acá para no persistir espacios. Sin límite de caracteres inventado. */
function parseNombreIngrediente(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { error: 'El nombre es obligatorio.' };
  return { value: trimmed };
}

/**
 * Fila de un ingrediente vigente: nombre + Editar/Eliminar. Instancia sus
 * propios hooks de edición/baja, así el pending/error quedan aislados a
 * ESTE ingrediente (mismo criterio que el resto del módulo: OrderCard en
 * el KDS, AvailabilityAction en esta misma página de Productos).
 *
 * "Editar" transforma la fila en un input inline en vez de abrir otro
 * diálogo — evita anidar un tercer nivel de Dialog solo para un campo.
 * "Eliminar" sí usa un Dialog de confirmación aparte, porque es
 * irreversible y el backend no ofrece restauración.
 */
function IngredientRow({ idProducto, ingrediente, onFeedback }) {
  const updateIngredient = useUpdateProductIngredient();
  const deleteIngredient = useDeleteProductIngredient();

  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(ingrediente.nombreIngrediente);
  const [validationError, setValidationError] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const startEdit = () => {
    setNombre(ingrediente.nombreIngrediente);
    setValidationError(null);
    setEditing(true);
  };

  const handleSave = (event) => {
    event.preventDefault();
    if (updateIngredient.isPending) return;

    const result = parseNombreIngrediente(nombre);
    if (result.error) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);

    // No se envían idIngrediente/idProducto/borradoEl en el body — solo
    // arman la URL. El único campo editable es nombreIngrediente.
    updateIngredient.mutate(
      { idProducto, idIngrediente: ingrediente.idIngrediente, nombreIngrediente: result.value },
      {
        onSuccess: () => {
          setEditing(false);
          onFeedback('Ingrediente actualizado correctamente.');
        },
      },
    );
  };

  const handleConfirmDelete = () => {
    setConfirmDeleteOpen(false);
    deleteIngredient.mutate(
      { idProducto, idIngrediente: ingrediente.idIngrediente },
      { onSuccess: () => onFeedback('Ingrediente eliminado correctamente.') },
    );
  };

  const editErrorMessage =
    validationError ??
    (updateIngredient.isError
      ? updateIngredient.error?.message || 'No se pudo guardar el ingrediente. Intentá de nuevo.'
      : null);

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5"
      >
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={nombre}
            disabled={updateIngredient.isPending}
            onChange={(event) => {
              setNombre(event.target.value);
              if (validationError) setValidationError(null);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={updateIngredient.isPending}
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={updateIngredient.isPending}>
            {updateIngredient.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
        {editErrorMessage && <p className="text-xs text-destructive">{editErrorMessage}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
      <span className="text-sm text-gray-900">{ingrediente.nombreIngrediente}</span>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={startEdit}>
          Editar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={deleteIngredient.isPending}
          onClick={() => setConfirmDeleteOpen(true)}
        >
          {deleteIngredient.isPending ? 'Eliminando...' : 'Eliminar'}
        </Button>
      </div>

      <Dialog
        open={confirmDeleteOpen}
        onOpenChange={(next) => !deleteIngredient.isPending && setConfirmDeleteOpen(next)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar ingrediente?</DialogTitle>
            <DialogDescription>
              Vas a eliminar &quot;
              <span className="font-semibold text-foreground">{ingrediente.nombreIngrediente}</span>&quot;. El
              ingrediente dejará de mostrarse en la carta del cliente.
            </DialogDescription>
          </DialogHeader>

          {deleteIngredient.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {deleteIngredient.error?.message || 'No se pudo eliminar el ingrediente. Intentá de nuevo.'}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={deleteIngredient.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteIngredient.isPending}>
              Eliminar ingrediente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Formulario de alta, colapsado detrás de "+ Agregar ingrediente" hasta que se necesita. */
function AddIngredientForm({ idProducto, onAdded }) {
  const createIngredient = useCreateProductIngredient();
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [validationError, setValidationError] = useState(null);

  const openForm = () => {
    setNombre('');
    setValidationError(null);
    setOpen(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (createIngredient.isPending) return;

    const result = parseNombreIngrediente(nombre);
    if (result.error) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);

    createIngredient.mutate(
      { idProducto, nombreIngrediente: result.value },
      {
        onSuccess: () => {
          setNombre('');
          setOpen(false);
          onAdded('Ingrediente agregado correctamente.');
        },
      },
    );
  };

  const errorMessage =
    validationError ??
    (createIngredient.isError
      ? createIngredient.error?.message || 'No se pudo agregar el ingrediente. Intentá de nuevo.'
      : null);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={openForm}>
        + Agregar ingrediente
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          placeholder="Nombre del ingrediente"
          value={nombre}
          disabled={createIngredient.isPending}
          onChange={(event) => {
            setNombre(event.target.value);
            if (validationError) setValidationError(null);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={createIngredient.isPending}
          onClick={() => setOpen(false)}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={createIngredient.isPending}>
          {createIngredient.isPending ? 'Agregando...' : 'Agregar'}
        </Button>
      </div>
      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
    </form>
  );
}

/**
 * Panel de ingredientes de un producto.
 *
 * Los datos SIEMPRE vienen de `product.ingredientes`, embebido en
 * GET /productos (la misma query ['productos'] de toda la página) — no
 * dispara ningún request al abrir, y no existe una cache independiente de
 * ingredientes.
 *
 * `product` llega resuelto por el padre (ProductsPage) vía
 * `productos.find(idProducto)` en cada render, no como una copia congelada
 * al abrir el diálogo: si una mutación invalida ['productos'] mientras
 * este panel sigue abierto, la lista visible se actualiza sola.
 *
 * El array se ordena por idIngrediente ASC sobre una COPIA —
 * `[...ingredientes].sort(...)`, nunca `producto.ingredientes.sort(...)`,
 * que mutaría un array que pertenece a la cache de React Query — para
 * quedar estable y consistente con el orden que ya usa el menú público.
 */
export default function ProductIngredientsDialog({ product, onOpenChange, onFeedback }) {
  const ingredientes = product
    ? [...(product.ingredientes ?? [])].sort((a, b) => a.idIngrediente - b.idIngrediente)
    : [];

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ingredientes — {product?.nombreProducto}</DialogTitle>
          <DialogDescription>Estos ingredientes son los que verá el cliente en la carta.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {ingredientes.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">No hay ingredientes registrados.</p>
          )}

          {ingredientes.map((ingrediente) => (
            <IngredientRow
              key={ingrediente.idIngrediente}
              idProducto={product.idProducto}
              ingrediente={ingrediente}
              onFeedback={onFeedback}
            />
          ))}

          {product && <AddIngredientForm idProducto={product.idProducto} onAdded={onFeedback} />}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
