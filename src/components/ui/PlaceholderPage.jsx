import { useLocation } from 'react-router-dom';
 
/**
 * Página temporal para rutas que aún no tienen pantalla real.
 * Se reemplaza por el componente real cuando se implementa el módulo.
 *
 * Props:
 * - title: nombre de la pantalla o módulo
 */
export default function PlaceholderPage({ title }) {
  const { pathname } = useLocation();
 
  return (
    <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-3xl mb-4">
        🚧
      </div>
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      <p className="mt-2 text-sm text-gray-400">Esta pantalla está en desarrollo.</p>
      <code className="mt-2 text-xs text-gray-300 bg-gray-50 px-3 py-1 rounded-lg">
        {pathname}
      </code>
    </div>
  );
}