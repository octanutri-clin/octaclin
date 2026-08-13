import 'dotenv/config';
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CategoriaPerguntaOrm } from '../../modulos/questionarios/infraestrutura/categoria-pergunta.orm';
import { ProfissionalOrm } from '../../modulos/profissionais/infraestrutura/profissional.orm';
import { TenantConfiguracaoOrm } from '../../modulos/tenancy/infraestrutura/tenant-configuracao.orm';
import { TenantOrm } from '../../modulos/tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../modulos/usuarios/infraestrutura/usuario.orm';
import { CriptografiaDadosSensiveis } from '../seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../seguranca/servico-senhas';
import { validarAlvoStagingE2E, validarNomeRoleRuntime } from './alvo-staging-e2e';

interface FixtureTenantE2E {
  id: string;
  nome: string;
  slug: string;
  usuarios: Array<{ id: string; email: string; role: UsuarioOrm['role'] }>;
  profissional: {
    id: string;
    usuarioId: string;
    nome: string;
    registroProfissional: string;
    especialidade: string;
  };
  categoria: { id: string; nome: string; iconeSvg: string; corHex: string };
}

interface FixtureStagingE2E {
  senhaPadrao: string;
  tenants: FixtureTenantE2E[];
}

function carregarFixture(): FixtureStagingE2E {
  const caminho = join(__dirname, '..', 'banco-dados', 'seeds', 'staging-e2e-fixtures.json');
  return JSON.parse(readFileSync(caminho, 'utf8')) as FixtureStagingE2E;
}

async function executar() {
  const ownerUrl = process.env.E2E_DATABASE_OWNER_URL;
  const alvo = validarAlvoStagingE2E(
    ownerUrl,
    process.env.E2E_CONFIRMAR_BANCO,
    process.env.E2E_CONFIRMAR_REMOTO === 'SIM'
  );
  const runtimeRole = validarNomeRoleRuntime(process.env.E2E_RUNTIME_ROLE);

  process.env.DATABASE_URL = ownerUrl;
  process.env.BANCO_EXECUTAR_MIGRACOES = 'false';
  const { fonteDados } = await import('../banco-dados/fonte-dados');

  try {
    await fonteDados.initialize();
    const papeis = (await fonteDados.query(
      `select rolname, rolsuper, rolbypassrls
         from pg_roles
        where rolname in (current_user, $1)`,
      [runtimeRole]
    )) as Array<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>;
    const papelOwner = papeis.find((papel) => papel.rolname !== runtimeRole);
    const papelRuntime = papeis.find((papel) => papel.rolname === runtimeRole);
    if (!papelOwner?.rolbypassrls) {
      throw new Error('Bootstrap E2E exige uma role owner com BYPASSRLS.');
    }
    if (!papelRuntime || papelRuntime.rolsuper || papelRuntime.rolbypassrls) {
      throw new Error('Role runtime E2E ausente ou capaz de contornar RLS.');
    }

    const roleSql = `"${runtimeRole}"`;
    await fonteDados.query(`grant usage on schema public to ${roleSql}`);
    await fonteDados.query(`grant select, insert, update, delete on all tables in schema public to ${roleSql}`);
    await fonteDados.query(`grant usage, select on all sequences in schema public to ${roleSql}`);
    await fonteDados.query(
      `alter default privileges in schema public grant select, insert, update, delete on tables to ${roleSql}`
    );
    await fonteDados.query(`alter default privileges in schema public grant usage, select on sequences to ${roleSql}`);

    const fixture = carregarFixture();
    const criptografia = new CriptografiaDadosSensiveis();
    const senhas = new ServicoSenhas();
    const senhaHash = senhas.gerarHash(fixture.senhaPadrao);

    for (const tenant of fixture.tenants) {
      await fonteDados.getRepository(TenantOrm).save(
        fonteDados.getRepository(TenantOrm).create({
          id: tenant.id,
          nome: tenant.nome,
          slug: tenant.slug,
          status: 'ativo'
        })
      );

      await fonteDados.transaction(async (gerenciador) => {
        await gerenciador.query("select set_config('app.tenant_id', $1, true)", [tenant.id]);
        await gerenciador.getRepository(UsuarioOrm).save(
          tenant.usuarios.map((usuario) =>
            gerenciador.getRepository(UsuarioOrm).create({
              id: usuario.id,
              tenantId: tenant.id,
              emailHash: criptografia.gerarHashBusca(usuario.email),
              emailCriptografado: criptografia.criptografar(usuario.email),
              senhaHash,
              role: usuario.role,
              ativo: true
            })
          )
        );
        await gerenciador.getRepository(ProfissionalOrm).save(
          gerenciador.getRepository(ProfissionalOrm).create({
            id: tenant.profissional.id,
            tenantId: tenant.id,
            usuarioId: tenant.profissional.usuarioId,
            nomeCriptografado: criptografia.criptografar(tenant.profissional.nome),
            registroProfissional: tenant.profissional.registroProfissional,
            especialidade: tenant.profissional.especialidade
          })
        );
        await gerenciador.getRepository(CategoriaPerguntaOrm).save(
          gerenciador.getRepository(CategoriaPerguntaOrm).create({
            id: tenant.categoria.id,
            tenantId: tenant.id,
            nome: tenant.categoria.nome,
            iconeSvg: tenant.categoria.iconeSvg,
            corHex: tenant.categoria.corHex,
            ordem: 1
          })
        );
        await gerenciador.getRepository(TenantConfiguracaoOrm).upsert(
          {
            tenantId: tenant.id,
            chave: 'plano_saas',
            valor: { plano: 'clinica', status: 'ativa', origem: 'fase_231_e2e' }
          },
          { conflictPaths: ['tenantId', 'chave'] }
        );
      });
    }

    console.log(
      JSON.stringify({
        fase: 231,
        banco: alvo.banco,
        remoto: alvo.remoto,
        ownerComBypassRls: true,
        runtimeRole,
        runtimeSemBypassRls: true,
        tenantsSinteticos: fixture.tenants.map((tenant) => tenant.slug)
      })
    );
  } finally {
    delete process.env.DATABASE_URL;
    if (fonteDados.isInitialized) await fonteDados.destroy();
  }
}

if (require.main === module) {
  executar().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  });
}
