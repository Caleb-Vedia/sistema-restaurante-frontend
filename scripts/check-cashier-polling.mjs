// Comprobación focalizada: hooks reales + QueryObserver, sin HTTP ni librerías nuevas.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// QueryObserver usa sus intervalos de navegador; se controlan abajo sin esperar 4 s.
globalThis.window = {};
const { QueryClient, QueryObserver, focusManager, timeoutManager } = await import('@tanstack/query-core');
const timers = new Map();
let timerId = 0;
timeoutManager.setTimeoutProvider({
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
  clearInterval: (id) => timers.delete(id),
});
focusManager.setFocused(true);

const hookNames = ['useTables', 'useCurrentCashRegister', 'useTableBalance', 'useTableConsumption',
  'usePaymentHistory', 'useShiftActivity', 'useCloseContext', 'useRegisterPayment', 'useCancelPayment',
  'useReleaseTable', 'useCloseCashRegister'];
const bundle = await build({
  stdin: { contents: hookNames.map((name) => "export * from './src/hooks/" + name + ".js';").join(String.fromCharCode(10)), resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'capture-hook-options', setup(buildApi) {
    buildApi.onResolve({ filter: /^@tanstack\/react-query$/ }, () => ({ path: 'query', namespace: 'capture' }));
    buildApi.onResolve({ filter: /services\/api$/ }, () => ({ path: 'api', namespace: 'capture' }));
    buildApi.onLoad({ filter: /.*/, namespace: 'capture' }, ({ path }) => ({ contents: path === 'query'
      ? 'export const useQuery = o => o; export const useMutation = o => o; export const useQueryClient = () => globalThis.cashierCheckClient;'
      : 'export const api = new Proxy({}, { get: (_, method) => (...args) => globalThis.cashierCheckApi(method, ...args) });' }));
  } }],
});
const hooks = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
globalThis.cashierCheckClient = client;
const calls = [];
let state = { turno: 10, sesion: 100, estado: 'ocupada', total: 20, pagado: 0, anulado: null, pedidos: 1 };
let overrideGet = null;
globalThis.cashierCheckApi = async (method, path, options) => {
  calls.push({ method, path, options });
  if (method !== 'get') return { ok: true };
  if (overrideGet) return overrideGet(path, options);
  if (path === '/caja/actual') return state.turno == null ? null : { idCierre: state.turno };
  if (path === '/mesas') return [{ idMesa: 1, estado: state.estado, sesionActiva: state.sesion == null ? null : { idSesion: state.sesion } }];
  if (path.startsWith('/pagos/total/')) return { idMesa: 1, idSesion: state.sesion, totalAdeudado: state.total, totalPagado: state.pagado, saldoPendiente: state.total - state.pagado };
  if (path.startsWith('/pedidos/mesa/')) return { idSesion: state.sesion, pedidos: Array.from({ length: state.pedidos }, (_, i) => ({ idPedido: i + 1 })) };
  if (path.startsWith('/pagos?')) return state.pagado ? [{ idPago: 1, idSesion: state.sesion ?? 100, montoPagado: state.pagado, anuladoEl: state.anulado }] : [];
  if (path === '/caja/actividad') return { idCierre: state.turno, totalIngresosTurno: state.anulado ? 0 : state.pagado, sesiones: [] };
  if (path === '/caja/cierre/contexto') return { idCierre: state.turno, sesiones: [] };
  throw new Error('Endpoint inesperado: ' + path);
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));
const active = new Set();
function observe(options) {
  const observer = new QueryObserver(client, options);
  const stop = observer.subscribe(() => {});
  const handle = { observer, stop: () => { stop(); active.delete(handle); } };
  active.add(handle);
  return handle;
}
async function tick() {
  const scheduled = [...timers.values()];
  scheduled.forEach(({ fn, ms }) => { assert.equal(ms, 4000); fn(); });
  await flush();
}
function check(label) { console.log('OK ' + label); }

try {
  assert.equal(hooks.useTables().refetchInterval, false);
  assert.equal(hooks.useCurrentCashRegister().refetchInterval, false);
  const disabled = [hooks.useTables({ enabled: false, refetchInterval: 4000 }),
    hooks.useTableBalance(null, null), hooks.useTableBalance(1, 100, { enabled: false }),
    hooks.useTableConsumption(1, null), hooks.usePaymentHistory(null, null, 10),
    hooks.usePaymentHistory(1, 100, null), hooks.useShiftActivity(null), hooks.useCloseContext()];
  const disabledObservers = disabled.map(observe);
  await flush();
  assert.equal(calls.length, 0);
  assert.equal(timers.size, 0);
  disabledObservers.forEach((h) => h.stop());
  check('condiciones de ejecución; consumidores ajenos a Caja sin polling');

  const current = observe(hooks.useCurrentCashRegister({ refetchInterval: 4000 }));
  const tables = observe(hooks.useTables({ refetchInterval: 4000 }));
  const balance = observe(hooks.useTableBalance(1, 100));
  const consumption = observe(hooks.useTableConsumption(1, 100));
  const history = observe(hooks.usePaymentHistory(1, 100, 10));
  const activity = observe(hooks.useShiftActivity(10));
  await flush();
  assert.equal(calls.length, 6);
  state = { ...state, estado: 'cuenta_solicitada', total: 30, pagado: 10, pedidos: 2 };
  await tick();
  assert.equal(calls.length, 12);
  assert.equal(tables.observer.getCurrentResult().data[0].estado, 'cuenta_solicitada');
  assert.equal(balance.observer.getCurrentResult().data.saldoPendiente, 20);
  assert.equal(consumption.observer.getCurrentResult().data.pedidos.length, 2);
  assert.equal(history.observer.getCurrentResult().data[0].montoPagado, 10);
  assert.equal(activity.observer.getCurrentResult().data.totalIngresosTurno, 10);
  state.anulado = '2026-10-17T12:00:00Z';
  await tick();
  assert.equal(history.observer.getCurrentResult().data[0].anuladoEl, state.anulado);
  assert.equal(activity.observer.getCurrentResult().data.totalIngresosTurno, 0);
  check('intervalos de 4 s; cambios externos simulados de mesas, consumo, saldo, pagos y anulaciones');

  // Un segundo observador de la misma clave no duplica solicitudes en vuelo.
  const duplicate = observe(hooks.useTableBalance(1, 100));
  await flush();
  const beforeTick = calls.length;
  await tick();
  assert.equal(calls.length - beforeTick, 6);
  duplicate.stop();
  check('deduplicación con dos observadores de la misma consulta');
  focusManager.setFocused(false);
  const beforeHidden = calls.length;
  await tick();
  assert.equal(calls.length, beforeHidden);
  focusManager.setFocused(true);
  check('sin polling en segundo plano, igual que Cocina/Bebidas');

  state = { ...state, sesion: 101, pagado: 0, total: 5, pedidos: 0 };
  await tick();
  assert.equal(balance.observer.getCurrentResult().error?.status, 409);
  assert.equal(consumption.observer.getCurrentResult().error?.status, 409);
  assert.equal(client.getQueryData(hooks.tableBalanceKey(1, 100)).idSesion, 100);
  balance.observer.setOptions(hooks.useTableBalance(1, 101));
  consumption.observer.setOptions(hooks.useTableConsumption(1, 101));
  history.observer.setOptions(hooks.usePaymentHistory(1, 101, 10));
  assert.equal(balance.observer.getCurrentResult().data, undefined);
  assert.equal(history.observer.getCurrentResult().data, undefined);
  await flush();
  assert.equal(balance.observer.getCurrentResult().data.idSesion, 101);
  assert.deepEqual(history.observer.getCurrentResult().data, []);
  assert.deepEqual(consumption.observer.getCurrentResult().data.pedidos, []);
  check('sesión nueva en la misma mesa sin reutilizar saldo, pedidos ni pagos anteriores');

  state = { ...state, sesion: null, estado: 'libre' };
  await tick();
  assert.equal(tables.observer.getCurrentResult().data[0].sesionActiva, null);
  balance.observer.setOptions(hooks.useTableBalance(null, null));
  consumption.stop();
  history.observer.setOptions(hooks.usePaymentHistory(1, null, 10));
  await flush();
  assert.deepEqual(history.observer.getCurrentResult().data, []);
  check('mesa liberada y consulta separada del historial de la última sesión cerrada');

  state.turno = null;
  await tick();
  assert.equal(current.observer.getCurrentResult().data, null);
  // La rama sin turno desmonta estos observadores en CashierPage.
  [tables, balance, history, activity].forEach((h) => h.stop());
  await flush();
  assert.equal(client.getQueryData([...hooks.CURRENT_SHIFT_ACTIVITY_KEY, 10]), undefined);
  const afterClose = calls.length;
  await tick();
  assert.equal(calls.length - afterClose, 1);
  state.turno = 11;
  await tick();
  assert.equal(current.observer.getCurrentResult().data.idCierre, 11);
  const newActivity = observe(hooks.useShiftActivity(11));
  assert.equal(newActivity.observer.getCurrentResult().data, undefined);
  await flush();
  assert.equal(newActivity.observer.getCurrentResult().data.idCierre, 11);
  newActivity.stop(); current.stop();
  check('cierre/reapertura externos simulados; sin consultas dependientes tras desmontar el turno');

  let finishLate;
  let aborted = false;
  overrideGet = (_path, { signal }) => new Promise((resolve) => {
    finishLate = resolve;
    signal.addEventListener('abort', () => { aborted = true; });
  });
  const late = observe(hooks.useTableBalance(2, 200));
  await flush();
  late.stop();
  assert.equal(aborted, true);
  overrideGet = async () => ({ idSesion: 201, saldoPendiente: 5 });
  const replacement = observe(hooks.useTableBalance(2, 201));
  await flush();
  finishLate({ idSesion: 200, saldoPendiente: 999 });
  await flush();
  assert.equal(client.getQueryData(hooks.tableBalanceKey(2, 200)), undefined);
  assert.equal(replacement.observer.getCurrentResult().data.saldoPendiente, 5);
  replacement.stop();
  overrideGet = null;
  check('cancelación y descarte de respuestas tardías tras abandonar una sesión');

  const signal = new AbortController().signal;
  state.sesion = 102;
  state.pagado = 5;
  await assert.rejects(hooks.usePaymentHistory(1, 101, 11).queryFn({ signal }), { status: 409 });
  await assert.rejects(hooks.useShiftActivity(10).queryFn({ signal }), { status: 409 });
  await assert.rejects(hooks.useCloseContext({ idCierre: 10 }).queryFn({ signal }), { status: 409 });
  overrideGet = async () => { const e = new Error('sin sesión'); e.status = 404; throw e; };
  assert.equal(await hooks.useTableConsumption(1, 102).queryFn({ signal }), null);
  assert.deepEqual(await hooks.usePaymentHistory(1, null, 11).queryFn({ signal }), []);
  overrideGet = null;
  check('respuestas de otra sesión/turno rechazadas; estados vacíos 404 conservados');

  client.clear();
  const keys = [hooks.tableBalanceKey(1, 100), hooks.tableBalanceKey(1, 101),
    hooks.consumoActualKey(1, 101), hooks.paymentHistoryKey(1, 101, 11),
    hooks.TABLES_KEY, hooks.CURRENT_CASH_REGISTER_KEY, [...hooks.CURRENT_SHIFT_ACTIVITY_KEY, 11]];
  keys.forEach((key) => client.setQueryData(key, {}));
  const register = hooks.useRegisterPayment();
  await register.mutationFn({ idMesa: 1, idSesion: 101, pagos: [] });
  assert.deepEqual(calls.at(-1).options, { idMesa: 1, pagos: [] });
  await register.onSuccess({ mesaLiberada: false }, { idMesa: 1 });
  assert.equal(client.getQueryState(hooks.tableBalanceKey(1, 100)).isInvalidated, true);
  assert.equal(client.getQueryState(hooks.tableBalanceKey(1, 101)).isInvalidated, true);
  await hooks.useCancelPayment().onSuccess({}, { idMesa: 1 });
  assert.equal(client.getQueryState(hooks.paymentHistoryKey(1, 101, 11)).isInvalidated, true);
  await hooks.useReleaseTable().onSuccess({}, { idMesa: 1 });
  assert.equal(client.getQueryData(hooks.tableBalanceKey(1, 101)), undefined);
  assert.equal(client.getQueryData(hooks.consumoActualKey(1, 101)), undefined);
  await hooks.useCloseCashRegister().onSuccess();
  assert.equal(client.getQueryData([...hooks.CURRENT_SHIFT_ACTIVITY_KEY, 11]), undefined);
  assert.equal(client.getQueryState(hooks.CURRENT_CASH_REGISTER_KEY).isInvalidated, true);
  check('invalidaciones locales por prefijo conservadas y contrato POST /pagos sin cambios');
  assert.equal(hooks.useCloseContext({ idCierre: 11, refetchInterval: 4000 }).refetchInterval, 4000);
  assert.equal(hooks.useCloseContext({ idCierre: 11, refetchInterval: false }).refetchInterval, false);
  check('polling del contexto de cierre configurable solo para revisión');
} finally {
  [...active].forEach((h) => h.stop());
  client.clear();
  delete globalThis.window;
  delete globalThis.cashierCheckClient;
  delete globalThis.cashierCheckApi;
}
