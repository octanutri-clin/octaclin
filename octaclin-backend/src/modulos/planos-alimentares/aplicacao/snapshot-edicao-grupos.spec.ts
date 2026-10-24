import { validarDocumentoEdicaoPlano } from '../dominio/edicao-plano';
import { lerSnapshotEdicaoGrupos, serializarSnapshotEdicaoGrupos } from './snapshot-edicao-grupos';

const alimentoId='10000000-0000-4000-8000-000000000001';
const ref={grupoId:alimentoId,entradaId:'10000000-0000-4000-8000-000000000002',aplicacaoId:'10000000-0000-4000-8000-000000000003',revisao:1};
const documento=()=>validarDocumentoEdicaoPlano({schemaVersao:1,refeicoes:[{chaveCliente:'refeicao',nome:'Fixture',itens:[{chaveCliente:'item',substituicoes:[{chaveCliente:'alternativa',alimentoComposicaoId:alimentoId,origemGrupo:ref,quantidade:1,unidade:'g',porcaoGramas:50}]}]}]});
const contexto=()=>({itemChave:'item',origemGrupo:ref,snapshot:{origem:'catalogo' as const,alimentoComposicaoId:alimentoId,descricao:'Fixture',fonte:{codigo:'SINT',nome:'Fixture',versao:'1',hashConteudo:'a'.repeat(64)},nutrientesPor100g:{energiaKcal:100,proteinasG:5,carboidratosG:10,gordurasG:2},nutrientesPorcao:{energiaKcal:50,proteinasG:2.5,carboidratosG:5,gordurasG:1}}});

describe('envelope interno de snapshots de grupos',()=>{
  it('le documentos schema1 existentes sem fabricar contexto',()=>{
    expect(lerSnapshotEdicaoGrupos(documento())).toEqual({documento:documento(),catalogos:{}});
  });
  it('preserva contexto schema2 sem torna-lo um documento aceito do cliente',()=>{
    const envelope=JSON.parse(serializarSnapshotEdicaoGrupos(documento(),{alternativa:contexto()}));
    expect(lerSnapshotEdicaoGrupos(envelope)).toEqual({documento:documento(),catalogos:{alternativa:contexto()}});
    expect(()=>validarDocumentoEdicaoPlano(envelope)).toThrow();
  });
  it.each(['pai','alimento','aplicacao','nutrientes','versao'])('recusa contexto interno divergente: %s',campo=>{
    const envelope=JSON.parse(serializarSnapshotEdicaoGrupos(documento(),{alternativa:contexto()}));
    const c=envelope.catalogosGrupos.alternativa;
    if(campo==='pai')c.itemChave='outro-item';
    if(campo==='alimento')c.snapshot.alimentoComposicaoId=ref.entradaId;
    if(campo==='aplicacao')c.origemGrupo.aplicacaoId=ref.entradaId;
    if(campo==='nutrientes')c.snapshot.nutrientesPor100g.energiaKcal=-1;
    if(campo==='versao')envelope.schemaSnapshotEdicao=3;
    expect(()=>lerSnapshotEdicaoGrupos(envelope)).toThrow();
  });
});
