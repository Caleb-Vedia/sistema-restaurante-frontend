import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { invalidateStaffSession } from '../services/queryClient';

/**
 * Mutación de logout del staff.
 *
 * El backend invalida la cookie httpOnly. Del lado del frontend hay que
 * limpiar la cache de sesión de inmediato (setQueryData a null, sin esperar
 * un refetch) para que ProtectedRoute deje de considerar al usuario logueado,
 * y recién ahí navegar a /login.
 *
 * Usa useNavigate, así que solo puede llamarse desde componentes que estén
 * dentro del router.
 *
 * Uso:
 *   const logout = useLogout();
 *   logout.mutate();
 */
export function useLogout() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      void invalidateStaffSession();
      navigate('/login', { replace: true });
    },
  });
}
