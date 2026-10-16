import { Navigate, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Spinner from './ui/Spinner';
import EmptyState from './ui/EmptyState';
import ConnectionErrorState from './ui/ConnectionErrorState';

/**
 * Ruta de inicio de cada rol.
 * Se usa para ofrecerle al usuario un camino de salida cuando cae en una
 * sección que no le corresponde, en vez de dejarlo en un callejón sin salida.
 * Se exporta porque LoginPage necesita el mismo mapeo para redirigir después
 * de un login exitoso.
 */
export const HOME_BY_ROL = {
  cocina:  '/kitchen',
  bebidas: '/bar',
  caja:    '/cashier',
  admin:   '/admin',
};

/**
 * Guard de rutas de staff.
 *
 * Se usa como ruta padre sin `path` en el router: renderiza <Outlet />, así
 * que el layout y las páginas hijas solo se montan si el usuario pasó el
 * control de sesión y de rol.
 *
 * Estados:
 * 1. isLoading         → Spinner (todavía no sabemos si hay sesión; redirigir
 *                        acá mandaría a /login a un usuario válido)
 * 2. isError           → /auth/me falló de verdad (5xx, red), no es "sin sesión":
 *                        NO redirige a /login, muestra estado de error con Reintentar
 * 3. !isAuthenticated  → redirect a /login (replace: no ensucia el historial)
 * 4. rol no permitido  → pantalla de acceso denegado con link a su propio módulo
 * 5. ok                → <Outlet />
 *
 * Props:
 * - allowedRoles: array de roles habilitados, ej: ['cocina', 'admin']
 */
export default function ProtectedRoute({ allowedRoles = [] }) {
  const { rol, isLoading, isAuthenticated, isError, refetch } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" className="text-gray-400" />
      </div>
    );
  }

  if (isError) {
    return <ConnectionErrorState onRetry={refetch} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(rol)) {
    const home = HOME_BY_ROL[rol];

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <EmptyState
          icon="🔒"
          title="Acceso denegado"
          description="Tu rol no tiene permiso para ver esta sección."
        >
          {home && (
            <Link
              to={home}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors"
            >
              Ir a mi módulo
            </Link>
          )}
        </EmptyState>
      </div>
    );
  }

  return <Outlet />;
}
