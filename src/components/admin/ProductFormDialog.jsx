import { useState } from 'react';
import { useCreateProduct } from '../../hooks/useCreateProduct';
import { useUpdateProduct } from '../../hooks/useUpdateProduct';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
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

const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;
const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

function parseNombreProducto(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { error: 'El nombre es obligatorio.' };
  return { value: trimmed };
}

/** Requerido, > 0, hasta 2 decimales — mismas reglas que valida el backend. */
function parsePrecio(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { error: 'El precio es obligatorio.' };
  if (!PRICE_PATTERN.test(trimmed)) {
    return { error: 'Ingresá un precio válido, mayor a 0, con hasta 2 decimales.' };
  }
  if (Number(trimmed) <= 0) return { error: 'El precio debe ser mayor a 0.' };
  return { value: Number(trimmed) };
}

/**
 * Formulario de alta/edición de producto, compartido (mismo criterio que
 * CategoryFormDialog en CategoriesPage): la única diferencia real entre
 * crear y editar es qué mutation dispara y si los campos arrancan
 * precargados. El padre lo remonta por `key` en cada apertura para que el
 * estado arranque limpio, sin useEffect de reseteo.
 *
 * `areas` y `categories` llegan ya resueltos por ProductsPage — este
 * componente asume que son catálogos no vacíos, porque el padre solo lo
 * abre cuando ambos están listos (ver `catalogsReady` en ProductsPage).
 *
 * Selects nativos, no el Select de shadcn: mismo criterio ya usado en
 * PaymentForm de Caja — evita el overhead de un Radix Select portalizado
 * para una lista simple de opciones, y es igual de coherente con
 * AdminLayout (tema claro) que el resto de los inputs de este formulario.
 */
export default function ProductFormDialog({ open, product, areas, categories, onOpenChange, onSaved }) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const mutation = product ? updateProduct : createProduct;

  const [nombre, setNombre] = useState(product?.nombreProducto ?? '');
  const [descripcion, setDescripcion] = useState(product?.descripcion ?? '');
  const [precio, setPrecio] = useState(product?.precio != null ? String(product.precio) : '');
  const [idAreaProducto, setIdAreaProducto] = useState(
    String(product?.idAreaProducto ?? areas[0]?.idAreaProducto ?? ''),
  );
  const [idCategoriaProducto, setIdCategoriaProducto] = useState(
    String(product?.idCategoriaProducto ?? categories[0]?.idCategoriaProducto ?? ''),
  );
  const [validationError, setValidationError] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mutation.isPending) return;

    const nombreResult = parseNombreProducto(nombre);
    if (nombreResult.error) {
      setValidationError(nombreResult.error);
      return;
    }

    const precioResult = parsePrecio(precio);
    if (precioResult.error) {
      setValidationError(precioResult.error);
      return;
    }

    if (!idAreaProducto) {
      setValidationError('Elegí un área.');
      return;
    }

    if (!idCategoriaProducto) {
      setValidationError('Elegí una categoría.');
      return;
    }

    setValidationError(null);

    // descripcion es opcional (string | null en el contrato): un campo
    // vacío se envía como null, nunca como espacios en blanco.
    const descripcionTrimmed = descripcion.trim();
    const body = {
      nombreProducto: nombreResult.value,
      descripcion: descripcionTrimmed === '' ? null : descripcionTrimmed,
      precio: precioResult.value,
      idAreaProducto: Number(idAreaProducto),
      idCategoriaProducto: Number(idCategoriaProducto),
    };

    const payload = product ? { idProducto: product.idProducto, ...body } : body;

    mutation.mutate(payload, {
      onSuccess: () =>
        onSaved(product ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.'),
    });
  };

  const errorMessage =
    validationError ??
    (mutation.isError ? mutation.error?.message || 'No se pudo guardar el producto. Intentá de nuevo.' : null);

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          <DialogDescription>
            {product
              ? 'Modificá los datos del producto.'
              : 'Completá los datos para agregar un producto al catálogo.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="nombreProducto" className="text-sm font-medium text-foreground">
              Nombre
            </label>
            <Input
              id="nombreProducto"
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
            <label htmlFor="descripcionProducto" className="text-sm font-medium text-foreground">
              Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Textarea
              id="descripcionProducto"
              value={descripcion}
              disabled={mutation.isPending}
              onChange={(event) => setDescripcion(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="precioProducto" className="text-sm font-medium text-foreground">
              Precio
            </label>
            <Input
              id="precioProducto"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={precio}
              disabled={mutation.isPending}
              onChange={(event) => {
                setPrecio(event.target.value);
                if (validationError) setValidationError(null);
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="areaProducto" className="text-sm font-medium text-foreground">
                Área
              </label>
              <select
                id="areaProducto"
                className={selectClass}
                value={idAreaProducto}
                disabled={mutation.isPending}
                onChange={(event) => {
                  setIdAreaProducto(event.target.value);
                  if (validationError) setValidationError(null);
                }}
              >
                {areas.map((area) => (
                  <option key={area.idAreaProducto} value={area.idAreaProducto}>
                    {area.nombreArea}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="categoriaProducto" className="text-sm font-medium text-foreground">
                Categoría
              </label>
              <select
                id="categoriaProducto"
                className={selectClass}
                value={idCategoriaProducto}
                disabled={mutation.isPending}
                onChange={(event) => {
                  setIdCategoriaProducto(event.target.value);
                  if (validationError) setValidationError(null);
                }}
              >
                {categories.map((categoria) => (
                  <option key={categoria.idCategoriaProducto} value={categoria.idCategoriaProducto}>
                    {categoria.nombreCategoria}
                  </option>
                ))}
              </select>
            </div>
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
                ? product
                  ? 'Guardando...'
                  : 'Creando...'
                : product
                  ? 'Guardar cambios'
                  : 'Crear producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
