(() => {
  const ESTATUS_ENVASADO = ['Pendiente', 'En proceso', 'Finalizado'];
  const INTERVALO_REFRESCO_MS = 20000; // igual al TTL de caché del backend

  const estado = {
    catalogo: { productos: [], usuarios: [] },
    registros: [],
    filtros: { perfil: Utils.cacheLocal.leer('perfilEnvasador') || '', texto: '', fecha: '' },
    ultimaFotoAprobacion: new Map() // id -> estatusCalidad, para detectar cambios entre refrescos
  };

  let temporizadorRefresco = null;

  const el = {
    tbody: document.getElementById('tbody-envasadores'),
    selectorPerfil: document.getElementById('selector-perfil'),
    buscador: document.getElementById('buscador'),
    filtroFecha: document.getElementById('filtro-fecha'),
    btnHoy: document.getElementById('btn-hoy'),
    btnVerTodo: document.getElementById('btn-limpiar-filtro-fecha'),
    btnRefrescar: document.getElementById('btn-refrescar'),
    textoUltimaActualizacion: document.getElementById('texto-ultima-actualizacion'),
    bannerSonido: document.getElementById('banner-sonido'),
    btnActivarSonido: document.getElementById('btn-activar-sonido'),
    statPendiente: document.getElementById('stat-pendiente'),
    statProceso: document.getElementById('stat-proceso'),
    statFinalizado: document.getElementById('stat-finalizado')
  };

  async function iniciar() {
    if (estado.filtros.perfil) el.selectorPerfil.value = estado.filtros.perfil;

    const catalogoLocal = Utils.cacheLocal.leer('catalogo');
    const registrosLocal = Utils.cacheLocal.leer('registros-envasadores');
    if (catalogoLocal) { estado.catalogo = catalogoLocal; poblarSelectorPerfil(); }
    if (registrosLocal) { estado.registros = registrosLocal; guardarFotoAprobacion(); renderizar(); }

    await cargarCatalogo();
    await cargarRegistros({ silencioso: false });

    el.selectorPerfil.addEventListener('change', () => {
      estado.filtros.perfil = el.selectorPerfil.value;
      Utils.cacheLocal.guardar('perfilEnvasador', estado.filtros.perfil);
      renderizar();
    });
    el.buscador.addEventListener('input', Utils.debounce(() => {
      estado.filtros.texto = el.buscador.value.trim().toLowerCase();
      renderizar();
    }, 200));
    el.filtroFecha.addEventListener('change', () => {
      estado.filtros.fecha = el.filtroFecha.value;
      cargarRegistros({ silencioso: false });
    });
    el.btnHoy.addEventListener('click', () => {
      estado.filtros.fecha = Utils.hoyISO();
      el.filtroFecha.value = estado.filtros.fecha;
      cargarRegistros({ silencioso: false });
    });
    el.btnVerTodo.addEventListener('click', () => {
      estado.filtros.fecha = '';
      el.filtroFecha.value = '';
      cargarRegistros({ silencioso: false });
    });
    el.btnRefrescar.addEventListener('click', () => cargarRegistros({ silencioso: false }));
    el.btnActivarSonido.addEventListener('click', activarSonido);

    el.tbody.addEventListener('change', manejarCambioEstatus);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) detenerAutorefresco();
      else iniciarAutorefresco();
    });

    iniciarAutorefresco();
  }

  function activarSonido() {
    const ok = Sonido.activar();
    if (ok) {
      el.bannerSonido.classList.add('oculto');
      Sonido.reproducirAviso();
      Toast.exito('Notificaciones de sonido activadas.');
    } else {
      Toast.error('Este dispositivo no soporta audio en el navegador.');
    }
  }

  function iniciarAutorefresco() {
    detenerAutorefresco();
    temporizadorRefresco = setInterval(() => cargarRegistros({ silencioso: true }), INTERVALO_REFRESCO_MS);
  }

  function detenerAutorefresco() {
    if (temporizadorRefresco) clearInterval(temporizadorRefresco);
    temporizadorRefresco = null;
  }

  async function cargarCatalogo() {
    try {
      estado.catalogo = await Api.obtenerCatalogo();
      Utils.cacheLocal.guardar('catalogo', estado.catalogo);
      poblarSelectorPerfil();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  function poblarSelectorPerfil() {
    const valorPrevio = el.selectorPerfil.value || estado.filtros.perfil;
    el.selectorPerfil.innerHTML = `<option value="">Ver todos los envasadores</option>` +
      estado.catalogo.usuarios.map(u => `<option value="${Utils.escapeHtml(u)}">${Utils.escapeHtml(u)}</option>`).join('');
    if (estado.catalogo.usuarios.includes(valorPrevio)) el.selectorPerfil.value = valorPrevio;
  }

  async function cargarRegistros({ silencioso }) {
    try {
      const nuevos = await Api.obtenerRegistros({ fecha: estado.filtros.fecha });
      detectarNuevasAprobaciones(nuevos);
      estado.registros = nuevos;
      Utils.cacheLocal.guardar('registros-envasadores', nuevos);
      guardarFotoAprobacion();
      renderizar();
      marcarUltimaActualizacion();
    } catch (err) {
      if (!silencioso) {
        Toast.error(err.message);
        if (estado.registros.length === 0) {
          el.tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><strong>No se pudo cargar la información</strong>${Utils.escapeHtml(err.message)}</div></td></tr>`;
        }
      }
      // En un refresco silencioso, si falla, simplemente se reintenta en el próximo ciclo.
    }
  }

  function guardarFotoAprobacion() {
    estado.ultimaFotoAprobacion = new Map(estado.registros.map(r => [r.id, r.estatusCalidad]));
  }

  function detectarNuevasAprobaciones(nuevosRegistros) {
    if (estado.ultimaFotoAprobacion.size === 0) return; // primera carga: no notificar retroactivamente

    const relevantesParaMi = (r) => !estado.filtros.perfil || r.envasador === estado.filtros.perfil;
    const recienAprobados = nuevosRegistros.filter(r => {
      const estatusAnterior = estado.ultimaFotoAprobacion.get(r.id);
      const seAprobóAhora = estatusAnterior && estatusAnterior !== 'Aprobado' && r.estatusCalidad === 'Aprobado';
      return seAprobóAhora && relevantesParaMi(r);
    });

    if (recienAprobados.length > 0) {
      Sonido.reproducirAviso();
      const nombres = recienAprobados.map(r => r.producto).join(', ');
      Toast.exito(`✅ Calidad aprobó: ${nombres}`);
    }
  }

  function marcarUltimaActualizacion() {
    const ahora = new Date();
    el.textoUltimaActualizacion.textContent = 'Actualizado ' + ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function registrosFiltrados() {
    // Lo que ya se finalizó Y quedó cerrado en un cierre de turno deja de
    // mostrarse aquí — para el envasador ya no es trabajo pendiente de ver.
    let lista = estado.registros.filter(r => r.envasador && (r.turnoFinalizado || 'No') !== 'Sí');
    if (estado.filtros.perfil) lista = lista.filter(r => r.envasador === estado.filtros.perfil);
    if (estado.filtros.texto) lista = lista.filter(r => (r.producto || '').toLowerCase().includes(estado.filtros.texto));
    return lista;
  }

  function renderizar() {
    const lista = registrosFiltrados();

    el.statPendiente.textContent = lista.filter(r => r.estatusEnvasado === 'Pendiente').length;
    el.statProceso.textContent = lista.filter(r => r.estatusEnvasado === 'En proceso').length;
    el.statFinalizado.textContent = lista.filter(r => r.estatusEnvasado === 'Finalizado').length;

    if (lista.length === 0) {
      el.tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><strong>No hay productos asignados</strong>Cuando calidad apruebe una preparación y te la asigne, aparecerá aquí.</div></td></tr>`;
      return;
    }

    el.tbody.innerHTML = lista
      .slice()
      .sort((a, b) => (b.diasRetraso || 0) - (a.diasRetraso || 0))
      .map(r => {
        const aprobado = r.estatusCalidad === 'Aprobado';
        return `
          <tr>
            <td>${Utils.escapeHtml(r.producto)}</td>
            <td>${Utils.escapeHtml(r.cantidad)}</td>
            <td class="cell-muted">${Utils.escapeHtml(r.tanque)}</td>
            <td class="cell-muted">${Utils.escapeHtml(r.preparador)}</td>
            <td class="cell-muted">${Utils.escapeHtml(r.envasador)}</td>
            <td>${Utils.pillCalidad(r.estatusCalidad)}</td>
            <td>
              <select class="status-select cambiar-estatus" data-id="${r.id}" ${aprobado ? '' : 'disabled'}>
                ${ESTATUS_ENVASADO.map(s => `<option value="${s}" ${s === r.estatusEnvasado ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              ${aprobado ? '' : '<div class="locked-note">Esperando aprobación de calidad</div>'}
            </td>
            <td>${Utils.pillRetraso(r.diasRetraso)}</td>
          </tr>
        `;
      }).join('');
  }

  async function manejarCambioEstatus(e) {
    const select = e.target.closest('.cambiar-estatus');
    if (!select) return;
    const id = select.dataset.id;
    const nuevoEstatus = select.value;

    select.disabled = true;
    try {
      await Api.actualizarEstatusEnvasado(id, nuevoEstatus);
      Toast.exito(`Estatus actualizado a "${nuevoEstatus}".`);
      await cargarRegistros({ silencioso: false });
    } catch (err) {
      Toast.error(err.message);
      select.disabled = false;
    }
  }

  iniciar();
})();
