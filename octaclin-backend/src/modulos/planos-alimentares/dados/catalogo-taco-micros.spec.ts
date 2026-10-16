import { calcularSha256Alimentos, montarCatalogoTaco, TACO_URL_ORIGEM } from './importador-taco';
/** ZIP armazenado mínimo, sem dependência adicional; fixture exclusivamente sintética. */
function zip(arquivos: Record<string, string>): Buffer {
  const locais: Buffer[] = [], centrais: Buffer[] = []; let offset = 0;
  for (const [nome, texto] of Object.entries(arquivos)) {
    const n = Buffer.from(nome), dados = Buffer.from(texto), local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt32LE(dados.length, 18); local.writeUInt32LE(dados.length, 22); local.writeUInt16LE(n.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt32LE(dados.length, 20); central.writeUInt32LE(dados.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locais.push(local, n, dados); centrais.push(central, n); offset += local.length + n.length + dados.length;
  }
  const centro = Buffer.concat(centrais), fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50); fim.writeUInt16LE(Object.keys(arquivos).length, 8); fim.writeUInt16LE(Object.keys(arquivos).length, 10); fim.writeUInt32LE(centro.length, 12); fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, centro, fim]);
}
const celula = (coluna: string, valor: string) => `<c r="${coluna}5" t="inlineStr"><is><t>${valor}</t></is></c>`;
const arquivo = zip({
  'xl/workbook.xml': '<workbook><sheets><sheet name="CMVCol taco3" r:id="r1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml': `<worksheet><sheetData><row r="4"><c r="A4" t="inlineStr"><is><t>Categoria sintética</t></is></c></row><row r="5">${Object.entries({ A:'1', B:'Alimento sintético', D:'100', F:'10', G:'5', I:'20', J:'2', R:'0', L:'0', Q:'Tr', V:'NA', W:'*', X:'2,1', AC:'3' }).map(([c,v])=>celula(c,v)).join('')}</row></sheetData></worksheet>`
});
describe('TACO v2 micros sem reescrita da v1', () => {
  it('mantém hash v2 sob a ordem de chaves retornada pelo JSONB', () => {
    const v2 = montarCatalogoTaco(arquivo, TACO_URL_ORIGEM, { micronutrientes:true });
    const retornados = v2.alimentos.map(a => ({...a, micronutrientes:Object.fromEntries(Object.entries(a.micronutrientes!).reverse().map(([k,v])=>[k,Object.fromEntries(Object.entries(v).reverse())]))}));
    expect(calcularSha256Alimentos(retornados)).toBe(v2.metadados.sha256Alimentos);
  });
  it('produz modo explícito novo e mantém default legado byte a byte', () => {
    const v1 = montarCatalogoTaco(arquivo);
    const v2 = montarCatalogoTaco(arquivo, TACO_URL_ORIGEM, { micronutrientes: true });
    expect(v1.metadados.versaoArtefato).toBe('taco-4a-cmvcol-taco3-v1');
    expect(v1.alimentos[0]).not.toHaveProperty('micronutrientes');
    expect(v2.metadados.versaoArtefato).toBe('taco-4a-cmvcol-taco3-v2-micros1');
    const { micronutrientes, ...legado } = v2.alimentos[0];
    expect(legado).toEqual(v1.alimentos[0]);
    expect(micronutrientes).toMatchObject({ calcioMg:{estado:'conhecido',valor:0}, ferroMg:{estado:'traco'}, retinolMcg:{estado:'nao_analisado'}, vitaminaAReMcg:{estado:'em_reavaliacao'}, vitaminaARaeMcg:{estado:'conhecido',valor:2.1} });
    expect(v1.metadados.sha256Alimentos).not.toBe(v2.metadados.sha256Alimentos);
    expect(montarCatalogoTaco(arquivo)).toEqual(v1);
  });
});

describe('artefato TACO v2 preparado sem carga externa', () => {
  it('preserva alimentos e atribuição da v1, com hash próprio e sem nutrientes extrapolados', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const { calcularSha256Alimentos, serializarCatalogoTaco } = require('./importador-taco');
    const v1 = JSON.parse(readFileSync(join(__dirname,'catalogo-taco-4a.json'),'utf8'));
    const texto = readFileSync(join(__dirname,'catalogo-taco-4a-micros1.json'),'utf8');
    const v2 = JSON.parse(texto);
    expect(v2.metadados.fonte).toEqual(v1.metadados.fonte);
    expect(v2.metadados.arquivoOrigem).toEqual(v1.metadados.arquivoOrigem);
    expect(v2.alimentos.map(({micronutrientes:_micros,...legado}: Record<string,unknown>)=>legado)).toEqual(v1.alimentos);
    expect(calcularSha256Alimentos(v2.alimentos)).toBe(v2.metadados.sha256Alimentos);
    expect(serializarCatalogoTaco(v2)).toBe(texto);
    expect(v2.alimentos[0].micronutrientes.cobreMg.estado).toBe('conhecido');
    expect(v2.alimentos.every((a:{micronutrientes:Record<string,unknown>})=>!('vitaminaDMcg' in a.micronutrientes))).toBe(true);
  });
});
