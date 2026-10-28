import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ArrayContains, EntityManager, FindOptionsWhere, In, IsNull } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import type { PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  contarItensReceita,
  normalizarCategoriaReceita,
  podeAcessarReceita,
  resumirAlimentosDaReceita,
  type ConteudoReceitaNutricional,
  type OrigemReceitaNutricional,
  type TipoReceitaNutricional
} from '../dominio/receitas-nutricionais';
import { lerConteudoReceita } from '../dominio/conteudo-receita';
import { mesclarMetadadosReceita, normalizarMetadadosReceita, type MetadadosReceitaV1 } from '../dominio/metadados-receita';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { ReceitaNutricionalOrm } from '../infraestrutura/receita-nutricional.orm';
import {
  AtualizarReceitaNutricionalDto,
  CriarReceitaNutricionalDto,
  ConsultarReceitasNutricionaisDto,
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
        categoria: this.categoriaValida(dados.categoria),
        versaoAtual: 1,
        profissionalId: dados.origem === 'pessoal' ? profissionalId : undefined,
        nomeCriptografado: this.criptografia.criptografar(dados.nome.trim()),
        conteudoCriptografado: this.criptografia.criptografar(JSON.stringify(conteudo)),
        etiquetasHashes: this.indices(tenantId, conteudo.metadados),
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
      return this.resumo(receita, dados.nome.trim(), conteudo);
    });
  }

  async listar(
    tenantId: string,
    usuario: UsuarioAutenticado,
    consulta: ListarReceitasNutricionaisDto = new ListarReceitasNutricionaisDto()
  ) {
    return this.listarNoEscopo(tenantId, usuario, consulta);
  }

  async consultar(tenantId: string, usuario: UsuarioAutenticado, entrada: unknown = {}) {
    this.garantirAcesso(usuario, 'planos_alimentares.ler');
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new BadRequestException('Consulta de receitas inválida.');
    const campos = ['pagina', 'limite', 'origem', 'tipo', 'categoria', 'etiqueta'];
    if ((![Object.prototype, null].includes(Object.getPrototypeOf(entrada)) && !(entrada instanceof ConsultarReceitasNutricionaisDto)) ||
      Object.getOwnPropertySymbols(entrada).length || Object.entries(Object.getOwnPropertyDescriptors(entrada)).some(([k, d]) =>
        !campos.includes(k) || !Object.hasOwn(d, 'value') || !d.enumerable)) throw new BadRequestException('Consulta de receitas inválida.');
    const dados = entrada as Record<string, unknown>;
    if (Object.values(dados).some(v => v === null) || ['pagina', 'limite'].some(k => dados[k] !== undefined && typeof dados[k] !== 'number')) {
      throw new BadRequestException('Consulta de receitas inválida.');
    }
    const consulta = plainToInstance(ConsultarReceitasNutricionaisDto, entrada);
    if (validateSync(consulta, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }).length) {
      throw new BadRequestException('Consulta de receitas inválida.');
    }
    let etiqueta: string | undefined;
    try { etiqueta = consulta.etiqueta === undefined ? undefined : normalizarMetadadosReceita({ etiquetas: [consulta.etiqueta] }).etiquetas[0]; }
    catch { throw new BadRequestException('Consulta de receitas inválida.'); }
    return this.listarNoEscopo(tenantId, usuario, consulta, etiqueta);
  }

  private async listarNoEscopo(tenantId: string, usuario: UsuarioAutenticado, consulta: ListarReceitasNutricionaisDto, etiqueta?: string) {
    this.garantirAcesso(usuario, 'planos_alimentares.ler');
    const pagina = Math.min(PAGINA_MAXIMA, Math.max(1, Math.trunc(consulta.pagina ?? 1)));
    const limite = Math.min(100, Math.max(1, Math.trunc(consulta.limite ?? 25)));
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
      const [receitas, total] = await gerenciador.getRepository(ReceitaNutricionalOrm).findAndCount({
        where: this.montarFiltroVisibilidade(tenantId, usuario, profissionalId, consulta.origem, consulta.tipo, consulta.categoria).map(filtro => ({
          ...filtro, ...(etiqueta === undefined ? {} : { etiquetasHashes: ArrayContains([this.criptografia.gerarHashPerfilExato(tenantId, 'tag', etiqueta)]) })
        })),
        order: { atualizadoEm: 'DESC', id: 'DESC' },
        skip: (pagina - 1) * limite,
        take: limite
      });
      return {
        itens: receitas.map((receita) => this.resumo(receita, this.criptografia.descriptografar(receita.nomeCriptografado), this.descriptografarConteudo(receita))),
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
        ...this.resumo(receita, this.criptografia.descriptografar(receita.nomeCriptografado), conteudo),
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
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await gerenciador.query(
        'select id from receitas_nutricionais where tenant_id = $1 and id = $2 for update',
        [tenantId, receitaId]
      );
      const receita = await this.obterNoEscopo(gerenciador, tenantId, receitaId, usuario);
      const versaoAtual = receita.versaoAtual ?? 1;
      if (dados.versaoEsperada !== versaoAtual) {
        throw new ConflictException('A receita foi alterada. Recarregue antes de salvar.');
      }
      const anterior = this.descriptografarConteudo(receita);
      const conteudo = this.conteudoDe(dados, anterior.metadados, true);
      const totalItens = contarItensReceita(conteudo);
      const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
      this.garantirDonoPessoal(dados.origem, profissionalId);
      receita.origem = dados.origem;
      receita.tipo = dados.tipo;
      receita.categoria = this.categoriaValida(dados.categoria);
      receita.versaoAtual = versaoAtual + 1;
      receita.profissionalId = dados.origem === 'pessoal' ? profissionalId : undefined;
      receita.nomeCriptografado = this.criptografia.criptografar(dados.nome.trim());
      receita.conteudoCriptografado = this.criptografia.criptografar(JSON.stringify(conteudo));
      receita.etiquetasHashes = this.indices(tenantId, conteudo.metadados);
      receita.totalItens = totalItens;
      await gerenciador.getRepository(ReceitaNutricionalOrm).save(receita);
      await this.registrarAuditoria(gerenciador, {
        tenantId,
        usuario,
        acao: 'planos_alimentares.receita_atualizar',
        receitaId: receita.id,
        metadados: { origem: receita.origem, tipo: receita.tipo, totalItens }
      });
      return this.resumo(receita, dados.nome.trim(), conteudo);
    });
  }

  async arquivar(tenantId: string, receitaId: string, usuario: UsuarioAutenticado) {
    this.garantirAcesso(usuario, 'planos_alimentares.gerenciar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await gerenciador.query('select id from receitas_nutricionais where tenant_id = $1 and id = $2 for update', [tenantId, receitaId]);
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

  private conteudoDe(dados: Pick<CriarReceitaNutricionalDto, 'instrucoes' | 'itens' | 'metadados'>, anterior?: MetadadosReceitaV1, atualizar = false): ConteudoReceitaNutricional {
    try {
      const metadados = atualizar ? mesclarMetadadosReceita(anterior, dados.metadados)
        : dados.metadados === undefined ? undefined : normalizarMetadadosReceita(dados.metadados);
      // DTOs transformados têm protótipos de classe; o conteúdo persistido é JSON.
      return lerConteudoReceita(JSON.parse(JSON.stringify({ instrucoes: dados.instrucoes?.trim() || undefined, itens: dados.itens, metadados })));
    } catch { throw new BadRequestException('Conteúdo da receita inválido.'); }
  }

  private categoriaValida(valor: string): string {
    try {
      return normalizarCategoriaReceita(valor);
    } catch {
      throw new BadRequestException('Categoria da receita invalida.');
    }
  }

  private resumo(receita: ReceitaNutricionalOrm, nome: string, conteudo?: ConteudoReceitaNutricional) {
    return {
      id: receita.id,
      nome,
      origem: receita.origem,
      tipo: receita.tipo,
      categoria: receita.categoria ?? null,
      versaoAtual: receita.versaoAtual ?? 1,
      totalItens: receita.totalItens,
      ...(conteudo?.metadados === undefined ? {} : { metadados: conteudo.metadados }),
      atualizadoEm: receita.atualizadoEm
    };
  }

  private montarFiltroVisibilidade(
    tenantId: string,
    usuario: UsuarioAutenticado,
    profissionalId: string | undefined,
    origem?: OrigemReceitaNutricional,
    tipo?: TipoReceitaNutricional,
    categoria?: string
  ): FindOptionsWhere<ReceitaNutricionalOrm>[] {
    const base: FindOptionsWhere<ReceitaNutricionalOrm> = { tenantId, arquivadoEm: IsNull() };
    const filtrosCategoria = categoria ? { categoria: this.categoriaValida(categoria) } : {};
    if (usuario.papel === 'SuperAdmin') return [{ ...base, ...(origem ? { origem } : {}), ...(tipo ? { tipo } : {}), ...filtrosCategoria }];
    const filtros: FindOptionsWhere<ReceitaNutricionalOrm>[] = [
      { ...base, origem: 'clinica', ...(tipo ? { tipo } : {}), ...filtrosCategoria }
    ];
    if (profissionalId) filtros.push({ ...base, origem: 'pessoal', profissionalId, ...(tipo ? { tipo } : {}), ...filtrosCategoria });
    return origem ? filtros.filter((filtro) => filtro.origem === origem) : filtros;
  }

  /** Interno: o chamador fornece o EntityManager tenant-aware da própria operação. */
  async obterParaPorcionamento(gerenciador: EntityManager, tenantId: string, receitaId: string, usuario: UsuarioAutenticado) {
    this.garantirAcesso(usuario, 'planos_alimentares.ler');
    const receita = await this.obterNoEscopo(gerenciador, tenantId, receitaId, usuario, true);
    return { id: receita.id, nome: this.criptografia.descriptografar(receita.nomeCriptografado),
      versao: receita.versaoAtual ?? 1, conteudo: this.descriptografarConteudo(receita) };
  }

  private async obterNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    receitaId: string,
    usuario: UsuarioAutenticado,
    bloquearLeitura = false
  ): Promise<ReceitaNutricionalOrm> {
    const receita = await gerenciador.getRepository(ReceitaNutricionalOrm).findOne({
      where: { id: receitaId, tenantId, arquivadoEm: IsNull() },
      ...(bloquearLeitura ? { lock: { mode: 'pessimistic_read' as const } } : {})
    });
    if (!receita) throw new NotFoundException('Receita nutricional nao encontrada.');
    const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
    if (!podeAcessarReceita(receita, { papel: usuario.papel, profissionalId })) {
      throw new NotFoundException('Receita nutricional nao encontrada.');
    }
    return receita;
  }

  private descriptografarConteudo(receita: ReceitaNutricionalOrm): ConteudoReceitaNutricional {
    try {
      const conteudo = lerConteudoReceita(JSON.parse(this.criptografia.descriptografar(receita.conteudoCriptografado)));
      const esperado = this.indices(receita.tenantId, conteudo.metadados).sort();
      const atual = receita.etiquetasHashes ?? [];
      if (!Array.isArray(atual) || JSON.stringify([...atual].sort()) !== JSON.stringify(esperado)) throw new Error('Índice inconsistente.');
      return conteudo;
    } catch { throw new BadRequestException('Não foi possível ler a receita.'); }
  }

  private indices(tenantId: string, metadados?: MetadadosReceitaV1): string[] {
    return (metadados?.etiquetas ?? []).map(etiqueta => this.criptografia.gerarHashPerfilExato(tenantId, 'tag', etiqueta));
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
