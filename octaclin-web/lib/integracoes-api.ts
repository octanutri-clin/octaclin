export type EscopoApi = 'pacientes:ler' | 'pacientes:escrever' | 'agenda:ler' | 'agenda:escrever';
export type EventoWebhook = 'paciente.criado' | 'consulta.criada' | 'consulta.cancelada' | 'formulario.respondido';

export interface ChaveApi {
  id: string;
  nome: string;
  prefixo: string;
  escopos: EscopoApi[];
  expiraEm?: string;
  ultimoUsoEm?: string;
  revogadaEm?: string;
  criadoEm: string;
}

export interface WebhookApi {
  id: string;
  nome: string;
  url: string;
  eventos: EventoWebhook[];
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface EntregaWebhookApi {
  id: string;
  assinaturaId: string;
  evento: EventoWebhook;
  status: 'pendente' | 'processando' | 'entregue' | 'falhou';
  tentativas: number;
  ultimoStatusHttp?: number;
  ultimoErro?: string;
  criadoEm: string;
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api/cliente/integracoes/${caminho}`, { cache: 'no-store', ...init });
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => ({}))) as { mensagem?: string; message?: string };
    throw new Error(corpo.mensagem ?? corpo.message ?? `Falha HTTP ${resposta.status}`);
  }
  if (resposta.status === 204 || !resposta.headers.get('Content-Type')?.includes('json')) return undefined as T;
  return resposta.json() as Promise<T>;
}

const json = (corpo: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(corpo)
});

export const listarChavesApi = () => requisitar<ChaveApi[]>('chaves');
export const criarChaveApi = (corpo: { nome: string; escopos: EscopoApi[]; expiraEm?: string }) =>
  requisitar<{ chave: ChaveApi; valor: string }>('chaves', json(corpo));
export const rotacionarChaveApi = (id: string) =>
  requisitar<{ chave: ChaveApi; valor: string }>(`chaves/${id}/rotacao`, { method: 'POST' });
export const revogarChaveApi = (id: string) => requisitar<void>(`chaves/${id}`, { method: 'DELETE' });

export const listarWebhooksApi = () => requisitar<WebhookApi[]>('webhooks');
export const criarWebhookApi = (corpo: { nome: string; url: string; eventos: EventoWebhook[] }) =>
  requisitar<{ webhook: WebhookApi; segredo: string }>('webhooks', json(corpo));
export const rotacionarWebhookApi = (id: string) =>
  requisitar<{ segredo: string }>(`webhooks/${id}/rotacao`, { method: 'POST' });
export const desativarWebhookApi = (id: string) => requisitar<void>(`webhooks/${id}`, { method: 'DELETE' });
export const listarEntregasWebhookApi = () => requisitar<EntregaWebhookApi[]>('webhooks/entregas');
export const reprocessarEntregaWebhookApi = (id: string) =>
  requisitar<void>(`webhooks/entregas/${id}/reprocessamento`, { method: 'POST' });
