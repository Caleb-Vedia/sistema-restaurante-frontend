import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from './context/AppContext';
import router from './router';

/**
 * Instancia única de QueryClient para toda la aplicación.
 *
 * Se crea fuera del componente para que no se recree en cada render
 * (eso vaciaría la cache en cada actualización del árbol).
 *
 * `retry: false`: el backend responde con códigos legítimos que no tiene
 * sentido reintentar (401 sin sesión, 409 conflicto de negocio, 404).
 * Reintentar solo retrasaría el feedback al usuario.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <RouterProvider router={router} />
      </AppProvider>
    </QueryClientProvider>
  );
}
