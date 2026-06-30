import { Outlet, useParams } from 'react-router-dom';
 
const RESTAURANT_NAME = import.meta.env.VITE_RESTAURANT_NAME || 'Mi Restaurante';
 
/**
 * Layout del módulo cliente.
 *
 * Características:
 * - Mobile-first: centrado y con ancho máximo para que se vea bien en celular
 * - Header fijo con nombre del restaurante y número de mesa
 * - El número de mesa viene del parámetro de URL (:tableId)
 */
export default function ClientLayout() {
  const { tableId } = useParams();
 
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
 
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-base font-bold text-gray-900">{RESTAURANT_NAME}</h1>
            {tableId && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                Mesa {tableId}
              </span>
            )}
          </div>
        </header>
 
        <main className="flex-1 pb-6">
          <Outlet />
        </main>
 
      </div>
    </div>
  );
}
 