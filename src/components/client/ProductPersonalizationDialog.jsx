import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../ui/dialog';

/**
 * Tope de caracteres de "Otra indicación" — coincide con el límite que el
 * backend aplica al bloque `Nota:` de `observacion` (ver
 * dinemetrix-backend/src/pedidos/dto/validators/observacion-nota-max-length.validator.ts).
 * Es una constante de UI independiente, no importada de ahí: son dos
 * proyectos separados y el backend sigue siendo la fuente de verdad real —
 * esto es solo para no dejar que el cliente escriba algo que el backend va
 * a rechazar.
 */
const OTRA_INDICACION_MAX_LENGTH = 120;

/**
 * Diálogo de personalización de un producto — REUTILIZADO entre MenuPage
 * ("Personalizar" → agrega una variante nueva) y CartPage ("Editar" →
 * modifica una línea ya existente). La diferencia entre ambos usos es
 * enteramente de quien lo abre (qué le pasa como `valorInicial` y qué hace
 * en `onConfirm`), no del componente en sí.
 *
 * Ingredientes: checkboxes construidos EXCLUSIVAMENTE desde
 * `ingredientesDisponibles` ([{id, nombre}], mismo shape que
 * `MenuIngredienteResponse` de GET /menu) — nunca se inventan opciones. Si
 * el producto no tiene ingredientes registrados, esa sección directamente
 * no se renderiza (ver `MenuPage`/`CartPage`, que arman
 * `ingredientesDisponibles` como la unión del catálogo actual + lo que la
 * línea ya tenía seleccionado, para no perder un ingrediente que el admin
 * haya dado de baja después de que el cliente lo eligiera).
 *
 * "Otra indicación" siempre está disponible, tenga o no el producto
 * ingredientes registrados.
 *
 * Estado local se reinicializa cada vez que el diálogo pasa a `open`
 * (nunca al cerrarse, para no perder el valor mientras la animación de
 * cierre todavía está en curso) — así reabrirlo para OTRA línea/producto
 * nunca arrastra la selección de la apertura anterior.
 *
 * Layout: el `DialogContent` se fuerza a `flex flex-col` con un techo de
 * altura (`max-h-[85dvh]`, `dvh` para que en mobile encoja junto con el
 * teclado en vez de quedar calculado sobre un viewport que ya no es
 * visible) — el título y el footer de acciones quedan fijos
 * (`shrink-0`) y solo el bloque de ingredientes + nota hace scroll interno
 * (`overflow-y-auto`). Así, un producto con muchos ingredientes nunca
 * empuja "Cancelar"/"Agregar" fuera de la pantalla.
 */
export default function ProductPersonalizationDialog({
  open,
  nombreProducto,
  ingredientesDisponibles,
  valorInicial,
  confirmLabel = 'Agregar al carrito',
  onOpenChange,
  onConfirm,
}) {
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  const [otraIndicacion, setOtraIndicacion] = useState('');

  useEffect(() => {
    if (!open) return;
    setSeleccionados(new Set((valorInicial?.ingredientesQuitados ?? []).map((ingrediente) => ingrediente.id)));
    setOtraIndicacion(valorInicial?.otraIndicacion ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleIngrediente = (id) => {
    setSeleccionados((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) {
        siguiente.delete(id);
      } else {
        siguiente.add(id);
      }
      return siguiente;
    });
  };

  // Con tipeo normal, `maxLength` en el <Textarea> ya impide llegar a este
  // estado (el navegador no deja escribir el caracter 121). Pero un valor
  // inicial legacy puede llegar por encima del límite (ver comentario del
  // `useEffect` de arriba) y el usuario puede no haberlo tocado — por eso
  // este chequeo se hace también acá, no solo deshabilitando el botón: es
  // la única guarda real contra confirmar con la Nota todavía demasiado
  // larga, sea cual sea el motivo por el que el estado llegó así.
  const excedeLimite = otraIndicacion.length > OTRA_INDICACION_MAX_LENGTH;

  const handleConfirm = () => {
    if (excedeLimite) return;

    const ingredientesQuitados = (ingredientesDisponibles ?? []).filter((ingrediente) =>
      seleccionados.has(ingrediente.id),
    );
    // Espacios solos → cadena vacía, nunca `"   "` como si fuera una
    // indicación real (ver buildObservacion: un otraIndicacion vacío no
    // genera bloque `Nota:`).
    onConfirm({ ingredientesQuitados, otraIndicacion: otraIndicacion.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Personalizar {nombreProducto}</DialogTitle>
          <DialogDescription>Elegí qué ingredientes quitar y agregá una indicación si hace falta.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {ingredientesDisponibles?.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Quitar ingredientes</p>
              <div className="flex flex-col gap-2">
                {ingredientesDisponibles.map((ingrediente) => {
                  const checked = seleccionados.has(ingrediente.id);
                  return (
                    <label
                      key={ingrediente.id}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        checked ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleIngrediente(ingrediente.id)}
                        className="h-5 w-5 shrink-0 rounded border-input accent-primary"
                      />
                      Sin {ingrediente.nombre}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`space-y-1.5 ${ingredientesDisponibles?.length > 0 ? 'border-t border-border pt-4' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="otra-indicacion" className="text-sm font-medium text-foreground">
                Otra indicación <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <span className={`text-xs ${excedeLimite ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                {otraIndicacion.length}/{OTRA_INDICACION_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id="otra-indicacion"
              placeholder="Ej: salsa aparte, término medio"
              value={otraIndicacion}
              onChange={(event) => setOtraIndicacion(event.target.value)}
              maxLength={OTRA_INDICACION_MAX_LENGTH}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">Para quitar ingredientes usa las opciones de arriba.</p>
            {excedeLimite && (
              <p className="text-xs text-destructive">
                Este texto viene de una personalización anterior y supera el límite actual. Reducilo a{' '}
                {OTRA_INDICACION_MAX_LENGTH} caracteres o menos para guardar los cambios.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-10">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" className="h-10" onClick={handleConfirm} disabled={excedeLimite}>
            <Check className="h-4 w-4" /> {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
