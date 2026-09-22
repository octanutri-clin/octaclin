import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import type { PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import type { TipoCondutaTerapeutica } from '../infraestrutura/conduta-terapeutica.orm';
import { BibliotecaCondutaOrm } from '../infraestrutura/biblioteca-conduta.orm';
import { CriarBibliotecaCondutaDto, ListarBibliotecaCondutasDto } from './dtos';

/**
 * Biblioteca de condutas/orientacoes reutilizaveis (PB-23, Fase 272), no
 * molde da biblioteca de perguntas de `questionarios` -- ver
 * `docs/history/phases/PLANO_FASE_272.md` para as diferencas deliberadas
 * (tabela dedicada em vez de flag na tabela real, sem rota de "aplicar",
 * sem busca textual server-side, sem categoria livre).
 *
 * Diferente de `ServicoModelosPlanoAlimentar`/`ServicoModelosEvolucaoClinica`
 * (PB-13/PB-15), nao ha visibilidade pessoal/clinica: a biblioteca e sempre
 * do tenant inteiro, entao nao ha filtro de acesso a aplicar.
 */
@Injectable()
export class ServicoBibliotecaCondutas {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async criar(tenantId: string, usuario: UsuarioAutenticado, dados: CriarBibliotecaCondutaDto) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'pacientes.gerenciar');
    const conteudo = dados.conteudo.trim();

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(BibliotecaCondutaOrm);
      const item = repositorio.create({
        tenantId,
        tipo: dados.tipo,
        nomeCriptografado: this.criptografia.criptografar(dados.nome.trim()),
        conteudoCriptografado: this.criptografia.criptografar(conteudo),
        tamanhoConteudo: conteudo.length,
        criadoPorUsuarioId: usuario.usuarioId
      });
      await repositorio.save(item);
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId,
        usuarioId: usuario.usuarioId,
        acao: 'pacientes.biblioteca_condutas.criar',
        recursoTipo: 'biblioteca_conduta',
        recursoId: item.id,
        metadados: { tipo: dados.tipo }
      });
      return { id: item.id, nome: dados.nome.trim(), tipo: dados.tipo, tamanhoConteudo: conteudo.length };
    });
  }

  async listar(
    tenantId: string,
    usuario: UsuarioAutenticado,
    consulta: ListarBibliotecaCondutasDto = new ListarBibliotecaCondutasDto()
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'pacientes.ler');
    const pagina = Math.max(1, Math.trunc(consulta.pagina ?? 1));
    const limite = Math.min(100, Math.max(1, Math.trunc(consulta.limite ?? 25)));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const where: Record<string, unknown> = { tenantId, arquivadoEm: IsNull() };
      if (consulta.tipo) where.tipo = consulta.tipo;
      const [itens, total] = await gerenciador.getRepository(BibliotecaCondutaOrm).findAndCount({
        where,
        // `id` desempata: `atualizado_em` usa default now() e empata entre
        // itens salvos na mesma transacao, o que faria OFFSET repetir ou pular.
        order: { atualizadoEm: 'DESC', id: 'DESC' },
        skip: (pagina - 1) * limite,
        take: limite
      });
      return {
        itens: itens.map((item) => ({
          id: item.id,
          // So o nome e descriptografado na listagem; o conteudo fica fechado
          // ate alguem abrir um item especifico.
          nome: this.criptografia.descriptografar(item.nomeCriptografado),
          tipo: item.tipo,
          tamanhoConteudo: item.tamanhoConteudo,
          atualizadoEm: item.atualizadoEm
        })),
        total,
        pagina,
        limite
      };
    });
  }

  async obter(tenantId: string, itemId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'pacientes.ler');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const item = await this.obterNoEscopo(gerenciador, tenantId, itemId);
      return {
        id: item.id,
        nome: this.criptografia.descriptografar(item.nomeCriptografado),
        tipo: item.tipo,
        tamanhoConteudo: item.tamanhoConteudo,
        conteudo: this.criptografia.descriptografar(item.conteudoCriptografado)
      };
    });
  }

  async arquivar(tenantId: string, itemId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'pacientes.gerenciar');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const item = await this.obterNoEscopo(gerenciador, tenantId, itemId);
      item.arquivadoEm = new Date();
      await gerenciador.getRepository(BibliotecaCondutaOrm).save(item);
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId,
        usuarioId: usuario.usuarioId,
        acao: 'pacientes.biblioteca_condutas.arquivar',
        recursoTipo: 'biblioteca_conduta',
        recursoId: item.id,
        metadados: { tipo: item.tipo as TipoCondutaTerapeutica }
      });
      return { id: item.id, arquivadoEm: item.arquivadoEm };
    });
  }

  private async obterNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    itemId: string
  ): Promise<BibliotecaCondutaOrm> {
    const item = await gerenciador.getRepository(BibliotecaCondutaOrm).findOne({
      where: { id: itemId, tenantId, arquivadoEm: IsNull() }
    });
    if (!item) throw new NotFoundException('Item da biblioteca de condutas nao encontrado.');
    return item;
  }

  private garantirPapelProfissional(usuario: UsuarioAutenticado): void {
    if (usuario.papel !== 'SuperAdmin' && usuario.papel !== 'Professional') {
      throw new ForbiddenException('Papel sem acesso a biblioteca de condutas.');
    }
  }

  private garantirPermissao(usuario: UsuarioAutenticado, permissao: PermissaoOctaClin): void {
    if (!usuario.permissoes.includes(permissao)) {
      throw new ForbiddenException('Permissao insuficiente para operar a biblioteca de condutas.');
    }
  }
}
