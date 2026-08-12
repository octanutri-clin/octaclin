import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ConsentimentoEvolucaoFotograficaOrm } from '../infraestrutura/consentimento-evolucao-fotografica.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { RegistrarConsentimentoEvolucaoFotograficaDto } from './dtos';

export interface ConsentimentoEvolucaoFotograficaResposta {
  id: string;
  versao: string;
  consentidoEm: string;
  retencaoAte: string;
  revogadoEm?: string;
  ativo: boolean;
}

@Injectable()
export class ServicoConsentimentosEvolucaoFotografica {
  constructor(private readonly executorTenant: ExecutorTenant, private readonly criptografia: CriptografiaDadosSensiveis) {}

  async listar(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<ConsentimentoEvolucaoFotograficaResposta[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const itens = await gerenciador.getRepository(ConsentimentoEvolucaoFotograficaOrm).find({
        where: { tenantId, pacienteId }, order: { criadoEm: 'DESC' }
      });
      return itens.map((item) => this.responder(item));
    });
  }

  async registrar(tenantId: string, pacienteId: string, dados: RegistrarConsentimentoEvolucaoFotograficaDto, usuario: UsuarioAutenticado): Promise<ConsentimentoEvolucaoFotograficaResposta> {
    if (dados.retencaoAte < new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('A data de retencao deve ser atual ou futura.');
    }
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const repositorio = gerenciador.getRepository(ConsentimentoEvolucaoFotograficaOrm);
      const registro = await repositorio.save(repositorio.create({
        tenantId,
        pacienteId,
        registradoPorUsuarioId: usuario.usuarioId,
        versao: dados.versao.trim(),
        consentidoEm: new Date(),
        retencaoAte: dados.retencaoAte,
        evidenciaCriptografada: dados.evidencia?.trim() ? this.criptografia.criptografar(dados.evidencia.trim()) : undefined
      }));
      return this.responder(registro);
    });
  }

  async revogar(tenantId: string, pacienteId: string, consentimentoId: string, usuario: UsuarioAutenticado): Promise<ConsentimentoEvolucaoFotograficaResposta> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const repositorio = gerenciador.getRepository(ConsentimentoEvolucaoFotograficaOrm);
      const registro = await repositorio.findOne({ where: { id: consentimentoId, tenantId, pacienteId, revogadoEm: IsNull() } });
      if (!registro) throw new NotFoundException('Consentimento ativo nao encontrado.');
      registro.revogadoEm = new Date();
      return this.responder(await repositorio.save(registro));
    });
  }

  private async garantirPacienteAcessivel(gerenciador: EntityManager, tenantId: string, pacienteId: string, usuario: UsuarioAutenticado) {
    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: { id: pacienteId, tenantId, arquivadoEm: IsNull(), ...(profissionalResponsavelId ? { profissionalResponsavelId } : {}) }
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
  }

  private responder(registro: ConsentimentoEvolucaoFotograficaOrm): ConsentimentoEvolucaoFotograficaResposta {
    return {
      id: registro.id,
      versao: registro.versao,
      consentidoEm: registro.consentidoEm.toISOString(),
      retencaoAte: registro.retencaoAte,
      revogadoEm: registro.revogadoEm?.toISOString(),
      ativo: !registro.revogadoEm
    };
  }
}
