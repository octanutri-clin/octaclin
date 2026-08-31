import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
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
  revisao_humana_obrigatoria: true;
  explicacao: {
    provedor: string;
    limitacoes: string[];
    sinais: Record<'ansiedade' | 'frustracao' | 'motivacao' | 'confusao', string[]>;
  };
}

interface AlimentoDetectadoIa {
  nome: string;
  confianca: number;
  calorias_estimadas?: number;
}

interface RespostaServicoAlimento {
  provedor: string;
  imagem_hash: string;
  alimentos_detectados: AlimentoDetectadoIa[];
  peso_estimado_gramas?: number;
  calorias_estimadas?: number;
  confianca_media?: number;
  limitacoes: string[];
  revisao_humana_obrigatoria: true;
}

const TAMANHO_MAXIMO_RESPOSTA_IA = 512 * 1024;
const HASH_SHA256 = /^[a-f0-9]{64}$/i;
const ORIGENS_SENTIMENTO = new Set(['checkin_manual', 'transcricao_audio', 'mensagem_paciente']);

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
    const contexto = contextoSentimentoSeguro(dados.contexto);
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario);
      await this.validarReferenciasSentimento(gerenciador, tenantId, dados);
    });

    const resposta = await this.postar('/analisar-sentimento', {
      texto: dados.texto,
      contexto
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
    const contexto = contextoAlimentoSeguro(dados.contexto);
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

      const resposta = await this.postar('/reconhecer-alimento', {
        imagem_hash: arquivo.hashConteudo,
        contexto
      }, (valor) => validarRespostaAlimento(valor, arquivo.hashConteudo!));

      const alimentosDetectados: Array<Record<string, unknown>> = resposta.alimentos_detectados.map(
        (alimento) => ({ ...alimento })
      );

      return repositorio.save(
        repositorio.create({
          tenantId,
          pacienteId: dados.pacienteId,
          arquivoMidiaId: arquivo.id,
          provedor: resposta.provedor,
          imagemHash: arquivo.hashConteudo,
          alimentosDetectados,
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
    this.validarRevisao(dados, 'sentimento');
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
    this.validarRevisao(dados, 'reconhecimento');
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

  private validarRevisao(dados: RevisarSugestaoIaDto, tipo: 'sentimento' | 'reconhecimento') {
    if (dados.observacao !== undefined && (!dados.observacao.trim() || dados.observacao.length > 1000)) {
      throw new BadRequestException('Observacao da revisao invalida.');
    }
    if (dados.decisao !== 'editada') {
      if (dados.conteudoEditado !== undefined) {
        throw new BadRequestException('Conteudo corrigido so e permitido para uma sugestao editada.');
      }
      return;
    }

    const chave = tipo === 'sentimento' ? 'interpretacaoProfissional' : 'alimentosCorrigidos';
    if (
      !objeto(dados.conteudoEditado)
      || !temSomenteChaves(dados.conteudoEditado, [chave])
      || !textoLimitado(dados.conteudoEditado[chave], 1, 1000)
    ) {
      throw new BadRequestException('Informe o conteudo corrigido da sugestao no formato esperado.');
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
        redirect: 'error',
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
      const configurada = process.env.IA_SERVICE_URL?.trim();
      if (!configurada) throw new Error('URL ausente');
      const base = new URL(configurada);
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
  if (
    !objeto(valor)
    || !temSomenteChaves(valor, [
      'ansiedade_score',
      'frustracao_score',
      'motivacao_score',
      'confusao_score',
      'explicacao',
      'revisao_humana_obrigatoria'
    ])
    || valor.revisao_humana_obrigatoria !== true
    || !explicacaoSentimentoValida(valor.explicacao)
  ) {
    throw new BadGatewayException('Resposta invalida do servico de IA.');
  }
  for (const campo of ['ansiedade_score', 'frustracao_score', 'motivacao_score', 'confusao_score'] as const) {
    if (!numeroEntre(valor[campo], 0, 100)) throw new BadGatewayException('Resposta invalida do servico de IA.');
  }
  return valor as unknown as RespostaServicoSentimento;
}

function validarRespostaAlimento(valor: unknown, hashEsperado: string): RespostaServicoAlimento {
  if (
    !objeto(valor)
    || !temSomenteChaves(valor, [
      'provedor',
      'imagem_hash',
      'alimentos_detectados',
      'peso_estimado_gramas',
      'calorias_estimadas',
      'confianca_media',
      'limitacoes',
      'revisao_humana_obrigatoria'
    ])
    || typeof valor.provedor !== 'string'
    || valor.provedor.length < 1
    || valor.provedor.length > 80
    || valor.imagem_hash !== hashEsperado
    || !Array.isArray(valor.alimentos_detectados)
    || valor.alimentos_detectados.length > 100
    || !valor.alimentos_detectados.every(alimentoDetectadoValido)
    || !Array.isArray(valor.limitacoes)
    || valor.limitacoes.length > 20
    || !valor.limitacoes.every((item) => typeof item === 'string' && item.length <= 500)
    || valor.revisao_humana_obrigatoria !== true
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

function contextoSentimentoSeguro(contexto?: unknown): Record<string, string> {
  if (contexto === undefined) return {};
  if (!objeto(contexto) || !temSomenteChaves(contexto, ['origem'])) {
    throw new BadRequestException('Contexto da analise de sentimento invalido.');
  }
  if (contexto.origem === undefined) return {};
  if (typeof contexto.origem !== 'string' || !ORIGENS_SENTIMENTO.has(contexto.origem)) {
    throw new BadRequestException('Origem da analise de sentimento invalida.');
  }
  return { origem: contexto.origem };
}

function contextoAlimentoSeguro(contexto?: unknown): Record<string, string> {
  if (contexto === undefined) return {};
  if (!objeto(contexto) || !temSomenteChaves(contexto, ['observacao'])) {
    throw new BadRequestException('Contexto do reconhecimento alimentar invalido.');
  }
  if (contexto.observacao === undefined) return {};
  if (!textoLimitado(contexto.observacao, 1, 500)) {
    throw new BadRequestException('Observacao do reconhecimento alimentar invalida.');
  }
  return { observacao: contexto.observacao.trim() };
}

function explicacaoSentimentoValida(valor: unknown): valor is RespostaServicoSentimento['explicacao'] {
  if (
    !objeto(valor)
    || !temSomenteChaves(valor, ['provedor', 'limitacoes', 'sinais'])
    || !textoLimitado(valor.provedor, 1, 80)
    || !Array.isArray(valor.limitacoes)
    || valor.limitacoes.length > 20
    || !valor.limitacoes.every((item) => textoLimitado(item, 1, 500))
    || !objeto(valor.sinais)
    || !temSomenteChaves(valor.sinais, ['ansiedade', 'frustracao', 'motivacao', 'confusao'])
  ) return false;

  const sinaisPorCategoria = valor.sinais as Record<string, unknown>;
  return ['ansiedade', 'frustracao', 'motivacao', 'confusao'].every((chave) => {
    const sinais = sinaisPorCategoria[chave];
    return Array.isArray(sinais)
      && sinais.length <= 50
      && sinais.every((item) => textoLimitado(item, 1, 100));
  });
}

function alimentoDetectadoValido(valor: unknown): valor is AlimentoDetectadoIa {
  return objeto(valor)
    && temSomenteChaves(valor, ['nome', 'confianca', 'calorias_estimadas'])
    && textoLimitado(valor.nome, 1, 160)
    && numeroEntre(valor.confianca, 0, 1)
    && (valor.calorias_estimadas === undefined || numeroEntre(valor.calorias_estimadas, 0, 1_000_000));
}

function temSomenteChaves(valor: Record<string, unknown>, permitidas: string[]): boolean {
  const conjunto = new Set(permitidas);
  return Object.keys(valor).every((chave) => conjunto.has(chave));
}

function textoLimitado(valor: unknown, minimo: number, maximo: number): valor is string {
  return typeof valor === 'string' && valor.trim().length >= minimo && valor.length <= maximo;
}
