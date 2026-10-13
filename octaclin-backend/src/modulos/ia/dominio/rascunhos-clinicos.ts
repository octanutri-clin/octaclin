import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';

export interface Fonte318 {ref:string;tipo:'preparacao'|'evolucao'|'medida';data:string;texto:string}
export interface Saida318 {itens:{texto:string;refs:string[]}[];limitacoes:string[]}
export interface Modelo318 {id:string;versao:string;nome:string;maxOutputTokens:number;precoEntradaMilhaoUsd:number;precoSaidaMilhaoUsd:number;precoEm:string;padrao:boolean}
export const POLITICA318='318-v1';
export function catalogoClinico318():Modelo318[] {return [];}
export function autorizarProfissional318(u:UsuarioAutenticado):void {
  if(u.papel!=='Professional'||!u.permissoes.includes('ia.executar')||!u.permissoes.includes('pacientes.gerenciar'))throw new ForbiddenException('Acesso exclusivo do profissional responsável.');
}
export function validarFontes318(fontes:Fonte318[]):Fonte318[] {
  if(!Array.isArray(fontes)||fontes.length>20||fontes.some(f=>!f||!['preparacao','evolucao','medida'].includes(f.tipo)||typeof f.ref!=='string'||f.ref.length>100||!f.ref||typeof f.data!=='string'||f.data.length>40||typeof f.texto!=='string'||!f.texto.trim())||new Set(fontes.map(f=>f.ref)).size!==fontes.length||fontes.reduce((n,f)=>n+[...f.texto].length,0)>12000)throw new BadRequestException('Confira as fontes e os limites do contexto.');
  return fontes;
}
const objeto=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exatas=(v:Record<string,unknown>,chaves:string[])=>Object.keys(v).length===chaves.length&&Object.keys(v).every(k=>chaves.includes(k));
export function validarSaida318(valor:unknown,fontes:Fonte318[]):Saida318 {
  if(!objeto(valor)||!exatas(valor,['itens','limitacoes'])||!Array.isArray(valor.itens)||!Array.isArray(valor.limitacoes)||valor.itens.length>30||valor.limitacoes.length>10)throw new BadRequestException('Resposta de assistência inválida.');
  const refs=new Set(fontes.map(f=>f.ref));
  if(valor.itens.some(i=>!objeto(i)||!exatas(i,['texto','refs'])||typeof i.texto!=='string'||!i.texto.trim()||!Array.isArray(i.refs)||!i.refs.length||i.refs.length>20||i.refs.some(r=>typeof r!=='string'||!refs.has(r)))||valor.limitacoes.some(l=>typeof l!=='string'||[...l].length>500)||valor.itens.reduce((n,i)=>n+[...i.texto].length,0)>6000)throw new BadRequestException('Resposta de assistência inválida.');
  return valor as unknown as Saida318;
}
export function fingerprint318(valor:unknown):string {return createHash('sha256').update(JSON.stringify(valor)).digest('hex');}
@Injectable()
export class ConteudoRascunhos318 {
  constructor(private readonly cripto:CriptografiaDadosSensiveis){}
  cifrar(escopo:string,dados:unknown):Buffer {return this.cripto.criptografar(JSON.stringify({escopo:`ia318:${escopo}`,dados}));}
  ler<T>(escopo:string,bytes:Buffer):T {
    try {const v=JSON.parse(this.cripto.descriptografar(bytes));if(v.escopo!==`ia318:${escopo}`)throw new Error();return v.dados as T;}
    catch {throw new ConflictException('Contexto de assistência indisponível.');}
  }
  selar(dados:unknown,agora=Date.now()):string {return this.cifrar('revisao',{dados,emitidoEm:agora,expiraEm:agora+900000}).toString('base64url');}
  abrir<T>(prova:string,agora=Date.now()):T {
    if(typeof prova!=='string'||prova.length>30000||!prova||!/^[\w-]+$/.test(prova))throw new BadRequestException('Prévia inválida.');
    const p=this.ler<{dados:T;emitidoEm:number;expiraEm:number}>('revisao',Buffer.from(prova,'base64url'));
    if(!Number.isFinite(p.expiraEm)||!Number.isFinite(p.emitidoEm)||p.emitidoEm>agora||agora>=p.expiraEm)throw new ConflictException('Prévia expirada. Confira novamente.');
    return p.dados;
  }
}

export const MODELOS_IA318=Symbol('MODELOS_IA318');
export const DIREITOS_IA318=Symbol('DIREITOS_IA318');
/** Requer evidência humana e alteração revisada; env/cliente não aprovam direitos. */
export const DIREITOS_BYOK318_APROVADOS=false;
