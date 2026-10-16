import { useEffect, useState } from 'react';
import { useUploadProductImage } from '../../hooks/useUploadProductImage';
import { Button } from '../ui/Button';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../ui/dialog';
import { resolveAssetUrl } from '../../services/api';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Mismas reglas que valida el backend (MIME + tamaño): feedback inmediato sin depender del roundtrip. No valida solo por extensión — mira el mimetype real del archivo. */
function validateFile(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: 'Solo se permiten imágenes JPEG, PNG o WebP.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'La imagen no puede superar los 5 MB.' };
  }
  return { value: file };
}

/**
 * Subida/reemplazo de imagen de un producto. Mismo diálogo para ambos
 * casos porque es el mismo endpoint (POST /productos/:id/imagen), tenga o
 * no el producto una imagen previa: el backend gestiona el reemplazo, así
 * que este componente nunca llama DELETE antes del POST.
 *
 * Separado de ProductFormDialog a propósito: son endpoints distintos
 * (multipart vs JSON) con validación y mutation propias, no comparten nada.
 *
 * Se remonta por `key` desde el padre (producto distinto) para arrancar
 * limpio, mismo criterio que el resto de los diálogos de este módulo.
 */
export default function ProductImageDialog({ product, onOpenChange, onUploaded }) {
  const uploadImage = useUploadProductImage();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [validationError, setValidationError] = useState(null);

  const hasCurrentImage = !!product?.urlImagen;

  // El preview es un Object URL local a esta selección: se revoca al elegir
  // otro archivo o al desmontar el diálogo, para no dejar leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const result = validateFile(selected);
    if (result.error) {
      setValidationError(result.error);
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    setValidationError(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (uploadImage.isPending || !file) return;

    const formData = new FormData();
    formData.append('imagen', file);

    uploadImage.mutate(
      { idProducto: product.idProducto, formData },
      { onSuccess: () => onUploaded('Imagen actualizada correctamente.') },
    );
  };

  const errorMessage =
    validationError ??
    (uploadImage.isError ? uploadImage.error?.message || 'No se pudo subir la imagen. Intentá de nuevo.' : null);

  return (
    <Dialog open={!!product} onOpenChange={(next) => !uploadImage.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hasCurrentImage ? 'Cambiar imagen' : 'Subir imagen'}</DialogTitle>
          <DialogDescription>
            {product?.nombreProducto} · JPEG, PNG o WebP, hasta 5 MB.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {previewUrl ? (
                <img src={previewUrl} alt="Vista previa" className="h-full w-full object-cover" />
              ) : hasCurrentImage ? (
                <img
                  src={resolveAssetUrl(product.urlImagen)}
                  alt={product.nombreProducto}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl text-gray-300">🍽️</span>
              )}
            </div>

            <div className="flex-1 space-y-1.5">
              <label htmlFor="imagenProducto" className="text-sm font-medium text-foreground">
                Archivo
              </label>
              <input
                id="imagenProducto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadImage.isPending}
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={uploadImage.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={uploadImage.isPending || !file}>
              {uploadImage.isPending ? 'Subiendo...' : hasCurrentImage ? 'Cambiar imagen' : 'Subir imagen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
