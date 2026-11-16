import { Module } from '@nestjs/common';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoConfirmacaoRestricao } from './aplicacao/servico-confirmacao-restricao';
import { ServicoLeituraRestricao } from './aplicacao/servico-leitura-restricao';
import { ServicoReconfirmacaoRestricao } from './aplicacao/servico-reconfirmacao-restricao';
import { ServicoRegistroPendenciaRestricao } from './aplicacao/servico-registro-pendencia-restricao';

/** Composição interna; sem controladores ou exports enquanto a P2 não estiver integrada. */
@Module({
  imports: [ModuloTenancy, ModuloAuth],
  providers: [CriptografiaDadosSensiveis, ServicoRegistroPendenciaRestricao, ServicoConfirmacaoRestricao,
    ServicoReconfirmacaoRestricao, ServicoLeituraRestricao]
})
export class ModuloRestricoes {}
