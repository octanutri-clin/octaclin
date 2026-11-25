import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication, UnauthorizedException, NotFoundException } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { ServicoQuestionarios } from '../aplicacao/servico-questionarios';
import { ServicoRevisaoFormularios } from '../aplicacao/servico-revisao-formularios';
import { ControladorQuestionarios } from './controlador-questionarios';

describe('QST10-07 contrato HTTP da completude', () => {
  let app: INestApplication, url: string;
  const id='00000000-0000-4000-8000-000000000001', respostaId='00000000-0000-4000-8000-000000000002';
  const obterCompletudeHistorica=jest.fn(),registrar=jest.fn();
  const headers=(papel='Professional',permissao='questionarios.ler')=>({'x-papel':papel,'x-permissao':permissao});
  beforeAll(async()=>{
    const modulo=await Test.createTestingModule({controllers:[ControladorQuestionarios],providers:[
      {provide:ServicoQuestionarios,useValue:{obterCompletudeHistorica}}, {provide:ServicoAuditoria,useValue:{registrar}}, {provide:ServicoRevisaoFormularios,useValue:{}}
    ]}).overrideGuard(GuardaJwt).useValue({canActivate(c:ExecutionContext){const r=c.switchToHttp().getRequest();if(!r.headers['x-papel'])throw new UnauthorizedException();r.usuarioAutenticado={tenantId:id,usuarioId:id,papel:r.headers['x-papel'],permissoes:[r.headers['x-permissao']]};return true;}}).compile();
    app=modulo.createNestApplication({logger:false});app.useGlobalPipes(criarPipeValidacaoHttp());await app.listen(0,'127.0.0.1');url=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async()=>{await app?.close();});
  beforeEach(()=>{jest.resetAllMocks();obterCompletudeHistorica.mockResolvedValue({respostaId,envioId:id,completude:{estado:'desconhecido',motivo:'snapshot_ausente',versaoQuestionario:null,totalPerguntas:null,respondidas:null,obrigatorias:null,obrigatoriasRespondidas:null}});});
  const caminho=`/questionarios/${id}/respostas/${respostaId}/completude`;
  it('retorna projeção privada e audita leitura sem marcar revisão',async()=>{
    const r=await fetch(url+caminho,{headers:headers()});expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toContain('no-store');
    const corpo=await r.json() as {completude:{totalPerguntas:number|null}};expect(corpo).not.toHaveProperty('comprovanteLeitura');expect(corpo.completude.totalPerguntas).toBeNull();
    expect(obterCompletudeHistorica).toHaveBeenCalledWith(id,id,respostaId,expect.objectContaining({tenantId:id}));
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({acao:'questionarios.resposta.visualizar',recursoId:id,metadados:{}}));
  });
  it('exige sessão papel e permissão e valida ambos UUIDs',async()=>{
    for(const [h,status]of [[{},401],[headers('Patient'),403],[headers('Professional','dashboard.ler'),403]]as const)expect((await fetch(url+caminho,{headers:h})).status).toBe(status);
    for(const path of [`/questionarios/invalido/respostas/${respostaId}/completude`,`/questionarios/${id}/respostas/invalida/completude`])expect((await fetch(url+path,{headers:headers()})).status).toBe(400);
    expect(obterCompletudeHistorica).not.toHaveBeenCalled();expect(registrar).toHaveBeenCalledTimes(2);
    expect(registrar.mock.calls.map(([evento])=>evento.acao)).toEqual(['auth.autorizacao.negada','auth.autorizacao.negada']);
  });
  it('preserva negação do serviço sem auditoria de sucesso',async()=>{
    obterCompletudeHistorica.mockRejectedValue(new NotFoundException('Resposta indisponível.'));expect((await fetch(url+caminho,{headers:headers()})).status).toBe(404);expect(registrar).not.toHaveBeenCalled();
  });
});
