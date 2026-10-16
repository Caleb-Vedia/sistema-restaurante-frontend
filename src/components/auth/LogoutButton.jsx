import { useState } from 'react';
import { useLogout } from '../../hooks/useLogout';

/**
 * Botón de cierre de sesión, compartido por StaffLayout y AdminLayout.
 *
 * Encapsula solo la lógica: disparar useLogout(), reflejar el estado
 * pending (deshabilitado + label "Cerrando...") y mostrar un mensaje breve
 * si POST /auth/logout falla. No limpia la sesión ni navega manualmente
 * en ningún caso — eso ya lo resuelve useLogout en su propio onSuccess;
 * si la mutación falla, este componente deliberadamente no hace nada más
 * que avisar, para no dejar al usuario "medio deslogueado".
 *
 * El estilo del trigger se pasa por `className` porque StaffLayout (header
 * oscuro) y AdminLayout (sidebar claro) necesitan paletas opuestas — el
 * comportamiento es idéntico en los dos, solo cambia la piel.
 *
 * Props:
 * - className: clases Tailwind del <button>, definidas por quien lo usa
 */
export default function LogoutButton({ className = '' }) {
  const logout = useLogout();
  const [failed, setFailed] = useState(false);

  const handleClick = () => {
    if (logout.isPending) return;
    setFailed(false);
    logout.mutate(undefined, { onError: () => setFailed(true) });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={logout.isPending}
        className={className}
      >
        {logout.isPending ? 'Cerrando...' : 'Cerrar sesión'}
      </button>
      {failed && (
        <p className="text-xs text-red-500" role="alert">
          No se pudo cerrar sesión. Intentá de nuevo.
        </p>
      )}
    </div>
  );
}
