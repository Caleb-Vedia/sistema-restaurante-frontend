import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del listado de categorías de producto. */
export const PRODUCT_CATEGORIES_KEY = ['categorias-producto'];

/**
 * Categorías de producto: GET /categorias-producto.
 *
 * Array plano, sin paginación. El backend ya ordena por
 * idCategoriaProducto ASC y excluye las soft-deleted — no se reordena ni
 * filtra acá. Sin polling: es una pantalla de administración, no un
 * tablero operativo que necesite reflejar cambios de otros roles en vivo.
 */
export function useProductCategories() {
  return useQuery({
    queryKey: PRODUCT_CATEGORIES_KEY,
    queryFn: () => api.get('/categorias-producto'),
  });
}
