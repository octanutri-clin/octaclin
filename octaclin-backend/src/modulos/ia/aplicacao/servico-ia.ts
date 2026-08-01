import { createHash } from 'crypto';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { AnalisarSentimentoDto, ReconhecerAlimentoDto, RevisarSugestaoIaDto } from './dtos';
import { AnaliseSentimentoOrm } from '../infraestrutura/analise-sentimento.orm';
import { ReconhecimentoAlimentarOrm } from '../infraestrutura/reconhecimento-alimentar.orm';
import { criarRevisaoHumana } from '../dominio/revisao-humana';

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
  limitacoes: string[];
}

@Injectable()
export class ServicoIa {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async listarAnalisesSentimento(tenantId: string, usuario: UsuarioAutenticado): Promise<AnaliseSentimentoOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const pacienteIds = await this.obterPacienteIdsNoEscopo(gerenciador, tenantId, usuario);
      return gerenciador.getRepository(AnaliseSentimentoOrm).find({
        where: { tenantId, ...(pacienteIds ? { pacienteId: In(pacienteIds) } : {}) },
        order: { criadoEm: 'DESC' },
        take: 50
      });
    });
  }

  async analisarSentimento(
    tenantId: string,
    dados: AnalisarSentimentoDto,
    usuario: UsuarioAutenticado
  ): Promise<AnaliseSentimentoOrm> {
    await this.executorTenant.executar(tenantId, (gerenciador) =>
      this.validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario)
    );
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
          alertaDisparado: false,
          revisaoHumana: { status: 'pendente' }
        })
      )
    );
  }

  async listarReconhecimentosAlimentares(tenantId: string, usuario: UsuarioAutenticado): Promise<ReconhecimentoAlimentarOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const pacienteIds = await this.obterPacienteIdsNoEscopo(gerenciador, tenantId, usuario);
      return gerenciador.getRepository(ReconhecimentoAlimentarOrm).find({
        where: { tenantId, ...(pacienteIds ? { pacienteId: In(pacienteIds) } : {}) },
        order: { criadoEm: 'DESC' },
        take: 50
      });
    });
  }

  async reconhecerAlimento(
    tenantId: string,
    dados: ReconhecerAlimentoDto,
    usuario: UsuarioAutenticado
  ): Promise<ReconhecimentoAlimentarOrm> {
    const referencia = dados.imagemBase64 ?? dados.imagemUrl ?? dados.arquivoMidiaId;
    const hashLocal = createHash('sha256').update(referencia).digest('hex');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario);
      const repositorio = gerenciador.getRepository(ReconhecimentoAlimentarOrm);
      const cache = await repositorio.findOne({
        where: {
          tenantId,
          pacienteId: dados.pacienteId,
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
          confiancaMedia: resposta.confianca_media ? String(resposta.confianca_media) : undefined,
          limitacoes: resposta.limitacoes,
          revisaoHumana: { status: 'pendente' }
        })
      );
    });
  }

  async revisarAnaliseSentimento(
    tenantId: string,
    id: string,
    dados: RevisarSugestaoIaDto,
    usuario: UsuarioAutenticado
  ): Promise<AnaliseSentimentoOrm> {
    this.validarRevisao(dados);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AnaliseSentimentoOrm);
      const analise = await repositorio.findOne({ where: { id, tenantId } });
      if (!analise) throw new NotFoundException('Sugestao de IA nao encontrada.');
      await this.validarPacienteNoEscopo(gerenciador, tenantId, analise.pacienteId, usuario);
      analise.revisaoHumana = criarRevisaoHumana(
        dados.decisao,
        usuario.usuarioId,
        dados.observacao,
        dados.conteudoEditado
      );
      analise.alertaDisparado = dados.decisao !== 'rejeitada' && Number(analise.frustracaoScore) >= 70;
      return repositorio.save(analise);
    });
  }

  async revisarReconhecimentoAlimentar(
    tenantId: string,
    id: string,
    dados: RevisarSugestaoIaDto,
    usuario: UsuarioAutenticado
  ): Promise<ReconhecimentoAlimentarOrm> {
    this.validarRevisao(dados);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ReconhecimentoAlimentarOrm);
      const reconhecimento = await repositorio.findOne({ where: { id, tenantId } });
      if (!reconhecimento) throw new NotFoundException('Sugestao de IA nao encontrada.');
      await this.validarPacienteNoEscopo(gerenciador, tenantId, reconhecimento.pacienteId, usuario);
      reconhecimento.revisaoHumana = criarRevisaoHumana(
        dados.decisao,
        usuario.usuarioId,
        dados.observacao,
        dados.conteudoEditado
      );
      return repositorio.save(reconhecimento);
    });
  }

  private validarRevisao(dados: RevisarSugestaoIaDto) {
    if (dados.decisao === 'editada' && !dados.conteudoEditado) {
      throw new BadRequestException('Informe o conteudo corrigido da sugestao.');
    }
  }

  private async obterPacienteIdsNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado
  ): Promise<string[] | undefined> {
    const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    if (!profissionalId) return undefined;
    const pacientes = await gerenciador.getRepository(PacienteOrm).find({
      select: { id: true },
      where: { tenantId, profissionalResponsavelId: profissionalId }
    });
    return pacientes.length ? pacientes.map((paciente) => paciente.id) : ['00000000-0000-0000-0000-000000000000'];
  }

  private async validarPacienteNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<void> {
    const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: { id: pacienteId, tenantId, ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {}) }
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
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
