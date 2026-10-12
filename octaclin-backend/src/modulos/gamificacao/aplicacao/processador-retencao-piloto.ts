import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, MoreThan } from 'typeorm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { ServicoRetencaoPiloto } from './servico-retencao-piloto';

@Injectable()
export class ProcessadorRetencaoPiloto {
  private readonly logger=new Logger(ProcessadorRetencaoPiloto.name);
  private emExecucao=false;
  constructor(private readonly fonte:DataSource,private readonly retencao:ServicoRetencaoPiloto) {}
  @Cron('0 */5 * * * *')
  async processar():Promise<void> {
    if(this.emExecucao) return;
    this.emExecucao=true;
    try {
      let cursor:string|undefined;
      for(;;) {
        const rows=await this.fonte.getRepository(TenantOrm).find({select:{id:true},...(cursor ? {where:{id:MoreThan(cursor)}} : {}),order:{id:'ASC'},take:100});
        for(const row of rows) {
          try { await this.retencao.limparTenant(row.id); }
          catch { this.logger.warn('Falha na rodada de retencao da comunidade; nova tentativa na proxima rodada.'); }
        }
        if(rows.length<100) break;
        cursor=rows.at(-1)!.id;
      }
    } catch { this.logger.warn('Falha ao enumerar tenants para retencao; nova tentativa na proxima rodada.'); }
    finally { this.emExecucao=false; }
  }
}
