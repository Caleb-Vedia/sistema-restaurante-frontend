/**
 * Constantes del dominio del negocio.
 *
 * Centralizar estos valores evita strings "mágicos" dispersos en el código.
 * Si el backend cambia un valor (ej: 'pending' → 'PENDING'), se corrige aquí.
 */
 
// ── Estados de pedidos ──────────────────────────────────────────────────────
export const ORDER_STATUS = {
  PENDING:   'pending',
  PREPARING: 'preparing',
  READY:     'ready',
  DELIVERED: 'delivered',
};
 
/** Etiquetas en español para mostrar en la UI */
export const ORDER_STATUS_LABEL = {
  pending:   'Pendiente',
  preparing: 'En preparación',
  ready:     'Listo',
  delivered: 'Entregado',
};
 
/** Variante de Badge correspondiente a cada estado */
export const ORDER_STATUS_BADGE = {
  pending:   'pending',
  preparing: 'preparing',
  ready:     'ready',
  delivered: 'delivered',
};
 
// ── Tipo de ítem ────────────────────────────────────────────────────────────
// Determina a qué módulo se envía cada ítem del pedido
export const ITEM_TYPE = {
  FOOD:     'food',
  BEVERAGE: 'beverage',
};
 
// ── Canales WebSocket ───────────────────────────────────────────────────────
export const WS_CHANNELS = {
  KITCHEN: 'kitchen',
  BAR:     'bar',
  CASHIER: 'cashier',
};
 