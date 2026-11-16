import 'reflect-metadata';
import { Controller, ForbiddenException, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';
import { inspect } from 'node:util';
import type { AddressInfo } from 'node:net';
import { ServicoRegistroPendenciaRestricao } from './servico-registro-pendencia-restricao';
import { ServicoConfirmacaoRestricao } from './servico-confirmacao-restricao';

const ator = { tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', usuarioId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', papel: 'Professional', emailHash: '', permissoes: [] } as const;
const paciente = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const restricao = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
let falha: unknown;
const executor = { executar: async () => { throw falha; } };
const registro = new ServicoRegistroPendenciaRestricao(executor as never, {} as never);
const confirmacao = new ServicoConfirmacaoRestricao(executor as never, {} as never, {} as never);

// Controlador sintético de ensaio: não é rota de aplicação nem prova o módulo P2.
@Controller('ensaio-falha-restricao')
class ControladorEnsaioFalha {
  @Get('registro')
  registrar() { return registro.registrar(ator as never, paciente, { chaveCriacao: restricao, conteudo: {} }); }
  @Get('confirmacao')
  confirmar() { return confirmacao.confirmar(ator as never, paciente, restricao, 1); }
}

describe('sanitização HTTP de erro sintético de banco', () => {
  let app: INestApplication;
  let url: string;
  const capturas: unknown[][] = [];
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [ControladorEnsaioFalha] }).compile();
    const logger = { log: (...x: unknown[]) => capturas.push(x), error: (...x: unknown[]) => capturas.push(x),
      warn: (...x: unknown[]) => capturas.push(x), debug: (...x: unknown[]) => capturas.push(x), verbose: (...x: unknown[]) => capturas.push(x) };
    app = modulo.createNestApplication({ logger });
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/ensaio-falha-restricao`;
  });
  afterAll(async () => { await app.close(); });
  it.each(['registro', 'confirmacao'])('não expõe query ou parâmetros e causa do banco em %s', async caminho => {
    capturas.length = 0;
    falha = new QueryFailedError('CANARIO_QUERY', ['CANARIO_PARAMETRO'], Object.assign(new Error('CANARIO_ERRO'), { code: '23503', detail: 'CANARIO_DETALHE' }));
    const resposta = await fetch(`${url}/${caminho}`);
    expect(resposta.status).toBe(500);
    expect(await resposta.text()).not.toMatch(/CANARIO_/);
    expect(inspect(capturas, { depth: 10 })).not.toMatch(/CANARIO_/);
  });
  it('não expõe corpo ou causa de HttpException proveniente de dependência', async () => {
    capturas.length = 0;
    falha = new ForbiddenException({ detalhe: 'CANARIO_CORPO' }, { cause: new Error('CANARIO_CAUSA') });
    const resposta = await fetch(`${url}/registro`);
    expect(resposta.status).toBe(403);
    expect(await resposta.text()).not.toMatch(/CANARIO_/);
    expect(inspect(capturas, { depth: 10 })).not.toMatch(/CANARIO_/);
  });
});
