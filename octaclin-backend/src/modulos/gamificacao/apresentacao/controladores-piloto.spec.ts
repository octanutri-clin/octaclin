import { ControladorConfiguracaoPiloto, ConfiguracaoPilotoDto } from './controlador-configuracao-piloto';
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ControladorConsolePiloto, ControladorPortalPiloto } from './controladores-piloto';
import { PublicacaoPilotoDto, ComandoPilotoDto, PaginaPilotoDto } from '../aplicacao/dtos-piloto';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';

describe('contratos HTTP do piloto317',()=>{
  it('console e portal exigem JWT, papel e permissoes',()=>{
    for(const controller of [ControladorConsolePiloto,ControladorPortalPiloto]) expect(Reflect.getMetadata(GUARDS_METADATA,controller)).toEqual([GuardaJwt,GuardaPapeis,GuardaPermissoes]);
  });
  it('rejeita comando adulterado, texto excessivo e cursor excessivo',async()=>{
    expect((await validate(plainToInstance(ComandoPilotoDto,{chave:'invalida',versaoEsperada:-1}))).length).toBe(2);
    expect((await validate(plainToInstance(PublicacaoPilotoDto,{chave:'00000000-0000-4000-8000-000000000000',versaoEsperada:0,texto:'x'.repeat(2001)}))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(PaginaPilotoDto,{cursor:'x'.repeat(1025)}))).length).toBeGreaterThan(0);
  });
  it('whitelist nao aceita paciente, tenant ou autor no corpo de publicacao',async()=>{
    const erros=await validate(plainToInstance(PublicacaoPilotoDto,{chave:'00000000-0000-4000-8000-000000000000',versaoEsperada:0,texto:'Sintetico',tenantId:'forjado',pacienteId:'forjado',autor:'forjado'}),{whitelist:true,forbidNonWhitelisted:true});
    expect(erros.map(e=>e.property).sort()).toEqual(['autor','pacienteId','tenantId']);
  });
  it('excecao legal pertence ao controlador Client, nunca ao DTO',()=>{
    expect(typeof ControladorConfiguracaoPiloto.prototype.excecao).toBe('function');
    expect(Object.getOwnPropertyNames(ConfiguracaoPilotoDto.prototype)).toEqual(['constructor']);
  });

});
