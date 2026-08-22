import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import type { PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { TETO_FILTROS_SALVOS, validarCriteriosFiltroSalvo } from '../dominio/filtros-salvos';
import { FiltroSalvoPacienteOrm } from '../infraestrutura/filtro-salvo-paciente.orm';
import { CriarFiltroSalvoDto, ListarFiltrosSalvosDto } from './dtos-filtros-salvos';

/** Visoes de trabalho da lista de pacientes. Guarda criterio, nunca busca livre. */
@Injectable()
export class ServicoFiltrosSalvosPacientes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async criar(tenantId: string, usuario: UsuarioAutenticado, dados: CriarFiltroSalvoDto) {
    this.garantirAcesso(usuario, dados.origem === 'clinica' ? 'pacientes.gerenciar' : 'pacientes.listar');

    let criterios;
    try {
      criterios = validarCriteriosFiltroSalvo(dados.criterios);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      if (dados.origem === 'pessoal' && !profissionalId) {
        throw new ForbiddenException('Filtro pessoal exige um profissional vinculado ao usuario.');
      }

      const repositorio = gerenciador.getRepository(FiltroSalvoPacienteOrm);
      const ativos = await repositorio.count({
        where: dados.origem === 'pessoal'
          ? { tenantId, origem: 'pessoal', profissionalId, arquivadoEm: IsNull() }
          : { tenantId, origem: 'clinica', arquivadoEm: IsNull() }
      });
      if (ativos >= TETO_FILTROS_SALVOS) {
        throw new BadRequestException(`Limite de ${TETO_FILTROS_SALVOS} filtros salvos atingido.`);
      }

      const nome = dados.nome.trim();
      const filtro = repositorio.create({
        tenantId,
        origem: dados.origem,
        profissionalId: dados.origem === 'pessoal' ? profissionalId : undefined,
        nomeCriptografado: this.criptografia.criptografar(nome),
        criterios,
        criadoPorUsuarioId: usuario.usuarioId
      });
      await repositorio.save(filtro);
      return this.resumo(filtro, nome);
    });
  }

  async listar(tenantId: string, usuario: UsuarioAutenticado, consulta: ListarFiltrosSalvosDto = new ListarFiltrosSalvosDto()) {
    this.garantirAcesso(usuario, 'pacientes.listar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const repositorio = gerenciador.getRepository(FiltroSalvoPacienteOrm);
      const visiveis = [
        { tenantId, origem: 'clinica' as const, arquivadoEm: IsNull() },
        ...(profissionalId ? [{ tenantId, origem: 'pessoal' as const, profissionalId, arquivadoEm: IsNull() }] : [])
      ];
      const condicoes = consulta.origem ? visiveis.filter((onde) => onde.origem === consulta.origem) : visiveis;
      // Um array vazio vira "sem WHERE" no TypeORM, o que devolveria a tabela inteira.
      // Sem condicao visivel para este usuario, o resultado tem que ser vazio, nao irrestrito.
      if (condicoes.length === 0) {
        return { itens: [] };
      }
      const filtros = await repositorio.find({
        where: condicoes,
        order: { atualizadoEm: 'DESC', id: 'DESC' }
      });
      return {
        itens: filtros.map((filtro) => this.resumo(filtro, this.criptografia.descriptografar(filtro.nomeCriptografado)))
      };
    });
  }

  async arquivar(tenantId: string, filtroId: string, usuario: UsuarioAutenticado) {
    this.garantirAcesso(usuario, 'pacientes.listar');
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const repositorio = gerenciador.getRepository(FiltroSalvoPacienteOrm);
      const filtro = await repositorio.findOne({ where: { tenantId, id: filtroId, arquivadoEm: IsNull() } });
      if (!filtro) throw new NotFoundException('Filtro salvo nao encontrado.');

      if (filtro.origem === 'clinica') {
        this.garantirAcesso(usuario, 'pacientes.gerenciar');
      } else if (filtro.profissionalId !== profissionalId) {
        throw new ForbiddenException('Filtro pessoal pertence a outro profissional.');
      }

      filtro.arquivadoEm = new Date();
      await repositorio.save(filtro);
    });
  }

  private resumo(filtro: FiltroSalvoPacienteOrm, nome: string) {
    return {
      id: filtro.id,
      nome,
      origem: filtro.origem,
      criterios: filtro.criterios,
      atualizadoEm: filtro.atualizadoEm
    };
  }

  private garantirAcesso(usuario: UsuarioAutenticado, permissao: PermissaoOctaClin) {
    if (!usuario.permissoes.includes(permissao)) {
      throw new ForbiddenException('Permissao insuficiente para operar filtros salvos.');
    }
  }
}
