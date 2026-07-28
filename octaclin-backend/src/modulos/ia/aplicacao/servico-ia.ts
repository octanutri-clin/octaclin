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

const IA_SERVICE_TIMEOUT_PADRAO_MS = 15000;
const IA_SERVICE_TIMEOUT_MINIMO_MS = 1000;
const IA_SERVICE_TIMEOUT_MAXIMO_MS = 60000;

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
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario, {
        lockPessimista: true
      });
      const resposta = await this.postar<RespostaServicoSentimento>('/analisar-sentimento', {
        texto: dados.texto,
        contexto: dados.contexto ?? {}
      });

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
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario, {
        lockPessimista: true
      });
      const arquivo = await gerenciador.getRepository(ArquivoMidiaOrm).findOne({
        where: { id: dados.arquivoMidiaId, tenantId, pacienteId: paciente.id },
        lock: { mode: 'pessimistic_write' }
      });
      if (!arquivo) throw new NotFoundException('Recurso nao encontrado.');

      const imagemUrl = this.construirUrlMidiaConfiavel(arquivo);
      const hashEsperado = createHash('sha256').update(imagemUrl).digest('hex');
      await this.adquirirLockReconhecimento(gerenciador, tenantId, paciente.id, hashEsperado);
      const repositorio = gerenciador.getRepository(ReconhecimentoAlimentarOrm);
      const cache = await repositorio.findOne({
        where: {
          tenantId,
          pacienteId: paciente.id,
          arquivoMidiaId: arquivo.id,
          imagemHash: hashEsperado
        }
      });
      if (cache) return cache;

      const resposta = await this.postar<RespostaServicoAlimento>('/reconhecer-alimento', {
        imagem_url: imagemUrl,
        contexto: dados.contexto ?? {}
      });
      this.validarRespostaReconhecimento(resposta, hashEsperado);

      return repositorio.save(
        repositorio.create({
          tenantId,
          pacienteId: paciente.id,
          arquivoMidiaId: arquivo.id,
          provedor: resposta.provedor,
          imagemHash: resposta.imagem_hash,
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

  private construirUrlMidiaConfiavel(arquivo: ArquivoMidiaOrm): string {
    const baseUrl = (process.env.ARMAZENAMENTO_UPLOAD_BASE_URL ?? 'http://localhost:9000').replace(/\/+$/, '');
    const bucket = arquivo.bucket.replace(/^\/+|\/+$/g, '');
    const chaveObjeto = arquivo.chaveObjeto.replace(/^\/+/, '');
    return `${baseUrl}/${bucket}/${chaveObjeto}`;
  }

  private async adquirirLockReconhecimento(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    hashEsperado: string
  ): Promise<void> {
    const chave = createHash('sha256')
      .update(tenantId)
      .update('\0')
      .update(pacienteId)
      .update('\0')
      .update(hashEsperado)
      .digest();
    await gerenciador.query('select pg_advisory_xact_lock($1, $2)', [
      chave.readInt32BE(0),
      chave.readInt32BE(4)
    ]);
  }

  private validarRespostaReconhecimento(
    resposta: RespostaServicoAlimento,
    hashEsperado: string
  ): void {
    if (
      typeof resposta.provedor !== 'string' ||
      resposta.provedor.length === 0 ||
      typeof resposta.imagem_hash !== 'string' ||
      resposta.imagem_hash !== hashEsperado
    ) {
      this.logger.error('Provedor de IA retornou hash de imagem divergente.', {
        caminho: '/reconhecer-alimento'
      });
      throw this.criarErroProvedor();
    }
  }

  private async postar<T>(caminho: string, corpo: Record<string, unknown>): Promise<T> {
    const baseUrl = process.env.IA_SERVICE_URL ?? 'http://localhost:8001';
    const timeoutMs = this.resolverTimeoutServicoIa();
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      let resposta: Response;
      try {
        resposta = await fetch(`${baseUrl}${caminho}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corpo),
          signal: controlador.signal
        });
      } catch (erro) {
        if (this.ehAbortError(erro)) {
          this.logger.error('Timeout ao chamar o provedor de IA.', { caminho, timeoutMs });
        } else {
          this.logger.error('Falha de comunicacao com o provedor de IA.', {
            caminho,
            tipoErro: erro instanceof Error ? erro.name : 'desconhecido'
          });
        }
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
    } finally {
      clearTimeout(timer);
    }
  }

  private resolverTimeoutServicoIa(): number {
    const valor = process.env.IA_SERVICE_TIMEOUT_MS;
    if (!valor || !/^\d+$/.test(valor)) return IA_SERVICE_TIMEOUT_PADRAO_MS;

    const timeoutMs = Number(valor);
    if (
      !Number.isInteger(timeoutMs) ||
      timeoutMs < IA_SERVICE_TIMEOUT_MINIMO_MS ||
      timeoutMs > IA_SERVICE_TIMEOUT_MAXIMO_MS
    ) {
      return IA_SERVICE_TIMEOUT_PADRAO_MS;
    }

    return timeoutMs;
  }

  private ehAbortError(erro: unknown): boolean {
    return (
      typeof erro === 'object' &&
      erro !== null &&
      'name' in erro &&
      erro.name === 'AbortError'
    );
  }

  private criarErroProvedor(): InternalServerErrorException {
    return new InternalServerErrorException('Falha ao processar solicitacao no servico de IA.');
  }
}
