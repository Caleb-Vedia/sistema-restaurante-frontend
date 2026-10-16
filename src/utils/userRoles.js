/**
 * Roles válidos de usuario de staff.
 *
 * El backend NO expone un endpoint de roles (no existe GET /roles): son 4
 * valores fijos y cerrados que ambos lados ya conocen de memoria, por eso
 * se declaran acá como constante en vez de pedirlos por red. Cualquier
 * valor fuera de esta lista es inválido para POST/PATCH /usuarios.
 *
 * Única fuente de verdad para UsersPage (columna Rol, filtro) y
 * UserFormDialog (select) — evita que ambos archivos mantengan su propia
 * copia de la lista y terminen divergiendo.
 */
export const USER_ROLES = [
  { value: 'cocina', label: 'Cocina' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'caja', label: 'Caja' },
  { value: 'admin', label: 'Administrador' },
];

/** rol → label amigable, derivado de USER_ROLES. */
export const USER_ROLE_LABELS = Object.fromEntries(USER_ROLES.map((rol) => [rol.value, rol.label]));
