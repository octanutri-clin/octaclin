import { NextResponse } from 'next/server';
import { executarProxyPlanoAlimentar, lerCorpoLimitado, ErroCorpoAcimaDoLimite } from '../../pacientes/[id]/planos-alimentares/_proxy';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff } from '@/lib/server/sessao-bff';
import { CAMPOS_MICRONUTRIENTES_PLANO } from '@/lib/micronutrientes-plano';
const privado={'Cache-Control':'private, no-store'};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type OperacaoGrupo='fontes'|'consultar'|'obter'|'criar'|'atualizar'|'duplicar'|'favoritar'|'desfavoritar';
function objeto(v:unknown,campos:readonly string[]):Record<string,unknown>{
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!campos.includes(k)))throw new Error('Pedido inválido.');
  return v as Record<string,unknown>;
}
function texto(v:unknown,max:number,obrigatorio=false){return v===undefined&&!obrigatorio||typeof v==='string'&&v.length<=max&&(!obrigatorio||Boolean(v.trim()));}
function inteiro(v:unknown,min:number,max:number){return typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;}
function porcao(v:unknown){return typeof v==='number'&&Number.isFinite(v)&&v>=0.001&&v<=10000&&Number(v.toFixed(3))===v;}
function conteudo(v:unknown){
  const c=objeto(v,['nome','descricao','categoria','etiquetas','entradas']);
  if(!texto(c.nome,180,true)||!texto(c.descricao,2000)||!texto(c.categoria,80)||c.etiquetas!==undefined&&(!Array.isArray(c.etiquetas)||c.etiquetas.length>10||c.etiquetas.some(t=>!texto(t,40,true))))throw new Error();
  if(!Array.isArray(c.entradas)||!c.entradas.length||c.entradas.length>20)throw new Error();
  for(const valor of c.entradas){
    const e=objeto(valor,['id','origem','alimentoId','revisao','quantidade','unidade','porcaoGramas']);
    if(typeof e.id!=='string'||!UUID.test(e.id)||typeof e.alimentoId!=='string'||!UUID.test(e.alimentoId)||!['catalogo','custom'].includes(String(e.origem))||!porcao(e.quantidade)||!porcao(e.porcaoGramas)||!texto(e.unidade,40,true))throw new Error();
    if(e.origem==='custom'?!inteiro(e.revisao,1,2147483647):e.revisao!==undefined)throw new Error();
  }
}
function validarPedido(op:OperacaoGrupo,v:unknown){
  const chaves=op==='fontes'?['origem','busca','pagina','limite']:op==='consultar'?['pagina','limite','escopo','estado','favoritos','busca','categoria','etiqueta']:op==='atualizar'?['revisaoEsperada','conteudo','estado','escopo']:['chaveIdempotencia','escopo','conteudo',...(op==='duplicar'?['revisaoEsperada']:[])];
  const p=objeto(v,chaves);
  if(op==='fontes'){
    if(!['catalogo','custom'].includes(String(p.origem))||!texto(p.busca,120,true)||String(p.busca).trim().length<3||p.pagina!==undefined&&!inteiro(p.pagina,1,10000)||p.limite!==undefined&&!inteiro(p.limite,1,100))throw new Error();
    return p;
  }
  if(op==='consultar'){
    if(p.pagina!==undefined&&!inteiro(p.pagina,1,10000)||p.limite!==undefined&&!inteiro(p.limite,1,100)||p.favoritos!==undefined&&typeof p.favoritos!=='boolean'||p.escopo!==undefined&&!['pessoal','clinica'].includes(String(p.escopo))||p.estado!==undefined&&!['ativo','arquivado','todos'].includes(String(p.estado))||!texto(p.busca,180)||p.busca!==undefined&&String(p.busca).trim().length<3||!texto(p.categoria,80,true)&&p.categoria!==undefined||!texto(p.etiqueta,40,true)&&p.etiqueta!==undefined)throw new Error();
    return p;
  }
  if(op==='atualizar'){
    if(!inteiro(p.revisaoEsperada,1,2147483646)||['conteudo','estado','escopo'].filter(k=>p[k]!==undefined).length!==1||p.estado!==undefined&&!['ativo','arquivado'].includes(String(p.estado))||p.escopo!==undefined&&p.escopo!=='clinica')throw new Error();
    if(p.conteudo!==undefined)conteudo(p.conteudo);
  }else{
    if(typeof p.chaveIdempotencia!=='string'||!UUID.test(p.chaveIdempotencia)||p.escopo!==undefined&&!['pessoal','clinica'].includes(String(p.escopo))||op==='duplicar'&&!inteiro(p.revisaoEsperada,1,2147483646))throw new Error();
    conteudo(p.conteudo);
  }
  return p;
}
function selecionar(v:unknown,chaves:readonly string[]){const o=v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};return Object.fromEntries(chaves.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));}
function numeros(v:unknown,chaves:readonly string[]){const n=selecionar(v,chaves);if(Object.values(n).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))throw new Error();return n;}
function composicaoPublica(valor:unknown){
  const c=selecionar(valor,['descricao','nutrientesPor100g','micronutrientesPor100g','fonte']);
  if(!texto(c.descricao,240,true))throw new Error();
  c.nutrientesPor100g=numeros(c.nutrientesPor100g,['energiaKcal','proteinasG','carboidratosG','gordurasG','fibrasG','sodioMg']);
  if(c.micronutrientesPor100g!==undefined)c.micronutrientesPor100g=numeros(c.micronutrientesPor100g,CAMPOS_MICRONUTRIENTES_PLANO.map(m=>m.codigo));
  if(c.fonte!==undefined){const f=selecionar(c.fonte,['codigo','versao','hashConteudo']);if(!texto(f.codigo,80,true)||!texto(f.versao,80,true)||typeof f.hashConteudo!=='string'||!/^[a-f0-9]{64}$/i.test(f.hashConteudo))throw new Error();c.fonte=f;}
  return c;
}
function projetarFonte(valor:unknown){
  const f=selecionar(valor,['id','origem','alimentoId','revisao','composicao']);
  if(typeof f.id!=='string'||!UUID.test(f.id)||typeof f.alimentoId!=='string'||!UUID.test(f.alimentoId)||!['catalogo','custom'].includes(String(f.origem))||f.origem==='custom'&&!inteiro(f.revisao,1,2147483647))throw new Error();
  f.composicao=composicaoPublica(f.composicao);
  return {...f,nome:(f.composicao as Record<string,unknown>).descricao};
}
function projetarGrupo(v:unknown,administracao=false){
  const g=selecionar(v,['id','nome','descricao','categoria','etiquetas','escopo','estado','revisao','quantidadeEntradas','podeEditar','favorito','entradas']);
  if(typeof g.id!=='string'||!UUID.test(g.id)||!texto(g.nome,180,true)||!['pessoal','clinica'].includes(String(g.escopo))||!['ativo','arquivado'].includes(String(g.estado))||!inteiro(g.revisao,1,2147483647)||!inteiro(g.quantidadeEntradas,1,20)||typeof g.podeEditar!=='boolean'||typeof g.favorito!=='boolean')throw new Error();
  if(administracao&&g.escopo!=='clinica'||!texto(g.descricao,2000)||!texto(g.categoria,80)||g.etiquetas!==undefined&&(!Array.isArray(g.etiquetas)||g.etiquetas.some(t=>!texto(t,40,true))))throw new Error();
  if(g.etiquetas===undefined)g.etiquetas=[];
  if(g.entradas!==undefined){
    if(!Array.isArray(g.entradas)||g.entradas.length>20)throw new Error();
    g.entradas=g.entradas.map(valor=>{
      const e=selecionar(valor,['id','origem','alimentoId','revisao','quantidade','unidade','porcaoGramas','disponivel','motivo']);
      if(typeof e.id!=='string'||!UUID.test(e.id)||typeof e.disponivel!=='boolean')throw new Error();
      if(e.alimentoId===undefined){if(e.disponivel!==false)throw new Error();return {id:e.id,disponivel:false,motivo:'referencia_indisponivel'};}
      if(typeof e.alimentoId!=='string'||!UUID.test(e.alimentoId)||!['catalogo','custom'].includes(String(e.origem))||!porcao(e.quantidade)||!porcao(e.porcaoGramas)||!texto(e.unidade,40,true)||e.origem==='custom'&&!inteiro(e.revisao,1,2147483647))throw new Error();
      e.composicao=composicaoPublica((valor as Record<string,unknown>).composicao);
      return e;
    });
  }
  return g;
}
export async function encaminharGrupo(request:Request,op:OperacaoGrupo,id?:string,administracao=false){
  const permissao=administracao?'grupos_substituicoes.administrar':op==='consultar'||op==='obter'?'planos_alimentares.ler':'planos_alimentares.gerenciar';
  try{
    await exigirPermissaoBff(permissao);
    if(id!==undefined&&!UUID.test(id))return NextResponse.json({mensagem:'Identificador de grupo inválido.'},{status:400,headers:privado});
    let body:string|undefined;
    if(['fontes','consultar','criar','atualizar','duplicar'].includes(op)){
      const bruto=await lerCorpoLimitado(request,64*1024);
      try{body=JSON.stringify(validarPedido(op,JSON.parse(bruto)));}catch{return NextResponse.json({mensagem:'Solicitação de grupo inválida.'},{status:400,headers:privado});}
    }
    const base=`/planos-alimentares/${administracao?'grupos-substituicoes-administracao':'grupos-substituicoes'}`;
    const caminho=base+(id?`/${encodeURIComponent(id)}`:'')+(op==='fontes'?'/alimentos/consulta':op==='consultar'?'/consulta':op==='duplicar'?'/duplicar':op==='favoritar'||op==='desfavoritar'?'/favorito':'');
    const method=op==='obter'?'GET':op==='atualizar'?'PATCH':op==='desfavoritar'?'DELETE':'POST';
    const resposta=await executarProxyPlanoAlimentar(caminho,permissao,{method,...(body!==undefined?{headers:{'Content-Type':'application/json'},body}:{})},64*1024);
    if(!resposta.ok)return NextResponse.json({mensagem:resposta.status===409?'Grupo alterado ou indisponível. Atualize e confira novamente.':'Não foi possível concluir a operação de grupo.'},{status:resposta.status,headers:privado});
    const dados=JSON.parse(await lerCorpoLimitado(resposta,512*1024));
    let publico:unknown;
    if(op==='consultar'||op==='fontes'){
      if(!Array.isArray(dados.itens)||dados.itens.length>100||!inteiro(dados.total,0,Number.MAX_SAFE_INTEGER)||!inteiro(dados.pagina,1,10000)||!inteiro(dados.limite,1,100))throw new Error();
      publico={itens:dados.itens.map((g:unknown)=>op==='fontes'?projetarFonte(g):projetarGrupo(g,administracao)),...selecionar(dados,['total','pagina','limite'])};
    }else if(op==='favoritar'||op==='desfavoritar'){
      if(typeof dados.grupoId!=='string'||!UUID.test(dados.grupoId)||typeof dados.favorito!=='boolean')throw new Error();
      publico=selecionar(dados,['grupoId','favorito']);
    }else publico=projetarGrupo(dados,administracao);
    return NextResponse.json(publico,{status:resposta.status,headers:privado});
  }catch(erro){
    const status=erro instanceof ErroSessaoAusente?401:erro instanceof ErroPermissaoAusente?403:erro instanceof ErroCorpoAcimaDoLimite?413:503;
    return NextResponse.json({mensagem:status===413?'Solicitação acima do limite.':'Operação de grupos indisponível.'},{status,headers:privado});
  }
}
