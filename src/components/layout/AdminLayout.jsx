import { NavLink, Outlet } from 'react-router-dom';
import LogoutButton from '../auth/LogoutButton';

/**
 * Ítems de navegación del sidebar.
 * Agregar una ruta nueva aquí la hace aparecer automáticamente en el menú.
 */
const NAV_ITEMS = [
  { label: 'Dashboard',    to: '/admin',             icon: '📊', end: true },
  { label: 'Categorías',   to: '/admin/categories',  icon: '🏷️' },
  { label: 'Productos',    to: '/admin/products',    icon: '🍽️' },
  { label: 'Usuarios',     to: '/admin/users',       icon: '👤' },
  { label: 'Mesas',        to: '/admin/tables',      icon: '🪑' },
  { label: 'Métodos de pago', to: '/admin/payment-methods', icon: '💳' },
  { label: 'Reportes',     to: '/admin/reports',     icon: '📈' },
];
 
/**
 * Layout del módulo administrador.
 *
 * Características:
 * - Sidebar fijo a la izquierda con navegación
 * - NavLink de react-router-dom: gestiona el estado activo automáticamente
 * - El prop `end` en Dashboard evita que quede activo en todas las rutas /admin/*
 * - Responsivo: en móvil el sidebar podría colapsarse (mejora futura si es necesario)
 */
export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-100">
 
      {/* ── Sidebar ── */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-widest">Panel de</p>
          <h1 className="text-base font-bold text-gray-900 mt-0.5">Administración</h1>
        </div>
 
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <LogoutButton className="flex w-full items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
        </div>
      </aside>
 
      {/* ── Contenido principal ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
 
    </div>
  );
}
 