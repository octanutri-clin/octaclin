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
import { ModuloAgenda } from '../agenda/modulo-agenda';
import { ModuloComunicacoes } from '../comunicacoes/modulo-comunicacoes';
import { AgendaConsultaOrm } from '../agenda/infraestrutura/agenda-consulta.orm';
import { MensagemNotificacaoOrm } from '../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { LogDiarioRapidoOrm } from '../mobile/infraestrutura/log-diario-rapido.orm';
import { ProfissionalOrm } from '../profissionais/infraestrutura/profissional.orm';
import { EnvioQuestionarioOrm } from '../questionarios/infraestrutura/envio-questionario.orm';
import { PerguntaOrm } from '../questionarios/infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../questionarios/infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../questionarios/infraestrutura/resposta-valor.orm';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { ServicoConvitesPaciente } from './aplicacao/servico-convites-paciente';
import { ServicoDocumentosClinicos } from './aplicacao/servico-documentos-clinicos';
import { ServicoPacientes } from './aplicacao/servico-pacientes';
import { ServicoPortalPaciente } from './aplicacao/servico-portal-paciente';
import { ControladorConvitesPaciente } from './apresentacao/controlador-convites-paciente';
import { ControladorDocumentosClinicos } from './apresentacao/controlador-documentos-clinicos';
import { ControladorPacientes } from './apresentacao/controlador-pacientes';
import { ControladorPortalPaciente } from './apresentacao/controlador-portal-paciente';
import { AcompanhamentoTarefaOrm } from './infraestrutura/acompanhamento-tarefa.orm';
import { ConvitePacienteOrm } from './infraestrutura/convite-paciente.orm';
import { EvolucaoClinicaOrm } from './infraestrutura/evolucao-clinica.orm';
import { AvaliacaoAntropometricaOrm } from './infraestrutura/avaliacao-antropometrica.orm';
import { DocumentoEmitidoOrm } from './infraestrutura/documento-emitido.orm';
import { PacienteOrm } from './infraestrutura/paciente.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PacienteOrm,
      ProfissionalOrm,
      ConvitePacienteOrm,
      AcompanhamentoTarefaOrm,
      EvolucaoClinicaOrm,
      AvaliacaoAntropometricaOrm,
      DocumentoEmitidoOrm,
      UsuarioOrm,
      ConsentimentoLgpdOrm,
      UserActionLogOrm,
      AgendaConsultaOrm,
      EnvioQuestionarioOrm,
      PerguntaOrm,
      QuestionarioOrm,
      RespostaCheckinOrm,
      RespostaValorOrm,
      MensagemNotificacaoOrm,
      LogDiarioRapidoOrm
    ]),
    ModuloTenancy,
    ModuloAuth,
    ModuloClientes,
    ModuloAgenda,
    ModuloComunicacoes
  ],
  controllers: [
    ControladorPacientes,
    ControladorConvitesPaciente,
    ControladorPortalPaciente,
    ControladorDocumentosClinicos
  ],
  providers: [
    ServicoPacientes,
    ServicoConvitesPaciente,
    ServicoPortalPaciente,
    ServicoDocumentosClinicos,
    CriptografiaDadosSensiveis,
    ServicoSenhas,
    ServicoAuditoria
  ],
  exports: [ServicoPacientes, ServicoConvitesPaciente, ServicoPortalPaciente, ServicoDocumentosClinicos]
})
export class ModuloPacientes {}
