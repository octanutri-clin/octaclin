import 'dotenv/config';
import { MoreThan } from 'typeorm';
import { fonteDados } from '../fonte-dados';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { PacienteOrm } from '../../../modulos/pacientes/infraestrutura/paciente.orm';
import { TenantOrm } from '../../../modulos/tenancy/infraestrutura/tenant.orm';

export function validarBancoBackfill(databaseUrl?: string, confirmacao?: string): string {
  if (!databaseUrl) throw new Error('DATABASE_URL e obrigatoria para o backfill.');
  if (!confirmacao?.trim()) throw new Error('CONFIRMAR_BANCO_BACKFILL e obrigatoria.');

  const banco = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (!banco || banco !== confirmacao.trim()) {
    throw new Error(`Banco nao confirmado: informe CONFIRMAR_BANCO_BACKFILL=${banco || '<nome-do-banco>'}.`);
  }
  return banco;
}

export function extrairValoresContatoBusca(contato?: string): string[] {
  if (!contato) return [];
  try {
    const dados = JSON.parse(contato) as { email?: unknown; whatsapp?: unknown };
    return [dados.email, dados.whatsapp].filter((valor): valor is string => typeof valor === 'string' && Boolean(valor.trim()));
  } catch {
    return [contato];
  }
}

async function executar() {
  const banco = validarBancoBackfill(process.env.DATABASE_URL, process.env.CONFIRMAR_BANCO_BACKFILL);
  const criptografia = new CriptografiaDadosSensiveis();
  let atualizados = 0;

  await fonteDados.initialize();
  const tenants = await fonteDados.getRepository(TenantOrm).find({ select: { id: true } });

  for (const tenant of tenants) {
    await fonteDados.transaction(async (gerenciador) => {
      await gerenciador.query("select set_config('app.tenant_id', $1, true)", [tenant.id]);
      const repositorio = gerenciador.getRepository(PacienteOrm);
      let ultimoId = '';

      while (true) {
        const pacientes = await repositorio.find({
          where: { tenantId: tenant.id, ...(ultimoId ? { id: MoreThan(ultimoId) } : {}) },
          order: { id: 'ASC' },
          take: 100
        });
        if (!pacientes.length) break;

        for (const paciente of pacientes) {
          const nome = criptografia.descriptografar(paciente.nomeCriptografado);
          const contato = paciente.contatoCriptografado
            ? criptografia.descriptografar(paciente.contatoCriptografado)
            : undefined;
          const hashes = criptografia.gerarHashesBuscaPii(tenant.id, [nome, ...extrairValoresContatoBusca(contato)]);
          if (JSON.stringify(hashes) !== JSON.stringify(paciente.buscaHashes ?? [])) {
            paciente.buscaHashes = hashes;
            await repositorio.save(paciente);
            atualizados += 1;
          }
        }
        ultimoId = pacientes[pacientes.length - 1].id;
      }
    });
  }

  console.log(`Backfill concluido em ${banco}: ${atualizados} pacientes atualizados.`);
}

if (require.main === module) {
  executar()
    .catch((erro) => {
      console.error(erro instanceof Error ? erro.message : erro);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (fonteDados.isInitialized) await fonteDados.destroy();
    });
}
