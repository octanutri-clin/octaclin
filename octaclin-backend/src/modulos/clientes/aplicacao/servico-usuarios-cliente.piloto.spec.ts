import { ServicoUsuariosCliente } from './servico-usuarios-cliente';

describe('revogacao administrativa do contexto317',()=>{
  it('serializa antes de desativar e invalida o profissional do mesmo tenant',async()=>{
    const eventos:string[]=[];
    const repo={
      findOne:jest.fn(async()=>({id:'usuario',tenantId:'tenant',role:'Professional'})),
      update:jest.fn(async()=>{eventos.push('update');return {affected:1};}),
      find:jest.fn(async()=>[]),
    };
    const m={getRepository:()=>repo,query:jest.fn(async(sql:string)=>{
      eventos.push(sql);
      return sql.includes('select id from profissionais') ? [{id:'prof'}] : [];
    })};
    const executor={executar:async(_tenant:string,fn:Function)=>fn(m)};
    const s=new ServicoUsuariosCliente(executor as never,{} as never,{} as never,{} as never,{} as never,{} as never);
    await s.desativar('tenant','gestor','usuario');
    expect(eventos[0]).toContain('pg_advisory_xact_lock');
    expect(m.query).toHaveBeenCalledWith(expect.stringContaining('select id from profissionais'),['tenant','usuario']);
    expect(m.query).toHaveBeenCalledWith(expect.stringContaining('update paciente_badges'),['tenant',null,'prof']);
  });
});
