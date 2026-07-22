export interface ResumoOperacional {
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

export interface OutboxFalha {
  id: string;
  tenantId: string;
  tipo: string;
  payload: Record<string, unknown>;
  status: 'falhou';
  tentativas: number;
  erro?: string;
  criadoEm: string;
  processadoEm?: string;
}

export interface SincronizacaoMobile {
  id: string;
  tenantId: string;
  idLocal: string;
  tipo: string;
  status: 'sincronizado' | 'erro';
  recursoTipo?: string;
  recursoId?: string;
  erro?: string;
  criadoEm: string;
}

export interface AuditoriaOperacional {
  id: string;
  tenantId: string;
  usuarioId?: string;
  acao: string;
  recursoTipo?: string;
  recursoId?: string;
  ip?: string;
  userAgent?: string;
  metadados: Record<string, unknown>;
  criadoEm: string;
}

export type StatusSolicitacaoLgpd = 'recebida' | 'em_tratamento' | 'concluida' | 'indeferida';
export type TipoSolicitacaoLgpd = 'retificacao' | 'exclusao';

export interface SolicitacaoLgpdOperacional {
  protocolo: string;
  pacienteId: string;
  usuarioPacienteId: string;
  tipo: TipoSolicitacaoLgpd;
  status: StatusSolicitacaoLgpd;
  detalhes?: string;
  abertoEm: string;
  atualizadoEm: string;
  responsavelId?: string;
  ultimaTratativa?: string;
}

export interface EventoSolicitacaoLgpdOperacional {
  id: string;
  tipo: string;
  status: StatusSolicitacaoLgpd;
  detalhes?: string;
  responsavelId?: string;
  criadoEm: string;
}

export interface DetalheSolicitacaoLgpdOperacional extends SolicitacaoLgpdOperacional {
  historico: EventoSolicitacaoLgpdOperacional[];
}

export interface DadosOperacionais {
  resumo: ResumoOperacional;
  falhas: OutboxFalha[];
  sincronizacoes: SincronizacaoMobile[];
  auditoria: AuditoriaOperacional[];
  auditoriaPaginada: ResultadoPaginado<AuditoriaOperacional>;
  falhasPaginadas: ResultadoPaginado<OutboxFalha>;
  solicitacoesLgpd: ResultadoPaginado<SolicitacaoLgpdOperacional>;
}

export interface FiltrosAuditoriaOperacional {
  acao?: string;
  recursoTipo?: string;
  recursoId?: string;
  usuarioId?: string;
  inicio?: string;
  fim?: string;
  limite?: number;
  pagina?: number;
}

export interface FiltrosOutboxOperacional {
  tipo?: string;
  inicio?: string;
  fim?: string;
  limite?: number;
  pagina?: number;
}

export interface FiltrosSolicitacoesLgpd {
  status?: StatusSolicitacaoLgpd | '';
  tipo?: TipoSolicitacaoLgpd | '';
  limite?: number;
  pagina?: number;
}

export interface ResultadoPaginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  limite: number;
}

export class ErroApiOperacoes extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiOperacoes';
  }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiOperacoes(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

export async function carregarDadosOperacionais(): Promise<DadosOperacionais> {
  const [resumo, falhas, sincronizacoes, auditoria, auditoriaPaginada, falhasPaginadas, solicitacoesLgpd] = await Promise.all([
    requisitar<ResumoOperacional>('/api/operacoes/resumo'),
    requisitar<OutboxFalha[]>('/api/operacoes/outbox/falhas?limite=50'),
    requisitar<SincronizacaoMobile[]>('/api/operacoes/mobile/sincronizacoes?limite=50'),
    requisitar<AuditoriaOperacional[]>('/api/operacoes/auditoria?limite=50'),
    carregarAuditoriaOperacionalPaginada({ pagina: 1, limite: 25 }),
    carregarFalhasOutboxPaginadas({ pagina: 1, limite: 25 }),
    carregarSolicitacoesLgpd({ pagina: 1, limite: 25 })
  ]);

  return { resumo, falhas, sincronizacoes, auditoria, auditoriaPaginada, falhasPaginadas, solicitacoesLgpd };
}

export async function carregarAuditoriaOperacional(
  filtros: FiltrosAuditoriaOperacional
): Promise<AuditoriaOperacional[]> {
  const parametros = new URLSearchParams();

  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== '') parametros.set(chave, String(valor));
  });

  if (!parametros.has('limite')) parametros.set('limite', '50');

  return requisitar<AuditoriaOperacional[]>(`/api/operacoes/auditoria?${parametros.toString()}`);
}

export async function carregarAuditoriaOperacionalPaginada(
  filtros: FiltrosAuditoriaOperacional
): Promise<ResultadoPaginado<AuditoriaOperacional>> {
  const parametros = montarParametros(filtros);
  if (!parametros.has('pagina')) parametros.set('pagina', '1');
  if (!parametros.has('limite')) parametros.set('limite', '25');

  return requisitar<ResultadoPaginado<AuditoriaOperacional>>(`/api/operacoes/auditoria/paginada?${parametros.toString()}`);
}

export async function carregarFalhasOutboxPaginadas(
  filtros: FiltrosOutboxOperacional
): Promise<ResultadoPaginado<OutboxFalha>> {
  const parametros = montarParametros(filtros);
  if (!parametros.has('pagina')) parametros.set('pagina', '1');
  if (!parametros.has('limite')) parametros.set('limite', '25');

  return requisitar<ResultadoPaginado<OutboxFalha>>(`/api/operacoes/outbox/falhas/paginada?${parametros.toString()}`);
}

export async function carregarSolicitacoesLgpd(
  filtros: FiltrosSolicitacoesLgpd
): Promise<ResultadoPaginado<SolicitacaoLgpdOperacional>> {
  const parametros = montarParametros(filtros);
  if (!parametros.has('pagina')) parametros.set('pagina', '1');
  if (!parametros.has('limite')) parametros.set('limite', '25');

  return requisitar<ResultadoPaginado<SolicitacaoLgpdOperacional>>(`/api/operacoes/lgpd/solicitacoes?${parametros.toString()}`);
}

export async function atualizarSolicitacaoLgpd(
  protocolo: string,
  dados: {
    status: Exclude<StatusSolicitacaoLgpd, 'recebida'>;
    detalhes?: string;
  }
): Promise<SolicitacaoLgpdOperacional> {
  return requisitar<SolicitacaoLgpdOperacional>(
    `/api/operacoes/lgpd/solicitacoes/${encodeURIComponent(protocolo)}/status`,
    {
      method: 'POST',
      body: JSON.stringify(dados)
    }
  );
}

export async function obterDetalheSolicitacaoLgpd(protocolo: string): Promise<DetalheSolicitacaoLgpdOperacional> {
  return requisitar<DetalheSolicitacaoLgpdOperacional>(
    `/api/operacoes/lgpd/solicitacoes/${encodeURIComponent(protocolo)}`
  );
}

export function urlExportacaoSolicitacaoLgpd(protocolo: string): string {
  return `/api/operacoes/lgpd/solicitacoes/${encodeURIComponent(protocolo)}/exportar.csv`;
}

export function urlExportacaoAuditoria(filtros: FiltrosAuditoriaOperacional): string {
  const parametros = montarParametros({ ...filtros, pagina: undefined, limite: filtros.limite ?? 500 });
  return `/api/operacoes/auditoria/exportar.csv?${parametros.toString()}`;
}

export function urlExportacaoFalhasOutbox(filtros: FiltrosOutboxOperacional): string {
  const parametros = montarParametros({ ...filtros, pagina: undefined, limite: filtros.limite ?? 500 });
  return `/api/operacoes/outbox/falhas/exportar.csv?${parametros.toString()}`;
}

function montarParametros<T extends object>(filtros: T): URLSearchParams {
  const parametros = new URLSearchParams();

  Object.entries(filtros as Record<string, string | number | undefined>).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== '') parametros.set(chave, String(valor));
  });

  return parametros;
}

export async function reprocessarOutbox(eventoId: string): Promise<OutboxFalha> {
  return requisitar<OutboxFalha>(`/api/operacoes/outbox/${eventoId}/reprocessar`, { method: 'POST' });
}
