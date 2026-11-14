const KEY = 'tm-theme';

export function initThemeToggle(button) {
  const root = document.documentElement;

  const sync = () => {
    const dark = root.getAttribute('data-theme') === 'dark';
    button.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    button.title = dark ? 'Modo claro' : 'Modo oscuro';
  };

  button.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch { /* sin almacenamiento */ }
    sync();
  });

  sync();
}
