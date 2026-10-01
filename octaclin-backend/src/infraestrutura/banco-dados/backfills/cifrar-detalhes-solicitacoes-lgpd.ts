import 'dotenv/config';
import { DataSource } from 'typeorm';
import { fonteDados } from '../fonte-dados';
import { validarBancoBackfill } from './backfill-indices-busca-pacientes';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { TenantOrm } from '../../../modulos/tenancy/infraestrutura/tenant.orm';

interface LinhaLegada {
  id: string;
  metadados: Record<string, unknown>;
  detalhesCriptografados: Buffer | null;
}

async function executar(): Promise<void> {
  const banco = validarBancoBackfill(process.env.DATABASE_URL, process.env.CONFIRMAR_BANCO_BACKFILL);
  const roleEsperada = process.env.CONFIRMAR_ROLE_BACKFILL?.trim();
  if (!roleEsperada) throw new Error('CONFIRMAR_ROLE_BACKFILL e obrigatoria.');
  if (!process.env.CRIPTOGRAFIA_CHAVE_AES_256) {
    throw new Error('Chave de criptografia real obrigatoria para este backfill.');
  }

  const criptografia = new CriptografiaDadosSensiveis();
  await fonteDados.initialize();
  await processarDetalhesLgpd(fonteDados, criptografia, banco, roleEsperada);
}

/** Conversao transacional e repetivel; a conexao ja deve estar inicializada pelo executor. */
export async function processarDetalhesLgpd(
  fonte: DataSource,
  criptografia: CriptografiaDadosSensiveis,
  banco: string,
  roleEsperada: string
): Promise<{ convertidos: number; tenants: number }> {
  let convertidos = 0;
  const [identidade] = await fonte.query('select current_database() as banco, current_user as papel');
  if (identidade?.banco !== banco || identidade?.papel !== roleEsperada) {
    throw new Error('Banco ou role divergente da confirmacao; backfill nao iniciado.');
  }

  const tenants = await fonte.getRepository(TenantOrm).find({ select: { id: true } });
  for (const tenant of tenants) {
    while (true) {
      const quantidade = await fonte.transaction(async (gerenciador) => {
        await gerenciador.query("select set_config('app.tenant_id', $1, true)", [tenant.id]);
        const lote: LinhaLegada[] = await gerenciador.query(`
          select id, metadados, detalhes_criptografados as "detalhesCriptografados"
          from consentimentos_lgpd
          where tenant_id = $1
            and tipo in ('solicitacao_lgpd_retificacao', 'solicitacao_lgpd_exclusao', 'tratativa_lgpd')
            and metadados ? 'detalhes'
          order by id
          limit 100
          for update
        `, [tenant.id]);

        for (const evento of lote) {
          const legado = evento.metadados?.detalhes;
          if (legado !== null && legado !== undefined && typeof legado !== 'string') {
            throw new Error('Detalhe LGPD legado tem formato inesperado; interrompa para investigar.');
          }
          const texto = typeof legado === 'string' ? legado.trim() : '';
          const cifrado = evento.detalhesCriptografados ?? (texto ? criptografia.criptografar(texto) : null);
          if (texto && (!cifrado || criptografia.descriptografar(cifrado) !== texto)) {
            throw new Error('Verificacao da cifra de detalhe LGPD falhou.');
          }
          await gerenciador.query(`
            update consentimentos_lgpd
            set detalhes_criptografados = $3, metadados = metadados - 'detalhes'
            where tenant_id = $1 and id = $2 and metadados ? 'detalhes'
          `, [tenant.id, evento.id, cifrado]);
        }
        return lote.length;
      });
      if (quantidade === 0) break;
      convertidos += quantidade;
    }
    const [residual] = await fonte.transaction(async (gerenciador) => {
      await gerenciador.query("select set_config('app.tenant_id', $1, true)", [tenant.id]);
      return gerenciador.query(`
        select count(*)::int as total from consentimentos_lgpd
        where tenant_id = $1 and metadados ? 'detalhes'
          and tipo in ('solicitacao_lgpd_retificacao', 'solicitacao_lgpd_exclusao', 'tratativa_lgpd')
      `, [tenant.id]);
    });
    if (residual?.total !== 0) throw new Error('Ainda existem detalhes LGPD legados; reexecute o backfill.');
  }
  console.log(`Backfill LGPD concluido em ${banco}: ${convertidos} eventos convertidos em ${tenants.length} tenants.`);
  return { convertidos, tenants: tenants.length };
}

if (require.main === module) {
  executar()
    .catch(() => { console.error('Backfill LGPD falhou. Verifique alvo, role, chave e dados sem imprimir conteudo protegido.'); process.exitCode = 1; })
    .finally(async () => { if (fonteDados.isInitialized) await fonteDados.destroy(); });
}
