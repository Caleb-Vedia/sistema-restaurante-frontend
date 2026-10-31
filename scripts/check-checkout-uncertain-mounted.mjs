// React y HTTP reales, API de prueba aislada. No conecta a NestJS ni a PostgreSQL.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const selected = args.includes('--scenario') ? args[args.indexOf('--scenario') + 1] : null;
const output = args.includes('--report-dir') ? resolve(args[args.indexOf('--report-dir') + 1]) : null;
const fixture = 'const selectedScenario = ' + JSON.stringify(selected) + ';\n' + String.raw`
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { queryClient } from './src/services/queryClient.js';
import { api } from './src/services/api.js';
import cart from './src/store/useCarrito.js';
import { readAmbiguousMarker, readClientOrders, readPendingAttempt } from './src/utils/clientOrderStorage.js';
import CartPage from './src/pages/client/CartPage.jsx';
import MyOrdersPage from './src/pages/client/MyOrdersPage.jsx';

const app = document.getElementById('app');
let token = 'mock-checkout-session';
let root, router, postCalls = 0;
const errors = [], responses = [];
const originalFetch = window.fetch;
window.fetch = (url, ...options) => {
  if (url === '/api/pedidos') postCalls++;
  return originalFetch(url, ...options).then(response => {
    if (url === '/api/pedidos') responses.push(response.status);
    return response;
  });
};
window.addEventListener('error', e => errors.push(e.message));
window.addEventListener('unhandledrejection', e => { errors.push(String(e.reason)); e.preventDefault(); });
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const text = () => app.innerText;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function control(action, body = {}) {
  return fetch('/__control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) }).then(r => r.json());
}
async function wait(label, predicate) {
  const start = Date.now();
  while (!await predicate()) { if (Date.now() - start > 12000) throw new Error('Timeout: ' + label); await frame(); }
}
const button = label => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label);
async function click(label) { const b = button(label); assert(b && !b.disabled, 'Botón ausente/deshabilitado: ' + label); b.click(); await frame(); }
async function unmount() { root?.unmount(); router?.dispose(); queryClient.clear(); await frame(); }
async function mount() {
  await unmount();
  router = createMemoryRouter([{element: <Outlet context={{ tableId: '5', session: {token, estado: 'ocupada', nombreMesa: 'TEST'} }}/>, children: [
    {path:'/menu/5/cart', element:<CartPage/>}, {path:'/menu/5/orders', element:<MyOrdersPage/>}
  ]}], {initialEntries:['/menu/5/cart']});
  root = createRoot(app);
  root.render(<QueryClientProvider client={queryClient}><RouterProvider router={router}/></QueryClientProvider>);
  await wait('carrito montado', () => text().includes('Carrito'));
}
async function setup(mode, mixed = true, invalid = null) {
  await unmount(); sessionStorage.clear(); localStorage.clear(); errors.length = 0; responses.length = 0; postCalls = 0;
  await control('reset', { mode, invalid });
  cart.getState().sincronizarSesion(5, token); cart.getState().vaciarCarrito();
  const kitchen = {id:1, nombre:'Cocina TEST', precio:12.5, idAreaProducto:1, ingredientes:[]};
  cart.getState().agregarItem(kitchen);
  cart.getState().agregarItem(kitchen, {ingredientesQuitados:[{id:1,nombre:'cebolla'}], otraIndicacion:'salsa aparte'});
  if (mixed) cart.getState().agregarItem({id:2, nombre:'Bebida TEST', precio:5, idAreaProducto:2, ingredientes:[]});
  await mount();
  await wait('enviar habilitado', () => button('Enviar pedido') && !button('Enviar pedido').disabled);
}
async function uncertain(expectedPosts, expectedLines) {
  await wait('resultado incierto', () => text().includes('No se pudo confirmar el resultado del último envío.') || text().includes('Unexpected Application Error!'));
  assert(!text().includes('Unexpected Application Error!'), 'F-01: error de React por confirmación inválida');
  assert(text().includes('No se pudo confirmar el resultado del último envío.'), 'Falta aviso incierto');
  assert(button('Enviar pedido')?.disabled, 'Permite reenvío inseguro');
  assert(cart.getState().items.length === expectedLines, 'Retiró productos no confirmados');
  assert(postCalls === expectedPosts, 'Siguió enviando o reintentó');
  assert(readAmbiguousMarker(5, token), 'No persistió el bloqueo');
  assert(errors.length === 0, 'Errores JavaScript: ' + errors.join(';'));
}
async function scenario(label, run) {
  if (selectedScenario && !label.startsWith(selectedScenario + '.')) return;
  await control('scenario', {label});
  try { await run(); assert(errors.length === 0, 'Errores JavaScript: ' + errors.join(';')); await control('evidence', {label, result:'PASS', dom:text(), postCalls, responses:[...responses], errors:[...errors]}); }
  catch (error) { await control('evidence', {label, result:'FAIL', error:error.message, dom:text(), postCalls, responses:[...responses], errors:[...errors]}); }
}
async function run() {
  // F5 real: rehidratar el store existente, sin resetear API, carrito ni intento.
  const resumedKey = sessionStorage.getItem('fixture-reload-key');
  if (resumedKey) {
    sessionStorage.removeItem('fixture-reload-key');
    await scenario('R. Recarga real conserva clave; recuperación y nueva intención', async () => {
      cart.getState().sincronizarSesion(5,token); await mount();
      assert(readPendingAttempt(5,token)?.claveIdempotencia === resumedKey, 'Recarga perdió identidad');
      assert(button('Enviar pedido').disabled && postCalls === 0, 'Recarga reenvía automáticamente');
      await click('Ya consulté al personal'); await wait('recuperación por clave', () => !readPendingAttempt(5,token));
      assert(cart.getState().items.length === 1 && cart.getState().items[0].idProducto === 2, 'No reconcilió solo el área confirmada');
      assert(postCalls === 0, 'Consultar crea pedido nuevo');
      await control('mode',{mode:'valid'}); await click('Enviar pedido');
      await wait('bebida confirmada', () => cart.getState().items.length === 0);
      cart.getState().agregarItem({id:1,nombre:'Cocina TEST',precio:12.5,idAreaProducto:1,ingredientes:[]});
      cart.getState().agregarItem({id:1,nombre:'Cocina TEST',precio:12.5,idAreaProducto:1,ingredientes:[]},{ingredientesQuitados:[{id:1,nombre:'cebolla'}],otraIndicacion:'salsa aparte'});
      await wait('nuevo envío habilitado', () => button('Enviar pedido') && !button('Enviar pedido').disabled); await click('Enviar pedido');
      await wait('nueva intención confirmada', () => cart.getState().items.length === 0);
      const state=await control('snapshot');
      assert(state.posts.length === 3 && state.persisted.length === 3, 'Recuperación duplicó o bloqueó intención legítima');
      assert(state.posts[0].claveIdempotencia === resumedKey && new Set(state.posts.map(p=>p.claveIdempotencia)).size === 3, 'Nueva intención reutilizó identidad');
      assert(JSON.stringify(state.posts[0].items) === JSON.stringify(state.posts[2].items), 'No comprobó contenido idéntico');
    });
    await control('report'); return;
  }
  await scenario('A. 201 válido, variantes y doble envío', async () => {
    await setup('valid'); const send = button('Enviar pedido'); send.click(); send.click();
    await wait('confirmaciones', () => text().includes('Se registraron 2 pedidos'));
    const snapshot = await control('snapshot');
    assert(postCalls === 2 && snapshot.posts.length === 2 && cart.getState().items.length === 0, 'Duplicación o retiro incorrecto');
    assert(snapshot.posts[0].items.length === 2 && snapshot.posts[0].items[1].observacion === 'Sin: cebolla\nNota: salsa aparte', 'Perdió variantes');
    assert(snapshot.posts[0].claveIdempotencia && snapshot.posts[1].claveIdempotencia && snapshot.posts[0].claveIdempotencia !== snapshot.posts[1].claveIdempotencia, 'Áreas sin claves independientes');
    assert(readClientOrders(5, token).orders.length === 2 && !readAmbiguousMarker(5, token), 'Persistencia de confirmación incorrecta');
  });
  await scenario('B. 201 con JSON truncado y bloqueo persistente', async () => {
    await setup('truncated', false); await click('Enviar pedido'); await uncertain(1, 2);
    assert(!text().includes('Pedido enviado correctamente.') && !text().includes('Pedido #') && readClientOrders(5, token).orders.length === 0, 'Confirmación falsa');
    await mount(); await uncertain(1, 2);
  });
  await scenario('C. Cocina incierta detiene Bebidas; consulta y recuperación sin duplicar', async () => {
    await setup('truncated'); await click('Enviar pedido'); await uncertain(1, 3);
    const link = [...app.querySelectorAll('a')].find(a => a.getAttribute('href') === '/menu/5/orders');
    assert(link, 'No permite consultar pedidos registrados'); link.click();
    await wait('pedido recuperado por consulta', () => text().includes('Pedido #1'));
    assert(postCalls === 1 && readAmbiguousMarker(5, token), 'Consulta reenvía o desbloquea sin reconocer');
    await router.navigate('/menu/5/cart'); await wait('regreso al carrito', () => button('Enviar pedido'));
    assert(button('Enviar pedido').disabled, 'Volver de consulta elimina bloqueo');
    // Tras verificar ambas variantes en el pedido registrado, el usuario las retira.
    for (let i = 0; i < 2; i++) { const el = document.querySelector('[aria-label="Eliminar producto"]'); assert(el, 'Eliminar línea ausente'); el.click(); await frame(); }
    await click('Ya consulté al personal'); await wait('intento recuperado', () => !readAmbiguousMarker(5,token));
    await control('mode', {mode:'valid'}); await wait('envío habilitado', () => !button('Enviar pedido').disabled); await click('Enviar pedido');
    await wait('bebida enviada', () => cart.getState().items.length === 0);
    const state = await control('snapshot');
    assert(postCalls === 2 && state.posts.length === 2 && state.posts[1].items[0].idProducto === 2, 'Recuperación duplicó cocina');
    assert(state.persisted.length === 2, 'Se duplicó un pedido');
  });
  await scenario('D. Cocina confirmada y Bebidas incierta', async () => {
    await setup('second-truncated'); await click('Enviar pedido'); await uncertain(2, 1);
    assert(cart.getState().items[0].idAreaProducto === 2, 'Retiro incorrecto por área');
    assert(text().includes('Parte del pedido fue enviada.') && text().includes('Pedido #1 registrado'), 'Perdió confirmación previa');
    assert(readClientOrders(5, token).orders.length === 1, 'Guardó una confirmación inválida');
  });
  await scenario('E. JSON válido sin contrato de confirmación', async () => {
    const good = {idPedido:1,nroOrden:1,nombreComensal:null,estado:'pendiente',creadoEl:'2026-10-30T12:00:00.000Z',detalles:[{idDetalle:1,idProducto:1,nombreProducto:'TEST',cantidad:1,precioActual:12.5,observacion:null}]};
    const invalid = [null, {}, [], 'ok', {...good, detalles:[]}, {...good, detalles:[null]}, {...good,idPedido:'1'}, {...good,detalles:[{...good.detalles[0],precioActual:'12.5'}]}];
    for (const key of Object.keys(good)) { const missing = {...good}; delete missing[key]; invalid.push(missing); }
    for (const key of Object.keys(good.detalles[0])) { const missing = {...good.detalles[0]}; delete missing[key]; invalid.push({...good,detalles:[missing]}); }
    for (const value of invalid) { await setup('invalid', true, value); await click('Enviar pedido'); await uncertain(1, 3); assert(readClientOrders(5, token).orders.length === 0, 'Guardó JSON incompleto'); }
  });
  await scenario('F. HTTP 400/409 conserva rechazos conocidos', async () => {
    for (const status of [400,409]) {
      await setup(String(status)); await click('Enviar pedido'); await wait('rechazo', () => text().includes('Rechazo TEST ' + status));
      assert(cart.getState().items.length === 3 && !readAmbiguousMarker(5,token), 'Rechazo confundido con incierto');
      assert(!button('Enviar pedido').disabled && postCalls === 1, 'Reintento o bloqueo indebido');
    }
  });
  await scenario('G. Pérdida de conexión sin reintentos de aplicación', async () => {
    await setup('network'); await click('Enviar pedido'); await uncertain(1, 3);
    const before = postCalls; await frame(); await frame(); assert(postCalls === before, 'Reintentó automáticamente');
  });
  await scenario('H. 204 vacío, null válido y errores HTTP diferenciados', async () => {
    assert(await api.delete('/test-empty') === null, '204 dejó de ser válido');
    assert(await api.get('/test-null') === null, 'JSON null legítimo rechazado');
    let error;
    try { await api.get('/test-empty-success'); } catch (e) { error = e; }
    assert(error?.code === 'INVALID_RESPONSE_BODY' && error.httpStatus === 201 && error.status === undefined, 'Error de interpretación no identificable/incierto');
    error = null; try { await api.get('/test-http-error'); } catch (e) { error = e; }
    assert(error?.status === 400 && error.code !== 'INVALID_RESPONSE_BODY', 'Se perdió el error HTTP original');
  });
  await scenario('I. Consulta sin resultado y reenvío explícito conserva la misma clave', async () => {
    await setup('not-received',false); await click('Enviar pedido'); await uncertain(1,2);
    const original=readPendingAttempt(5,token);
    await click('Ya consulté al personal'); await wait('reintento explícito disponible', () => button('Reintentar mismo intento'));
    assert(postCalls===1 && readPendingAttempt(5,token).claveIdempotencia===original.claveIdempotencia, 'Consulta cambia clave o envía');
    await control('mode',{mode:'valid'}); await click('Reintentar mismo intento');
    await wait('confirmación del mismo intento', () => cart.getState().items.length===0);
    const state=await control('snapshot');
    assert(state.posts.length===2 && state.posts.every(p=>p.claveIdempotencia===original.claveIdempotencia) && state.persisted.length===1, 'Reenvío cambió identidad o duplicó');
  });
  await scenario('J. Sin persistencia no se envía una operación sin identidad recuperable', async () => {
    await setup('valid',false);
    const original=Storage.prototype.setItem;
    try {
      Storage.prototype.setItem=function(key,...rest) { if(key.startsWith('restaurant-client-orders:')) throw new Error('Quota TEST'); return original.call(this,key,...rest); };
      await click('Enviar pedido'); await wait('error local', () => text().includes('No se envió el pedido:'));
      assert(postCalls===0 && cart.getState().items.length===2 && !readAmbiguousMarker(5,token), 'Envió sin persistir o reportó resultado incierto falso');
    } finally { Storage.prototype.setItem=original; }
  });
  await scenario('K. Otro token sobre la misma mesa no hereda el intento anterior', async () => {
    await setup('truncated',false); await click('Enviar pedido'); await uncertain(1,2);
    const previous=readPendingAttempt(5,token).claveIdempotencia;
    token='mock-next-visit'; cart.getState().sincronizarSesion(5,token); await mount();
    assert(!readPendingAttempt(5,token) && !readAmbiguousMarker(5,token), 'Heredó identidad anterior');
    cart.getState().agregarItem({id:1,nombre:'Cocina TEST',precio:12.5,idAreaProducto:1,ingredientes:[]});
    await control('mode',{mode:'valid'}); await wait('envío nueva visita', () => button('Enviar pedido') && !button('Enviar pedido').disabled); await click('Enviar pedido');
    await wait('nueva visita confirmada', () => cart.getState().items.length===0);
    const state=await control('snapshot'); assert(state.posts[1].claveIdempotencia!==previous,'Reutilizó clave de otra visita');
    token='mock-checkout-session';
  });
  await scenario('L. Carrito editado no pierde cantidades al recuperar', async () => {
    await setup('truncated',false); await click('Enviar pedido'); await uncertain(1,2);
    cart.getState().incrementarCantidad(cart.getState().items[0].lineKey);
    await click('Ya consulté al personal'); await wait('aviso de líneas modificadas', () => text().includes('cuya cantidad cambiaste'));
    assert(cart.getState().items[0].cantidad===2 && readPendingAttempt(5,token) && postCalls===1, 'Retiró cantidades editadas o creó otro pedido');
  });
  await scenario('M. Respuesta tardía tras remonte y recuperación no afecta el siguiente intento', async () => {
    await setup('held',false); await click('Enviar pedido');
    await wait('primer pedido persistido con respuesta retenida', async () => (await control('snapshot')).persisted.length===1);
    const original=readPendingAttempt(5,token).claveIdempotencia;
    await mount(); await click('Ya consulté al personal');
    await wait('recuperado mientras POST original sigue pendiente', () => !readPendingAttempt(5,token));
    cart.getState().agregarItem({id:1,nombre:'Cocina TEST',precio:12.5,idAreaProducto:1,ingredientes:[]});
    await wait('nuevo intento habilitado', () => button('Enviar pedido') && !button('Enviar pedido').disabled); await click('Enviar pedido');
    await wait('segundo intento persistido', async () => (await control('snapshot')).persisted.length===2);
    assert(readPendingAttempt(5,token).claveIdempotencia!==original,'Reutilizó clave tras recuperar');
    await control('release'); await wait('ambas respuestas recibidas', () => responses.length===2);
    await wait('nuevo intento confirmado', () => cart.getState().items.length===0 && !readPendingAttempt(5,token));
    await frame(); assert(!readAmbiguousMarker(5,token) && !text().includes('No se pudo confirmar el resultado'), 'Respuesta tardía contaminó el nuevo intento');
  });
  await scenario('N. Conflicto de idempotencia conserva identidad y bloqueo', async () => {
    await setup('key-conflict',false); await click('Enviar pedido'); await uncertain(1,2);
    assert(readPendingAttempt(5,token)?.claveIdempotencia, 'El 409 de idempotencia descartó la clave');
  });
  await scenario('O. Fallo de guardado posterior al commit conserva la identidad', async () => {
    await setup('valid',false);
    const original=Storage.prototype.setItem; let writes=0;
    try {
      Storage.prototype.setItem=function(key,...rest) { if(key.startsWith('restaurant-client-orders:') && ++writes>1) throw new Error('Quota después del POST'); return original.call(this,key,...rest); };
      await click('Enviar pedido'); await uncertain(1,2);
      assert(readPendingAttempt(5,token),'Perdió clave tras fallar la confirmación local');
    } finally {Storage.prototype.setItem=original;}
    await click('Ya consulté al personal'); await wait('confirmación recuperada', () => !readPendingAttempt(5,token));
    assert(postCalls===1 && cart.getState().items.length===0,'Recuperación de storage duplicó o perdió líneas');
  });
  await scenario('P. UUID v4 mediante getRandomValues sin randomUUID', async () => {
    await setup('valid',false); const original=crypto.randomUUID;
    try {
      crypto.randomUUID=undefined; await click('Enviar pedido'); await wait('confirmado con UUID alternativo', () => cart.getState().items.length===0);
      const state=await control('snapshot'); assert(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(state.posts[0].claveIdempotencia), 'UUID v4 inválido');
    } finally {crypto.randomUUID=original;}
  });
  if (!selectedScenario || selectedScenario==='R') {
    await control('scenario',{label:'R. Recarga real conserva clave; recuperación y nueva intención'});
    await setup('truncated'); await click('Enviar pedido'); await uncertain(1,3);
    sessionStorage.setItem('fixture-reload-key',readPendingAttempt(5,token).claveIdempotencia);
    location.reload(); await new Promise(()=>{});
  }
  await control('report');
}
window.addEventListener('DOMContentLoaded', run);
`;
const bundle = await build({stdin:{contents:fixture,loader:'jsx',resolveDir:process.cwd()},bundle:true,write:false,jsx:'automatic',format:'iife',platform:'browser',minify:true,define:{'import.meta.env':'{}','process.env.NODE_ENV':'"development"'}});
const menu = [{id:1,nombre:'TEST',productos:[{id:1,nombre:'Cocina TEST',precio:12.5,idAreaProducto:1,ingredientes:[]},{id:2,nombre:'Bebida TEST',precio:5,idAreaProducto:2,ingredientes:[]}]}];
const rows = [], requests = []; let state, label = '', report, holds = [], delayed = [];
function reset(mode, invalid) { state = {mode,invalid,posts:[],persisted:[]}; }
reset('valid');
const json = (res, data, status = 200) => { res.writeHead(status, {'Content-Type':'application/json','Connection':'close'}); res.end(JSON.stringify(data)); };
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/hold.js') { holds.push(res); return; }
    if (req.url === '/') { res.writeHead(200, {'Content-Type':'text/html'}); res.end('<!doctype html><meta charset="utf-8"><title>Checkout F-01</title><div id="app"></div><script src="/fixture.js"></script><script async src="/hold.js"></script>'); return; }
    if (req.url === '/fixture.js') { res.writeHead(200, {'Content-Type':'text/javascript'}); res.end(bundle.outputFiles[0].text); return; }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    if (req.url === '/__control') {
      if (body.action === 'reset') reset(body.mode, body.invalid);
      if (body.action === 'mode') state.mode = body.mode;
      if (body.action === 'release') {for (const [response,order] of delayed) json(response,order,201); delayed=[];}
      if (body.action === 'scenario') label = body.label;
      if (body.action === 'evidence') { rows.push({...body,requests:requests.filter(r => r.scenario === label)}); console.log(body.result + ' ' + body.label + (body.error ? ': ' + body.error : '')); }
      if (body.action === 'report') report = {result:rows.length > 0 && rows.every(r => r.result === 'PASS') ? 'PASS' : 'FAIL', rows, requests};
      return json(res, state);
    }
    const request = {scenario:label,method:req.method,path:req.url,body,tableToken:Boolean(req.headers['x-table-token'])};
    requests.push(request); res.on('close', () => {request.status = res.headersSent ? res.statusCode : null; request.complete = res.writableFinished;});
    if (req.url === '/api/menu') return json(res, menu);
    if (req.url === '/api/pedidos/mis-pedidos') return json(res, state.persisted);
    if (req.url === '/api/pedidos' && req.method === 'POST') {
      state.posts.push(body);
      if (['400','409'].includes(state.mode)) return json(res, {message:'Rechazo TEST ' + state.mode}, Number(state.mode));
      if (state.mode === 'key-conflict') return json(res,{message:'Conflicto TEST',code:'IDEMPOTENCY_CONTENT_MISMATCH'},409);
      if (state.mode === 'not-received') { req.socket.destroy(); return; }
      const existing = state.persisted.find(order => order.claveIdempotencia === body.claveIdempotencia);
      if (existing) return json(res, existing, 201);
      const order = {claveIdempotencia:body.claveIdempotencia,idPedido:1000+state.persisted.length+1,nroOrden:state.persisted.length+1,nombreComensal:body.nombreComensal??null,estado:'pendiente',creadoEl:new Date().toISOString(),detalles:body.items.map((item,index)=>({idDetalle:state.persisted.length*10+index+1,idProducto:item.idProducto,nombreProducto:item.idProducto===1?'Cocina TEST':'Bebida TEST',cantidad:item.cantidad,precioActual:item.idProducto===1?12.5:5,observacion:item.observacion??null}))};
      state.persisted.push(order);
      if (state.mode === 'held') {delayed.push([res,order]); return;}
      if (state.mode === 'network') { req.socket.destroy(); return; }
      if (state.mode === 'truncated' || (state.mode === 'second-truncated' && state.posts.length === 2)) { res.writeHead(201, {'Content-Type':'application/json','Content-Length':'200','Connection':'close'}); res.write('{"idPedido":'); res.socket.end(); return; }
      return json(res, state.mode === 'invalid' ? state.invalid : order, 201);
    }
    if (req.url === '/api/test-empty') { res.writeHead(204); res.end(); return; }
    if (req.url === '/api/test-null') return json(res, null);
    if (req.url === '/api/test-empty-success') { res.writeHead(201, {'Content-Type':'application/json'}); res.end(); return; }
    if (req.url === '/api/test-http-error') { res.writeHead(400, {'Content-Type':'text/html'}); res.end('<p>Error TEST</p>'); return; }
    return json(res, {message:'Ruta de prueba no modelada'}, 501);
  } catch (error) { json(res, {message:error.message}, 500); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = 'http://127.0.0.1:' + server.address().port;
console.log(origin);
if (args.includes('--run-headless')) {
  const candidates = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'];
  let executable;
  for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch { /* Probar solo rutas de instalación conocidas. */ } }
  let child, directory;
  try {
    if (!executable) throw new Error('NOT RUN: no hay Edge headless instalado; no se instalaron dependencias');
    directory = await mkdtemp(join(tmpdir(), 'restaurant-f01-mounted-'));
    child = spawn(executable, ['--headless=new','--no-first-run','--no-default-browser-check','--user-data-dir='+join(directory,'profile'),'--dump-dom',origin], {windowsHide:true,stdio:['ignore','pipe','pipe']});
    child.stdout.resume(); let diagnostic = ''; child.stderr.on('data', value => { diagnostic += value; });
    const deadline = Date.now() + 90000;
    while (!report && Date.now() < deadline && child.exitCode === null) await new Promise(resolve => setTimeout(resolve, 250));
    if (!report) report = {result:'NOT RUN',rows,diagnostic:diagnostic.slice(-3000)};
    if (output) { await mkdir(output, {recursive:true}); await writeFile(join(output, selected ? 'checkout-f01-'+selected+'.json' : 'checkout-f01-mounted.json'), JSON.stringify({origin,...report},null,2)); }
    console.log(JSON.stringify({result:report.result,scenarios:rows.length,failed:rows.filter(r=>r.result==='FAIL').map(r=>r.label)}));
    process.exitCode = report.result === 'PASS' ? 0 : 1;
  } finally {
    for (const response of holds) {response.writeHead(200,{'Content-Type':'text/javascript'});response.end('');}
    if (child && child.exitCode === null) {await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,1500))]);if(child.exitCode===null)child.kill();}
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (directory) { const target = resolve(directory), parent = resolve(tmpdir()); if (dirname(target)!==parent || !target.startsWith(join(parent,'restaurant-f01-mounted-'))) throw new Error('Ruta temporal insegura'); await rm(target,{recursive:true,force:true,maxRetries:5,retryDelay:300}); }
  }
} else {
  process.on('SIGINT', () => {server.closeAllConnections();server.close(()=>process.exit(0));});
}
