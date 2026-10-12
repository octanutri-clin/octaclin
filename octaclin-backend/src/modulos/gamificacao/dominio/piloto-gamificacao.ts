import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { obterTimezoneClinico } from '../../../infraestrutura/tempo/timezone-clinico';

export const CHAVE_PILOTO = 'gamificacao_piloto_317';
export const TERMO_CONQUISTAS = '317-conquistas-v1';
export const TERMO_COMUNIDADE = '317-comunidade-v1';
export const MAX_MEMBROS = 50;
export const MAX_CIRCULOS = 5;

export function dataCivilHoje(agora = new Date(), timezone = obterTimezoneClinico()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export function exigirAdulto(nascimento: string | undefined, hoje = dataCivilHoje()): void {
  if (!nascimento || !/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) throw new ForbiddenException('Participacao disponivel somente para adultos com cadastro conferido.');
  const data = new Date(`${nascimento}T12:00:00Z`);
  if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== nascimento || nascimento > hoje) throw new ForbiddenException('Participacao disponivel somente para adultos com cadastro conferido.');
  const aniversario = `${Number(nascimento.slice(0, 4)) + 18}${nascimento.slice(4)}`;
  // Comparing ISO civil dates keeps Feb29 ineligible until Mar01 in a common year.
  if (hoje < aniversario) throw new ForbiddenException('Participacao disponivel somente para adultos com cadastro conferido.');
}

export function exigirAutorProfissional(u: UsuarioAutenticado): void {
  if (u.papel !== 'Professional' || !u.permissoes.includes('gamificacao.gerenciar') || !u.permissoes.includes('pacientes.gerenciar')) throw new ForbiddenException('Acao exclusiva do profissional responsavel.');
}

export function exigirGestorPiloto(u: UsuarioAutenticado): void {
  const gestor = u.papel === 'Client' && u.permissoes.includes('cliente.configuracoes.gerenciar');
  const operacoes = u.papel === 'SuperAdmin' && u.permissoes.includes('operacoes.tenants.gerenciar');
  if (!gestor && !operacoes) throw new ForbiddenException('Configuracao exclusiva do gestor ou operacoes autorizadas.');
}

export function exigirNomeExibicao(nome: string): string {
  const valor = nome.trim();
  if (!valor || [...valor].length > 80 || /[\u0000-\u001f<>@]|https?:|www\.|(?:\d[\s()+-]*){8,}/i.test(valor)) throw new BadRequestException('Confira o nome de exibicao, sem contato ou markup.');
  return valor;
}

export function prazoRetencao(retiradoEm: Date): Date {
  return new Date(retiradoEm.getTime() + 90 * 24 * 60 * 60 * 1000);
}
