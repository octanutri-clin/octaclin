import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { CriarFundacaoOctaClin1720000000000 } from './migracoes/1720000000000-CriarFundacaoOctaClin';
import { CriarAgendaConsultas1720000000100 } from './migracoes/1720000000100-CriarAgendaConsultas';
import { CriarConvitesPacienteAcesso1720000000200 } from './migracoes/1720000000200-CriarConvitesPacienteAcesso';
import { CriarTokensRedefinicaoSenha1720000000300 } from './migracoes/1720000000300-CriarTokensRedefinicaoSenha';
import { CriarEvolucoesClinicas1720000000400 } from './migracoes/1720000000400-CriarEvolucoesClinicas';
import { CriarAcompanhamentoTarefas1720000000500 } from './migracoes/1720000000500-CriarAcompanhamentoTarefas';
import { CriarMateriaisEducativos1720000000600 } from './migracoes/1720000000600-CriarMateriaisEducativos';
import { CorrigeConstraintRoleUsuarios1720000000700 } from './migracoes/1720000000700-CorrigeConstraintRoleUsuarios';
import { CriarSincronizacaoGoogleAgenda1720000000800 } from './migracoes/1720000000800-CriarSincronizacaoGoogleAgenda';
import { AdicionaTokenCanalWatchGoogleAgenda1720000000900 } from './migracoes/1720000000900-AdicionaTokenCanalWatchGoogleAgenda';
import { AdicionaContadorFalhasSincronizacaoGoogleAgenda1720000000901 } from './migracoes/1720000000901-AdicionaContadorFalhasSincronizacaoGoogleAgenda';
import { ForcaRenovacaoCanaisWatchSemToken1720000000902 } from './migracoes/1720000000902-ForcaRenovacaoCanaisWatchSemToken';
import { CriarAgendamentoPublico1720000001000 } from './migracoes/1720000001000-CriarAgendamentoPublico';
import { CorrigeAgendamentoPublicoPosMigracaoInicial1720000001001 } from './migracoes/1720000001001-CorrigeAgendamentoPublicoPosMigracaoInicial';
import { AdicionarDesfechosConsultaAgenda1720000001002 } from './migracoes/1720000001002-AdicionarDesfechosConsultaAgenda';
import { AdicionarRevisaoClinicaEnviosQuestionario1720000001003 } from './migracoes/1720000001003-AdicionarRevisaoClinicaEnviosQuestionario';
import { CriarAlertasOcultosDashboardClinico1720000001004 } from './migracoes/1720000001004-CriarAlertasOcultosDashboardClinico';
import { ProtegerCanaisWatchGoogleAgenda1720000001005 } from './migracoes/1720000001005-ProtegerCanaisWatchGoogleAgenda';
import { CriarBloqueiosManuaisAgenda1720000001006 } from './migracoes/1720000001006-CriarBloqueiosManuaisAgenda';
import { AdicionarSnapshotEstruturaEnviosQuestionario1720000001007 } from './migracoes/1720000001007-AdicionarSnapshotEstruturaEnviosQuestionario';
import { AdicionarBibliotecaPerguntas1720000001008 } from './migracoes/1720000001008-AdicionarBibliotecaPerguntas';
import { VincularAgendamentoQuestionarioPaciente1720000001009 } from './migracoes/1720000001009-VincularAgendamentoQuestionarioPaciente';
import { AdicionarRascunhoEnviosQuestionario1720000001010 } from './migracoes/1720000001010-AdicionarRascunhoEnviosQuestionario';
import { AdicionarRevisaoHumanaIa1720000001011 } from './migracoes/1720000001011-AdicionarRevisaoHumanaIa';
import { IsolarIdempotenciaMobilePorPaciente1720000001012 } from './migracoes/1720000001012-IsolarIdempotenciaMobilePorPaciente';
import { AdicionarIndiceBuscaPacientes1720000001013 } from './migracoes/1720000001013-AdicionarIndiceBuscaPacientes';
import { ProtegerArquivosMidia1720000001014 } from './migracoes/1720000001014-ProtegerArquivosMidia';
import { AdicionarTeleconsultaAgenda1720000001015 } from './migracoes/1720000001015-AdicionarTeleconsultaAgenda';
import { CriarAvaliacoesAntropometricas1720000001016 } from './migracoes/1720000001016-CriarAvaliacoesAntropometricas';
import { UserActionLogOrm } from '../auditoria/user-action-log.orm';
import { ConsentimentoLgpdOrm } from '../lgpd/consentimento-lgpd.orm';
import { OutboxEventoOrm } from '../outbox/outbox-evento.orm';
import { AgendaConsultaOrm } from '../../modulos/agenda/infraestrutura/agenda-consulta.orm';
import { AgendaBloqueioExternoOrm } from '../../modulos/agenda/infraestrutura/agenda-bloqueio-externo.orm';
import { AgendaBloqueioManualOrm } from '../../modulos/agenda/infraestrutura/agenda-bloqueio-manual.orm';
import { AgendaLinkPublicoOrm } from '../../modulos/agenda/infraestrutura/agenda-link-publico.orm';
import { AgendaSolicitacaoOrm } from '../../modulos/agenda/infraestrutura/agenda-solicitacao.orm';
import { GoogleCanalWatchOrm } from '../../modulos/agenda/infraestrutura/google-canal-watch.orm';
import { ProfissionalGoogleConexaoOrm } from '../../modulos/agenda/infraestrutura/profissional-google-conexao.orm';
import { RefreshTokenOrm } from '../../modulos/auth/infraestrutura/refresh-token.orm';
import { TokenRedefinicaoSenhaOrm } from '../../modulos/auth/infraestrutura/token-redefinicao-senha.orm';
import { CanalNotificacaoOrm } from '../../modulos/comunicacoes/infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../../modulos/comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../../modulos/comunicacoes/infraestrutura/template-mensagem.orm';
import { ExecucaoRegraOrm } from '../../modulos/automacoes/infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../../modulos/automacoes/infraestrutura/regra-automacao.orm';
import { AnaliseSentimentoOrm } from '../../modulos/ia/infraestrutura/analise-sentimento.orm';
import { ReconhecimentoAlimentarOrm } from '../../modulos/ia/infraestrutura/reconhecimento-alimentar.orm';
import { EnvioMaterialPacienteOrm } from '../../modulos/materiais/infraestrutura/envio-material-paciente.orm';
import { MaterialEducativoOrm } from '../../modulos/materiais/infraestrutura/material-educativo.orm';
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
import { ConvitePacienteOrm } from '../../modulos/pacientes/infraestrutura/convite-paciente.orm';
import { AcompanhamentoTarefaOrm } from '../../modulos/pacientes/infraestrutura/acompanhamento-tarefa.orm';
import { EvolucaoClinicaOrm } from '../../modulos/pacientes/infraestrutura/evolucao-clinica.orm';
import { AvaliacaoAntropometricaOrm } from '../../modulos/pacientes/infraestrutura/avaliacao-antropometrica.orm';
import { PacienteOrm } from '../../modulos/pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../modulos/profissionais/infraestrutura/profissional.orm';
import { AgendamentoQuestionarioOrm } from '../../modulos/questionarios/infraestrutura/agendamento-questionario.orm';
import { CategoriaPerguntaOrm } from '../../modulos/questionarios/infraestrutura/categoria-pergunta.orm';
import { EnvioQuestionarioOrm } from '../../modulos/questionarios/infraestrutura/envio-questionario.orm';
import { OpcaoPerguntaOrm } from '../../modulos/questionarios/infraestrutura/opcao-pergunta.orm';
import { PerguntaOrm } from '../../modulos/questionarios/infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../../modulos/questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../../modulos/questionarios/infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../../modulos/questionarios/infraestrutura/resposta-valor.orm';
import { TenantConfiguracaoOrm } from '../../modulos/tenancy/infraestrutura/tenant-configuracao.orm';
import { TenantOrm } from '../../modulos/tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../modulos/usuarios/infraestrutura/usuario.orm';
import { DashboardAlertaOcultoOrm } from '../../modulos/dashboard/infraestrutura/dashboard-alerta-oculto.orm';

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
      TenantConfiguracaoOrm,
      UsuarioOrm,
      RefreshTokenOrm,
      TokenRedefinicaoSenhaOrm,
      ConsentimentoLgpdOrm,
      ProfissionalOrm,
      PacienteOrm,
      ConvitePacienteOrm,
      AcompanhamentoTarefaOrm,
      EvolucaoClinicaOrm,
      AvaliacaoAntropometricaOrm,
      CategoriaPerguntaOrm,
      QuestionarioOrm,
      PerguntaOrm,
      OpcaoPerguntaOrm,
      AgendamentoQuestionarioOrm,
      EnvioQuestionarioOrm,
      RespostaCheckinOrm,
      RespostaValorOrm,
      CanalNotificacaoOrm,
      TemplateMensagemOrm,
      MensagemNotificacaoOrm,
      AgendaConsultaOrm,
      ProfissionalGoogleConexaoOrm,
      GoogleCanalWatchOrm,
      AgendaBloqueioExternoOrm,
      AgendaBloqueioManualOrm,
      AgendaLinkPublicoOrm,
      AgendaSolicitacaoOrm,
      RegraAutomacaoOrm,
      ExecucaoRegraOrm,
      AnaliseSentimentoOrm,
      ReconhecimentoAlimentarOrm,
      MaterialEducativoOrm,
      EnvioMaterialPacienteOrm,
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
      DashboardAlertaOcultoOrm,
      UserActionLogOrm,
      OutboxEventoOrm
    ],
    migrations: [
      CriarFundacaoOctaClin1720000000000,
      CriarAgendaConsultas1720000000100,
      CriarConvitesPacienteAcesso1720000000200,
      CriarTokensRedefinicaoSenha1720000000300,
      CriarEvolucoesClinicas1720000000400,
      CriarAcompanhamentoTarefas1720000000500,
      CriarMateriaisEducativos1720000000600,
      CorrigeConstraintRoleUsuarios1720000000700,
      CriarSincronizacaoGoogleAgenda1720000000800,
      AdicionaTokenCanalWatchGoogleAgenda1720000000900,
      AdicionaContadorFalhasSincronizacaoGoogleAgenda1720000000901,
      ForcaRenovacaoCanaisWatchSemToken1720000000902,
      CriarAgendamentoPublico1720000001000,
      CorrigeAgendamentoPublicoPosMigracaoInicial1720000001001,
      AdicionarDesfechosConsultaAgenda1720000001002,
      AdicionarRevisaoClinicaEnviosQuestionario1720000001003,
      CriarAlertasOcultosDashboardClinico1720000001004,
      ProtegerCanaisWatchGoogleAgenda1720000001005,
      CriarBloqueiosManuaisAgenda1720000001006,
      AdicionarSnapshotEstruturaEnviosQuestionario1720000001007,
      AdicionarBibliotecaPerguntas1720000001008,
      VincularAgendamentoQuestionarioPaciente1720000001009,
      AdicionarRascunhoEnviosQuestionario1720000001010,
      AdicionarRevisaoHumanaIa1720000001011,
      IsolarIdempotenciaMobilePorPaciente1720000001012,
      AdicionarIndiceBuscaPacientes1720000001013,
      ProtegerArquivosMidia1720000001014,
      AdicionarTeleconsultaAgenda1720000001015,
      CriarAvaliacoesAntropometricas1720000001016
    ],
    migrationsRun: process.env.BANCO_EXECUTAR_MIGRACOES !== 'false',
    synchronize: false,
    logging: process.env.NODE_ENV !== 'production'
  };
}
