import { RascunhosClinicos1720000001071 } from '../../../infraestrutura/banco-dados/migracoes/1720000001071-RascunhosClinicos';
describe('schema318 aditivo',()=>{
 it('registra geracao monotônica no banco para todos os escritores e FORCE RLS',async()=>{
  const sql:string[]=[];await new RascunhosClinicos1720000001071().up({query:async(s:string)=>{sql.push(s);return [];}} as never);
  const full=sql.join('\n');expect(full).toContain('versao_contexto_ia318');expect(full).toContain('before update on pacientes');expect(full).toContain('before update on usuarios');expect(full).toContain('force row level security');expect(full).not.toContain('create table rascunhos');
 });
 it('rollback recusa apagar artefatos e historico confirmado',async()=>{await expect(new RascunhosClinicos1720000001071().down({query:async()=>[{total:1}]} as never)).rejects.toThrow();});
});
