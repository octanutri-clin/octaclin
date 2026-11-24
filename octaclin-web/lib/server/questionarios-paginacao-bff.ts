/** Shape validation and allowlist only; authorization and query semantics remain in the backend. */
export const UUID_QST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const contagem = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number)>=0;
const uuid = (v: unknown): v is string => typeof v==='string' && UUID_QST.test(v);
const tipos = ['texto_longo','sim_nao','likert','linear','metrica','multipla_escolha','upload_midia'];
function dataCivil(v: unknown): v is string {
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v<'0001-01-01')return false;
 const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===v;
}
export function filtrosPaginaQst(entrada: unknown, pagina=true): Record<string,string|number> {
 if(!objeto(entrada))throw new Error();
 const permitidos=pagina ? ['pacienteId','inicio','fim','tamanho','cursor'] : ['pacienteId','inicio','fim'];
 if(Object.keys(entrada).some(k=>!permitidos.includes(k)))throw new Error();
 const saida: Record<string,string|number>={};
 if(entrada.pacienteId!==undefined){if(!uuid(entrada.pacienteId))throw new Error();saida.pacienteId=entrada.pacienteId.toLowerCase();}
 for(const k of ['inicio','fim'])if(entrada[k]!==undefined){if(!dataCivil(entrada[k]))throw new Error();saida[k]=entrada[k];}
 if(saida.inicio&&saida.fim&&saida.inicio>saida.fim)throw new Error();
 if(pagina){
  const n=entrada.tamanho ?? 25;if(![25,50,100,'25','50','100'].includes(n as never))throw new Error();saida.tamanho=Number(n);
  if(entrada.cursor!==undefined){if(typeof entrada.cursor!=='string'||entrada.cursor.length>2048||!/^[A-Za-z0-9_-]+$/.test(entrada.cursor))throw new Error();saida.cursor=entrada.cursor;}
 }
 return saida;
}
export function corpoExportacaoQst(d:unknown) {
 if(!objeto(d)||Object.keys(d).some(k=>!['escopo','filtros','respostaIds'].includes(k))||!['visiveis','consulta','questionario'].includes(d.escopo as string))throw new Error();
 const filtros=d.filtros===undefined?undefined:filtrosPaginaQst(d.filtros,false);
 if(d.escopo==='questionario'&&filtros!==undefined)throw new Error();
 let respostaIds:string[]|undefined;
 if(d.escopo==='visiveis'){
  if(!Array.isArray(d.respostaIds)||!d.respostaIds.length||d.respostaIds.length>1000||!d.respostaIds.every(uuid))throw new Error();
  respostaIds=d.respostaIds.map(id=>id.toLowerCase());if(new Set(respostaIds).size!==respostaIds.length)throw new Error();
 }else if(d.respostaIds!==undefined)throw new Error();
 return {escopo:d.escopo as 'visiveis'|'consulta'|'questionario',...(filtros?{filtros}:{}),...(respostaIds?{respostaIds}:{})};
}
function dataHora(v:unknown): string|undefined {
 if(v===undefined)return undefined;
 if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw new Error();return v;
}
function projetarItem(v:unknown){
 if(!objeto(v)||!uuid(v.perguntaId)||typeof v.enunciado!=='string'||!tipos.includes(v.tipo as string))throw new Error();
 const valor=v.valor;
 if(!(valor===null||typeof valor==='string'||typeof valor==='boolean'||numero(valor)||(Array.isArray(valor)&&valor.every(x=>typeof x==='string'))))throw new Error();
 return {perguntaId:v.perguntaId,enunciado:v.enunciado,tipo:v.tipo,valor};
}
export function projetarPaginaQst(d:unknown,id:string,consulta:Record<string,string|number>) {
 if(!objeto(d)||d.questionarioId!==id||!objeto(d.filtros)||!contagem(d.totalConsulta)||typeof d.timezone!=='string')throw new Error();
 new Intl.DateTimeFormat('pt-BR',{timeZone:d.timezone});
 const filtros=filtrosPaginaQst(d.filtros); const esperados={...consulta};delete esperados.cursor;
 if(JSON.stringify(Object.entries(filtros).sort())!==JSON.stringify(Object.entries(esperados).sort()))throw new Error();
 if(d.proximoCursor!==null&&(typeof d.proximoCursor!=='string'||d.proximoCursor.length>2048||!/^[A-Za-z0-9_-]+$/.test(d.proximoCursor)))throw new Error();
 if(!Array.isArray(d.respostas)||d.respostas.length>Number(filtros.tamanho)||d.respostas.length>d.totalConsulta||!Array.isArray(d.pacientes)||!Array.isArray(d.perguntas)||!objeto(d.resumo))throw new Error();
 const respostas=d.respostas.map(r=>{
  if(!objeto(r)||!uuid(r.respostaId)||!uuid(r.envioId)||!uuid(r.pacienteId)||r.questionarioId!==id||!contagem(r.totalRespostas)||!Array.isArray(r.respostas)||r.respostas.length!==r.totalRespostas||r.respostas.length>1000)throw new Error();
  return {respostaId:r.respostaId,envioId:r.envioId,pacienteId:r.pacienteId,questionarioId:id,finalizadoEm:dataHora(r.finalizadoEm),totalRespostas:r.totalRespostas,respostas:r.respostas.map(projetarItem)};
 });
 if(new Set(respostas.map(r=>r.respostaId)).size!==respostas.length)throw new Error();
 const pacientes=d.pacientes.map(p=>{
  if(!objeto(p)||!uuid(p.pacienteId)||!contagem(p.totalRespostas)||!contagem(p.totalValoresRespondidos)||!numero(p.mediaRespostasPorEnvio))throw new Error();
  return {pacienteId:p.pacienteId,totalRespostas:p.totalRespostas,totalValoresRespondidos:p.totalValoresRespondidos,mediaRespostasPorEnvio:p.mediaRespostasPorEnvio,ultimaRespostaEm:dataHora(p.ultimaRespostaEm)};
 });
 const perguntas=d.perguntas.map(p=>{
  if(!objeto(p)||!uuid(p.perguntaId)||typeof p.enunciado!=='string'||!tipos.includes(p.tipo as string)||!contagem(p.totalRespostas)||!Array.isArray(p.textosRecentes)||p.textosRecentes.length>3||!p.textosRecentes.every(x=>typeof x==='string')||!Array.isArray(p.distribuicao))throw new Error();
  for(const k of ['totalSim','totalNao'])if(p[k]!==undefined&&!contagem(p[k]))throw new Error();
  if(p.mediaNumerica!==undefined&&!numero(p.mediaNumerica))throw new Error();
  return {perguntaId:p.perguntaId,enunciado:p.enunciado,tipo:p.tipo,totalRespostas:p.totalRespostas,totalSim:p.totalSim,totalNao:p.totalNao,mediaNumerica:p.mediaNumerica,textosRecentes:p.textosRecentes,distribuicao:p.distribuicao.map(v=>{if(!objeto(v)||typeof v.valor!=='string'||!contagem(v.total))throw new Error();return {valor:v.valor,total:v.total};})};
 });
 const r=d.resumo;
 if(r.totalRespostas!==respostas.length||r.totalPacientes!==pacientes.length||r.totalPerguntas!==perguntas.length||!numero(r.mediaRespostasPorEnvio))throw new Error();
 if(d.filtroPacienteId!==undefined&&d.filtroPacienteId!==filtros.pacienteId)throw new Error();
 return {questionarioId:id,filtroPacienteId:d.filtroPacienteId,filtros,timezone:d.timezone,totalConsulta:d.totalConsulta,proximoCursor:d.proximoCursor,
  resumo:{totalRespostas:r.totalRespostas,totalPacientes:r.totalPacientes,totalPerguntas:r.totalPerguntas,mediaRespostasPorEnvio:r.mediaRespostasPorEnvio,ultimaRespostaEm:dataHora(r.ultimaRespostaEm)},pacientes,perguntas,respostas};
}
