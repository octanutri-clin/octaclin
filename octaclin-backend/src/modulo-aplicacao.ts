import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { criarOpcoesTypeOrm } from './infraestrutura/banco-dados/opcoes-typeorm';
import { ModuloProcessamento } from './infraestrutura/processamento/modulo-processamento';
import { ModuloAgenda } from './modulos/agenda/modulo-agenda';
import { ModuloAutomacoes } from './modulos/automacoes/modulo-automacoes';
import { ModuloAuth } from './modulos/auth/modulo-auth';
import { ModuloClientes } from './modulos/clientes/modulo-clientes';
import { ModuloComunicacoes } from './modulos/comunicacoes/modulo-comunicacoes';
import { ModuloDashboard } from './modulos/dashboard/modulo-dashboard';
import { ModuloGamificacao } from './modulos/gamificacao/modulo-gamificacao';
import { ModuloIa } from './modulos/ia/modulo-ia';
import { ModuloMateriais } from './modulos/materiais/modulo-materiais';
import { ModuloMobile } from './modulos/mobile/modulo-mobile';
import { ModuloOperacoes } from './modulos/operacoes/modulo-operacoes';
import { ModuloPacientes } from './modulos/pacientes/modulo-pacientes';
import { ModuloProfissionais } from './modulos/profissionais/modulo-profissionais';
import { ModuloQuestionarios } from './modulos/questionarios/modulo-questionarios';
import { ModuloSaude } from './modulos/saude/modulo-saude';
import { ModuloTenancy } from './modulos/tenancy/modulo-tenancy';
import { ModuloUsuarios } from './modulos/usuarios/modulo-usuarios';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: criarOpcoesTypeOrm
    }),
    ModuloProcessamento,
    ModuloSaude,
    ModuloAuth,
    ModuloClientes,
    ModuloTenancy,
    ModuloUsuarios,
    ModuloProfissionais,
    ModuloPacientes,
    ModuloQuestionarios,
    ModuloComunicacoes,
    ModuloDashboard,
    ModuloAgenda,
    ModuloMateriais,
    ModuloIa,
    ModuloAutomacoes,
    ModuloGamificacao,
    ModuloMobile,
    ModuloOperacoes
  ]
})
export class ModuloAplicacao {}
