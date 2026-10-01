import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, In, IsNull } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import type { PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { CHAVE_KIT_INICIAL_CLINICA, VERSAO_KIT_INICIAL_CLINICA } from '../../tenancy/kit-inicial-clinica';
import { listarEstruturasIniciaisPlano } from '../dominio/estruturas-iniciais-plano';
import {
  contarEstruturaModelo,
  podeAcessarModelo,
  resumirAlimentosDoModelo,
  type OrigemModeloPlanoAlimentar,
  type RefeicaoModeloPlanoAlimentar
} from '../dominio/modelos-plano-alimentar';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { ModeloPlanoAlimentarOrm } from '../infraestrutura/modelo-plano-alimentar.orm';
import {
  CriarModeloPlanoAlimentarDto,
  EditarModeloPlanoAlimentarDto,
  ListarModelosPlanoAlimentarDto,
  ListarVersoesModeloPlanoAlimentarDto,
  PAGINA_MAXIMA
} from './dtos';
import { RevisaoModeloPlanoAlimentarOrm } from '../infraestrutura/revisao-modelo-plano-alimentar.orm';

/**
 * Modelos reutilizaveis de plano alimentar.
 *
 * Aplicar um modelo nao tem rota propria de proposito: o cliente le o modelo e
 * envia as refeicoes pelo salvamento de rascunho que ja existe, que e onde a
 * composicao e resolvida contra o catalogo e a fonte inativa e recusada. Uma
 * rota de aplicacao duplicaria essa validacao — e duplicar validacao clinica e
 * como duas passam a divergir.
 */
@Injectable()
export class ServicoModelosPlanoAlimentar {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async criar(tenantId: string, usuario: UsuarioAutenticado, dados: CriarModeloPlanoAlimentarDto) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    const refeicoes = dados.refeicoes as unknown as RefeicaoModeloPlanoAlimentar[];
    const { totalRefeicoes, totalItens } = contarEstruturaModelo(refeicoes);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
      if (dados.origem === 'pessoal' && !profissionalId) {
        throw new ForbiddenException('Modelo pessoal exige um profissional vinculado ao usuario.');
      }
      const repositorio = gerenciador.getRepository(ModeloPlanoAlimentarOrm);
      const modelo = repositorio.create({
        tenantId,
        origem: dados.origem,
        // Modelo da clinica nunca guarda profissional: preso a um, ele deixaria
        // de ser compartilhado no dia em que esse profissional saisse.
        profissionalId: dados.origem === 'pessoal' ? profissionalId : undefined,
        nomeCriptografado: this.criptografia.criptografar(dados.nome.trim()),
        conteudoCriptografado: this.criptografia.criptografar(JSON.stringify(refeicoes)),
        totalRefeicoes,
        totalItens,
        versaoAtual: 1,
        criadoPorUsuarioId: usuario.usuarioId
      });
      await repositorio.save(modelo);
      await this.persistirRevisao(gerenciador, modelo, 1, usuario.usuarioId);
      await this.registrarAuditoria(gerenciador, {
        tenantId,
        usuario,
        acao: 'planos_alimentares.modelo_criar',
        modeloId: modelo.id,
        metadados: { origem: dados.origem, totalRefeicoes, totalItens }
      });
      return { id: modelo.id, nome: dados.nome.trim(), origem: dados.origem, totalRefeicoes, totalItens, versaoAtual: 1 };
    });
  }

  async listar(
    tenantId: string,
    usuario: UsuarioAutenticado,
    consulta: ListarModelosPlanoAlimentarDto = new ListarModelosPlanoAlimentarDto()
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    const pagina = Math.min(PAGINA_MAXIMA, Math.max(1, Math.trunc(consulta.pagina ?? 1)));
    const limite = Math.min(100, Math.max(1, Math.trunc(consulta.limite ?? 25)));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
      const [modelos, total] = await gerenciador.getRepository(ModeloPlanoAlimentarOrm).findAndCount({
        where: this.montarFiltroVisibilidade(tenantId, usuario, profissionalId, consulta.origem),
        // `id` desempata: `atualizado_em` usa default now() e empata entre
        // modelos salvos na mesma transacao, o que faria OFFSET repetir ou pular.
        order: { atualizadoEm: 'DESC', id: 'DESC' },
        skip: (pagina - 1) * limite,
        take: limite
      });
      const kit = await gerenciador.getRepository(TenantConfiguracaoOrm).findOne({
        where: { tenantId, chave: CHAVE_KIT_INICIAL_CLINICA }
      });
      return {
        itens: modelos.map((modelo) => ({
          id: modelo.id,
          // So o nome e descriptografado na listagem; o conteudo fica fechado
          // ate alguem abrir um modelo especifico.
          nome: this.criptografia.descriptografar(modelo.nomeCriptografado),
          origem: modelo.origem,
          totalRefeicoes: modelo.totalRefeicoes,
          totalItens: modelo.totalItens,
          versaoAtual: modelo.versaoAtual ?? 1,
          atualizadoEm: modelo.atualizadoEm
        })),
        total,
        pagina,
        limite,
        estruturasIniciais: kit?.valor?.versao === VERSAO_KIT_INICIAL_CLINICA
          ? listarEstruturasIniciaisPlano()
          : []
      };
    });
  }

  async obter(tenantId: string, modeloId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const modelo = await this.obterNoEscopo(gerenciador, tenantId, modeloId, usuario);
      const refeicoes = JSON.parse(
        this.criptografia.descriptografar(modelo.conteudoCriptografado)
      ) as RefeicaoModeloPlanoAlimentar[];
      return {
        id: modelo.id,
        nome: this.criptografia.descriptografar(modelo.nomeCriptografado),
        origem: modelo.origem,
        totalRefeicoes: modelo.totalRefeicoes,
        totalItens: modelo.totalItens,
        versaoAtual: modelo.versaoAtual ?? 1,
        refeicoes,
        // Avisa antes de aplicar. Sem isso o profissional so descobriria o
        // problema no salvamento, num erro que nao diz qual item quebrou.
        alimentosIndisponiveis: await this.detectarAlimentosIndisponiveis(gerenciador, refeicoes)
      };
    });
  }

  async editar(
    tenantId: string,
    modeloId: string,
    usuario: UsuarioAutenticado,
    dados: EditarModeloPlanoAlimentarDto
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    const refeicoes = dados.refeicoes as unknown as RefeicaoModeloPlanoAlimentar[];
    const { totalRefeicoes, totalItens } = contarEstruturaModelo(refeicoes);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.bloquearModelo(gerenciador, tenantId, modeloId);
      const modelo = await this.obterNoEscopo(gerenciador, tenantId, modeloId, usuario);
      const versaoAtual = modelo.versaoAtual ?? 1;
      if (dados.versaoEsperada !== versaoAtual) {
        throw new ConflictException('O modelo foi alterado. Recarregue o historico antes de salvar.');
      }

      const revisoes = gerenciador.getRepository(RevisaoModeloPlanoAlimentarOrm);
      const revisaoAtual = await revisoes.findOne({ where: { tenantId, modeloId, numero: versaoAtual } });
      if (!revisaoAtual) await this.persistirRevisao(gerenciador, modelo, versaoAtual, usuario.usuarioId);

      modelo.nomeCriptografado = this.criptografia.criptografar(dados.nome.trim());
      modelo.conteudoCriptografado = this.criptografia.criptografar(JSON.stringify(refeicoes));
      modelo.totalRefeicoes = totalRefeicoes;
      modelo.totalItens = totalItens;
      modelo.versaoAtual = versaoAtual + 1;
      await gerenciador.getRepository(ModeloPlanoAlimentarOrm).save(modelo);
      await this.persistirRevisao(gerenciador, modelo, modelo.versaoAtual, usuario.usuarioId);
      await this.registrarAuditoria(gerenciador, {
        tenantId, usuario, acao: 'planos_alimentares.modelo_editar', modeloId,
        metadados: { versao: modelo.versaoAtual, totalRefeicoes, totalItens }
      });
      return { id: modelo.id, versaoAtual: modelo.versaoAtual, totalRefeicoes, totalItens };
    });
  }

  async listarVersoes(
    tenantId: string,
    modeloId: string,
    usuario: UsuarioAutenticado,
    consulta: ListarVersoesModeloPlanoAlimentarDto
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    const pagina = Math.min(PAGINA_MAXIMA, Math.max(1, Math.trunc(consulta.pagina ?? 1)));
    const limite = Math.min(100, Math.max(1, Math.trunc(consulta.limite ?? 25)));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const modelo = await this.obterNoEscopo(gerenciador, tenantId, modeloId, usuario);
      const repositorio = gerenciador.getRepository(RevisaoModeloPlanoAlimentarOrm);
      const [revisoes, quantidade] = await repositorio.findAndCount({
        where: { tenantId, modeloId }, order: { numero: 'DESC' }, skip: (pagina - 1) * limite, take: limite
      });
      if (quantidade === 0 && (modelo.versaoAtual ?? 1) === 1) {
        const legado = {
          id: `${modelo.id}:1`, numero: 1,
          nome: this.criptografia.descriptografar(modelo.nomeCriptografado),
          totalRefeicoes: modelo.totalRefeicoes, totalItens: modelo.totalItens,
          criadoEm: modelo.atualizadoEm
        };
        return { itens: pagina === 1 ? [legado] : [], total: 1, pagina, limite };
      }
      return {
        itens: revisoes.map((revisao) => ({
          id: revisao.id, numero: revisao.numero,
          nome: this.criptografia.descriptografar(revisao.nomeCriptografado),
          totalRefeicoes: revisao.totalRefeicoes, totalItens: revisao.totalItens, criadoEm: revisao.criadoEm
        })),
        total: quantidade, pagina, limite
      };
    });
  }

  async obterVersao(tenantId: string, modeloId: string, numero: number, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const modelo = await this.obterNoEscopo(gerenciador, tenantId, modeloId, usuario);
      const revisao = await gerenciador.getRepository(RevisaoModeloPlanoAlimentarOrm).findOne({
        where: { tenantId, modeloId, numero }
      });
      const snapshot = revisao ?? ((numero === 1 && (modelo.versaoAtual ?? 1) === 1)
        ? modelo
        : undefined);
      if (!snapshot) throw new NotFoundException('Versao do modelo nao encontrada.');
      const refeicoes = JSON.parse(this.criptografia.descriptografar(snapshot.conteudoCriptografado)) as RefeicaoModeloPlanoAlimentar[];
      return {
        id: revisao?.id ?? `${modelo.id}:1`, numero,
        nome: this.criptografia.descriptografar(snapshot.nomeCriptografado),
        totalRefeicoes: snapshot.totalRefeicoes, totalItens: snapshot.totalItens,
        criadoEm: revisao?.criadoEm ?? modelo.atualizadoEm,
        refeicoes,
        alimentosIndisponiveis: await this.detectarAlimentosIndisponiveis(gerenciador, refeicoes)
      };
    });
  }

  async restaurarVersao(
    tenantId: string,
    modeloId: string,
    numero: number,
    usuario: UsuarioAutenticado,
    versaoEsperada: number
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.bloquearModelo(gerenciador, tenantId, modeloId);
      const modelo = await this.obterNoEscopo(gerenciador, tenantId, modeloId, usuario);
      const versaoAtual = modelo.versaoAtual ?? 1;
      if (versaoEsperada !== versaoAtual) {
        throw new ConflictException('O modelo foi alterado. Recarregue o historico antes de restaurar.');
      }
      const revisoes = gerenciador.getRepository(RevisaoModeloPlanoAlimentarOrm);
      const origem = await revisoes.findOne({ where: { tenantId, modeloId, numero } });
      const snapshot = origem ?? ((numero === 1 && versaoAtual === 1) ? modelo : undefined);
      if (!snapshot) throw new NotFoundException('Versao do modelo nao encontrada.');
      if (!origem) await this.persistirRevisao(gerenciador, modelo, 1, usuario.usuarioId);

      modelo.nomeCriptografado = Buffer.from(snapshot.nomeCriptografado);
      modelo.conteudoCriptografado = Buffer.from(snapshot.conteudoCriptografado);
      modelo.totalRefeicoes = snapshot.totalRefeicoes;
      modelo.totalItens = snapshot.totalItens;
      modelo.versaoAtual = versaoAtual + 1;
      await gerenciador.getRepository(ModeloPlanoAlimentarOrm).save(modelo);
      await this.persistirRevisao(gerenciador, modelo, modelo.versaoAtual, usuario.usuarioId);
      await this.registrarAuditoria(gerenciador, {
        tenantId, usuario, acao: 'planos_alimentares.modelo_restaurar', modeloId,
        metadados: { versao: modelo.versaoAtual, totalRefeicoes: modelo.totalRefeicoes, totalItens: modelo.totalItens }
      });
      return { id: modelo.id, versaoAtual: modelo.versaoAtual, totalRefeicoes: modelo.totalRefeicoes, totalItens: modelo.totalItens };
    });
  }

  async arquivar(tenantId: string, modeloId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.bloquearModelo(gerenciador, tenantId, modeloId);
      const modelo = await this.obterNoEscopo(gerenciador, tenantId, modeloId, usuario);
      modelo.arquivadoEm = new Date();
      await gerenciador.getRepository(ModeloPlanoAlimentarOrm).save(modelo);
      await this.registrarAuditoria(gerenciador, {
        tenantId,
        usuario,
        acao: 'planos_alimentares.modelo_arquivar',
        modeloId: modelo.id,
        metadados: { origem: modelo.origem }
      });
      return { id: modelo.id, arquivadoEm: modelo.arquivadoEm };
    });
  }

  private async bloquearModelo(gerenciador: EntityManager, tenantId: string, modeloId: string): Promise<void> {
    // A checagem de versao ocorre depois do lock e na mesma transacao tenant,
    // serializando edicoes/restauracoes concorrentes do mesmo modelo.
    await gerenciador.query(
      'select id from modelos_plano_alimentar where tenant_id = $1 and id = $2 for update',
      [tenantId, modeloId]
    );
  }

  private async persistirRevisao(
    gerenciador: EntityManager,
    modelo: ModeloPlanoAlimentarOrm,
    numero: number,
    autorUsuarioId: string
  ): Promise<void> {
    const repositorio = gerenciador.getRepository(RevisaoModeloPlanoAlimentarOrm);
    const revisao = repositorio.create({
      tenantId: modelo.tenantId,
      modeloId: modelo.id,
      numero,
      nomeCriptografado: Buffer.from(modelo.nomeCriptografado),
      conteudoCriptografado: Buffer.from(modelo.conteudoCriptografado),
      totalRefeicoes: modelo.totalRefeicoes,
      totalItens: modelo.totalItens,
      autorUsuarioId
    });
    await repositorio.save(revisao);
  }

  /**
   * Visibilidade aplicada na consulta, nao depois de buscar: pos-filtrar
   * deixaria o `total` da paginacao contando modelos que o profissional nao
   * pode ver, vazando quantos modelos os colegas mantem.
   */
  private montarFiltroVisibilidade(
    tenantId: string,
    usuario: UsuarioAutenticado,
    profissionalId: string | undefined,
    origem?: OrigemModeloPlanoAlimentar
  ): FindOptionsWhere<ModeloPlanoAlimentarOrm>[] {
    const base: FindOptionsWhere<ModeloPlanoAlimentarOrm> = { tenantId, arquivadoEm: IsNull() };
    if (usuario.papel === 'SuperAdmin') {
      return origem ? [{ ...base, origem }] : [base];
    }
    const daClinica: FindOptionsWhere<ModeloPlanoAlimentarOrm> = { ...base, origem: 'clinica' };
    // Sem profissional resolvido nao ha modelo pessoal possivel, entao sobra
    // apenas o que a clinica compartilha.
    const pessoais: FindOptionsWhere<ModeloPlanoAlimentarOrm>[] = profissionalId
      ? [{ ...base, origem: 'pessoal', profissionalId }]
      : [];
    const filtros = [daClinica, ...pessoais];
    return origem ? filtros.filter((filtro) => filtro.origem === origem) : filtros;
  }

  private async obterNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    modeloId: string,
    usuario: UsuarioAutenticado
  ): Promise<ModeloPlanoAlimentarOrm> {
    const modelo = await gerenciador.getRepository(ModeloPlanoAlimentarOrm).findOne({
      where: { id: modeloId, tenantId, arquivadoEm: IsNull() }
    });
    if (!modelo) throw new NotFoundException('Modelo de plano alimentar nao encontrado.');
    const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
    if (!podeAcessarModelo(modelo, { papel: usuario.papel, profissionalId })) {
      // 404 e nao 403: responder "sem permissao" confirmaria que o modelo do
      // colega existe com aquele id.
      throw new NotFoundException('Modelo de plano alimentar nao encontrado.');
    }
    return modelo;
  }

  private async detectarAlimentosIndisponiveis(
    gerenciador: EntityManager,
    refeicoes: RefeicaoModeloPlanoAlimentar[]
  ): Promise<string[]> {
    const ids = resumirAlimentosDoModelo(refeicoes);
    if (!ids.length) return [];
    const alimentos = await gerenciador.getRepository(AlimentoComposicaoOrm).find({ where: { id: In(ids) } });
    if (!alimentos.length) return ids;
    const fontesAtivas = await gerenciador.getRepository(FonteComposicaoAlimentoOrm).find({
      where: { id: In([...new Set(alimentos.map((alimento) => alimento.fonteId))]), situacao: 'ativa' }
    });
    const fontesPermitidas = new Set(fontesAtivas.map((fonte) => fonte.id));
    const disponiveis = new Set(
      alimentos.filter((alimento) => fontesPermitidas.has(alimento.fonteId)).map((alimento) => alimento.id)
    );
    return ids.filter((id) => !disponiveis.has(id));
  }

  private async resolverProfissional(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado
  ): Promise<string | undefined> {
    if (usuario.papel !== 'Professional') return undefined;
    return resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
  }

  /**
   * Escrita direta, e nao `ServicoAuditoria.registrar`: o chamador ja esta
   * dentro do `executorTenant.executar` da operacao de negocio, e `registrar`
   * abriria uma segunda transacao. Ver `registrarAuditoriaNaTransacao`, que e
   * onde a redacao e aplicada.
   *
   * A entrada e um objeto nomeado -- e nao seis posicionais -- para que o call
   * site escreva literalmente `metadados: { ... }`. E o que o gate
   * `pnpm test:redacao-auditoria` procura; um argumento posicional deixaria
   * estes call sites invisiveis para ele.
   */
  private async registrarAuditoria(
    gerenciador: EntityManager,
    entrada: { tenantId: string; usuario: UsuarioAutenticado; acao: string; modeloId: string; metadados: Record<string, unknown> }
  ): Promise<void> {
    await registrarAuditoriaNaTransacao(gerenciador, {
      tenantId: entrada.tenantId,
      usuarioId: entrada.usuario.usuarioId,
      acao: entrada.acao,
      recursoTipo: 'modelo_plano_alimentar',
      recursoId: entrada.modeloId,
      metadados: entrada.metadados
    });
  }

  private garantirPapelProfissional(usuario: UsuarioAutenticado): void {
    if (usuario.papel !== 'SuperAdmin' && usuario.papel !== 'Professional') {
      throw new ForbiddenException('Papel sem acesso aos planos alimentares.');
    }
  }

  private garantirPermissao(usuario: UsuarioAutenticado, permissao: PermissaoOctaClin): void {
    if (!usuario.permissoes.includes(permissao)) {
      throw new ForbiddenException('Permissao insuficiente para operar planos alimentares.');
    }
  }
}
