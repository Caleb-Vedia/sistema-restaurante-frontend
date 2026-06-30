import { Outlet } from 'react-router-dom';
 
/**
 * Configuración visual por módulo de staff.
 * Permite que el mismo layout se vea diferente según el área del restaurante.
 */
const MODULE_CONFIG = {
  kitchen: {
    label: 'Cocina',
    headerBg: 'bg-orange-700',
    icon: '👨‍🍳',
  },
  bar: {
    label: 'Bebidas',
    headerBg: 'bg-violet-800',
    icon: '🍹',
  },
  cashier: {
    label: 'Caja',
    headerBg: 'bg-blue-800',
    icon: '💳',
  },
};
 
/**
 * Layout para módulos internos del restaurante: Cocina, Bebidas y Caja.
 *
 * Características:
 * - Fondo oscuro (slate-900): reduce fatiga visual en entornos de trabajo
 * - Texto grande: legible a distancia en cocina o barra
 * - Indicador de conexión: referencia visual para cuando integremos WebSocket
 * - Recibe el prop `module` para personalizar el encabezado
 *
 * Props:
 * - module: 'kitchen' | 'bar' | 'cashier'
 */
export default function StaffLayout({ module }) {
  const config = MODULE_CONFIG[module] || MODULE_CONFIG.kitchen;
 
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
 
      <header className={`${config.headerBg} px-6 py-4`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <p className="text-xs text-white/60 uppercase tracking-widest leading-none">
                Módulo
              </p>
              <h1 className="text-lg font-bold leading-tight">{config.label}</h1>
            </div>
          </div>
 
          {/* Indicador de estado de conexión - se conectará a useWebSocket más adelante */}
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            En línea
          </div>
        </div>
      </header>
 
      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
 
    </div>
  );
}
 