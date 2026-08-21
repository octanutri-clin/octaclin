import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import type { PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { TETO_FILTROS_SALVOS, validarCriteriosFiltroSalvo } from '../dominio/filtros-salvos';
import { FiltroSalvoPacienteOrm } from '../infraestrutura/filtro-salvo-paciente.orm';
import { CriarFiltroSalvoDto } from './dtos-filtros-salvos';

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
