import { classificarPediatriaIsolada } from './classificador-pediatrico-isolado';
const c={confirmado:true as const,nascimento:'2024-01-01',sexoCurva:'masculino' as const,tecnica:'deitado' as const,edema:'nao' as const,nascimentoTipo:'a_termo' as const,tipoMedida:'pos_natal' as const};
const fonte={id:'SINTETICA-NAO-ASSISTENCIAL',hash:'0'.repeat(64),l:1,m:10,s:.1,caudas:true};
describe('motor integrado REV9 isolado: referências injetadas exclusivamente sintéticas',()=>{
  it('A08/A17 admite peso independente, não imputa contexto',()=>{
    const r=classificarPediatriaIsolada({contexto:c,avalia:'2024-06-01',pesoKg:10},()=>fonte);
    expect(r.peso_idade).toMatchObject({estado:'experimental',zBruto:0,classificacao:'peso_adequado_para_idade'});
    expect(r.imc_idade.estado).toBe('bloqueado');
    const edema=classificarPediatriaIsolada({contexto:{...c,edema:'desconhecido'},avalia:'2024-06-01',pesoKg:10,alturaCm:80},()=>({...fonte,m:80}));
    expect(edema.peso_idade.motivo).toBe('edema_nao_avaliado');expect(edema.estatura_idade.estado).toBe('experimental');
  });
  it('A06 permite WFA, bloqueia três indicadores lineares em pé antes9m',()=>{
    const r=classificarPediatriaIsolada({contexto:{...c,tecnica:'em_pe'},avalia:'2024-06-01',pesoKg:10,alturaCm:80},()=>fonte);
    expect(r.peso_idade.estado).toBe('experimental');expect(r.estatura_idade.motivo).toBe('tecnica_exige_reconferencia');
  });
  it('A13/A14 bloqueia IG sem confirmar contexto, sem afetar medidas',()=>{
    const r=classificarPediatriaIsolada({contexto:{...c,nascimentoTipo:'prematuro',semanasNascimento:30,diasNascimento:0,origemGestacional:'documentada'},avalia:'2024-01-02',pesoKg:1},()=>fonte);
    expect(r.peso_idade.motivo).toBe('medida_neonatal_fora_do_pos_natal');
  });
  it('A18 mostra z técnico flagado sem percentil/categoria, gestação precede',()=>{
    const r=classificarPediatriaIsolada({contexto:c,avalia:'2024-06-01',pesoKg:16.01},()=>fonte);
    expect(r.peso_idade).toMatchObject({estado:'reconferir',motivo:'flag_estatistica'});expect(r.peso_idade.classificacao).toBeUndefined();
    expect(classificarPediatriaIsolada({contexto:c,avalia:'2024-06-01',pesoKg:10,gestante:true},()=>fonte).peso_idade.motivo).toBe('contexto_gestacional');
  });
  it('nunca busca rede, aceita dados científicos ausentes sem fabricar referência',()=>{
    expect(classificarPediatriaIsolada({contexto:c,avalia:'2024-06-01',pesoKg:10},()=>undefined).peso_idade.motivo).toBe('referencia_ausente');
    expect(classificarPediatriaIsolada({contexto:{...c,nascimentoTipo:'nao_informado'},avalia:'2024-06-01',pesoKg:10},()=>fonte).peso_idade.motivo).toBe('contexto_nascimento_indeterminado');
  });
  it('altura/idade usa LMS sem caudas ajustadas mesmo com provider incorreto',()=>{
    const r=classificarPediatriaIsolada({contexto:c,avalia:'2024-06-01',alturaCm:115.2},()=>({...fonte,l:.5,m:80,s:.1,caudas:true}));
    expect(r.estatura_idade.zBruto).toBeCloseTo(4,12);
  });
});
