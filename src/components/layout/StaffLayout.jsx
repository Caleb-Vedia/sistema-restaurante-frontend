import { Outlet } from 'react-router-dom';
import LogoutButton from '../auth/LogoutButton';

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
 * `<main>` es `flex flex-col` a propósito, y ahora es GENUINAMENTE full-width
 * (sin `max-w-7xl`/`mx-auto` en sí mismo): eso le da a cualquier módulo un
 * contenedor cuyo ancho real llega hasta el borde del fondo oscuro de este
 * layout, para que un fondo propio (como el de Caja) pueda ocupar todo ese
 * ancho sin dejar gutters visibles — antes `max-w-7xl mx-auto` vivía en el
 * propio `<main>`, así que NADA de lo que hubiera adentro (ni con su propio
 * fondo) podía llegar más lejos que esa caja ya centrada y topeada.
 *
 * El centrado que antes daba `<main>` se preserva IDÉNTICO para Cocina/
 * Bebidas envolviendo `<Outlet/>` acá adentro con el mismo max-width/padding
 * que tenía `<main>` (mismo valor, mismo elemento que hace de contenedor
 * flex para esos módulos) — pixel a pixel el mismo resultado que antes. Caja
 * es la única excepción: recibe `<Outlet/>` sin ese wrapper, así su propio
 * componente puede armar la estructura "fondo full-width → contenido
 * centrado con max-width" que necesita (ver CashierPage) sin pelear contra
 * un ancestro que ya lo tope.
 *
 * Props:
 * - module: 'kitchen' | 'bar' | 'cashier'
 */
export default function StaffLayout({ module }) {
  const config = MODULE_CONFIG[module] || MODULE_CONFIG.kitchen;
  const contenido =
    module === 'cashier' ? (
      <Outlet />
    ) : (
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4">
        <Outlet />
      </div>
    );

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

          <div className="flex items-center gap-4">
            {/* Indicador de estado de conexión - se conectará a useWebSocket más adelante */}
            <div className="flex items-center gap-2 text-sm text-white/60">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              En línea
            </div>

            <LogoutButton className="text-sm font-medium text-white/70 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
          </div>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col">
        {contenido}
      </main>

    </div>
  );
}
 