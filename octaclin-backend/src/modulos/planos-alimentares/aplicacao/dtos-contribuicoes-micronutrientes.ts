import { IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';
import { CalculoCombinadoDto, validarSelecoesCalculo } from './dtos-calculo-combinado';
import { CODIGOS_MICRONUTRIENTES, type CodigoMicronutriente } from '../dominio/micronutrientes';
export class ContribuicoesMicronutrientesDto extends CalculoCombinadoDto {
  @IsIn(CODIGOS_MICRONUTRIENTES) codigo: CodigoMicronutriente;
  @IsInt() @Min(1) @Max(10000) pagina: number;
  @IsInt() @Min(1) @Max(100) limite: number;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(['plano','contribuicao']) ordem?: 'plano' | 'contribuicao';
}
export type EntradaContribuicoes = ContribuicoesMicronutrientesDto;
export function validarContribuicoes(valor: unknown): EntradaContribuicoes {
  const falhar = (): never => { throw new Error('Detalhamento de micronutrientes inválido.'); };
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return falhar();
  const v = valor as Record<string, unknown>;
  if (Object.keys(v).some(k => !['selecoes','codigo','pagina','limite','ordem'].includes(k)) || Buffer.byteLength(JSON.stringify(v)) > 64*1024) return falhar();
  if (!CODIGOS_MICRONUTRIENTES.includes(v.codigo as CodigoMicronutriente) || !Number.isInteger(v.pagina) || (v.pagina as number)<1 || (v.pagina as number)>10000 || !Number.isInteger(v.limite) || (v.limite as number)<1 || (v.limite as number)>100) return falhar();
  if(v.ordem!==undefined && v.ordem!=='plano' && v.ordem!=='contribuicao')return falhar();
  return { ...(v.ordem!==undefined?{ordem:v.ordem}:{}), ...validarSelecoesCalculo({selecoes:v.selecoes}), codigo:v.codigo as CodigoMicronutriente, pagina:v.pagina as number, limite:v.limite as number };
}
