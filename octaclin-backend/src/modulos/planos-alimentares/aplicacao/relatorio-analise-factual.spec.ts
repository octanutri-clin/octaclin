import {randomUUID} from 'node:crypto';
import {ForbiddenException,NotFoundException} from '@nestjs/common';
import {construirAnaliseFactual} from './construtor-analise-factual';
import {criarSnapshotMicronutrientes} from '../dominio/micronutrientes';
import {projetarRegistroFactual} from './projecao-registro-factual';
import {prepararRelatorioFactual} from './relatorio-analise-factual';
import {ServicoRegistrosAnaliseFactual} from './servico-registros-analise-factual';
import type {UsuarioAutenticado} from '../../auth/dominio/usuario-autenticado';
const tenant=randomUUID(),paciente=randomUUID(),id=randomUUID();
const usuario={tenantId:tenant,usuarioId:randomUUID(),papel:'Professional',emailHash:'',permissoes:['planos_alimentares.ler','planos_alimentares.gerenciar']} as UsuarioAutenticado;
const fonte=()=>projetarRegistroFactual({id,criadoEm:new Date('2026-11-05T12:00:00.000Z')},construirAnaliseFactual({escopo:{tenantId:tenant,pacienteId:paciente},origem:{planoId:randomUUID(),versaoId:randomUUID(),numero:1,status:'publicada',registradaEm:'2026-11-01T12:00:00.000Z'},ativo:true,selecionado:true,refeicoes:[{identidadeId:randomUUID(),ativa:true,selecionada:true,itens:[{porcaoGramas:100,snapshot:{origem:'manual',nutrientesPorcao:{energiaKcal:0},micronutrientes:criarSnapshotMicronutrientes({ferroMg:{estado:'conhecido',valor:0}},100,100)}}]}]}));
it('relatório conserva zero, desconhecido e origem sem ativar referências ou inferir contexto',()=>{
 const p=fonte(),antes=JSON.stringify(p),r=prepararRelatorioFactual(p,new Date('2026-11-05T13:00:00.000Z'));
 expect(r.registro).toEqual(p.registro);expect(r.origem).toEqual(p.origem);expect(r.analise).toEqual(p.analise);expect(r.analise.cobertura.nutrientes.ferroMg.total).toBe(0);expect(r.analise.cobertura.nutrientes.selenioMcg.estado).toBe('DESCONHECIDO');expect(r.referencias.estado).toBe('indisponivel');expect(r.contextoClinico.estado).toBe('nao_documentado_no_relatorio');expect(r.geradoEm).toBe('2026-11-05T13:00:00.000Z');expect(JSON.stringify(p)).toBe(antes);expect(JSON.stringify(r)).not.toMatch(/tenantId|pacienteId|conteudoHash|snapshot|nascimento|confirmacaoOrigem/);
});
it('serviço exige gerenciamento também quando consultado diretamente e não toca banco antes da permissão',async()=>{
 const s=new ServicoRegistrosAnaliseFactual(null!,null!),consulta=jest.spyOn(s,'consultarApi').mockResolvedValue(fonte());
 for(const u of [{...usuario,permissoes:['planos_alimentares.ler']},{...usuario,tenantId:randomUUID()},{...usuario,papel:'Client'}])await expect(s.prepararRelatorioApi(tenant,paciente,u as UsuarioAutenticado,id)).rejects.toBeInstanceOf(ForbiddenException);
 expect(consulta).not.toHaveBeenCalled();await expect(s.prepararRelatorioApi(tenant,paciente,usuario,id)).resolves.toMatchObject({registro:{id}});expect(consulta).toHaveBeenCalledWith(tenant,paciente,usuario,id,true);
 consulta.mockRejectedValueOnce(new NotFoundException());await expect(s.prepararRelatorioApi(tenant,paciente,usuario,id)).rejects.toBeInstanceOf(NotFoundException);
});

it('flag interna de fontes também exige gerenciamento na consulta direta',async()=>{const s=new ServicoRegistrosAnaliseFactual(null!,null!);await expect(s.consultarApi(tenant,paciente,{...usuario,permissoes:['planos_alimentares.ler']},id,true)).rejects.toBeInstanceOf(ForbiddenException);});

it('formato2 solicitado usa somente resumo congelado e preserva formato1 padrão',()=>{
 const p={...fonte(),contextoConfirmado:{schemaVersao:1 as const,dataAnalise:'2026-11-06',idadeAnos:36,populacaoReferencia:'feminina' as const,mesmoDiaPlanejado:false,tabagismo:'nao_informado' as const,motivos:[]}};
 const v2=prepararRelatorioFactual(p,new Date('2026-11-06T12:00:00.000Z'),2);expect(v2).toMatchObject({schemaVersao:2,motorVersao:'food06-relatorio-factual-v2',contextoClinico:{estado:'resumo_documentado',resumo:p.contextoConfirmado}});
 expect(prepararRelatorioFactual(p).contextoClinico).toEqual({estado:'nao_documentado_no_relatorio'});
 expect(prepararRelatorioFactual(fonte(),new Date(),2).contextoClinico).toEqual({estado:'nao_registrado'});
});

it('formato2 não transporta campos livres adicionados ao resumo projetado',()=>{
 const p={...fonte(),contextoConfirmado:{schemaVersao:1 as const,dataAnalise:'2026-11-06',mesmoDiaPlanejado:false,tabagismo:'nao_informado' as const,motivos:[],segredo:'CANARIO_CONTEXTUAL',nascimento:'1990-01-01'}};
 expect(JSON.stringify(prepararRelatorioFactual(p,new Date(),2))).not.toMatch(/CANARIO_CONTEXTUAL|1990-01-01/);
});

describe('FOOD06 T3b: referências no serviço de registros', () => {
 const contexto={nascimento:'1985-06-15',dataAnalise:'2026-11-03',populacaoReferencia:'feminina',populacaoConfirmada:true,gestacao:'nao',lactacao:'nao',aplicabilidade:'confirmada',mesmoDiaPlanejado:true,tabagismo:'nao'} as const;
 const registroV2=()=>construirAnaliseFactual({escopo:{tenantId:tenant,pacienteId:paciente},origem:{planoId:randomUUID(),versaoId:randomUUID(),numero:1,status:'publicada',registradaEm:'2026-11-01T12:00:00.000Z'},ativo:true,selecionado:true,
  refeicoes:[{identidadeId:randomUUID(),ativa:true,selecionada:true,itens:[{porcaoGramas:100,snapshot:{origem:'manual',nutrientesPorcao:{energiaKcal:0},micronutrientes:criarSnapshotMicronutrientes({calcioMg:{estado:'conhecido',valor:500}},100,100)}}]}],contexto});
 it('relatório repassa o opt-in à consulta só no formato 2 e recusa antes de tocar o banco',async()=>{
  const s=new ServicoRegistrosAnaliseFactual(null!,null!),consulta=jest.spyOn(s,'consultarApi').mockResolvedValue(projetarRegistroFactual({id,criadoEm:new Date()},registroV2(),true));
  const r:any=await s.prepararRelatorioApi(tenant,paciente,usuario,id,2,false,true);
  expect(consulta).toHaveBeenCalledWith(tenant,paciente,usuario,id,true,false,true);expect(r.referencias).toMatchObject({estado:'calculado'});
  consulta.mockClear();
  await expect(s.prepararRelatorioApi(tenant,paciente,usuario,id,1,false,true)).rejects.toThrow('As referências exigem o formato 2.');
  await expect(s.prepararRelatorioApi(tenant,paciente,usuario,id,2,false,'true' as never)).rejects.toThrow('As referências exigem o formato 2.');
  await expect(s.prepararRelatorioApi(tenant,paciente,{...usuario,permissoes:['planos_alimentares.ler']},id,2,false,true)).rejects.toBeInstanceOf(ForbiddenException);
  expect(consulta).not.toHaveBeenCalled();
 });
 it('consulta autoriza antes de validar a flag e projeta o registro decifrado com ela',async()=>{
  const g={} as never,executor={executar:jest.fn(async(_t:string,fn:(g:never)=>unknown)=>fn(g))};
  const s=new ServicoRegistrosAnaliseFactual(executor as never,null!) as any;
  const carteira=jest.spyOn(s,'carteira').mockResolvedValue('profissional');
  jest.spyOn(s,'obterRegistro').mockResolvedValue({id,criadoEm:new Date('2026-11-03T12:00:00.000Z')});
  jest.spyOn(s,'decifrarRegistro').mockReturnValue(registroV2());
  await expect(s.consultarApi(tenant,paciente,{...usuario,papel:'Client'},id,false,false,true)).rejects.toBeInstanceOf(ForbiddenException);
  await expect(s.consultarApi(tenant,paciente,usuario,id,false,false,'true')).rejects.toThrow('Consulta inválida.');
  expect(executor.executar).not.toHaveBeenCalled();
  expect((await s.consultarApi(tenant,paciente,usuario,id)).referencias).toEqual({estado:'indisponivel',motivo:'referencias_nao_habilitadas'});
  const comReferencias=await s.consultarApi(tenant,paciente,usuario,id,false,false,true);
  expect(comReferencias.referencias).toMatchObject({estado:'calculado',versaoReferencias:'dri-hc-2025-11-19-adulto-v1',contextoElegivel:true});
  expect(carteira).toHaveBeenCalledTimes(2);
 });
 it('histórico repassa o opt-in a cada resumo e mantém o placeholder sem ele',async()=>{
  const qb:any={};for(const m of ['select','addSelect','where','orderBy','addOrderBy','take','andWhere'])qb[m]=()=>qb;
  qb.getRawAndEntities=async()=>({raw:[{tamanho_cifrado:64,cursor_criado_em:'2026-11-03T12:00:00.000000Z'}],entities:[{id,criadoEm:new Date('2026-11-03T12:00:00.000Z')}]});
  const g={getRepository:()=>({createQueryBuilder:()=>qb,find:async()=>[{id,conteudoCriptografado:Buffer.alloc(64)}]})};
  const executor={executar:jest.fn(async(_t:string,fn:(g:never)=>unknown)=>fn(g as never))};
  const s=new ServicoRegistrosAnaliseFactual(executor as never,null!) as any;
  jest.spyOn(s,'carteira').mockResolvedValue('profissional');jest.spyOn(s,'decifrarRegistro').mockReturnValue(registroV2());
  expect((await s.historico(tenant,paciente,usuario,10)).itens[0].referencias).toEqual({estado:'indisponivel',motivo:'referencias_nao_habilitadas'});
  expect((await s.historico(tenant,paciente,usuario,10,undefined,undefined,false,false,true)).itens[0].referencias).toMatchObject({estado:'calculado',contextoElegivel:true});
  executor.executar.mockClear();
  await expect(s.historico(tenant,paciente,usuario,10,undefined,undefined,false,false,'true')).rejects.toThrow('Paginação inválida.');
  expect(executor.executar).not.toHaveBeenCalled();
 });
 it('histórico com opt-in numa página mista: v2 compara, v1 legado fica indisponível com motivo',async()=>{
  const id2=randomUUID(),qb:any={};for(const m of ['select','addSelect','where','orderBy','addOrderBy','take','andWhere'])qb[m]=()=>qb;
  qb.getRawAndEntities=async()=>({raw:[{tamanho_cifrado:64},{tamanho_cifrado:64}],entities:[{id,criadoEm:new Date('2026-11-04T12:00:00.000Z')},{id:id2,criadoEm:new Date('2026-11-03T12:00:00.000Z')}]});
  const g={getRepository:()=>({createQueryBuilder:()=>qb,find:async()=>[{id,conteudoCriptografado:Buffer.alloc(64)},{id:id2,conteudoCriptografado:Buffer.alloc(64)}]})};
  const s=new ServicoRegistrosAnaliseFactual({executar:async(_t:string,fn:(g:never)=>unknown)=>fn(g as never)} as never,null!) as any;
  const legado={...JSON.parse(JSON.stringify(registroV2())),schemaVersao:1,motorVersao:'food06-registro-factual-v1',referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'}};
  jest.spyOn(s,'carteira').mockResolvedValue('profissional');jest.spyOn(s,'decifrarRegistro').mockReturnValueOnce(registroV2()).mockReturnValueOnce(legado);
  const {itens}=await s.historico(tenant,paciente,usuario,10,undefined,undefined,false,false,true);
  expect(itens.map((i:any)=>i.referencias.estado)).toEqual(['calculado','indisponivel']);
  expect(itens[1].referencias).toEqual({estado:'indisponivel',motivo:'registro_sem_referencias'});
  expect(itens[0].comparacaoAnterior.referencia).toBe('NAO_COMPARAVEL');
 });
});
