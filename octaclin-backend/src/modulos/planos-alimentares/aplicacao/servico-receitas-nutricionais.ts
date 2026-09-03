import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, In, IsNull } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import type { PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ItemModeloPlanoAlimentar } from '../dominio/modelos-plano-alimentar';
import {
  contarItensReceita,
  podeAcessarReceita,
  resumirAlimentosDaReceita,
  type ConteudoReceitaNutricional,
  type OrigemReceitaNutricional,
  type TipoReceitaNutricional
} from '../dominio/receitas-nutricionais';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { ReceitaNutricionalOrm } from '../infraestrutura/receita-nutricional.orm';
import {
  AtualizarReceitaNutricionalDto,
  CriarReceitaNutricionalDto,
  ListarReceitasNutricionaisDto,
  PAGINA_MAXIMA
} from './dtos';

/** Biblioteca privada/compartilhada que expande itens no rascunho do plano. */
@Injectable()
export class ServicoReceitasNutricionais {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async criar(tenantId: string, usuario: UsuarioAutenticado, dados: CriarReceitaNutricionalDto) {
    this.garantirAcesso(usuario, 'planos_alimentares.gerenciar');
    const conteudo = this.conteudoDe(dados);
    const totalItens = contarItensReceita(conteudo);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
      this.garantirDonoPessoal(dados.origem, profissionalId);
      const repositorio = gerenciador.getRepository(ReceitaNutricionalOrm);
      const receita = repositorio.create({
        tenantId,
        origem: dados.origem,
        tipo: dados.tipo,
        profissionalId: dados.origem === 'pessoal' ? profissionalId : undefined,
        nomeCriptografado: this.criptografia.criptografar(dados.nome.trim()),
        conteudoCriptografado: this.criptografia.criptografar(JSON.stringify(conteudo)),
        totalItens,
        criadoPorUsuarioId: usuario.usuarioId
      });
      await repositorio.save(receita);
      await this.registrarAuditoria(gerenciador, {
        tenantId,
        usuario,
        acao: 'planos_alimentares.receita_criar',
        receitaId: receita.id,
        metadados: { origem: receita.origem, tipo: receita.tipo, totalItens }
      });
      return this.resumo(receita, dados.nome.trim());
    });
  }

  async listar(
    tenantId: string,
    usuario: UsuarioAutenticado,
    consulta: ListarReceitasNutricionaisDto = new ListarReceitasNutricionaisDto()
  ) {
    this.garantirAcesso(usuario, 'planos_alimentares.ler');
    const pagina = Math.min(PAGINA_MAXIMA, Math.max(1, Math.trunc(consulta.pagina ?? 1)));
    const limite = Math.min(100, Math.max(1, Math.trunc(consulta.limite ?? 25)));
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
      const [receitas, total] = await gerenciador.getRepository(ReceitaNutricionalOrm).findAndCount({
        where: this.montarFiltroVisibilidade(tenantId, usuario, profissionalId, consulta.origem, consulta.tipo),
        order: { atualizadoEm: 'DESC', id: 'DESC' },
        skip: (pagina - 1) * limite,
        take: limite
      });
      return {
        itens: receitas.map((receita) => this.resumo(receita, this.criptografia.descriptografar(receita.nomeCriptografado))),
        total,
        pagina,
        limite
      };
    });
  }

  async obter(tenantId: string, receitaId: string, usuario: UsuarioAutenticado) {
    this.garantirAcesso(usuario, 'planos_alimentares.ler');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const receita = await this.obterNoEscopo(gerenciador, tenantId, receitaId, usuario);
      const conteudo = this.descriptografarConteudo(receita);
      return {
        ...this.resumo(receita, this.criptografia.descriptografar(receita.nomeCriptografado)),
        instrucoes: conteudo.instrucoes,
        itens: conteudo.itens,
        alimentosIndisponiveis: await this.detectarAlimentosIndisponiveis(gerenciador, conteudo)
      };
    });
  }

  async atualizar(
    tenantId: string,
    receitaId: string,
    usuario: UsuarioAutenticado,
    dados: AtualizarReceitaNutricionalDto
  ) {
    this.garantirAcesso(usuario, 'planos_alimentares.gerenciar');
    const conteudo = this.conteudoDe(dados);
    const totalItens = contarItensReceita(conteudo);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const receita = await this.obterNoEscopo(gerenciador, tenantId, receitaId, usuario);
      const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
      this.garantirDonoPessoal(dados.origem, profissionalId);
      receita.origem = dados.origem;
      receita.tipo = dados.tipo;
      receita.profissionalId = dados.origem === 'pessoal' ? profissionalId : undefined;
      receita.nomeCriptografado = this.criptografia.criptografar(dados.nome.trim());
      receita.conteudoCriptografado = this.criptografia.criptografar(JSON.stringify(conteudo));
      receita.totalItens = totalItens;
      await gerenciador.getRepository(ReceitaNutricionalOrm).save(receita);
      await this.registrarAuditoria(gerenciador, {
        tenantId,
        usuario,
        acao: 'planos_alimentares.receita_atualizar',
        receitaId: receita.id,
        metadados: { origem: receita.origem, tipo: receita.tipo, totalItens }
      });
      return this.resumo(receita, dados.nome.trim());
    });
  }

  async arquivar(tenantId: string, receitaId: string, usuario: UsuarioAutenticado) {
    this.garantirAcesso(usuario, 'planos_alimentares.gerenciar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const receita = await this.obterNoEscopo(gerenciador, tenantId, receitaId, usuario);
      receita.arquivadoEm = new Date();
      await gerenciador.getRepository(ReceitaNutricionalOrm).save(receita);
      await this.registrarAuditoria(gerenciador, {
        tenantId,
        usuario,
        acao: 'planos_alimentares.receita_arquivar',
        receitaId: receita.id,
        metadados: { origem: receita.origem, tipo: receita.tipo }
      });
      return { id: receita.id, arquivadoEm: receita.arquivadoEm };
    });
  }

  private conteudoDe(dados: Pick<CriarReceitaNutricionalDto, 'instrucoes' | 'itens'>): ConteudoReceitaNutricional {
    return {
      instrucoes: dados.instrucoes?.trim() || undefined,
      itens: dados.itens as unknown as ItemModeloPlanoAlimentar[]
    };
  }

  private resumo(receita: ReceitaNutricionalOrm, nome: string) {
    return {
      id: receita.id,
      nome,
      origem: receita.origem,
      tipo: receita.tipo,
      totalItens: receita.totalItens,
      atualizadoEm: receita.atualizadoEm
    };
  }

  private montarFiltroVisibilidade(
    tenantId: string,
    usuario: UsuarioAutenticado,
    profissionalId: string | undefined,
    origem?: OrigemReceitaNutricional,
    tipo?: TipoReceitaNutricional
  ): FindOptionsWhere<ReceitaNutricionalOrm>[] {
    const base: FindOptionsWhere<ReceitaNutricionalOrm> = { tenantId, arquivadoEm: IsNull() };
    if (usuario.papel === 'SuperAdmin') return [{ ...base, ...(origem ? { origem } : {}), ...(tipo ? { tipo } : {}) }];
    const filtros: FindOptionsWhere<ReceitaNutricionalOrm>[] = [
      { ...base, origem: 'clinica', ...(tipo ? { tipo } : {}) }
    ];
    if (profissionalId) filtros.push({ ...base, origem: 'pessoal', profissionalId, ...(tipo ? { tipo } : {}) });
    return origem ? filtros.filter((filtro) => filtro.origem === origem) : filtros;
  }

  private async obterNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    receitaId: string,
    usuario: UsuarioAutenticado
  ): Promise<ReceitaNutricionalOrm> {
    const receita = await gerenciador.getRepository(ReceitaNutricionalOrm).findOne({
      where: { id: receitaId, tenantId, arquivadoEm: IsNull() }
    });
    if (!receita) throw new NotFoundException('Receita nutricional nao encontrada.');
    const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
    if (!podeAcessarReceita(receita, { papel: usuario.papel, profissionalId })) {
      throw new NotFoundException('Receita nutricional nao encontrada.');
    }
    return receita;
  }

  private descriptografarConteudo(receita: ReceitaNutricionalOrm): ConteudoReceitaNutricional {
    return JSON.parse(this.criptografia.descriptografar(receita.conteudoCriptografado)) as ConteudoReceitaNutricional;
  }

  private async detectarAlimentosIndisponiveis(gerenciador: EntityManager, conteudo: ConteudoReceitaNutricional) {
    const ids = resumirAlimentosDaReceita(conteudo);
    if (!ids.length) return [];
    const alimentos = await gerenciador.getRepository(AlimentoComposicaoOrm).find({ where: { id: In(ids) } });
    if (!alimentos.length) return ids;
    const fontes = await gerenciador.getRepository(FonteComposicaoAlimentoOrm).find({
      where: { id: In([...new Set(alimentos.map((alimento) => alimento.fonteId))]), situacao: 'ativa' }
    });
    const fontesAtivas = new Set(fontes.map((fonte) => fonte.id));
    const disponiveis = new Set(alimentos.filter((alimento) => fontesAtivas.has(alimento.fonteId)).map((alimento) => alimento.id));
    return ids.filter((id) => !disponiveis.has(id));
  }

  private async resolverProfissional(gerenciador: EntityManager, tenantId: string, usuario: UsuarioAutenticado) {
    return usuario.papel === 'Professional'
      ? resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario)
      : undefined;
  }

  private garantirDonoPessoal(origem: OrigemReceitaNutricional, profissionalId: string | undefined) {
    if (origem === 'pessoal' && !profissionalId) {
      throw new ForbiddenException('Receita pessoal exige um profissional vinculado ao usuario.');
    }
  }

  private garantirAcesso(usuario: UsuarioAutenticado, permissao: PermissaoOctaClin) {
    if (usuario.papel !== 'SuperAdmin' && usuario.papel !== 'Professional') {
      throw new ForbiddenException('Papel sem acesso aos planos alimentares.');
    }
    if (!usuario.permissoes.includes(permissao)) throw new ForbiddenException('Permissao insuficiente para operar planos alimentares.');
  }

  /**
   * Escrita direta, e nao `ServicoAuditoria.registrar`: o chamador ja esta
   * dentro do `executorTenant.executar` da operacao de negocio. Ver
   * `registrarAuditoriaNaTransacao`, que e onde a redacao e aplicada, e a nota
   * gemea em `servico-modelos-plano-alimentar.ts` sobre a entrada nomeada.
   */
  private async registrarAuditoria(
    gerenciador: EntityManager,
    entrada: { tenantId: string; usuario: UsuarioAutenticado; acao: string; receitaId: string; metadados: Record<string, unknown> }
  ) {
    await registrarAuditoriaNaTransacao(gerenciador, {
      tenantId: entrada.tenantId,
      usuarioId: entrada.usuario.usuarioId,
      acao: entrada.acao,
      recursoTipo: 'receita_nutricional',
      recursoId: entrada.receitaId,
      metadados: entrada.metadados
    });
  }
}
