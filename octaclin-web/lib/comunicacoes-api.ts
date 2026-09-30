import { PacienteResumo, ProfissionalResumo, RespostaPaginada, listarPacientes, listarProfissionais } from './cadastros-api';

export type TipoCanalNotificacao = 'whatsapp' | 'email' | 'push';

export interface ConversaPortalEquipeApi {
  id: string;
  pacienteId: string;
  pacienteNome?: string;
  profissionalResponsavelId?: string;
  status: 'aguardando_clinica' | 'aguardando_paciente' | 'encerrada';
  ultimaMensagemEm: string;
  prazoRespostaEm?: string;
  atrasada: boolean;
  mensagens: Array<{ id: string; autor: 'paciente' | 'equipe'; texto: string; criadoEm: string }>;
}

export interface FilaConversaPortalEquipeApi {
  itens: ConversaPortalEquipeApi[];
  pagina: number;
  temMais: boolean;
}

export type FiltroStatusConversaPortalEquipe = 'aguardando_clinica' | 'aguardando_paciente' | 'encerrada' | 'todas';

export interface CanalNotificacaoApi {
  id: string;
  tenantId: string;
  tipo: TipoCanalNotificacao;
  nome: string;
  configuracao: Record<string, unknown>;
  ativo: boolean;
}

export interface TemplateMensagemApi {
  id: string;
  tenantId: string;
  canal: TipoCanalNotificacao;
  codigoExterno?: string;
  nome: string;
  conteudo: Record<string, unknown>;
  aprovado: boolean;
}

export interface MensagemNotificacaoApi {
  id: string;
  tenantId: string;
  pacienteId?: string;
  canalId?: string;
  templateId?: string;
  status: 'pendente' | 'processando' | 'enviado' | 'falhou' | 'recebido' | 'nota';
  payload: Record<string, unknown>;
  erro?: string;
  enviadoEm?: string;
  statusEntregaWhatsapp?: string;
  statusEntregaAtualizadoEm?: string;
  criadoEm: string;
}

export interface CriarCanalEntrada {
  tipo: TipoCanalNotificacao;
  nome: string;
  configuracao: Record<string, unknown>;
  ativo?: boolean;
}

export interface CriarTemplateEntrada {
  canal: TipoCanalNotificacao;
  codigoExterno?: string;
  nome: string;
  conteudo: Record<string, unknown>;
  aprovado?: boolean;
}

export interface DispararMensagemEntrada {
  pacienteId: string;
  canalId: string;
  templateId: string;
  payload: Record<string, unknown>;
  ignorarOptOut?: boolean;
}

export interface AssociarContatoWhatsappEntrada {
  contato: string;
  pacienteId: string;
  atualizarContatoPaciente?: boolean;
}

export interface AssociarContatoWhatsappResposta {
  pacienteId: string;
  contato: string;
  mensagensAtualizadas: number;
  contatoPacienteAtualizado: boolean;
}

export interface RegistrarNotaWhatsappEntrada {
  contato: string;
  pacienteId?: string;
  texto: string;
  statusAtendimento: 'acompanhamento' | 'resolvido';
}

export interface BootstrapComunicacoes {
  canais: CanalNotificacaoApi[];
  templates: TemplateMensagemApi[];
  mensagens: MensagemNotificacaoApi[];
  pacientes: RespostaPaginada<PacienteResumo>;
  profissionais: ProfissionalResumo[];
}

export class ErroApiComunicacoes extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiComunicacoes';
  }
}

async function extrairMensagemErro(resposta: Response): Promise<string> {
  const detalhe = await resposta.text();
  if (!detalhe) return `Falha HTTP ${resposta.status}`;

  try {
    const corpo = JSON.parse(detalhe) as { mensagem?: string; message?: string };
    return corpo.mensagem ?? corpo.message ?? detalhe;
  } catch {
    return detalhe;
  }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    }
  });

  if (!resposta.ok) {
    throw new ErroApiComunicacoes(resposta.status, await extrairMensagemErro(resposta));
  }

  return resposta.json() as Promise<T>;
}

export async function listarCanais(): Promise<CanalNotificacaoApi[]> {
  return requisitar<CanalNotificacaoApi[]>('/api/comunicacoes/canais');
}

export async function criarCanal(entrada: CriarCanalEntrada): Promise<CanalNotificacaoApi> {
  return requisitar<CanalNotificacaoApi>('/api/comunicacoes/canais', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarTemplates(): Promise<TemplateMensagemApi[]> {
  return requisitar<TemplateMensagemApi[]>('/api/comunicacoes/templates');
}

export async function criarTemplate(entrada: CriarTemplateEntrada): Promise<TemplateMensagemApi> {
  return requisitar<TemplateMensagemApi>('/api/comunicacoes/templates', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function instalarTemplatesIniciais(): Promise<{ quantidadeCriada: number }> {
  return requisitar<{ quantidadeCriada: number }>('/api/comunicacoes/templates/iniciais', { method: 'POST' });
}

export async function atualizarTemplate(id: string, entrada: CriarTemplateEntrada): Promise<TemplateMensagemApi> {
  return requisitar<TemplateMensagemApi>(`/api/comunicacoes/templates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(entrada)
  });
}

export async function dispararMensagem(entrada: DispararMensagemEntrada): Promise<MensagemNotificacaoApi> {
  return requisitar<MensagemNotificacaoApi>('/api/comunicacoes/mensagens', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarMensagens(): Promise<MensagemNotificacaoApi[]> {
  return requisitar<MensagemNotificacaoApi[]>('/api/comunicacoes/mensagens');
}

export async function listarConversasPortalPaciente(
  pagina = 0,
  somenteAtrasadas = false,
  status: FiltroStatusConversaPortalEquipe = 'aguardando_clinica'
): Promise<FilaConversaPortalEquipeApi> {
  const parametros = new URLSearchParams({ pagina: String(pagina), status });
  if (somenteAtrasadas) parametros.set('atrasadas', 'true');
  return requisitar<FilaConversaPortalEquipeApi>(`/api/comunicacoes/portal-paciente?${parametros.toString()}`);
}

export async function obterConversaPortalEquipe(id: string): Promise<ConversaPortalEquipeApi> {
  return requisitar<ConversaPortalEquipeApi>(`/api/comunicacoes/portal-paciente/${encodeURIComponent(id)}`);
}

export async function responderConversaPortalPaciente(id: string, texto: string): Promise<ConversaPortalEquipeApi> {
  return requisitar<ConversaPortalEquipeApi>(`/api/comunicacoes/portal-paciente/${encodeURIComponent(id)}/respostas`, {
    method: 'POST',
    body: JSON.stringify({ texto })
  });
}

export async function encerrarConversaPortalPaciente(id: string): Promise<void> {
  await requisitar<{ encerrada: boolean }>(`/api/comunicacoes/portal-paciente/${encodeURIComponent(id)}/encerrar`, { method: 'POST' });
}

export async function associarContatoWhatsapp(
  entrada: AssociarContatoWhatsappEntrada
): Promise<AssociarContatoWhatsappResposta> {
  return requisitar<AssociarContatoWhatsappResposta>('/api/comunicacoes/whatsapp/associar-contato', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function registrarNotaWhatsapp(entrada: RegistrarNotaWhatsappEntrada): Promise<MensagemNotificacaoApi> {
  return requisitar<MensagemNotificacaoApi>('/api/comunicacoes/whatsapp/notas', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function carregarBootstrapComunicacoes(): Promise<BootstrapComunicacoes> {
  const [canais, templates, mensagens, pacientes, profissionais] = await Promise.all([
    listarCanais(),
    listarTemplates(),
    listarMensagens(),
    listarPacientes(),
    listarProfissionais({ limite: 100 })
  ]);
  return { canais, templates, mensagens, pacientes, profissionais: profissionais.itens };
}
