import { createHash } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
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
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async listarAnalisesSentimento(tenantId: string): Promise<AnaliseSentimentoOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(AnaliseSentimentoOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' },
        take: 50
      })
    );
  }

  async analisarSentimento(tenantId: string, dados: AnalisarSentimentoDto): Promise<AnaliseSentimentoOrm> {
    const resposta = await this.postar<RespostaServicoSentimento>('/analisar-sentimento', {
      texto: dados.texto,
      contexto: dados.contexto ?? {}
    });

    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(AnaliseSentimentoOrm).save(
        gerenciador.getRepository(AnaliseSentimentoOrm).create({
          tenantId,
          pacienteId: dados.pacienteId,
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
      )
    );
  }

  async listarReconhecimentosAlimentares(tenantId: string): Promise<ReconhecimentoAlimentarOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(ReconhecimentoAlimentarOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' },
        take: 50
      })
    );
  }

  async reconhecerAlimento(tenantId: string, dados: ReconhecerAlimentoDto): Promise<ReconhecimentoAlimentarOrm> {
    const referencia = dados.imagemBase64 ?? dados.imagemUrl ?? dados.arquivoMidiaId;
    const hashLocal = createHash('sha256').update(referencia).digest('hex');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ReconhecimentoAlimentarOrm);
      const cache = await repositorio.findOne({
        where: {
          tenantId,
          provedor: 'heuristica-local',
          imagemHash: hashLocal
        }
      });
      if (cache) return cache;

      const resposta = await this.postar<RespostaServicoAlimento>('/reconhecer-alimento', {
        imagem_url: dados.imagemUrl,
        imagem_base64: dados.imagemBase64,
        contexto: dados.contexto ?? {}
      });

      return repositorio.save(
        repositorio.create({
          tenantId,
          pacienteId: dados.pacienteId,
          arquivoMidiaId: dados.arquivoMidiaId,
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

  private async postar<T>(caminho: string, corpo: Record<string, unknown>): Promise<T> {
    const baseUrl = process.env.IA_SERVICE_URL ?? 'http://localhost:8001';
    const resposta = await fetch(`${baseUrl}${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });

    if (!resposta.ok) {
      throw new InternalServerErrorException(`Falha no servico de IA: ${await resposta.text()}`);
    }

    return (await resposta.json()) as T;
  }
}
