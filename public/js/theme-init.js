// Se ejecuta en el <head> antes de pintar la página para evitar el parpadeo de tema.
(function () {
  var theme = null;
  try { theme = localStorage.getItem('tm-theme'); } catch (e) { /* sin almacenamiento */ }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
