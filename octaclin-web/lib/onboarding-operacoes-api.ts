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
