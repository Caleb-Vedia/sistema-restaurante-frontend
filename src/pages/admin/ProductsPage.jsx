import { useMemo, useState } from 'react';
import { useProducts } from '../../hooks/useProducts';
import { useProductAreas } from '../../hooks/useProductAreas';
import { useProductCategories } from '../../hooks/useProductCategories';
import { useDeleteProduct } from '../../hooks/useDeleteProduct';
import { useSetProductAvailability } from '../../hooks/useSetProductAvailability';
import { useDeleteProductImage } from '../../hooks/useDeleteProductImage';
import ProductFormDialog from '../../components/admin/ProductFormDialog';
import ProductImageDialog from '../../components/admin/ProductImageDialog';
import ProductIngredientsDialog from '../../components/admin/ProductIngredientsDialog';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
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
import { resolveAssetUrl } from '../../services/api';
import { formatCurrency } from '../../utils';

/**
 * Decide qué aviso mostrar sobre los catálogos necesarios para crear/editar
 * (área y categoría), en orden de prioridad: un error real primero, después
 * la carga inicial, después un catálogo vacío. `ready` solo es true cuando
 * ambos catálogos cargaron con al menos un elemento — recién ahí Crear/
 * Editar quedan habilitados.
 */
function getCatalogNotice({ areas, areasLoading, areasError, categorias, categoriesLoading, categoriesError }) {
  if (areasError) return { type: 'error', text: 'No se pudieron cargar las áreas.', retryTarget: 'areas' };
  if (categoriesError) {
    return { type: 'error', text: 'No se pudieron cargar las categorías.', retryTarget: 'categorias' };
  }
  if (areasLoading || categoriesLoading) return { type: 'loading' };
  if ((areas?.length ?? 0) === 0) {
    return { type: 'empty', text: 'No hay áreas disponibles para crear productos.' };
  }
  if ((categorias?.length ?? 0) === 0) {
    return {
      type: 'empty',
      text: 'No hay categorías disponibles para crear productos. Podés crearlas desde Categorías.',
    };
  }
  return { type: 'ready' };
}

/**
 * Miniatura de producto con degradación simple si la imagen no carga.
 * Usa resolveAssetUrl: `urlImagen` es una ruta relativa al backend
 * ("/uploads/productos/x.jpg"), no un src válido tal cual en el frontend.
 *
 * El padre monta este componente con `key={producto.urlImagen}` — así,
 * cuando la URL cambia (subida/reemplazo/eliminación de imagen), React
 * remonta la miniatura entera y `broken` arranca en false de nuevo. Sin
 * eso, un thumbnail marcado `broken` para una URL vieja quedaría roto para
 * siempre aunque la URL nueva sea válida.
 */
function ProductThumbnail({ urlImagen, nombreProducto }) {
  const [broken, setBroken] = useState(false);
  const resolvedSrc = resolveAssetUrl(urlImagen);

  if (!resolvedSrc || broken) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-2xl text-gray-300">
        🍽️
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={nombreProducto}
      className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 object-cover"
      onError={() => setBroken(true)}
    />
  );
}

/**
 * Cambio de disponibilidad de un producto. Instancia su propio
 * useSetProductAvailability(): así el pending/error quedan aislados a ESTE
 * producto (mismo criterio que OrderCard en el KDS), sin bloquear el resto
 * de la lista.
 *
 * El endpoint es un SET explícito, no un toggle — acá se calcula el valor
 * deseado (`disponible: true` o `false`) y se manda tal cual.
 *
 * true → false pide confirmación (deja de verse en el menú y de poder
 * pedirse); false → true se aplica directo, sin diálogo, porque activar no
 * tiene el mismo riesgo operativo que desactivar.
 */
function AvailabilityAction({ producto, onChanged }) {
  const setAvailability = useSetProductAvailability();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isPending = setAvailability.isPending;

  const handleActivate = () => {
    if (isPending) return;
    setAvailability.mutate(
      { idProducto: producto.idProducto, disponible: true },
      { onSuccess: () => onChanged('Producto marcado como disponible.') },
    );
  };

  const handleConfirmDeactivate = () => {
    setConfirmOpen(false);
    setAvailability.mutate(
      { idProducto: producto.idProducto, disponible: false },
      { onSuccess: () => onChanged('Producto marcado como no disponible.') },
    );
  };

  const errorMessage = setAvailability.isError
    ? setAvailability.error?.message || 'No se pudo actualizar la disponibilidad. Intentá de nuevo.'
    : null;

  return (
    <div className="flex flex-col items-end gap-1">
      {producto.disponible ? (
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => setConfirmOpen(true)}>
          {isPending ? 'Actualizando...' : 'Desactivar'}
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={isPending} onClick={handleActivate}>
          {isPending ? 'Actualizando...' : 'Activar'}
        </Button>
      )}

      {errorMessage && <p className="max-w-40 text-right text-xs text-destructive">{errorMessage}</p>}

      <Dialog open={confirmOpen} onOpenChange={(next) => !isPending && setConfirmOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Marcar producto como no disponible?</DialogTitle>
            <DialogDescription>
              El producto dejará de aparecer en el menú y no podrá incluirse en nuevos
              pedidos. Los pedidos ya existentes no se modificarán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDeactivate} disabled={isPending}>
              Marcar no disponible
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductRow({
  producto,
  areaName,
  categoryName,
  onEdit,
  onDelete,
  onImage,
  onDeleteImage,
  onIngredients,
  onAvailabilityChanged,
  editDisabled,
}) {
  return (
    <div className="flex flex-wrap items-start gap-4 px-4 py-3">
      <div className="flex flex-col items-center gap-1.5">
        <ProductThumbnail
          key={producto.urlImagen ?? 'none'}
          urlImagen={producto.urlImagen}
          nombreProducto={producto.nombreProducto}
        />
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => onImage(producto)}
            className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            {producto.urlImagen ? 'Cambiar' : 'Subir imagen'}
          </button>
          {producto.urlImagen && (
            <>
              <span className="text-gray-300">·</span>
              <button
                type="button"
                onClick={() => onDeleteImage(producto)}
                className="font-medium text-red-600 hover:text-red-700 hover:underline"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{producto.nombreProducto}</span>
          <Badge variant={producto.disponible ? 'default' : 'secondary'}>
            {producto.disponible ? 'Disponible' : 'No disponible'}
          </Badge>
        </div>
        {producto.descripcion && (
          <p className="mt-0.5 truncate text-xs text-gray-500">{producto.descripcion}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          {categoryName} · {areaName}
        </p>
      </div>

      <p className="shrink-0 pt-1 text-sm font-bold text-gray-900">{formatCurrency(producto.precio)}</p>

      <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" disabled={editDisabled} onClick={() => onEdit(producto)}>
            Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => onIngredients(producto)}>
            Ingredientes ({producto.ingredientes.length})
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(producto)}>
            Eliminar
          </Button>
        </div>
        <AvailabilityAction producto={producto} onChanged={onAvailabilityChanged} />
      </div>
    </div>
  );
}

/**
 * Confirmación de baja. El backend no impide eliminar un producto con
 * pedidos históricos ni ofrece restauración — no se afirma nada sobre
 * historial o pedidos, solo se advierte el efecto real (deja de estar en
 * el catálogo). Mismo patrón que DeleteCategoryDialog en CategoriesPage.
 */
function DeleteProductDialog({ product, onOpenChange, onDeleted }) {
  const deleteProduct = useDeleteProduct();

  const handleConfirm = () => {
    if (deleteProduct.isPending) return;
    deleteProduct.mutate(product.idProducto, {
      onSuccess: () => onDeleted('Producto eliminado correctamente.'),
    });
  };

  return (
    <Dialog open={!!product} onOpenChange={(next) => !deleteProduct.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar producto?</DialogTitle>
          <DialogDescription>
            Vas a eliminar <span className="font-semibold text-foreground">{product?.nombreProducto}</span>.
            El producto dejará de estar disponible en el catálogo.
          </DialogDescription>
        </DialogHeader>

        {deleteProduct.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {deleteProduct.error?.message || 'No se pudo eliminar el producto. Intentá de nuevo.'}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={deleteProduct.isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleteProduct.isPending}>
            {deleteProduct.isPending ? 'Eliminando...' : 'Eliminar producto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirmación de baja de la imagen. El producto sigue existiendo — solo
 * se advierte el efecto real (queda sin imagen), nada más.
 */
function DeleteProductImageDialog({ product, onOpenChange, onDeleted }) {
  const deleteImage = useDeleteProductImage();

  const handleConfirm = () => {
    if (deleteImage.isPending) return;
    deleteImage.mutate(product.idProducto, {
      onSuccess: () => onDeleted('Imagen eliminada correctamente.'),
    });
  };

  return (
    <Dialog open={!!product} onOpenChange={(next) => !deleteImage.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar imagen?</DialogTitle>
          <DialogDescription>
            La imagen actual de <span className="font-semibold text-foreground">{product?.nombreProducto}</span>{' '}
            será eliminada. El producto continuará existiendo.
          </DialogDescription>
        </DialogHeader>

        {deleteImage.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {deleteImage.error?.message || 'No se pudo eliminar la imagen. Intentá de nuevo.'}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={deleteImage.isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleteImage.isPending}>
            {deleteImage.isPending ? 'Eliminando...' : 'Eliminar imagen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * CRUD de productos. Reutiliza useProductCategories() (ya creado para
 * CategoriesPage) en vez de duplicar esa query, y agrega useProductAreas()
 * como catálogo de solo lectura. GET /productos no expande área ni
 * categoría — el join visual se arma acá con dos Maps id→nombre.
 *
 * React Query es la única fuente de verdad de los tres listados; ninguna
 * mutación reescribe cache a mano ni hace optimistic update.
 */
export default function ProductsPage() {
  const { data: productos, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } =
    useProducts();
  const { data: areas, isLoading: areasLoading, isError: areasError, refetch: refetchAreas } = useProductAreas();
  const {
    data: categorias,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useProductCategories();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [imagingProduct, setImagingProduct] = useState(null);
  const [deletingImageProduct, setDeletingImageProduct] = useState(null);
  // Se guarda el id, no el objeto producto: así, si una mutación de
  // ingredientes invalida ['productos'] mientras el panel sigue abierto,
  // `ingredientsProduct` (abajo) se resuelve de nuevo contra el producto ya
  // actualizado en cada render, en vez de mostrar una copia congelada del
  // momento en que se abrió.
  const [ingredientsProductId, setIngredientsProductId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Id → nombre, para mostrar el área/categoría de cada producto sin tocar
  // los objetos originales de las queries. Si un producto referencia un id
  // que ya no está en el catálogo activo (soft-delete posterior), el Map
  // simplemente no lo tiene y se usa el fallback — no rompe la página.
  const areaNameById = useMemo(() => {
    const map = new Map();
    (areas ?? []).forEach((area) => map.set(area.idAreaProducto, area.nombreArea));
    return map;
  }, [areas]);

  const categoryNameById = useMemo(() => {
    const map = new Map();
    (categorias ?? []).forEach((categoria) => map.set(categoria.idCategoriaProducto, categoria.nombreCategoria));
    return map;
  }, [categorias]);

  const catalogNotice = getCatalogNotice({
    areas,
    areasLoading,
    areasError,
    categorias,
    categoriesLoading,
    categoriesError,
  });
  const catalogsReady = catalogNotice.type === 'ready';

  const ingredientsProduct = productos?.find((p) => p.idProducto === ingredientsProductId) ?? null;

  const openCreate = () => {
    setFeedback(null);
    setEditingProduct(null);
    setCreateOpen(true);
  };

  const openEdit = (producto) => {
    setFeedback(null);
    setCreateOpen(false);
    setEditingProduct(producto);
  };

  const openDelete = (producto) => {
    setFeedback(null);
    setDeletingProduct(producto);
  };

  const openImage = (producto) => {
    setFeedback(null);
    setImagingProduct(producto);
  };

  const openDeleteImage = (producto) => {
    setFeedback(null);
    setDeletingImageProduct(producto);
  };

  const openIngredients = (producto) => {
    setFeedback(null);
    setIngredientsProductId(producto.idProducto);
  };

  const handleImageUploaded = (message) => {
    setImagingProduct(null);
    setFeedback(message);
  };

  const handleImageDeleted = (message) => {
    setDeletingImageProduct(null);
    setFeedback(message);
  };

  const handleFormClose = (open) => {
    if (!open) {
      setCreateOpen(false);
      setEditingProduct(null);
    }
  };

  const handleSaved = (message) => {
    setCreateOpen(false);
    setEditingProduct(null);
    setFeedback(message);
  };

  const handleDeleted = (message) => {
    setDeletingProduct(null);
    setFeedback(message);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900">Productos</h1>
        <Button onClick={openCreate} disabled={!catalogsReady}>
          Nuevo producto
        </Button>
      </div>

      {feedback && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <AlertDescription className="text-emerald-700">{feedback}</AlertDescription>
        </Alert>
      )}

      {catalogNotice.type === 'error' && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{catalogNotice.text}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (catalogNotice.retryTarget === 'areas' ? refetchAreas() : refetchCategories())}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {catalogNotice.type === 'empty' && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="text-amber-800">{catalogNotice.text}</AlertDescription>
        </Alert>
      )}

      {productsLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" className="text-gray-300" />
        </div>
      )}

      {productsError && (
        <EmptyState
          icon="⚠️"
          title="No se pudieron cargar los productos"
          description="Hubo un problema al conectar con el servidor."
        >
          <Button onClick={() => refetchProducts()}>Reintentar</Button>
        </EmptyState>
      )}

      {!productsLoading && !productsError && productos.length === 0 && (
        <EmptyState
          icon="🍽️"
          title="No hay productos registrados"
          description="Creá el primer producto para empezar a armar el catálogo."
        />
      )}

      {!productsLoading && !productsError && productos.length > 0 && (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {productos.map((producto) => (
            <ProductRow
              key={producto.idProducto}
              producto={producto}
              areaName={areaNameById.get(producto.idAreaProducto) ?? 'Área no disponible'}
              categoryName={categoryNameById.get(producto.idCategoriaProducto) ?? 'Categoría no disponible'}
              onEdit={openEdit}
              onDelete={openDelete}
              onImage={openImage}
              onDeleteImage={openDeleteImage}
              onIngredients={openIngredients}
              onAvailabilityChanged={setFeedback}
              editDisabled={!catalogsReady}
            />
          ))}
        </div>
      )}

      {catalogsReady && (
        <ProductFormDialog
          key={editingProduct ? `edit-${editingProduct.idProducto}` : createOpen ? 'create' : 'closed'}
          open={createOpen || !!editingProduct}
          product={editingProduct}
          areas={areas}
          categories={categorias}
          onOpenChange={handleFormClose}
          onSaved={handleSaved}
        />
      )}

      <DeleteProductDialog
        key={deletingProduct?.idProducto ?? 'none'}
        product={deletingProduct}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
        onDeleted={handleDeleted}
      />

      <ProductImageDialog
        key={imagingProduct?.idProducto ?? 'none'}
        product={imagingProduct}
        onOpenChange={(open) => !open && setImagingProduct(null)}
        onUploaded={handleImageUploaded}
      />

      <DeleteProductImageDialog
        key={deletingImageProduct?.idProducto ?? 'none'}
        product={deletingImageProduct}
        onOpenChange={(open) => !open && setDeletingImageProduct(null)}
        onDeleted={handleImageDeleted}
      />

      <ProductIngredientsDialog
        key={ingredientsProductId ?? 'none'}
        product={ingredientsProduct}
        onOpenChange={(open) => !open && setIngredientsProductId(null)}
        onFeedback={setFeedback}
      />
    </div>
  );
}
