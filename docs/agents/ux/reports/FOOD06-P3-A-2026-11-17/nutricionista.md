# FOOD06 P3, etapa A — persona nutricionista (NUX)

**Síntese editorial do coordenador** a partir do retorno da instância; preserva IDs, prioridades, tipos e aceites. Etapa A, só plano,
base `91241b1`, entrada: `brief.md` (partes comum e do profissional). Persona fictícia: não é profissional real, validação clínica,
jurídica nem R4.

## Pontos positivos

Aviso fixo de ausência de alerta e vazio que não sugere ausência de restrição; aviso de reconfirmação que não bloqueia; inativação
em dois passos que repete tipo e alimento, sem reautenticação; origem em texto; estado de resultado incerto.

## Achados

| ID | Prio. | Tipo | Cenário / problema | Sugestão | Aceite verificável |
| --- | --- | --- | --- | --- | --- |
| NUX-01 | P1 | Risco plausível | Ana corrige "amendoin": inativar e depois registrar deixa intervalo sem a alergia ativa se o segundo passo falhar ou for esquecido | Fluxo "Corrigir registro" que salva o novo antes de inativar o antigo; motivo "registro incorreto" pré-selecionado; nunca como saída de bloqueio | Em nenhum momento, nem com falha no segundo passo, o item fica sem registro ativo; histórico liga antigo e novo |
| NUX-02 | P1 | Risco plausível | Carla vê a aba vazia de um paciente com alergia confirmada e pode dizer que "não há nada" | Texto próprio: "Você vê apenas as pendências que registrou. Outros registros podem existir." | O colaborador nunca vê "Nenhuma restrição registrada" |
| NUX-03 | P1 | Risco plausível | Justificativa interna escrita no campo visível ao paciente | Campos separados "O paciente verá" × "Somente equipe" e prévia do texto ao paciente | Prévia aparece antes do envio; em teste com pessoas ninguém troca os campos |
| NUX-04 | P2 | Hipótese de fricção | Atender correção obriga a sair da solicitação e citar a alteração | "Abrir item" e retorno à decisão com a alteração recém-feita pré-selecionada de uma lista | Ida e volta sem recarregar e sem digitar referência |
| NUX-05 | P2 | Risco plausível | 409 depois de 800 caracteres apaga a justificativa | Rascunho só em memória da sessão, oferecido após recarregar | Texto sobrevive ao conflito e some ao sair da ficha |
| NUX-06 | P2 | Risco plausível | 101º representante → 409 → recarrega → ciclo | Contador "98 de 100" e botão desabilitado com motivo | Com 100, botão desabilitado com o motivo |
| NUX-07 | P2 | Hipótese de fricção | "leite" e "proteína do leite" duplicados em texto livre | Aviso de item parecido (texto normalizado), sem bloquear | Texto equivalente mostra aviso com link |
| NUX-08 | P2 | Hipótese de fricção | Situação só aparece dentro da aba | Contador de pendências e reconfirmação vencida no cabeçalho, cor neutra | Pendência visível sem abrir a aba; nada "seguro/liberado" |
| NUX-09 | P2 | Sugestão | "Sem restrições declaradas" indisponível sem explicação | Opção desabilitada com o motivo e link | Motivo acessível por foco e leitor de tela |
| NUX-10 | P2 | Risco plausível | Lista de solicitações limitada a 100 | Filtro padrão "não decididas", da mais antiga, aviso no limite | Nenhuma aberta fora da lista sem sinal |
| NUX-11 | P3 | Clareza | Gravidade vazia × "não informada" | "Não informada" como padrão explícito | — |
| NUX-12 | P3 | Risco plausível | Colar texto com quebra na observação | Converter quebras em espaço | — |

Oportunidades: atalho do cabeçalho para a aba; link somente leitura "Ver restrições" no editor de plano, com o mesmo aviso;
pré-selecionar o meio da reconfirmação pelo tipo da consulta.

Perguntas: registrar já como confirmada para quem tem a permissão?; limite de 100 por paciente ou carteira?; como conferir quem já
teve acesso sem histórico de revogados?

Conclusão da persona: três P1 (NUX-01 a 03); demais ajustes proporcionais; não aprova ativação nem merge.
