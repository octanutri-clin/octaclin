import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessadorOutboxAuditoria } from '../../infraestrutura/auditoria/processador-outbox-auditoria';
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
import { ModuloMobile } from '../mobile/modulo-mobile';
import { AgendaConsultaOrm } from '../agenda/infraestrutura/agenda-consulta.orm';
import { MensagemNotificacaoOrm } from '../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { LogDiarioRapidoOrm } from '../mobile/infraestrutura/log-diario-rapido.orm';
import { ArquivoMidiaOrm } from '../mobile/infraestrutura/arquivo-midia.orm';
import { ServicoArmazenamentoObjetos } from '../../infraestrutura/armazenamento/servico-armazenamento-objetos';
import { PlanoAlimentarItemOrm } from '../planos-alimentares/infraestrutura/plano-alimentar-item.orm';
import { PlanoAlimentarRefeicaoOrm } from '../planos-alimentares/infraestrutura/plano-alimentar-refeicao.orm';
import { PlanoAlimentarEscolhaPacienteOrm } from '../planos-alimentares/infraestrutura/plano-alimentar-escolha-paciente.orm';
import { PlanoAlimentarSubstituicaoOrm } from '../planos-alimentares/infraestrutura/plano-alimentar-substituicao.orm';
import { PlanoAlimentarVersaoOrm } from '../planos-alimentares/infraestrutura/plano-alimentar-versao.orm';
import { PlanoAlimentarOrm } from '../planos-alimentares/infraestrutura/plano-alimentar.orm';
import { ProfissionalOrm } from '../profissionais/infraestrutura/profissional.orm';
import { EnvioQuestionarioOrm } from '../questionarios/infraestrutura/envio-questionario.orm';
import { PerguntaOrm } from '../questionarios/infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../questionarios/infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../questionarios/infraestrutura/resposta-valor.orm';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { ServicoConvitesPaciente } from './aplicacao/servico-convites-paciente';
import { ServicoDocumentosClinicos } from './aplicacao/servico-documentos-clinicos';
import { ServicoImportacaoPacientes } from './aplicacao/servico-importacao-pacientes';
import { ServicoPacientes } from './aplicacao/servico-pacientes';
import { ServicoPerfilCadastroPaciente } from './aplicacao/servico-perfil-cadastro-paciente';
import { ServicoDuplicidadePacientes } from './aplicacao/servico-duplicidade-pacientes';
import { ServicoExamesLaboratoriais } from './aplicacao/servico-exames-laboratoriais';
import { ServicoConsentimentosEvolucaoFotografica } from './aplicacao/servico-consentimentos-evolucao-fotografica';
import { ServicoEvolucoesFotograficas } from './aplicacao/servico-evolucoes-fotograficas';
import { ServicoCondutasTerapeuticas } from './aplicacao/servico-condutas-terapeuticas';
import { ServicoBibliotecaCondutas } from './aplicacao/servico-biblioteca-condutas';
import { ServicoFiltrosSalvosPacientes } from './aplicacao/servico-filtros-salvos-pacientes';
import { ServicoPortalPaciente } from './aplicacao/servico-portal-paciente';
import { ControladorConvitesPaciente } from './apresentacao/controlador-convites-paciente';
import { ControladorDocumentosClinicos } from './apresentacao/controlador-documentos-clinicos';
import { ControladorModelosEvolucaoClinica, ControladorPacientes } from './apresentacao/controlador-pacientes';
import { ControladorPerfilCadastroPaciente } from './apresentacao/controlador-perfil-cadastro-paciente';
import { ControladorExamesLaboratoriais } from './apresentacao/controlador-exames-laboratoriais';
import { ControladorConsentimentosEvolucaoFotografica } from './apresentacao/controlador-consentimentos-evolucao-fotografica';
import { ControladorEvolucoesFotograficas } from './apresentacao/controlador-evolucoes-fotograficas';
import {
  ControladorBibliotecaCondutas,
  ControladorCondutasTerapeuticas
} from './apresentacao/controlador-condutas-terapeuticas';
import { ControladorFiltrosSalvosPacientes } from './apresentacao/controlador-filtros-salvos-pacientes';
import { ControladorPortalPaciente } from './apresentacao/controlador-portal-paciente';
import { AcompanhamentoTarefaOrm } from './infraestrutura/acompanhamento-tarefa.orm';
import { ConvitePacienteOrm } from './infraestrutura/convite-paciente.orm';
import { EvolucaoClinicaOrm } from './infraestrutura/evolucao-clinica.orm';
import { ModeloEvolucaoClinicaOrm } from './infraestrutura/modelo-evolucao-clinica.orm';
import { AvaliacaoAntropometricaOrm } from './infraestrutura/avaliacao-antropometrica.orm';
import { DocumentoEmitidoOrm } from './infraestrutura/documento-emitido.orm';
import { PacienteOrm } from './infraestrutura/paciente.orm';
import { PerfilCadastroPacienteOrm } from './infraestrutura/perfil-cadastro-paciente.orm';
import { ConsentimentoEvolucaoFotograficaOrm } from './infraestrutura/consentimento-evolucao-fotografica.orm';
import { EvolucaoFotograficaOrm } from './infraestrutura/evolucao-fotografica.orm';
import { EvolucaoFotograficaArquivoOrm } from './infraestrutura/evolucao-fotografica-arquivo.orm';
import { CondutaTerapeuticaOrm } from './infraestrutura/conduta-terapeutica.orm';
import { BibliotecaCondutaOrm } from './infraestrutura/biblioteca-conduta.orm';
import { CondutaTerapeuticaVersaoOrm } from './infraestrutura/conduta-terapeutica-versao.orm';
import { FiltroSalvoPacienteOrm } from './infraestrutura/filtro-salvo-paciente.orm';
import { PrioridadeAcompanhamentoPacienteOrm } from './infraestrutura/prioridade-acompanhamento-paciente.orm';
import { PrioridadeAcompanhamentoHistoricoOrm } from './infraestrutura/prioridade-acompanhamento-historico.orm';
import { ServicoRecalculoPrioridadeAcompanhamento } from './aplicacao/servico-recalculo-prioridade-acompanhamento';
import { ServicoModelosEvolucaoClinica } from './aplicacao/servico-modelos-evolucao-clinica';
import { ProcessadorRecalculoPrioridadeAcompanhamento } from './aplicacao/processador-recalculo-prioridade-acompanhamento';
import { deveExecutarProcessadores } from '../../infraestrutura/processamento/papel-processo';

const processadores = deveExecutarProcessadores() ? [ProcessadorRecalculoPrioridadeAcompanhamento] : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PacienteOrm,
      PerfilCadastroPacienteOrm,
      ProfissionalOrm,
      ConvitePacienteOrm,
      AcompanhamentoTarefaOrm,
      EvolucaoClinicaOrm,
      ModeloEvolucaoClinicaOrm,
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
      LogDiarioRapidoOrm,
      PlanoAlimentarOrm,
      PlanoAlimentarVersaoOrm,
      PlanoAlimentarRefeicaoOrm,
      PlanoAlimentarItemOrm,
      PlanoAlimentarSubstituicaoOrm,
      PlanoAlimentarEscolhaPacienteOrm,
      ConsentimentoEvolucaoFotograficaOrm,
      EvolucaoFotograficaOrm,
      EvolucaoFotograficaArquivoOrm,
      ArquivoMidiaOrm,
      CondutaTerapeuticaOrm,
      BibliotecaCondutaOrm,
      CondutaTerapeuticaVersaoOrm,
      FiltroSalvoPacienteOrm,
      PrioridadeAcompanhamentoPacienteOrm,
      PrioridadeAcompanhamentoHistoricoOrm
    ]),
    ModuloTenancy,
    ModuloAuth,
    ModuloClientes,
    ModuloAgenda,
    ModuloComunicacoes,
    ModuloMobile
  ],
  controllers: [
    // ControladorFiltrosSalvosPacientes deve vir antes de ControladorPacientes:
    // ControladorPacientes declara @Get(':id') e o Express casaria
    // "filtros-salvos" com :id se este controlador viesse depois.
    ControladorFiltrosSalvosPacientes,
    ControladorPacientes,
    ControladorPerfilCadastroPaciente,
    ControladorExamesLaboratoriais,
    ControladorConsentimentosEvolucaoFotografica,
    ControladorEvolucoesFotograficas,
    ControladorCondutasTerapeuticas,
    ControladorBibliotecaCondutas,
    ControladorConvitesPaciente,
    ControladorPortalPaciente,
    ControladorDocumentosClinicos,
    ControladorModelosEvolucaoClinica
  ],
  providers: [
    ServicoPacientes,
    ServicoPerfilCadastroPaciente,
    ServicoDuplicidadePacientes,
    ServicoFiltrosSalvosPacientes,
    ServicoExamesLaboratoriais,
    ServicoConsentimentosEvolucaoFotografica,
    ServicoEvolucoesFotograficas,
    ServicoCondutasTerapeuticas,
    ServicoBibliotecaCondutas,
    ServicoArmazenamentoObjetos,
    ServicoImportacaoPacientes,
    ServicoConvitesPaciente,
    ServicoPortalPaciente,
    ServicoDocumentosClinicos,
    CriptografiaDadosSensiveis,
    ServicoSenhas,
    ServicoAuditoria,
    ProcessadorOutboxAuditoria,
    ServicoRecalculoPrioridadeAcompanhamento,
    ServicoModelosEvolucaoClinica,
    ...processadores
  ],
  exports: [ServicoPacientes, ServicoConvitesPaciente, ServicoPortalPaciente, ServicoDocumentosClinicos]
})
export class ModuloPacientes {}
