import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del listado de productos. */
export const PRODUCTS_KEY = ['productos'];

/**
 * Productos: GET /productos.
 *
 * Array plano, sin paginación. El backend ya ordena por idProducto ASC y
 * excluye los soft-deleted — no se reordena ni filtra acá. No expande
 * área/categoría, solo trae los IDs: el join visual se resuelve en la
 * página combinando esto con useProductAreas / useProductCategories.
 * Sin polling: pantalla de administración, no un tablero operativo.
 */
export function useProducts() {
  return useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: () => api.get('/productos'),
  });
}
