import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloComunicacoes } from '../comunicacoes/modulo-comunicacoes';
import { criarConexaoRedis } from '../comunicacoes/aplicacao/configuracao-redis';
import { deveExecutarProcessadores } from '../../infraestrutura/processamento/papel-processo';
import { ServicoExclusaoProcessador } from '../../infraestrutura/processamento/servico-exclusao-processador';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../profissionais/infraestrutura/profissional.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ControladorAgenda } from './apresentacao/controlador-agenda';
import { ControladorFinanceiroAgenda } from './apresentacao/controlador-financeiro-agenda';
import { ServicoFinanceiroAgenda } from './aplicacao/servico-financeiro-agenda';
import { PacoteSessaoOrm } from './infraestrutura/pacote-sessao.orm';
import { ControladorAgendamentoPublico } from './apresentacao/controlador-agendamento-publico';
import { ControladorGoogleAgenda } from './apresentacao/controlador-google-agenda';
import { ServicoAgendamentoPublico } from './aplicacao/servico-agendamento-publico';
import { ServicoAgenda } from './aplicacao/servico-agenda';
import { REDIS_OAUTH_STATE_GOOGLE, ServicoConexaoGoogleCalendar } from './aplicacao/servico-conexao-google-calendar';
import { ServicoGoogleCalendar } from './aplicacao/servico-google-calendar';
import { FILA_SINCRONIZACAO_GOOGLE, ServicoSincronizacaoGoogleCalendar } from './aplicacao/servico-sincronizacao-google-calendar';
import { ProcessadorSincronizacaoGoogleCalendar } from './aplicacao/processador-sincronizacao-google-calendar';
import { ProcessadorRenovacaoGoogleCalendar } from './aplicacao/processador-renovacao-google-calendar';
import { AgendaConsultaOrm } from './infraestrutura/agenda-consulta.orm';
import { AgendaBloqueioExternoOrm } from './infraestrutura/agenda-bloqueio-externo.orm';
import { AgendaBloqueioManualOrm } from './infraestrutura/agenda-bloqueio-manual.orm';
import { AgendaLinkPublicoOrm } from './infraestrutura/agenda-link-publico.orm';
import { AgendaSolicitacaoOrm } from './infraestrutura/agenda-solicitacao.orm';
import { GoogleCanalWatchOrm } from './infraestrutura/google-canal-watch.orm';
import { ProfissionalGoogleConexaoOrm } from './infraestrutura/profissional-google-conexao.orm';

const processadores = deveExecutarProcessadores()
  ? [ServicoSincronizacaoGoogleCalendar, ProcessadorSincronizacaoGoogleCalendar, ProcessadorRenovacaoGoogleCalendar]
  : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgendaConsultaOrm,
      PacienteOrm,
      ProfissionalOrm,
      UserActionLogOrm,
      ProfissionalGoogleConexaoOrm,
      GoogleCanalWatchOrm,
      AgendaBloqueioExternoOrm,
      AgendaBloqueioManualOrm,
      AgendaLinkPublicoOrm,
      AgendaSolicitacaoOrm,
      PacoteSessaoOrm
    ]),
    BullModule.registerQueue({ name: FILA_SINCRONIZACAO_GOOGLE }),
    ModuloAuth,
    ModuloTenancy,
    ModuloComunicacoes
  ],
  controllers: [
    ControladorAgenda,
    ControladorFinanceiroAgenda,
    ControladorAgendamentoPublico,
    ControladorGoogleAgenda
  ],
  providers: [
    ServicoAgenda,
    ServicoFinanceiroAgenda,
    ServicoAgendamentoPublico,
    ServicoGoogleCalendar,
    ServicoConexaoGoogleCalendar,
    { provide: REDIS_OAUTH_STATE_GOOGLE, useFactory: () => new Redis(criarConexaoRedis()) },
    ServicoExclusaoProcessador,
    ...processadores,
    ServicoAuditoria,
    CriptografiaDadosSensiveis
  ],
  exports: [ServicoAgenda]
})
export class ModuloAgenda {}
