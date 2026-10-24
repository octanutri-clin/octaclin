import { HEADERS_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { ControladorGruposSubstituicoes, ControladorAdministracaoGrupos } from './controlador-grupos-substituicoes';
const u:any={tenantId:'tenant-sintetico',usuarioId:'usuario-sintetico'};
describe('FOOD04 controladores segregados',()=>{
  it('obriga papel, guardas e no-store em ambos os caminhos',()=>{
    for(const [tipo,papeis,metodos]of [[ControladorGruposSubstituicoes,['Professional'],['consultar','obter','criar','atualizar','duplicar','favoritar','desfavoritar']],[ControladorAdministracaoGrupos,['Client','SuperAdmin'],['consultar','consultarFontes','obter','atualizar']]]as const){
      expect(Reflect.getMetadata(CHAVE_PAPEIS,tipo)).toEqual(papeis);
      expect(Reflect.getMetadata(GUARDS_METADATA,tipo)).toHaveLength(3);
      for(const nome of metodos){const fn=(tipo.prototype as any)[nome];expect(Reflect.getMetadata(HEADERS_METADATA,fn)).toContainEqual({name:'Cache-Control',value:'private, no-store'});expect(Reflect.getMetadata(CHAVE_PERMISSOES,fn)).toHaveLength(1);}
    }
  });
  it('não aceita tenant livre e não mistura admin com identidade profissional',async()=>{
    const s:any={consultar:jest.fn(),obter:jest.fn(),atualizar:jest.fn()},c=new ControladorAdministracaoGrupos(s);
    await c.consultar(u,{});expect(s.consultar).toHaveBeenCalledWith(u.tenantId,u,{},true);
    await c.obter(u,'grupo');expect(s.obter).toHaveBeenCalledWith(u.tenantId,u,'grupo',true);
    await c.atualizar(u,'grupo',{revisaoEsperada:1,estado:'arquivado'});expect(s.atualizar).toHaveBeenCalledWith(u.tenantId,u,'grupo',{revisaoEsperada:1,estado:'arquivado'},true);
  });
});
