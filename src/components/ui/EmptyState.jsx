import { Inbox } from 'lucide-react';

/**
 * Componente EmptyState: pantalla de estado vacío.
 * Se usa cuando una lista o sección no tiene datos que mostrar.
 *
 * Props:
 * - icon: elemento React (ícono, típicamente de lucide-react)  (default: <Inbox />)
 * - title: texto principal (requerido)
 * - description: texto secundario opcional
 * - children: acción opcional (ej: un Button para crear el primer ítem)
 *
 * Uso:
 *   <EmptyState
 *     icon={<UtensilsCrossed />}
 *     title="No hay pedidos activos"
 *     description="Los pedidos nuevos aparecerán aquí automáticamente."
 *   />
 */
export default function EmptyState({ icon = <Inbox />, title, description, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl text-muted-foreground [&_svg]:h-7 [&_svg]:w-7">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
