import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
import { parse } from 'espree';
import { QueryClient, QueryObserver } from '@tanstack/query-core';
import { operationalDate, untilOperationalMidnight, watchOperationalDay } from '../src/utils/operationalDay.js';

const RealDate = Date, oldTZ = process.env.TZ;
let now = Date.parse('2026-10-30T03:59:59.900Z'), nextId = 0;
const timers = new Map();
const win = new EventTarget(), doc = new EventTarget();
win.setTimeout = (fn, ms) => { const id = ++nextId; timers.set(id, { fn, at: now + ms }); return id; };
win.clearTimeout = id => timers.delete(id);
doc.visibilityState = 'visible';
globalThis.window = win; globalThis.document = doc;
globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
let stopClock;
const handles = [];
const requests = [];
globalThis.dashboardDateGet = path => { requests.push(path); return Promise.resolve({ path }); };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
try {
  for (const timezone of ['UTC', 'Pacific/Auckland', 'America/Los_Angeles']) {
    process.env.TZ = timezone;
    assert.equal(operationalDate(new Date('2026-10-30T03:59:59.900Z')), '2026-10-29');
    assert.equal(untilOperationalMidnight(new Date('2026-10-30T03:59:59.900Z')), 100);
    assert.equal(operationalDate(new Date('2026-10-30T04:00:00Z')), '2026-10-30');
    assert.equal(operationalDate(new Date('2027-01-01T04:00:00Z')), '2027-01-01');
    assert.equal(operationalDate(new Date('2028-02-29T04:00:00Z')), '2028-02-29');
  }
  console.log('PASS La Paz independiente de TZ del dispositivo; medianoche, año y año bisiesto.');
  const bundle = await build({ stdin: { contents: "export * from './src/hooks/useSalesReport.js'; export * from './src/hooks/useTopSellingProductsReport.js';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'capture-options', setup(b) {
    b.onResolve({ filter: /^@tanstack\/react-query$/ }, () => ({ path: 'query', namespace: 'test' }));
    b.onResolve({ filter: /services\/api$/ }, () => ({ path: 'api', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, ({ path }) => ({ contents: path === 'query' ? 'export const useQuery=o=>o; export const keepPreviousData=data=>data;' : 'export const api={get:path=>globalThis.dashboardDateGet(path)};' }));
  } }] });
  const hooks = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  let day = operationalDate();
  const observe = options => { const observer = new QueryObserver(client, options); handles.push(observer.subscribe(() => {})); return observer; };
  const sales = observe(hooks.useSalesReport(day, day));
  const top = observe(hooks.useTopSellingProductsReport(day, day, 5));
  const manual = observe(hooks.useSalesReport('2026-09-01', '2026-09-15'));
  const applyDay = value => { if (value === day) return; day = value; sales.setOptions(hooks.useSalesReport(day, day)); top.setOptions(hooks.useTopSellingProductsReport(day, day, 5)); };
  stopClock = watchOperationalDay(applyDay);
  await flush();
  assert.equal(requests.length, 3); assert.equal(timers.size, 1);
  win.dispatchEvent(new Event('focus')); await flush();
  assert.equal(requests.length, 3);
  console.log('PASS mismo día sin nuevas consultas; un único timeout, sin intervalos.');
  now += 100;
  [...timers.entries()].forEach(([id, timer]) => { if (timer.at <= now) { timers.delete(id); timer.fn(); } });
  await flush();
  assert.equal(day, '2026-10-30'); assert.equal(requests.length, 5); assert.equal(timers.size, 1);
  for (const observer of [sales, top]) {
    const data = observer.getCurrentResult().data;
    const url = new URL(data.path, 'http://test');
    assert.equal(url.searchParams.get('desde'), day); assert.equal(url.searchParams.get('hasta'), day);
    assert.ok(observer.options.queryKey.includes(day));
  }
  assert.deepEqual(manual.options.queryKey, ['reportes', 'ventas', '2026-09-01', '2026-09-15']);
  console.log('PASS cruce automático: dos reportes nuevos, claves y parámetros coherentes; rango manual intacto.');
  // Ejecutar el callback real del botón, sin duplicar su lógica en la prueba.
  const source = fs.readFileSync('src/pages/admin/DashboardPage.jsx', 'utf8');
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, range: true });
  const body = tree.body.find(node => node.type === 'ExportDefaultDeclaration').declaration.body.body;
  const handler = body.flatMap(node => node.declarations ?? []).find(node => node.id.name === 'handleRefreshAll').init;
  const hookSource = fs.readFileSync('src/hooks/useOperationalDay.js', 'utf8');
  const hookTree = parse(hookSource, { ecmaVersion: 'latest', sourceType: 'module', range: true });
  const hookBody = hookTree.body.find(node => node.type === 'ExportNamedDeclaration').declaration.body.body;
  const refresh = hookBody.flatMap(node => node.declarations ?? []).find(node => node.id.name === 'refreshDay').init.arguments[0];
  const refreshDay = new Function('operationalDate', 'setDay', 'return (' + hookSource.slice(...refresh.range) + ')')(operationalDate, applyDay);
  let auxiliary = 0;
  const other = { refetch: async () => { auxiliary++; } };
  const runManual = () => new Function('refreshDay','hoy','setRefreshing','salesReport','topProductsReport','cashRegister','tables','cocinaOrders','bebidasOrders', 'return (' + source.slice(...handler.range) + ')')(refreshDay, day, () => {}, sales, top, other, other, other, other)();
  await runManual(); assert.equal(requests.length, 7); assert.equal(auxiliary, 4);
  now += 86400000; // Temporizador atrasado: click antes de que el navegador lo ejecute.
  const before = requests.length;
  await runManual(); await flush();
  assert.equal(day, '2026-10-31'); assert.equal(requests.length, before + 2); assert.equal(auxiliary, 8);
  assert.ok(requests.slice(before).every(path => path.includes('desde=2026-10-31') && path.includes('hasta=2026-10-31')));
  console.log('PASS Actualizar mismo día y tras medianoche: solo fecha vigente, sin refetch del día anterior.');
  now += 3 * 86400000;
  doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(day, '2026-10-31');
  doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(day, '2026-11-03');
  const count = requests.length; win.dispatchEvent(new Event('focus')); await flush(); assert.equal(requests.length, count);
  assert.equal(timers.size, 1); stopClock(); stopClock = null; assert.equal(timers.size, 0);
  console.log('PASS suspensión/reactivación, foco repetido y limpieza del temporizador.');
} finally {
  stopClock?.(); handles.forEach(stop => stop()); client.clear();
  globalThis.Date = RealDate; delete globalThis.window; delete globalThis.document; delete globalThis.dashboardDateGet;
  if (oldTZ === undefined) delete process.env.TZ; else process.env.TZ = oldTZ;
}
