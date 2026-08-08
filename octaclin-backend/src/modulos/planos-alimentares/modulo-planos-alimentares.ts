import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ModuloAuth } from '../auth/modulo-auth';
import { AvaliacaoAntropometricaOrm } from '../pacientes/infraestrutura/avaliacao-antropometrica.orm';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../profissionais/infraestrutura/profissional.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoPlanosAlimentares } from './aplicacao/servico-planos-alimentares';
import {
  ControladorCatalogoAlimentos,
  ControladorPlanosAlimentares
} from './apresentacao/controlador-planos-alimentares';
import { AlimentoComposicaoOrm } from './infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from './infraestrutura/fonte-composicao-alimento.orm';
import { PlanoAlimentarItemOrm } from './infraestrutura/plano-alimentar-item.orm';
import { PlanoAlimentarRefeicaoOrm } from './infraestrutura/plano-alimentar-refeicao.orm';
import { PlanoAlimentarSubstituicaoOrm } from './infraestrutura/plano-alimentar-substituicao.orm';
import { PlanoAlimentarVersaoOrm } from './infraestrutura/plano-alimentar-versao.orm';
import { PlanoAlimentarOrm } from './infraestrutura/plano-alimentar.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanoAlimentarOrm,
      PlanoAlimentarVersaoOrm,
      PlanoAlimentarRefeicaoOrm,
      PlanoAlimentarItemOrm,
      PlanoAlimentarSubstituicaoOrm,
      FonteComposicaoAlimentoOrm,
      AlimentoComposicaoOrm,
      PacienteOrm,
      AvaliacaoAntropometricaOrm,
      ProfissionalOrm,
      UserActionLogOrm
    ]),
    ModuloTenancy,
    ModuloAuth
  ],
  controllers: [ControladorPlanosAlimentares, ControladorCatalogoAlimentos],
  providers: [ServicoPlanosAlimentares, CriptografiaDadosSensiveis],
  exports: [ServicoPlanosAlimentares]
})
export class ModuloPlanosAlimentares {}
