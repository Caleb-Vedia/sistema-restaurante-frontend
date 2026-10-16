import { useEffect } from 'react';
import { Link, Outlet, useMatch, useParams } from 'react-router-dom';
import { ClipboardList, Lock, SearchX, ShoppingCart, Utensils, XCircle } from 'lucide-react';
import { useTableSession } from '../../hooks/useTableSession';
import { readTableSession } from '../../utils/clientTableSessionStorage';
import useCarrito, { getCantidadTotalCarrito } from '../../store/useCarrito';
import RequestBillAction from '../client/RequestBillAction';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import ConnectionErrorState from '../ui/ConnectionErrorState';
import { Button } from '../ui/Button';

const RESTAURANT_NAME = import.meta.env.VITE_RESTAURANT_NAME || 'Mi Restaurante';

/**
 * Layout del módulo cliente.
 *
 * Envuelve las cuatro rutas del flujo:
 *   /menu/:tableId            (índice)
 *   /menu/:tableId/cart
 *   /menu/:tableId/orders
 *   /menu/:tableId/order/:orderId
 *
 * SOLO la ruta índice abre/recupera sesión
 * -----------------------------------------
 * `POST /mesas/:id/sesion` tiene efecto de lado real: si la mesa está
 * libre, la ocupa y genera un token nuevo. Es seguro que sea la puerta de
 * entrada (donde aterriza el QR) quien lo dispare — pero NO cualquier ruta
 * hija con solo montarse. Antes de este fix, como `useTableSession` corría
 * sin condición acá arriba, un hard refresh (o una entrada directa pegando
 * la URL) sobre /cart o /order/:orderId disparaba el mismo POST que el
 * índice: si la mesa ya había sido liberada por Caja mientras tanto, eso
 * equivalía a abrirle una sesión nueva a una mesa libre sin que el cliente
 * lo pidiera.
 *
 * `isMenuIndex` (vía `useMatch`) distingue exactamente la ruta índice de
 * las hijas, y se pasa como segundo argumento a `useTableSession`: la
 * query de sesión solo queda habilitada ahí. En las hijas, el hook nunca
 * fetchea — ni al montar, ni por foco de ventana, ni por reconexión.
 *
 * De dónde sale la sesión en cada ruta
 * -------------------------------------
 * - Índice: siempre la respuesta del backend (`fetchedSession`), como
 *   antes — loading/error/404/reintentar sin degradar.
 * - Hijas: primero lo que ya haya en la cache de React Query para
 *   ['mesa-sesion', tableId] (navegación normal Menú → Cart dentro del
 *   mismo mount: `ClientLayout` no se desmonta, así que la cache sigue
 *   ahí — deshabilitar la query no la borra). Si no hay nada ahí (hard
 *   refresh / entrada directa en una hija: mount nuevo, cache vacía), se
 *   lee el snapshot de sessionStorage (`readTableSession`).
 * - Si ninguna de las dos existe, la ruta hija NO tiene sesión que usar:
 *   se muestra un estado explícito ("Sesión no disponible") con un link a
 *   /menu/:tableId — nunca un POST automático, nunca un redirect
 *   automático (eso terminaría ejecutando el POST sin una decisión
 *   explícita del usuario).
 *
 * El snapshot de sessionStorage puede estar VENCIDO (Caja pudo haber
 * cerrado esa sesión después de guardarse) — es aceptable: nunca se usa
 * para decidir si hace falta abrir sesión, solo para no dejar a la ruta
 * hija sin nada que mostrar. Si algo que dependa de ese token (como
 * POST /pedidos) responde 401 más adelante, el checkout ya lo maneja sin
 * reabrir sesión ni reintentar — ver useCheckout/useCreateOrder.
 *
 * Volver al índice sí puede reabrir/recuperar sesión
 * -----------------------------------------------------
 * Si desde una ruta hija el usuario navega explícitamente de vuelta a
 * /menu/:tableId (ej. "Seguir viendo el menú" en el carrito), `isMenuIndex`
 * vuelve a `true` y la query de sesión vuelve a habilitarse — React Query
 * refetchea en ese momento (alternar `enabled` de `false` a `true` con
 * `staleTime` en 0, sin tocar, dispara un fetch nuevo). Es intencional:
 * esa navegación es la misma "entrada al flujo" que un mount, así que el
 * POST corresponde volver a correrlo.
 *
 * Mobile-first: centrado y con ancho máximo para que se vea bien en celular.
 */
export default function ClientLayout() {
  const { tableId } = useParams();
  const isMenuIndex = !!useMatch('/menu/:tableId');

  const {
    session: fetchedSession,
    isValidTableId,
    isLoading,
    isError,
    error,
    refetch,
  } = useTableSession(tableId, isMenuIndex);

  // Solo se lee en las rutas hijas: en el índice la fuente de verdad es
  // siempre `fetchedSession`, nunca este snapshot local.
  const storedSession = isMenuIndex ? null : readTableSession(tableId);

  const session = isMenuIndex ? fetchedSession : (fetchedSession ?? storedSession);

  const sincronizarSesion = useCarrito((state) => state.sincronizarSesion);
  const cantidadCarrito = useCarrito((state) => getCantidadTotalCarrito(state.items));

  // Aísla el carrito por SESIÓN (tableId + token), no solo por mesa: si la
  // mesa cambia, o si la misma mesa tiene un token nuevo (la sesión
  // anterior se cerró y se abrió una visita distinta), sincronizarSesion
  // vacía el carrito antes de adoptar la sesión nueva. Se espera a que
  // haya una sesión real resuelta (`session?.token` truthy, venga del
  // backend o de sessionStorage) — nunca se sincroniza con un token
  // undefined/null/vacío mientras no hay ninguna sesión disponible, para
  // no fijar una identidad incompleta.
  useEffect(() => {
    if (session?.token) {
      sincronizarSesion(tableId, session.token);
    }
  }, [tableId, session?.token, sincronizarSesion]);

  if (!isValidTableId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <EmptyState
          icon={<XCircle />}
          title="Mesa inválida"
          description="El enlace QR no es válido. Pedile a un mozo que te ayude a escanear el código de tu mesa."
        />
      </div>
    );
  }

  if (isMenuIndex) {
    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Spinner size="lg" className="text-primary" />
        </div>
      );
    }

    if (isError) {
      if (error?.status === 404) {
        return (
          <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <EmptyState
              icon={<SearchX />}
              title="Mesa no encontrada"
              description="El código QR no corresponde a una mesa disponible del restaurante."
            />
          </div>
        );
      }

      return <ConnectionErrorState onRetry={refetch} />;
    }
  } else if (!session) {
    // Ruta hija sin sesión que usar (ni cache de React Query, ni
    // sessionStorage): no hay nada seguro que mostrar y, sobre todo, NO
    // corresponde abrir una sesión nueva solo porque el cliente aterrizó
    // acá directo. La única salida es una acción explícita del usuario
    // hacia la puerta de entrada real del flujo.
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <EmptyState
          icon={<Lock />}
          title="Sesión no disponible"
          description="Para iniciar una nueva visita, volvé al menú de la mesa."
        >
          <Button asChild className="h-10">
            <Link to={`/menu/${tableId}`}>Ir al menú</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col md:max-w-xl lg:max-w-3xl">

        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Utensils className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold leading-tight text-foreground sm:text-base">
                  {RESTAURANT_NAME}
                </h1>
                <span className="text-xs font-medium text-muted-foreground">{session.nombreMesa}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                to={`/menu/${tableId}/orders`}
                className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Mis pedidos</span>
              </Link>
              <Link
                to={`/menu/${tableId}/cart`}
                className="relative flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Carrito</span>
                {cantidadCarrito > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-foreground px-1 text-[10px] font-bold text-primary sm:hidden">
                    {cantidadCarrito}
                  </span>
                )}
                {cantidadCarrito > 0 && <span className="hidden sm:inline">({cantidadCarrito})</span>}
              </Link>
            </div>
          </div>

          <RequestBillAction tableId={tableId} session={session} />
        </header>

        {/*
          Sin padding-bottom propio a propósito: cada página hija ya define
          el suyo (MenuPage/MyOrdersPage/OrderStatusPage). Tenerlo acá
          duplicaba ese espacio (padding de la página + padding de `main`)
          y, en CartPage, sumaba espacio muerto DESPUÉS de la barra sticky
          de total/enviar — haciendo que se "despegara" del borde inferior
          real al hacer scroll hasta el final (la barra ya trae su propio
          padding con safe-area, no necesita este extra).
        */}
        <main className="flex-1">
          <Outlet context={{ tableId, session }} />
        </main>

      </div>
    </div>
  );
}
