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
