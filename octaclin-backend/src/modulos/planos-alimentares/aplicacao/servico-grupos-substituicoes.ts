import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'crypto';
import { EntityManager, In } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ConteudoGrupo, EntradaGrupo, EntradaGrupoSnapshot, SnapshotGrupo, UUID_GRUPO, validarConteudoGrupo, validarIntencaoGrupo, IntencaoGrupo } from '../dominio/grupos-substituicoes';
import { GrupoSubstituicoesOrm, FavoritoGrupoSubstituicoesOrm } from '../infraestrutura/grupo-substituicoes.orm';
import { CriarGrupoDto, AtualizarGrupoDto, ConsultarGruposDto, DuplicarGrupoDto, BuscarFontesGrupoDto } from './dtos-grupos-substituicoes';
import { identidadeBiblioteca } from './identidade-biblioteca-alimentos';
import { FontesGruposSubstituicoes } from './fontes-grupos-substituicoes';
interface AtorGrupo { profissionalId?: string; administrador: boolean }
@Injectable()
export class ServicoGruposSubstituicoes {
  constructor(private readonly executor: ExecutorTenant, private readonly crypto: CriptografiaDadosSensiveis, private readonly fontes: FontesGruposSubstituicoes) {}

  private validar<T extends object>(tipo: new () => T, valor: unknown): T {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new BadRequestException('Operação de grupo inválida.');
    const dto = plainToInstance(tipo, valor);
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException('Operação de grupo inválida.');
    return dto;
  }
  private uuid(id: string) { if (!UUID_GRUPO.test(id)) throw new BadRequestException('Referência de grupo inválida.'); }
  private async ator(g: EntityManager, tenantId: string, u: UsuarioAutenticado, escrita: boolean, administracao = false): Promise<AtorGrupo> {
    if (administracao) {
      if (u.tenantId !== tenantId || !['Client','SuperAdmin'].includes(u.papel) || !u.permissoes.includes('grupos_substituicoes.administrar')) throw new ForbiddenException('Administração de grupos não permitida.');
      return { administrador: true };
    }
    return { administrador: false, profissionalId: await identidadeBiblioteca(g, tenantId, u, escrita) };
  }
  private compartilhar(u: UsuarioAutenticado) {
    if (!u.permissoes.includes('grupos_substituicoes.compartilhar')) throw new ForbiddenException('Compartilhamento de grupos não permitido.');
  }
  private async autorizado(g: EntityManager, tenantId: string, ator: AtorGrupo, id: string, escrita = false) {
    this.uuid(id);
    const m = await g.getRepository(GrupoSubstituicoesOrm).findOne({ where: { tenantId, id }, lock: { mode: escrita ? 'pessimistic_write' : 'pessimistic_read' } });
    if (!m || (ator.administrador ? m.escopo !== 'clinica' : m.escopo !== 'clinica' && m.profissionalId !== ator.profissionalId) || (escrita && !ator.administrador && m.profissionalId !== ator.profissionalId)) throw new NotFoundException('Grupo não encontrado.');
    return m;
  }
  private ler(m: GrupoSubstituicoesOrm): SnapshotGrupo {
    try {
      const s = JSON.parse(this.crypto.descriptografar(m.conteudoCriptografado));
      if (s.schemaVersao !== 1 || !Array.isArray(s.entradas)) throw new Error();
      const c = validarConteudoGrupo({ nome:s.nome,descricao:s.descricao,categoria:s.categoria,etiquetas:s.etiquetas,entradas:s.entradas.map(({ composicao: _c,...e }: EntradaGrupoSnapshot) => e) });
      if (s.entradas.some((e: EntradaGrupoSnapshot) => !e.composicao || typeof e.composicao.descricao !== 'string' || !e.composicao.nutrientesPor100g)) throw new Error();
      if (s.origemCopia && (!UUID_GRUPO.test(s.origemCopia.grupoId) || !Number.isInteger(s.origemCopia.revisao) || s.origemCopia.revisao < 1)) throw new Error();
      return { ...c,schemaVersao:1,entradas:s.entradas,...(s.origemCopia?{origemCopia:s.origemCopia}:{}) };
    } catch { throw new ServiceUnavailableException('Grupo indisponível.'); }
  }
  private indices(tenantId: string, c: ConteudoGrupo) {
    return { buscaHashes:this.crypto.gerarHashesBuscaPii(tenantId,[c.nome]), categoriaHash:c.categoria?this.crypto.gerarHashPerfilExato(tenantId,'categoria',c.categoria):null,
      etiquetasHashes:c.etiquetas.map(t=>this.crypto.gerarHashPerfilExato(tenantId,'tag',t)) };
  }
  private async snapshot(g: EntityManager, tenantId: string, ator: AtorGrupo, escopo: 'pessoal'|'clinica', c: ConteudoGrupo, origemCopia?: SnapshotGrupo['origemCopia']): Promise<SnapshotGrupo> {
    const porId = new Map<string,EntradaGrupoSnapshot>();
    // Ordem estável dos locks de fontes em todos os escritores da biblioteca.
    for (const e of [...c.entradas].sort((a,b)=>`${a.origem}:${a.alimentoId}`.localeCompare(`${b.origem}:${b.alimentoId}`))) porId.set(e.id,await this.fontes.resolver(g,tenantId,ator.profissionalId,escopo,e));
    const s: SnapshotGrupo = { ...c,schemaVersao:1,entradas:c.entradas.map(e=>porId.get(e.id)!),...(origemCopia?{origemCopia}:{}) };
    if (Buffer.byteLength(JSON.stringify(s),'utf8') > 96*1024) throw new BadRequestException('Grupo excede o limite de conteúdo.');
    return s;
  }
  private async projetar(g: EntityManager, m: GrupoSubstituicoesOrm, ator: AtorGrupo, detalhe = true, favorito?: boolean) {
    if(favorito===undefined)favorito=ator.profissionalId?Boolean(await g.getRepository(FavoritoGrupoSubstituicoesOrm).findOne({where:{tenantId:m.tenantId,profissionalId:ator.profissionalId,grupoId:m.id}})):false;
    const s = this.ler(m);
    const resumo = { id:m.id,nome:s.nome,descricao:s.descricao,categoria:s.categoria,etiquetas:s.etiquetas,escopo:m.escopo,estado:m.estado,revisao:m.revisao,quantidadeEntradas:s.entradas.length,
      podeEditar:ator.administrador||m.profissionalId===ator.profissionalId,favorito };
    if (!detalhe) return { ...resumo, entradas: undefined as Array<Record<string,unknown>>|undefined };
    const entradas: Array<Record<string,unknown>> = [];
    for (const e of s.entradas) {
      let disponivel = m.estado==='ativo';
      try {
        const atual=await this.fontes.resolver(g,m.tenantId,ator.profissionalId,m.escopo,e);
        if(JSON.stringify(atual.composicao)!==JSON.stringify(e.composicao)) disponivel=false;
      } catch (erro) {
        if (erro instanceof NotFoundException) { entradas.push({ id:e.id,disponivel:false,motivo:'referencia_indisponivel' }); continue; }
        if (!(erro instanceof ConflictException)) throw erro;
        disponivel=false;
      }
      const c=e.composicao;
      entradas.push({ id:e.id,origem:e.origem,alimentoId:e.alimentoId,revisao:e.revisao,quantidade:e.quantidade,unidade:e.unidade,porcaoGramas:e.porcaoGramas,
        composicao:{descricao:c.descricao,nutrientesPor100g:c.nutrientesPor100g,micronutrientesPor100g:c.micronutrientesPor100g,fonte:c.fonte},disponivel,...(!disponivel?{motivo:'referencia_alterada_ou_indisponivel'}:{}) });
    }
    return { ...resumo,entradas };
  }
  async obter(tenantId: string,u: UsuarioAutenticado,id: string,administracao=false) {
    return this.executor.executar(tenantId,async g=>{const a=await this.ator(g,tenantId,u,false,administracao);return this.projetar(g,await this.autorizado(g,tenantId,a,id),a);});
  }
  async criar(tenantId: string,u: UsuarioAutenticado,entrada: CriarGrupoDto) {
    const d=this.validar(CriarGrupoDto,entrada);
    return this.executor.executar(tenantId,async g=>{const a=await this.ator(g,tenantId,u,true);return this.persistirCriacao(g,tenantId,u,a,d);});
  }
  async duplicar(tenantId: string,u: UsuarioAutenticado,id: string,entrada: DuplicarGrupoDto) {
    const d=this.validar(DuplicarGrupoDto,entrada);
    return this.executor.executar(tenantId,async g=>{
      const a=await this.ator(g,tenantId,u,true);
      const origem=await this.autorizado(g,tenantId,a,id);
      return this.persistirCriacao(g,tenantId,u,a,d,{grupoId:origem.id,revisao:d.revisaoEsperada},origem.revisao);
    });
  }
  private async persistirCriacao(g: EntityManager,tenantId: string,u: UsuarioAutenticado,a: AtorGrupo,d: CriarGrupoDto,origemCopia?: SnapshotGrupo['origemCopia'],revisaoAtualOrigem?: number) {
    d.chaveIdempotencia=d.chaveIdempotencia.toLowerCase();
    const escopo=d.escopo??'pessoal'; if(escopo==='clinica') this.compartilhar(u);
    const c=validarConteudoGrupo(d.conteudo), pedido=JSON.stringify({escopo,conteudo:c,...(origemCopia?{origemCopia}:{})});
    await g.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`food04:${tenantId}:${a.profissionalId}:${d.chaveIdempotencia}`]);
    const repo=g.getRepository(GrupoSubstituicoesOrm);
    const anterior=await repo.findOne({where:{tenantId,profissionalId:a.profissionalId!,chaveIdempotencia:d.chaveIdempotencia}});
    if(anterior) {
      let original:string;try {original=this.crypto.descriptografar(anterior.criacaoSnapshotCriptografado);}catch{throw new ServiceUnavailableException('Criação indisponível.');}
      if(original!==pedido) throw new ConflictException('Chave já utilizada com outros dados.');
      return this.projetar(g,anterior,a);
    }
    if(origemCopia&&origemCopia.revisao!==revisaoAtualOrigem) throw new ConflictException('Grupo original alterado. Confira a cópia.');
    if(origemCopia)c.entradas=c.entradas.map(e=>({...e,id:randomUUID()}));
    const s=await this.snapshot(g,tenantId,a,escopo,c,origemCopia);
    const m=await repo.save(repo.create({tenantId,profissionalId:a.profissionalId!,criadoPorUsuarioId:u.usuarioId,alteradoPorUsuarioId:u.usuarioId,chaveIdempotencia:d.chaveIdempotencia,escopo,estado:'ativo',revisao:1,
      conteudoCriptografado:this.crypto.criptografar(JSON.stringify(s)),criacaoSnapshotCriptografado:this.crypto.criptografar(pedido),...this.indices(tenantId,c)}));
    await this.auditar(g,u,m,origemCopia?'duplicar':'criar');return this.projetar(g,m,a);
  }
  async atualizar(tenantId: string,u: UsuarioAutenticado,id: string,entrada: AtualizarGrupoDto,administracao=false) {
    const d=this.validar(AtualizarGrupoDto,entrada);
    return this.executor.executar(tenantId,async g=>{
      const a=await this.ator(g,tenantId,u,true,administracao),m=await this.autorizado(g,tenantId,a,id,true);
      if(m.revisao!==d.revisaoEsperada||m.revisao>=2147483647) throw new ConflictException('Grupo alterado. Atualize a biblioteca.');
      const anterior=this.ler(m);let acao='editar';
      if(d.estado!==undefined) {m.estado=d.estado;acao=d.estado==='ativo'?'restaurar':'arquivar';}
      else {
        if(d.escopo) {if(a.administrador||m.escopo!=='pessoal'||m.estado!=='ativo')throw new ConflictException('Compartilhamento indisponível.');this.compartilhar(u);m.escopo='clinica';acao='compartilhar';}
        const c=d.conteudo?validarConteudoGrupo(d.conteudo):validarConteudoGrupo({nome:anterior.nome,descricao:anterior.descricao,categoria:anterior.categoria,etiquetas:anterior.etiquetas,entradas:anterior.entradas.map(({composicao:_c,...e})=>e)});
        const s=await this.snapshot(g,tenantId,a,m.escopo,c,anterior.origemCopia);
        m.conteudoCriptografado=this.crypto.criptografar(JSON.stringify(s));Object.assign(m,this.indices(tenantId,c));
      }
      m.revisao++;m.alteradoPorUsuarioId=u.usuarioId;
      await g.getRepository(GrupoSubstituicoesOrm).save(m);await this.auditar(g,u,m,acao,a.administrador);return this.projetar(g,m,a);
    });
  }
  async consultar(tenantId: string,u: UsuarioAutenticado,entrada: ConsultarGruposDto,administracao=false) {
    const q=this.validar(ConsultarGruposDto,entrada);
    return this.executor.executar(tenantId,async g=>{
      const a=await this.ator(g,tenantId,u,false,administracao),pagina=q.pagina??1,limite=q.limite??25;
      if(a.administrador&&(q.escopo==='pessoal'||q.favoritos!==undefined))throw new BadRequestException('Filtro indisponível na administração.');
      const query=g.getRepository(GrupoSubstituicoesOrm).createQueryBuilder('grupo').where('grupo.tenant_id=:tenantId',{tenantId});
      if(a.administrador||q.escopo==='clinica')query.andWhere("grupo.escopo='clinica'");
      else if(q.escopo==='pessoal')query.andWhere("grupo.escopo='pessoal' AND grupo.profissional_id=:profissionalId",{profissionalId:a.profissionalId});
      else query.andWhere("(grupo.escopo='clinica' OR (grupo.escopo='pessoal' AND grupo.profissional_id=:profissionalId))",{profissionalId:a.profissionalId});
      if(q.estado!=='todos')query.andWhere('grupo.estado=:estado',{estado:q.estado??'ativo'});
      if(q.busca!==undefined) {
        const hashes=this.crypto.gerarHashesConsultaPii(tenantId,q.busca),termos=q.busca.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().split(/\s+/);
        if(!hashes.length||termos.some(t=>t.length>32))throw new BadRequestException('Use palavras com 3 a 32 caracteres para buscar.');
        query.andWhere('grupo.busca_hashes @> :hashes',{hashes});
      }
      if(q.categoria!==undefined)query.andWhere('grupo.categoria_hash=:categoriaHash',{categoriaHash:this.crypto.gerarHashPerfilExato(tenantId,'categoria',q.categoria)});
      if(q.etiqueta!==undefined)query.andWhere('grupo.etiquetas_hashes @> :etiquetasHashes',{etiquetasHashes:[this.crypto.gerarHashPerfilExato(tenantId,'tag',q.etiqueta)]});
      if(!a.administrador) {
        query.leftJoin(FavoritoGrupoSubstituicoesOrm,'favorito','favorito.grupo_id=grupo.id AND favorito.tenant_id=:tenantId AND favorito.profissional_id=:profissionalId',{tenantId,profissionalId:a.profissionalId})
          .addSelect('CASE WHEN favorito.id IS NULL THEN 1 ELSE 0 END','ordem_favorito');
        if(q.favoritos===true)query.andWhere('favorito.id IS NOT NULL');
        query.orderBy('ordem_favorito','ASC');
      }
      query.addOrderBy('grupo.criado_em','DESC').addOrderBy('grupo.id','DESC').skip((pagina-1)*limite).take(limite);
      const [rows,total]=await query.getManyAndCount();
      const favoritos=a.profissionalId&&rows.length?new Set((await g.getRepository(FavoritoGrupoSubstituicoesOrm).find({where:{tenantId,profissionalId:a.profissionalId,grupoId:In(rows.map(m=>m.id))}})).map(f=>f.grupoId)):new Set<string>();
      return {itens:await Promise.all(rows.map(m=>this.projetar(g,m,a,false,favoritos.has(m.id)))),total,pagina,limite};
    });
  }
  async favoritar(tenantId: string,u: UsuarioAutenticado,id: string,favorito: boolean) {
    if(typeof favorito!=='boolean')throw new BadRequestException('Preferência inválida.');
    return this.executor.executar(tenantId,async g=>{
      const a=await this.ator(g,tenantId,u,true),m=await this.autorizado(g,tenantId,a,id);
      if(favorito) {
        if(m.estado!=='ativo')throw new ConflictException('Grupo arquivado.');
        await g.query('insert into favoritos_grupos_substituicoes(tenant_id,profissional_id,grupo_id) values($1,$2,$3) on conflict do nothing',[tenantId,a.profissionalId,m.id]);
      }else await g.getRepository(FavoritoGrupoSubstituicoesOrm).delete({tenantId,profissionalId:a.profissionalId,grupoId:m.id});
      return {grupoId:m.id,favorito};
    });
  }
  /** Participa da transação do plano; não abre outra conexão nem aceita contexto cliente. */
  async resolverAplicacao(g: EntityManager,tenantId: string,u: UsuarioAutenticado,intencao: IntencaoGrupo): Promise<EntradaGrupoSnapshot> {
    let ref:IntencaoGrupo;try{ref=validarIntencaoGrupo(intencao);}catch{throw new BadRequestException('Aplicação de grupo inválida.');}
    const a=await this.ator(g,tenantId,u,true),m=await this.autorizado(g,tenantId,a,ref.grupoId);
    if(m.estado!=='ativo'||m.revisao!==ref.revisao)throw new ConflictException('Grupo alterado ou arquivado. Confira a aplicação.');
    const e=this.ler(m).entradas.find(e=>e.id===ref.entradaId);
    if(!e)throw new ConflictException('Alternativa não pertence à revisão do grupo.');
    const atual=await this.fontes.resolver(g,tenantId,a.profissionalId,m.escopo,e);
    if(JSON.stringify(atual.composicao)!==JSON.stringify(e.composicao))throw new ConflictException('Referência de alimento alterada. Atualize o grupo.');
    return JSON.parse(JSON.stringify(e)) as EntradaGrupoSnapshot;
  }
  async consultarFontesAdministracao(tenantId: string,u: UsuarioAutenticado,entrada: BuscarFontesGrupoDto) {
    const q=this.validar(BuscarFontesGrupoDto,entrada);
    return this.executor.executar(tenantId,async g=>{await this.ator(g,tenantId,u,false,true);return this.fontes.consultarAdministracao(g,tenantId,q);});
  }
  private auditar(g: EntityManager,u: UsuarioAutenticado,m: GrupoSubstituicoesOrm,acao: string,administrativa=false) {
    return registrarAuditoriaNaTransacao(g,{tenantId:m.tenantId,usuarioId:u.usuarioId,acao:`grupo_substituicoes.${administrativa?'administracao.':''}${acao}`,recursoTipo:'grupo_substituicoes',recursoId:m.id,metadados:{versao:m.revisao}});
  }
}
