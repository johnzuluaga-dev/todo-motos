import { el, icon, productImage, normalize, toast } from './dom.js';
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

/**
 * Parte de abajo de la tarjeta: "Agregar" y, una vez agregado, el selector de cantidad
 * (así se pueden sumar o quitar unidades sin salir del catálogo).
 */
function cardActions(p) {
  if (p.agotado) {
    return [el('button', { class: 'btn btn--primary btn--block', type: 'button', disabled: true }, 'Agotado')];
  }
  const q = cart.qtyOf(p.id);
  if (q === 0) {
    return [el('button', { class: 'btn btn--primary btn--block', type: 'button', onClick: () => cart.add(p.id, 1) }, 'Agregar')];
  }
  return [stepper(q, {
    min: 0,
    label: `Cantidad de ${p.nombre}`,
    onMinus: () => cart.setQty(p.id, q - 1),
    onPlus: () => cart.setQty(p.id, q + 1),
  })];
}

/** Actualiza solo la parte de abajo de las tarjetas cuyo carrito cambió (sin redibujar fotos ni mover el scroll). */
function syncCards() {
  for (const box of grid.querySelectorAll('.card__actions[data-id]')) {
    const p = state.products.find((x) => x.id === Number(box.dataset.id));
    if (!p) continue;
    const q = cart.qtyOf(p.id);
    if (String(q) === box.dataset.q) continue;
    box.dataset.q = String(q);
    box.replaceChildren(...cardActions(p));
  }
}

function card(p) {
  const media = productImage(p, 'card__media');
  if (p.agotado) media.append(el('div', { class: 'tag-out' }, el('span', { text: 'Agotado' })));

  const meta = [p.referencia && `Ref: ${p.referencia}`, p.medida].filter(Boolean).join(' · ');

  return el('article', { class: 'card' },
    el('button', { class: 'card__main', type: 'button', 'aria-label': `Ver detalle de ${p.nombre}`, onClick: () => openProduct(p) },
      media,
      el('div', { class: 'card__body' },
        el('h3', { class: 'card__title', text: p.nombre }),
        meta && el('p', { class: 'card__meta', text: meta })
      )
    ),
    el('div', { class: 'card__actions', 'data-id': String(p.id), 'data-q': String(cart.qtyOf(p.id)) }, ...cardActions(p))
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

/** Selector de cantidad: botón −, el número (no se escribe) y botón +. */
function stepper(value, { onMinus, onPlus, small = false, min = 1, label = 'Cantidad' }) {
  return el('div', { class: `stepper${small ? ' stepper--sm' : ''}` },
    el('button', { type: 'button', 'aria-label': 'Quitar uno', disabled: value <= min, onClick: onMinus }, icon('minus')),
    el('output', { class: 'stepper__qty', 'aria-label': label, 'aria-live': 'polite', text: String(value) }),
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
      stepper(qty, {
        label: 'Cantidad a agregar',
        onMinus: () => { qty -= 1; draw(); },
        onPlus: () => { qty += 1; draw(); },
      }),
      el('button', {
        class: 'btn btn--primary', type: 'button',
        onClick: () => { cart.add(p.id, qty); productDialog.close(); toast(`Agregado: ${qty} × ${p.nombre}`); },
      }, 'Agregar al pedido')
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
        buy
      )
    )
  );
  productDialog.showModal();
}

function drawCart() {
  const lines = cart.lines();
  const s = cart.summary();
  // El carrito se redibuja completo en cada cambio: guardamos el scroll para no volver arriba.
  const prevList = cartDialog.querySelector('.cart__list')?.scrollTop ?? 0;
  const prevDialog = cartDialog.scrollTop;

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
            el('div', { class: 'cart-item__row' },
              stepper(qty, {
                small: true, min: 1, label: `Cantidad de ${p.nombre}`,
                onMinus: () => cart.setQty(p.id, qty - 1), onPlus: () => cart.setQty(p.id, qty + 1),
              })
            ),
            el('button', { class: 'link-btn', type: 'button', onClick: () => cart.remove(p.id) }, 'Quitar')
          )
        )
      )
    ),
    el('div', { class: 'cart__foot' },
      el('div', { class: 'cart__total' }, el('span', { text: 'Total de artículos' }), el('strong', { text: String(cart.count()) })),
      ...(s.percent > 0 ? [
        el('div', { class: 'cart__row cart__row--disc' },
          el('span', { text: `Descuento por volumen en llantas (${s.tireUnits} unid.)` }),
          el('span', { text: `${s.percent}%` })),
      ] : []),
      el('button', { class: 'btn btn--wa btn--block', type: 'button', onClick: sendToWhatsApp }, icon('whatsapp'), 'Pedir por WhatsApp'),
      el('button', { class: 'btn btn--ghost btn--block', type: 'button', onClick: () => cart.clear() }, 'Vaciar carrito')
    )
  );

  const list = cartDialog.querySelector('.cart__list');
  if (list) list.scrollTop = prevList;
  cartDialog.scrollTop = prevDialog;
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
  syncCards();
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
