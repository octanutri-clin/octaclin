import { randomUUID } from 'crypto';
import { clonarContextoEquivalenciaParaCopia, resolverEquivalenciasDocumento, ContextosEquivalencias, assinaturaDependenciasEquivalencia, mesclarContextosEquivalenciaSeguro } from './resolver-equivalencias-edicao';
import { calcularEquivalencia, FatosComposicaoEquivalencia } from '../dominio/equivalencia-nutriente';
import { DocumentoEdicaoPlano } from '../dominio/edicao-plano';
const fp='a'.repeat(64),ator={usuarioId:randomUUID(),profissionalId:randomUUID()};
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
function documento():any{return {schemaVersao:1,refeicoes:[{chaveCliente:'r',nome:'Refeição',itens:[{chaveCliente:'p',descricao:'Principal',porcaoGramas:'100',nutrientesPor100g:{energiaKcal:'100',proteinasG:'10',carboidratosG:'20',gordurasG:'5'},substituicoes:[{chaveCliente:'a',descricao:'Alternativa',porcaoGramas:'100',nutrientesPor100g:{energiaKcal:'100',proteinasG:'10',carboidratosG:'20',gordurasG:'5'}}]}]}]};}
const principal=(d:any)=>d.refeicoes[0].itens[0],alt=(d:any)=>principal(d).substituicoes[0];
const fatos=(a:any):FatosComposicaoEquivalencia=>({identidade:'manual:'+a.chaveCliente,descricao:a.descricao,baseGramas:'100',nutrientes:a.nutrientesPor100g});
const comando=(acao='calcular',anteriorAplicacaoId?:string)=>({acao,aplicacaoId:randomUUID(),...(anteriorAplicacaoId?{anteriorAplicacaoId}:{}),nutriente:'energiaKcal',politica:{passoPorcaoGramas:'1'},porcaoEfetiva:'100',fingerprintEsperado:fp});
function callbacks(){let calculos=0;return {ator,prever:async(d:DocumentoEdicaoPlano,i:any,a:any,c:any)=>{calculos++;const p=fatos(i),alternativa=fatos(a);return {fingerprint:fp,principal:p,alternativa,resultado:calcularEquivalencia({principal:p,alternativa,porcaoPrincipalGramas:String(i.porcaoGramas),porcaoEfetiva:c.porcaoEfetiva,nutriente:c.nutriente,politica:c.politica})};},dependencias:async(i:any,a:any,c:any)=>assinaturaDependenciasEquivalencia(i,a,fatos(i),fatos(a),c.nutriente,c.politica),quantidade:()=>calculos};}
async function inicial(){const d=documento(),c=comando();alt(d).equivalencia=c;const cb=callbacks();const contextos=await resolverEquivalenciasDocumento(d,{},cb);return {d,c,cb,contextos};}
describe('FOOD05 ciclo comando ACK referência e revisão pendente',()=>{
 it('mescla chaves especiais como propriedades próprias sem poluir protótipos',()=>{
  const destino=Object.create(null) as ContextosEquivalencias;
  const origem=JSON.parse('{"__proto__":{"poluido":true},"constructor":{"prova":true}}') as ContextosEquivalencias;
  mesclarContextosEquivalenciaSeguro(destino,origem);
  expect(Object.getPrototypeOf(destino)).toBeNull();
  expect(Object.hasOwn(destino,'__proto__')).toBe(true);
  expect((destino as any).__proto__).toEqual({poluido:true});
  expect(({} as any).poluido).toBeUndefined();
 });
 it('copia proveniência no servidor com identidade nova, linhagem e chaves remapeadas sem alterar a origem',async()=>{
  const a=await inicial(),origem=clone(a.contextos.a),copiadoPor={usuarioId:randomUUID(),profissionalId:randomUUID()};
  const copia=clonarContextoEquivalenciaParaCopia(origem,{pacienteId:randomUUID(),planoId:randomUUID(),versaoId:randomUUID()},{pacienteId:randomUUID(),planoId:randomUUID(),versaoId:randomUUID(),itemChave:'item-destino',alternativaChave:'alternativa-destino'},copiadoPor,'2026-10-24T12:00:00.000Z');
  expect(copia.aplicacaoId).not.toBe(origem.aplicacaoId);
  expect(copia).toMatchObject({itemChave:'item-destino',alternativaChave:'alternativa-destino',estado:'revisao_pendente',ator:origem.ator,copiaOrigem:{aplicacaoId:origem.aplicacaoId,pacienteId:expect.any(String),planoId:expect.any(String),versaoId:expect.any(String),itemChave:origem.itemChave,alternativaChave:origem.alternativaChave,copiadaPor:copiadoPor,copiadaEm:'2026-10-24T12:00:00.000Z'}});
  expect(copia.fingerprintResolucao).not.toBe(origem.fingerprintResolucao);
  expect(JSON.stringify(origem)).toBe(JSON.stringify(a.contextos.a));
 });
 it('salva cópia reidentificada pelo fluxo normal sem recalcular nem apagar a linhagem',async()=>{
  const a=await inicial(),origem=clone(a.contextos.a),copiadoPor={usuarioId:randomUUID(),profissionalId:randomUUID()};
  const copia=clonarContextoEquivalenciaParaCopia(origem,{pacienteId:randomUUID(),planoId:randomUUID(),versaoId:randomUUID()},{pacienteId:randomUUID(),planoId:randomUUID(),versaoId:randomUUID(),itemChave:'item-destino',alternativaChave:'alternativa-destino'},copiadoPor,'2026-10-24T12:00:00.000Z');
  const destino=clone(a.d);principal(destino).chaveCliente='item-destino';alt(destino).chaveCliente='alternativa-destino';delete alt(destino).equivalencia;
  const cb=callbacks(),resolvidos=await resolverEquivalenciasDocumento(destino,{[copia.alternativaChave]:copia},cb);
  expect(alt(destino).equivalencia).toEqual({aplicacaoId:copia.aplicacaoId});
  expect(resolvidos['alternativa-destino']).toMatchObject({estado:'revisao_pendente',copiaOrigem:copia.copiaOrigem});
  expect(cb.quantidade()).toBe(0);
 });
 it.each(['mesmo-plano','outro-plano','outro-paciente'])('D15 cópia idêntica %s permanece pendente após snapshot e autosaves',async modo=>{
  const a=await inicial(),origem=clone(a.contextos.a),pacienteId=randomUUID(),planoId=randomUUID(),versaoId=randomUUID();
  const copiado=clonarContextoEquivalenciaParaCopia(origem,{pacienteId,planoId,versaoId},{pacienteId:modo==='outro-paciente'?randomUUID():pacienteId,planoId:modo==='mesmo-plano'?planoId:randomUUID(),versaoId:randomUUID(),itemChave:'p',alternativaChave:'a'},ator,'2026-10-27T12:00:00.000Z');
  expect(copiado.estado).toBe('revisao_pendente');
  expect(copiado.aplicacaoId).not.toBe(origem.aplicacaoId);
  expect(copiado.fingerprintResolucao).not.toBe(origem.fingerprintResolucao);
  expect(copiado.resultado).toEqual(origem.resultado);
  const restaurado=clone({a:copiado}),d=clone(a.d);delete alt(d).equivalencia;
  const cb=callbacks();let r=await resolverEquivalenciasDocumento(d,restaurado,cb);
  r=await resolverEquivalenciasDocumento(d,r,cb);
  expect(r.a.estado).toBe('revisao_pendente');expect(r.a.aplicacaoId).toBe(copiado.aplicacaoId);expect(cb.quantidade()).toBe(0);
  alt(d).equivalencia=comando('recalcular',copiado.aplicacaoId);
  expect((await resolverEquivalenciasDocumento(d,r,cb)).a.estado).toBe('calculada_revisada');
  expect(a.contextos.a).toEqual(origem);
 });
 it('D15 catálogo idêntico mantém pendência mesmo com dependências iguais',async()=>{
  const a=await inicial(),original=clone(a.contextos.a);
  original.principal.identidade='catalogo:'+randomUUID();original.alternativa.identidade='catalogo:'+randomUUID();
  const copiado=clonarContextoEquivalenciaParaCopia(original,{pacienteId:randomUUID(),planoId:randomUUID(),versaoId:randomUUID()},{pacienteId:randomUUID(),planoId:randomUUID(),versaoId:randomUUID(),itemChave:'p',alternativaChave:'a'},ator,'2026-10-27T12:00:00.000Z');
  const d=clone(a.d);delete alt(d).equivalencia;
  const cb={...callbacks(),dependencias:async()=>original.dependenciasHash};
  expect((await resolverEquivalenciasDocumento(d,{a:copiado},cb)).a.estado).toBe('revisao_pendente');
 });
 it('consome comando e devolve referência no documento canônico',async()=>{const a=await inicial();expect(alt(a.d).equivalencia).toEqual({aplicacaoId:a.c.aplicacaoId});expect(a.contextos.a).toMatchObject({aplicacaoId:a.c.aplicacaoId,itemChave:'p',alternativaChave:'a',estado:'calculada_revisada',ator});expect(a.cb.quantidade()).toBe(1);});
 it('autosave com referência não calcula novamente e não altera porção',async()=>{const a=await inicial();const r=await resolverEquivalenciasDocumento(a.d,a.contextos,a.cb);expect(r.a.estado).toBe('calculada_revisada');expect(alt(a.d).porcaoGramas).toBe('100');expect(a.cb.quantidade()).toBe(1);});
 it('mudança do principal marca pendente sem mudar alternativa; pendência salva é aderente',async()=>{const a=await inicial();principal(a.d).porcaoGramas='200';let r=await resolverEquivalenciasDocumento(a.d,a.contextos,a.cb);expect(r.a.estado).toBe('revisao_pendente');expect(alt(a.d).porcaoGramas).toBe('100');principal(a.d).porcaoGramas='100';r=await resolverEquivalenciasDocumento(a.d,r,a.cb);expect(r.a.estado).toBe('revisao_pendente');expect(a.cb.quantidade()).toBe(1);});
 it('texto/ordem/casas visuais não geram pendência falsa',async()=>{const a=await inicial();a.d.refeicoes[0].nome='Outro título';principal(a.d).nutrientesPor100g.energiaKcal='100.000';alt(a.d).porcaoGramas='100.00';const r=await resolverEquivalenciasDocumento(a.d,a.contextos,a.cb);expect(r.a.estado).toBe('calculada_revisada');});
 it('omissão preserva contexto, null não remove vínculo',async()=>{const a=await inicial();delete alt(a.d).equivalencia;const r=await resolverEquivalenciasDocumento(a.d,a.contextos,a.cb);expect(alt(a.d).equivalencia).toEqual({aplicacaoId:a.c.aplicacaoId});expect(r.a.estado).toBe('calculada_revisada');alt(a.d).equivalencia=null;await expect(resolverEquivalenciasDocumento(a.d,r,a.cb)).rejects.toThrow();});
 it('referência sem contexto ou transferida para outra chave é rejeitada',async()=>{const a=await inicial();await expect(resolverEquivalenciasDocumento(a.d,{},a.cb)).rejects.toThrow();alt(a.d).chaveCliente='outra';await expect(resolverEquivalenciasDocumento(a.d,a.contextos,a.cb)).rejects.toThrow();});
 it('retry igual do comando é idempotente; conteúdo ou principal diferentes não',async()=>{const a=await inicial();alt(a.d).equivalencia=clone(a.c);const r=await resolverEquivalenciasDocumento(a.d,a.contextos,a.cb);expect(r.a.aplicacaoId).toBe(a.c.aplicacaoId);expect(a.cb.quantidade()).toBe(1);alt(a.d).equivalencia={...a.c,porcaoEfetiva:'101'};await expect(resolverEquivalenciasDocumento(a.d,r,a.cb)).rejects.toThrow();alt(a.d).equivalencia=clone(a.c);principal(a.d).porcaoGramas='200';await expect(resolverEquivalenciasDocumento(a.d,r,a.cb)).rejects.toThrow();});
 it('novo recálculo cria identidade, confere anterior e exige prévia correspondente',async()=>{const a=await inicial();principal(a.d).porcaoGramas='200';const r=await resolverEquivalenciasDocumento(a.d,a.contextos,a.cb);const c=comando('recalcular',a.c.aplicacaoId);alt(a.d).equivalencia=c;const novo=await resolverEquivalenciasDocumento(a.d,r,a.cb);expect(novo.a).toMatchObject({estado:'calculada_revisada',aplicacaoId:c.aplicacaoId});expect(a.cb.quantidade()).toBe(2);alt(a.d).equivalencia={...comando('recalcular',c.aplicacaoId),fingerprintEsperado:'b'.repeat(64)};await expect(resolverEquivalenciasDocumento(a.d,novo,a.cb)).rejects.toThrow();});
 it('desvinculação explícita preserva porção; omissão e replay não ressuscitam',async()=>{const a=await inicial();const c={acao:'desvincular',aplicacaoId:randomUUID(),anteriorAplicacaoId:a.c.aplicacaoId,fingerprintEsperado:a.contextos.a.fingerprintResolucao};alt(a.d).equivalencia=c;const r=await resolverEquivalenciasDocumento(a.d,a.contextos,a.cb);expect(r.a.estado).toBe('desvinculada_manualmente');expect(alt(a.d).equivalencia).toBeUndefined();expect(alt(a.d).porcaoGramas).toBe('100');const omitido=await resolverEquivalenciasDocumento(a.d,r,a.cb);expect(omitido.a.estado).toBe('desvinculada_manualmente');expect(alt(a.d).equivalencia).toBeUndefined();alt(a.d).equivalencia=c;expect((await resolverEquivalenciasDocumento(a.d,r,a.cb)).a.estado).toBe('desvinculada_manualmente');alt(a.d).equivalencia={aplicacaoId:a.c.aplicacaoId};await expect(resolverEquivalenciasDocumento(a.d,r,a.cb)).rejects.toThrow();});
 it('desvinculação registra o profissional que resolveu sem substituir autoria do cálculo',async()=>{const a=await inicial();const ator={usuarioId:randomUUID(),profissionalId:randomUUID()};alt(a.d).equivalencia={acao:'desvincular',aplicacaoId:randomUUID(),anteriorAplicacaoId:a.c.aplicacaoId,fingerprintEsperado:a.contextos.a.fingerprintResolucao};const r=await resolverEquivalenciasDocumento(a.d,a.contextos,{...a.cb,ator});expect(r.a.ator).toEqual(a.contextos.a.ator);expect(r.a.resolucao).toMatchObject({ator});});
 it('desvinculação exige autor atual também no domínio de consumo',async()=>{const a=await inicial();alt(a.d).equivalencia={acao:'desvincular',aplicacaoId:randomUUID(),anteriorAplicacaoId:a.c.aplicacaoId,fingerprintEsperado:a.contextos.a.fingerprintResolucao};await expect(resolverEquivalenciasDocumento(a.d,a.contextos,{...a.cb,ator:undefined})).rejects.toThrow();});
 it('identidade de desvinculação consumida não pode virar cálculo em outro filho',async()=>{const a=await inicial();const id=randomUUID();alt(a.d).equivalencia={acao:'desvincular',aplicacaoId:id,anteriorAplicacaoId:a.c.aplicacaoId,fingerprintEsperado:a.contextos.a.fingerprintResolucao};const r=await resolverEquivalenciasDocumento(a.d,a.contextos,a.cb);const b=clone(alt(a.d));b.chaveCliente='b';b.equivalencia={...comando(),aplicacaoId:id};principal(a.d).substituicoes.push(b);await expect(resolverEquivalenciasDocumento(a.d,r,a.cb)).rejects.toThrow();});
 it('não modifica mapas anteriores nem aceita mesmo ID em outro filho',async()=>{const a=await inicial(),anterior=JSON.stringify(a.contextos);principal(a.d).porcaoGramas='200';await resolverEquivalenciasDocumento(a.d,a.contextos,a.cb);expect(JSON.stringify(a.contextos)).toBe(anterior);const outra=clone(alt(a.d));outra.chaveCliente='b';outra.equivalencia=clone(a.c);principal(a.d).substituicoes.push(outra);await expect(resolverEquivalenciasDocumento(a.d,a.contextos,a.cb)).rejects.toThrow();});
});
