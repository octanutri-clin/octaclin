import { PacienteResumo, RespostaPaginada, listarPacientes } from './cadastros-api';

export type TipoCanalNotificacao = 'whatsapp' | 'email' | 'push';

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
  status: 'pendente' | 'processando' | 'enviado' | 'falhou';
  payload: Record<string, unknown>;
  erro?: string;
  enviadoEm?: string;
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
}

export interface BootstrapComunicacoes {
  canais: CanalNotificacaoApi[];
  templates: TemplateMensagemApi[];
  mensagens: MensagemNotificacaoApi[];
  pacientes: RespostaPaginada<PacienteResumo>;
}

class ErroApiComunicacoes extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiComunicacoes';
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
    const detalhe = await resposta.text();
    throw new ErroApiComunicacoes(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
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

export async function dispararMensagem(entrada: DispararMensagemEntrada): Promise<MensagemNotificacaoApi> {
  return requisitar<MensagemNotificacaoApi>('/api/comunicacoes/mensagens', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarMensagens(): Promise<MensagemNotificacaoApi[]> {
  return requisitar<MensagemNotificacaoApi[]>('/api/comunicacoes/mensagens');
}

export async function carregarBootstrapComunicacoes(): Promise<BootstrapComunicacoes> {
  const [canais, templates, mensagens, pacientes] = await Promise.all([
    listarCanais(),
    listarTemplates(),
    listarMensagens(),
    listarPacientes()
  ]);
  return { canais, templates, mensagens, pacientes };
}
