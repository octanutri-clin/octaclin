import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { MensagemNotificacaoOrm } from '../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { OutboxEventoOrm } from '../../infraestrutura/outbox/outbox-evento.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { AvaliacaoAntropometricaOrm } from '../pacientes/infraestrutura/avaliacao-antropometrica.orm';
import { LogDiarioRapidoOrm } from '../mobile/infraestrutura/log-diario-rapido.orm';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../profissionais/infraestrutura/profissional.orm';
import { EnvioQuestionarioOrm } from '../questionarios/infraestrutura/envio-questionario.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoModelosPlanoAlimentar } from './aplicacao/servico-modelos-plano-alimentar';
import { ServicoPlanosAlimentares } from './aplicacao/servico-planos-alimentares';
import { ServicoReceitasNutricionais } from './aplicacao/servico-receitas-nutricionais';
import {
  ControladorCatalogoAlimentos,
  ControladorModelosPlanoAlimentar,
  ControladorPlanosAlimentares,
  ControladorReceitasNutricionais
} from './apresentacao/controlador-planos-alimentares';
import { AlimentoComposicaoOrm } from './infraestrutura/alimento-composicao.orm';
import { CatalogoComposicaoAlimentoOrm } from './infraestrutura/catalogo-composicao-alimento.orm';
import { FonteComposicaoAlimentoOrm } from './infraestrutura/fonte-composicao-alimento.orm';
import { PlanoAlimentarItemOrm } from './infraestrutura/plano-alimentar-item.orm';
import { PlanoAlimentarRefeicaoOrm } from './infraestrutura/plano-alimentar-refeicao.orm';
import { PlanoAlimentarEscolhaPacienteOrm } from './infraestrutura/plano-alimentar-escolha-paciente.orm';
import { PlanoAlimentarSubstituicaoOrm } from './infraestrutura/plano-alimentar-substituicao.orm';
import { PlanoAlimentarVersaoOrm } from './infraestrutura/plano-alimentar-versao.orm';
import { ModeloPlanoAlimentarOrm } from './infraestrutura/modelo-plano-alimentar.orm';
import { RevisaoModeloPlanoAlimentarOrm } from './infraestrutura/revisao-modelo-plano-alimentar.orm';
import { PlanoAlimentarOrm } from './infraestrutura/plano-alimentar.orm';
import { ReceitaNutricionalOrm } from './infraestrutura/receita-nutricional.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanoAlimentarOrm,
      PlanoAlimentarVersaoOrm,
      PlanoAlimentarRefeicaoOrm,
      PlanoAlimentarItemOrm,
      PlanoAlimentarSubstituicaoOrm,
      PlanoAlimentarEscolhaPacienteOrm,
      ModeloPlanoAlimentarOrm,
      RevisaoModeloPlanoAlimentarOrm,
      ReceitaNutricionalOrm,
      CatalogoComposicaoAlimentoOrm,
      FonteComposicaoAlimentoOrm,
      AlimentoComposicaoOrm,
      PacienteOrm,
      AvaliacaoAntropometricaOrm,
      LogDiarioRapidoOrm,
      EnvioQuestionarioOrm,
      ProfissionalOrm,
      UserActionLogOrm,
      MensagemNotificacaoOrm,
      OutboxEventoOrm
    ]),
    ModuloTenancy,
    ModuloAuth
  ],
  controllers: [
    ControladorPlanosAlimentares,
    ControladorCatalogoAlimentos,
    ControladorModelosPlanoAlimentar,
    ControladorReceitasNutricionais
  ],
  providers: [
    ServicoPlanosAlimentares,
    ServicoModelosPlanoAlimentar,
    ServicoReceitasNutricionais,
    CriptografiaDadosSensiveis
  ],
  exports: [ServicoPlanosAlimentares, ServicoModelosPlanoAlimentar, ServicoReceitasNutricionais]
})
export class ModuloPlanosAlimentares {}
