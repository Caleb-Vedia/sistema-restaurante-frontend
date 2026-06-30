import { createBrowserRouter } from 'react-router-dom';
 
import ClientLayout from '../components/layout/ClientLayout';
import StaffLayout from '../components/layout/StaffLayout';
import AdminLayout from '../components/layout/AdminLayout';
import PlaceholderPage from '../components/ui/PlaceholderPage';
 
/**
 * Estructura de rutas del sistema:
 *
 * /menu/:tableId          → Módulo Cliente (acceso por QR)
 * /kitchen               → Módulo Cocina
 * /bar                   → Módulo Bebidas
 * /cashier               → Módulo Caja
 * /admin                 → Módulo Administrador
 *
 * Cada módulo usa un layout distinto según el perfil de usuario y dispositivo.
 * Las rutas hijas son PlaceholderPage hasta que se implementen las pantallas reales.
 */
const router = createBrowserRouter([
  // ── MÓDULO CLIENTE ──────────────────────────────────────────────────────────
  {
    path: '/menu/:tableId',
    element: <ClientLayout />,
    children: [
      { index: true,             element: <PlaceholderPage title="Menú" /> },
      { path: 'cart',            element: <PlaceholderPage title="Carrito" /> },
      { path: 'order/:orderId',  element: <PlaceholderPage title="Estado del Pedido" /> },
    ],
  },
 
  // ── MÓDULO COCINA ────────────────────────────────────────────────────────────
  {
    path: '/kitchen',
    element: <StaffLayout module="kitchen" />,
    children: [
      { index: true, element: <PlaceholderPage title="Pedidos de Cocina" /> },
    ],
  },
 
  // ── MÓDULO BEBIDAS ───────────────────────────────────────────────────────────
  {
    path: '/bar',
    element: <StaffLayout module="bar" />,
    children: [
      { index: true, element: <PlaceholderPage title="Pedidos de Bebidas" /> },
    ],
  },
 
  // ── MÓDULO CAJA ──────────────────────────────────────────────────────────────
  {
    path: '/cashier',
    element: <StaffLayout module="cashier" />,
    children: [
      { index: true, element: <PlaceholderPage title="Caja" /> },
    ],
  },
 
  // ── MÓDULO ADMINISTRADOR ─────────────────────────────────────────────────────
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true,             element: <PlaceholderPage title="Dashboard" /> },
      { path: 'categories',      element: <PlaceholderPage title="Gestión de Categorías" /> },
      { path: 'products',        element: <PlaceholderPage title="Gestión de Productos" /> },
      { path: 'reports',         element: <PlaceholderPage title="Reportes" /> },
    ],
  },
 
  // ── 404 ──────────────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <PlaceholderPage title="Página no encontrada" />,
  },
]);
 
export default router;