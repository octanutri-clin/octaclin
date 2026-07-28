import { createHash } from 'crypto';
import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import {
  resolverFiltroEscopoRecursosPaciente,
  validarPacienteNoEscopo
} from '../../../infraestrutura/seguranca/escopo-recursos-paciente';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ArquivoMidiaOrm } from '../../mobile/infraestrutura/arquivo-midia.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { AnalisarSentimentoDto, ReconhecerAlimentoDto } from './dtos';
import { AnaliseSentimentoOrm } from '../infraestrutura/analise-sentimento.orm';
import { ReconhecimentoAlimentarOrm } from '../infraestrutura/reconhecimento-alimentar.orm';

interface RespostaServicoSentimento {
  ansiedade_score: number;
  frustracao_score: number;
  motivacao_score: number;
  confusao_score: number;
  explicacao: Record<string, unknown>;
}

interface RespostaServicoAlimento {
  provedor: string;
  imagem_hash: string;
  alimentos_detectados: Array<Record<string, unknown>>;
  peso_estimado_gramas?: number;
  calorias_estimadas?: number;
  confianca_media?: number;
}

@Injectable()
export class ServicoIa {
  private readonly logger = new Logger(ServicoIa.name);

  constructor(private readonly executorTenant: ExecutorTenant) {}

  async listarAnalisesSentimento(
    tenantId: string,
    usuario: UsuarioAutenticado
  ): Promise<AnaliseSentimentoOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(AnaliseSentimentoOrm).find({
        where: { tenantId, ...(await this.resolverFiltroPacienteId(gerenciador, tenantId, usuario)) },
        order: { criadoEm: 'DESC' },
        take: 50
      })
    );
  }

  async analisarSentimento(
    tenantId: string,
    dados: AnalisarSentimentoDto,
    usuario: UsuarioAutenticado
  ): Promise<AnaliseSentimentoOrm> {
    await this.executorTenant.executar(tenantId, (gerenciador) =>
      validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario)
    );

    const resposta = await this.postar<RespostaServicoSentimento>('/analisar-sentimento', {
      texto: dados.texto,
      contexto: dados.contexto ?? {}
    });

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario);
      return gerenciador.getRepository(AnaliseSentimentoOrm).save(
        gerenciador.getRepository(AnaliseSentimentoOrm).create({
          tenantId,
          pacienteId: paciente.id,
          respostaCheckinId: dados.respostaCheckinId,
          transcricaoMidiaId: dados.transcricaoMidiaId,
          modelo: String(resposta.explicacao?.provedor ?? 'octaclin-ai-service'),
          ansiedadeScore: String(resposta.ansiedade_score),
          frustracaoScore: String(resposta.frustracao_score),
          motivacaoScore: String(resposta.motivacao_score),
          confusaoScore: String(resposta.confusao_score),
          explicacao: resposta.explicacao,
          alertaDisparado: resposta.frustracao_score >= 70
        })
      );
    });
  }

  async listarReconhecimentosAlimentares(
    tenantId: string,
    usuario: UsuarioAutenticado
  ): Promise<ReconhecimentoAlimentarOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(ReconhecimentoAlimentarOrm).find({
        where: { tenantId, ...(await this.resolverFiltroPacienteId(gerenciador, tenantId, usuario)) },
        order: { criadoEm: 'DESC' },
        take: 50
      })
    );
  }

  async reconhecerAlimento(
    tenantId: string,
    dados: ReconhecerAlimentoDto,
    usuario: UsuarioAutenticado
  ): Promise<ReconhecimentoAlimentarOrm> {
    const referencia = dados.imagemBase64 ?? dados.imagemUrl ?? dados.arquivoMidiaId;
    const hashLocal = createHash('sha256')
      .update(dados.pacienteId)
      .update('\0')
      .update(referencia)
      .digest('hex');

    const cache = await this.executorTenant.executar(tenantId, (gerenciador) =>
      this.validarReconhecimentoEObterCache(gerenciador, tenantId, dados, usuario, hashLocal)
    );
    if (cache) return cache;

    const resposta = await this.postar<RespostaServicoAlimento>('/reconhecer-alimento', {
      imagem_url: dados.imagemUrl,
      imagem_base64: dados.imagemBase64,
      contexto: dados.contexto ?? {}
    });

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const cacheAtualizado = await this.validarReconhecimentoEObterCache(
        gerenciador,
        tenantId,
        dados,
        usuario,
        hashLocal
      );
      if (cacheAtualizado) return cacheAtualizado;

      const repositorio = gerenciador.getRepository(ReconhecimentoAlimentarOrm);
      return repositorio.save(
        repositorio.create({
          tenantId,
          pacienteId: dados.pacienteId,
          arquivoMidiaId: dados.arquivoMidiaId,
          provedor: resposta.provedor,
          imagemHash: hashLocal,
          alimentosDetectados: resposta.alimentos_detectados,
          pesoEstimadoGramas: resposta.peso_estimado_gramas ? String(resposta.peso_estimado_gramas) : undefined,
          caloriasEstimadas: resposta.calorias_estimadas ? String(resposta.calorias_estimadas) : undefined,
          confiancaMedia: resposta.confianca_media ? String(resposta.confianca_media) : undefined
        })
      );
    });
  }

  private async resolverFiltroPacienteId(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado
  ) {
    const filtro = await resolverFiltroEscopoRecursosPaciente(gerenciador, tenantId, usuario);
    if (filtro.pacienteId) return { pacienteId: filtro.pacienteId };
    if (!filtro.profissionalResponsavelId) return {};

    const pacientes = await gerenciador.getRepository(PacienteOrm).find({
      select: { id: true },
      where: {
        tenantId,
        profissionalResponsavelId: filtro.profissionalResponsavelId,
        arquivadoEm: IsNull()
      }
    });
    return { pacienteId: In(pacientes.map((paciente) => paciente.id)) };
  }

  private async validarReconhecimentoEObterCache(
    gerenciador: EntityManager,
    tenantId: string,
    dados: ReconhecerAlimentoDto,
    usuario: UsuarioAutenticado,
    hashLocal: string
  ): Promise<ReconhecimentoAlimentarOrm | null> {
    const paciente = await validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario);
    const arquivo = await gerenciador.getRepository(ArquivoMidiaOrm).findOne({
      where: { id: dados.arquivoMidiaId, tenantId, pacienteId: paciente.id }
    });
    if (!arquivo) throw new NotFoundException('Recurso nao encontrado.');

    return gerenciador.getRepository(ReconhecimentoAlimentarOrm).findOne({
      where: {
        tenantId,
        pacienteId: paciente.id,
        provedor: 'heuristica-local',
        imagemHash: hashLocal
      }
    });
  }

  private async postar<T>(caminho: string, corpo: Record<string, unknown>): Promise<T> {
    const baseUrl = process.env.IA_SERVICE_URL ?? 'http://localhost:8001';
    let resposta: Response;
    try {
      resposta = await fetch(`${baseUrl}${caminho}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
      });
    } catch (erro) {
      this.logger.error('Falha de comunicacao com o provedor de IA.', {
        caminho,
        tipoErro: erro instanceof Error ? erro.name : 'desconhecido'
      });
      throw this.criarErroProvedor();
    }

    if (!resposta.ok) {
      this.logger.error('Provedor de IA respondeu com erro.', { caminho, status: resposta.status });
      throw this.criarErroProvedor();
    }

    try {
      return (await resposta.json()) as T;
    } catch (erro) {
      this.logger.error('Provedor de IA retornou resposta invalida.', {
        caminho,
        tipoErro: erro instanceof Error ? erro.name : 'desconhecido'
      });
      throw this.criarErroProvedor();
    }
  }

  private criarErroProvedor(): InternalServerErrorException {
    return new InternalServerErrorException('Falha ao processar solicitacao no servico de IA.');
  }
}
