import { metodoAdultoElegivel, DECISOES_18_19 } from './elegibilidade-adulta';
describe('CL08 REV9 ratificada: seis métodos a partir de 18 anos completos', () => {
  it.each(Object.keys(DECISOES_18_19) as Array<keyof typeof DECISOES_18_19>)('%s respeita mínimo inclusivo', metodo => {
    for (const idade of [undefined, NaN, Infinity, 17, 17.999]) expect(metodoAdultoElegivel(metodo, idade)).toBe(false);
    for (const idade of [18, 19, 20]) expect(metodoAdultoElegivel(metodo, idade)).toBe(true);
  });
});
