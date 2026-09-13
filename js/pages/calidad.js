(() => {
  const estado = {
    catalogo: { productos: [], usuarios: [] },
    registros: [],
    filtros: { texto: '', desde: '', hasta: '', estatus: '' }
  };

  const el = {
    tbody: document.getElementById('tbody-calidad'),
    buscador: document.getElementById('buscador'),
    filtroDesde: document.getElementById('filtro-desde'),
    filtroHasta: document.getElementById('filtro-hasta'),
    filtroEstatus: document.getElementById('filtro-estatus'),
    btnLimpiar: document.getElementById('btn-limpiar-filtros'),
    statPendientes: document.getElementById('stat-pendientes-calidad'),
    statAprobadas: document.getElementById('stat-aprobadas'),
    statTotal: document.getElementById('stat-total-calidad'),

    modalAprobar: document.getElementById('modal-aprobar'),
    formAprobar: document.getElementById('form-aprobar'),
    resumenPreparacion: document.getElementById('resumen-preparacion'),
    campoEnvasador: document.getElementById('campo-envasador'),
    campoIdRegistro: document.getElementById('campo-id-registro')
  };

  async function iniciar() {
    const catalogoLocal = Utils.cacheLocal.leer('catalogo');
    const registrosLocal = Utils.cacheLocal.leer('registros');
    if (catalogoLocal) estado.catalogo = catalogoLocal;
    if (registrosLocal) { estado.registros = registrosLocal; renderizar(); }

    await Promise.all([cargarCatalogo(), cargarRegistros()]);

    el.buscador.addEventListener('input', Utils.debounce(() => {
      estado.filtros.texto = el.buscador.value.trim().toLowerCase();
      renderizar();
    }, 200));
    el.filtroDesde.addEventListener('change', () => { estado.filtros.desde = el.filtroDesde.value; cargarRegistros(); });
    el.filtroHasta.addEventListener('change', () => { estado.filtros.hasta = el.filtroHasta.value; cargarRegistros(); });
    el.filtroEstatus.addEventListener('change', () => { estado.filtros.estatus = el.filtroEstatus.value; renderizar(); });
    el.btnLimpiar.addEventListener('click', () => {
      estado.filtros = { texto: '', desde: '', hasta: '', estatus: '' };
      el.buscador.value = ''; el.filtroDesde.value = ''; el.filtroHasta.value = ''; el.filtroEstatus.value = '';
      cargarRegistros();
    });

    el.formAprobar.addEventListener('submit', manejarAprobacion);
    el.tbody.addEventListener('click', manejarClicTabla);
  }

  async function cargarCatalogo() {
    estado.catalogo = await Api.obtenerCatalogo();
    Utils.cacheLocal.guardar('catalogo', estado.catalogo);
  }

  async function cargarRegistros() {
    try {
      estado.registros = await Api.obtenerRegistros({ desde: estado.filtros.desde, hasta: estado.filtros.hasta });
      Utils.cacheLocal.guardar('registros', estado.registros);
      renderizar();
    } catch (err) {
      Toast.error(err.message);
      if (estado.registros.length === 0) {
        el.tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><strong>No se pudo cargar la información</strong>${Utils.escapeHtml(err.message)}</div></td></tr>`;
      }
    }
  }

  function registrosFiltrados() {
    let lista = estado.registros;
    if (estado.filtros.estatus) lista = lista.filter(r => r.estatusCalidad === estado.filtros.estatus);
    if (estado.filtros.texto) {
      lista = lista.filter(r => [r.producto, r.preparador].some(v => (v || '').toString().toLowerCase().includes(estado.filtros.texto)));
    }
    return lista;
  }

  function renderizar() {
    const lista = registrosFiltrados();

    el.statPendientes.textContent = estado.registros.filter(r => r.estatusCalidad === 'No aprobado').length;
    el.statAprobadas.textContent = estado.registros.filter(r => r.estatusCalidad === 'Aprobado').length;
    el.statTotal.textContent = lista.length;

    if (lista.length === 0) {
      el.tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><strong>Sin preparaciones</strong>No hay registros para los filtros seleccionados.</div></td></tr>`;
      return;
    }

    el.tbody.innerHTML = lista
      .slice()
      .sort((a, b) => (b.fecha + b.fechaRegistro).localeCompare(a.fecha + a.fechaRegistro))
      .map(r => `
        <tr>
          <td>${Utils.formatoFechaLegible(r.fecha)}</td>
          <td>${Utils.escapeHtml(r.producto)}</td>
          <td>${Utils.escapeHtml(r.cantidad)}</td>
          <td class="cell-muted">${Utils.escapeHtml(r.preparador)}</td>
          <td class="cell-muted">${Utils.escapeHtml(r.tanque)}</td>
          <td>${Utils.pillCalidad(r.estatusCalidad)}</td>
          <td class="cell-muted">${r.envasador ? Utils.escapeHtml(r.envasador) : '—'}</td>
          <td>
            <button class="btn btn-sm ${r.estatusCalidad === 'Aprobado' ? 'btn-secondary' : 'btn-success'}" data-abrir-aprobar="${r.id}">
              ${r.estatusCalidad === 'Aprobado' ? 'Reasignar' : 'Aprobar'}
            </button>
          </td>
        </tr>
      `).join('');
  }

  function manejarClicTabla(e) {
    const boton = e.target.closest('[data-abrir-aprobar]');
    if (!boton) return;
    const id = boton.dataset.abrirAprobar;
    const registro = estado.registros.find(r => r.id === id);
    if (!registro) return;

    el.campoIdRegistro.value = id;
    el.resumenPreparacion.innerHTML = `
      <strong>${Utils.escapeHtml(registro.producto)}</strong> · ${Utils.escapeHtml(registro.cantidad)}<br>
      Tanque ${Utils.escapeHtml(registro.tanque)} · Preparó ${Utils.escapeHtml(registro.preparador)} · ${Utils.formatoFechaLegible(registro.fecha)}<br>
      Envasador asignado en Producción: <strong>${registro.envasador ? Utils.escapeHtml(registro.envasador) : 'Sin asignar'}</strong>
    `;

    el.campoEnvasador.innerHTML = `<option value="" disabled ${!registro.envasador ? 'selected' : ''}>Selecciona un envasador</option>` +
      estado.catalogo.usuarios.map(u => `<option value="${Utils.escapeHtml(u)}" ${u === registro.envasador ? 'selected' : ''}>${Utils.escapeHtml(u)}</option>`).join('');

    Modal.abrir('modal-aprobar');
  }

  async function manejarAprobacion(e) {
    e.preventDefault();
    const boton = el.formAprobar.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      await Api.actualizarCalidad(el.campoIdRegistro.value, el.campoEnvasador.value, 'Aprobado');
      Toast.exito('Producción aprobada y envasador asignado.');
      Modal.cerrar('modal-aprobar');
      await cargarRegistros();
    } catch (err) {
      Toast.error(err.message);
    } finally {
      boton.disabled = false;
    }
  }

  iniciar();
})();
