import {
  AtualizarConfiguracoesClienteEntrada,
  AtualizarPerfilEmpresaClienteEntrada,
  PapelUsuarioClienteCriavelApi,
  PlanoSaasIdApi,
  RecursoLimitavelSaasApi
} from '@/lib/cliente-api';

export type AreaPortalCliente =
  | 'ativacao'
  | 'assinatura'
  | 'consumo'
  | 'financeiro'
  | 'equipe'
  | 'preferencias'
  | 'marca'
  | 'documentos'
  | 'integracoes'
  | 'fiscal';

export function formatarQuantidade(valor: number, singular: string, plural: string) {
  return `${valor} ${valor === 1 ? singular : plural}`;
}

export function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'UTC'
  }).format(data);
}

export const recursosSaas: { chave: RecursoLimitavelSaasApi; rotulo: string }[] = [
  { chave: 'usuariosAdministrativos', rotulo: 'Usuários administrativos' },
  { chave: 'pacientes', rotulo: 'Pacientes' },
  { chave: 'mensagensMes', rotulo: 'Mensagens no mês' },
  { chave: 'formulariosAtivos', rotulo: 'Formulários ativos' },
  { chave: 'armazenamentoMb', rotulo: 'Armazenamento' }
];

export function formatarLimiteSaas(uso: number, limite: number | null, recurso: RecursoLimitavelSaasApi) {
  const sufixo = recurso === 'armazenamentoMb' ? ' MB' : '';
  if (limite === null) return `${uso}${sufixo} / ilimitado`;
  return `${uso}${sufixo} / ${limite}${sufixo}`;
}

export function calcularPercentualSaas(uso: number, limite: number | null) {
  if (limite === null || limite <= 0) return 0;
  return Math.min(Math.round((uso / limite) * 100), 100);
}

export function descreverAlertaSaas(status: 'atencao' | 'excedido') {
  return status === 'excedido' ? 'Limite atingido' : 'Perto do limite';
}

export function assinaturaBloqueada(status?: string) {
  return status === 'suspensa' || status === 'cancelada';
}

export function rotuloPapel(papel: string) {
  if (papel === 'Client') return 'Gestor da conta';
  if (papel === 'Professional') return 'Profissional';
  if (papel === 'Collaborator') return 'Equipe administrativa';
  return 'Acesso da equipe';
}

export function rotuloStatusAssinatura(status?: string) {
  if (status === 'ativa') return 'Assinatura ativa';
  if (status === 'suspensa') return 'Assinatura suspensa';
  if (status === 'cancelada') return 'Assinatura cancelada';
  return 'Assinatura em atualizacao';
}

const proximosPlanos: Record<PlanoSaasIdApi, { id?: PlanoSaasIdApi; nome: string; detalhe: string }> = {
  gratuito: {
    id: 'profissional',
    nome: 'Profissional',
    detalhe: 'Mais pacientes, formulários e mensagens para operação individual.'
  },
  profissional: {
    id: 'clinica',
    nome: 'Clínica',
    detalhe: 'Mais usuários administrativos e margem para crescer a operação.'
  },
  clinica: {
    id: 'enterprise',
    nome: 'Enterprise',
    detalhe: 'Limites sob medida para operações maiores ou multiunidade.'
  },
  enterprise: {
    nome: 'Plano atual sob medida',
    detalhe: 'Solicite revisão comercial quando precisar ajustar contrato ou capacidade.'
  }
};

export function obterProximoPlano(planoId: PlanoSaasIdApi) {
  return proximosPlanos[planoId];
}

export function descreverHistoricoConvite(item: {
  status: string;
  criadoPorUsuarioId?: string;
  reenviadoPorUsuarioId?: string;
  revogadoPorUsuarioId?: string;
  usadoEm?: string;
  revogadoEm?: string;
}) {
  if (item.status === 'usado' && item.usadoEm) return `Usado em ${formatarData(item.usadoEm)}`;
  if (item.status === 'revogado' && item.revogadoPorUsuarioId) return 'Convite revogado';
  if (item.reenviadoPorUsuarioId) return 'Convite reenviado';
  if (item.criadoPorUsuarioId) return 'Convite criado';
  return 'Evento registrado';
}

export const formularioUsuarioInicial = {
  email: '',
  role: 'Collaborator' as PapelUsuarioClienteCriavelApi,
  nomeProfissional: '',
  registroProfissional: '',
  especialidade: ''
};

export const formularioConfiguracoesInicial: AtualizarConfiguracoesClienteEntrada = {
  nome: '',
  timezone: 'America/Sao_Paulo',
  idioma: 'pt-BR',
  canaisPadrao: {
    email: true,
    whatsapp: true,
    googleCalendar: true
  },
  marca: {
    nomeExibido: '',
    emailRemetente: '',
    corPrimaria: '#197d8f'
  }
};

export const formularioPerfilEmpresaInicial: AtualizarPerfilEmpresaClienteEntrada = {
  tipoPessoa: 'pj',
  documento: '',
  nomeLegal: '',
  nomeFantasia: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  responsavel: {
    nome: '',
    email: '',
    telefone: '',
    cargo: ''
  },
  endereco: {
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    pais: 'BR'
  },
  contatos: {
    emailFinanceiro: '',
    telefoneFinanceiro: '',
    whatsappAtendimento: '',
    emailAtendimento: ''
  },
  fiscal: {
    prepararRecibos: true,
    observacoes: ''
  }
};
