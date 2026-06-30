/**
 * Componente EmptyState: pantalla de estado vacío.
 * Se usa cuando una lista o sección no tiene datos que mostrar.
 *
 * Props:
 * - icon: emoji o elemento React  (default: '📭')
 * - title: texto principal (requerido)
 * - description: texto secundario opcional
 * - children: acción opcional (ej: un Button para crear el primer ítem)
 *
 * Uso:
 *   <EmptyState
 *     icon="🍽️"
 *     title="No hay pedidos activos"
 *     description="Los pedidos nuevos aparecerán aquí automáticamente."
 *   />
 */
export default function EmptyState({ icon = '📭', title, description, children }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-base font-semibold text-gray-700">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-400 max-w-xs">{description}</p>
      )}
      {children && (
        <div className="mt-5">{children}</div>
      )}
    </div>
  );
}
 