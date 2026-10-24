import { BuscarFontesGrupoDto } from './dtos-grupos-substituicoes';
import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ArrayContains, EntityManager } from 'typeorm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { EntradaGrupo, EntradaGrupoSnapshot } from '../dominio/grupos-substituicoes';
import { NutrientesPersonalizados, validarSnapshotPersonalizado } from '../dominio/alimentos-personalizados';
import { normalizarNutrientePor100g } from '../dominio/micronutrientes';
import { extrairMicronutrientesFonte } from '../dados/micronutrientes-fonte';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { AlimentoPersonalizadoOrm } from '../infraestrutura/alimento-personalizado.orm';
/** Interno: caller já validou identidade/tenant/ação. Nunca é controller público. */
@Injectable()
export class FontesGruposSubstituicoes {
  constructor(private readonly crypto: CriptografiaDadosSensiveis) {}
  async consultarAdministracao(g: EntityManager,tenantId: string,q: BuscarFontesGrupoDto) {
    const pagina=q.pagina??1,limite=q.limite??25;
    let rows:Array<{id:string;revisao?:number}>,total:number;
    if(q.origem==='custom'){
      const hashes=this.crypto.gerarHashesConsultaPii(tenantId,q.busca);
      if(!hashes.length||q.busca.split(/\s+/).some(t=>t.length>32))throw new BadRequestException('Busca de alimento inválida.');
      [rows,total]=await g.getRepository(AlimentoPersonalizadoOrm).findAndCount({where:{tenantId,escopo:'clinica',ativo:true,buscaHashes:ArrayContains(hashes)},order:{criadoEm:'DESC',id:'DESC'},skip:(pagina-1)*limite,take:limite});
    }else{
      const busca='%'+q.busca.replace(/[\\%_]/g,'\\$&')+'%';
      [rows,total]=await g.getRepository(AlimentoComposicaoOrm).createQueryBuilder('a')
        .innerJoin(FonteComposicaoAlimentoOrm,'f',"f.id=a.fonte_id AND f.situacao='ativa' AND f.direito_uso_status='aprovado'")
        .where('a.nome ILIKE :busca',{busca}).orderBy('a.nome','ASC').addOrderBy('a.id','ASC').skip((pagina-1)*limite).take(limite).getManyAndCount();
    }
    const itens=[];
    for(const row of rows){
      const r=await this.resolver(g,tenantId,undefined,'clinica',{id:row.id,origem:q.origem,alimentoId:row.id,...(q.origem==='custom'?{revisao:row.revisao}:{}),quantidade:1,unidade:'g',porcaoGramas:100});
      const c=r.composicao;
      itens.push({id:row.id,origem:q.origem,alimentoId:row.id,revisao:r.revisao,nome:c.descricao,composicao:{descricao:c.descricao,nutrientesPor100g:c.nutrientesPor100g,micronutrientesPor100g:c.micronutrientesPor100g,fonte:c.fonte}});
    }
    return {itens,total,pagina,limite};
  }
  async resolver(g: EntityManager,tenantId: string,profissionalId: string|undefined,escopo: 'pessoal'|'clinica',e: EntradaGrupo): Promise<EntradaGrupoSnapshot> {
    if(e.origem==='custom') {
      const a=await g.getRepository(AlimentoPersonalizadoOrm).findOne({where:{tenantId,id:e.alimentoId},lock:{mode:'pessimistic_read'}});
      if(!a||(a.escopo!=='clinica'&&(escopo==='clinica'||!profissionalId||a.profissionalId!==profissionalId)))throw new NotFoundException('Referência de alimento indisponível.');
      if(!a.ativo||a.revisao!==e.revisao)throw new ConflictException('Alimento alterado ou desativado.');
      try {
        const c=validarSnapshotPersonalizado(JSON.parse(this.crypto.descriptografar(a.conteudoCriptografado)));
        return {...e,composicao:{descricao:c.nome,nutrientesPor100g:c.nutrientesPor100g,micronutrientesPor100g:c.micronutrientesPor100g,composicaoCustom:c}};
      }catch{throw new ServiceUnavailableException('Composição indisponível.');}
    }
    const a=await g.getRepository(AlimentoComposicaoOrm).findOne({where:{id:e.alimentoId},lock:{mode:'pessimistic_read'}});
    if(!a)throw new NotFoundException('Referência de alimento indisponível.');
    const f=await g.getRepository(FonteComposicaoAlimentoOrm).findOne({where:{id:a.fonteId},lock:{mode:'pessimistic_read'}});
    if(!f||f.situacao!=='ativa'||f.direitoUsoStatus!=='aprovado')throw new ConflictException('Fonte indisponível para uso.');
    const base=Number(a.baseGramas);if(!Number.isFinite(base)||base<=0)throw new ConflictException('Composição indisponível.');
    const nutrientesPor100g:NutrientesPersonalizados={};
    for(const [campo,coluna]of Object.entries({energiaKcal:'energiaKcal',proteinasG:'proteinasG',carboidratosG:'carboidratosG',gordurasG:'lipidiosG',fibrasG:'fibrasG',sodioMg:'sodioMg'})) {
      const n=a[coluna as keyof AlimentoComposicaoOrm];
      if(n!==undefined&&n!==null){const valor=Number(n);if(!Number.isFinite(valor)||valor<0)throw new ConflictException('Composição indisponível.');nutrientesPor100g[campo as keyof NutrientesPersonalizados]=Math.round(valor*(100/base)*10000)/10000;}
    }
    const micros=extrairMicronutrientesFonte(f.codigo,f.esquemaVersao??'',a.micronutrientes);
    const micronutrientesPor100g=Object.fromEntries(Object.entries(micros).filter(([,v])=>v.estado==='conhecido'&&v.valor!==undefined).map(([k,v])=>[k,normalizarNutrientePor100g(v.valor!,base)]));
    return {...e,composicao:{descricao:a.nome,nutrientesPor100g,micronutrientesPor100g,fonte:{codigo:f.codigo,versao:f.versao,hashConteudo:f.hashConteudo}}};
  }
}
