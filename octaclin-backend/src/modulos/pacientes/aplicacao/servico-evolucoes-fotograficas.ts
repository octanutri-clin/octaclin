import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoMobile } from '../../mobile/aplicacao/servico-mobile';
import { ArquivoMidiaOrm } from '../../mobile/infraestrutura/arquivo-midia.orm';
import { ConsentimentoEvolucaoFotograficaOrm } from '../infraestrutura/consentimento-evolucao-fotografica.orm';
import { EvolucaoFotograficaArquivoOrm } from '../infraestrutura/evolucao-fotografica-arquivo.orm';
import { EvolucaoFotograficaOrm } from '../infraestrutura/evolucao-fotografica.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { SolicitarUploadEvolucaoFotograficaDto } from './dtos';

export type EvolucaoFotograficaResposta = {
  id: string;
  consentimentoId: string;
  protocolo: string;
  capturadaEm: string;
  observacoes?: string;
  arquivos: Array<{ id: string; nomeArquivo?: string; mimeType: string; tamanhoBytes: string }>;
};

@Injectable()
export class ServicoEvolucoesFotograficas {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly servicoMobile: ServicoMobile
  ) {}

  async solicitarUpload(tenantId: string, pacienteId: string, dados: SolicitarUploadEvolucaoFotograficaDto, usuario: UsuarioAutenticado) {
    const evolucaoId = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      await this.garantirConsentimentoAtivo(gerenciador, tenantId, pacienteId, dados.consentimentoId);
      const evolucao = await gerenciador.getRepository(EvolucaoFotograficaOrm).save(
        gerenciador.getRepository(EvolucaoFotograficaOrm).create({
          tenantId,
          pacienteId,
          consentimentoId: dados.consentimentoId,
          autorUsuarioId: usuario.usuarioId,
          protocoloCriptografado: this.criptografia.criptografar(dados.protocolo.trim()),
          capturadaEm: dados.capturadaEm.slice(0, 10),
          observacoesCriptografadas: dados.observacoes?.trim()
            ? this.criptografia.criptografar(dados.observacoes.trim())
            : undefined
        })
      );
      return evolucao.id;
    });

    try {
      const upload = await this.servicoMobile.solicitarUploadMidia(
        tenantId,
        {
          pacienteId,
          tipo: 'imagem',
          categoria: 'foto',
          mimeType: dados.mimeType,
          tamanhoBytes: dados.tamanhoBytes,
          nomeArquivo: dados.nomeArquivo,
          vinculoClinico: { tipo: 'evolucao_fotografica', recursoId: evolucaoId }
        },
        usuario
      );
      return { evolucaoId, upload };
    } catch (erro) {
      await this.executorTenant.executar(tenantId, async (gerenciador) => {
        const evolucao = await gerenciador.getRepository(EvolucaoFotograficaOrm).findOne({ where: { id: evolucaoId, tenantId, pacienteId } });
        if (evolucao && !evolucao.excluidaEm) {
          evolucao.excluidaEm = new Date();
          await gerenciador.getRepository(EvolucaoFotograficaOrm).save(evolucao);
        }
      });
      throw erro;
    }
  }

  async listar(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<EvolucaoFotograficaResposta[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const evolucoes = await gerenciador.getRepository(EvolucaoFotograficaOrm).find({
        where: { tenantId, pacienteId, excluidaEm: IsNull() }, order: { capturadaEm: 'DESC', criadoEm: 'DESC' }
      });
      if (!evolucoes.length) return [];
      const vinculos = await gerenciador.getRepository(EvolucaoFotograficaArquivoOrm).find({
        where: { tenantId, evolucaoFotograficaId: In(evolucoes.map((item) => item.id)) }
      });
      const arquivoIds = vinculos.map((item) => item.arquivoMidiaId);
      const arquivos = arquivoIds.length
        ? await gerenciador.getRepository(ArquivoMidiaOrm).find({ where: { tenantId, id: In(arquivoIds), status: 'confirmado' } })
        : [];
      return evolucoes.map((item) => ({
        id: item.id,
        consentimentoId: item.consentimentoId,
        protocolo: this.criptografia.descriptografar(item.protocoloCriptografado),
        capturadaEm: item.capturadaEm,
        observacoes: item.observacoesCriptografadas ? this.criptografia.descriptografar(item.observacoesCriptografadas) : undefined,
        arquivos: vinculos
          .filter((vinculo) => vinculo.evolucaoFotograficaId === item.id)
          .map((vinculo) => arquivos.find((arquivo) => arquivo.id === vinculo.arquivoMidiaId))
          .filter((arquivo): arquivo is ArquivoMidiaOrm => Boolean(arquivo))
          .map((arquivo) => ({
            id: arquivo.id,
            nomeArquivo: arquivo.nomeOriginalCriptografado ? this.criptografia.descriptografar(arquivo.nomeOriginalCriptografado) : undefined,
            mimeType: arquivo.mimeType,
            tamanhoBytes: arquivo.tamanhoBytes
          }))
      }));
    });
  }

  private async garantirConsentimentoAtivo(gerenciador: EntityManager, tenantId: string, pacienteId: string, consentimentoId: string) {
    const consentimento = await gerenciador.getRepository(ConsentimentoEvolucaoFotograficaOrm).findOne({
      where: { id: consentimentoId, tenantId, pacienteId, revogadoEm: IsNull() }
    });
    if (!consentimento || consentimento.retencaoAte < new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('E necessario um consentimento fotografico ativo, dentro do prazo de retencao.');
    }
  }

  private async garantirPacienteAcessivel(gerenciador: EntityManager, tenantId: string, pacienteId: string, usuario: UsuarioAutenticado) {
    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: { id: pacienteId, tenantId, arquivadoEm: IsNull(), ...(profissionalResponsavelId ? { profissionalResponsavelId } : {}) }
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
  }
}
