import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIMIAR_DIVERGENCIA_NUTRICIONAL,
  calcularSubtotalRefeicao,
  desviosDasMetas,
  nutrientesDaPorcao,
  totaisPrevistos,
  type ItemPrevisto
} from '@/lib/nutricao-plano';

// Fixture copiado de octaclin-backend/.../calculo-nutricional.spec.ts. Se o
// backend mudar o arredondamento, este teste quebra e avisa que a previa do
// editor passou a divergir do calculo que sera gravado.
test('nutrientesDaPorcao reproduz digito a digito o calculo do backend', () => {
  assert.deepEqual(
    nutrientesDaPorcao(
      {
        energiaKcal: 123.5349,
        proteinasG: 2.5883,
        carboidratosG: 25.8098,
        gordurasG: 1.0003,
        fibrasG: 2.7493,
        sodioMg: 1.244
      },
      150
    ),
    {
      energiaKcal: 185.3024,
      proteinasG: 3.8825,
      carboidratosG: 38.7147,
      gordurasG: 1.5005,
      fibrasG: 4.124,
      sodioMg: 1.866
    }
  );
});

test('nutrientesDaPorcao omite fibras e sodio quando a fonte nao informa', () => {
  const porcao = nutrientesDaPorcao(
    { energiaKcal: 100, proteinasG: 10, carboidratosG: 20, gordurasG: 5 },
    200
  );
  assert.equal(porcao.fibrasG, undefined);
  assert.equal(porcao.sodioMg, undefined);
  assert.equal(porcao.energiaKcal, 200);
});

// A porcao vem so de `porcaoGramas`; `quantidade`/`unidade` sao a medida
// caseira exibida. Multiplicar os dois aqui dobraria o plano do paciente.
test('nutrientesDaPorcao ignora a quantidade da medida caseira', () => {
  const base = { energiaKcal: 100, proteinasG: 0, carboidratosG: 0, gordurasG: 0 };
  assert.equal(nutrientesDaPorcao(base, 50).energiaKcal, 50);
});

// O backend valida e rejeita entrada incompleta, mas aqui o profissional ainda
// esta digitando: um campo momentaneamente vazio nao pode derrubar a previa.
test('nutrientesDaPorcao trata campo em branco como zero em vez de NaN', () => {
  const porcao = nutrientesDaPorcao(
    {
      energiaKcal: Number.NaN,
      proteinasG: undefined as unknown as number,
      carboidratosG: 20,
      gordurasG: 5
    },
    100
  );
  assert.equal(porcao.energiaKcal, 0);
  assert.equal(porcao.proteinasG, 0);
  assert.equal(porcao.carboidratosG, 20);
});

test('nutrientesDaPorcao trata porcao invalida como zero', () => {
  const base = { energiaKcal: 100, proteinasG: 10, carboidratosG: 20, gordurasG: 5 };
  assert.equal(nutrientesDaPorcao(base, Number.NaN).energiaKcal, 0);
  assert.equal(nutrientesDaPorcao(base, -50).energiaKcal, 0);
});

function item(gramas: number, nutrientes: Partial<ItemPrevisto['nutrientesPor100g']> = {}): ItemPrevisto {
  return {
    porcaoGramas: gramas,
    nutrientesPor100g: {
      energiaKcal: 100,
      proteinasG: 10,
      carboidratosG: 20,
      gordurasG: 5,
      ...nutrientes
    }
  };
}

test('totaisPrevistos soma apenas os itens principais', () => {
  const totais = totaisPrevistos([
    { itens: [item(100), item(100)] },
    { itens: [item(200)] }
  ]);
  assert.equal(totais.energiaKcal, 400);
  assert.equal(totais.proteinasG, 40);
});

// Espelha `calcularTotaisPlano`: um unico item sem o dado torna o total
// desconhecido. Somar como zero apresentaria um valor falso ao profissional.
test('totaisPrevistos devolve indefinido quando um item nao tem o nutriente', () => {
  const totais = totaisPrevistos([{ itens: [item(100, { fibrasG: 3 }), item(100)] }]);
  assert.equal(totais.fibrasG, undefined);
  assert.equal(totais.energiaKcal, 200);
});

test('totaisPrevistos soma fibras quando todos os itens informam', () => {
  const totais = totaisPrevistos([{ itens: [item(100, { fibrasG: 3 }), item(100, { fibrasG: 2 })] }]);
  assert.equal(totais.fibrasG, 5);
});

test('totaisPrevistos trata plano vazio sem quebrar', () => {
  assert.equal(totaisPrevistos([]).energiaKcal, 0);
  assert.equal(totaisPrevistos([{ itens: [] }]).energiaKcal, 0);
});

const metas = {
  metaEnergeticaKcal: 2000,
  metasMacronutrientes: { carboidratosG: 250, proteinasG: 100, gordurasG: 67 }
};

test('desviosDasMetas nao acusa divergencia dentro do limiar do backend', () => {
  const desvios = desviosDasMetas(
    { energiaKcal: 2000, proteinasG: 100, carboidratosG: 250, gordurasG: 67 },
    metas
  );
  assert.equal(desvios.every((desvio) => !desvio.excedeLimiar), true);
  assert.equal(desvios.length, 4);
});

// O backend usa `divergencia > 0.3`, entao exatamente 30% ainda publica. A
// previa tem de concordar, senao alerta o profissional sobre algo que passa.
test('desviosDasMetas libera exatamente o limiar e barra acima dele', () => {
  const noLimiar = desviosDasMetas(
    { energiaKcal: 2600, proteinasG: 100, carboidratosG: 250, gordurasG: 67 },
    metas
  );
  assert.equal(noLimiar.find((desvio) => desvio.rotulo === 'Energia')?.excedeLimiar, false);

  const acima = desviosDasMetas(
    { energiaKcal: 2601, proteinasG: 100, carboidratosG: 250, gordurasG: 67 },
    metas
  );
  assert.equal(acima.find((desvio) => desvio.rotulo === 'Energia')?.excedeLimiar, true);
});

test('desviosDasMetas marca total zerado como impeditivo', () => {
  const desvios = desviosDasMetas(
    { energiaKcal: 0, proteinasG: 100, carboidratosG: 250, gordurasG: 67 },
    metas
  );
  const energia = desvios.find((desvio) => desvio.rotulo === 'Energia');
  assert.equal(energia?.excedeLimiar, true);
  assert.equal(energia?.zerado, true);
});

test('limiar exportado acompanha o backend', () => {
  assert.equal(LIMIAR_DIVERGENCIA_NUTRICIONAL, 0.3);
});


test('PA03 calcula subtotal por refeição sem multiplicar quantidade caseira', () => {
  const subtotal = calcularSubtotalRefeicao([
    { identificacao: 'Item A', porcaoGramas: 150, nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 20, gordurasG: 5 } },
    { identificacao: 'Item B', porcaoGramas: 50, nutrientesPor100g: { energiaKcal: 200, proteinasG: 4, carboidratosG: 5, gordurasG: 10 } }
  ]);
  assert.deepEqual(subtotal, {
    estado: 'completo', energiaKcal: 250, proteinasG: 17, carboidratosG: 32.5, gordurasG: 12.5
  });
});

test('PA03 mantém indicadores calculáveis e não soma parcialmente indicador ausente', () => {
  const subtotal = calcularSubtotalRefeicao([
    { identificacao: 'Item A', porcaoGramas: 150, nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 20, gordurasG: 5 } },
    { identificacao: 'Item B', porcaoGramas: 50, nutrientesPor100g: { energiaKcal: 200, carboidratosG: 5, gordurasG: 10 } }
  ]);
  assert.deepEqual(subtotal, {
    estado: 'incompleto', energiaKcal: 250, proteinasG: undefined, carboidratosG: 32.5, gordurasG: 12.5
  });
});

test('PA03 distingue zero válido de ausência e rejeita dados numéricos inválidos', () => {
  const zero = calcularSubtotalRefeicao([
    { identificacao: 'Item', porcaoGramas: 100, nutrientesPor100g: { energiaKcal: 0, proteinasG: 0, carboidratosG: 0, gordurasG: 0 } }
  ]);
  assert.deepEqual(zero, { estado: 'completo', energiaKcal: 0, proteinasG: 0, carboidratosG: 0, gordurasG: 0 });

  const invalido = calcularSubtotalRefeicao([
    { identificacao: 'Item A', porcaoGramas: 100, nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 20, gordurasG: 5 } },
    { identificacao: 'Item B', porcaoGramas: 100, nutrientesPor100g: { energiaKcal: Number.POSITIVE_INFINITY, proteinasG: -1, carboidratosG: '2' as unknown as number, gordurasG: Number.NaN } }
  ]);
  assert.deepEqual(invalido, { estado: 'incompleto', energiaKcal: undefined, proteinasG: undefined, carboidratosG: undefined, gordurasG: undefined });

  const overflow = calcularSubtotalRefeicao([
    { identificacao: 'Item', porcaoGramas: 10_000, nutrientesPor100g: { energiaKcal: Number.MAX_VALUE, proteinasG: 10, carboidratosG: 20, gordurasG: 5 } }
  ]);
  assert.deepEqual(overflow, { estado: 'incompleto', energiaKcal: undefined, proteinasG: 1000, carboidratosG: 2000, gordurasG: 500 });
});

test('PA03 não trata refeição vazia ou item sem identificação como zero completo', () => {
  assert.deepEqual(calcularSubtotalRefeicao([]), {
    estado: 'sem_alimentos', energiaKcal: undefined, proteinasG: undefined, carboidratosG: undefined, gordurasG: undefined
  });
  assert.deepEqual(calcularSubtotalRefeicao([
    { identificacao: '', porcaoGramas: 100, nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 20, gordurasG: 5 } }
  ]), {
    estado: 'sem_alimentos', energiaKcal: undefined, proteinasG: undefined, carboidratosG: undefined, gordurasG: undefined
  });
  assert.deepEqual(calcularSubtotalRefeicao([
    { identificacao: 'Item', porcaoGramas: 100, nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 20, gordurasG: 5 } },
    { identificacao: '', porcaoGramas: 100, nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 20, gordurasG: 5 } }
  ]), {
    estado: 'incompleto', energiaKcal: undefined, proteinasG: undefined, carboidratosG: undefined, gordurasG: undefined
  });
});

test('PA03 rejeita porção inválida para todos os indicadores e arredonda por item', () => {
  const invalida = calcularSubtotalRefeicao([
    { identificacao: 'Item', porcaoGramas: 10_001, nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 20, gordurasG: 5 } }
  ]);
  assert.deepEqual(invalida, { estado: 'incompleto', energiaKcal: undefined, proteinasG: undefined, carboidratosG: undefined, gordurasG: undefined });

  const arredondado = calcularSubtotalRefeicao([
    { identificacao: 'A', porcaoGramas: 10, nutrientesPor100g: { energiaKcal: 1.005, proteinasG: 0, carboidratosG: 0, gordurasG: 0 } },
    { identificacao: 'B', porcaoGramas: 10, nutrientesPor100g: { energiaKcal: 1.005, proteinasG: 0, carboidratosG: 0, gordurasG: 0 } }
  ]);
  assert.equal(arredondado.energiaKcal, 0.201);
});

test('PA03 mantém indicadores parciais quando apenas o arredondamento final estoura', () => {
  const subtotal = calcularSubtotalRefeicao(['A', 'B'].map((identificacao) => ({
    identificacao,
    porcaoGramas: 100,
    nutrientesPor100g: { energiaKcal: 1e304, proteinasG: 1, carboidratosG: 1, gordurasG: 1 }
  })));
  assert.deepEqual(subtotal, {
    estado: 'incompleto', energiaKcal: undefined, proteinasG: 2, carboidratosG: 2, gordurasG: 2
  });
});
