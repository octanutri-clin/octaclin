import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { ControladorPlanosAlimentares } from '../apresentacao/controlador-planos-alimentares';
import { ControladorPortalPaciente } from '../../pacientes/apresentacao/controlador-portal-paciente';
import { AlterarAtivacaoPlanoDto } from './dtos-ativacao';
import { ListarPlanosAtivosPortalDto } from '../../pacientes/aplicacao/dtos-planos-portal';

describe('PA06b contratos HTTP', () => {
  it('exige booleano literal, revisão inteira limitada e não aceita tenant no corpo', () => {
    const validar = (v:unknown) => validateSync(plainToInstance(AlterarAtivacaoPlanoDto,v),{whitelist:true,forbidNonWhitelisted:true});
    expect(validar({ativo:false,ativacaoRevisaoEsperada:0})).toHaveLength(0);
    for (const v of [{ativo:'false',ativacaoRevisaoEsperada:0},{ativo:true,ativacaoRevisaoEsperada:-1},{ativo:true,ativacaoRevisaoEsperada:1.1},{ativo:true,ativacaoRevisaoEsperada:2147483647},{ativo:true},{ativo:true,ativacaoRevisaoEsperada:0,tenantId:'arbitrario'}]) expect(validar(v).length).toBeGreaterThan(0);
  });
  it.each(['alterarAtivacao','alterarAtivacaoRefeicao'])('protege %s por gerenciamento e no-store', nome => {
    const metodo=(ControladorPlanosAlimentares.prototype as unknown as Record<string,Function>)[nome];
    expect(typeof metodo).toBe('function');
    expect(Reflect.getMetadata(CHAVE_PERMISSOES,metodo)).toEqual(['planos_alimentares.gerenciar']);
    expect(Reflect.getMetadata(HEADERS_METADATA,metodo)).toContainEqual({name:'Cache-Control',value:'private, no-store'});
  });
  it.each(['listarPlanosAlimentares','obterPlanoAlimentar'])('protege %s do portal com no-store', nome => {
    const metodo=(ControladorPortalPaciente.prototype as unknown as Record<string,Function>)[nome];
    expect(typeof metodo).toBe('function');
    expect(Reflect.getMetadata(HEADERS_METADATA,metodo)).toContainEqual({name:'Cache-Control',value:'private, no-store'});
  });
  it('converte e limita paginação do portal', () => {
    expect(validateSync(plainToInstance(ListarPlanosAtivosPortalDto,{pagina:'2',limite:'5'}))).toHaveLength(0);
    expect(validateSync(plainToInstance(ListarPlanosAtivosPortalDto,{pagina:0,limite:21}))).toHaveLength(2);
  });
});
