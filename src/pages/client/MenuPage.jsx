import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Plus, SlidersHorizontal, UtensilsCrossed } from 'lucide-react';
import { useMenu } from '../../hooks/useMenu';
import useCarrito from '../../store/useCarrito';
import ProductImage from '../../components/client/ProductImage';
import ProductPersonalizationDialog from '../../components/client/ProductPersonalizationDialog';
import EmptyState from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils';

/**
 * Un producto del menú, con dos acciones:
 *   - Agregar        → línea SIN personalización (equivale a personalizar
 *                       con el diálogo vacío: misma `lineKey`, ver
 *                       useCarrito.agregarItem).
 *   - Personalizar    → abre el diálogo reutilizable (ver
 *                       ProductPersonalizationDialog) para elegir
 *                       ingredientes a quitar / agregar una indicación;
 *                       al confirmar, agrega esa variante como línea
 *                       propia (o incrementa su cantidad si ya existía
 *                       exactamente esa variante).
 *
 * `cuentaSolicitada` NO se confía únicamente al banner de ClientLayout:
 * ambos botones quedan realmente deshabilitados acá, por producto, para
 * que sea imposible agregar algo nuevo aunque el usuario ignore el aviso
 * del header.
 *
 * El contador "En el carrito: N" ahora suma TODAS las variantes de este
 * producto (antes había una sola línea posible por producto; con
 * personalización estructurada puede haber varias líneas con el mismo
 * `idProducto` y distinta identidad) — sigue siendo el mismo feedback de
 * "se agregó", sin alert() ni toast nuevo.
 */
function ProductCard({ producto, cuentaSolicitada, onPersonalize }) {
  const agregarItem = useCarrito((state) => state.agregarItem);
  const cantidadEnCarrito = useCarrito((state) =>
    state.items
      .filter((item) => item.idProducto === producto.id)
      .reduce((total, item) => total + item.cantidad, 0),
  );

  const ingredientesTexto =
    producto.ingredientes?.length > 0
      ? producto.ingredientes.map((ingrediente) => ingrediente.nombre).join(' · ')
      : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md sm:p-3.5">
      <ProductImage
        urlImagen={producto.urlImagen}
        nombreProducto={producto.nombre}
        className="aspect-[4/3] w-full"
      />

      <div className="mt-3 flex flex-1 flex-col justify-between gap-3">
        <div>
          <h3 className="line-clamp-2 font-semibold leading-snug text-foreground">{producto.nombre}</h3>
          {producto.descripcion && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{producto.descripcion}</p>
          )}
          {ingredientesTexto && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">{ingredientesTexto}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-bold text-foreground">{formatCurrency(producto.precio)}</span>
            {cantidadEnCarrito > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                En el carrito: {cantidadEnCarrito}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-10"
              disabled={cuentaSolicitada}
              onClick={() => onPersonalize(producto)}
            >
              <SlidersHorizontal /> Personalizar
            </Button>
            <Button className="h-10" disabled={cuentaSolicitada} onClick={() => agregarItem(producto)}>
              <Plus /> Agregar
            </Button>
          </div>

          {cuentaSolicitada && (
            <p className="text-xs text-warning-foreground">La cuenta ya fue solicitada.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-3.5">
      <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 flex flex-1 flex-col gap-3">
        <div className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Una categoría del menú. El backend ya ordena categorías y productos — no
 * se reordena nada acá. Una categoría sin productos (caso real posible,
 * aunque infrecuente) simplemente no renderiza sección, en vez de mostrar
 * un título vacío.
 *
 * `id="categoria-{id}"` + `scroll-mt-*` son el destino de los links de
 * CategoryNav (scroll suave hacia la sección, con margen para no quedar
 * tapada por el header sticky de ClientLayout).
 */
function CategorySection({ categoria, cuentaSolicitada, onPersonalize }) {
  if (!categoria.productos || categoria.productos.length === 0) return null;

  return (
    <section id={`categoria-${categoria.id}`} className="scroll-mt-28 px-4 py-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-foreground/80">{categoria.nombre}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categoria.productos.map((producto) => (
          <ProductCard
            key={producto.id}
            producto={producto}
            cuentaSolicitada={cuentaSolicitada}
            onPersonalize={onPersonalize}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Navegación rápida por categorías: tira horizontal de chips que hace
 * scroll suave hacia la sección correspondiente (ids en CategorySection).
 * No es sticky a propósito: el header de ClientLayout ya es sticky y su
 * alto varía según el estado de "pedir cuenta" — encadenar un segundo
 * sticky con offset exacto sería frágil. Se prioriza robustez.
 */
function CategoryNav({ categorias }) {
  const categoriasConProductos = categorias.filter((categoria) => categoria.productos?.length > 0);
  if (categoriasConProductos.length <= 1) return null;

  return (
    <nav
      aria-label="Categorías del menú"
      className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categoriasConProductos.map((categoria) => (
        <a
          key={categoria.id}
          href={`#categoria-${categoria.id}`}
          onClick={(event) => {
            event.preventDefault();
            document.getElementById(`categoria-${categoria.id}`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }}
          className="shrink-0 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {categoria.nombre}
        </a>
      ))}
    </nav>
  );
}

/**
 * Menú público del cliente. La sesión de mesa ya está garantizada por
 * ClientLayout antes de que esta página monte — acá solo se consume
 * GET /menu, que no depende de la mesa en absoluto.
 *
 * Un fallo de este GET nunca reabre la sesión de mesa: son operaciones
 * independientes (useTableSession vive en el layout, no se toca desde acá).
 *
 * UN solo diálogo de personalización a nivel de página (no uno por
 * ProductCard): `personalizingProduct` guarda el producto crudo del menú
 * (con su `ingredientes` ya incluido, tal cual lo entrega GET /menu) sobre
 * el que se está personalizando — evita montar N diálogos cerrados por
 * cada producto listado.
 */
export default function MenuPage() {
  const { session } = useOutletContext();
  const cuentaSolicitada = session?.estado === 'cuenta_solicitada';

  const { data: categorias, isLoading, isError, error, refetch } = useMenu();
  const agregarItem = useCarrito((state) => state.agregarItem);
  const [personalizingProduct, setPersonalizingProduct] = useState(null);

  const handleConfirmPersonalizacion = (personalizacion) => {
    agregarItem(personalizingProduct, personalizacion);
    setPersonalizingProduct(null);
  };

  if (isLoading) {
    return (
      <div className="px-4 pt-4">
        <div className="mb-4 h-5 w-20 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={<AlertTriangle />}
          title="No se pudo cargar el menú"
          description={error?.message || 'Hubo un problema al conectar con el servidor.'}
        >
          <Button onClick={() => refetch()}>Reintentar</Button>
        </EmptyState>
      </div>
    );
  }

  if (categorias.length === 0) {
    return (
      <div className="px-4 py-8">
        <EmptyState icon={<UtensilsCrossed />} title="No hay productos disponibles en este momento." />
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-4">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-bold text-foreground">Menú</h1>
      </div>

      <CategoryNav categorias={categorias} />

      {categorias.map((categoria) => (
        <CategorySection
          key={categoria.id}
          categoria={categoria}
          cuentaSolicitada={cuentaSolicitada}
          onPersonalize={setPersonalizingProduct}
        />
      ))}

      <ProductPersonalizationDialog
        key={personalizingProduct?.id ?? 'none'}
        open={!!personalizingProduct}
        nombreProducto={personalizingProduct?.nombre}
        ingredientesDisponibles={personalizingProduct?.ingredientes ?? []}
        onOpenChange={(next) => !next && setPersonalizingProduct(null)}
        onConfirm={handleConfirmPersonalizacion}
      />
    </div>
  );
}
