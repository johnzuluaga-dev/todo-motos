import { el, icon, productImage, money, toast } from './dom.js';
import { initThemeToggle } from './theme.js';

const $ = (id) => document.getElementById(id);
const loginView = $('login-view');
const panelView = $('panel-view');
const form = $('product-form');
const preview = $('preview');

let products = [];
let editingId = null;
let previewUrl = null;

// ── API ────────────────────────────────────────
async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.endsWith('/login')) {
    showLogin();
    throw new Error('Sesión expirada. Inicia sesión de nuevo.');
  }
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error. Inténtalo de nuevo.');
  return data;
}

const jsonBody = (body) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ── Vistas ─────────────────────────────────────
function showLogin() {
  panelView.hidden = true;
  loginView.hidden = false;
  $('password').value = '';
  $('password').focus();
}

async function showPanel() {
  loginView.hidden = true;
  panelView.hidden = false;
  await loadProducts();
}

async function init() {
  initThemeToggle($('theme-toggle'));
  try {
    const { admin } = await api('/api/admin/me');
    if (admin) await showPanel();
    else showLogin();
  } catch {
    showLogin();
  }
}

// ── Login / logout ─────────────────────────────
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('login-error');
  error.textContent = '';
  try {
    await api('/api/admin/login', { method: 'POST', ...jsonBody({ password: $('password').value }) });
    await showPanel();
  } catch (err) {
    error.textContent = err.message;
  }
});

$('logout').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  showLogin();
});

// ── Lista de productos ─────────────────────────
async function loadProducts() {
  try {
    products = await api('/api/admin/products');
    renderList();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderList() {
  $('total-count').textContent = `(${products.length})`;
  $('list-empty').hidden = products.length > 0;
  $('list').replaceChildren(...products.map(row));
}

function row(p) {
  const meta = [p.referencia && `Ref: ${p.referencia}`, p.medida && `Medida: ${p.medida}`].filter(Boolean).join(' · ');

  const toggle = el('input', { type: 'checkbox', 'aria-label': `Agotado: ${p.nombre}` });
  toggle.checked = p.agotado;
  toggle.addEventListener('change', async () => {
    try {
      const updated = await api(`/api/admin/products/${p.id}/agotado`, { method: 'PATCH', ...jsonBody({ agotado: toggle.checked }) });
      Object.assign(p, updated);
      toast(updated.agotado ? 'Marcado como agotado' : 'Marcado como disponible');
    } catch (err) {
      toggle.checked = !toggle.checked;
      toast(err.message, 'error');
    }
  });

  return el('li', { class: 'row' },
    productImage(p, 'row__img', 160),
    el('div', {},
      el('h3', { text: p.nombre }),
      meta && el('small', { text: meta }),
      el('small', { text: money(p.precio) })
    ),
    el('div', { class: 'row__tools' },
      el('label', { class: 'switch' }, toggle, el('span', { class: 'track' }), 'Agotado'),
      el('div', { class: 'btns' },
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => startEdit(p) }, icon('edit'), 'Editar'),
        el('button', { class: 'btn btn--danger btn--sm', type: 'button', onClick: () => removeProduct(p) }, icon('trash'), 'Eliminar')
      )
    )
  );
}

async function removeProduct(p) {
  if (!confirm(`¿Eliminar "${p.nombre}"?\n\nSe borrará el producto y su imagen. Esta acción no se puede deshacer.`)) return;
  try {
    await api(`/api/admin/products/${p.id}`, { method: 'DELETE' });
    if (editingId === p.id) resetForm();
    toast('Producto eliminado');
    await loadProducts();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Formulario ─────────────────────────────────
function setPreview(url) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  preview.replaceChildren(
    url ? el('img', { src: url, alt: 'Vista previa' }) : el('span', { class: 'img-fallback' }, icon('image'))
  );
}

function resetForm() {
  editingId = null;
  form.reset();
  setPreview(null);
  $('form-title').textContent = 'Nuevo producto';
  $('save-btn').textContent = 'Guardar producto';
  $('cancel-btn').hidden = true;
  $('remove-wrap').hidden = true;
  $('form-error').textContent = '';
}

function startEdit(p) {
  resetForm();
  editingId = p.id;
  $('nombre').value = p.nombre;
  $('referencia').value = p.referencia ?? '';
  $('medida').value = p.medida ?? '';
  $('precio').value = p.precio;
  $('agotado').checked = p.agotado;
  setPreview(p.imagen_url);
  $('remove-wrap').hidden = !p.imagen_url;
  $('form-title').textContent = `Editando: ${p.nombre}`;
  $('save-btn').textContent = 'Guardar cambios';
  $('cancel-btn').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('nombre').focus({ preventScroll: true });
}

$('cancel-btn').addEventListener('click', resetForm);

$('imagen').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    e.target.value = '';
    toast('La imagen pesa más de 8 MB.', 'error');
    return;
  }
  setPreview(null);
  previewUrl = URL.createObjectURL(file);
  preview.replaceChildren(el('img', { src: previewUrl, alt: 'Vista previa' }));
  $('quitar_imagen').checked = false;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('form-error');
  error.textContent = '';

  if (!$('nombre').value.trim()) return (error.textContent = 'El nombre es obligatorio.');
  if ($('precio').value === '' || Number($('precio').value) < 0) return (error.textContent = 'Escribe un precio válido.');

  const data = new FormData();
  data.set('nombre', $('nombre').value.trim());
  data.set('referencia', $('referencia').value.trim());
  data.set('medida', $('medida').value.trim());
  data.set('precio', $('precio').value);
  data.set('agotado', $('agotado').checked);
  if ($('quitar_imagen').checked) data.set('quitar_imagen', 'true');
  const file = $('imagen').files[0];
  if (file) data.set('imagen', file);

  const saveBtn = $('save-btn');
  const label = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = file ? 'Subiendo imagen…' : 'Guardando…';

  try {
    const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
    await api(url, { method: editingId ? 'PUT' : 'POST', body: data });
    toast(editingId ? 'Cambios guardados' : 'Producto creado');
    resetForm();
    await loadProducts();
  } catch (err) {
    error.textContent = err.message;
    saveBtn.textContent = label;
  } finally {
    saveBtn.disabled = false;
    if (saveBtn.textContent === 'Subiendo imagen…' || saveBtn.textContent === 'Guardando…') saveBtn.textContent = label;
  }
});

setPreview(null);
init();
