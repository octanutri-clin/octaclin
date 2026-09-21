import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, IsNull } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import type { PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { podeAcessarModeloEvolucao, type OrigemModeloEvolucaoClinica } from '../dominio/modelos-evolucao-clinica';
import { ModeloEvolucaoClinicaOrm } from '../infraestrutura/modelo-evolucao-clinica.orm';
import { CriarModeloEvolucaoClinicaDto, ListarModelosEvolucaoClinicaDto } from './dtos';

/**
 * Modelos reutilizaveis de evolucao clinica (PB-15, Fase 271).
 *
 * Mesmo desenho de `ServicoModelosPlanoAlimentar` (Fase 269): aplicar um
 * modelo nao tem rota propria de proposito. O cliente le o modelo e o
 * formulario de nova evolucao pre-preenche tipo/conteudo localmente; o
 * salvamento continua passando por `POST /pacientes/:id/evolucoes`, que ja
 * valida tudo. Uma rota de aplicacao duplicaria essa validacao.
 */
@Injectable()
export class ServicoModelosEvolucaoClinica {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async criar(tenantId: string, usuario: UsuarioAutenticado, dados: CriarModeloEvolucaoClinicaDto) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'pacientes.gerenciar');
    const conteudo = dados.conteudo.trim();
    const tipo = dados.tipo ?? 'observacao';

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
      if (dados.origem === 'pessoal' && !profissionalId) {
        throw new ForbiddenException('Modelo pessoal exige um profissional vinculado ao usuario.');
      }
      const repositorio = gerenciador.getRepository(ModeloEvolucaoClinicaOrm);
      const modelo = repositorio.create({
        tenantId,
        origem: dados.origem,
        // Modelo da clinica nunca guarda profissional: preso a um, ele deixaria
        // de ser compartilhado no dia em que esse profissional saisse.
        profissionalId: dados.origem === 'pessoal' ? profissionalId : undefined,
        nomeCriptografado: this.criptografia.criptografar(dados.nome.trim()),
        tipo,
        conteudoCriptografado: this.criptografia.criptografar(conteudo),
        tamanhoConteudo: conteudo.length,
        criadoPorUsuarioId: usuario.usuarioId
      });
      await repositorio.save(modelo);
      await this.registrarAuditoria(gerenciador, {
        tenantId,
        usuario,
        acao: 'pacientes.evolucoes.modelo_criar',
        modeloId: modelo.id,
        metadados: { origem: dados.origem, tipo }
      });
      return { id: modelo.id, nome: dados.nome.trim(), origem: dados.origem, tipo, tamanhoConteudo: conteudo.length };
    });
  }

  async listar(
    tenantId: string,
    usuario: UsuarioAutenticado,
    consulta: ListarModelosEvolucaoClinicaDto = new ListarModelosEvolucaoClinicaDto()
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'pacientes.ler');
    const pagina = Math.max(1, Math.trunc(consulta.pagina ?? 1));
    const limite = Math.min(100, Math.max(1, Math.trunc(consulta.limite ?? 25)));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
      const [modelos, total] = await gerenciador.getRepository(ModeloEvolucaoClinicaOrm).findAndCount({
        where: this.montarFiltroVisibilidade(tenantId, usuario, profissionalId, consulta.origem),
        // `id` desempata: `atualizado_em` usa default now() e empata entre
        // modelos salvos na mesma transacao, o que faria OFFSET repetir ou pular.
        order: { atualizadoEm: 'DESC', id: 'DESC' },
        skip: (pagina - 1) * limite,
        take: limite
      });
      return {
        itens: modelos.map((modelo) => ({
          id: modelo.id,
          // So o nome e descriptografado na listagem; o conteudo fica fechado
          // ate alguem abrir um modelo especifico.
          nome: this.criptografia.descriptografar(modelo.nomeCriptografado),
          origem: modelo.origem,
          tipo: modelo.tipo,
          tamanhoConteudo: modelo.tamanhoConteudo,
          atualizadoEm: modelo.atualizadoEm
        })),
        total,
        pagina,
        limite
      };
    });
  }

  async obter(tenantId: string, modeloId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'pacientes.ler');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const modelo = await this.obterNoEscopo(gerenciador, tenantId, modeloId, usuario);
      return {
        id: modelo.id,
        nome: this.criptografia.descriptografar(modelo.nomeCriptografado),
        origem: modelo.origem,
        tipo: modelo.tipo,
        tamanhoConteudo: modelo.tamanhoConteudo,
        conteudo: this.criptografia.descriptografar(modelo.conteudoCriptografado)
      };
    });
  }

  async arquivar(tenantId: string, modeloId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'pacientes.gerenciar');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const modelo = await this.obterNoEscopo(gerenciador, tenantId, modeloId, usuario);
      modelo.arquivadoEm = new Date();
      await gerenciador.getRepository(ModeloEvolucaoClinicaOrm).save(modelo);
      await this.registrarAuditoria(gerenciador, {
        tenantId,
        usuario,
        acao: 'pacientes.evolucoes.modelo_arquivar',
        modeloId: modelo.id,
        metadados: { origem: modelo.origem }
      });
      return { id: modelo.id, arquivadoEm: modelo.arquivadoEm };
    });
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
    origem?: OrigemModeloEvolucaoClinica
  ): FindOptionsWhere<ModeloEvolucaoClinicaOrm>[] {
    const base: FindOptionsWhere<ModeloEvolucaoClinicaOrm> = { tenantId, arquivadoEm: IsNull() };
    if (usuario.papel === 'SuperAdmin') {
      return origem ? [{ ...base, origem }] : [base];
    }
    const daClinica: FindOptionsWhere<ModeloEvolucaoClinicaOrm> = { ...base, origem: 'clinica' };
    // Sem profissional resolvido nao ha modelo pessoal possivel, entao sobra
    // apenas o que a clinica compartilha.
    const pessoais: FindOptionsWhere<ModeloEvolucaoClinicaOrm>[] = profissionalId
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
  ): Promise<ModeloEvolucaoClinicaOrm> {
    const modelo = await gerenciador.getRepository(ModeloEvolucaoClinicaOrm).findOne({
      where: { id: modeloId, tenantId, arquivadoEm: IsNull() }
    });
    if (!modelo) throw new NotFoundException('Modelo de evolucao clinica nao encontrado.');
    const profissionalId = await this.resolverProfissional(gerenciador, tenantId, usuario);
    if (!podeAcessarModeloEvolucao(modelo, { papel: usuario.papel, profissionalId })) {
      // 404 e nao 403: responder "sem permissao" confirmaria que o modelo do
      // colega existe com aquele id.
      throw new NotFoundException('Modelo de evolucao clinica nao encontrado.');
    }
    return modelo;
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
   * abriria uma segunda transacao. Ver `registrarAuditoriaNaTransacao`.
   *
   * A entrada e um objeto nomeado -- e nao posicional -- para que o call site
   * escreva literalmente `metadados: { ... }`, que e o que o gate
   * `pnpm test:redacao-auditoria` procura.
   */
  private async registrarAuditoria(
    gerenciador: EntityManager,
    entrada: {
      tenantId: string;
      usuario: UsuarioAutenticado;
      acao: string;
      modeloId: string;
      metadados: Record<string, unknown>;
    }
  ): Promise<void> {
    await registrarAuditoriaNaTransacao(gerenciador, {
      tenantId: entrada.tenantId,
      usuarioId: entrada.usuario.usuarioId,
      acao: entrada.acao,
      recursoTipo: 'modelo_evolucao_clinica',
      recursoId: entrada.modeloId,
      metadados: entrada.metadados
    });
  }

  private garantirPapelProfissional(usuario: UsuarioAutenticado): void {
    if (usuario.papel !== 'SuperAdmin' && usuario.papel !== 'Professional') {
      throw new ForbiddenException('Papel sem acesso aos modelos de evolucao clinica.');
    }
  }

  private garantirPermissao(usuario: UsuarioAutenticado, permissao: PermissaoOctaClin): void {
    if (!usuario.permissoes.includes(permissao)) {
      throw new ForbiddenException('Permissao insuficiente para operar modelos de evolucao clinica.');
    }
  }
}
