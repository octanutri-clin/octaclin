import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ConsentimentoLgpdOrm } from '../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../infraestrutura/seguranca/servico-senhas';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloClientes } from '../clientes/modulo-clientes';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { AgendaConsultaOrm } from '../agenda/infraestrutura/agenda-consulta.orm';
import { MensagemNotificacaoOrm } from '../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { EnvioQuestionarioOrm } from '../questionarios/infraestrutura/envio-questionario.orm';
import { PerguntaOrm } from '../questionarios/infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../questionarios/infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../questionarios/infraestrutura/resposta-valor.orm';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { ServicoConvitesPaciente } from './aplicacao/servico-convites-paciente';
import { ServicoPacientes } from './aplicacao/servico-pacientes';
import { ServicoPortalPaciente } from './aplicacao/servico-portal-paciente';
import { ControladorConvitesPaciente } from './apresentacao/controlador-convites-paciente';
import { ControladorPacientes } from './apresentacao/controlador-pacientes';
import { ControladorPortalPaciente } from './apresentacao/controlador-portal-paciente';
import { ConvitePacienteOrm } from './infraestrutura/convite-paciente.orm';
import { PacienteOrm } from './infraestrutura/paciente.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PacienteOrm,
      ConvitePacienteOrm,
      UsuarioOrm,
      ConsentimentoLgpdOrm,
      UserActionLogOrm,
      AgendaConsultaOrm,
      EnvioQuestionarioOrm,
      PerguntaOrm,
      QuestionarioOrm,
      RespostaCheckinOrm,
      RespostaValorOrm,
      MensagemNotificacaoOrm
    ]),
    ModuloTenancy,
    ModuloAuth,
    ModuloClientes
  ],
  controllers: [ControladorPacientes, ControladorConvitesPaciente, ControladorPortalPaciente],
  providers: [ServicoPacientes, ServicoConvitesPaciente, ServicoPortalPaciente, CriptografiaDadosSensiveis, ServicoSenhas, ServicoAuditoria],
  exports: [ServicoPacientes, ServicoConvitesPaciente, ServicoPortalPaciente]
})
export class ModuloPacientes {}
