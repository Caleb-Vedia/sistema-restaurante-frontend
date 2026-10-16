import { createBrowserRouter } from 'react-router-dom';
 
import ClientLayout from '../components/layout/ClientLayout';
import StaffLayout from '../components/layout/StaffLayout';
import AdminLayout from '../components/layout/AdminLayout';
import PlaceholderPage from '../components/ui/PlaceholderPage';
import ProtectedRoute from '../components/ProtectedRoute';
import LoginPage from '../pages/auth/LoginPage';
import KitchenPage from '../pages/staff/KitchenPage';
import BarPage from '../pages/staff/BarPage';
import CashierPage from '../pages/staff/CashierPage';
import DashboardPage from '../pages/admin/DashboardPage';
import CategoriesPage from '../pages/admin/CategoriesPage';
import ProductsPage from '../pages/admin/ProductsPage';
import UsersPage from '../pages/admin/UsersPage';
import TablesPage from '../pages/admin/TablesPage';
import PaymentMethodsPage from '../pages/admin/PaymentMethodsPage';
import ReportsPage from '../pages/admin/ReportsPage';
import MenuPage from '../pages/client/MenuPage';
import CartPage from '../pages/client/CartPage';
import OrderStatusPage from '../pages/client/OrderStatusPage';
import MyOrdersPage from '../pages/client/MyOrdersPage';
 
/**
 * Estructura de rutas del sistema:
 *
 * /menu/:tableId          → Módulo Cliente (acceso por QR)
 * /kitchen               → Módulo Cocina
 * /bar                   → Módulo Bebidas
 * /cashier               → Módulo Caja
 * /admin                 → Módulo Administrador
 * /login                 → Login de staff
 *
 * Cada módulo usa un layout distinto según el perfil de usuario y dispositivo.
 * Las rutas hijas son PlaceholderPage hasta que se implementen las pantallas reales.
 *
 * Los módulos de staff (cocina, bebidas, caja, admin) van envueltos en
 * ProtectedRoute: exigen sesión activa (cookie httpOnly) y un rol habilitado.
 * El módulo cliente (/menu/:tableId) queda fuera: usa X-Table-Token, un
 * mecanismo distinto que no depende de la sesión de staff.
 */
const router = createBrowserRouter([
  // ── MÓDULO CLIENTE ──────────────────────────────────────────────────────────
  {
    path: '/menu/:tableId',
    element: <ClientLayout />,
    children: [
      { index: true,             element: <MenuPage /> },
      { path: 'cart',            element: <CartPage /> },
      { path: 'orders',          element: <MyOrdersPage /> },
      { path: 'order/:orderId',  element: <OrderStatusPage /> },
    ],
  },
 
  // ── MÓDULO COCINA ────────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['cocina', 'admin']} />,
    children: [
      {
        path: '/kitchen',
        element: <StaffLayout module="kitchen" />,
        children: [
          { index: true, element: <KitchenPage /> },
        ],
      },
    ],
  },
 
  // ── MÓDULO BEBIDAS ───────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['bebidas', 'admin']} />,
    children: [
      {
        path: '/bar',
        element: <StaffLayout module="bar" />,
        children: [
          { index: true, element: <BarPage /> },
        ],
      },
    ],
  },
 
  // ── MÓDULO CAJA ──────────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['caja', 'admin']} />,
    children: [
      {
        path: '/cashier',
        element: <StaffLayout module="cashier" />,
        children: [
          { index: true, element: <CashierPage /> },
        ],
      },
    ],
  },
 
  // ── MÓDULO ADMINISTRADOR ─────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['admin']} />,
    children: [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true,             element: <DashboardPage /> },
          { path: 'categories',      element: <CategoriesPage /> },
          { path: 'products',        element: <ProductsPage /> },
          { path: 'users',           element: <UsersPage /> },
          { path: 'tables',          element: <TablesPage /> },
          { path: 'payment-methods', element: <PaymentMethodsPage /> },
          { path: 'reports',         element: <ReportsPage /> },
        ],
      },
    ],
  },
 
  // ── LOGIN (staff) ────────────────────────────────────────────────────────────
  // Pública a propósito: es la puerta de entrada al resto de los módulos.
  {
    path: '/login',
    element: <LoginPage />,
  },

  // ── 404 ──────────────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <PlaceholderPage title="Página no encontrada" />,
  },
]);
 
export default router;