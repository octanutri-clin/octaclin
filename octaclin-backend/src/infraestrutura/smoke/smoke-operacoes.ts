interface LoginResposta {
  accessToken: string;
  refreshToken: string;
  tipoToken: 'Bearer';
  expiraEmSegundos: number;
}

interface ResumoOperacional {
  outbox: {
    pendente: number;
    processando: number;
    processado: number;
    falhou: number;
  };
  mobile: {
    sincronizado: number;
    erro: number;
  };
}

interface OutboxFalha {
  id: string;
  tipo: string;
  status: 'falhou';
  tentativas: number;
  erro?: string;
}

const config = {
  apiUrl: process.env.SMOKE_API_URL ?? 'http://localhost:3000',
  tenantSlug: process.env.SMOKE_TENANT_SLUG ?? 'clinica-carla',
  email: process.env.SMOKE_EMAIL ?? 'admin@octaclin.local',
  senha: process.env.SMOKE_SENHA ?? 'OctaClin@123'
};

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${config.apiUrl.replace(/\/$/, '')}${caminho}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`${init?.method ?? 'GET'} ${caminho} retornou HTTP ${resposta.status}: ${corpo}`);
  }

  return resposta.json() as Promise<T>;
}

async function executarSmoke() {
  console.log(`Smoke OctaClin em ${config.apiUrl}`);

  const login = await requisitar<LoginResposta>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      tenantSlug: config.tenantSlug,
      email: config.email,
      senha: config.senha
    })
  });

  const auth = { Authorization: `Bearer ${login.accessToken}` };
  const resumoInicial = await requisitar<ResumoOperacional>('/operacoes/resumo', { headers: auth });
  const falhas = await requisitar<OutboxFalha[]>('/operacoes/outbox/falhas?limite=10', { headers: auth });

  console.log('Resumo inicial:', JSON.stringify(resumoInicial));
  console.log(`Falhas encontradas: ${falhas.length}`);

  if (falhas.length > 0) {
    const alvo = falhas[0];
    await requisitar(`/operacoes/outbox/${alvo.id}/reprocessar`, {
      method: 'POST',
      headers: auth
    });
    console.log(`Outbox reprocessado: ${alvo.id}`);
  }

  const resumoFinal = await requisitar<ResumoOperacional>('/operacoes/resumo', { headers: auth });
  const sincronizacoes = await requisitar<unknown[]>('/operacoes/mobile/sincronizacoes?limite=10', { headers: auth });

  console.log('Resumo final:', JSON.stringify(resumoFinal));
  console.log(`Sincronizacoes mobile retornadas: ${sincronizacoes.length}`);
  console.log('Smoke operacional concluido.');
}

executarSmoke().catch((erro) => {
  console.error('Smoke operacional falhou.');
  console.error(erro);
  process.exitCode = 1;
});
