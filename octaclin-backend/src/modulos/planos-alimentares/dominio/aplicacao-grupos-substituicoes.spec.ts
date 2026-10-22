import { randomUUID } from 'crypto';
import { resolverGruposDocumento } from './aplicacao-grupos-substituicoes';
import { validarDocumentoEdicaoPlano, DocumentoEdicaoPlano } from './edicao-plano';
const principal=randomUUID(),alimento=randomUUID(),grupoId=randomUUID(),entradaId=randomUUID();
const intencao=()=>({grupoId,revisao:1,entradaId,aplicacaoId:randomUUID()});
const alternativa=(origemGrupo=intencao(),peso=30)=>({chaveCliente:randomUUID(),origemGrupo,porcaoGramas:peso,quantidade:1,unidade:'porção',preferida:true,liberadaParaPaciente:true,descricao:'adulterada',nutrientesPor100g:{energiaKcal:999}});
const documento=(alts:any[]=[]):DocumentoEdicaoPlano=>({schemaVersao:1,refeicoes:[{chaveCliente:'ref',itens:[{chaveCliente:'principal',alimentoComposicaoId:principal,substituicoes:alts}]}]});
const fonte=()=>({id:entradaId,origem:'catalogo' as const,alimentoId:alimento,quantidade:1,unidade:'porção',porcaoGramas:50,composicao:{descricao:'Alimento sintético',nutrientesPor100g:{energiaKcal:100}}});
describe('FOOD04 aplicação seletiva e cópia independente',()=>{
  it('aceita intenção fechada em documento editorial e rejeita metadado forjado',()=>{
    expect(()=>validarDocumentoEdicaoPlano(documento([alternativa()]))).not.toThrow();
    expect(()=>validarDocumentoEdicaoPlano(documento([{...alternativa(),origemGrupo:{...intencao(),confiavel:true}}]))).toThrow();
  });
  it('materializa só o selecionado, permite porção personalizada e não aceita composição/flags do cliente',async()=>{
    const alt=alternativa(),d=documento([alt]),resolver=jest.fn(async()=>fonte());
    const r=await resolverGruposDocumento(d,null,resolver);
    expect(d.refeicoes[0].itens[0].substituicoes).toHaveLength(1);
    expect(d.refeicoes[0].itens[0].substituicoes![0]).toMatchObject({descricao:'Alimento sintético',alimentoComposicaoId:alimento,porcaoGramas:30,preferida:false,liberadaParaPaciente:false});
    expect(r[alt.chaveCliente]).toMatchObject({grupoId,entradaId,revisao:1,porcaoAplicadaGramas:30});
  });
  it('não reinsere o principal nem duplicata exata; preserva alternativas anteriores',async()=>{
    const existente:any={chaveCliente:'antigo',alimentoComposicaoId:alimento,porcaoGramas:30,quantidade:1,unidade:'porção',preferida:true,liberadaParaPaciente:true};
    const d=documento([existente,alternativa()]);await resolverGruposDocumento(d,null,async()=>fonte());
    expect(d.refeicoes[0].itens[0].substituicoes).toEqual([existente]);
    const p=documento([alternativa()]);await resolverGruposDocumento(p,null,async()=>({...fonte(),alimentoId:principal}));expect(p.refeicoes[0].itens[0].substituicoes).toEqual([]);
  });
  it('divergência exige decisão explícita sem sobrescrever e selecionado inválido aborta',async()=>{
    const existente:any={chaveCliente:'antigo',alimentoComposicaoId:alimento,porcaoGramas:50,quantidade:1,unidade:'porção'};
    await expect(resolverGruposDocumento(documento([existente,alternativa()]),null,async()=>fonte())).rejects.toThrow(/porções diferentes/i);
    const d=documento([existente,{...alternativa(),origemGrupo:{...intencao(),confirmarPorcaoDistinta:true}}]);
    await resolverGruposDocumento(d,null,async()=>fonte());expect(d.refeicoes[0].itens[0].substituicoes).toHaveLength(2);
    await expect(resolverGruposDocumento(documento([alternativa(intencao(),0)]),null,async()=>fonte())).rejects.toThrow();
  });
  it('cópia já salva mantém flags/composição sem consultar grupo arquivado; novo nonce revalida',async()=>{
    const a=alternativa(),anterior=documento([a]);await resolverGruposDocumento(anterior,null,async()=>fonte());
    const d=JSON.parse(JSON.stringify(anterior)),resolver=jest.fn(async()=>{throw new Error('arquivado');});
    d.refeicoes[0].itens[0].substituicoes[0].liberadaParaPaciente=true;
    await resolverGruposDocumento(d,anterior,resolver);expect(resolver).not.toHaveBeenCalled();
    expect(d.refeicoes[0].itens[0].substituicoes[0].liberadaParaPaciente).toBe(true);
    d.refeicoes[0].itens[0].substituicoes[0].origemGrupo.aplicacaoId=randomUUID();
    await expect(resolverGruposDocumento(d,anterior,resolver)).rejects.toThrow('arquivado');
  });
  it('replay de ação com nova chave não duplica nem transplanta autorização de outro item',async()=>{
    const a=alternativa(),anterior=documento([a]);await resolverGruposDocumento(anterior,null,async()=>fonte());
    const d=JSON.parse(JSON.stringify(anterior));d.refeicoes[0].itens[0].substituicoes.push({...d.refeicoes[0].itens[0].substituicoes[0],chaveCliente:randomUUID()});
    await resolverGruposDocumento(d,anterior,async()=>fonte());expect(d.refeicoes[0].itens[0].substituicoes).toHaveLength(1);
    const outro=documento([]);outro.refeicoes[0].itens.push({chaveCliente:'outro',substituicoes:[JSON.parse(JSON.stringify(anterior.refeicoes[0].itens[0].substituicoes![0]))]});
    await expect(resolverGruposDocumento(outro,anterior,async()=>fonte())).rejects.toThrow(/aplicação/i);
  });
});

describe('FOOD04 bordas de identidade e porção física',()=>{
  it('bloqueia reutilizar a mesma ação/entrada em outro pai já no primeiro save', async () => {
    const ref = intencao(), d = documento([alternativa(ref)]);
    d.refeicoes[0].itens.push({ chaveCliente: 'segundo-pai', substituicoes: [alternativa(ref)] });
    const anterior = JSON.stringify(d);
    await expect(resolverGruposDocumento(d, null, async () => fonte())).rejects.toThrow(/outro item/i);
    expect(JSON.stringify(d)).toBe(anterior);
  });
  it('replay dentro do primeiro pedido resolve a entrada uma única vez', async () => {
    const ref = intencao(), d = documento([alternativa(ref), alternativa(ref)]);
    const resolver = jest.fn(async () => fonte());
    await resolverGruposDocumento(d, null, resolver);
    expect(d.refeicoes[0].itens[0].substituicoes).toHaveLength(1);
    expect(resolver).toHaveBeenCalledTimes(1);
  });
  it('não aceita trocar o alimento mantendo uma aplicação salva como autorização',async()=>{
    const a=alternativa(),anterior=documento([a]);await resolverGruposDocumento(anterior,null,async()=>fonte());
    const d=JSON.parse(JSON.stringify(anterior));d.refeicoes[0].itens[0].substituicoes[0].alimentoComposicaoId=randomUUID();
    const resolver=jest.fn(async()=>{throw new Error('revalidacao');});
    await expect(resolverGruposDocumento(d,anterior,resolver)).rejects.toThrow('revalidacao');
  });
  it('mesmo peso em gramas não duplica por mudar só o rótulo da medida',async()=>{
    const d=documento([{chaveCliente:'existente',alimentoComposicaoId:alimento,porcaoGramas:30,quantidade:30,unidade:'g'},alternativa()]);
    await resolverGruposDocumento(d,null,async()=>fonte());expect(d.refeicoes[0].itens[0].substituicoes).toHaveLength(1);
  });
});
