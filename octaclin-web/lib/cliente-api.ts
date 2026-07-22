export interface ResumoPortalClienteApi {
  conta: {
    tenantId: string;
    nome: string;
    slug: string;
    status: string;
    criadoEm: string;
    atualizadoEm: string;
  };
  assinatura: {
    plano: string;
    status: string;
    origem: string;
  };
  usuarios: {
    totalAtivos: number;
    clientes: number;
    profissionais: number;
    pacientes: number;
  };
  acesso: {
    usuarioId: string;
    papel: 'Client';
    escopoDados: string;
    destinoInicial: string;
  };
}

async function extrairMensagemErro(resposta: Response): Promise<string> {
  const texto = await resposta.text();
  try {
    const corpo = JSON.parse(texto) as { mensagem?: string; message?: string };
    return corpo.mensagem ?? corpo.message ?? `Falha HTTP ${resposta.status}`;
  } catch {
    return texto || `Falha HTTP ${resposta.status}`;
  }
}

export async function obterResumoPortalCliente(): Promise<ResumoPortalClienteApi> {
  const resposta = await fetch('/api/cliente/resumo', { cache: 'no-store' });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
  return resposta.json() as Promise<ResumoPortalClienteApi>;
}
