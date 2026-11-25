import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication, UnauthorizedException, NotFoundException } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { ControladorRespostasPaginadas } from './controlador-respostas-paginadas';
import { ServicoRespostasPaginadas } from '../aplicacao/servico-respostas-paginadas';

describe('QST10-08 consulta e exportação limitadas', () => {
  let app: INestApplication, url: string;
  const id='00000000-0000-4000-8000-000000000001', respostaId='00000000-0000-4000-8000-000000000002';
  const consultar=jest.fn(),exportar=jest.fn(),registrar=jest.fn();
  const headers=(papel='Professional',permissao='questionarios.ler')=>({'x-papel':papel,'x-permissao':permissao});
  beforeAll(async()=>{
    const modulo=await Test.createTestingModule({controllers:[ControladorRespostasPaginadas],providers:[
      {provide:ServicoRespostasPaginadas,useValue:{consultar,exportar}}, {provide:ServicoAuditoria,useValue:{registrar}}
    ]}).overrideGuard(GuardaJwt).useValue({canActivate(c:ExecutionContext){const r=c.switchToHttp().getRequest();if(!r.headers['x-papel'])throw new UnauthorizedException();r.usuarioAutenticado={tenantId:id,usuarioId:id,papel:r.headers['x-papel'],permissoes:[r.headers['x-permissao']]};return true;}}).compile();
    app=modulo.createNestApplication({logger:false});app.useGlobalPipes(criarPipeValidacaoHttp());await app.listen(0,'127.0.0.1');url=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async()=>{await app?.close();});
  beforeEach(()=>{jest.resetAllMocks();consultar.mockResolvedValue({respostas:[],totalConsulta:0,proximoCursor:null,timezone:'America/Sao_Paulo'});exportar.mockResolvedValue('respostaId,pacienteId\n');});
  const caminho=`/questionarios/${id}/respostas/pagina`;
  it('consulta privada com filtros normalizados',async()=>{
    const r=await fetch(url+caminho+'?tamanho=50&inicio=2026-11-01',{headers:headers()});
    expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toContain('no-store');
    expect(consultar).toHaveBeenCalledWith(id,id,expect.objectContaining({tenantId:id}),{tamanho:50,inicio:'2026-11-01'});
  });
  it('exige sessão, papel e permissão',async()=>{
    for(const [h,status]of [[{},401],[headers('Patient'),403],[headers('Professional','dashboard.ler'),403]]as const)expect((await fetch(url+caminho,{headers:h})).status).toBe(status);
    expect(consultar).not.toHaveBeenCalled();
  });
  it('rejeita UUIDs, campos desconhecidos, datas e tamanhos inválidos',async()=>{
    for(const path of [caminho+'?tamanho=1000',caminho+'?inicio=2026-02-30',caminho+'?tenantId='+id,caminho+'?tamanho=25&tamanho=50',caminho.replace(id,'invalido')])expect((await fetch(url+path,{headers:headers()})).status).toBe(400);
    expect(consultar).not.toHaveBeenCalled();
  });
  it('exporta os três escopos e audita somente contagem/tipo aprovados',async()=>{
    for(const corpo of [{escopo:'visiveis',respostaIds:[respostaId]},{escopo:'consulta',filtros:{pacienteId:id}},{escopo:'questionario'}]){
      const r=await fetch(url+`/questionarios/${id}/respostas/exportacao.csv`,{method:'POST',headers:{...headers(),'content-type':'application/json'},body:JSON.stringify(corpo)});
      expect(r.status).toBe(200);expect(r.headers.get('content-type')).toContain('text/csv');expect(r.headers.get('cache-control')).toContain('no-store');
    }
    expect(exportar.mock.calls.map(c=>[c[3],c[4]])).toEqual([[{},[respostaId]],[{pacienteId:id},undefined],[{},undefined]]);
    expect(registrar).toHaveBeenCalledTimes(3);
    for(const [evento]of registrar.mock.calls)expect(evento).toMatchObject({acao:'questionarios.respostas.exportar_csv',metadados:{tipo:'csv_filtrado',linhas:0}});
  });
  it('nega escopos ambíguos, IDs duplicados e metadados de filtro ocultos',async()=>{
    for(const corpo of [{escopo:'visiveis'},{escopo:'questionario',filtros:{pacienteId:id}},{escopo:'consulta',respostaIds:[id]},{escopo:'visiveis',respostaIds:[id,id]},{escopo:'consulta',filtros:{timezone:'UTC'}},{escopo:'consulta',filtros:{fim:'2026-02-30'}},{escopo:'outro'}]){
      const r=await fetch(url+`/questionarios/${id}/respostas/exportacao.csv`,{method:'POST',headers:{...headers(),'content-type':'application/json'},body:JSON.stringify(corpo)});expect(r.status).toBe(400);
    }
    expect(exportar).not.toHaveBeenCalled();
  });
  it('não audita sucesso diante de revogação ou falha',async()=>{
    consultar.mockRejectedValue(new NotFoundException());expect((await fetch(url+caminho,{headers:headers()})).status).toBe(404);expect(registrar).not.toHaveBeenCalled();
  });
});
