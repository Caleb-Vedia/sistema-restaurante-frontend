import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del listado de usuarios de staff. */
export const USERS_KEY = ['usuarios'];

/**
 * Usuarios de staff: GET /usuarios.
 *
 * Array plano, sin paginación ni filtros de backend — el backend siempre
 * devuelve el listado completo ordenado por idUsuario ASC. La búsqueda por
 * nombre/email y los filtros de rol/estado son enteramente locales, sobre
 * este mismo array (ver UsersPage): no existen search params en el
 * contrato real, así que no se inventan acá. Sin polling: pantalla de
 * administración, no un tablero operativo.
 *
 * Requiere sesión admin (JwtAuthGuard + RolesGuard, rol admin) — ya
 * garantizada por ProtectedRoute antes de que AdminLayout/UsersPage monten.
 */
export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => api.get('/usuarios'),
  });
}
