import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fonteDados } from '../fonte-dados';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../seguranca/servico-senhas';
import { AgendaConsultaOrm } from '../../../modulos/agenda/infraestrutura/agenda-consulta.orm';
import { CanalNotificacaoOrm } from '../../../modulos/comunicacoes/infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../../../modulos/comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../../../modulos/comunicacoes/infraestrutura/template-mensagem.orm';
import { EnvioMaterialPacienteOrm } from '../../../modulos/materiais/infraestrutura/envio-material-paciente.orm';
import { MaterialEducativoOrm } from '../../../modulos/materiais/infraestrutura/material-educativo.orm';
import { AcompanhamentoTarefaOrm } from '../../../modulos/pacientes/infraestrutura/acompanhamento-tarefa.orm';
import { PacienteOrm } from '../../../modulos/pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../../modulos/profissionais/infraestrutura/profissional.orm';
import { TenantConfiguracaoOrm } from '../../../modulos/tenancy/infraestrutura/tenant-configuracao.orm';
import { TenantOrm } from '../../../modulos/tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../../modulos/usuarios/infraestrutura/usuario.orm';

interface FixtureStaging {
  tenant: { id: string; nome: string; slug: string };
  senhaPadrao: string;
  usuarios: Array<{ id: string; email: string; role: UsuarioOrm['role'] }>;
  profissionais: Array<{ id: string; usuarioId: string; nome: string; registroProfissional: string; especialidade: string }>;
  pacientes: Array<{
    id: string;
    usuarioId?: string;
    profissionalResponsavelId: string;
    nome: string;
    contato?: string;
    dataNascimento?: string;
    statusAdesao: string;
    scoreRisco: string;
    ultimoCheckinEm?: string;
  }>;
  canais: Array<{ id: string; tipo: 'email' | 'whatsapp'; nome: string; configuracao: Record<string, unknown> }>;
  templates: Array<{
    id: string;
    canal: 'email' | 'whatsapp';
    codigoExterno: string;
    nome: string;
    conteudo: Record<string, unknown>;
    aprovado: boolean;
  }>;
  agenda: Array<{
    id: string;
    pacienteId: string;
    profissionalId: string;
    titulo: string;
    inicioEm: string;
    fimEm: string;
    local?: string;
    notificacoes: Record<string, unknown>;
  }>;
  materiais: Array<{
    id: string;
    titulo: string;
    tipo: 'link' | 'pdf_url' | 'orientacao';
    categoria?: string;
    resumo?: string;
    url?: string;
    conteudo?: string;
  }>;
  enviosMaterial: Array<{
    id: string;
    pacienteId: string;
    materialId: string;
    observacao?: string;
    status: 'enviado' | 'visualizado' | 'arquivado';
    enviadoEm?: string;
    visualizadoEm?: string;
  }>;
  tarefas: Array<{
    id: string;
    pacienteId: string;
    profissionalId: string;
    titulo: string;
    descricao?: string;
    categoria: 'meta' | 'tarefa' | 'checkin' | 'orientacao';
    prioridade: 'baixa' | 'media' | 'alta';
    status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
    vencimentoEm?: string;
  }>;
  mensagens: Array<{
    id: string;
    pacienteId: string;
    canalId: string;
    templateId: string;
    status: MensagemNotificacaoOrm['status'];
    payload: Record<string, unknown>;
    enviadoEm?: string;
  }>;
  configuracoesTenant: Array<{ id: string; chave: string; valor: Record<string, unknown> }>;
}

function carregarFixture(): FixtureStaging {
  const caminho = join(__dirname, 'staging-fixtures.json');
  return JSON.parse(readFileSync(caminho, 'utf8')) as FixtureStaging;
}

function dataOpcional(valor?: string) {
  return valor ? new Date(valor) : undefined;
}

async function executarSeed() {
  const fixture = carregarFixture();
  await fonteDados.initialize();

  const criptografia = new CriptografiaDadosSensiveis();
  const senhas = new ServicoSenhas();
  const usuarioAutor = fixture.usuarios.find((usuario) => usuario.role === 'Professional') ?? fixture.usuarios[0];

  await fonteDados.getRepository(TenantOrm).save(
    fonteDados.getRepository(TenantOrm).create({
      id: fixture.tenant.id,
      nome: fixture.tenant.nome,
      slug: fixture.tenant.slug,
      status: 'ativo'
    })
  );

  await fonteDados.transaction(async (gerenciador) => {
    await gerenciador.query("select set_config('app.tenant_id', $1, true)", [fixture.tenant.id]);

    await gerenciador.getRepository(UsuarioOrm).save(
      fixture.usuarios.map((usuario) =>
        gerenciador.getRepository(UsuarioOrm).create({
          id: usuario.id,
          tenantId: fixture.tenant.id,
          emailHash: criptografia.gerarHashBusca(usuario.email),
          emailCriptografado: criptografia.criptografar(usuario.email),
          senhaHash: senhas.gerarHash(fixture.senhaPadrao),
          role: usuario.role,
          ativo: true
        })
      )
    );

    await gerenciador.getRepository(ProfissionalOrm).save(
      fixture.profissionais.map((profissional) =>
        gerenciador.getRepository(ProfissionalOrm).create({
          id: profissional.id,
          tenantId: fixture.tenant.id,
          usuarioId: profissional.usuarioId,
          nomeCriptografado: criptografia.criptografar(profissional.nome),
          registroProfissional: profissional.registroProfissional,
          especialidade: profissional.especialidade
        })
      )
    );

    await gerenciador.getRepository(PacienteOrm).save(
      fixture.pacientes.map((paciente) =>
        gerenciador.getRepository(PacienteOrm).create({
          id: paciente.id,
          tenantId: fixture.tenant.id,
          usuarioId: paciente.usuarioId,
          profissionalResponsavelId: paciente.profissionalResponsavelId,
          nomeCriptografado: criptografia.criptografar(paciente.nome),
          buscaHashes: criptografia.gerarHashesBuscaPii(fixture.tenant.id, [paciente.nome, paciente.contato]),
          contatoCriptografado: paciente.contato ? criptografia.criptografar(paciente.contato) : undefined,
          dataNascimento: paciente.dataNascimento,
          statusAdesao: paciente.statusAdesao,
          scoreRisco: paciente.scoreRisco,
          ultimoCheckinEm: dataOpcional(paciente.ultimoCheckinEm)
        })
      )
    );

    await gerenciador.getRepository(CanalNotificacaoOrm).save(
      fixture.canais.map((canal) =>
        gerenciador.getRepository(CanalNotificacaoOrm).create({
          id: canal.id,
          tenantId: fixture.tenant.id,
          tipo: canal.tipo,
          nome: canal.nome,
          configuracao: canal.configuracao,
          ativo: true
        })
      )
    );

    await gerenciador.getRepository(TemplateMensagemOrm).save(
      fixture.templates.map((template) =>
        gerenciador.getRepository(TemplateMensagemOrm).create({
          id: template.id,
          tenantId: fixture.tenant.id,
          canal: template.canal,
          codigoExterno: template.codigoExterno,
          nome: template.nome,
          conteudo: template.conteudo,
          aprovado: template.aprovado
        })
      )
    );

    await gerenciador.getRepository(AgendaConsultaOrm).save(
      fixture.agenda.map((consulta) =>
        gerenciador.getRepository(AgendaConsultaOrm).create({
          id: consulta.id,
          tenantId: fixture.tenant.id,
          pacienteId: consulta.pacienteId,
          profissionalId: consulta.profissionalId,
          titulo: consulta.titulo,
          inicioEm: new Date(consulta.inicioEm),
          fimEm: new Date(consulta.fimEm),
          timezone: 'America/Sao_Paulo',
          status: 'agendada',
          local: consulta.local,
          notificacoes: consulta.notificacoes,
          payload: { origem: 'seed_staging' }
        })
      )
    );

    await gerenciador.getRepository(MaterialEducativoOrm).save(
      fixture.materiais.map((material) =>
        gerenciador.getRepository(MaterialEducativoOrm).create({
          id: material.id,
          tenantId: fixture.tenant.id,
          criadoPorUsuarioId: usuarioAutor.id,
          titulo: material.titulo,
          tipo: material.tipo,
          categoria: material.categoria,
          resumo: material.resumo,
          url: material.url,
          conteudo: material.conteudo,
          ativo: true
        })
      )
    );

    await gerenciador.getRepository(EnvioMaterialPacienteOrm).save(
      fixture.enviosMaterial.map((envio) =>
        gerenciador.getRepository(EnvioMaterialPacienteOrm).create({
          id: envio.id,
          tenantId: fixture.tenant.id,
          pacienteId: envio.pacienteId,
          materialId: envio.materialId,
          enviadoPorUsuarioId: usuarioAutor.id,
          observacaoCriptografada: envio.observacao ? criptografia.criptografar(envio.observacao) : undefined,
          status: envio.status,
          enviadoEm: dataOpcional(envio.enviadoEm),
          visualizadoEm: dataOpcional(envio.visualizadoEm)
        })
      )
    );

    await gerenciador.getRepository(AcompanhamentoTarefaOrm).save(
      fixture.tarefas.map((tarefa) =>
        gerenciador.getRepository(AcompanhamentoTarefaOrm).create({
          id: tarefa.id,
          tenantId: fixture.tenant.id,
          pacienteId: tarefa.pacienteId,
          profissionalId: tarefa.profissionalId,
          titulo: tarefa.titulo,
          descricaoCriptografada: tarefa.descricao ? criptografia.criptografar(tarefa.descricao) : undefined,
          categoria: tarefa.categoria,
          prioridade: tarefa.prioridade,
          status: tarefa.status,
          vencimentoEm: dataOpcional(tarefa.vencimentoEm)
        })
      )
    );

    await gerenciador.getRepository(MensagemNotificacaoOrm).save(
      fixture.mensagens.map((mensagem) =>
        gerenciador.getRepository(MensagemNotificacaoOrm).create({
          id: mensagem.id,
          tenantId: fixture.tenant.id,
          pacienteId: mensagem.pacienteId,
          canalId: mensagem.canalId,
          templateId: mensagem.templateId,
          status: mensagem.status,
          payload: mensagem.payload,
          enviadoEm: dataOpcional(mensagem.enviadoEm)
        })
      )
    );

    await gerenciador.getRepository(TenantConfiguracaoOrm).save(
      fixture.configuracoesTenant.map((configuracao) =>
        gerenciador.getRepository(TenantConfiguracaoOrm).create({
          id: configuracao.id,
          tenantId: fixture.tenant.id,
          chave: configuracao.chave,
          valor: configuracao.valor
        })
      )
    );
  });

  console.log('Seed staging OctaClin aplicado.');
  console.log(`Tenant: ${fixture.tenant.slug}`);
  console.log(`Usuarios: ${fixture.usuarios.length}`);
  console.log(`Pacientes: ${fixture.pacientes.length}`);
  console.log('Dados ficticios: dominio @octaclin.test.');
}

executarSeed()
  .catch((erro) => {
    console.error('Falha ao aplicar seed staging OctaClin.');
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (fonteDados.isInitialized) {
      await fonteDados.destroy();
    }
  });
