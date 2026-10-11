import { registrarContextoPediatrico, projetarPediatrico } from './antropometria-pediatrica';

describe('snapshot pediátrico bloqueado até ratificação', () => {
  const contexto = { confirmado: true as const, nascimento: '2024-01-01', sexoCurva: 'nao_informado' as const, tecnica: 'deitado' as const, edema: 'desconhecido' as const, nascimentoTipo: 'prematuro' as const, semanasNascimento: 30, diasNascimento: 0, origemGestacional: 'documentada' as const, tipoMedida: 'pos_natal' as const };
  it('preserva valores originais, idade e quatro estados sem z/classificação', () => {
    const r = registrarContextoPediatrico(contexto, '2024-02-01', { pesoKg: 0.8, alturaCm: 28 });
    expect(r.idade?.dias).toBe(31);
    expect(r.idadePosMenstrualDias).toBe(241);
    expect(r.idadeCorrigidaDias).toBe(-39);
    expect(r.medidas).toEqual({ pesoKg: 0.8, alturaCm: 28 });
    expect(r.indicadores).toHaveLength(4);
    r.indicadores.forEach(i => expect(i).toEqual(expect.objectContaining({ estado: 'bloqueado', motivo: 'protocolo_nao_ratificado' })));
    expect(JSON.stringify(r)).not.toMatch(/escoreZ|percentil|classificacao/);
  });
  it('permite medidas parciais; não fabrica técnica ou edema', () => {
    const r = registrarContextoPediatrico(contexto, '2024-02-01', { pesoKg: 1 });
    expect(r.indicadores.find(i => i.indicador === 'estatura_idade')?.motivo).toBe('medida_ausente');
    expect(r.contexto.edema).toBe('desconhecido');
  });
  it('não permite habilitar protocolo através do payload nem da projeção', () => {
    const r = registrarContextoPediatrico({ ...contexto, habilitado: true } as typeof contexto, '2024-02-01', { pesoKg: 1 });
    expect(projetarPediatrico({ ...r, segredo: 'nao_retornar', indicadores: [{ indicador: 'peso_idade', estado: 'valido', escoreZ: 1 }] })).toBeUndefined();
    expect(projetarPediatrico({ ...r, segredo: 'nao_retornar' })).not.toHaveProperty('segredo');
  });
  it('rejeita falta de confirmação, medidas não finitas e IG incompleta', () => {
    expect(() => registrarContextoPediatrico({ ...contexto, confirmado: false } as never, '2024-02-01', { pesoKg: 1 })).toThrow();
    expect(() => registrarContextoPediatrico(contexto, '2024-02-01', { pesoKg: NaN })).toThrow();
    expect(() => registrarContextoPediatrico({ ...contexto, diasNascimento: undefined }, '2024-02-01', {})).toThrow();
  });
  it('rejeita conteúdo não escalar em campos conhecidos da projeção', () => {
    const r = registrarContextoPediatrico(contexto, '2024-02-01', { pesoKg: 1 });
    expect(projetarPediatrico({ ...r, contexto: { ...r.contexto, nascimento: { segredo: 'sintetico' } } })).toBeUndefined();
    expect(projetarPediatrico({ ...r, contexto: { ...r.contexto, semanasNascimento: undefined, diasNascimento: undefined, origemGestacional: { segredo: 'sintetico' } } })).toBeUndefined();
  });

});
