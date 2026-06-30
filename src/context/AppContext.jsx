import { createContext, useContext } from 'react';
 
/**
 * Contexto global de la aplicación.
 *
 * Estado actual: mínimo por diseño.
 * Solo se añadirá estado aquí cuando exista una necesidad real y concreta,
 * no de forma anticipada.
 *
 * Candidatos futuros probables:
 * - Datos del usuario autenticado (si se implementa login para el admin)
 * - Sistema de notificaciones/toasts globales
 * - Configuración del restaurante (nombre, logo)
 */
 
const AppContext = createContext(null);
 
export function AppProvider({ children }) {
  // Se agregará estado aquí cuando sea necesario
  const value = {};
 
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
 
/**
 * Hook para consumir el contexto global.
 * Lanza un error descriptivo si se usa fuera del AppProvider.
 */
export function useApp() {
  const context = useContext(AppContext);
  if (context === null) {
    throw new Error('useApp debe utilizarse dentro de un <AppProvider>');
  }
  return context;
}
 
