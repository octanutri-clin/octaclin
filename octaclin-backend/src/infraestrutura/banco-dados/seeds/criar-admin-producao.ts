import 'reflect-metadata';
import { fonteDados } from '../fonte-dados';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../seguranca/servico-senhas';
import { TenantOrm } from '../../../modulos/tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../../modulos/usuarios/infraestrutura/usuario.orm';

function exigirVariavel(nome: string): string {
  const valor = process.env[nome];
  if (!valor || !valor.trim()) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${nome}`);
  }
  return valor.trim();
}

async function executar() {
  const tenantNome = exigirVariavel('TENANT_NOME');
  const tenantSlug = exigirVariavel('TENANT_SLUG');
  const adminEmail = exigirVariavel('ADMIN_EMAIL');
  const adminSenha = exigirVariavel('ADMIN_SENHA');
  exigirVariavel('CRIPTOGRAFIA_CHAVE_AES_256');

  if (adminSenha.length < 8) {
    throw new Error('ADMIN_SENHA precisa ter pelo menos 8 caracteres.');
  }

  await fonteDados.initialize();

  const criptografia = new CriptografiaDadosSensiveis();
  const senhas = new ServicoSenhas();

  try {
    const repositorioTenants = fonteDados.getRepository(TenantOrm);

    const tenantExistente = await repositorioTenants.findOne({ where: { slug: tenantSlug } });
    if (tenantExistente) {
      throw new Error(`Ja existe um tenant com slug "${tenantSlug}". Escolha outro slug ou reutilize o tenant existente.`);
    }

    const emailHash = criptografia.gerarHashBusca(adminEmail);

    await fonteDados.transaction(async (gerenciador) => {
      const tenant = await gerenciador.getRepository(TenantOrm).save(
        gerenciador.getRepository(TenantOrm).create({
          nome: tenantNome,
          slug: tenantSlug,
          status: 'ativo'
        })
      );

      await gerenciador.query("select set_config('app.tenant_id', $1, true)", [tenant.id]);

      const repositorioUsuarios = gerenciador.getRepository(UsuarioOrm);
      const emailJaExiste = await gerenciador.query(
        'select 1 from usuarios where email_hash = $1 limit 1',
        [emailHash]
      );
      if (emailJaExiste.length > 0) {
        throw new Error(`Ja existe um usuario com o email informado.`);
      }

      const usuario = await repositorioUsuarios.save(
        repositorioUsuarios.create({
          tenantId: tenant.id,
          emailHash,
          emailCriptografado: criptografia.criptografar(adminEmail),
          senhaHash: senhas.gerarHash(adminSenha),
          role: 'SuperAdmin',
          ativo: true
        })
      );

      console.log('Admin de producao criado.');
      console.log(`Tenant: ${tenant.nome} (${tenant.slug}) - id ${tenant.id}`);
      console.log(`Usuario: ${adminEmail} - id ${usuario.id}`);
    });
  } finally {
    if (fonteDados.isInitialized) {
      await fonteDados.destroy();
    }
  }
}

executar().catch((erro) => {
  console.error('Falha ao criar admin de producao.');
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
