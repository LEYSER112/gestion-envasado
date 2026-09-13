const Utils = (() => {
  function hoyISO() {
    const d = new Date();
    return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-');
  }

  function sumarDiasISO(fechaISO, dias) {
    const [y, m, d] = fechaISO.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    fecha.setDate(fecha.getDate() + dias);
    return [fecha.getFullYear(), pad(fecha.getMonth() + 1), pad(fecha.getDate())].join('-');
  }

  function formatoFechaLegible(fechaISO) {
    if (!fechaISO) return '—';
    const [y, m, d] = fechaISO.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function pad(n) { return n.toString().padStart(2, '0'); }

  function debounce(fn, espera = 250) {
    let temporizador;
    return (...args) => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => fn(...args), espera);
    };
  }

  function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
  }

  function iniciales(nombre) {
    if (!nombre) return '?';
    return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  function pillCalidad(estatus) {
    const clase = estatus === 'Aprobado' ? 'pill-aprobado' : 'pill-no-aprobado';
    return `<span class="pill ${clase}">${escapeHtml(estatus)}</span>`;
  }

  function pillEnvasado(estatus) {
    const mapa = {
      'Pendiente': 'pill-pendiente',
      'En proceso': 'pill-en-proceso',
      'Finalizado': 'pill-finalizado'
    };
    const clase = mapa[estatus] || 'pill-pendiente';
    return `<span class="pill ${clase}">${escapeHtml(estatus)}</span>`;
  }

  function pillRetraso(dias) {
    if (!dias || dias <= 0) return `<span class="pill pill-al-dia">Al día</span>`;
    if (dias <= 2) return `<span class="pill pill-retraso-medio">${dias} día${dias === 1 ? '' : 's'} de retraso</span>`;
    return `<span class="pill pill-retraso-alto">${dias} días de retraso</span>`;
  }

  // Caché ligera en el navegador (localStorage) para pintar la pantalla al
  // instante con el último dato conocido mientras llega la respuesta fresca
  // del backend. Solo es una optimización de percepción de velocidad — el
  // dato real siempre se refresca contra la API apenas responde.
  const cacheLocal = {
    guardar(clave, valor) {
      try { localStorage.setItem('ge_' + clave, JSON.stringify(valor)); } catch (e) { /* almacenamiento no disponible */ }
    },
    leer(clave) {
      try {
        const crudo = localStorage.getItem('ge_' + clave);
        return crudo ? JSON.parse(crudo) : null;
      } catch (e) { return null; }
    }
  };

  return { hoyISO, sumarDiasISO, formatoFechaLegible, debounce, escapeHtml, iniciales, pillCalidad, pillEnvasado, pillRetraso, cacheLocal };
})();
