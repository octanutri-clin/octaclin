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

async function requisitar<T>(caminho: string, init?: RequestInit, base = '/api/cliente/integracoes'): Promise<T> {
  const resposta = await fetch(`${base}/${caminho}`, { cache: 'no-store', ...init });
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => ({}))) as { mensagem?: string; message?: string };
    throw new Error(corpo.mensagem ?? corpo.message ?? `Falha HTTP ${resposta.status}`);
  }
  if (resposta.status === 204 || !resposta.headers.get('Content-Type')?.includes('json')) return undefined as T;
  return resposta.json() as Promise<T>;
}

const json = (corpo: unknown, method: 'POST' | 'PATCH' = 'POST'): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(corpo)
});

export interface PermissoesIntegracaoProfissionalApi {
  usuarioId: string;
  escoposApi: EscopoApi[];
  eventosWebhook: EventoWebhook[];
  concedidaApiEm?: string;
  concedidaWebhookEm?: string;
  concedidaApiPorUsuarioId?: string;
  concedidaWebhookPorUsuarioId?: string;
}

function criarApiIntegracoes(base: string) {
  return {
    listarChaves: () => requisitar<ChaveApi[]>('chaves', undefined, base),
    criarChave: (corpo: { nome: string; escopos: EscopoApi[]; expiraEm?: string }) =>
      requisitar<{ chave: ChaveApi; valor: string }>('chaves', json(corpo), base),
    rotacionarChave: (id: string) => requisitar<{ chave: ChaveApi; valor: string }>(`chaves/${id}/rotacao`, { method: 'POST' }, base),
    revogarChave: (id: string) => requisitar<void>(`chaves/${id}`, { method: 'DELETE' }, base),
    listarWebhooks: () => requisitar<WebhookApi[]>('webhooks', undefined, base),
    criarWebhook: (corpo: { nome: string; url: string; eventos: EventoWebhook[] }) =>
      requisitar<{ webhook: WebhookApi; segredo: string }>('webhooks', json(corpo), base),
    rotacionarWebhook: (id: string) => requisitar<{ segredo: string }>(`webhooks/${id}/rotacao`, { method: 'POST' }, base),
    desativarWebhook: (id: string) => requisitar<void>(`webhooks/${id}`, { method: 'DELETE' }, base),
    listarEntregas: () => requisitar<EntregaWebhookApi[]>('webhooks/entregas', undefined, base),
    reprocessarEntrega: (id: string) => requisitar<void>(`webhooks/entregas/${id}/reprocessamento`, { method: 'POST' }, base)
  };
}

const cliente = criarApiIntegracoes('/api/cliente/integracoes');
const profissional = criarApiIntegracoes('/api/profissional/integracoes');

export const listarChavesApi = cliente.listarChaves;
export const criarChaveApi = cliente.criarChave;
export const rotacionarChaveApi = cliente.rotacionarChave;
export const revogarChaveApi = cliente.revogarChave;
export const listarWebhooksApi = cliente.listarWebhooks;
export const criarWebhookApi = cliente.criarWebhook;
export const rotacionarWebhookApi = cliente.rotacionarWebhook;
export const desativarWebhookApi = cliente.desativarWebhook;
export const listarEntregasWebhookApi = cliente.listarEntregas;
export const reprocessarEntregaWebhookApi = cliente.reprocessarEntrega;

export const listarChavesIntegracaoProfissionalApi = profissional.listarChaves;
export const criarChaveIntegracaoProfissionalApi = profissional.criarChave;
export const rotacionarChaveIntegracaoProfissionalApi = profissional.rotacionarChave;
export const revogarChaveIntegracaoProfissionalApi = profissional.revogarChave;
export const listarWebhooksIntegracaoProfissionalApi = profissional.listarWebhooks;
export const criarWebhookIntegracaoProfissionalApi = profissional.criarWebhook;
export const rotacionarWebhookIntegracaoProfissionalApi = profissional.rotacionarWebhook;
export const desativarWebhookIntegracaoProfissionalApi = profissional.desativarWebhook;
export const listarEntregasIntegracaoProfissionalApi = profissional.listarEntregas;
export const reprocessarEntregaIntegracaoProfissionalApi = profissional.reprocessarEntrega;

export const listarPermissoesIntegracaoProfissionaisApi = () =>
  requisitar<PermissoesIntegracaoProfissionalApi[]>('permissoes-profissionais');

export const atualizarPermissoesIntegracaoProfissionalApi = (
  usuarioId: string,
  dados: { escoposApi: EscopoApi[]; eventosWebhook: EventoWebhook[] }
) => requisitar<PermissoesIntegracaoProfissionalApi>(`profissionais/${usuarioId}/permissoes`, json(dados, 'PATCH'));

export const obterPermissoesIntegracaoProfissionalApi = () =>
  requisitar<Omit<PermissoesIntegracaoProfissionalApi, 'usuarioId'>>('acesso', undefined, '/api/profissional/integracoes');
