// Descuento por volumen: aplica SOLO a las llantas.
// Para cambiar los rangos o porcentajes, edita únicamente esta tabla (de mayor a menor).
export const TIERS = [
  { min: 50, pct: 5 }, // 50 unidades o más
  { min: 40, pct: 4 }, // 40 a 49
  { min: 30, pct: 3 }, // 30 a 39
  { min: 20, pct: 2 }, // 20 a 29
];

// Un producto es "llanta" si su nombre contiene la palabra "llanta" (ej. "Llanta trasera 90/90-17").
export const isTire = (product) => /llanta/i.test(String(product?.nombre ?? ''));

/** Porcentaje de descuento que corresponde a esa cantidad de llantas (0 si no llega a 20). */
export const tirePercent = (units) => TIERS.find((t) => units >= t.min)?.pct ?? 0;

/**
 * Resumen del pedido. `lines` = [{ product, qty }].
 * Solo las llantas cuentan para el rango y solo ellas reciben el descuento.
 */
export function orderSummary(lines) {
  let subtotal = 0;
  let tireUnits = 0;
  let tireSubtotal = 0;
  for (const { product, qty } of lines) {
    const amount = (Number(product.precio) || 0) * qty;
    subtotal += amount;
    if (isTire(product)) {
      tireUnits += qty;
      tireSubtotal += amount;
    }
  }
  const percent = tirePercent(tireUnits);
  const discount = Math.round((tireSubtotal * percent) / 100);
  return { subtotal, tireUnits, percent, discount, total: subtotal - discount };
}
