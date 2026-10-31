// React real + router/cliente HTTP de producción; servidor simulado sin backend.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fixture = String.raw`
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { queryClient, AUTH_ME_KEY } from './src/services/queryClient.js';
import { api } from './src/services/api.js';
import { useAuth } from './src/hooks/useAuth.js';
import { useLogout } from './src/hooks/useLogout.js';
import LoginPage from './src/pages/auth/LoginPage.jsx';
import ProtectedRoute from './src/components/ProtectedRoute.jsx';
const app=document.getElementById('app'), results=document.getElementById('results'), log=document.getElementById('log');
let root, router;
const user={idUsuario:1,nombre:'Personal de prueba',rol:'admin',email:'staff@example.test'};
async function control(action, data={}) { const res=await fetch('/__control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data})}); if(!res.ok)throw new Error('Control HTTP '+res.status);return res.json(); }
const snapshot=()=>control('snapshot');
const text=()=>app.textContent;
const assert=(value,message)=>{if(!value)throw new Error(message);};
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const completedPath=path=>performance.getEntriesByType('resource').filter(entry=>entry.name.endsWith(path)).length;
async function waitFor(label, predicate) {const start=performance.now();while(!await predicate()){if(performance.now()-start>12000)throw new Error('Timeout: '+label);await frame();}}
async function click(label) {const matches=[...app.querySelectorAll('button')].filter(b=>b.textContent.trim()===label);assert(matches.length===1,'Botón ambiguo/ausente: '+label);assert(!matches[0].disabled,'Botón deshabilitado: '+label);matches[0].click();await frame();}
function Panel() {
 const auth=useAuth(), logout=useLogout();
 const read=useQuery({queryKey:['staff-probe'],queryFn:({signal})=>api.get('/usuarios/probe',{signal}),refetchInterval:4000});
 const operation=useMutation({mutationFn:path=>path==='timeout'
   ? api.get('/usuarios/timeout',{signal:AbortSignal.timeout(150)})
   : path==='table' ? api.get('/pedidos/mis-pedidos',{headers:{'x-table-token':'invalid-test'}})
   : path==='public' ? api.get('/menu')
   : path==='visit' ? api.post('/mesas/1/sesion')
   : path==='late' ? api.get('/usuarios/late')
   : path==='network' ? api.get('/usuarios/network') : api.post('/usuarios/probe',{})});
 return <main><h1>Personal autenticado</h1><p>Identidad: {auth.usuario?.idUsuario} — {auth.rol}</p>
  <button onClick={()=>read.refetch()}>Consultar</button><button onClick={()=>operation.mutate('staff')}>Operar</button>
  <button onClick={()=>operation.mutate('table')}>Token de mesa</button><button onClick={()=>operation.mutate('public')}>Menú público</button>
  <button onClick={()=>operation.mutate('visit')}>Sesión pública de mesa</button>
  <button onClick={()=>operation.mutate('network')}>Error de red</button><button onClick={()=>operation.mutate('timeout')}>Timeout</button>
  <button onClick={()=>operation.mutate('late')}>Operación pendiente</button>
  <button onClick={()=>auth.refetch()}>Revalidar identidad</button><button onClick={()=>logout.mutate()}>Salir</button>
  {read.data&&<p>Lectura válida</p>}{read.isError&&<p role="alert">Consulta {read.error.status}: {read.error.message}</p>}
  {operation.isError&&<p role="alert">Operación {operation.error.status??operation.error.name}: {operation.error.message}</p>}
 </main>;
}
async function mount(identity=user, entry='/admin') {
 root?.unmount();router?.dispose();queryClient.clear();await frame();await control('reset',{identity});
 router=createMemoryRouter([{element:<ProtectedRoute allowedRoles={['admin']}/>,children:[{path:'/admin',element:<Panel/>}]},{path:'/login',element:<LoginPage/>}],{initialEntries:[entry]});
 root=createRoot(app);root.render(<QueryClientProvider client={queryClient}><RouterProvider router={router}/></QueryClientProvider>);
 await waitFor('vista inicial',()=>identity ? text().includes('Personal autenticado') && text().includes('Lectura válida') && queryClient.getQueryState(AUTH_ME_KEY)?.fetchStatus==='idle' : Boolean(app.querySelector('#email')));
}
function fill(selector,value) {const el=app.querySelector(selector);assert(el,'Input ausente '+selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}
async function login(password='correct') {fill('#email','staff@example.test');fill('#password',password);await frame();await click('Ingresar');}
async function scenario(label,run) {const row=document.createElement('li');row.textContent=label+' — EN CURSO';results.append(row);await control('scenario',{label});await run();row.textContent=label+' — PASS';row.className='pass';await control('evidence',{label,dom:app.innerText,stats:await snapshot()});}
document.getElementById('run').onclick=async event=>{
 const button=event.currentTarget;button.disabled=true;results.replaceChildren();log.textContent='';
 try {
  await scenario('A. Sesión válida y recuperación inicial',async()=>{await mount();await waitFor('lectura normal',()=>text().includes('Lectura válida'));await click('Operar');await waitFor('operación normal',async()=>(await snapshot()).operations===1);assert(text().includes('Personal autenticado'),'Perdió la sesión válida');});
  await scenario('B. 401 en consulta y mutación, redirección y nuevo login',async()=>{
   for(const action of ['Consultar','Operar']){await mount();await control('configure',{identity:null,probeStatus:401});await click(action);await waitFor('ruta invalidada',()=>Boolean(app.querySelector('#email')));assert(queryClient.getQueryData(AUTH_ME_KEY)===null,'Identidad no invalidada');
    const before=(await snapshot()).probeRequests;const start=performance.now();await waitFor('sin polling protegido tras 401',()=>performance.now()-start>4200);const after=await snapshot();assert(after.probeRequests===before,'Polling después de desmontar ruta protegida');assert(after.meRequests<=3,'Bucle de /auth/me');
    await login();await waitFor('login posterior',()=>text().includes('Personal autenticado'));assert(queryClient.getQueryData(AUTH_ME_KEY)?.idUsuario===1,'No recuperó sesión');}
  });
  await scenario('C. 403 conserva sesión; /auth/me revalida permisos',async()=>{await mount();const before=(await snapshot()).meRequests;await control('configure',{probeStatus:403});await click('Operar');await waitFor('acceso denegado HTTP',()=>text().includes('403: Acceso denegado'));assert(text().includes('Personal autenticado'),'403 provocó logout');assert((await snapshot()).meRequests===before,'403 provocó invalidación automática');
   await control('configure',{identity:{...user,rol:'caja'}});await click('Revalidar identidad');await waitFor('roles actualizados',()=>text().includes('Tu rol no tiene permiso para ver esta sección.') && queryClient.getQueryState(AUTH_ME_KEY)?.fetchStatus==='idle');assert(queryClient.getQueryData(AUTH_ME_KEY)?.rol==='caja','Se perdió la identidad al revalidar rol');});
  await scenario('D. Login incorrecto mantiene formulario y mensaje',async()=>{await mount(null);await login('incorrect');await waitFor('credenciales incorrectas',()=>text().includes('Credenciales incorrectas'));assert(app.querySelector('#email')?.value==='staff@example.test','Se perdió el formulario');assert((await snapshot()).logins===1,'Login reintentado');assert(router.state.location.pathname==='/login','Redirección incorrecta');});
  await scenario('E. Token de mesa y rutas públicas independientes',async()=>{await mount();const before=(await snapshot()).meRequests;for(const [label,path] of [['Token de mesa','/api/pedidos/mis-pedidos'],['Menú público','/api/menu'],['Sesión pública de mesa','/api/mesas/1/sesion']]){const beforeResponse=completedPath(path);await click(label);await waitFor('respuesta pública completada',()=>completedPath(path)>beforeResponse);await frame();await waitFor('error independiente',()=>text().includes('Operación 401'));await frame();assert(text().includes('Personal autenticado'),'Error público/mesa invalidó al personal');assert(queryClient.getQueryData(AUTH_ME_KEY)?.idUsuario===1,'Contaminación de identidad');}assert((await snapshot()).meRequests===before,'Error de mesa provocó /auth/me');});
  await scenario('F. Error de red y timeout no invalidan sesión',async()=>{await mount();for(const label of ['Error de red','Timeout']){await click(label);await waitFor('error de transporte',()=>text().includes(label==='Timeout'?'Operación TimeoutError':'Operación TypeError'));assert(text().includes('Personal autenticado'),'Transporte invalidó sesión');assert(queryClient.getQueryData(AUTH_ME_KEY)?.idUsuario===1,'Identidad perdida');}});
  await scenario('G. Logout normal',async()=>{await mount();await click('Salir');await waitFor('logout',()=>Boolean(app.querySelector('#email')));assert(queryClient.getQueryData(AUTH_ME_KEY)===null,'Logout no limpió identidad');assert((await snapshot()).logouts===1,'Logout duplicado');});
  await scenario('H. 401 tardío no invalida un login nuevo del mismo usuario',async()=>{await mount();await click('Operación pendiente');await waitFor('solicitud antigua pendiente',async()=>(await snapshot()).latePending);await control('configure',{identity:null,probeStatus:401});await click('Consultar');await waitFor('expiración',()=>Boolean(app.querySelector('#email')));await login();await waitFor('nueva autenticación',()=>text().includes('Personal autenticado') && queryClient.getQueryState(AUTH_ME_KEY)?.fetchStatus==='idle');
   const version=queryClient.getQueryState(AUTH_ME_KEY).dataUpdateCount;await control('releaseLate');await waitFor('respuesta antigua completada',()=>performance.getEntriesByType('resource').some(e=>e.name.endsWith('/api/usuarios/late')));await frame();assert(text().includes('Personal autenticado'),'401 anterior expulsó la sesión nueva');assert(queryClient.getQueryState(AUTH_ME_KEY).dataUpdateCount===version,'401 anterior alteró auth');});
  await scenario('I. /auth/me pendiente no restaura sesión tras 401 ni logout',async()=>{
   for(const action of ['Consultar','Salir']){await mount();await control('configure',{holdMe:true});await click('Revalidar identidad');await waitFor('me pendiente',async()=>(await snapshot()).mePending);if(action==='Consultar')await control('configure',{identity:null,probeStatus:401});await click(action);await waitFor('login tras invalidación',()=>Boolean(app.querySelector('#email')));await waitFor('cancelación HTTP de /me',async()=>(await snapshot()).meAborted);await control('releaseMe');await frame();await frame();assert(queryClient.getQueryData(AUTH_ME_KEY)===null,'/me antiguo restauró identidad');assert(Boolean(app.querySelector('#email')),'/me antiguo reabrió ruta');assert((await snapshot()).meAborted,'No se canceló el /auth/me pendiente');}
  });
  await scenario('J. Revalidar /auth/me no oculta un 401 vigente',async()=>{await mount();await click('Operación pendiente');await waitFor('petición pendiente',async()=>(await snapshot()).latePending);await click('Revalidar identidad');await waitFor('identidad revalidada',()=>queryClient.getQueryState(AUTH_ME_KEY)?.fetchStatus==='idle');const before=(await snapshot()).probeRequests;await control('configure',{identity:null,probeStatus:401});await control('releaseLate');await waitFor('401 vigente invalidó ruta',()=>Boolean(app.querySelector('#email')));assert((await snapshot()).probeRequests===before,'Fue el siguiente polling quien invalidó la sesión');});
  log.textContent='PASS A–G y carreras H–J. React, rutas, login/logout, cliente HTTP y QueryClient reales; API local simulada.';document.title='PASS — Sesiones 401/403';
  await control('report',{result:'PASS',rows:[...results.children].map(r=>r.textContent)});
 }catch(error){log.textContent='FAIL: '+error.message;console.error(error);document.title='FAIL — Sesiones';await control('report',{result:'FAIL',error:error.message,dom:app.innerText});}
 finally{button.disabled=false;}
};
`;
const bundle=await build({stdin:{contents:fixture,loader:'jsx',resolveDir:process.cwd()},bundle:true,write:false,jsx:'automatic',format:'iife',platform:'browser',minify:true,define:{'process.env.NODE_ENV':'"development"','import.meta.env':'{}'}});
const html='<!doctype html><meta charset="utf-8"><title>Sesiones 401/403</title><style>body{font:14px system-ui;margin:24px}button{padding:8px;margin:4px}.pass{color:green}#results{line-height:1.6}#log{white-space:pre-wrap}#app{border-top:1px solid #ccc}svg{width:20px;height:20px}</style><h1>Prueba de sesiones del personal</h1><button id="run">Ejecutar A–J</button><ol id="results"></ol><pre id="log"></pre><div id="app"></div><script src="/fixture.js"></script>';
const directory=join(tmpdir(),'restaurante-staff-session-mounted');await mkdir(directory,{recursive:true});
let state, scenario='', late=null, heldMe=null;const requests=[],evidence=[];
const user={idUsuario:1,nombre:'Personal de prueba',rol:'admin',email:'staff@example.test'};
function reset(identity){state={identity,probeStatus:200,holdMe:false,probeRequests:0,meRequests:0,operations:0,logins:0,logouts:0,meAborted:false};}
reset(user);
function json(res,data,status=200){if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const server=createServer(async(req,res)=>{try{
 let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};
 if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'"});return res.end(html);}
 if(req.url==='/fixture.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(bundle.outputFiles[0].text);}
 if(req.url==='/__control'){
  switch(body.action){
   case 'reset': if(late||heldMe)throw new Error('Quedaron solicitudes pendientes');reset(body.identity);break;
   case 'configure': Object.assign(state,body);break;
   case 'snapshot': break;
   case 'scenario':scenario=body.label;break;
   case 'releaseLate':if(!late)throw new Error('No hay solicitud antigua');json(late,{message:'Sesión anterior expirada'},401);late=null;break;
   case 'releaseMe':if(!heldMe)throw new Error('No hay /me pendiente');json(heldMe.res,heldMe.identity);heldMe=null;break;
   case 'evidence':evidence.push(body);break;
   case 'report':await writeFile(join(directory,'last-run.json'),JSON.stringify({...body,evidence,requests},null,2));console.log(JSON.stringify({report:body.result,error:body.error,path:join(directory,'last-run.json')}));break;
   default:return json(res,{message:'Control desconocido'},501);
  }return json(res,{...state,latePending:Boolean(late),mePending:Boolean(heldMe)});
 }
 requests.push({scenario,method:req.method,path:req.url,tableToken:!!req.headers['x-table-token'],at:new Date().toISOString()});
 if(req.url==='/api/auth/me'){
  state.meRequests++;if(state.holdMe){state.holdMe=false;heldMe={res,identity:state.identity};res.on('close',()=>{if(heldMe?.res===res)state.meAborted=true;});return;}
  return state.identity?json(res,state.identity):json(res,{message:'Sin sesión'},401);
 }
 if(req.url==='/api/auth/login'){state.logins++;if(body.password!=='correct')return json(res,{message:'Credenciales incorrectas'},401);state.identity=user;state.probeStatus=200;return json(res,{usuario:user});}
 if(req.url==='/api/auth/logout'){state.logouts++;state.identity=null;return json(res,{ok:true});}
 if(req.url==='/api/usuarios/probe'){state.probeRequests++;if(req.method==='POST')state.operations++;return json(res,state.probeStatus===200?{ok:true}:{message:state.probeStatus===403?'Acceso denegado':'Sesión expirada'},state.probeStatus);}
 if(req.url==='/api/usuarios/late'){late=res;return;}
 if(req.url==='/api/usuarios/network'){req.socket.destroy();return;}
 if(req.url==='/api/usuarios/timeout'){return;}
 if(['/api/pedidos/mis-pedidos','/api/menu','/api/mesas/1/sesion'].includes(req.url))return json(res,{message:'Error de sesión independiente'},401);
 return json(res,{message:'Ruta no prevista'},501);
 }catch(error){json(res,{message:error.message},500);}});
server.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
process.on('SIGINT',()=>{server.close(()=>process.exit(0));server.closeAllConnections();});
