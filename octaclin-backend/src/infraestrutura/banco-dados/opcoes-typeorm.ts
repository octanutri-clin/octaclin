import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { CriarFundacaoOctaClin1720000000000 } from './migracoes/1720000000000-CriarFundacaoOctaClin';
import { CriarAgendaConsultas1720000000100 } from './migracoes/1720000000100-CriarAgendaConsultas';
import { UserActionLogOrm } from '../auditoria/user-action-log.orm';
import { OutboxEventoOrm } from '../outbox/outbox-evento.orm';
import { AgendaConsultaOrm } from '../../modulos/agenda/infraestrutura/agenda-consulta.orm';
import { RefreshTokenOrm } from '../../modulos/auth/infraestrutura/refresh-token.orm';
import { CanalNotificacaoOrm } from '../../modulos/comunicacoes/infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../../modulos/comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../../modulos/comunicacoes/infraestrutura/template-mensagem.orm';
import { ExecucaoRegraOrm } from '../../modulos/automacoes/infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../../modulos/automacoes/infraestrutura/regra-automacao.orm';
import { AnaliseSentimentoOrm } from '../../modulos/ia/infraestrutura/analise-sentimento.orm';
import { ReconhecimentoAlimentarOrm } from '../../modulos/ia/infraestrutura/reconhecimento-alimentar.orm';
import { BadgeOrm } from '../../modulos/gamificacao/infraestrutura/badge.orm';
import { CirculoPacientesOrm } from '../../modulos/gamificacao/infraestrutura/circulo-pacientes.orm';
import { DesafioOrm } from '../../modulos/gamificacao/infraestrutura/desafio.orm';
import { MembroCirculoOrm } from '../../modulos/gamificacao/infraestrutura/membro-circulo.orm';
import { ModeracaoPostOrm } from '../../modulos/gamificacao/infraestrutura/moderacao-post.orm';
import { PacienteBadgeOrm } from '../../modulos/gamificacao/infraestrutura/paciente-badge.orm';
import { ParticipacaoDesafioOrm } from '../../modulos/gamificacao/infraestrutura/participacao-desafio.orm';
import { PostComunidadeOrm } from '../../modulos/gamificacao/infraestrutura/post-comunidade.orm';
import { AcompanhanteOrm } from '../../modulos/mobile/infraestrutura/acompanhante.orm';
import { ArquivoMidiaOrm } from '../../modulos/mobile/infraestrutura/arquivo-midia.orm';
import { LogDiarioRapidoOrm } from '../../modulos/mobile/infraestrutura/log-diario-rapido.orm';
import { SincronizacaoMobileOrm } from '../../modulos/mobile/infraestrutura/sincronizacao-mobile.orm';
import { PacienteOrm } from '../../modulos/pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../modulos/profissionais/infraestrutura/profissional.orm';
import { AgendamentoQuestionarioOrm } from '../../modulos/questionarios/infraestrutura/agendamento-questionario.orm';
import { CategoriaPerguntaOrm } from '../../modulos/questionarios/infraestrutura/categoria-pergunta.orm';
import { EnvioQuestionarioOrm } from '../../modulos/questionarios/infraestrutura/envio-questionario.orm';
import { OpcaoPerguntaOrm } from '../../modulos/questionarios/infraestrutura/opcao-pergunta.orm';
import { PerguntaOrm } from '../../modulos/questionarios/infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../../modulos/questionarios/infraestrutura/questionario.orm';
import { TenantOrm } from '../../modulos/tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../modulos/usuarios/infraestrutura/usuario.orm';

function criarConexaoBanco() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    const sslMode = url.searchParams.get('sslmode');

    return {
      host: url.hostname,
      port: Number(url.port || 5432),
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, '')),
      ssl: process.env.BANCO_SSL === 'true' || sslMode === 'require' ? { rejectUnauthorized: false } : false
    };
  }

  return {
    host: process.env.BANCO_HOST ?? 'localhost',
    port: Number(process.env.BANCO_PORTA ?? 5432),
    username: process.env.BANCO_USUARIO ?? 'octaclin',
    password: process.env.BANCO_SENHA ?? 'octaclin_local',
    database: process.env.BANCO_NOME ?? 'octaclin',
    ssl: process.env.BANCO_SSL === 'true' ? { rejectUnauthorized: false } : false
  };
}

export function criarOpcoesTypeOrm(): TypeOrmModuleOptions & DataSourceOptions {
  const conexao = criarConexaoBanco();

  return {
    type: 'postgres',
    ...conexao,
    entities: [
      TenantOrm,
      UsuarioOrm,
      RefreshTokenOrm,
      ProfissionalOrm,
      PacienteOrm,
      CategoriaPerguntaOrm,
      QuestionarioOrm,
      PerguntaOrm,
      OpcaoPerguntaOrm,
      AgendamentoQuestionarioOrm,
      EnvioQuestionarioOrm,
      CanalNotificacaoOrm,
      TemplateMensagemOrm,
      MensagemNotificacaoOrm,
      AgendaConsultaOrm,
      RegraAutomacaoOrm,
      ExecucaoRegraOrm,
      AnaliseSentimentoOrm,
      ReconhecimentoAlimentarOrm,
      CirculoPacientesOrm,
      MembroCirculoOrm,
      PostComunidadeOrm,
      ModeracaoPostOrm,
      DesafioOrm,
      ParticipacaoDesafioOrm,
      BadgeOrm,
      PacienteBadgeOrm,
      LogDiarioRapidoOrm,
      ArquivoMidiaOrm,
      AcompanhanteOrm,
      SincronizacaoMobileOrm,
      UserActionLogOrm,
      OutboxEventoOrm
    ],
    migrations: [CriarFundacaoOctaClin1720000000000, CriarAgendaConsultas1720000000100],
    migrationsRun: process.env.BANCO_EXECUTAR_MIGRACOES !== 'false',
    synchronize: false,
    logging: process.env.NODE_ENV !== 'production'
  };
}
