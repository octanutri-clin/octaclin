import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  AtualizarContatoCadastroPacienteDto,
  AtualizarFiscalCadastroPacienteDto,
  AtualizarIdentificacaoCadastroPacienteDto,
  AtualizarOperacaoCadastroPacienteDto,
  FiscalCadastroPacienteRespostaDto,
  PerfilCadastroPacienteRespostaDto
} from './dtos';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { PerfilCadastroPacienteOrm } from '../infraestrutura/perfil-cadastro-paciente.orm';

type CampoCifrado =
  | 'identificacaoCriptografada'
  | 'contatoCriptografado'
  | 'operacaoCriptografada'
  | 'fiscalCriptografado';

@Injectable()
export class ServicoPerfilCadastroPaciente {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async obter(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<PerfilCadastroPacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const perfil = await gerenciador.getRepository(PerfilCadastroPacienteOrm).findOne({
        where: { tenantId, pacienteId }
      });
      return {
        identificacao: usuario.papel === 'Professional' || usuario.papel === 'SuperAdmin'
          ? this.descriptografarBloco(perfil?.identificacaoCriptografada)
          : undefined,
        contato: this.descriptografarBloco(perfil?.contatoCriptografado),
        operacao: this.descriptografarBloco(perfil?.operacaoCriptografada),
        atualizadoEm: perfil?.atualizadoEm
      };
    });
  }

  async atualizarIdentificacao(
    tenantId: string,
    pacienteId: string,
    dados: AtualizarIdentificacaoCadastroPacienteDto,
    usuario: UsuarioAutenticado
  ): Promise<AtualizarIdentificacaoCadastroPacienteDto> {
    if (dados.condicaoBiologica && dados.sexo !== 'feminino') {
      throw new BadRequestException('A condicao biologica so pode ser registrada para sexo feminino.');
    }
    return this.atualizarBloco(tenantId, pacienteId, 'identificacaoCriptografada', dados, usuario);
  }

  async atualizarContato(
    tenantId: string,
    pacienteId: string,
    dados: AtualizarContatoCadastroPacienteDto,
    usuario: UsuarioAutenticado
  ): Promise<AtualizarContatoCadastroPacienteDto> {
    const telefone = dados.ddi && dados.celular ? `${dados.ddi}${dados.celular}` : dados.telefone;
    return this.atualizarBloco(tenantId, pacienteId, 'contatoCriptografado', { ...dados, telefone }, usuario);
  }

  async atualizarOperacao(
    tenantId: string,
    pacienteId: string,
    dados: AtualizarOperacaoCadastroPacienteDto,
    usuario: UsuarioAutenticado
  ): Promise<AtualizarOperacaoCadastroPacienteDto> {
    return this.atualizarBloco(tenantId, pacienteId, 'operacaoCriptografada', dados, usuario);
  }

  async obterFiscal(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<FiscalCadastroPacienteRespostaDto> {
    this.garantirPermissaoFinanceira(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const perfil = await gerenciador.getRepository(PerfilCadastroPacienteOrm).findOne({
        where: { tenantId, pacienteId }
      });
      return { ...this.descriptografarBloco(perfil?.fiscalCriptografado), atualizadoEm: perfil?.atualizadoEm };
    });
  }

  async atualizarFiscal(
    tenantId: string,
    pacienteId: string,
    dados: AtualizarFiscalCadastroPacienteDto,
    usuario: UsuarioAutenticado
  ): Promise<AtualizarFiscalCadastroPacienteDto> {
    this.garantirPermissaoFinanceira(usuario);
    return this.atualizarBloco(tenantId, pacienteId, 'fiscalCriptografado', dados, usuario);
  }

  private async atualizarBloco<T extends object>(
    tenantId: string,
    pacienteId: string,
    campo: CampoCifrado,
    dados: T,
    usuario: UsuarioAutenticado
  ): Promise<T> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const repositorio = gerenciador.getRepository(PerfilCadastroPacienteOrm);
      const perfil = (await repositorio.findOne({ where: { tenantId, pacienteId } })) ?? repositorio.create({ tenantId, pacienteId });
      perfil[campo] = this.criptografia.criptografar(JSON.stringify(dados));
      await repositorio.save(perfil);
      return dados;
    });
  }

  private async garantirPacienteAcessivel(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<void> {
    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: {
        id: pacienteId,
        tenantId,
        arquivadoEm: IsNull(),
        ...(profissionalResponsavelId ? { profissionalResponsavelId } : {})
      }
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
  }

  private garantirPermissaoFinanceira(usuario: UsuarioAutenticado): void {
    if (!usuario.permissoes.includes('agenda.financeiro.ler')) {
      throw new ForbiddenException('Usuario sem permissao para dados fiscais.');
    }
  }

  private descriptografarBloco<T extends object>(valor?: Buffer): T | undefined {
    if (!valor) return undefined;
    try {
      const resultado: unknown = JSON.parse(this.criptografia.descriptografar(valor));
      if (!resultado || typeof resultado !== 'object' || Array.isArray(resultado)) return undefined;
      return resultado as T;
    } catch {
      return undefined;
    }
  }
}
