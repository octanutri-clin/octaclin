import 'dotenv/config';
import { MoreThan, Not } from 'typeorm';
import { fonteDados } from '../fonte-dados';
import { validarBancoBackfill } from './backfill-indices-busca-pacientes';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { gerarIndicesPerfilPaciente, CamposOperacaoIndexaveis } from '../../../modulos/pacientes/aplicacao/indices-perfil-paciente';
import { PacienteOrm } from '../../../modulos/pacientes/infraestrutura/paciente.orm';
import { PerfilCadastroPacienteOrm } from '../../../modulos/pacientes/infraestrutura/perfil-cadastro-paciente.orm';
import { TenantOrm } from '../../../modulos/tenancy/infraestrutura/tenant.orm';

export function lerOperacaoPerfil(criptografia: CriptografiaDadosSensiveis, cifrado: Buffer): CamposOperacaoIndexaveis {
  const dados: unknown = JSON.parse(criptografia.descriptografar(cifrado));
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('Bloco de operacao invalido.');
  const operacao = dados as Record<string, unknown>;
  if (operacao.categoria !== undefined && typeof operacao.categoria !== 'string') throw new Error('Categoria invalida.');
  if (operacao.origem !== undefined && typeof operacao.origem !== 'string') throw new Error('Origem invalida.');
  if (operacao.tags !== undefined && (!Array.isArray(operacao.tags) || !operacao.tags.every((tag) => typeof tag === 'string'))) {
    throw new Error('Tags invalidas.');
  }
  return operacao as CamposOperacaoIndexaveis;
}

async function executar(): Promise<void> {
  const banco = validarBancoBackfill(process.env.DATABASE_URL, process.env.CONFIRMAR_BANCO_BACKFILL);
  const criptografia = new CriptografiaDadosSensiveis();
  let atualizados = 0;
  await fonteDados.initialize();
  const tenants = await fonteDados.getRepository(TenantOrm).find({ select: { id: true } });
  for (const tenant of tenants) {
    let ultimoId = '';
    while (true) {
      const proximoId = await fonteDados.transaction(async (gerenciador) => {
        await gerenciador.query("select set_config('app.tenant_id', $1, true)", [tenant.id]);
        const perfis = gerenciador.getRepository(PerfilCadastroPacienteOrm);
        const pacientes = gerenciador.getRepository(PacienteOrm);
        const lote = await perfis.find({
          where: { tenantId: tenant.id, ...(ultimoId ? { pacienteId: MoreThan(ultimoId) } : {}) },
          order: { pacienteId: 'ASC' }, take: 100
        });
        if (!lote.length) return null;
        for (const item of lote) {
          // Mesma ordem de bloqueio da escrita do perfil: perfil, depois paciente.
          // Rele a linha apos obter o lock para nunca indexar um snapshot antigo.
          const perfil = await perfis.findOne({
            where: { tenantId: tenant.id, pacienteId: item.pacienteId },
            lock: { mode: 'pessimistic_write' }
          });
          if (!perfil) continue;
          const paciente = await pacientes.findOne({
            where: { id: perfil.pacienteId, tenantId: tenant.id, statusCicloVida: Not('DELETED') },
            lock: { mode: 'pessimistic_write' }
          });
          if (!paciente) continue;
          const hashes = perfil.operacaoCriptografada
            ? gerarIndicesPerfilPaciente(criptografia, tenant.id, lerOperacaoPerfil(criptografia, perfil.operacaoCriptografada))
            : [];
          if (JSON.stringify(hashes) !== JSON.stringify(paciente.perfilFiltrosHashes ?? [])) {
            const resultado = await pacientes.update(
              { id: perfil.pacienteId, tenantId: tenant.id, statusCicloVida: Not('DELETED') },
              { perfilFiltrosHashes: hashes }
            );
            atualizados += resultado.affected ?? 0;
          }
        }
        return lote[lote.length - 1].pacienteId;
      });
      if (!proximoId) break;
      ultimoId = proximoId;
    }
  }
  console.log(`Backfill de indices de perfil concluido em ${banco}: ${atualizados} pacientes atualizados.`);
}

if (require.main === module) {
  executar()
    .catch(() => { console.error('Backfill de indices de perfil falhou. Verifique o alvo e os dados sem registrar valores protegidos.'); process.exitCode = 1; })
    .finally(async () => { if (fonteDados.isInitialized) await fonteDados.destroy(); });
}
