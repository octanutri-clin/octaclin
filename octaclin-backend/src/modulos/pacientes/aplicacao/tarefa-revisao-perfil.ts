import { BadRequestException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { identificadorDeterministico } from '../../../infraestrutura/identificador-deterministico';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { obterTimezoneClinico } from '../../../infraestrutura/tempo/timezone-clinico';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { AcompanhamentoTarefaOrm } from '../infraestrutura/acompanhamento-tarefa.orm';

export function dataCivilRevisaoValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  const valor = new Date(Date.UTC(ano, mes - 1, dia));
  return valor.getUTCFullYear() === ano && valor.getUTCMonth() === mes - 1 && valor.getUTCDate() === dia;
}

export function lerDataRevisaoPerfil(criptografia: CriptografiaDadosSensiveis, bloco?: Buffer): string | undefined {
  if (!bloco) return undefined;
  try {
    const dados = JSON.parse(criptografia.descriptografar(bloco)) as { proximaRevisaoEm?: unknown };
    return typeof dados.proximaRevisaoEm === 'string' && dataCivilRevisaoValida(dados.proximaRevisaoEm)
      ? dados.proximaRevisaoEm : undefined;
  } catch {
    return undefined;
  }
}

/** Backfill falha fechado em bloco invalido para nao declarar reconciliacao parcial. */
export function lerDataRevisaoPerfilEstrita(criptografia: CriptografiaDadosSensiveis, bloco?: Buffer): string | undefined {
  if (!bloco) return undefined;
  try {
    const dados: unknown = JSON.parse(criptografia.descriptografar(bloco));
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error();
    const data = (dados as Record<string, unknown>).proximaRevisaoEm;
    if (data === undefined || data === null || data === '') return undefined;
    if (typeof data !== 'string' || !dataCivilRevisaoValida(data)) throw new Error();
    return data;
  } catch {
    throw new Error('Bloco de operacao invalido para reconciliacao de revisao.');
  }
}

export function idTarefaRevisaoPerfil(tenantId: string, pacienteId: string, data: string): string {
  return identificadorDeterministico('tarefa-revisao-perfil-v1', `${tenantId}:${pacienteId}:${data}`);
}

/** Converte 23:59:59 do dia civil no fuso clinico para um instante UTC. */
export function vencimentoRevisaoPerfil(data: string): Date {
  if (!dataCivilRevisaoValida(data)) throw new BadRequestException('Data de proxima revisao invalida.');
  const [ano, mes, dia] = data.split('-').map(Number);
  const horarioUtc = Date.UTC(ano, mes - 1, dia, 23, 59, 59);
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: obterTimezoneClinico(), year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  let instante = horarioUtc;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const partes = Object.fromEntries(formatador.formatToParts(new Date(instante)).map((item) => [item.type, Number(item.value)]));
    const representacaoUtc = Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour, partes.minute, partes.second);
    const diferenca = horarioUtc - representacaoUtc;
    instante += diferenca;
    if (diferenca === 0) break;
  }
  return new Date(instante);
}

async function usuarioResponsavel(gerenciador: EntityManager, tenantId: string, profissionalId: string): Promise<string> {
  const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
    select: { id: true, usuarioId: true }, where: { id: profissionalId, tenantId, arquivadoEm: IsNull() }
  });
  const usuario = profissional?.usuarioId ? await gerenciador.getRepository(UsuarioOrm).findOne({
    select: { id: true }, where: { id: profissional.usuarioId, tenantId, ativo: true }
  }) : null;
  if (!usuario) throw new BadRequestException('Profissional responsavel ativo necessario para a revisao.');
  return usuario.id;
}

export async function validarDestinatarioTarefaRevisaoPerfil(
  gerenciador: EntityManager, tenantId: string, profissionalId: string
): Promise<void> {
  await usuarioResponsavel(gerenciador, tenantId, profissionalId);
}

export async function criarTarefaRevisaoPerfil(
  gerenciador: EntityManager, criptografia: CriptografiaDadosSensiveis,
  tenantId: string, pacienteId: string, profissionalId: string, data: string
): Promise<void> {
  const id = idTarefaRevisaoPerfil(tenantId, pacienteId, data);
  const tarefas = gerenciador.getRepository(AcompanhamentoTarefaOrm);
  const existente = await tarefas.findOne({ select: { id: true }, where: { id, tenantId, pacienteId } });
  if (existente) return;
  const usuarioId = await usuarioResponsavel(gerenciador, tenantId, profissionalId);
  await tarefas.createQueryBuilder().insert().into(AcompanhamentoTarefaOrm).values({
    id, tenantId, pacienteId, profissionalId: usuarioId,
    tituloCriptografado: criptografia.criptografar('Revisar cadastro do paciente'),
    categoria: 'tarefa', prioridade: 'media', status: 'pendente', vencimentoEm: vencimentoRevisaoPerfil(data)
  }).orIgnore().execute();
}

export async function cancelarTarefaRevisaoPerfil(
  gerenciador: EntityManager, tenantId: string, pacienteId: string, data: string
): Promise<void> {
  await gerenciador.getRepository(AcompanhamentoTarefaOrm).update(
    { id: idTarefaRevisaoPerfil(tenantId, pacienteId, data), tenantId, pacienteId, status: 'pendente' },
    { status: 'cancelada' }
  );
  await gerenciador.getRepository(AcompanhamentoTarefaOrm).update(
    { id: idTarefaRevisaoPerfil(tenantId, pacienteId, data), tenantId, pacienteId, status: 'em_andamento' },
    { status: 'cancelada' }
  );
}

export async function reatribuirTarefaRevisaoPerfil(
  gerenciador: EntityManager, tenantId: string, pacienteId: string, data: string, profissionalId: string
): Promise<void> {
  const id = idTarefaRevisaoPerfil(tenantId, pacienteId, data);
  const tarefas = gerenciador.getRepository(AcompanhamentoTarefaOrm);
  const tarefa = await tarefas.findOne({ select: { id: true, status: true }, where: { id, tenantId, pacienteId } });
  if (!tarefa || (tarefa.status !== 'pendente' && tarefa.status !== 'em_andamento')) return;
  const usuarioId = await usuarioResponsavel(gerenciador, tenantId, profissionalId);
  await tarefas.update({ id, tenantId, pacienteId, status: tarefa.status }, { profissionalId: usuarioId });
}
