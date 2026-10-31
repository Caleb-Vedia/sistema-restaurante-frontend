import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

export const AUTH_ME_KEY = ['auth', 'me'];
// Solo identifica transiciones de sesión; la identidad sigue en AUTH_ME_KEY.
// Un refetch normal de /auth/me no debe convertir un 401 vigente en obsoleto.
let sessionRevision = 0;

export function invalidateStaffSession() {
  sessionRevision += 1;
  const cancelled = queryClient.cancelQueries({ queryKey: AUTH_ME_KEY, exact: true });
  queryClient.setQueryData(AUTH_ME_KEY, null);
  return cancelled;
}

// Es una referencia a la verificación de sesión existente, no otra identidad.
export function captureStaffSession() {
  const query = queryClient.getQueryCache().find({ queryKey: AUTH_ME_KEY, exact: true });
  return query?.state.data
    ? { query, revision: sessionRevision, userId: query.state.data.idUsuario } : null;
}

function handleStaffError(error) {
  if (error?.status !== 401 || !error.staffSession) return;
  const current = captureStaffSession();
  if (!current || current.query !== error.staffSession.query
    || current.revision !== error.staffSession.revision
    || current.userId !== error.staffSession.userId) return;

  // Impedir que un /auth/me pendiente restaure la identidad ya invalidada.
  // Las rutas protegidas se desmontan al observar null; no se redirige aquí.
  void invalidateStaffSession();
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleStaffError }),
  mutationCache: new MutationCache({ onError: handleStaffError }),
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});
