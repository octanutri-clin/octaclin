import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { criarOpcoesTypeOrm } from './opcoes-typeorm';

export const fonteDados = new DataSource(criarOpcoesTypeOrm());
