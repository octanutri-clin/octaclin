import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoGamificacao } from './aplicacao/servico-gamificacao';
import { ControladorGamificacao } from './apresentacao/controlador-gamificacao';
import { BadgeOrm } from './infraestrutura/badge.orm';
import { CirculoPacientesOrm } from './infraestrutura/circulo-pacientes.orm';
import { DesafioOrm } from './infraestrutura/desafio.orm';
import { MembroCirculoOrm } from './infraestrutura/membro-circulo.orm';
import { ModeracaoPostOrm } from './infraestrutura/moderacao-post.orm';
import { PacienteBadgeOrm } from './infraestrutura/paciente-badge.orm';
import { ParticipacaoDesafioOrm } from './infraestrutura/participacao-desafio.orm';
import { PostComunidadeOrm } from './infraestrutura/post-comunidade.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CirculoPacientesOrm,
      MembroCirculoOrm,
      PostComunidadeOrm,
      ModeracaoPostOrm,
      DesafioOrm,
      ParticipacaoDesafioOrm,
      BadgeOrm,
      PacienteBadgeOrm,
      UserActionLogOrm
    ]),
    ModuloAuth,
    ModuloTenancy
  ],
  controllers: [ControladorGamificacao],
  providers: [ServicoGamificacao, ServicoAuditoria],
  exports: [ServicoGamificacao]
})
export class ModuloGamificacao {}
