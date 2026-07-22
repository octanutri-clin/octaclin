import 'reflect-metadata';
import { fonteDados } from '../fonte-dados';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../seguranca/servico-senhas';
import { OutboxEventoOrm } from '../../outbox/outbox-evento.orm';
import { CanalNotificacaoOrm } from '../../../modulos/comunicacoes/infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../../../modulos/comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../../../modulos/comunicacoes/infraestrutura/template-mensagem.orm';
import { SincronizacaoMobileOrm } from '../../../modulos/mobile/infraestrutura/sincronizacao-mobile.orm';
import { PacienteOrm } from '../../../modulos/pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../../modulos/profissionais/infraestrutura/profissional.orm';
import { TenantOrm } from '../../../modulos/tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../../modulos/usuarios/infraestrutura/usuario.orm';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  usuarioCliente: '12121212-1212-4121-8121-121212121212',
  usuarioAdmin: '22222222-2222-4222-8222-222222222222',
  usuarioProfissional: '33333333-3333-4333-8333-333333333333',
  profissional: '44444444-4444-4444-8444-444444444444',
  usuarioPaciente: '55555555-5555-4555-8555-555555555555',
  paciente: '66666666-6666-4666-8666-666666666666',
  canalEmail: '77777777-7777-4777-8777-777777777777',
  templateEmail: '88888888-8888-4888-8888-888888888888',
  mensagemFalha: '99999999-9999-4999-8999-999999999999',
  outboxFalho: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  outboxPendente: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  syncDiario: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  syncAudio: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  syncErro: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
};

const credenciais = {
  tenantSlug: 'clinica-carla',
  clienteEmail: 'gestor@octaclin.local',
  adminEmail: 'admin@octaclin.local',
  profissionalEmail: 'dra.carla@example.com',
  pacienteEmail: 'paciente.demo@example.com',
  senha: 'OctaClin@123'
};

async function executarSeed() {
  await fonteDados.initialize();

  const criptografia = new CriptografiaDadosSensiveis();
  const senhas = new ServicoSenhas();

  await fonteDados.getRepository(TenantOrm).save(
    fonteDados.getRepository(TenantOrm).create({
      id: ids.tenant,
      nome: 'Clinica Carla Demo',
      slug: credenciais.tenantSlug,
      status: 'ativo'
    })
  );

  await fonteDados.transaction(async (gerenciador) => {
    await gerenciador.query("select set_config('app.tenant_id', $1, true)", [ids.tenant]);

    const repositorioUsuarios = gerenciador.getRepository(UsuarioOrm);
    const clienteEmailHash = criptografia.gerarHashBusca(credenciais.clienteEmail);
    const adminEmailHash = criptografia.gerarHashBusca(credenciais.adminEmail);
    const profissionalEmailHash = criptografia.gerarHashBusca(credenciais.profissionalEmail);
    const pacienteEmailHash = criptografia.gerarHashBusca(credenciais.pacienteEmail);

    await repositorioUsuarios.save([
      repositorioUsuarios.create({
        id: ids.usuarioCliente,
        tenantId: ids.tenant,
        emailHash: clienteEmailHash,
        emailCriptografado: criptografia.criptografar(credenciais.clienteEmail),
        senhaHash: senhas.gerarHash(credenciais.senha),
        role: 'Client',
        ativo: true
      }),
      repositorioUsuarios.create({
        id: ids.usuarioAdmin,
        tenantId: ids.tenant,
        emailHash: adminEmailHash,
        emailCriptografado: criptografia.criptografar(credenciais.adminEmail),
        senhaHash: senhas.gerarHash(credenciais.senha),
        role: 'SuperAdmin',
        ativo: true
      }),
      repositorioUsuarios.create({
        id: ids.usuarioProfissional,
        tenantId: ids.tenant,
        emailHash: profissionalEmailHash,
        emailCriptografado: criptografia.criptografar(credenciais.profissionalEmail),
        senhaHash: senhas.gerarHash(credenciais.senha),
        role: 'Professional',
        ativo: true
      }),
      repositorioUsuarios.create({
        id: ids.usuarioPaciente,
        tenantId: ids.tenant,
        emailHash: pacienteEmailHash,
        emailCriptografado: criptografia.criptografar(credenciais.pacienteEmail),
        senhaHash: senhas.gerarHash(credenciais.senha),
        role: 'Patient',
        ativo: true
      })
    ]);

    await gerenciador.getRepository(ProfissionalOrm).save(
      gerenciador.getRepository(ProfissionalOrm).create({
        id: ids.profissional,
        tenantId: ids.tenant,
        usuarioId: ids.usuarioProfissional,
        nomeCriptografado: criptografia.criptografar('Dra. Carla Monteiro'),
        registroProfissional: 'CRN-0000-DEMO',
        especialidade: 'Nutricao clinica'
      })
    );

    await gerenciador.getRepository(PacienteOrm).save(
      gerenciador.getRepository(PacienteOrm).create({
        id: ids.paciente,
        tenantId: ids.tenant,
        usuarioId: ids.usuarioPaciente,
        profissionalResponsavelId: ids.profissional,
        nomeCriptografado: criptografia.criptografar('Paciente Demo'),
        contatoCriptografado: criptografia.criptografar('+55 11 90000-0000'),
        dataNascimento: '1992-04-18',
        statusAdesao: 'em_acompanhamento',
        scoreRisco: '12.50',
        ultimoCheckinEm: new Date()
      })
    );

    await gerenciador.getRepository(CanalNotificacaoOrm).save(
      gerenciador.getRepository(CanalNotificacaoOrm).create({
        id: ids.canalEmail,
        tenantId: ids.tenant,
        tipo: 'email',
        nome: 'Email transacional demo',
        configuracao: { provedor: 'smtp', remetente: 'OctaClin <octaclinsys@gmail.com>' },
        ativo: true
      })
    );

    await gerenciador.getRepository(TemplateMensagemOrm).save(
      gerenciador.getRepository(TemplateMensagemOrm).create({
        id: ids.templateEmail,
        tenantId: ids.tenant,
        canal: 'email',
        codigoExterno: 'demo_checkin_diario',
        nome: 'Check-in diario demo',
        conteudo: {
          assunto: 'Como foi sua rotina hoje?',
          corpo: 'Responda seu diario rapido no OctaClin.'
        },
        aprovado: true
      })
    );

    await gerenciador.getRepository(MensagemNotificacaoOrm).save(
      gerenciador.getRepository(MensagemNotificacaoOrm).create({
        id: ids.mensagemFalha,
        tenantId: ids.tenant,
        pacienteId: ids.paciente,
        canalId: ids.canalEmail,
        templateId: ids.templateEmail,
        status: 'falhou',
        payload: { destino: credenciais.pacienteEmail, origem: 'seed-demo' },
        erro: 'Falha demo para testar reprocessamento operacional.'
      })
    );

    await gerenciador.getRepository(OutboxEventoOrm).save([
      gerenciador.getRepository(OutboxEventoOrm).create({
        id: ids.outboxFalho,
        tenantId: ids.tenant,
        tipo: 'notificacao.enviar',
        payload: { mensagemId: ids.mensagemFalha },
        status: 'falhou',
        tentativas: 5,
        erro: 'Redis indisponivel no seed demo.'
      }),
      gerenciador.getRepository(OutboxEventoOrm).create({
        id: ids.outboxPendente,
        tenantId: ids.tenant,
        tipo: 'notificacao.enviar',
        payload: { mensagemId: ids.mensagemFalha },
        status: 'pendente',
        tentativas: 0
      })
    ]);

    await gerenciador.getRepository(SincronizacaoMobileOrm).save([
      gerenciador.getRepository(SincronizacaoMobileOrm).create({
        id: ids.syncDiario,
        tenantId: ids.tenant,
        idLocal: 'local-demo-diario-001',
        tipo: 'diario_rapido',
        status: 'sincronizado',
        recursoTipo: 'diario_rapido',
        recursoId: ids.paciente
      }),
      gerenciador.getRepository(SincronizacaoMobileOrm).create({
        id: ids.syncAudio,
        tenantId: ids.tenant,
        idLocal: 'local-demo-audio-001',
        tipo: 'midia_audio',
        status: 'sincronizado',
        recursoTipo: 'arquivo_midia',
        recursoId: ids.paciente
      }),
      gerenciador.getRepository(SincronizacaoMobileOrm).create({
        id: ids.syncErro,
        tenantId: ids.tenant,
        idLocal: 'local-demo-erro-001',
        tipo: 'acompanhante',
        status: 'erro',
        erro: 'PIN invalido no envio offline demo.'
      })
    ]);
  });

  console.log('Seed demo OctaClin aplicado.');
  console.log(`Tenant: ${credenciais.tenantSlug}`);
  console.log(`Cliente: ${credenciais.clienteEmail}`);
  console.log(`SuperAdmin: ${credenciais.adminEmail}`);
  console.log(`Senha: ${credenciais.senha}`);
}

executarSeed()
  .catch((erro) => {
    console.error('Falha ao aplicar seed demo OctaClin.');
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (fonteDados.isInitialized) {
      await fonteDados.destroy();
    }
  });
