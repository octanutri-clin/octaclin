export type StatusCicloVidaTenant =
  | 'ativo_assistido'
  | 'primeiro_uso_validado'
  | 'acompanhamento_48h'
  | 'ativo'
  | 'suspenso'
  | 'encerramento_pendente'
  | 'encerrado';

export type AcaoCicloVidaTenant =
  | 'marcar_primeiro_uso'
  | 'iniciar_acompanhamento'
  | 'concluir_acompanhamento'
  | 'suspender'
  | 'reativar'
  | 'iniciar_encerramento'
  | 'encerrar';

export interface TenantOnboardingOperacional {
  id: string;
  nome: string;
  slug: string;
  status: string;
  cicloVidaStatus: StatusCicloVidaTenant;
  provisionamentoReferencia?: string;
  planoId: 'gratuito' | 'profissional' | 'clinica' | 'enterprise';
  assinaturaStatus: string;
  proprietarioEmailMascarado?: string;
  conviteStatus?: string;
  criadoEm: string;
  atualizadoEm: string;
  encerradoEm?: string;
}

export interface ResultadoProvisionamentoTenant extends TenantOnboardingOperacional {
  reutilizado: boolean;
  convite?: {
    status: string;
    expiraEm: string;
    linkPrimeiroAcesso?: string;
  };
}

export interface DadosProvisionamentoTenant {
  referencia: string;
  nome: string;
  slug: string;
  emailProprietario: string;
  planoId: TenantOnboardingOperacional['planoId'];
  timezone?: string;
}

export type ChaveKitInicialClinicaApi =
  | 'material:plano-no-portal'
  | 'material:registro-habitos'
  | 'material:duvidas-consulta'
  | 'estrutura:tres-refeicoes'
  | 'estrutura:cinco-refeicoes';

export interface ItemKitInicialClinicaApi {
  chave: ChaveKitInicialClinicaApi;
  tipo: 'material' | 'estrutura';
  instalado: boolean;
  titulo: string;
  resumo?: string;
  conteudo?: string;
  refeicoes?: { nome: string; itens: [] }[];
}

export interface EstadoKitInicialClinicaApi {
  tenantId: string;
  tenantNome: string;
  versaoDisponivel: 2;
  versaoInstalada?: number;
  estado: 'nao_instalado' | 'parcial' | 'completo' | 'incompativel' | 'inconsistente';
  podeInstalar: boolean;
  motivoBloqueio?: string;
  itens: ItemKitInicialClinicaApi[];
}

export interface ResultadoInstalacaoKitInicialClinicaApi extends EstadoKitInicialClinicaApi {
  instalacao: {
    reutilizado: boolean;
    itensAdicionados: ChaveKitInicialClinicaApi[];
    materiaisCriados: number;
    estruturasHabilitadas: ChaveKitInicialClinicaApi[];
  };
}

export interface DisponibilidadeCatalogoAlimentarApi {
  verificadoEm: string;
  completo: boolean;
  itens: {
    codigo: string;
    baseCodigo: string;
    rotulo: string;
    estado: 'disponivel' | 'ausente' | 'indisponivel';
    totalEdicoes: number;
    edicoesLimitadas: boolean;
    edicoes: {
      versao: string | null;
      situacao: string | null;
      direitoUsoStatus: string | null;
      importadaEm: string | null;
      importacaoStatus: string | null;
      totalDeclarado: number | null;
      totalAlimentos: number;
      alimentosUtilizaveis: number;
      disponivel: boolean;
      motivos: string[];
    }[];
    ultimaTentativa?: { status: string; iniciadaEm: string | null };
  }[];
}

class ErroOnboardingOperacional extends Error {
  constructor(public readonly status: number, mensagem: string) {
    super(mensagem);
  }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });
  if (!resposta.ok) {
    const corpo = await resposta.text();
    let mensagem = corpo || `Falha HTTP ${resposta.status}`;
    try {
      const json = JSON.parse(corpo) as { message?: string | string[]; mensagem?: string };
      mensagem = Array.isArray(json.message) ? json.message.join(', ') : json.message ?? json.mensagem ?? mensagem;
    } catch {
      // Mantem o texto original quando a resposta nao for JSON.
    }
    throw new ErroOnboardingOperacional(resposta.status, mensagem);
  }
  return resposta.json() as Promise<T>;
}

export function listarTenantsOnboarding(): Promise<{ itens: TenantOnboardingOperacional[]; total: number }> {
  return requisitar('/api/operacoes/tenants');
}

export function provisionarTenant(dados: DadosProvisionamentoTenant): Promise<ResultadoProvisionamentoTenant> {
  return requisitar('/api/operacoes/tenants', { method: 'POST', body: JSON.stringify(dados) });
}

export function atualizarCicloVidaTenant(
  tenantId: string,
  dados: { acao: AcaoCicloVidaTenant; motivo?: string; exportacaoConfirmada?: boolean; protocoloExportacao?: string }
): Promise<TenantOnboardingOperacional> {
  return requisitar(`/api/operacoes/tenants/${encodeURIComponent(tenantId)}/ciclo-vida`, {
    method: 'POST',
    body: JSON.stringify(dados)
  });
}

export async function obterKitInicialCliente(signal?: AbortSignal): Promise<EstadoKitInicialClinicaApi> {
  return requisitarApiKit('/api/cliente/kit-inicial', { cache: 'no-store', signal });
}

export async function instalarKitInicialCliente(itens: ChaveKitInicialClinicaApi[]): Promise<ResultadoInstalacaoKitInicialClinicaApi> {
  return requisitarApiKit('/api/cliente/kit-inicial', {
    method: 'POST', cache: 'no-store', body: JSON.stringify({ confirmacao: true, versao: 2, itens })
  });
}

export async function obterKitInicialTenant(tenantId: string, signal?: AbortSignal): Promise<EstadoKitInicialClinicaApi> {
  return requisitarApiKit(`/api/operacoes/tenants/${encodeURIComponent(tenantId)}/kit-inicial`, { cache: 'no-store', signal });
}

export async function instalarKitInicialTenant(tenantId: string, itens: ChaveKitInicialClinicaApi[]): Promise<ResultadoInstalacaoKitInicialClinicaApi> {
  return requisitarApiKit(`/api/operacoes/tenants/${encodeURIComponent(tenantId)}/kit-inicial`, {
    method: 'POST', cache: 'no-store', body: JSON.stringify({ confirmacao: true, versao: 2, itens })
  });
}

export async function obterDisponibilidadeCatalogosAlimentares(signal?: AbortSignal): Promise<DisponibilidadeCatalogoAlimentarApi> {
  return requisitarApiKit('/api/operacoes/catalogos-alimentares/disponibilidade', { cache: 'no-store', signal });
}

async function requisitarApiKit<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });
  if (!resposta.ok) {
    const corpo = await resposta.text();
    let mensagem = corpo || `Falha HTTP ${resposta.status}`;
    try {
      const json = JSON.parse(corpo) as { message?: string | string[]; mensagem?: string };
      mensagem = Array.isArray(json.message) ? json.message.join(', ') : json.message ?? json.mensagem ?? mensagem;
    } catch {
      // Preserva o texto apenas se a resposta não vier como JSON.
    }
    throw new ErroOnboardingOperacional(resposta.status, mensagem);
  }
  return resposta.json() as Promise<T>;
}
