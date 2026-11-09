import type {QueryRunner} from 'typeorm';
import { RegistrosAnalisesFactuais1720000001081 } from './1720000001081-RegistrosAnalisesFactuais';
import {criarOpcoesTypeOrm} from '../opcoes-typeorm';
import {RegistroAnaliseFactualOrm} from '../../../modulos/planos-alimentares/infraestrutura/registro-analise-factual.orm';
it('1081 cria armazenamento cifrado append-only isolado, sem alterar versões nem liberar UPDATE/DELETE',async()=>{
 const query=jest.fn(async(_s:string)=>[]);await new RegistrosAnalisesFactuais1720000001081().up({query} as unknown as QueryRunner);
 const sql=query.mock.calls.map(c=>c[0]).join('\n').toLowerCase();
 for(const t of ['create table registros_analises_factuais','force row level security','enable row level security','for select','for insert','conteudo_criptografado bytea','foreign key (tenant_id, paciente_id)','foreign key (tenant_id, profissional_id)','foreign key (tenant_id, usuario_id)'])expect(sql).toContain(t);
 expect(sql).not.toMatch(/for (update|delete|all)|grant|drop table|alter table plano|on delete cascade|conteudo_hash/);
});
it('1081 registra entidade/migration uma vez e preserva synchronize desligado',()=>{
 const o=criarOpcoesTypeOrm();expect(o.synchronize).toBe(false);
 expect((o.migrations as unknown[]).filter(m=>m===RegistrosAnalisesFactuais1720000001081)).toHaveLength(1);
 expect((o.entities as unknown[]).filter(m=>m===RegistroAnaliseFactualOrm)).toHaveLength(1);
});
it('1081 não remove histórico em down',async()=>{await expect(new RegistrosAnalisesFactuais1720000001081().down({} as QueryRunner)).rejects.toThrow('Rollback recusado');});
