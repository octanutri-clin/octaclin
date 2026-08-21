import {
  AcaoRetencaoDadosOperacional,
  AuditoriaOperacional,
  DadosOperacionais,
  FalhaComunicacaoOperacional,
  OutboxFalha,
  SolicitacaoAssinaturaOperacional,
  SolicitacaoLgpdOperacional,
  StatusSolicitacaoLgpd
} from '@/lib/operacoes-api';

export function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data);
}

export function resumirPayload(payload: OutboxFalha['payload']) {
  const mensagemId = payload?.mensagemId;
  return typeof mensagemId === 'string' ? `mensagem ${mensagemId}` : JSON.stringify(payload);
}

export function rotuloOrigemFalha(origem: FalhaComunicacaoOperacional['origem']) {
  const mapa: Record<FalhaComunicacaoOperacional['origem'], string> = {
    mensagem: 'Mensagem',
    outbox: 'Outbox',
    google_calendar: 'Google Calendar'
  };
  return mapa[origem];
}

export function rotuloCanalFalha(canal: FalhaComunicacaoOperacional['canal']) {
  const mapa: Record<FalhaComunicacaoOperacional['canal'], string> = {
    email: 'E-mail',
    whatsapp: 'WhatsApp',
    push: 'Push',
    google_calendar: 'Google Calendar',
    outbox: 'Outbox',
    outro: 'Outro'
  };
  return mapa[canal];
}

export function resumirMetadados(metadados: AuditoriaOperacional['metadados']) {
  const pares = Object.entries(metadados ?? {});
  if (!pares.length) return '-';
  return pares.map(([chave, valor]) => `${chave}: ${String(valor)}`).join(' | ');
}

export function rotuloTipoLgpd(tipo: SolicitacaoLgpdOperacional['tipo']) {
  return tipo === 'retificacao' ? 'Retificacao' : 'Exclusao';
}

export function rotuloStatusLgpd(status: StatusSolicitacaoLgpd) {
  const mapa: Record<StatusSolicitacaoLgpd, string> = {
    recebida: 'Recebida',
    em_tratamento: 'Em tratamento',
    concluida: 'Concluida',
    indeferida: 'Indeferida'
  };
  return mapa[status];
}

export function classeStatusLgpd(status: StatusSolicitacaoLgpd) {
  const mapa: Record<StatusSolicitacaoLgpd, string> = {
    recebida: 'bg-superficie-hover text-primaria',
    em_tratamento: 'bg-alerta-suave text-alerta-forte',
    concluida: 'bg-sucesso-suave text-sucesso',
    indeferida: 'bg-perigo-suave text-perigo'
  };
  return mapa[status];
}

export function rotuloAcaoRetencao(acao: AcaoRetencaoDadosOperacional) {
  const mapa: Record<AcaoRetencaoDadosOperacional, string> = {
    preservar: 'Preservar',
    anonimizar: 'Anonimizar',
    excluir: 'Excluir',
    arquivar_exportar: 'Arquivar/exportar'
  };
  return mapa[acao];
}

export function pluralizarItensRetencao(total: number) {
  return `${total} ${total === 1 ? 'item vencido' : 'itens vencidos'}`;
}

export function rotuloPlano(plano: SolicitacaoAssinaturaOperacional['planoAtualId']) {
  const mapa: Record<SolicitacaoAssinaturaOperacional['planoAtualId'], string> = {
    gratuito: 'Gratuito',
    profissional: 'Profissional',
    clinica: 'Clínica',
    enterprise: 'Enterprise'
  };
  return mapa[plano];
}

export function rotuloStatusAssinatura(status: SolicitacaoAssinaturaOperacional['status']) {
  const mapa: Record<SolicitacaoAssinaturaOperacional['status'], string> = {
    pendente: 'Pendente',
    concluida: 'Concluida',
    cancelada: 'Cancelada'
  };
  return mapa[status];
}

export function classeStatusAssinatura(status: SolicitacaoAssinaturaOperacional['status']) {
  const mapa: Record<SolicitacaoAssinaturaOperacional['status'], string> = {
    pendente: 'bg-alerta-suave text-alerta-forte',
    concluida: 'bg-sucesso-suave text-sucesso',
    cancelada: 'bg-perigo-suave text-perigo'
  };
  return mapa[status];
}

export function rotuloStatusAlertas(status: DadosOperacionais['alertasOperacionais']['status']) {
  const mapa: Record<DadosOperacionais['alertasOperacionais']['status'], string> = {
    ok: 'OK',
    informativo: 'Informativo',
    atencao: 'Atencao',
    critico: 'Critico'
  };
  return mapa[status];
}

export function classeSeveridadeAlerta(
  severidade: DadosOperacionais['alertasOperacionais']['itens'][number]['severidade']
) {
  const mapa: Record<DadosOperacionais['alertasOperacionais']['itens'][number]['severidade'], string> = {
    critico: 'border-perigo bg-perigo-suave text-perigo',
    atencao: 'border-alerta-borda bg-alerta-suave text-alerta-forte',
    informativo: 'border-primaria-suave bg-superficie text-primaria'
  };
  return mapa[severidade];
}

export function chaveSolicitacaoAssinatura(solicitacao: SolicitacaoAssinaturaOperacional) {
  return `${solicitacao.tenantId}:${solicitacao.solicitadoEm}:${solicitacao.planoDesejado ?? solicitacao.planoAtualId}`;
}
