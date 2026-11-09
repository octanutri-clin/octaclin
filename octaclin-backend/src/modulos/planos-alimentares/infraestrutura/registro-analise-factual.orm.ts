import { Column,CreateDateColumn,Entity,Index,PrimaryGeneratedColumn } from 'typeorm';
/** Conteúdo e marcadores protegidos. Nunca retornar entidade crua por HTTP. */
@Entity('registros_analises_factuais')
@Index('ux_registros_analises_idempotencia',['tenantId','usuarioId','chaveIdempotencia'],{unique:true})
export class RegistroAnaliseFactualOrm {
 @PrimaryGeneratedColumn('uuid') id:string;
 @Column({name:'tenant_id',type:'uuid'}) tenantId:string;
 @Column({name:'paciente_id',type:'uuid'}) pacienteId:string;
 @Column({name:'profissional_id',type:'uuid'}) profissionalId:string;
 @Column({name:'usuario_id',type:'uuid'}) usuarioId:string;
 @Column({name:'chave_idempotencia',type:'uuid'}) chaveIdempotencia:string;
 @Column({name:'conteudo_criptografado',type:'bytea'}) conteudoCriptografado:Buffer;
 @CreateDateColumn({name:'criado_em',type:'timestamptz'}) criadoEm:Date;
}
