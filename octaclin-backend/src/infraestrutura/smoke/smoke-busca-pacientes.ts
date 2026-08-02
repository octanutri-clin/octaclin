import 'dotenv/config';
import { createHash } from 'crypto';
import { ArrayContains } from 'typeorm';
import { fonteDados } from '../banco-dados/fonte-dados';
import { validarBancoBackfill } from '../banco-dados/backfills/backfill-indices-busca-pacientes';
import { CriptografiaDadosSensiveis } from '../seguranca/criptografia-dados-sensiveis';
import { PacienteOrm } from '../../modulos/pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../modulos/profissionais/infraestrutura/profissional.orm';
import { TenantOrm } from '../../modulos/tenancy/infraestrutura/tenant.orm';

const tenantId = '10101010-1010-4101-8101-101010101010';
const profissionalId = '20202020-2020-4202-8202-202020202021';
const outroProfissionalId = '20202020-2020-4202-8202-202020202022';

function uuidDeterministico(indice: number): string {
  const hex = createHash('sha256').update(`fase-199-paciente-${indice}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function executar() {
  if (process.env.CONFIRMAR_MASSA_SINTETICA !== 'SIM') {
    throw new Error('CONFIRMAR_MASSA_SINTETICA=SIM e obrigatoria para este smoke.');
  }
  if (!process.env.CONFIRMAR_BANCO_BUSCA?.trim()) {
    throw new Error('CONFIRMAR_BANCO_BUSCA e obrigatoria para este smoke.');
  }
  const banco = validarBancoBackfill(process.env.DATABASE_URL, process.env.CONFIRMAR_BANCO_BUSCA);
  if (!process.env.CRIPTOGRAFIA_CHAVE_AES_256) throw new Error('CRIPTOGRAFIA_CHAVE_AES_256 e obrigatoria.');

  await fonteDados.initialize();
  const criptografia = new CriptografiaDadosSensiveis();

  await fonteDados.transaction(async (gerenciador) => {
    await gerenciador.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
    const tenant = await gerenciador.getRepository(TenantOrm).findOne({ where: { id: tenantId } });
    const profissionais = await gerenciador.getRepository(ProfissionalOrm).find({
      where: [{ id: profissionalId, tenantId }, { id: outroProfissionalId, tenantId }]
    });
    if (!tenant || profissionais.length !== 2) throw new Error('Execute seed:staging antes do smoke da Fase 199.');

    const repositorio = gerenciador.getRepository(PacienteOrm);
    if (process.env.PREPARAR_BACKFILL_BUSCA === 'SIM') {
      await repositorio.update({ tenantId }, { buscaHashes: [] });
      console.log(`Indices limpos em ${banco} para validar o backfill.`);
      return;
    }

    const pacientes = Array.from({ length: 500 }, (_, indice) => {
      const sequencia = indice + 1;
      const nome = `Paciente Sintetico ${String(sequencia).padStart(4, '0')}`;
      const contato = `fase199.${sequencia}@octaclin.test`;
      return repositorio.create({
        id: uuidDeterministico(sequencia),
        tenantId,
        profissionalResponsavelId: profissionalId,
        nomeCriptografado: criptografia.criptografar(nome),
        contatoCriptografado: criptografia.criptografar(contato),
        buscaHashes: criptografia.gerarHashesBuscaPii(tenantId, [nome, contato]),
        statusAdesao: 'em_acompanhamento',
        scoreRisco: '20'
      });
    });
    await repositorio.save(pacientes, { chunk: 100 });

    const hashes = criptografia.gerarHashesConsultaPii(tenantId, 'sintetico 0499');
    const inicio = performance.now();
    const encontrado = await repositorio.findOne({
      where: { tenantId, profissionalResponsavelId: profissionalId, buscaHashes: ArrayContains(hashes) }
    });
    const duracaoMs = performance.now() - inicio;
    const foraDoEscopo = await repositorio.count({
      where: { tenantId, profissionalResponsavelId: outroProfissionalId, buscaHashes: ArrayContains(hashes) }
    });

    if (encontrado?.id !== uuidDeterministico(499)) throw new Error('Busca nao retornou o paciente sintetico esperado.');
    if (foraDoEscopo !== 0) throw new Error('Busca retornou paciente fora do escopo profissional.');
    if (duracaoMs >= 1000) throw new Error(`Busca excedeu 1 segundo: ${duracaoMs.toFixed(1)} ms.`);

    console.log(`Smoke da Fase 199 aprovado em ${banco}: 500 pacientes, busca ${duracaoMs.toFixed(1)} ms, escopo isolado.`);
  });
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
