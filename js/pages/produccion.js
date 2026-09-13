(() => {
  const estado = {
    catalogo: { productos: [], usuarios: [] },
    registros: [],
    filtros: { texto: '', desde: '', hasta: '', estatusEnvasado: '' }
  };

  const el = {
    tbody: document.getElementById('tbody-produccion'),
    buscador: document.getElementById('buscador'),
    filtroEstatus: document.getElementById('filtro-estatus-envasado'),
    filtroDesde: document.getElementById('filtro-desde'),
    filtroHasta: document.getElementById('filtro-hasta'),
    btnLimpiar: document.getElementById('btn-limpiar-filtros'),
    statTotal: document.getElementById('stat-total'),
    statNoAprobado: document.getElementById('stat-no-aprobado'),
    statPendiente: document.getElementById('stat-pendiente'),
    statEnProceso: document.getElementById('stat-en-proceso'),
    statFinalizado: document.getElementById('stat-finalizado'),

    btnAbrirProduccion: document.getElementById('btn-abrir-produccion'),
    formProduccion: document.getElementById('form-produccion'),
    campoProducto: document.getElementById('campo-producto'),
    campoPreparador: document.getElementById('campo-preparador'),
    campoEnvasador: document.getElementById('campo-envasador'),
    campoCantidad: document.getElementById('campo-cantidad'),
    campoTanque: document.getElementById('campo-tanque'),
    campoFecha: document.getElementById('campo-fecha'),

    btnAbrirUsuarios: document.getElementById('btn-abrir-usuarios'),
    formUsuario: document.getElementById('form-usuario'),
    campoNuevoUsuario: document.getElementById('campo-nuevo-usuario'),
    listaUsuarios: document.getElementById('lista-usuarios'),

    btnAbrirTurno: document.getElementById('btn-abrir-turno'),
    cuerpoTurno: document.getElementById('cuerpo-turno'),
    btnConfirmarTurno: document.getElementById('btn-confirmar-turno')
  };

  let resumenTurnoActual = null;

  async function iniciar() {
    el.campoFecha.value = Utils.hoyISO();

    // Pintado instantáneo con lo último que se vio, mientras llega lo fresco.
    const catalogoLocal = Utils.cacheLocal.leer('catalogo');
    const registrosLocal = Utils.cacheLocal.leer('registros');
    if (catalogoLocal) { estado.catalogo = catalogoLocal; poblarSelectsCatalogo(); }
    if (registrosLocal) { estado.registros = registrosLocal; renderizar(); }

    await Promise.all([cargarCatalogo(), cargarRegistros()]);

    el.buscador.addEventListener('input', Utils.debounce(() => {
      estado.filtros.texto = el.buscador.value.trim().toLowerCase();
      renderizar();
    }, 200));

    el.filtroEstatus.addEventListener('change', () => {
      estado.filtros.estatusEnvasado = el.filtroEstatus.value;
      renderizar();
    });
    el.filtroDesde.addEventListener('change', () => { estado.filtros.desde = el.filtroDesde.value; cargarRegistros(); });
    el.filtroHasta.addEventListener('change', () => { estado.filtros.hasta = el.filtroHasta.value; cargarRegistros(); });
    el.btnLimpiar.addEventListener('click', () => {
      estado.filtros = { texto: '', desde: '', hasta: '', estatusEnvasado: '' };
      el.buscador.value = ''; el.filtroDesde.value = ''; el.filtroHasta.value = ''; el.filtroEstatus.value = '';
      cargarRegistros();
    });

    el.btnAbrirProduccion.addEventListener('click', () => Modal.abrir('modal-produccion'));
    el.formProduccion.addEventListener('submit', manejarNuevaProduccion);

    el.btnAbrirUsuarios.addEventListener('click', () => { Modal.abrir('modal-usuarios'); renderizarListaUsuarios(); });
    el.formUsuario.addEventListener('submit', manejarNuevoUsuario);

    el.btnAbrirTurno.addEventListener('click', abrirModalTurno);
    el.btnConfirmarTurno.addEventListener('click', confirmarCierreTurno);
  }

  function poblarSelectsCatalogo() {
    poblarSelect(el.campoProducto, estado.catalogo.productos, 'Selecciona un producto');
    poblarSelect(el.campoPreparador, estado.catalogo.usuarios, 'Selecciona un preparador');
    poblarSelect(el.campoEnvasador, estado.catalogo.usuarios, 'Selecciona un envasador');
  }

  async function cargarCatalogo() {
    try {
      estado.catalogo = await Api.obtenerCatalogo();
      Utils.cacheLocal.guardar('catalogo', estado.catalogo);
      poblarSelectsCatalogo();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  async function cargarRegistros() {
    try {
      estado.registros = await Api.obtenerRegistros({ desde: estado.filtros.desde, hasta: estado.filtros.hasta });
      Utils.cacheLocal.guardar('registros', estado.registros);
      renderizar();
    } catch (err) {
      Toast.error(err.message);
      if (estado.registros.length === 0) {
        el.tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><strong>No se pudo cargar la información</strong>${Utils.escapeHtml(err.message)}</div></td></tr>`;
      }
    }
  }

  function poblarSelect(select, opciones, placeholder) {
    if (!select) return; // evita que un elemento faltante rompa la carga de los demás campos
    const valorPrevio = select.value;
    select.innerHTML = `<option value="" disabled ${!valorPrevio ? 'selected' : ''}>${placeholder}</option>` +
      opciones.map(o => `<option value="${Utils.escapeHtml(o)}">${Utils.escapeHtml(o)}</option>`).join('');
    if (opciones.includes(valorPrevio)) select.value = valorPrevio;
  }

  function registrosFiltrados() {
    let lista = estado.registros;
    if (estado.filtros.estatusEnvasado) lista = lista.filter(r => r.estatusEnvasado === estado.filtros.estatusEnvasado);
    if (estado.filtros.texto) {
      const texto = estado.filtros.texto;
      lista = lista.filter(r => [r.producto, r.preparador, r.envasador, r.tanque].some(v => (v || '').toString().toLowerCase().includes(texto)));
    }
    return lista;
  }

  function renderizar() {
    const lista = registrosFiltrados();

    el.statTotal.textContent = lista.length;
    el.statNoAprobado.textContent = lista.filter(r => r.estatusCalidad === 'No aprobado').length;
    el.statPendiente.textContent = lista.filter(r => r.estatusEnvasado === 'Pendiente').length;
    el.statEnProceso.textContent = lista.filter(r => r.estatusEnvasado === 'En proceso').length;
    el.statFinalizado.textContent = lista.filter(r => r.estatusEnvasado === 'Finalizado').length;

    if (lista.length === 0) {
      el.tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><strong>Sin producciones</strong>Ajusta los filtros o programa una nueva producción.</div></td></tr>`;
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
          <td class="cell-muted">${r.envasador ? Utils.escapeHtml(r.envasador) : '—'}</td>
          <td>${Utils.pillCalidad(r.estatusCalidad)}</td>
          <td>${Utils.pillEnvasado(r.estatusEnvasado)}</td>
          <td>${Utils.pillRetraso(r.diasRetraso)}</td>
        </tr>
      `).join('');
  }

  async function manejarNuevaProduccion(e) {
    e.preventDefault();
    const boton = el.formProduccion.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      await Api.agregarRegistro({
        fecha: el.campoFecha.value,
        producto: el.campoProducto.value,
        cantidad: el.campoCantidad.value,
        preparador: el.campoPreparador.value,
        envasador: el.campoEnvasador.value,
        tanque: el.campoTanque.value.trim()
      });
      Toast.exito('Producción programada correctamente.');
      Modal.cerrar('modal-produccion');
      el.formProduccion.reset();
      el.campoFecha.value = Utils.hoyISO();
      await cargarRegistros();
    } catch (err) {
      Toast.error(err.message);
    } finally {
      boton.disabled = false;
    }
  }

  async function manejarNuevoUsuario(e) {
    e.preventDefault();
    const nombre = el.campoNuevoUsuario.value.trim();
    if (!nombre) return;
    try {
      await Api.agregarUsuario(nombre);
      el.campoNuevoUsuario.value = '';
      Toast.exito('Usuario registrado.');
      await cargarCatalogo();
      renderizarListaUsuarios();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  function renderizarListaUsuarios() {
    if (estado.catalogo.usuarios.length === 0) {
      el.listaUsuarios.innerHTML = `<div class="empty-state">Aún no hay preparadores/envasadores registrados.</div>`;
      return;
    }
    el.listaUsuarios.innerHTML = `
      <table class="data-table">
        <tbody>
          ${estado.catalogo.usuarios.map(u => `
            <tr>
              <td>
                <span class="avatar-chip">
                  <span class="avatar-dot">${Utils.iniciales(u)}</span>
                  ${Utils.escapeHtml(u)}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  // ---------------------------------------------------------------
  // FINALIZAR TURNO
  // ---------------------------------------------------------------

  async function abrirModalTurno() {
    Modal.abrir('modal-turno');
    el.cuerpoTurno.innerHTML = `<div class="empty-state">Cargando resumen del día…</div>`;
    try {
      resumenTurnoActual = await Api.obtenerResumenTurno(Utils.hoyISO());
      renderizarResumenTurno();
    } catch (err) {
      el.cuerpoTurno.innerHTML = `<div class="empty-state"><strong>No se pudo cargar el resumen</strong>${Utils.escapeHtml(err.message)}</div>`;
    }
  }

  function renderizarResumenTurno() {
    const r = resumenTurnoActual;
    const abiertos = r.registros.filter(x => x.estatusEnvasado !== 'Finalizado');
    const opcionesUsuarios = estado.catalogo.usuarios;

    const filasReasignables = abiertos.length === 0
      ? `<div class="text-muted" style="font-size:13px;">No hay producciones en proceso o pendientes ahora mismo.</div>`
      : abiertos
        .slice()
        .sort((a, b) => (b.diasRetraso || 0) - (a.diasRetraso || 0))
        .map(reg => `
        <div class="turno-fila">
          <div class="turno-info">
            <strong>${Utils.escapeHtml(reg.producto)}</strong>
            ${Utils.escapeHtml(reg.cantidad)} · Tanque ${Utils.escapeHtml(reg.tanque)} ·
            ${Utils.pillEnvasado(reg.estatusEnvasado)} ${Utils.pillRetraso(reg.diasRetraso)}
          </div>
          <select class="input status-select reasignar-select" data-id="${reg.id}" data-envasador-original="${Utils.escapeHtml(reg.envasador || '')}">
            <option value="" ${!reg.envasador ? 'selected' : ''}>Sin asignar</option>
            ${opcionesUsuarios.map(u => `<option value="${Utils.escapeHtml(u)}" ${u === reg.envasador ? 'selected' : ''}>${Utils.escapeHtml(u)}</option>`).join('')}
          </select>
        </div>
      `).join('');

    const filasCumplimiento = Object.entries(r.cumplimiento).map(([envasador, c]) => `
      <tr>
        <td>${Utils.escapeHtml(envasador)}</td>
        <td>${c.finalizados}</td>
        <td>${c.enProceso}</td>
        <td>${c.noIniciados}</td>
      </tr>
    `).join('');

    el.cuerpoTurno.innerHTML = `
      <div class="resumen-turno-grid">
        <div class="stat-card"><div class="stat-value">${r.total}</div><div class="stat-label">Abiertas en planta</div></div>
        <div class="stat-card accent-success"><div class="stat-value">${r.finalizados}</div><div class="stat-label">Finalizados</div></div>
        <div class="stat-card accent-info"><div class="stat-value">${r.enProceso}</div><div class="stat-label">En proceso</div></div>
        <div class="stat-card accent-neutral"><div class="stat-value">${r.pendientes}</div><div class="stat-label">Pendientes</div></div>
      </div>

      <div class="turno-seccion">
        <h4>Producciones abiertas — puedes reasignar envasador</h4>
        ${filasReasignables}
      </div>

      <div class="turno-seccion">
        <h4>Cumplimiento por envasador</h4>
        <div class="table-wrap">
          <table class="data-table cumplimiento-table">
            <thead><tr><th>Envasador</th><th>Finalizó</th><th>Dejó en proceso</th><th>No inició</th></tr></thead>
            <tbody>${filasCumplimiento || '<tr><td colspan="4" class="cell-muted">Sin datos de envasadores.</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <p class="text-muted" style="font-size:12.5px; margin-top:14px;">
        Al confirmar: lo que ya está <strong>Finalizado</strong> se cierra y pasa a histórico. Lo que sigue
        <strong>Pendiente</strong> o <strong>En proceso</strong> NO se duplica — sigue siendo la misma
        producción, con su fecha original, acumulando días de retraso hasta que se termine.
      </p>
    `;
  }

  async function confirmarCierreTurno() {
    if (!resumenTurnoActual) return;
    const selects = el.cuerpoTurno.querySelectorAll('.reasignar-select');
    const reasignaciones = [];
    selects.forEach(sel => {
      const original = sel.dataset.envasadorOriginal;
      if (sel.value !== original) {
        reasignaciones.push({ id: sel.dataset.id, envasador: sel.value });
      }
    });

    el.btnConfirmarTurno.disabled = true;
    try {
      const resultado = await Api.finalizarTurno(resumenTurnoActual.fecha, reasignaciones);
      Toast.exito(`Turno cerrado. ${resultado.finalizadosCerrados} producción(es) finalizada(s) pasaron a histórico.`);
      Modal.cerrar('modal-turno');
      await cargarRegistros();
    } catch (err) {
      Toast.error(err.message);
    } finally {
      el.btnConfirmarTurno.disabled = false;
    }
  }

  iniciar();
})();