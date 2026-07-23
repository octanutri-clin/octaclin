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

export async function carregarDadosOperacionais(): Promise<DadosOperacionais> {
  const [
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
    carregarAlertasOperacionais(),
    requisitar<ResumoOperacional>('/api/operacoes/resumo'),
    requisitar<OutboxFalha[]>('/api/operacoes/outbox/falhas?limite=50'),
    requisitar<SincronizacaoMobile[]>('/api/operacoes/mobile/sincronizacoes?limite=50'),
    requisitar<AuditoriaOperacional[]>('/api/operacoes/auditoria?limite=50'),
    carregarAuditoriaOperacionalPaginada({ pagina: 1, limite: 25 }),
    carregarFalhasOutboxPaginadas({ pagina: 1, limite: 25 }),
    carregarFalhasComunicacao({ pagina: 1, limite: 25 }),
    carregarSolicitacoesLgpd({ pagina: 1, limite: 25 }),
    carregarRetencaoDadosOperacional(),
    carregarSolicitacoesAssinatura({ pagina: 1, limite: 25 })
  ]);

  return {
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

export async function carregarAlertasOperacionais(): Promise<ResultadoAlertasOperacionais> {
  return requisitar<ResultadoAlertasOperacionais>('/api/operacoes/alertas');
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

export async function carregarFalhasComunicacao(
  filtros: FiltrosFalhasComunicacao
): Promise<ResultadoPaginado<FalhaComunicacaoOperacional> & { resumo: ResumoFalhasComunicacao }> {
  const parametros = montarParametros(filtros);
  if (!parametros.has('pagina')) parametros.set('pagina', '1');
  if (!parametros.has('limite')) parametros.set('limite', '25');

  return requisitar<ResultadoPaginado<FalhaComunicacaoOperacional> & { resumo: ResumoFalhasComunicacao }>(
    `/api/operacoes/comunicacoes/falhas?${parametros.toString()}`
  );
}

export async function carregarSolicitacoesLgpd(
  filtros: FiltrosSolicitacoesLgpd
): Promise<ResultadoPaginado<SolicitacaoLgpdOperacional>> {
  const parametros = montarParametros(filtros);
  if (!parametros.has('pagina')) parametros.set('pagina', '1');
  if (!parametros.has('limite')) parametros.set('limite', '25');

  return requisitar<ResultadoPaginado<SolicitacaoLgpdOperacional>>(`/api/operacoes/lgpd/solicitacoes?${parametros.toString()}`);
}

export async function carregarSolicitacoesAssinatura(
  filtros: FiltrosSolicitacoesAssinatura
): Promise<ResultadoPaginado<SolicitacaoAssinaturaOperacional>> {
  const parametros = montarParametros(filtros);
  if (!parametros.has('pagina')) parametros.set('pagina', '1');
  if (!parametros.has('limite')) parametros.set('limite', '25');

  return requisitar<ResultadoPaginado<SolicitacaoAssinaturaOperacional>>(
    `/api/operacoes/assinaturas/solicitacoes?${parametros.toString()}`
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

export async function obterDetalheSolicitacaoLgpd(protocolo: string): Promise<DetalheSolicitacaoLgpdOperacional> {
  return requisitar<DetalheSolicitacaoLgpdOperacional>(
    `/api/operacoes/lgpd/solicitacoes/${encodeURIComponent(protocolo)}`
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

export async function carregarRetencaoDadosOperacional(): Promise<RetencaoDadosOperacional> {
  return requisitar<RetencaoDadosOperacional>('/api/operacoes/lgpd/retencao');
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
