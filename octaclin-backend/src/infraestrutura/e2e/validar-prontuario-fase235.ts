import 'dotenv/config';
import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { fonteDados } from '../banco-dados/fonte-dados';
import { ExecutorTenant } from '../banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../seguranca/criptografia-dados-sensiveis';
import type { UsuarioAutenticado } from '../../modulos/auth/dominio/usuario-autenticado';
import { ServicoPacientes } from '../../modulos/pacientes/aplicacao/servico-pacientes';
import { validarAlvoStagingE2E } from './alvo-staging-e2e';

const ALFA = {
  tenantId: '23100000-0000-4000-8000-000000000001',
  usuarioId: '23100000-0000-4000-8000-000000000011',
  profissionalId: '23110000-0000-4000-8000-000000000001'
};
const BETA = {
  tenantId: '23100000-0000-4000-8000-000000000002',
  usuarioId: '23100000-0000-4000-8000-000000000021'
};
const REFERENCIA = 'fase235-aceite-final';

function usuario(tenantId: string, usuarioId: string): UsuarioAutenticado {
  return {
    tenantId,
    usuarioId,
    papel: 'SuperAdmin',
    emailHash: `e2e-${usuarioId}`,
    permissoes: ['planos_alimentares.ler', 'comunicacoes.mensagens.ler', 'agenda.financeiro.ler']
  };
}

async function limpar(executor: ExecutorTenant): Promise<void> {
  await executor.executar(ALFA.tenantId, async (gerenciador) => {
    const pacientes = (await gerenciador.query(
      'select id from pacientes where tenant_id = $1 and referencia_externa = $2',
      [ALFA.tenantId, REFERENCIA]
    )) as Array<{ id: string }>;
    const ids = pacientes.map((paciente) => paciente.id);
    if (!ids.length) return;
    await gerenciador.query('delete from acompanhamento_tarefas where tenant_id = $1 and paciente_id = any($2::uuid[])', [
      ALFA.tenantId,
      ids
    ]);
    await gerenciador.query('delete from evolucoes_clinicas where tenant_id = $1 and paciente_id = any($2::uuid[])', [
      ALFA.tenantId,
      ids
    ]);
    await gerenciador.query('delete from pacientes where tenant_id = $1 and id = any($2::uuid[])', [ALFA.tenantId, ids]);
  });
}

async function executar(): Promise<void> {
  const alvo = validarAlvoStagingE2E(
    process.env.E2E_DATABASE_URL,
    process.env.E2E_CONFIRMAR_BANCO,
    process.env.E2E_CONFIRMAR_REMOTO === 'SIM'
  );
  process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
  process.env.BANCO_EXECUTAR_MIGRACOES = 'false';

  const executor = new ExecutorTenant(fonteDados);
  let pacienteId: string | undefined;
  let resultado: Record<string, unknown> | undefined;
  try {
    await fonteDados.initialize();
    const papel = (await fonteDados.query(
      'select current_user as usuario, rolsuper, rolbypassrls from pg_roles where rolname = current_user'
    )) as Array<{ usuario: string; rolsuper: boolean; rolbypassrls: boolean }>;
    if (!papel[0]?.usuario || papel[0].rolsuper || papel[0].rolbypassrls) {
      throw new Error('A jornada da Fase 235 exige role runtime sem SUPERUSER/BYPASSRLS.');
    }

    await limpar(executor);
    const servico = new ServicoPacientes(
      executor,
      new CriptografiaDadosSensiveis(),
      { checarLimite: async () => ({ permitido: true }) } as never
    );
    const usuarioAlfa = usuario(ALFA.tenantId, ALFA.usuarioId);
    const usuarioBeta = usuario(BETA.tenantId, BETA.usuarioId);
    const paciente = await servico.criar(
      ALFA.tenantId,
      {
        profissionalResponsavelId: ALFA.profissionalId,
        nome: 'Paciente sintetico Fase 235',
        contato: 'e2e.fase235@octaclin.test',
        dataNascimento: '1990-01-01',
        referenciaExterna: REFERENCIA
      },
      usuarioAlfa
    );
    pacienteId = paciente.id;

    await servico.criarEvolucaoClinica(
      ALFA.tenantId,
      paciente.id,
      ALFA.usuarioId,
      {
        titulo: 'Evolucao sintetica Fase 235',
        conteudo: 'Registro sintetico para validar resumo e timeline em PostgreSQL real.',
        tipo: 'observacao',
        visibilidade: 'privada'
      },
      usuarioAlfa
    );
    await servico.criarTarefaAcompanhamento(
      ALFA.tenantId,
      paciente.id,
      ALFA.usuarioId,
      {
        titulo: 'Tarefa sintetica Fase 235',
        descricao: 'Validar acao rapida e proxima conduta.',
        categoria: 'tarefa',
        prioridade: 'alta',
        vencimentoEm: new Date(Date.now() - 60_000).toISOString()
      },
      usuarioAlfa
    );

    const prontuario = await servico.obterProntuario(ALFA.tenantId, paciente.id, usuarioAlfa);
    const timeline = await servico.listarLinhaDoTempoPaginada(ALFA.tenantId, paciente.id, usuarioAlfa, { limite: 20 });
    const tipos = new Set(timeline.itens.map((item) => item.tipo));
    if (prontuario.resumo.evolucoes !== 1 || prontuario.resumo.tarefasPendentes !== 1) {
      throw new Error('Resumo do prontuario nao refletiu as mutacoes sinteticas.');
    }
    if (!tipos.has('evolucao_clinica') || !tipos.has('tarefa_acompanhamento')) {
      throw new Error('Timeline consolidada nao retornou evolucao e tarefa sinteticas.');
    }

    let isolamentoConfirmado = false;
    try {
      await servico.obterProntuario(BETA.tenantId, paciente.id, usuarioBeta);
    } catch (erro) {
      isolamentoConfirmado = erro instanceof NotFoundException;
    }
    if (!isolamentoConfirmado) throw new Error('Tenant Beta conseguiu observar paciente do Tenant Alfa.');

    resultado = {
      fase: 235,
      banco: alvo.banco,
      role: papel[0].usuario,
      roleSemBypassRls: true,
      mutacoes: ['paciente', 'evolucao_clinica', 'tarefa_acompanhamento'],
      resumo: {
        evolucoes: prontuario.resumo.evolucoes,
        tarefasPendentes: prontuario.resumo.tarefasPendentes,
        proximaConduta: prontuario.resumo.proximaConduta?.tipo
      },
      timelineTipos: Array.from(tipos).sort(),
      isolamentoEntreTenants: true
    };
  } finally {
    if (fonteDados.isInitialized) {
      if (pacienteId) await limpar(executor);
      await fonteDados.destroy();
    }
    delete process.env.DATABASE_URL;
  }

  console.log(JSON.stringify({ ...resultado, dadosSinteticosRemovidos: true }, null, 2));
}

if (require.main === module) {
  executar().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  });
}
