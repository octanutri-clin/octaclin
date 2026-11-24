import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';

test('demo sintética suporta a consulta paginada sem simular prova de autorização', {timeout:20_000}, async()=>{
 const reserva=net.createServer();reserva.listen(0,'127.0.0.1');await once(reserva,'listening');const porta=reserva.address().port;await new Promise(resolve=>reserva.close(resolve));
 const child=spawn(process.execPath,[new URL('./api-demo-local.mjs',import.meta.url).pathname,'--port',String(porta)],{stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(String(d).includes('ouvindo'))resolve();});child.once('error',reject);child.once('exit',()=>reject(new Error('Demo encerrou antes da consulta.')));});
  const url=`http://127.0.0.1:${porta}`;
  const criar=await fetch(url+'/questionarios',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({titulo:'Demo sintética',profissionalId:'44444444-4444-4444-8444-444444444444'})});
  assert.equal(criar.status,201);const q=await criar.json();
  const r=await fetch(`${url}/questionarios/${q.id}/respostas/pagina?tamanho=50`);assert.equal(r.status,200);assert.match(r.headers.get('cache-control')??'',/no-store/);
  const d=await r.json();assert.deepEqual(d.respostas,[]);assert.deepEqual(d.filtros,{tamanho:50});assert.equal(d.totalConsulta,0);assert.equal(d.proximoCursor,null);assert.equal(d.timezone,'America/Sao_Paulo');
 }finally{child.kill('SIGTERM');await once(child,'exit');}
});
