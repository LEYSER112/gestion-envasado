document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  if (!toggle || !sidebar) return;

  const abrir = () => { sidebar.classList.add('open'); scrim?.classList.add('open'); };
  const cerrar = () => { sidebar.classList.remove('open'); scrim?.classList.remove('open'); };

  toggle.addEventListener('click', () => {
    sidebar.classList.contains('open') ? cerrar() : abrir();
  });
  scrim?.addEventListener('click', cerrar);
});
