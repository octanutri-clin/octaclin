import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ServicoArmazenamentoObjetos } from '../../../infraestrutura/armazenamento/servico-armazenamento-objetos';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ArquivoMidiaOrm } from '../../mobile/infraestrutura/arquivo-midia.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { RespostaCheckinOrm } from '../../questionarios/infraestrutura/resposta-checkin.orm';
import { criarRevisaoHumana } from '../dominio/revisao-humana';
import { AnaliseSentimentoOrm } from '../infraestrutura/analise-sentimento.orm';
import { ReconhecimentoAlimentarOrm } from '../infraestrutura/reconhecimento-alimentar.orm';
import { TranscricaoMidiaOrm } from '../infraestrutura/transcricao-midia.orm';
import { AnalisarSentimentoDto, ReconhecerAlimentoDto, RevisarSugestaoIaDto } from './dtos';

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

const TAMANHO_MAXIMO_RESPOSTA_IA = 512 * 1024;
const HASH_SHA256 = /^[a-f0-9]{64}$/i;

@Injectable()
export class ServicoIa {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly armazenamento: ServicoArmazenamentoObjetos
  ) {}

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
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario);
      await this.validarReferenciasSentimento(gerenciador, tenantId, dados);
    });

    const resposta = await this.postar('/analisar-sentimento', {
      texto: dados.texto,
      contexto: dados.contexto ?? {}
    }, validarRespostaSentimento);

    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(AnaliseSentimentoOrm).save(
        gerenciador.getRepository(AnaliseSentimentoOrm).create({
          tenantId,
          pacienteId: dados.pacienteId,
          respostaCheckinId: dados.respostaCheckinId,
          transcricaoMidiaId: dados.transcricaoMidiaId,
          modelo: typeof resposta.explicacao.provedor === 'string'
            ? resposta.explicacao.provedor.slice(0, 80)
            : 'octaclin-ai-service',
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

  async listarReconhecimentosAlimentares(
    tenantId: string,
    usuario: UsuarioAutenticado
  ): Promise<ReconhecimentoAlimentarOrm[]> {
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
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario);
      const arquivo = await gerenciador.getRepository(ArquivoMidiaOrm).findOne({
        where: {
          id: dados.arquivoMidiaId,
          tenantId,
          pacienteId: dados.pacienteId,
          status: 'confirmado',
          tipo: 'imagem'
        }
      });
      if (!arquivo) throw new NotFoundException('Imagem clinica confirmada nao encontrada para o paciente.');
      if (!arquivo.hashConteudo || !HASH_SHA256.test(arquivo.hashConteudo)) {
        throw new BadRequestException('Imagem clinica sem hash de integridade valido.');
      }

      const repositorio = gerenciador.getRepository(ReconhecimentoAlimentarOrm);
      const chaveLock = `${tenantId}:${dados.pacienteId}:${arquivo.hashConteudo}`;
      await gerenciador.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [chaveLock]);

      const cache = await repositorio.findOne({
        where: {
          tenantId,
          pacienteId: dados.pacienteId,
          arquivoMidiaId: arquivo.id,
          imagemHash: arquivo.hashConteudo
        }
      });
      if (cache) return cache;

      const imagemUrl = await this.armazenamento.criarDownloadAssinado(arquivo.bucket, arquivo.chaveObjeto);
      const resposta = await this.postar('/reconhecer-alimento', {
        imagem_url: imagemUrl,
        imagem_hash: arquivo.hashConteudo,
        contexto: dados.contexto ?? {}
      }, (valor) => validarRespostaAlimento(valor, arquivo.hashConteudo!));

      return repositorio.save(
        repositorio.create({
          tenantId,
          pacienteId: dados.pacienteId,
          arquivoMidiaId: arquivo.id,
          provedor: resposta.provedor,
          imagemHash: arquivo.hashConteudo,
          alimentosDetectados: resposta.alimentos_detectados,
          pesoEstimadoGramas: numeroOpcionalComoTexto(resposta.peso_estimado_gramas),
          caloriasEstimadas: numeroOpcionalComoTexto(resposta.calorias_estimadas),
          confiancaMedia: numeroOpcionalComoTexto(resposta.confianca_media),
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

  private async validarReferenciasSentimento(
    gerenciador: EntityManager,
    tenantId: string,
    dados: AnalisarSentimentoDto
  ): Promise<void> {
    if (dados.respostaCheckinId) {
      const resposta = await gerenciador.getRepository(RespostaCheckinOrm).findOne({
        select: { id: true },
        where: { id: dados.respostaCheckinId, tenantId, pacienteId: dados.pacienteId }
      });
      if (!resposta) throw new NotFoundException('Resposta de check-in nao encontrada para o paciente.');
    }

    if (dados.transcricaoMidiaId) {
      const transcricao = await gerenciador.getRepository(TranscricaoMidiaOrm).findOne({
        select: { id: true, arquivoMidiaId: true },
        where: { id: dados.transcricaoMidiaId, tenantId }
      });
      if (!transcricao) throw new NotFoundException('Transcricao de midia nao encontrada para o paciente.');
      const arquivo = await gerenciador.getRepository(ArquivoMidiaOrm).findOne({
        select: { id: true },
        where: {
          id: transcricao.arquivoMidiaId,
          tenantId,
          pacienteId: dados.pacienteId,
          status: 'confirmado'
        }
      });
      if (!arquivo) throw new NotFoundException('Transcricao de midia nao encontrada para o paciente.');
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

  private async postar<T>(
    caminho: string,
    corpo: Record<string, unknown>,
    validar: (valor: unknown) => T
  ): Promise<T> {
    const token = process.env.IA_SERVICE_TOKEN?.trim();
    if (!token || token.length < 32) {
      throw new ServiceUnavailableException('Integracao com o servico de IA nao configurada.');
    }

    const url = this.criarUrlServico(caminho);
    const timeoutMs = obterTimeoutIa();
    let resposta: Response;
    try {
      resposta = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (erro) {
      if (erro instanceof Error && (erro.name === 'AbortError' || erro.name === 'TimeoutError')) {
        throw new GatewayTimeoutException('O servico de IA excedeu o tempo limite.');
      }
      throw new ServiceUnavailableException('Servico de IA indisponivel.');
    }

    if (!resposta.ok) throw new BadGatewayException('Servico de IA recusou a solicitacao.');
    const texto = await this.lerRespostaLimitada(resposta);
    try {
      return validar(JSON.parse(texto) as unknown);
    } catch (erro) {
      if (erro instanceof BadGatewayException) throw erro;
      throw new BadGatewayException('Resposta invalida do servico de IA.');
    }
  }

  private criarUrlServico(caminho: string): string {
    try {
      const base = new URL(process.env.IA_SERVICE_URL ?? 'http://localhost:8001');
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
        throw new Error('URL invalida');
      }
      base.pathname = `${base.pathname.replace(/\/$/, '')}${caminho}`;
      return base.toString();
    } catch {
      throw new ServiceUnavailableException('Integracao com o servico de IA nao configurada.');
    }
  }

  private async lerRespostaLimitada(resposta: Response): Promise<string> {
    const tamanhoDeclarado = Number(resposta.headers?.get('content-length') ?? 0);
    if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > TAMANHO_MAXIMO_RESPOSTA_IA) {
      throw new BadGatewayException('Resposta invalida do servico de IA.');
    }
    if (!resposta.body) {
      const texto = await resposta.text();
      if (!texto || Buffer.byteLength(texto, 'utf8') > TAMANHO_MAXIMO_RESPOSTA_IA) {
        throw new BadGatewayException('Resposta invalida do servico de IA.');
      }
      return texto;
    }

    const leitor = resposta.body.getReader();
    const partes: Uint8Array[] = [];
    let tamanho = 0;
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > TAMANHO_MAXIMO_RESPOSTA_IA) {
        await leitor.cancel();
        throw new BadGatewayException('Resposta invalida do servico de IA.');
      }
      partes.push(value);
    }
    if (!tamanho) throw new BadGatewayException('Resposta invalida do servico de IA.');
    return Buffer.concat(partes.map((parte) => Buffer.from(parte))).toString('utf8');
  }
}

function obterTimeoutIa(): number {
  const configurado = Number(process.env.IA_SERVICE_TIMEOUT_MS ?? 15000);
  return Number.isFinite(configurado) ? Math.min(60000, Math.max(1000, Math.trunc(configurado))) : 15000;
}

function numeroOpcionalComoTexto(valor?: number): string | undefined {
  return valor === undefined ? undefined : String(valor);
}

function validarRespostaSentimento(valor: unknown): RespostaServicoSentimento {
  if (!objeto(valor) || !objeto(valor.explicacao)) throw new BadGatewayException('Resposta invalida do servico de IA.');
  for (const campo of ['ansiedade_score', 'frustracao_score', 'motivacao_score', 'confusao_score'] as const) {
    if (!numeroEntre(valor[campo], 0, 100)) throw new BadGatewayException('Resposta invalida do servico de IA.');
  }
  return valor as unknown as RespostaServicoSentimento;
}

function validarRespostaAlimento(valor: unknown, hashEsperado: string): RespostaServicoAlimento {
  if (
    !objeto(valor)
    || typeof valor.provedor !== 'string'
    || valor.provedor.length < 1
    || valor.provedor.length > 80
    || valor.imagem_hash !== hashEsperado
    || !Array.isArray(valor.alimentos_detectados)
    || valor.alimentos_detectados.length > 100
    || !valor.alimentos_detectados.every(objeto)
    || !Array.isArray(valor.limitacoes)
    || valor.limitacoes.length > 20
    || !valor.limitacoes.every((item) => typeof item === 'string' && item.length <= 500)
  ) {
    throw new BadGatewayException('Resposta invalida do servico de IA.');
  }
  for (const campo of ['peso_estimado_gramas', 'calorias_estimadas'] as const) {
    if (valor[campo] !== undefined && !numeroEntre(valor[campo], 0, 1_000_000)) {
      throw new BadGatewayException('Resposta invalida do servico de IA.');
    }
  }
  if (valor.confianca_media !== undefined && !numeroEntre(valor.confianca_media, 0, 100)) {
    throw new BadGatewayException('Resposta invalida do servico de IA.');
  }
  return valor as unknown as RespostaServicoAlimento;
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function numeroEntre(valor: unknown, minimo: number, maximo: number): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= minimo && valor <= maximo;
}
