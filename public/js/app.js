import { el, icon, productImage, money, normalize, toast } from './dom.js';
import { initThemeToggle } from './theme.js';
import * as cart from './cart.js';
import { TIERS } from './discount.js';

const state = { products: [], search: '', sort: 'default', config: { whatsappNumber: '', whatsappGreeting: '' } };

const $ = (id) => document.getElementById(id);
const grid = $('grid');
const stateBox = $('state');
const productDialog = $('product-dialog');
const cartDialog = $('cart-dialog');

// ── Datos ──────────────────────────────────────
async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function load() {
  showSkeleton();
  try {
    const [config, products] = await Promise.all([getJSON('/api/config'), getJSON('/api/products')]);
    state.config = config;
    state.products = products;
    cart.setCatalog(products);
    render();
  } catch (err) {
    console.error(err);
    grid.replaceChildren();
    showState('No pudimos cargar los productos', 'Revisa tu conexión e inténtalo de nuevo.', true);
    $('result-count').textContent = '';
  }
}

// ── Filtrar / ordenar ──────────────────────────
function visibleProducts() {
  const q = normalize(state.search).trim();
  let list = state.products;
  if (q) {
    list = list.filter((p) =>
      [p.nombre, p.referencia, p.medida].some((field) => normalize(field).includes(q))
    );
  }
  list = [...list];
  switch (state.sort) {
    case 'price-asc': list.sort((a, b) => a.precio - b.precio); break;
    case 'price-desc': list.sort((a, b) => b.precio - a.precio); break;
    case 'name-asc': list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); break;
  }
  return list;
}

// ── Render del catálogo ────────────────────────
function showSkeleton() {
  stateBox.hidden = true;
  grid.replaceChildren(
    ...Array.from({ length: 8 }, () =>
      el('div', { class: 'card skeleton', 'aria-hidden': 'true' },
        el('div', { class: 'card__media' }),
        el('div', { class: 'sk-line' }),
        el('div', { class: 'sk-line short' })
      )
    )
  );
}

function showState(title, text, retry = false) {
  stateBox.replaceChildren(
    el('h2', { text: title }),
    el('p', { text }),
    ...(retry ? [el('button', { class: 'btn btn--primary', type: 'button', onClick: load, text: 'Reintentar' })] : [])
  );
  stateBox.hidden = false;
}

/** Precio con la leyenda pequeña "IVA incluido". */
const priceNode = (p) =>
  el('p', { class: 'price' }, money(p.precio), el('small', { class: 'iva', text: 'IVA incluido' }));

function card(p) {
  const media = productImage(p, 'card__media');
  if (p.agotado) media.append(el('div', { class: 'tag-out' }, el('span', { text: 'Agotado' })));

  const meta = [p.referencia && `Ref: ${p.referencia}`, p.medida].filter(Boolean).join(' · ');

  return el('article', { class: 'card' },
    el('button', { class: 'card__main', type: 'button', 'aria-label': `Ver detalle de ${p.nombre}`, onClick: () => openProduct(p) },
      media,
      el('div', { class: 'card__body' },
        el('h3', { class: 'card__title', text: p.nombre }),
        meta && el('p', { class: 'card__meta', text: meta }),
        priceNode(p)
      )
    ),
    el('div', { class: 'card__actions' },
      el('button', {
        class: 'btn btn--primary btn--block', type: 'button', disabled: p.agotado,
        onClick: () => { cart.add(p.id, 1); toast(`Agregado: ${p.nombre}`); },
      }, p.agotado ? 'Agotado' : 'Agregar')
    )
  );
}

function render() {
  const list = visibleProducts();
  grid.replaceChildren(...list.map(card));

  const q = state.search.trim();
  $('result-count').textContent = q
    ? `${list.length} ${list.length === 1 ? 'resultado' : 'resultados'} para “${q}”`
    : `${list.length} ${list.length === 1 ? 'producto' : 'productos'}`;

  if (!state.products.length) showState('Aún no hay productos', 'Muy pronto subiremos el catálogo. ¡Vuelve a visitarnos!');
  else if (!list.length) showState('Sin resultados', 'Prueba con otro nombre, referencia o medida.');
  else stateBox.hidden = true;
}

// ── Diálogos ───────────────────────────────────
function closeOnBackdrop(dialog) {
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
}
const closeButton = (dialog) =>
  el('button', { class: 'dialog__close', type: 'button', 'aria-label': 'Cerrar', onClick: () => dialog.close() }, icon('close'));

function stepper(value, { onMinus, onPlus, small = false, min = 1 }) {
  const out = el('output', { text: String(value), 'aria-live': 'polite' });
  return el('div', { class: `stepper${small ? ' stepper--sm' : ''}` },
    el('button', { type: 'button', 'aria-label': 'Quitar uno', disabled: value <= min, onClick: onMinus }, icon('minus')),
    out,
    el('button', { type: 'button', 'aria-label': 'Agregar uno', disabled: value >= cart.MAX_QTY, onClick: onPlus }, icon('plus'))
  );
}

function openProduct(p) {
  let qty = 1;
  const buy = el('div', { class: 'pd__buy' });

  const draw = () => {
    if (p.agotado) {
      buy.replaceChildren(el('button', { class: 'btn btn--ghost', type: 'button', disabled: true }, 'Producto agotado'));
      return;
    }
    buy.replaceChildren(
      stepper(qty, { onMinus: () => { qty -= 1; draw(); }, onPlus: () => { qty += 1; draw(); } }),
      el('button', {
        class: 'btn btn--primary', type: 'button',
        onClick: () => { cart.add(p.id, qty); productDialog.close(); toast(`Agregado: ${qty} × ${p.nombre}`); },
      }, `Agregar · ${money(p.precio * qty)}`)
    );
  };
  draw();

  const media = productImage(p, 'pd__media', 900);
  if (p.agotado) media.append(el('div', { class: 'tag-out' }, el('span', { text: 'Agotado' })));

  productDialog.replaceChildren(
    closeButton(productDialog),
    el('div', { class: 'pd' },
      media,
      el('div', { class: 'pd__body' },
        el('h2', { text: p.nombre }),
        (p.referencia || p.medida) && el('dl', { class: 'meta' },
          p.referencia && [el('dt', { text: 'Referencia' }), el('dd', { text: p.referencia })],
          p.medida && [el('dt', { text: 'Medida' }), el('dd', { text: p.medida })]
        ),
        priceNode(p),
        buy
      )
    )
  );
  productDialog.showModal();
}

function drawCart() {
  const lines = cart.lines();
  const s = cart.summary();

  if (!lines.length) {
    cartDialog.replaceChildren(
      closeButton(cartDialog),
      el('div', { class: 'cart__head' }, el('h2', { text: 'Tu pedido' })),
      el('div', { class: 'cart__empty' },
        el('h3', { text: 'Tu carrito está vacío' }),
        el('p', { text: 'Agrega productos del catálogo para armar tu pedido.' }),
        el('button', { class: 'btn btn--primary', type: 'button', onClick: () => cartDialog.close() }, 'Ver productos')
      )
    );
    return;
  }

  cartDialog.replaceChildren(
    closeButton(cartDialog),
    el('div', { class: 'cart__head' }, el('h2', { text: 'Tu pedido' })),
    el('ul', { class: 'cart__list' },
      lines.map(({ product: p, qty }) =>
        el('li', { class: 'cart-item' },
          productImage(p, 'cart-item__img', 160),
          el('div', {},
            el('h3', { text: p.nombre }),
            el('small', { text: [p.referencia && `Ref: ${p.referencia}`, p.medida].filter(Boolean).join(' · ') }),
            el('small', { text: `${money(p.precio)} c/u` }),
            el('div', { class: 'cart-item__row' },
              stepper(qty, { small: true, onMinus: () => cart.setQty(p.id, qty - 1), onPlus: () => cart.setQty(p.id, qty + 1), min: 1 }),
              el('span', { class: 'cart-item__sub', text: money(p.precio * qty) })
            ),
            el('button', { class: 'link-btn', type: 'button', onClick: () => cart.remove(p.id) }, 'Quitar')
          )
        )
      )
    ),
    el('div', { class: 'cart__foot' },
      ...(s.percent > 0 ? [
        el('div', { class: 'cart__row' }, el('span', { text: 'Subtotal' }), el('span', { text: money(s.subtotal) })),
        el('div', { class: 'cart__row cart__row--disc' },
          el('span', { text: `Descuento llantas (${s.tireUnits} unid. · ${s.percent}%)` }),
          el('span', { text: `-${money(s.discount)}` })),
      ] : []),
      el('div', { class: 'cart__total' }, el('span', { text: `Total (${cart.count()} ${cart.count() === 1 ? 'artículo' : 'artículos'})` }), el('strong', { text: money(s.total) })),
      el('p', { class: 'iva iva--cart', text: 'IVA incluido' }),
      el('button', { class: 'btn btn--wa btn--block', type: 'button', onClick: sendToWhatsApp }, icon('whatsapp'), 'Pedir por WhatsApp'),
      el('button', { class: 'btn btn--ghost btn--block', type: 'button', onClick: () => cart.clear() }, 'Vaciar carrito')
    )
  );
}

function sendToWhatsApp() {
  if (!state.config.whatsappNumber) return toast('El número de WhatsApp aún no está configurado.', 'error');
  const url = cart.buildWhatsAppUrl({ number: state.config.whatsappNumber, greeting: state.config.whatsappGreeting });
  window.open(url, '_blank', 'noopener');
}

// ── Contador del carrito ───────────────────────
let lastCount = cart.count();
function updateBadge() {
  const n = cart.count();
  const badge = $('cart-count');
  badge.textContent = String(n);
  badge.hidden = n === 0;
  if (n > lastCount) {
    badge.classList.remove('bump');
    void badge.offsetWidth; // reinicia la animación
    badge.classList.add('bump');
  }
  lastCount = n;
  if (cartDialog.open) drawCart();
}

// ── Barra animada con el descuento en llantas ──
// Se arma con la misma tabla de discount.js, así nunca queda desactualizada.
function initPromo() {
  const box = $('promo');
  if (!box) return;
  const tiers = [...TIERS].sort((a, b) => a.min - b.min);
  // Texto tal como lo definió el negocio: "De 20 a 30 unid 2%", ..., "De 50 en adelante el 5%".
  const range = (t, i) => {
    const next = tiers[i + 1];
    return next ? `De ${t.min} a ${next.min} unid ` : `De ${t.min} en adelante el `;
  };
  const group = (hidden) =>
    el('div', { class: 'promo__group', ...(hidden ? { 'aria-hidden': 'true' } : {}) },
      el('span', { class: 'promo__title', text: 'Descuento en llantas' }),
      ...tiers.flatMap((t, i) => [
        el('span', { class: 'promo__dot', text: '•' }),
        el('span', { class: 'promo__item', text: range(t, i) }, el('strong', { text: `${t.pct}%` })),
      ]),
      el('span', { class: 'promo__dot', text: '•' })
    );
  // 4 copias: con la animación de -25% el recorrido es continuo incluso en pantallas anchas.
  box.replaceChildren(el('div', { class: 'promo__track' }, group(false), group(true), group(true), group(true)));
  box.hidden = false;
}

// ── Inicio ─────────────────────────────────────
initThemeToggle($('theme-toggle'));
closeOnBackdrop(productDialog);
closeOnBackdrop(cartDialog);
cart.subscribe(updateBadge);

$('cart-btn').addEventListener('click', () => { drawCart(); cartDialog.showModal(); });

let searchTimer;
$('search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.search = e.target.value; render(); }, 180);
});
$('sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

initPromo();
updateBadge();
load();
