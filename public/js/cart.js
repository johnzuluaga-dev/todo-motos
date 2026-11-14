import { money } from './dom.js';

const KEY = 'todomotos-cart-v1';
const MAX_QTY = 99;

let catalog = new Map(); // id -> producto actual
let items = load(); // [{ id, qty }]
const listeners = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((i) => Number.isInteger(i?.id) && Number.isInteger(i?.qty) && i.qty > 0)
      .map((i) => ({ id: i.id, qty: Math.min(i.qty, MAX_QTY) }));
  } catch {
    return [];
  }
}

function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* sin almacenamiento */ }
  listeners.forEach((fn) => fn());
}

/** Sincroniza el carrito con el catálogo: quita lo que ya no existe o se agotó. */
export function setCatalog(products) {
  catalog = new Map(products.map((p) => [p.id, p]));
  items = items.filter((i) => {
    const p = catalog.get(i.id);
    return p && !p.agotado;
  });
  commit();
}

export const subscribe = (fn) => listeners.add(fn);

/** Líneas del carrito con su producto: [{ product, qty }] */
export const lines = () =>
  items.map((i) => ({ product: catalog.get(i.id), qty: i.qty })).filter((l) => l.product);

export const count = () => lines().reduce((sum, l) => sum + l.qty, 0);
export const total = () => lines().reduce((sum, l) => sum + l.product.precio * l.qty, 0);
export const qtyOf = (id) => items.find((i) => i.id === id)?.qty ?? 0;
export { MAX_QTY };

export function add(id, qty = 1) {
  const p = catalog.get(id);
  if (!p || p.agotado) return;
  const line = items.find((i) => i.id === id);
  if (line) line.qty = Math.min(line.qty + qty, MAX_QTY);
  else items.push({ id, qty: Math.min(qty, MAX_QTY) });
  commit();
}

export function setQty(id, qty) {
  if (qty <= 0) return remove(id);
  const line = items.find((i) => i.id === id);
  if (line) line.qty = Math.min(qty, MAX_QTY);
  commit();
}

export function remove(id) {
  items = items.filter((i) => i.id !== id);
  commit();
}

export function clear() {
  items = [];
  commit();
}

/** Mensaje de pedido y enlace de WhatsApp con cantidades y precios. */
export function buildWhatsAppUrl({ number, greeting }) {
  const rows = lines().map(({ product: p, qty }, index) => {
    const detail = [p.referencia && `Ref: ${p.referencia}`, p.medida && `Medida: ${p.medida}`]
      .filter(Boolean)
      .join(' · ');
    return (
      `${index + 1}. ${p.nombre}${detail ? ` (${detail})` : ''}\n` +
      `   ${qty} x ${money(p.precio)} = ${money(p.precio * qty)}`
    );
  });

  const text = [greeting, '', ...rows, '', `*Total: ${money(total())}*`, '', '¡Gracias!'].join('\n');
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
