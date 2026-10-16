import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/** Clave de cache del listado de áreas de producto. */
export const PRODUCT_AREAS_KEY = ['areas-producto'];

/**
 * Áreas de producto: GET /areas-producto.
 *
 * Solo lectura en esta fase: se usa como catálogo para el selector de Área
 * al crear/editar un producto. No hay POST/PATCH/DELETE de áreas todavía —
 * el `codigo` que el KDS necesita ('cocina' | 'bebidas') solo puede
 * asignarse vía migración/seed, no por una UI administrativa.
 */
export function useProductAreas() {
  return useQuery({
    queryKey: PRODUCT_AREAS_KEY,
    queryFn: () => api.get('/areas-producto'),
  });
}
