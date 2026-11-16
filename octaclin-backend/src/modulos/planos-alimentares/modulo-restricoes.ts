import { Module } from '@nestjs/common';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoConfirmacaoRestricao } from './aplicacao/servico-confirmacao-restricao';
import { ServicoLeituraRestricao } from './aplicacao/servico-leitura-restricao';
import { ServicoReconfirmacaoRestricao } from './aplicacao/servico-reconfirmacao-restricao';
import { ServicoRegistroPendenciaRestricao } from './aplicacao/servico-registro-pendencia-restricao';
import { ControladorRestricoesClinicas } from './apresentacao/controlador-restricoes-clinicas';

/** Rotas clínicas só respondem com a flag `restricoes.clinicas` ligada (padrão desligada); sem exports. */
@Module({
  imports: [ModuloTenancy, ModuloAuth],
  controllers: [ControladorRestricoesClinicas],
  providers: [CriptografiaDadosSensiveis, ServicoRegistroPendenciaRestricao, ServicoConfirmacaoRestricao,
    ServicoReconfirmacaoRestricao, ServicoLeituraRestricao]
})
export class ModuloRestricoes {}
