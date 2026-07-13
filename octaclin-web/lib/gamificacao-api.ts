import { PacienteResumo, ProfissionalResumo, RespostaPaginada, listarPacientes, listarProfissionais } from './cadastros-api';

export interface CirculoPacientesApi {
  id: string;
  tenantId: string;
  profissionalId: string;
  nome: string;
  objetivo: string;
  privado: boolean;
  criadoEm: string;
}

export interface MembroCirculoApi {
  id: string;
  tenantId: string;
  circuloId: string;
  pacienteId: string;
  entrouEm: string;
}

export interface PostComunidadeApi {
  id: string;
  tenantId: string;
  circuloId: string;
  pacienteId: string;
  conteudo: string;
  status: 'publicado' | 'pendente_moderacao' | 'bloqueado';
  criadoEm: string;
}

export interface DesafioApi {
  id: string;
  tenantId: string;
  profissionalId: string;
  titulo: string;
  descricao?: string;
  regraPontuacao: Record<string, unknown>;
  iniciaEm: string;
  terminaEm: string;
  criadoEm: string;
}

export interface ParticipacaoDesafioApi {
  id: string;
  tenantId: string;
  desafioId: string;
  pacienteId: string;
  pontos: string;
  progresso: Record<string, unknown>;
}

export interface BadgeApi {
  id: string;
  tenantId: string;
  nome: string;
  descricao?: string;
  iconeSvg: string;
  regraConquista: Record<string, unknown>;
}

export interface PacienteBadgeApi {
  id: string;
  tenantId: string;
  pacienteId: string;
  badgeId: string;
  conquistadoEm: string;
}

export interface BootstrapGamificacao {
  profissionais: RespostaPaginada<ProfissionalResumo>;
  pacientes: RespostaPaginada<PacienteResumo>;
  circulos: CirculoPacientesApi[];
  desafios: DesafioApi[];
  badges: BadgeApi[];
}

class ErroApiGamificacao extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiGamificacao';
  }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    }
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiGamificacao(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

export async function criarCirculo(entrada: {
  profissionalId: string;
  nome: string;
  objetivo: string;
  privado?: boolean;
}): Promise<CirculoPacientesApi> {
  return requisitar<CirculoPacientesApi>('/api/gamificacao/circulos', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarCirculos(): Promise<CirculoPacientesApi[]> {
  return requisitar<CirculoPacientesApi[]>('/api/gamificacao/circulos');
}

export async function entrarCirculo(circuloId: string, entrada: { pacienteId: string }): Promise<MembroCirculoApi> {
  return requisitar<MembroCirculoApi>(`/api/gamificacao/circulos/${circuloId}/membros`, {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function criarPost(entrada: {
  circuloId: string;
  pacienteId: string;
  conteudo: string;
}): Promise<PostComunidadeApi> {
  return requisitar<PostComunidadeApi>('/api/gamificacao/posts', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function criarDesafio(entrada: {
  profissionalId: string;
  titulo: string;
  descricao?: string;
  regraPontuacao: Record<string, unknown>;
  iniciaEm: string;
  terminaEm: string;
}): Promise<DesafioApi> {
  return requisitar<DesafioApi>('/api/gamificacao/desafios', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarDesafios(): Promise<DesafioApi[]> {
  return requisitar<DesafioApi[]>('/api/gamificacao/desafios');
}

export async function atualizarProgressoDesafio(entrada: {
  desafioId: string;
  pacienteId: string;
  pontos: number;
  progresso: Record<string, unknown>;
}): Promise<ParticipacaoDesafioApi> {
  return requisitar<ParticipacaoDesafioApi>('/api/gamificacao/desafios/progresso', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function carregarRankingDesafio(desafioId: string): Promise<ParticipacaoDesafioApi[]> {
  return requisitar<ParticipacaoDesafioApi[]>(`/api/gamificacao/desafios/${desafioId}/ranking`);
}

export async function criarBadge(entrada: {
  nome: string;
  descricao?: string;
  iconeSvg: string;
  regraConquista: Record<string, unknown>;
}): Promise<BadgeApi> {
  return requisitar<BadgeApi>('/api/gamificacao/badges', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarBadges(): Promise<BadgeApi[]> {
  return requisitar<BadgeApi[]>('/api/gamificacao/badges');
}

export async function concederBadge(entrada: { pacienteId: string; badgeId: string }): Promise<PacienteBadgeApi> {
  return requisitar<PacienteBadgeApi>('/api/gamificacao/badges/concessoes', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function carregarBootstrapGamificacao(): Promise<BootstrapGamificacao> {
  const [profissionais, pacientes, circulos, desafios, badges] = await Promise.all([
    listarProfissionais(),
    listarPacientes(),
    listarCirculos(),
    listarDesafios(),
    listarBadges()
  ]);
  return { profissionais, pacientes, circulos, desafios, badges };
}
