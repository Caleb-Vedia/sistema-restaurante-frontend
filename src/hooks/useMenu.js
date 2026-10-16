import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del menú público. No depende de la mesa: es el mismo catálogo para todo el restaurante. */
export const MENU_KEY = ['menu'];

/**
 * Menú público del cliente: GET /menu.
 *
 * Público — sin cookie, sin JWT, sin X-Table-Token. El backend ya excluye
 * productos no disponibles/soft-deleted, categorías soft-deleted e
 * ingredientes soft-deleted — no se repite ese filtrado acá (el campo
 * `disponible` ni siquiera viene en este response, así que no hay nada que
 * comprobar del lado del frontend).
 *
 * Sin polling: el catálogo no cambia con la frecuencia de un tablero
 * operativo — alcanza con el comportamiento por defecto de React Query.
 */
export function useMenu() {
  return useQuery({
    queryKey: MENU_KEY,
    queryFn: () => api.get('/menu'),
  });
}
