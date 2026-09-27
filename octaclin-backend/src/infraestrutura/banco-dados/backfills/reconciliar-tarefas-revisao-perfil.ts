import 'dotenv/config';
import { IsNull, MoreThan, Not } from 'typeorm';
import { fonteDados } from '../fonte-dados';
import { validarBancoBackfill } from './backfill-indices-busca-pacientes';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { criarTarefaRevisaoPerfil, idTarefaRevisaoPerfil, lerDataRevisaoPerfilEstrita, validarDestinatarioTarefaRevisaoPerfil } from '../../../modulos/pacientes/aplicacao/tarefa-revisao-perfil';
import { AcompanhamentoTarefaOrm } from '../../../modulos/pacientes/infraestrutura/acompanhamento-tarefa.orm';
import { PacienteOrm } from '../../../modulos/pacientes/infraestrutura/paciente.orm';
import { PerfilCadastroPacienteOrm } from '../../../modulos/pacientes/infraestrutura/perfil-cadastro-paciente.orm';
import { TenantOrm } from '../../../modulos/tenancy/infraestrutura/tenant.orm';

async function executar(): Promise<void> {
  const banco = validarBancoBackfill(process.env.DATABASE_URL, process.env.CONFIRMAR_BANCO_BACKFILL);
  const tenantId = process.env.TENANT_ID_RECONCILIACAO_REVISAO_PERFIL?.trim();
  if (!tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    throw new Error('TENANT_ID_RECONCILIACAO_REVISAO_PERFIL deve identificar um tenant valido.');
  }
  const aplicar = process.env.EXECUTAR_RECONCILIACAO_REVISAO_PERFIL === 'SIM';
  const criptografia = new CriptografiaDadosSensiveis();
  let elegiveis = 0;
  let existentes = 0;
  let criadas = 0;
  let ultimoId = '';
  await fonteDados.initialize();
  const tenant = await fonteDados.getRepository(TenantOrm).findOne({ select: { id: true }, where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant informado nao existe no banco confirmado.');

  while (true) {
    const proximoId = await fonteDados.transaction(async (gerenciador) => {
      await gerenciador.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
      const perfis = gerenciador.getRepository(PerfilCadastroPacienteOrm);
      const lote = await perfis.find({
        select: { pacienteId: true },
        where: { tenantId, ...(ultimoId ? { pacienteId: MoreThan(ultimoId) } : {}) },
        order: { pacienteId: 'ASC' }, take: 100
      });
      if (!lote.length) return null;

      for (const item of lote) {
        // A mesma ordem de lock da edicao do perfil: paciente, depois perfil.
        const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
          select: { id: true, profissionalResponsavelId: true },
          where: { id: item.pacienteId, tenantId, arquivadoEm: IsNull(), statusCicloVida: Not('DELETED') },
          lock: { mode: 'pessimistic_write' }
        });
        if (!paciente) continue;
        const perfil = await perfis.findOne({
          select: { pacienteId: true, operacaoCriptografada: true }, where: { tenantId, pacienteId: item.pacienteId }
        });
        const data = lerDataRevisaoPerfilEstrita(criptografia, perfil?.operacaoCriptografada);
        if (!data) continue;
        elegiveis += 1;
        const id = idTarefaRevisaoPerfil(tenantId, item.pacienteId, data);
        const jaExiste = await gerenciador.getRepository(AcompanhamentoTarefaOrm).findOne({
          select: { id: true }, where: { id, tenantId, pacienteId: item.pacienteId }
        });
        if (jaExiste) { existentes += 1; continue; }
        await validarDestinatarioTarefaRevisaoPerfil(gerenciador, tenantId, paciente.profissionalResponsavelId);
        if (aplicar) {
          await criarTarefaRevisaoPerfil(gerenciador, criptografia, tenantId, item.pacienteId, paciente.profissionalResponsavelId, data);
          criadas += 1;
        }
      }
      return lote[lote.length - 1].pacienteId;
    });
    if (!proximoId) break;
    ultimoId = proximoId;
  }
  console.log(`Reconciliacao de revisao em ${banco}: modo ${aplicar ? 'APLICAR' : 'SIMULAR'}, elegiveis ${elegiveis}, existentes ${existentes}, criadas ${criadas}.`);
}

if (require.main === module) {
  executar()
    .catch(() => { console.error('Reconciliacao de revisao falhou. Confirme alvo, permissao e integridade sem imprimir dados protegidos.'); process.exitCode = 1; })
    .finally(async () => { if (fonteDados.isInitialized) await fonteDados.destroy(); });
}
