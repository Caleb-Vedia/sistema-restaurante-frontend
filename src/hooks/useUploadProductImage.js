import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PRODUCTS_KEY } from './useProducts';

/**
 * Subida/reemplazo de imagen: POST /productos/:id/imagen (multipart).
 *
 * Sirve tanto para "subir" (producto sin urlImagen previa) como para
 * "reemplazar" (con urlImagen previa) — es el mismo endpoint en ambos
 * casos. El backend gestiona el reemplazo (incluida la limpieza del
 * archivo anterior) internamente: el frontend NUNCA orquesta un DELETE
 * antes de este POST, eso dejaría una ventana innecesaria sin imagen.
 *
 * Quien llama arma el FormData (campo "imagen") y valida el archivo antes
 * de mutar — este hook solo lo envía. Sin optimistic update: `urlImagen`
 * nunca se pisa localmente, se espera la invalidación para reflejar la URL
 * real que devolvió el backend.
 *
 * Uso:
 *   const uploadImage = useUploadProductImage();
 *   const formData = new FormData();
 *   formData.append('imagen', file);
 *   uploadImage.mutate({ idProducto, formData });
 */
export function useUploadProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idProducto, formData }) => api.post(`/productos/${idProducto}/imagen`, formData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
