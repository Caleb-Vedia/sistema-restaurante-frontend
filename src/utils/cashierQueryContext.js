// Los endpoints consultan la sesión/turno actual, no el id de la query.
// Una transición entre lecturas no debe guardar otra visita/turno en esa clave.
export function assertCashierContext(actualId, expectedId) {
  if (actualId === expectedId) return;
  const error = new Error('La sesión o el turno cambió. Actualizando la información de Caja.');
  error.status = 409;
  throw error;
}
