const Toast = (() => {
  function contenedor() {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function mostrar(mensaje, tipo = 'default', duracion = 3200) {
    const stack = contenedor();
    const toast = document.createElement('div');
    toast.className = `toast${tipo === 'error' ? ' toast-error' : ''}${tipo === 'success' ? ' toast-success' : ''}`;
    toast.textContent = mensaje;
    stack.appendChild(toast);
    setTimeout(() => toast.remove(), duracion);
  }

  return {
    info: (msg) => mostrar(msg, 'default'),
    exito: (msg) => mostrar(msg, 'success'),
    error: (msg) => mostrar(msg, 'error')
  };
})();
