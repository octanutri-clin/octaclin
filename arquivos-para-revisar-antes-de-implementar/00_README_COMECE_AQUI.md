# COMEÇE AQUI — Pacote para revisão antes de implementar

Este diretório deve ser entregue **separadamente** ao Claude Code e ao Codex.

Nenhum dos dois deve ver a resposta do outro na primeira rodada.

## Objetivo

Revisar adversarialmente a proposta de governança e evolução do OctaClin antes de qualquer alteração no repositório.

## Ordem de leitura

1. `01_GOVERNANCA_AGENTES_E_REGRAS.md`
2. `02_SUGESTOES_COMPLEMENTARES_ANTES_DE_IMPLEMENTAR.md`
3. `03_REPOSITORIOS_EXTERNOS_PARA_AVALIACAO.md`
4. toda a pasta `proposta_arquitetura/`
5. `04_QUESTIONARIO_REVISAO_CLAUDE_CODE_E_CODEX.md`

Depois disso, o agente deve confrontar tudo com **o repositório real**.

## Regra da primeira rodada

**NÃO IMPLEMENTAR.**

Não:

- substituir `AGENTS.md`;
- criar `CLAUDE.md`;
- criar ruleset;
- criar workflows;
- instalar dependências;
- alterar CI;
- criar migrations;
- mudar código.

A primeira rodada é apenas:

```text
ler
→ verificar repo
→ atacar a proposta
→ recomendar
```

## O que esperamos de cada agente

- identificar erros;
- identificar omissões;
- apontar duplicações;
- encontrar documentação stale;
- conferir comandos e paths reais;
- avaliar seu próprio mecanismo de instruções;
- avaliar impacto em segurança;
- sugerir simplificações;
- dizer o que não deve ser implementado;
- classificar cada item.

## Não procurar consenso artificial

O agente deve discordar quando houver motivo.

Pergunta central:

> “Em que situações reais do OctaClin essa proposta pode falhar ou piorar o desenvolvimento?”

## Saída obrigatória

Seguir o formato do `04_QUESTIONARIO_REVISAO_CLAUDE_CODE_E_CODEX.md`.

## Segunda rodada

Após receber as duas respostas:

1. comparar Claude × Codex;
2. listar concordâncias;
3. listar divergências;
4. trazer ambos os pareceres para o debate triplo;
5. decidir a versão final;
6. somente então planejar implementação.

## Arquivos deste pacote

```text
00_README_COMECE_AQUI.md
01_GOVERNANCA_AGENTES_E_REGRAS.md
02_SUGESTOES_COMPLEMENTARES_ANTES_DE_IMPLEMENTAR.md
03_REPOSITORIOS_EXTERNOS_PARA_AVALIACAO.md
04_QUESTIONARIO_REVISAO_CLAUDE_CODE_E_CODEX.md

proposta_arquitetura/
├── AGENTS.md
├── CLAUDE.md
└── docs/
    └── agents/
        ├── README.md
        ├── SOURCE_OF_TRUTH.md
        ├── SAFETY_GATES.md
        ├── VALIDATION_MATRIX.md
        ├── CONCURRENCY.md
        ├── LESSONS_LEARNED.md
        └── ENVIRONMENT_PLAYBOOK.md
```

Este pacote é deliberadamente mais amplo que a implementação final. A revisão deve **reduzir e corrigir** a proposta antes de transformá-la em código/configuração real.
