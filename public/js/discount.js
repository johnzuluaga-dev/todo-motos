// Descuento por volumen: aplica SOLO a las llantas.
// Esta versión del catálogo no muestra precios, así que solo calcula el % y se informa en el pedido.
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

/** Resumen del pedido. `lines` = [{ product, qty }]. Solo las llantas cuentan para el rango. */
export function orderSummary(lines) {
  const tireUnits = lines.reduce((sum, { product, qty }) => sum + (isTire(product) ? qty : 0), 0);
  return { tireUnits, percent: tirePercent(tireUnits) };
}
