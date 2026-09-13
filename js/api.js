/**
 * Cliente ligero para hablar con el backend de Google Apps Script.
 *
 * Notas técnicas:
 * - Las peticiones GET van con los parámetros en la query string.
 * - Las peticiones POST se envían con Content-Type "text/plain" (en vez de
 *   application/json) a propósito: así el navegador no dispara un preflight
 *   OPTIONS, que Apps Script no maneja bien. El backend igual las parsea
 *   como JSON con JSON.parse(e.postData.contents).
 */

const Api = (() => {
  function baseUrlOK() {
    return window.APPS_SCRIPT_URL && !window.APPS_SCRIPT_URL.startsWith('PEGA_AQUI');
  }

  /**
   * Google Apps Script a veces responde con un 404/errores transitorios
   * mientras "despierta" el despliegue (sobre todo justo después de recargar
   * la página o de una nueva implementación). Como las lecturas (GET) son
   * seguras de repetir, reintentamos automáticamente antes de mostrar error.
   */
  async function conReintento(fn, intentos = 3, esperaBaseMs = 500) {
    let ultimoError;
    for (let intento = 0; intento < intentos; intento++) {
      try {
        return await fn();
      } catch (err) {
        ultimoError = err;
        if (intento < intentos - 1) {
          await new Promise(resolve => setTimeout(resolve, esperaBaseMs * (intento + 1)));
        }
      }
    }
    throw ultimoError;
  }

  async function get(action, params = {}) {
    if (!baseUrlOK()) throw new Error('Falta configurar la URL del backend en js/config.js');

    const url = new URL(window.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });

    return conReintento(async () => {
      const res = await fetch(url.toString());
      return manejarRespuesta(res);
    });
  }

  async function post(action, body = {}) {
    if (!baseUrlOK()) throw new Error('Falta configurar la URL del backend en js/config.js');

    const res = await fetch(window.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...body })
    });
    return manejarRespuesta(res);
  }

  async function manejarRespuesta(res) {
    if (!res.ok) throw new Error('Error de red al contactar el backend (' + res.status + ')');

    let json;
    try {
      json = await res.json();
    } catch (err) {
      throw new Error('El backend respondió con datos inesperados. Intenta de nuevo en unos segundos.');
    }

    if (!json.ok) throw new Error(json.error || 'El backend devolvió un error desconocido.');
    return json.datos;
  }

  return {
    obtenerCatalogo: () => get('catalogo'),
    obtenerRegistros: (filtros = {}) => get('registros', filtros),
    obtenerResumenTurno: (fecha) => get('resumenTurno', { fecha }),

    agregarUsuario: (nombre) => post('addUsuario', { nombre }),
    agregarRegistro: (datos) => post('addRegistro', datos),
    actualizarCalidad: (id, envasador, estatusCalidad) => post('updateCalidad', { id, envasador, estatusCalidad }),
    actualizarEstatusEnvasado: (id, estatus) => post('updateEstatusEnvasado', { id, estatus }),
    finalizarTurno: (fecha, reasignaciones) => post('finalizarTurno', { fecha, reasignaciones })
  };
})();
