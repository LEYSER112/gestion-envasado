/**
 * Manejo genérico de modales. Cada modal en el HTML debe tener la clase
 * "modal-overlay" y un id único; se abre/cierra agregando la clase "open".
 */
const Modal = (() => {
  function abrir(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function cerrar(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function inicializarCierres() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cerrar(overlay.id);
      });
      overlay.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => cerrar(overlay.id));
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(o => cerrar(o.id));
      }
    });
  }

  return { abrir, cerrar, inicializarCierres };
})();

document.addEventListener('DOMContentLoaded', Modal.inicializarCierres);
