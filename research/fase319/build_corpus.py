"""Builds the frozen, fully synthetic retrieval corpus for Phase 319."""
from __future__ import annotations

import hashlib
import json
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).parent
SEED = 3190319
BASE_DATE = date(2020, 1, 1)


def created_for(ordinal: int) -> str:
    return (BASE_DATE + timedelta(days=ordinal)).isoformat()

# Query, source text, category, answerable. Every source is synthetic and
# authored for retrieval evaluation; none is a clinical recommendation.
CASES = [
    ("A pessoa prefere arroz integral no almoço.", "Relatou preferência por arroz integral em vez de arroz branco no almoço.", "paráfrase", True),
    ("Refere pouca ingestão de água durante o expediente.", "No trabalho costuma esquecer de beber água e relata baixa ingestão de líquidos.", "paráfrase", True),
    ("Foi registrada aversão a iogurte natural.", "Disse que não gosta do sabor do iogurte natural.", "paráfrase", True),
    ("A anotação confirma uso de bebida vegetal de aveia.", "Conta que usa bebida de aveia no café da manhã.", "paráfrase", True),
    ("O paciente relatou jantar depois das 22h.", "Janta geralmente por volta das dez e meia da noite.", "paráfrase", True),
    ("Existe uma observação sobre levar lanche à escola.", "Mencionou que leva uma fruta para comer no intervalo da escola.", "paráfrase", True),
    ("O registro fala de desconforto com alimentos muito condimentados.", "Referiu incômodo quando consome preparações bastante apimentadas.", "paráfrase", True),
    ("A pessoa prepara refeições para a semana no domingo.", "Relatou que cozinha e separa as refeições da semana aos domingos.", "paráfrase", True),
    ("Localize a menção a lentilha vermelha.", "Na lista de alimentos citados apareceu lentilha vermelha.", "termo-raro", True),
    ("Em qual evolução aparece o nome kefir de água?", "Foi anotado que experimentou kefir de água pela primeira vez.", "termo-raro", True),
    ("Procure o registro que cita amaranto.", "A conversa incluiu o alimento amaranto como ingrediente já conhecido.", "termo-raro", True),
    ("Qual nota menciona farinha de grão-de-bico?", "Informou que usa farinha de grão-de-bico em algumas receitas.", "termo-raro", True),
    ("A pessoa não consome leite de vaca.", "Nega consumo de leite de vaca; a anotação não informa intolerância.", "negação", True),
    ("Foi relatado que não costuma pular o café da manhã?", "Disse que não costuma pular o café da manhã nos dias úteis.", "negação", True),
    ("A evolução diz que a pessoa consome peixe?", "Relatou que não come peixe há vários meses.", "negação", True),
    ("Localize a hipótese de que o lanche causa desconforto, não uma confirmação.", "Relatou desconforto após o lanche em uma ocasião, sem afirmar relação causal.", "negação", True),
    ("Qual foi o peso anotado em 12 de março?", "Em 12/03/2025 foi registrado peso de 68,4 kg (valor sintético).", "número-data", True),
    ("Localize a medida de 1,72 m.", "Estatura referida na anotação: 1,72 m, medida sintética para teste.", "número-unidade", True),
    ("Qual quantidade de água, em mililitros, foi citada?", "A pessoa mencionou levar uma garrafa de 750 mL ao trabalho.", "número-unidade", True),
    ("Encontre o registro de 3,5 g de fibra.", "O exemplo sintético da embalagem citada informa 3,5 g de fibra por porção.", "número-unidade", True),
    ("O que foi combinado para a próxima conversa em 5 de abril?", "Próxima conversa combinada para 05/04/2025.", "data", True),
    ("Localize a nota sobre acordar às seis e quinze.", "Em dias presenciais, desperta às 06:15.", "horário", True),
    ("Existe registro de uso de um copo de 200 ml?", "Descreveu como referência um copo com capacidade aproximada de 200 mL.", "número-unidade", True),
    ("Procure o valor 42,7 que aparece na anotação.", "Exemplo de rótulo mencionado: 42,7 g por porção declarada.", "número", True),
    ("Qual evolução cita manga no lanche da tarde?", "À tarde costuma escolher manga como fruta do lanche.", "fonte-antiga", True),
    ("Há anotação sobre uma feira visitada em janeiro?", "Em janeiro comentou que visitou uma feira de produtores locais.", "fonte-antiga", True),
    ("O registro mais antigo fala de pão de fermentação natural?", "Mencionou pão de fermentação natural em uma conversa inicial.", "fonte-antiga", True),
    ("Localize a preferência por sopa no jantar nas notas antigas.", "Em uma anotação antiga contou que prefere sopa no jantar durante o inverno.", "fonte-antiga", True),
    ("Qual texto descreve uma receita de milho roxo?", "Compartilhou uma receita de milho roxo que conheceu em uma viagem.", "termo-raro", True),
    ("Existe nota que mencione água com gás?", "Disse que às vezes escolhe água com gás no almoço.", "paráfrase", True),
    ("Qual documento registra chá de hibisco?", "O chá de hibisco foi citado como bebida que experimentou.", "termo-raro", True),
    ("Encontre uma nota sobre couve-flor assada.", "Comentou que preparou couve-flor assada para o jantar.", "paráfrase", True),
    ("Há relato de que a pessoa deixou de consumir café?", "Informou que parou de tomar café no período da tarde.", "negação", True),
    ("Qual avaliação menciona rotina de turnos noturnos?", "Descreveu trabalho em turnos noturnos alternados.", "paráfrase", True),
    ("Procure uma referência a castanha de baru.", "A conversa registrou castanha de baru entre os alimentos que conhece.", "termo-raro", True),
    ("O prontuário informa consumo de tofu nesta semana?", "Não há menção a tofu nesta semana; o texto fala apenas de feijão.", "sem-resposta", False),
    ("Existe algum registro de suplemento de zinco?", "As notas disponíveis não citam suplemento de zinco.", "sem-resposta", False),
    ("Qual nota descreve caminhada na neve?", "Nenhuma anotação deste conjunto fala sobre caminhada na neve.", "sem-resposta", False),
    ("Foi registrada alergia a kiwi?", "Não existe informação sobre alergia a kiwi nas notas sintéticas.", "sem-resposta", False),
    ("O histórico registra consumo de pitaya amarela?", "Nenhuma evolução menciona pitaya amarela.", "sem-resposta", False),
]

assert len(CASES) == 40

def main() -> None:
    random.seed(SEED)
    docs = []
    queries = []
    for i, (query, target, category, answerable) in enumerate(CASES, start=1):
        partition = "dev" if i <= 10 else "test"
        sid = f"syn-{i:03}"
        # Put four relevant source notes late to exercise chronological coverage.
        index = 200 + i if category == "fonte-antiga" else i
        docs.append({"id": sid, "tenant": "tenant-sim-1", "patient": "patient-sim-1",
                     "ordinal": index, "created": created_for(index),
                     "text": target, "synthetic": True})
        queries.append({"id": f"q-{i:03}", "partition": partition, "category": category,
                        "query": query, "answerable": answerable,
                        "gold": [{"sourceId": sid, "grade": 2}] if answerable else []})

        # Hard negatives reuse an entity or phrase but assert a different fact.
        docs.append({"id": f"neg-{i:03}", "tenant": "tenant-sim-1", "patient": "patient-sim-1",
                     "ordinal": 100 + i, "created": created_for(100 + i),
                     "text": f"Exemplo sintético distinto: o termo {target.split()[0].lower()} apareceu em uma lista genérica, sem relato pessoal correspondente.",
                     "synthetic": True})
    # Add 120 generic records to create ranking noise without changing gold labels.
    filler = [
        "Foi revisada a organização das refeições nos dias de rotina habitual.",
        "A pessoa comentou que faz compras em mercados próximos de casa.",
        "Conversaram sobre horários disponíveis para a próxima consulta.",
        "Foi relatada preferência por refeições preparadas em casa.",
        "A pessoa descreveu mudanças na agenda de trabalho nesta quinzena.",
        "A conversa abordou opções variadas para o almoço de fim de semana.",
        "Registrou-se uma dúvida sobre a leitura de informações em embalagens.",
        "Foi mencionado o planejamento de uma lista de compras mensal.",
    ]
    for i in range(120):
        docs.append({"id": f"fill-{i:03}", "tenant": "tenant-sim-1", "patient": "patient-sim-1",
                     "ordinal": 1000 + i, "created": created_for(1000 + i), "text": filler[i % len(filler)],
                     "synthetic": True})
    # Cross-scope decoys must never enter a patient's candidate set.
    for i in range(10):
        docs.append({"id": f"other-{i:03}", "tenant": "tenant-sim-2", "patient": "patient-sim-2",
                     "ordinal": i, "created": "2019-01-01", "text": CASES[i][1], "synthetic": True})
    data = {"schema": 1, "seed": SEED, "syntheticOnly": True,
            "goldMethod": "gold IDs assigned by construction to the authored source; no independent human relevance review",
            "queries": queries, "documents": docs}
    path = ROOT / "corpus.json"
    raw = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode()
    path.write_bytes(raw)
    (ROOT / "corpus.sha256").write_text(hashlib.sha256(raw).hexdigest() + "  corpus.json\n")
    print(f"wrote {path}: {len(queries)} queries, {len(docs)} documents, sha256={hashlib.sha256(raw).hexdigest()}")

if __name__ == "__main__":
    main()
