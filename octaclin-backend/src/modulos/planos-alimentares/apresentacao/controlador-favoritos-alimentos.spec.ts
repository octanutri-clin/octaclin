import { HEADERS_METADATA } from '@nestjs/common/constants';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoFavoritosAlimentos } from '../aplicacao/servico-favoritos-alimentos';
import { ControladorFavoritosAlimentos } from './controlador-favoritos-alimentos';

const usuario: UsuarioAutenticado = { usuarioId: '10000000-0000-4000-8000-000000000001', tenantId: '10000000-0000-4000-8000-000000000002', papel: 'Professional', emailHash: 'sintetico', permissoes: ['planos_alimentares.ler', 'planos_alimentares.gerenciar'] };

describe('ControladorFavoritosAlimentos', () => {
  it('restringe a profissional e mantém permissões distintas para leitura e alteração', async () => {
    const servico = { listar: jest.fn(), favoritar: jest.fn(), desfavoritar: jest.fn() };
    const controlador = new ControladorFavoritosAlimentos(servico as unknown as ServicoFavoritosAlimentos);
    expect(Reflect.getMetadata(CHAVE_PAPEIS, ControladorFavoritosAlimentos)).toEqual(['Professional']);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorFavoritosAlimentos.prototype.listar)).toEqual(['planos_alimentares.ler']);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorFavoritosAlimentos.prototype.favoritar)).toEqual(['planos_alimentares.gerenciar']);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorFavoritosAlimentos.prototype.desfavoritar)).toEqual(['planos_alimentares.gerenciar']);
    expect(Reflect.getMetadata(HEADERS_METADATA, ControladorFavoritosAlimentos.prototype.listar)).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
    await controlador.favoritar(usuario, { origem: 'custom', alimentoId: '10000000-0000-4000-8000-000000000003' });
    expect(servico.favoritar).toHaveBeenCalledWith(usuario.tenantId, usuario, 'custom', '10000000-0000-4000-8000-000000000003');
  });
});
