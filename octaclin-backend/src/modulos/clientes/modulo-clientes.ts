import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ConsentimentoLgpdOrm } from '../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ModuloAuth } from '../auth/modulo-auth';
import { TokenRedefinicaoSenhaOrm } from '../auth/infraestrutura/token-redefinicao-senha.orm';
import { MensagemNotificacaoOrm } from '../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { ArquivoMidiaOrm } from '../mobile/infraestrutura/arquivo-midia.orm';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { QuestionarioOrm } from '../questionarios/infraestrutura/questionario.orm';
import { AdaptadorEmailSmtp } from '../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { TenantOrm } from '../tenancy/infraestrutura/tenant.orm';
import { TenantConfiguracaoOrm } from '../tenancy/infraestrutura/tenant-configuracao.orm';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { ProfissionalOrm } from '../profissionais/infraestrutura/profissional.orm';
import { ServicoPortalCliente } from './aplicacao/servico-portal-cliente';
import { ServicoLembretesAcompanhamento } from './aplicacao/servico-lembretes-acompanhamento';
import { ServicoPainelOperacao } from './aplicacao/servico-painel-operacao';
import { ServicoUsuariosCliente } from './aplicacao/servico-usuarios-cliente';
import { ControladorPortalCliente } from './apresentacao/controlador-portal-cliente';
import { ControladorLembretesAcompanhamento } from './apresentacao/controlador-lembretes-acompanhamento';
import { ControladorAuditoriaCliente } from './apresentacao/controlador-auditoria-cliente';
import { ServicoAuditoriaCliente } from './aplicacao/servico-auditoria-cliente';
import { ServicoLgpdCliente } from './aplicacao/servico-lgpd-cliente';
import { ControladorLgpdCliente } from './apresentacao/controlador-lgpd-cliente';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantOrm,
      TenantConfiguracaoOrm,
      UsuarioOrm,
      ProfissionalOrm,
      TokenRedefinicaoSenhaOrm,
      UserActionLogOrm,
      ConsentimentoLgpdOrm,
      PacienteOrm,
      MensagemNotificacaoOrm,
      QuestionarioOrm,
      ArquivoMidiaOrm
    ]),
    ModuloAuth,
    ModuloTenancy
  ],
  controllers: [ControladorPortalCliente, ControladorAuditoriaCliente, ControladorLembretesAcompanhamento, ControladorLgpdCliente],
  providers: [ServicoPortalCliente, ServicoLembretesAcompanhamento, ServicoAuditoriaCliente, ServicoLgpdCliente, ServicoPainelOperacao, ServicoUsuariosCliente, ServicoAuditoria, AdaptadorEmailSmtp, CriptografiaDadosSensiveis],
  exports: [ServicoPortalCliente, ServicoLembretesAcompanhamento, ServicoUsuariosCliente]
})
export class ModuloClientes {}
