import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { resolveAssetUrl } from '../../services/api';

/**
 * Imagen de un producto en el flujo cliente, con degradación simple si la
 * imagen no carga. Usa resolveAssetUrl (mismo helper que Admin Productos):
 * urlImagen es una ruta relativa al backend, no un src válido tal cual.
 *
 * Compartido entre MenuPage y CartPage — misma necesidad exacta en los dos
 * lugares, no una abstracción anticipada.
 */
export default function ProductImage({ urlImagen, nombreProducto, className = 'h-16 w-16' }) {
  const [broken, setBroken] = useState(false);
  const resolvedSrc = resolveAssetUrl(urlImagen);

  if (!resolvedSrc || broken) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ${className}`}
      >
        <UtensilsCrossed className="h-8 w-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={nombreProducto}
      className={`shrink-0 rounded-lg bg-muted object-cover ${className}`}
      onError={() => setBroken(true)}
    />
  );
}
