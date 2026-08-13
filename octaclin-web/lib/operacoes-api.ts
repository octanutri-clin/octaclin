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

export interface ResultadoFeatureFlags {
  configuracaoValida: boolean;
  flags: Array<{
    chave: 'ia.clinica' | 'mobile.sync';
    habilitada: boolean;
    origem: 'padrao' | 'ambiente' | 'tenant';
  }>;
}

export interface ResultadoRolloutOperacional {
  status: 'ok' | 'atencao' | 'critico';
  decisaoSugerida: 'promover' | 'observar' | 'rollback';
  geradoEm: string;
  release: { commit: string; servicoId: string; ambiente: string; papelProcesso: string };
  health: { status: 'ok' | 'degradado' | 'falha'; checks: Record<string, 'ok' | 'degradado' | 'falha'> };
  telemetria: {
    processo: { iniciadoEm: string; uptimeSegundos: number };
    http: {
      total: number;
      sucesso: number;
      errosCliente: number;
      errosServidor: number;
      taxaErro5xx: number;
      duracaoMediaMs: number;
      duracaoP95Ms: number;
      amostrasDuracao: number;
      porRota: Array<{ metodo: string; rota: string; total: number; errosServidor: number; duracaoMediaMs: number; duracaoMaximaMs: number }>;
    };
    tracesRecentes: Array<{
      requestId: string;
      horario: string;
      metodo: string;
      rota: string;
      statusCode: number;
      duracaoMs: number;
      resultado: 'sucesso' | 'erro_cliente' | 'erro_servidor';
      erroNome?: string;
    }>;
  };
  filas: Array<{
    nome: string;
    status: 'ok' | 'indisponivel';
    esperando: number;
    ativas: number;
    atrasadas: number;
    falharam: number;
    pausada: boolean;
  }>;
  flags: ResultadoFeatureFlags;
}

export type SeveridadeAlertaOperacional = 'critico' | 'atencao' | 'informativo';
export type StatusAlertasOperacionais = SeveridadeAlertaOperacional | 'ok';
export type OrigemAlertaOperacional = 'deploy' | 'servico' | 'fila' | 'integracao';

export interface AlertaOperacionalApi {
  id: string;
  severidade: SeveridadeAlertaOperacional;
  origem: OrigemAlertaOperacional;
  titulo: string;
  mensagem: string;
  acaoSugerida: string;
  metrica?: string;
  valor?: number;
  referencia?: string;
}

export interface ResultadoAlertasOperacionais {
  status: StatusAlertasOperacionais;
  geradoEm: string;
  resumo: {
    total: number;
    criticos: number;
    atencao: number;
    informativos: number;
  };
  itens: AlertaOperacionalApi[];
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

export type OrigemFalhaComunicacao = 'mensagem' | 'outbox' | 'google_calendar';
export type CanalFalhaComunicacao = 'email' | 'whatsapp' | 'push' | 'google_calendar' | 'outbox' | 'outro';

export interface FalhaComunicacaoOperacional {
  id: string;
  origem: OrigemFalhaComunicacao;
  canal: CanalFalhaComunicacao;
  tipo: string;
  referenciaId: string;
  pacienteId?: string;
  erro?: string;
  tentativas?: number;
  criadoEm: string;
  reprocessavel: boolean;
  resumo?: string;
}

export interface ResumoFalhasComunicacao {
  total: number;
  email: number;
  whatsapp: number;
  googleCalendar: number;
  outbox: number;
  outras: number;
  reprocessaveis: number;
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

export interface RespostaSolicitacaoLgpdOperacional {
  protocolo: string;
  pacienteId: string;
  status: StatusSolicitacaoLgpd;
  assuntoEmail: string;
  corpoEmail: string;
  textoWhatsapp: string;
  canaisSugeridos: ('email' | 'whatsapp')[];
  geradoEm: string;
}

export type AcaoRetencaoDadosOperacional = 'preservar' | 'anonimizar' | 'excluir' | 'arquivar_exportar';

export interface PoliticaRetencaoDadosOperacional {
  id: string;
  rotulo: string;
  entidade: string;
  campoData: string;
  diasRetencao: number;
  acao: AcaoRetencaoDadosOperacional;
  baseLegal: string;
  descricao: string;
}

export interface ItemResumoRetencaoDadosOperacional {
  politicaId: string;
  rotulo: string;
  acao: AcaoRetencaoDadosOperacional;
  diasRetencao: number;
  corteEm: string;
  vencidos: number;
}

export interface ResumoRetencaoDadosOperacional {
  totalVencidos: number;
  itens: ItemResumoRetencaoDadosOperacional[];
}

export interface RetencaoDadosOperacional {
  versao: string;
  geradoEm: string;
  politicas: PoliticaRetencaoDadosOperacional[];
  resumo: ResumoRetencaoDadosOperacional;
}

export interface ProgramacaoRetencaoDadosOperacional {
  protocolo: string;
  status: 'programada';
  programadoEm: string;
  totalItensVencidos: number;
  resumo: ResumoRetencaoDadosOperacional;
}

export type PlanoSaasIdOperacional = 'gratuito' | 'profissional' | 'clinica' | 'enterprise';
export type StatusAssinaturaOperacional = 'ativa' | 'trial' | 'suspensa' | 'cancelada';

export interface SolicitacaoAssinaturaOperacional {
  tenantId: string;
  acao: 'upgrade' | 'downgrade' | 'revisao_limite';
  status: 'pendente' | 'concluida' | 'cancelada';
  planoAtualId: PlanoSaasIdOperacional;
  planoAtual: string;
  planoDesejado?: PlanoSaasIdOperacional;
  observacao?: string;
  solicitadoPorUsuarioId: string;
  solicitadoEm: string;
  planoAplicadoId?: PlanoSaasIdOperacional;
  resolvidoPorUsuarioId?: string;
  resolvidoEm?: string;
  observacaoResolucao?: string;
}

export interface AssinaturaManualOperacional {
  tenantId: string;
  planoId: PlanoSaasIdOperacional;
  plano: string;
  status: StatusAssinaturaOperacional;
  origem: 'operacao_manual';
  renovacaoEm?: string;
  atualizadoPorUsuarioId: string;
  atualizadoEm: string;
}

export interface DadosOperacionais {
  rollout: ResultadoRolloutOperacional;
  alertasOperacionais: ResultadoAlertasOperacionais;
  resumo: ResumoOperacional;
  falhas: OutboxFalha[];
  sincronizacoes: SincronizacaoMobile[];
  auditoria: AuditoriaOperacional[];
  auditoriaPaginada: ResultadoPaginado<AuditoriaOperacional>;
  falhasPaginadas: ResultadoPaginado<OutboxFalha>;
  falhasComunicacao: ResultadoPaginado<FalhaComunicacaoOperacional> & { resumo: ResumoFalhasComunicacao };
  solicitacoesLgpd: ResultadoPaginado<SolicitacaoLgpdOperacional>;
  retencaoDados: RetencaoDadosOperacional;
  solicitacoesAssinatura: ResultadoPaginado<SolicitacaoAssinaturaOperacional>;
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

export interface FiltrosFalhasComunicacao {
  origem?: OrigemFalhaComunicacao | '';
  canal?: CanalFalhaComunicacao | '';
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

export interface FiltrosSolicitacoesAssinatura {
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

export async function carregarDadosOperacionais(opcoes?: { signal?: AbortSignal }): Promise<DadosOperacionais> {
  const signal = opcoes?.signal;
  const [
    rollout,
    alertasOperacionais,
    resumo,
    falhas,
    sincronizacoes,
    auditoria,
    auditoriaPaginada,
    falhasPaginadas,
    falhasComunicacao,
    solicitacoesLgpd,
    retencaoDados,
    solicitacoesAssinatura
  ] = await Promise.all([
    carregarRolloutOperacional({ signal }),
    carregarAlertasOperacionais({ signal }),
    requisitar<ResumoOperacional>('/api/operacoes/resumo', { signal }),
    requisitar<OutboxFalha[]>('/api/operacoes/outbox/falhas?limite=50', { signal }),
    requisitar<SincronizacaoMobile[]>('/api/operacoes/mobile/sincronizacoes?limite=50', { signal }),
    requisitar<AuditoriaOperacional[]>('/api/operacoes/auditoria?limite=50', { signal }),
    carregarAuditoriaOperacionalPaginada({ pagina: 1, limite: 25 }, { signal }),
    carregarFalhasOutboxPaginadas({ pagina: 1, limite: 25 }, { signal }),
    carregarFalhasComunicacao({ pagina: 1, limite: 25 }, { signal }),
    carregarSolicitacoesLgpd({ pagina: 1, limite: 25 }, { signal }),
    carregarRetencaoDadosOperacional({ signal }),
    carregarSolicitacoesAssinatura({ pagina: 1, limite: 25 }, { signal })
  ]);

  return {
    rollout,
    alertasOperacionais,
    resumo,
    falhas,
    sincronizacoes,
    auditoria,
    auditoriaPaginada,
    falhasPaginadas,
    falhasComunicacao,
    solicitacoesLgpd,
    retencaoDados,
    solicitacoesAssinatura
  };
}

export function carregarRolloutOperacional(opcoes?: { signal?: AbortSignal }): Promise<ResultadoRolloutOperacional> {
  return requisitar<ResultadoRolloutOperacional>('/api/operacoes/rollout', { signal: opcoes?.signal });
}

export function atualizarFeatureFlagsOperacionais(dados: {
  tenantId: string;
  iaClinica: boolean;
  mobileSync: boolean;
}): Promise<ResultadoFeatureFlags> {
  return requisitar<ResultadoFeatureFlags>('/api/operacoes/feature-flags', {
    method: 'POST',
    body: JSON.stringify(dados)
  });
}

export function carregarFeatureFlagsOperacionais(tenantId: string): Promise<ResultadoFeatureFlags> {
  return requisitar<ResultadoFeatureFlags>(`/api/operacoes/feature-flags/${encodeURIComponent(tenantId)}`);
}

export async function carregarAlertasOperacionais(opcoes?: { signal?: AbortSignal }): Promise<ResultadoAlertasOperacionais> {
  return requisitar<ResultadoAlertasOperacionais>('/api/operacoes/alertas', { signal: opcoes?.signal });
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
  filtros: FiltrosAuditoriaOperacional,
  opcoes?: { signal?: AbortSignal }
): Promise<ResultadoPaginado<AuditoriaOperacional>> {
  const parametros = montarParametros(filtros);
  if (!parametros.has('pagina')) parametros.set('pagina', '1');
  if (!parametros.has('limite')) parametros.set('limite', '25');

  return requisitar<ResultadoPaginado<AuditoriaOperacional>>(`/api/operacoes/auditoria/paginada?${parametros.toString()}`, {
    signal: opcoes?.signal
  });
}

export async function carregarFalhasOutboxPaginadas(
  filtros: FiltrosOutboxOperacional,
  opcoes?: { signal?: AbortSignal }
): Promise<ResultadoPaginado<OutboxFalha>> {
  const parametros = montarParametros(filtros);
  if (!parametros.has('pagina')) parametros.set('pagina', '1');
  if (!parametros.has('limite')) parametros.set('limite', '25');

  return requisitar<ResultadoPaginado<OutboxFalha>>(`/api/operacoes/outbox/falhas/paginada?${parametros.toString()}`, {
    signal: opcoes?.signal
  });
}

export async function carregarFalhasComunicacao(
  filtros: FiltrosFalhasComunicacao,
  opcoes?: { signal?: AbortSignal }
): Promise<ResultadoPaginado<FalhaComunicacaoOperacional> & { resumo: ResumoFalhasComunicacao }> {
  const parametros = montarParametros(filtros);
  if (!parametros.has('pagina')) parametros.set('pagina', '1');
  if (!parametros.has('limite')) parametros.set('limite', '25');

  return requisitar<ResultadoPaginado<FalhaComunicacaoOperacional> & { resumo: ResumoFalhasComunicacao }>(
    `/api/operacoes/comunicacoes/falhas?${parametros.toString()}`,
    { signal: opcoes?.signal }
  );
}

export async function carregarSolicitacoesLgpd(
  filtros: FiltrosSolicitacoesLgpd,
  opcoes?: { signal?: AbortSignal }
): Promise<ResultadoPaginado<SolicitacaoLgpdOperacional>> {
  const parametros = montarParametros(filtros);
  if (!parametros.has('pagina')) parametros.set('pagina', '1');
  if (!parametros.has('limite')) parametros.set('limite', '25');

  return requisitar<ResultadoPaginado<SolicitacaoLgpdOperacional>>(`/api/operacoes/lgpd/solicitacoes?${parametros.toString()}`, {
    signal: opcoes?.signal
  });
}

export async function carregarSolicitacoesAssinatura(
  filtros: FiltrosSolicitacoesAssinatura,
  opcoes?: { signal?: AbortSignal }
): Promise<ResultadoPaginado<SolicitacaoAssinaturaOperacional>> {
  const parametros = montarParametros(filtros);
  if (!parametros.has('pagina')) parametros.set('pagina', '1');
  if (!parametros.has('limite')) parametros.set('limite', '25');

  return requisitar<ResultadoPaginado<SolicitacaoAssinaturaOperacional>>(
    `/api/operacoes/assinaturas/solicitacoes?${parametros.toString()}`,
    { signal: opcoes?.signal }
  );
}

export async function aplicarPlanoAssinatura(dados: {
  planoId: PlanoSaasIdOperacional;
  status?: StatusAssinaturaOperacional;
  renovacaoEm?: string;
  observacao?: string;
}): Promise<AssinaturaManualOperacional> {
  return requisitar<AssinaturaManualOperacional>('/api/operacoes/assinaturas/plano', {
    method: 'POST',
    body: JSON.stringify(dados)
  });
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

export async function obterDetalheSolicitacaoLgpd(
  protocolo: string,
  opcoes?: { signal?: AbortSignal }
): Promise<DetalheSolicitacaoLgpdOperacional> {
  return requisitar<DetalheSolicitacaoLgpdOperacional>(
    `/api/operacoes/lgpd/solicitacoes/${encodeURIComponent(protocolo)}`,
    { signal: opcoes?.signal }
  );
}

export function urlExportacaoSolicitacaoLgpd(protocolo: string): string {
  return `/api/operacoes/lgpd/solicitacoes/${encodeURIComponent(protocolo)}/exportar.csv`;
}

export async function prepararRespostaSolicitacaoLgpd(protocolo: string): Promise<RespostaSolicitacaoLgpdOperacional> {
  return requisitar<RespostaSolicitacaoLgpdOperacional>(
    `/api/operacoes/lgpd/solicitacoes/${encodeURIComponent(protocolo)}/resposta`,
    { method: 'POST' }
  );
}

export async function carregarRetencaoDadosOperacional(opcoes?: { signal?: AbortSignal }): Promise<RetencaoDadosOperacional> {
  return requisitar<RetencaoDadosOperacional>('/api/operacoes/lgpd/retencao', { signal: opcoes?.signal });
}

export async function programarRetencaoDadosOperacional(): Promise<ProgramacaoRetencaoDadosOperacional> {
  return requisitar<ProgramacaoRetencaoDadosOperacional>('/api/operacoes/lgpd/retencao/programar', { method: 'POST' });
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

export async function reprocessarFalhaComunicacao(id: string): Promise<FalhaComunicacaoOperacional> {
  return requisitar<FalhaComunicacaoOperacional>(
    `/api/operacoes/comunicacoes/falhas/${encodeURIComponent(id)}/reprocessar`,
    { method: 'POST' }
  );
}
