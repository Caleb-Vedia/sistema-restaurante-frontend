// Sirve la prueba React existente y una API HTTP controlada en un puerto libre.
// Ejecutar con Node y abrir el http:// informado; no conecta al backend real.
import { build } from 'esbuild';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const args = process.argv.slice(2);
const headless = args.includes('--run-headless');
const selected = args.includes('--scenario') ? args[args.indexOf('--scenario') + 1] : null;
const directory = args.includes('--report-dir') ? resolve(args[args.indexOf('--report-dir') + 1])
  : await mkdtemp(join(tmpdir(), 'restaurante-caja-evidence-'));
const fixture = 'const selectedScenario = ' + JSON.stringify(selected) + '; const autoRun = ' + headless + ';\n' + String.raw`
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CashierPage from './src/pages/staff/CashierPage.jsx';
import { formatDateTime } from './src/utils/index.js';
import { api } from './src/services/api.js';

const app = document.getElementById('app');
const results = document.getElementById('results');
const log = document.getElementById('log');
let root, client;
const date = '2026-10-28T12:00:00.000Z';
const turn = (id = 31) => ({ idCierre: id, idUsuario: 1,
  abiertoEl: new Date(Date.parse(date) + (id - 31) * 3600000).toISOString(), montoInicialEfectivo: 100 });
const summary = (id) => ({ ...turn(id), cerradoEl: new Date(Date.parse(turn(id).abiertoEl) + 1800000).toISOString(),
  totalEsperado: 100, totalContado: 100, observacionDiferencia: null,
  detalle: [{ idMetodoPago: 1, nombreMetodo: 'Efectivo', montoEsperado: 100, montoContado: 100, diferencia: 0 }] });
async function control(action, data = {}) {
  const response = await fetch('/__control', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }) });
  if (!response.ok) throw new Error('Control HTTP: ' + response.status);
  return response.json();
}
const snapshot = () => control('snapshot');
const setTurn = value => control('turn', { turn: value });
const actualReads = () => performance.getEntriesByType('resource').filter(entry => entry.name.endsWith('/api/caja/actual')).length;
const text = () => app.textContent;
function assert(condition, message) { if (!condition) throw new Error(message); }
function waitFor(label, predicate) {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    async function check() {
      try { if (await predicate()) return resolve(); } catch (e) { return reject(e); }
      if (performance.now() - start > 12000) return reject(new Error('Timeout: ' + label));
      requestAnimationFrame(check);
    }
    check();
  });
}
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
function button(label, scope = app) {
  const matches = [...scope.querySelectorAll('button')].filter(el => el.textContent.trim() === label);
  assert(matches.length === 1, 'Botón ambiguo/ausente: ' + label);
  assert(!matches[0].disabled, 'Botón deshabilitado: ' + label);
  return matches[0];
}
async function click(label, scope) { button(label, scope).click(); await frame(); }
function hasSummary() { return text().includes('Arqueo finalizado'); }
function wizardHeading() { return [...app.querySelectorAll('h2')].find(el => el.textContent === 'Cierre de caja'); }
async function mount({ initialTurn = turn(), actualMode = 'normal', ready = 'Caja abierta' } = {}) {
  root?.unmount(); client?.clear(); await frame();
  await control('reset', { turn: initialTurn, actualMode });
  performance.clearResourceTimings();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  root = createRoot(app);
  root.render(<QueryClientProvider client={client}><CashierPage /></QueryClientProvider>);
  if (ready) await waitFor(ready, () => text().includes(ready));
}
async function beginClose() {
  const previousCalls = (await snapshot()).patchCalls;
  await click('Cerrar caja');
  await waitFor('revisión', () => [...app.querySelectorAll('button')].some(el => el.textContent === 'Continuar al arqueo'));
  const heading = wizardHeading(); assert(heading?.isConnected, 'Wizard no montado');
  await click('Continuar al arqueo');
  const input = app.querySelector('#verificado-1'); assert(input, 'Input de arqueo ausente');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '100');
  input.dispatchEvent(new Event('input', { bubbles: true })); await frame();
  assert(input.value === '100', 'Monto no ingresado');
  await click('Ver conciliación');
  await waitFor('conciliación', () => text().includes('Total verificado'));
  await click('Cerrar caja');
  await waitFor('diálogo final', () => document.querySelector('[role="dialog"]'));
  await click('Cerrar caja', document.querySelector('[role="dialog"]'));
  await waitFor('PATCH HTTP pendiente', async () => (await snapshot()).pending);
  const recorded = await snapshot();
  assert(recorded.patchCalls === previousCalls + 1, 'Solicitudes de cierre duplicadas');
  assert(recorded.body.detalle[0].montoContado === 100, 'Monto del contrato alterado');
  assert(!hasSummary(), 'Éxito anticipado');
  return heading;
}
async function success() {
  await control('finish', { result: summary(31) });
  await waitFor('resumen local', hasSummary);
  assert(text().includes('Total verificado'), 'Resumen incompleto');
  assert((await snapshot()).patchCalls === 1, 'Reintento de cierre');
  assert(text().includes(formatDateTime(turn(31).abiertoEl)), 'Resumen de otro turno');
}
async function scenario(label, run) {
  if (selectedScenario && !label.startsWith(selectedScenario + '.')) return;
  const row = document.createElement('li'); row.textContent = label + ' — EN CURSO'; results.append(row);
  await control('scenario', { label });
  await run(); row.textContent = label + ' — PASS'; row.className = 'pass';
  await control('evidence', { label, dom: app.innerText, result: 'PASS', snapshot: await snapshot() });
}
document.getElementById('run').addEventListener('click', async (event) => {
  event.target.disabled = true; results.replaceChildren(); log.textContent = '';
  try {
    await scenario('S1. Sin turno: HTTP 200 vacío y polling sin duplicaciones', async () => {
      await mount({ initialTurn: null, ready: null });
      await waitFor('resultado de la lectura inicial', () => text().includes('Abrir caja') || text().includes('No se pudo consultar el estado de caja'));
      assert(text().includes('Abrir caja'), 'HTTP 200 vacío muestra error y no ofrece abrir caja');
      assert(!hasSummary(), 'Ausencia de caja convertida en cierre local');
      let state = await snapshot(); assert(state.actualCalls === 1, 'Lectura inicial duplicada');
      assert(state.otherCalls === 0, 'Consultas dependientes sin turno');
      await waitFor('primer polling real', async () => (await snapshot()).actualCalls === 2);
      state = await snapshot();
      assert(state.actualTimes[1] - state.actualTimes[0] >= 3700, 'Intervalo de polling reducido/solicitudes excesivas');
      assert(state.otherCalls === 0 && state.patchCalls === 0, 'Operaciones innecesarias sin turno');
      await mount({ initialTurn: null, actualMode: 'json-null', ready: 'Abrir caja' });
      assert((await snapshot()).actualCalls === 1, 'JSON null duplicó la lectura');
    });
    await scenario('S0. Turno abierto con JSON válido', async () => {
      await mount(); assert(text().includes('Cerrar caja') && !hasSummary(), 'Turno válido no operativo');
      assert((await snapshot()).actualCalls === 1, 'Consulta de turno duplicada');
    });
    await scenario('A. PATCH antes del polling', async () => {
      await mount(); await beginClose(); await success(); await setTurn(null);
      assert((await snapshot()).readsAfterCommit.every(read => read.patchResolved), 'Orden A no reproducido');
      await click('Finalizar'); await waitFor('volver sin resumen', () => text().includes('Abrir caja'));
      assert(!hasSummary(), 'Finalizar no descarta el resumen');
    });
    await scenario('B. Polling antes del PATCH; wizard desmontado', async () => {
      await mount(); const heading = await beginClose(); await setTurn(null);
      await waitFor('polling cierra vista', () => text().includes('Abrir caja'));
      assert(!heading.isConnected, 'El wizard no se desmontó realmente');
      const recorded = await snapshot();
      assert(!recorded.patchResolved && !hasSummary(), 'Resumen antes del PATCH');
      assert(recorded.readsAfterCommit.some(read => !read.patchResolved), 'No se adelantó el polling');
      await success();
      const reads = actualReads();
      await waitFor('otro polling con resumen visible', () => actualReads() > reads);
      assert(hasSummary(), 'El resumen no permaneció visible tras el polling');
    });
    await scenario('C. Cierre externo sin confirmación local falsa', async () => {
      await mount(); await click('Cerrar caja'); await waitFor('wizard externo', wizardHeading);
      await setTurn(null); await waitFor('cierre externo', () => text().includes('Abrir caja'));
      assert((await snapshot()).patchCalls === 0 && !hasSummary(), 'Confirmación local falsa');
    });
    await scenario('D. PATCH rechazado/fallido (409 y 500)', async () => {
      for (const status of [409, 500]) {
        await mount(); const heading = await beginClose();
        const message = 'Cierre rechazado ' + status;
        await control('finish', { status, message });
        await waitFor('error visible', () => text().includes(message));
        assert(!hasSummary() && heading.isConnected, 'Fallo convertido en éxito/desmontaje');
        const recorded = await snapshot();
        assert(recorded.previewCalls === 2 && recorded.patchCalls === 1, 'Tratamiento de error/reintentos alterado');
        await click('Corregir arqueo');
        assert(app.querySelector('#verificado-1')?.value === '100', 'Se perdieron los importes');
      }
    });
    await scenario('E. Nuevo turno sin resumen heredado, incluso con respuesta vieja tardía', async () => {
      await mount(); await beginClose(); await setTurn(null); await success();
      await setTurn(turn(32));
      await waitFor('nuevo turno', () => text().includes('Caja abierta') && !hasSummary());
      await setTurn(null); await waitFor('nuevo turno cerrado externamente', () => text().includes('Abrir caja'));
      assert(!hasSummary(), 'Resurgió el resumen anterior');
      await mount(); const heading = await beginClose(); await setTurn(null);
      await waitFor('desmontaje previo a nuevo turno', () => !heading.isConnected);
      await setTurn(turn(32)); await waitFor('nuevo turno previo al PATCH viejo', () => text().includes('Caja abierta'));
      await control('finish', { result: summary(31) }); await frame(); await frame();
      assert(!hasSummary(), 'Respuesta vieja contaminó el turno nuevo');
      await beginClose(); await setTurn(null); await control('finish', { result: summary(32) });
      await waitFor('resumen del turno correcto', hasSummary);
      assert((await snapshot()).patchCalls === 2, 'Más de un PATCH por cierre');
      assert(text().includes(formatDateTime(turn(32).abiertoEl)), 'Resumen no pertenece al turno 32');
      assert(!text().includes(formatDateTime(turn(31).abiertoEl)), 'Resumen anterior visible');
    });
    await scenario('S2. Errores HTTP 500 y red mantienen estado de error', async () => {
      for (const mode of ['500', '500-empty', 'network']) {
        await mount({ initialTurn: null, actualMode: mode, ready: 'No se pudo consultar el estado de caja' });
        assert(!text().includes('Abrir caja') && !hasSummary(), 'Error interpretado como ausencia/éxito');
        const error = client.getQueryState(['caja','actual']).error;
        assert(mode === 'network' ? error.status === undefined : error.status === 500, 'Se perdió la identidad del error');
        assert((await snapshot()).actualCalls === 1, 'Reintento inmediato/consulta duplicada');
      }
    });
    await scenario('S3. JSON ilegible se rechaza y otros endpoints siguen estrictos', async () => {
      for (const mode of ['malformed', 'truncated', 'whitespace', 'bom-only', 'empty201']) {
        await mount({ initialTurn: null, actualMode: mode, ready: 'No se pudo consultar el estado de caja' });
        const error = client.getQueryState(['caja','actual']).error;
        assert(error?.code === 'INVALID_RESPONSE_BODY' && error.status === undefined, 'JSON ilegible aceptado como ausencia');
        assert(!text().includes('Abrir caja') && !hasSummary(), 'Error convertido en éxito');
      }
      for (const invoke of [() => api.get('/strict-empty'), () => api.post('/caja/actual', {})]) {
        let error; try { await invoke(); } catch (e) { error = e; }
        assert(error?.code === 'INVALID_RESPONSE_BODY', 'Excepción de caja aplicada globalmente o a otro método');
      }
    });
    log.textContent = 'PASS. React y wizard reales montados; HTTP simulado; polling real de 4000 ms. Sin backend ni cambios de red.';
    document.title = 'PASS — Cierre de Caja A–E';
    await control('report', { result: 'PASS', rows: [...results.children].map(row => row.textContent) });
  } catch (error) {
    log.textContent = 'FAIL: ' + error.message; console.error(error); document.title = 'FAIL — Cierre de Caja';
    await control('report', { result: 'FAIL', error: error.message, dom: app.innerText });
  } finally { event.target.disabled = false; }
});
if (autoRun) window.addEventListener('DOMContentLoaded', () => document.getElementById('run').click());
`;
const bundle = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', minify: true, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
});
await mkdir(directory, { recursive: true });
const html = '<!doctype html><meta charset="utf-8"><title>Cierre de Caja A–E</title><style>body{font:14px system-ui;margin:24px}button{margin:6px;padding:6px}#results{line-height:1.8}.pass{color:green}#log{white-space:pre-wrap}#app{border-top:1px solid #ccc;padding-top:16px}svg{width:18px;height:18px}</style><h1>Prueba focalizada — cierre de Caja</h1><button id="run">Ejecutar pruebas</button><ol id="results"></ol><pre id="log"></pre><div id="app"></div><script>' + bundle.outputFiles[0].text.replaceAll('</script', '<\\/script') + '</script>' + (headless ? '<script async src="/__hold.js"></script>' : '');
let state, pending;
let scenario = '';
const requests = [], evidence = [];
let report;
const holds = [];
function reset(turn, actualMode = 'normal') {
  if (pending) throw new Error('No resetear con un PATCH sin resolver');
  state = { turn, actualMode, actualCalls: 0, actualTimes: [], otherCalls: 0, patchCalls: 0, patchResolved: false, previewCalls: 0, readsAfterCommit: [], body: null };
}
reset(null);
const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Connection': 'close' }); res.end(JSON.stringify(data)); };
const context = () => ({ ...state.turn, generadoEl: new Date().toISOString(), totalEsperado: 100, totalContado: null,
  diferenciaTotal: null, observacionDiferencia: null, puedeCerrar: true, sesiones: [],
  resumenSesiones: { activasSinSaldo: 0, ocupadasConSaldo: 0, cuentaSolicitadaConSaldo: 0 },
  detalle: [{ idMetodoPago: 1, nombreMetodo: 'Efectivo', montoEsperado: 100, montoContado: null, diferencia: null }] });
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/__hold.js') { holds.push(res); return; }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'" });
      return res.end(html);
    }
    if (req.url === '/__control' && req.method === 'POST') {
      switch (body.action) {
        case 'reset': reset(body.turn, body.actualMode); break;
        case 'turn': state.turn = body.turn; break;
        case 'scenario': scenario = body.label; break;
        case 'snapshot': break;
        case 'finish': {
          if (!pending) throw new Error('No hay PATCH pendiente');
          const target = pending; pending = null; state.patchResolved = true;
          json(target, body.status ? { message: body.message, statusCode: body.status } : body.result, body.status ?? 200); break;
        }
        case 'evidence': evidence.push(body); break;
        case 'report':
          report = { ...body, evidence, requests };
          await writeFile(join(directory, 'last-run.json'), JSON.stringify(report, null, 2));
          console.log(JSON.stringify({ report: body.result, error: body.error, evidence: evidence.length, path: join(directory, 'last-run.json') })); break;
        default: return json(res, { message: 'Control desconocido' }, 501);
      }
      return json(res, { ...state, pending: Boolean(pending) });
    }
    requests.push({ scenario, method: req.method, path: req.url, turn: state.turn?.idCierre ?? null, patchResolved: state.patchResolved, at: new Date().toISOString() });
    if (req.url !== '/api/caja/actual') state.otherCalls++;
    if (req.url === '/api/strict-empty' || (req.url === '/api/caja/actual' && req.method === 'POST')) { res.writeHead(200, {'Connection':'close'}); res.end(); return; }
    if (req.method === 'GET') {
      switch (req.url) {
        case '/api/caja/actual': {
          state.actualCalls++; state.actualTimes.push(Date.now());
          if (state.actualMode === 'network') { req.socket.destroy(); return; }
          if (state.actualMode === '500') return json(res, {message:'Error de prueba'}, 500);
          if (state.actualMode === '500-empty') {res.writeHead(500, {'Connection':'close'});res.end();return;}
          if (state.actualMode === 'malformed') {res.writeHead(200, {'Content-Type':'application/json','Connection':'close'});res.end('{"idCierre":');return;}
          if (state.actualMode === 'truncated') {res.writeHead(200, {'Content-Type':'application/json','Content-Length':'200','Connection':'close'});res.write('{"idCierre":');res.socket.end();return;}
          if (state.actualMode === 'whitespace') {res.writeHead(200, {'Content-Type':'application/json','Connection':'close'});res.end('  ');return;}
          if (state.actualMode === 'bom-only') {res.writeHead(200, {'Content-Type':'application/json','Connection':'close'});res.end(Buffer.from([0xef,0xbb,0xbf]));return;}
          if (state.actualMode === 'empty201') {res.writeHead(201, {'Connection':'close'});res.end();return;}
          if (!state.turn) {
            state.readsAfterCommit.push({ patchResolved: state.patchResolved });
            if (state.actualMode !== 'json-null') {res.writeHead(200, {'Connection':'close'});res.end();return;}
          }
          return json(res, state.turn);
        }
        case '/api/mesas': return json(res, []);
        case '/api/metodos-pago': return json(res, [{ idMetodoPago: 1, nombreMetodo: 'Efectivo', codigo: 'efectivo', activo: true }]);
        case '/api/caja/actividad': return state.turn ? json(res, { ...state.turn, totalIngresosTurno: 0, sesiones: [] }) : json(res, { message: 'Sin turno' }, 409);
        case '/api/caja/cierre/contexto': return state.turn ? json(res, context()) : json(res, { message: 'Sin turno' }, 409);
      }
    }
    if (req.method === 'POST' && req.url === '/api/caja/cierre/preview') {
      state.previewCalls++; const counted = body.detalle?.[0]?.montoContado ?? null;
      return json(res, { ...context(), totalContado: counted, diferenciaTotal: counted == null ? null : counted - 100,
        detalle: context().detalle.map(row => ({ ...row, montoContado: counted, diferencia: counted == null ? null : counted - 100 })) });
    }
    if (req.method === 'PATCH' && req.url === '/api/caja/cerrar') {
      state.patchCalls++; state.body = body; state.patchResolved = false;
      if (pending) return json(res, { message: 'PATCH duplicado' }, 409);
      pending = res; return;
    }
    return json(res, { message: 'Ruta de prueba no implementada' }, 501);
  } catch (error) { json(res, { message: error.message }, 500); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = 'http://127.0.0.1:' + server.address().port;
console.log(origin);
if (headless) {
  let child, profile;
  try {
    let executable;
    for (const candidate of ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe']) {
      try {await access(candidate);executable=candidate;break;} catch { /* Solo instalaciones existentes. */ }
    }
    if (!executable) throw new Error('NOT RUN: Edge headless no disponible');
    profile = await mkdtemp(join(tmpdir(),'restaurante-caja-close-profile-'));
    child = spawn(executable,['--headless=new','--no-first-run','--no-default-browser-check','--user-data-dir='+join(profile,'browser'),'--dump-dom',origin],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    child.stdout.resume();let diagnostic='';child.stderr.on('data',value=>{diagnostic+=value;});
    const deadline=Date.now()+150000;
    while (!report && child.exitCode===null && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,250));
    if (!report) {report={result:'NOT RUN',evidence,diagnostic:diagnostic.slice(-2000)};await writeFile(join(directory,'last-run.json'),JSON.stringify(report,null,2));}
    console.log(JSON.stringify({result:report.result,scenarios:evidence.length,path:join(directory,'last-run.json')}));
    process.exitCode=report.result==='PASS'?0:1;
  } finally {
    for (const response of holds) {response.writeHead(200,{'Content-Type':'text/javascript'});response.end('');}
    if (child && child.exitCode===null) {await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,1500))]);if(child.exitCode===null)child.kill();}
    pending?.end();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    if(profile){const target=resolve(profile),parent=resolve(tmpdir());if(dirname(target)!==parent||!target.startsWith(join(parent,'restaurante-caja-close-profile-')))throw Error('Ruta temporal insegura');await rm(target,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
  }
}
process.on('SIGINT', () => { pending?.end(); server.close(() => process.exit(0)); server.closeAllConnections(); });
