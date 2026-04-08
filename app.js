// =============================================
//  FINANZAS PRO - app.js
// =============================================

// ---------- ESTADO ----------
let gastos    = JSON.parse(localStorage.getItem('fp_gastos'))    || [];
let ingresos  = JSON.parse(localStorage.getItem('fp_ingresos'))  || [];
let presupuesto = parseFloat(localStorage.getItem('fp_presupuesto')) || 20000;
let categoriasExtras = JSON.parse(localStorage.getItem('fp_cats')) || [];

let chart = null;
let modo  = 'general';
let filtroTiempo = 'mes';
let modoEliminar = false;
let modoEditar   = false;
let editandoId   = null;   // id del registro en edición
let pendienteEliminarId = null;

// ---------- COLORES GRÁFICA ----------
const COLORS = [
  '#6366f1','#10b981','#f43f5e','#f59e0b','#3b82f6',
  '#a855f7','#ec4899','#14b8a6','#f97316','#84cc16',
  '#06b6d4','#8b5cf6','#d946ef','#22c55e','#eab308'
];

// ---------- CATEGORÍAS BASE ----------
const CATS_BASE = [
  { val:'Comida',        label:'🍽️ Comida' },
  { val:'Bebidas',       label:'🥤 Bebidas' },
  { val:'Alcohol',       label:'🍺 Alcohol' },
  { val:'Fiesta',        label:'🎉 Fiesta' },
  { val:'Transporte',    label:'🚌 Transporte' },
  { val:'Gasolina-Moto', label:'⛽ Gasolina Moto' },
  { val:'Gasolina-Carro',label:'⛽ Gasolina Carro' },
];

// =============================================
//  INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  const hoy = hoyISO();
  document.getElementById('fecha-hoy').textContent  = formatFechaLinda(hoy);
  document.getElementById('fecha-gasto').value       = hoy;
  document.getElementById('fecha-ingreso').value     = hoy;
  document.getElementById('fecha-filtro').value      = hoy;
  cargarCategorias('categoria');
  actualizarUI();
});

// =============================================
//  HELPERS DE FECHA
// =============================================
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatFechaLinda(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d} ${meses[parseInt(m)-1]} ${y}`;
}

function formatFechaCorta(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${String(y).slice(2)}`;
}

// =============================================
//  FILTRO DE TIEMPO
// =============================================
function getRegistrosFiltrados(lista) {
  const hoy = hoyISO();
  const fechaFiltro = document.getElementById('fecha-filtro').value || hoy;
  return lista.filter(r => {
    const f = r.fecha || hoy;
    if (filtroTiempo === 'dia')    return f === fechaFiltro;
    if (filtroTiempo === 'semana') return mismaSemanaDe(f, fechaFiltro);
    if (filtroTiempo === 'mes')    return f.slice(0,7) === fechaFiltro.slice(0,7);
    if (filtroTiempo === 'anual')  return f.slice(0,4) === fechaFiltro.slice(0,4);
    return true;
  });
}

function mismaSemanaDe(iso, ref) {
  const d = new Date(iso + 'T00:00:00');
  const r = new Date(ref + 'T00:00:00');
  const lunes = (dt) => {
    const day = dt.getDay() || 7;
    const diff = dt.getDate() - day + 1;
    return new Date(dt.getFullYear(), dt.getMonth(), diff).toISOString().slice(0,10);
  };
  return lunes(d) === lunes(r);
}

// =============================================
//  CAMBIAR TIEMPO
// =============================================
function cambiarTiempo(t) {
  filtroTiempo = t;
  // reset activos
  ['dia','semana','mes','anual'].forEach(x => {
    document.getElementById('btn-' + x)?.classList.remove('active-time');
  });
  document.getElementById('btn-' + t)?.classList.add('active-time');

  const picker = document.getElementById('date-picker-container');
  if (t === 'dia') picker.classList.remove('hidden');
  else             picker.classList.add('hidden');

  actualizarUI();
}

// =============================================
//  CAMBIAR MODO GRÁFICA
// =============================================
function cambiarModo(m) {
  modo = m;
  // sidebar buttons
  ['capital','general','categorias'].forEach(x => {
    document.getElementById('btn-' + x)?.classList.remove('active-mode');
  });
  document.getElementById('btn-' + m)?.classList.add('active-mode');
  // pills
  ['capital','general','categorias'].forEach(x => {
    document.getElementById('pill-' + x)?.classList.remove('active-pill');
  });
  document.getElementById('pill-' + m)?.classList.add('active-pill');

  document.getElementById('tituloGrafica').textContent =
    m === 'capital' ? 'Capital' : m === 'general' ? 'General' : 'Categorías';

  actualizarUI();
}

// =============================================
//  VISTAS
// =============================================
function mostrarVista(v) {
  ['principal','registros'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(v).classList.remove('hidden');
  ['btn-principal','btn-registros'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });
  document.getElementById('btn-' + v)?.classList.add('active');

  if (v === 'registros') renderRegistros();
}

// =============================================
//  CATEGORÍAS
// =============================================
function cargarCategorias(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  const extras = [...categoriasExtras].sort((a,b) => a.localeCompare(b));
  const opciones = [
    ...CATS_BASE,
    ...extras.map(e => ({ val: e, label: e })),
    { val:'Otros', label:'➕ Otros' }
  ];

  sel.innerHTML = opciones.map(o =>
    `<option value="${o.val}">${o.label}</option>`
  ).join('');
}

function checkCategoria() {
  const sel = document.getElementById('categoria');
  const grp = document.getElementById('nuevaCategoria-group');
  grp.classList.toggle('hidden', sel.value !== 'Otros');
}

// =============================================
//  AGREGAR GASTO
// =============================================
function agregarGasto() {
  const concepto  = document.getElementById('concepto').value.trim();
  const montoStr  = document.getElementById('monto').value;
  const monto     = parseFloat(montoStr);
  let   categoria = document.getElementById('categoria').value;
  const fecha     = document.getElementById('fecha-gasto').value || hoyISO();
  const nueva     = document.getElementById('nuevaCategoria').value.trim();

  if (!concepto || isNaN(monto) || monto <= 0) {
    shake(document.getElementById('concepto'));
    return;
  }

  if (categoria === 'Otros') {
    if (!nueva) { shake(document.getElementById('nuevaCategoria')); return; }
    categoria = nueva;
    if (!categoriasExtras.includes(nueva)) {
      categoriasExtras.push(nueva);
      localStorage.setItem('fp_cats', JSON.stringify(categoriasExtras));
    }
  }

  gastos.push({ id: Date.now(), tipo:'gasto', concepto, monto, categoria, fecha });
  save();

  // limpiar
  document.getElementById('concepto').value = '';
  document.getElementById('monto').value = '';
  document.getElementById('nuevaCategoria').value = '';
  document.getElementById('nuevaCategoria-group').classList.add('hidden');
  document.getElementById('fecha-gasto').value = hoyISO();
  cargarCategorias('categoria');
  actualizarUI();
}

// =============================================
//  AGREGAR INGRESO (modal)
// =============================================
function abrirModalIngreso() {
  document.getElementById('modal-ingreso').classList.remove('hidden');
  document.getElementById('fecha-ingreso').value = hoyISO();
  document.getElementById('concepto-ingreso').value = '';
  document.getElementById('monto-ingreso').value = '';
}

function agregarIngreso() {
  const concepto = document.getElementById('concepto-ingreso').value.trim();
  const monto    = parseFloat(document.getElementById('monto-ingreso').value);
  const fecha    = document.getElementById('fecha-ingreso').value || hoyISO();

  if (!concepto || isNaN(monto) || monto <= 0) return;

  ingresos.push({ id: Date.now(), tipo:'ingreso', concepto, monto, fecha });
  save();
  cerrarModal('modal-ingreso');
  actualizarUI();
}

// =============================================
//  PRESUPUESTO
// =============================================
function editarPresupuesto() {
  document.getElementById('nuevo-presupuesto').value = presupuesto;
  document.getElementById('modal-presupuesto').classList.remove('hidden');
}

function guardarPresupuesto() {
  const val = parseFloat(document.getElementById('nuevo-presupuesto').value);
  if (isNaN(val) || val <= 0) return;
  presupuesto = val;
  localStorage.setItem('fp_presupuesto', presupuesto);
  cerrarModal('modal-presupuesto');
  actualizarUI();
}

// =============================================
//  ELIMINAR
// =============================================
function toggleModoEliminar() {
  modoEliminar = !modoEliminar;
  if (modoEliminar) modoEditar = false;
  actualizarUI();

  document.getElementById('btn-eliminar-toggle')
    .classList.toggle('modo-activo', modoEliminar);
  document.getElementById('btn-editar-toggle')
    .classList.toggle('modo-activo', false);
}

function pedirEliminar(id, concepto) {
  pendienteEliminarId = id;
  document.getElementById('confirmar-texto').textContent =
    `¿Eliminar "${concepto}"?`;
  document.getElementById('modal-confirmar').classList.remove('hidden');
  document.getElementById('btn-confirmar-si').onclick = confirmarEliminar;
}

function confirmarEliminar() {
  gastos   = gastos.filter(g => g.id !== pendienteEliminarId);
  ingresos = ingresos.filter(i => i.id !== pendienteEliminarId);
  save();
  cerrarModal('modal-confirmar');
  actualizarUI();
}

// =============================================
//  EDITAR
// =============================================
function toggleModoEditar() {
  modoEditar = !modoEditar;
  if (modoEditar) modoEliminar = false;
  actualizarUI();

  document.getElementById('btn-editar-toggle')
    .classList.toggle('modo-activo', modoEditar);
  document.getElementById('btn-eliminar-toggle')
    .classList.toggle('modo-activo', false);
}

function abrirEditar(id) {
  // buscar en gastos o ingresos
  let reg = gastos.find(g => g.id === id) || ingresos.find(i => i.id === id);
  if (!reg) return;
  editandoId = id;

  document.getElementById('edit-fecha').value    = reg.fecha    || hoyISO();
  document.getElementById('edit-concepto').value = reg.concepto || '';
  document.getElementById('edit-monto').value    = reg.monto    || 0;

  const catGrp = document.getElementById('edit-cat-group');
  if (reg.tipo === 'gasto') {
    catGrp.classList.remove('hidden');
    cargarCategorias('edit-categoria');
    document.getElementById('edit-categoria').value = reg.categoria || 'Comida';
  } else {
    catGrp.classList.add('hidden');
  }

  document.getElementById('modal-editar').classList.remove('hidden');
}

function guardarEdicion() {
  const fecha    = document.getElementById('edit-fecha').value || hoyISO();
  const concepto = document.getElementById('edit-concepto').value.trim();
  const monto    = parseFloat(document.getElementById('edit-monto').value);
  const catGrp   = document.getElementById('edit-cat-group');
  const categoria = catGrp.classList.contains('hidden')
    ? null
    : document.getElementById('edit-categoria').value;

  if (!concepto || isNaN(monto) || monto <= 0) return;

  const g = gastos.find(x => x.id === editandoId);
  if (g) { g.fecha = fecha; g.concepto = concepto; g.monto = monto; g.categoria = categoria; }

  const i = ingresos.find(x => x.id === editandoId);
  if (i) { i.fecha = fecha; i.concepto = concepto; i.monto = monto; }

  save();
  cerrarModal('modal-editar');
  actualizarUI();
}

// =============================================
//  MODAL
// =============================================
function cerrarModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// cerrar al click fuera
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

// =============================================
//  SAVE
// =============================================
function save() {
  localStorage.setItem('fp_gastos',   JSON.stringify(gastos));
  localStorage.setItem('fp_ingresos', JSON.stringify(ingresos));
}

// =============================================
//  UI PRINCIPAL
// =============================================
function actualizarUI() {
  const gastosF   = getRegistrosFiltrados(gastos);
  const ingresosF = getRegistrosFiltrados(ingresos);

  const totalGastos   = gastosF.reduce((s, g) => s + g.monto, 0);
  const totalIngresos = ingresosF.reduce((s, i) => s + i.monto, 0);
  const disponible    = presupuesto + totalIngresos - totalGastos;
  const acumulado     = presupuesto + totalIngresos;

  // Tarjetas
  document.getElementById('presupuestoCard').textContent = formatMoney(presupuesto);
  document.getElementById('disponible').textContent      = formatMoney(disponible);
  document.getElementById('gastosTotal').textContent     = formatMoney(totalGastos);
  document.getElementById('ingresosTotal').textContent   = formatMoney(totalIngresos);
  document.getElementById('acumulado').textContent       = formatMoney(acumulado);

  // Último ingreso
  const ultIngreso = ingresos.slice().sort((a,b) => b.id - a.id)[0];
  document.getElementById('ultimoIngreso').textContent =
    ultIngreso ? `Último: ${formatMoney(ultIngreso.monto)}` : 'Sin ingresos';

  // Barra acumulado
  const pctBase  = presupuesto / acumulado * 100;
  const pctExtra = totalIngresos / acumulado * 100;
  document.getElementById('bar-base').style.width  = pctBase + '%';
  document.getElementById('bar-extra').style.width = pctExtra + '%';

  // Progress gasto
  const pct = presupuesto > 0 ? Math.min((totalGastos / presupuesto) * 100, 100) : 0;
  const fill = document.getElementById('progress-fill');
  document.getElementById('progress-pct').textContent = pct.toFixed(1) + '%';
  fill.style.width = pct + '%';
  fill.style.background =
    pct >= 100 ? '#f43f5e' :
    pct >= 80  ? '#ef4444' :
    pct >= 50  ? '#f97316' :
    pct >= 20  ? '#f59e0b' : '#10b981';

  // Alertas
  const banner = document.getElementById('alerta-banner');
  banner.className = 'alerta-banner';
  if (pct >= 100) {
    banner.textContent = '🚨 Presupuesto agotado';
    banner.classList.add('alerta-critico');
    banner.classList.remove('hidden');
  } else if (pct >= 80) {
    banner.textContent = '⚠️ Riesgo: ' + pct.toFixed(0) + '% gastado';
    banner.classList.add('alerta-riesgo');
    banner.classList.remove('hidden');
  } else if (pct >= 50) {
    banner.textContent = '⚡ Advertencia: ' + pct.toFixed(0) + '% gastado';
    banner.classList.add('alerta-advertencia');
    banner.classList.remove('hidden');
  } else if (pct >= 20) {
    banner.textContent = '💡 Ya gastaste el ' + pct.toFixed(0) + '% de tu presupuesto';
    banner.classList.add('alerta-preventiva');
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }

  // Lista movimientos (gastos filtrados)
  renderLista(gastosF);

  // Gráfica
  const categorias = {};
  gastosF.forEach(g => {
    if (!categorias[g.categoria]) categorias[g.categoria] = 0;
    categorias[g.categoria] += g.monto;
  });
  actualizarGrafica(categorias, totalGastos, totalIngresos, disponible);
}

// =============================================
//  RENDER LISTA
// =============================================
function renderLista(gastosF) {
  const lista = document.getElementById('lista');
  const empty = document.getElementById('empty-state');
  lista.innerHTML = '';

  if (gastosF.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // más recientes primero
  const ordenados = [...gastosF].sort((a,b) => b.id - a.id);

  ordenados.forEach(g => {
    const li = document.createElement('li');
    li.className = 'movimiento-item';

    if (modoEliminar) li.classList.add('modo-eliminar');
    if (modoEditar)   li.classList.add('modo-editar');

    li.innerHTML = `
      <span class="mov-fecha">${formatFechaCorta(g.fecha)}</span>
      <span class="mov-concepto">${escHTML(g.concepto)}</span>
      <span class="mov-categoria">${escHTML(g.categoria)}</span>
      <span class="mov-monto gasto">-${formatMoney(g.monto)}</span>
      <span class="mov-actions">
        ${modoEliminar ? '<span class="mov-btn">🗑️</span>' : ''}
        ${modoEditar   ? '<span class="mov-btn">✏️</span>' : ''}
      </span>
    `;

    li.onclick = () => {
      if (modoEliminar) pedirEliminar(g.id, g.concepto);
      else if (modoEditar) abrirEditar(g.id);
    };

    lista.appendChild(li);
  });
}

// =============================================
//  RENDER REGISTROS (historial completo)
// =============================================
function renderRegistros() {
  const lista  = document.getElementById('listaCompleta');
  const buscar = (document.getElementById('buscar').value || '').toLowerCase();
  lista.innerHTML = '';

  const todos = [
    ...gastos.map(g => ({...g, tipo:'gasto'})),
    ...ingresos.map(i => ({...i, tipo:'ingreso'}))
  ].sort((a,b) => b.id - a.id);

  const filtrados = todos.filter(r =>
    r.concepto.toLowerCase().includes(buscar) ||
    (r.categoria || '').toLowerCase().includes(buscar)
  );

  filtrados.forEach(r => {
    const li = document.createElement('li');
    li.className = 'movimiento-item';
    li.innerHTML = `
      <span class="mov-fecha">${formatFechaCorta(r.fecha)}</span>
      <span class="mov-concepto">${escHTML(r.concepto)}</span>
      <span class="mov-categoria">${escHTML(r.categoria || 'Ingreso')}</span>
      <span class="mov-categoria" style="color:${r.tipo==='ingreso'?'var(--green)':'var(--red)'}">
        ${r.tipo === 'ingreso' ? '📈 Ingreso' : '📉 Gasto'}
      </span>
      <span class="mov-monto ${r.tipo}">
        ${r.tipo==='gasto'?'-':'+'} ${formatMoney(r.monto)}
      </span>
    `;
    lista.appendChild(li);
  });
}

// =============================================
//  GRÁFICA
// =============================================
function actualizarGrafica(categorias, totalGastos, totalIngresos, disponible) {
  if (chart) { chart.destroy(); chart = null; }

  let labels, valores, colors, centerVal;

  if (modo === 'capital') {
    labels   = ['Presupuesto base', 'Ingresos extra'];
    valores  = [presupuesto, totalIngresos];
    colors   = ['#6366f1', '#10b981'];
    centerVal = formatMoney(presupuesto + totalIngresos);
  } else if (modo === 'general') {
    const disp = Math.max(disponible, 0);
    labels   = ['Disponible', 'Gastos'];
    valores  = [disp, totalGastos];
    colors   = ['#3b82f6', '#f43f5e'];
    centerVal = formatMoney(disp);
  } else {
    labels  = Object.keys(categorias);
    valores = Object.values(categorias);
    colors  = labels.map((_, i) => COLORS[i % COLORS.length]);
    centerVal = formatMoney(totalGastos);
  }

  // Evitar gráfica vacía
  if (valores.every(v => v === 0)) {
    valores = [1];
    labels  = ['Sin datos'];
    colors  = ['#1e293b'];
    centerVal = '$0';
  }

  chart = new Chart(document.getElementById('grafica'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: colors,
        borderColor: 'transparent',
        borderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: {
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      animation: { animateRotate: true, duration: 500 }
    }
  });

  document.getElementById('center-value').textContent = centerVal;

  // Leyenda
  const cont = document.getElementById('leyenda');
  cont.innerHTML = '';
  labels.forEach((lbl, i) => {
    if (lbl === 'Sin datos') return;
    const item = document.createElement('div');
    item.className = 'leyenda-item';
    const pct = valores.reduce((a,b)=>a+b,0) > 0
      ? ((valores[i] / valores.reduce((a,b)=>a+b,0)) * 100).toFixed(1)
      : '0.0';
    item.innerHTML = `
      <div class="leyenda-dot" style="background:${colors[i]}"></div>
      <div class="leyenda-info">
        <span class="leyenda-label">${escHTML(lbl)}</span>
        <span class="leyenda-value">${formatMoney(valores[i])} · ${pct}%</span>
      </div>
    `;
    cont.appendChild(item);
  });
}

// =============================================
//  UTILS
// =============================================
function formatMoney(n) {
  if (isNaN(n)) return '$0';
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function escHTML(str) {
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'shake 0.3s ease';
  setTimeout(() => el.style.animation = '', 400);
}
