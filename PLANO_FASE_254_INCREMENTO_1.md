# Fase 254 Incremento 1 - Plano de implementacao

> **Para executores agenticos:** SUB-SKILL OBRIGATORIA: usar
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam
> caixas de selecao (`- [ ]`) para acompanhamento.

**Goal:** Entregar a fundacao de dados e servicos da Fase 254 - a tabela
`filtros_salvos_pacientes`, o servico que a opera e o servico de verificacao de
duplicidade - sem nenhuma mudanca de interface.

**Architecture:** A tabela nova copia a forma de `receitas_nutricionais`
(migration `1033`): mesma dupla `origem`/`profissional_id`, FK composta por
`(tenant_id, id)` e RLS `force` por `app.tenant_id`. O servico segue
`ServicoReceitasNutricionais`, que e o analogo mais proximo no repositorio. A
verificacao de duplicidade nao adiciona DDL: consulta o indice GIN
`busca_hashes` que a migration `1013` ja criou.

**Tech Stack:** NestJS, TypeORM, PostgreSQL (Neon), Jest.

**Spec:** `fase-254-lista-cadastro-robusto-pacientes.md`

## Global Constraints

- Todo acesso a dado passa por `ExecutorTenant.executar`, que abre transacao e
  faz `set_config('app.tenant_id', ...)`. Nenhuma consulta fora dele.
- Nome de paciente nunca entra em log de auditoria. Metadados guardam UUID.
- Texto livre de busca nunca e persistido em filtro salvo.
- A migration precisa entrar no array explicito de `migrations` em
  `opcoes-typeorm.ts`. Criar o arquivo nao registra a migration e o CI nao pega
  isso.
- Migration `1035` e aditiva e nao tem backfill: a tabela nasce vazia.
- Sem interface neste incremento. Sem rota BFF em `octaclin-web`: rota sem
  consumidor e codigo morto em producao, e entra no Incremento 2 junto da tela.
- Teto: 20 filtros ativos por profissional e 20 de clinica por tenant.
  Arquivado nao conta.
- Maximo de 5 candidatos por verificacao de duplicidade.
- `catalogo-taco.spec.ts` falha sempre neste checkout Windows por `LF/CRLF` e
  passa no CI. Nao e regressao e o JSON nao se normaliza.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001035-CriarFiltrosSalvosPacientes.ts` | DDL da tabela |
| `.../migracoes/1720000001035-CriarFiltrosSalvosPacientes.spec.ts` | Verificacao do SQL gerado |
| `.../banco-dados/opcoes-typeorm.ts` | Registro da entidade e da migration |
| `octaclin-backend/src/modulos/pacientes/dominio/filtros-salvos.ts` | Tipos, allowlist de criterios e validacao pura |
| `.../dominio/filtros-salvos.spec.ts` | Testes da validacao pura |
| `.../infraestrutura/filtro-salvo-paciente.orm.ts` | Entidade TypeORM |
| `.../aplicacao/dtos-filtros-salvos.ts` | DTOs de entrada |
| `.../aplicacao/servico-filtros-salvos-pacientes.ts` | Criar, listar, arquivar |
| `.../aplicacao/servico-filtros-salvos-pacientes.spec.ts` | Testes do servico |
| `.../aplicacao/servico-duplicidade-pacientes.ts` | Duplicidade compartilhada, extraida do perfil |
| `.../aplicacao/servico-duplicidade-pacientes.spec.ts` | Testes da duplicidade |
| `.../aplicacao/servico-perfil-cadastro-paciente.ts` | Perde o metodo privado e passa a delegar |
| `.../apresentacao/controlador-filtros-salvos-pacientes.ts` | Rotas HTTP |
| `.../modulo-pacientes.ts` | Fiacao dos servicos novos |

A validacao de criterios fica em `dominio/` e nao dentro do servico de
proposito: e logica pura, testavel sem banco, e o Incremento 3 vai reusa-la para
marcar filtro desatualizado.

---

### Task 1: Migration 1035 e registro

**Files:**
- Create: `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001035-CriarFiltrosSalvosPacientes.ts`
- Test: `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001035-CriarFiltrosSalvosPacientes.spec.ts`
- Modify: `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts`

**Interfaces:**
- Consumes: nada.
- Produces: a tabela `filtros_salvos_pacientes` e a classe
  `CriarFiltrosSalvosPacientes1720000001035`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `1720000001035-CriarFiltrosSalvosPacientes.spec.ts`:

```ts
import { CriarFiltrosSalvosPacientes1720000001035 } from './1720000001035-CriarFiltrosSalvosPacientes';

describe('CriarFiltrosSalvosPacientes1720000001035', () => {
  async function sqlDaMigracao(): Promise<string> {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarFiltrosSalvosPacientes1720000001035().up({ query } as never);
    return String(query.mock.calls[0][0]);
  }

  it('cria a tabela aditiva com RLS forcada por tenant', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('create table if not exists filtros_salvos_pacientes');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('isolamento_tenant_filtros_salvos_pacientes');
  });

  it('restringe origem e mantem as FKs compostas no tenant', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain("origem in ('pessoal', 'clinica')");
    expect(sql).toContain('foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id) on delete cascade');
    expect(sql).toContain('foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict');
    expect(sql).toContain('filtros_salvos_pacientes_origem_profissional_check');
  });

  it('guarda o nome cifrado, os criterios em jsonb e indexa a listagem', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('nome_criptografado bytea not null');
    expect(sql).toContain('criterios jsonb not null');
    expect(sql).toContain('idx_filtros_salvos_pacientes_listagem');
    expect(sql).toContain('idx_filtros_salvos_pacientes_profissional');
  });

  it('e reversivel fora de producao', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarFiltrosSalvosPacientes1720000001035().down({ query } as never);
    expect(String(query.mock.calls[0][0])).toContain('drop table if exists filtros_salvos_pacientes');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```
cd octaclin-backend && pnpm test -- 1720000001035
```
Esperado: FAIL, modulo nao encontrado.

- [ ] **Step 3: Escrever a migration**

Criar `1720000001035-CriarFiltrosSalvosPacientes.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Visoes de trabalho salvas da lista de pacientes.
 *
 * Guarda apenas criterio estruturado. O texto da busca livre fica de fora de
 * proposito: ele aceita nome e CPF, e um filtro de clinica carregando esse
 * texto vazaria PII para toda a equipe.
 */
export class CriarFiltrosSalvosPacientes1720000001035 implements MigrationInterface {
  name = 'CriarFiltrosSalvosPacientes1720000001035';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists filtros_salvos_pacientes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        origem varchar(20) not null check (origem in ('pessoal', 'clinica')),
        profissional_id uuid,
        nome_criptografado bytea not null,
        criterios jsonb not null,
        criado_por_usuario_id uuid not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        arquivado_em timestamptz,
        constraint ux_filtros_salvos_pacientes_tenant_id_id unique (tenant_id, id),
        constraint fk_filtros_salvos_pacientes_profissional
          foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id) on delete cascade,
        constraint fk_filtros_salvos_pacientes_usuario
          foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict,
        constraint filtros_salvos_pacientes_origem_profissional_check check (
          (origem = 'pessoal' and profissional_id is not null)
          or (origem = 'clinica' and profissional_id is null)
        )
      );
      create index if not exists idx_filtros_salvos_pacientes_listagem
        on filtros_salvos_pacientes (tenant_id, origem, arquivado_em, atualizado_em desc);
      create index if not exists idx_filtros_salvos_pacientes_profissional
        on filtros_salvos_pacientes (tenant_id, profissional_id, arquivado_em, atualizado_em desc)
        where profissional_id is not null;
      alter table filtros_salvos_pacientes enable row level security;
      alter table filtros_salvos_pacientes force row level security;
      create policy isolamento_tenant_filtros_salvos_pacientes on filtros_salvos_pacientes
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists filtros_salvos_pacientes cascade;');
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```
cd octaclin-backend && pnpm test -- 1720000001035
```
Esperado: PASS, 4 testes.

- [ ] **Step 5: Registrar a migration**

Em `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts`, ao lado
do import da `1034` (linha 49), acrescentar:

```ts
import { CriarFiltrosSalvosPacientes1720000001035 } from './migracoes/1720000001035-CriarFiltrosSalvosPacientes';
```

E no array `migrations`, depois de `ProtegerResolucaoAgendaPublica1720000001034`
(linha 304):

```ts
        ProtegerResolucaoAgendaPublica1720000001034,
        CriarFiltrosSalvosPacientes1720000001035
```

A entidade entra no array `entities` na Task 2, quando existir.

- [ ] **Step 6: Confirmar o registro**

```
cd octaclin-backend && pnpm test -- migracoes-registradas
```

Se nao houver suite com esse nome, rodar a suite que compara o array com os
arquivos da pasta, introduzida no PR `#61`:

```
cd octaclin-backend && pnpm test -- opcoes-typeorm
```
Esperado: PASS. Se falhar por migration ausente do array, o Step 5 nao foi
aplicado.

- [ ] **Step 7: Commit**

```bash
git add octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001035-CriarFiltrosSalvosPacientes.ts \
        octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001035-CriarFiltrosSalvosPacientes.spec.ts \
        octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts
git commit -m "feat(fase-254): criar tabela de filtros salvos de pacientes"
```

---

### Task 2: Dominio e entidade

**Files:**
- Create: `octaclin-backend/src/modulos/pacientes/dominio/filtros-salvos.ts`
- Test: `octaclin-backend/src/modulos/pacientes/dominio/filtros-salvos.spec.ts`
- Create: `octaclin-backend/src/modulos/pacientes/infraestrutura/filtro-salvo-paciente.orm.ts`
- Modify: `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts` (array `entities`, linha 178)

**Interfaces:**
- Consumes: a tabela da Task 1.
- Produces:
  - `type OrigemFiltroSalvo = 'pessoal' | 'clinica'`
  - `interface CriteriosFiltroSalvo { risco?: 'alto' | 'medio' | 'baixo'; status?: string; profissionalId?: string; semProximaConsulta?: boolean }`
  - `function validarCriteriosFiltroSalvo(entrada: unknown): CriteriosFiltroSalvo` - lanca `Error` com mensagem em portugues quando ha chave desconhecida ou valor invalido.
  - `const TETO_FILTROS_SALVOS = 20`
  - `class FiltroSalvoPacienteOrm`

- [ ] **Step 1: Escrever o teste que falha**

Criar `dominio/filtros-salvos.spec.ts`:

```ts
import { validarCriteriosFiltroSalvo } from './filtros-salvos';

describe('validarCriteriosFiltroSalvo', () => {
  it('aceita o conjunto conhecido de criterios', () => {
    const criterios = validarCriteriosFiltroSalvo({
      risco: 'alto',
      status: 'em_acompanhamento',
      profissionalId: '10000000-0000-4000-8000-000000000003',
      semProximaConsulta: true
    });
    expect(criterios.risco).toBe('alto');
    expect(criterios.semProximaConsulta).toBe(true);
  });

  it('aceita objeto vazio', () => {
    expect(validarCriteriosFiltroSalvo({})).toEqual({});
  });

  it('rejeita chave desconhecida em vez de ignorar', () => {
    expect(() => validarCriteriosFiltroSalvo({ busca: 'Maria' }))
      .toThrow('Criterio nao suportado em filtro salvo: busca.');
  });

  it('rejeita texto livre disfarcado de criterio conhecido', () => {
    expect(() => validarCriteriosFiltroSalvo({ risco: 'Maria' }))
      .toThrow('Criterio invalido em filtro salvo: risco.');
  });

  it('rejeita entrada que nao e objeto', () => {
    expect(() => validarCriteriosFiltroSalvo(null)).toThrow('Criterios de filtro salvo invalidos.');
    expect(() => validarCriteriosFiltroSalvo([])).toThrow('Criterios de filtro salvo invalidos.');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```
cd octaclin-backend && pnpm test -- filtros-salvos
```
Esperado: FAIL, modulo nao encontrado.

- [ ] **Step 3: Escrever o dominio**

Criar `dominio/filtros-salvos.ts`:

```ts
export type OrigemFiltroSalvo = 'pessoal' | 'clinica';

export interface CriteriosFiltroSalvo {
  risco?: 'alto' | 'medio' | 'baixo';
  status?: string;
  profissionalId?: string;
  semProximaConsulta?: boolean;
}

/** Teto por profissional e, separadamente, de filtros de clinica por tenant. */
export const TETO_FILTROS_SALVOS = 20;

const RISCOS = ['alto', 'medio', 'baixo'];
const STATUS = ['novo', 'aderente', 'em_acompanhamento', 'risco', 'inativo'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Allowlist estrita. Chave desconhecida e erro e nao omissao silenciosa: o
 * texto da busca livre aceita nome e CPF, e ignorar em silencio deixaria o
 * chamador achar que salvou algo que nao salvou.
 */
export function validarCriteriosFiltroSalvo(entrada: unknown): CriteriosFiltroSalvo {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw new Error('Criterios de filtro salvo invalidos.');
  }

  const criterios: CriteriosFiltroSalvo = {};
  for (const [chave, valor] of Object.entries(entrada as Record<string, unknown>)) {
    if (valor === undefined || valor === null) continue;
    switch (chave) {
      case 'risco':
        if (typeof valor !== 'string' || !RISCOS.includes(valor)) throw invalido(chave);
        criterios.risco = valor as CriteriosFiltroSalvo['risco'];
        break;
      case 'status':
        if (typeof valor !== 'string' || !STATUS.includes(valor)) throw invalido(chave);
        criterios.status = valor;
        break;
      case 'profissionalId':
        if (typeof valor !== 'string' || !UUID.test(valor)) throw invalido(chave);
        criterios.profissionalId = valor;
        break;
      case 'semProximaConsulta':
        if (typeof valor !== 'boolean') throw invalido(chave);
        criterios.semProximaConsulta = valor;
        break;
      default:
        throw new Error(`Criterio nao suportado em filtro salvo: ${chave}.`);
    }
  }
  return criterios;
}

function invalido(chave: string) {
  return new Error(`Criterio invalido em filtro salvo: ${chave}.`);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```
cd octaclin-backend && pnpm test -- filtros-salvos
```
Esperado: PASS, 5 testes.

- [ ] **Step 5: Criar a entidade**

Criar `infraestrutura/filtro-salvo-paciente.orm.ts`:

```ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { CriteriosFiltroSalvo, OrigemFiltroSalvo } from '../dominio/filtros-salvos';

@Entity('filtros_salvos_pacientes')
@Index('idx_filtros_salvos_pacientes_listagem', ['tenantId', 'origem', 'arquivadoEm', 'atualizadoEm'])
@Index('idx_filtros_salvos_pacientes_profissional', ['tenantId', 'profissionalId', 'arquivadoEm', 'atualizadoEm'], {
  where: 'profissional_id is not null'
})
export class FiltroSalvoPacienteOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 20 })
  origem: OrigemFiltroSalvo;

  @Column({ name: 'profissional_id', type: 'uuid', nullable: true })
  profissionalId?: string;

  @Column({ name: 'nome_criptografado', type: 'bytea' })
  nomeCriptografado: Buffer;

  /** Somente criterio estruturado; texto livre de busca nunca e persistido. */
  @Column({ type: 'jsonb' })
  criterios: CriteriosFiltroSalvo;

  @Column({ name: 'criado_por_usuario_id', type: 'uuid' })
  criadoPorUsuarioId: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;

  @Column({ name: 'arquivado_em', type: 'timestamptz', nullable: true })
  arquivadoEm?: Date;
}
```

Registrar a entidade no array `entities` de `opcoes-typeorm.ts` (linha 178),
com o import correspondente no topo do arquivo.

- [ ] **Step 6: Confirmar que compila**

```
cd octaclin-backend && pnpm typecheck
```
Esperado: sem erros.

- [ ] **Step 7: Commit**

```bash
git add octaclin-backend/src/modulos/pacientes/dominio/filtros-salvos.ts \
        octaclin-backend/src/modulos/pacientes/dominio/filtros-salvos.spec.ts \
        octaclin-backend/src/modulos/pacientes/infraestrutura/filtro-salvo-paciente.orm.ts \
        octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts
git commit -m "feat(fase-254): validar criterios e mapear filtro salvo"
```

---

### Task 3: Servico de filtros salvos - criar

**Files:**
- Create: `octaclin-backend/src/modulos/pacientes/aplicacao/dtos-filtros-salvos.ts`
- Create: `octaclin-backend/src/modulos/pacientes/aplicacao/servico-filtros-salvos-pacientes.ts`
- Test: `octaclin-backend/src/modulos/pacientes/aplicacao/servico-filtros-salvos-pacientes.spec.ts`

**Interfaces:**
- Consumes: `validarCriteriosFiltroSalvo`, `TETO_FILTROS_SALVOS`,
  `FiltroSalvoPacienteOrm` da Task 2; `ExecutorTenant.executar`,
  `CriptografiaDadosSensiveis.criptografar/descriptografar`,
  `resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario)`.
- Produces: `ServicoFiltrosSalvosPacientes.criar(tenantId, usuario, dados): Promise<ResumoFiltroSalvo>`
  onde `ResumoFiltroSalvo = { id, nome, origem, criterios, atualizadoEm }`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `servico-filtros-salvos-pacientes.spec.ts`. Reusar o padrao de repositorio
em memoria de `servico-receitas-nutricionais.spec.ts` (mesma pasta vizinha, em
`modulos/planos-alimentares/aplicacao/`), copiando `criarRepositorio` e
`filtrar` para este arquivo:

```ts
import { ForbiddenException } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoFiltrosSalvosPacientes } from './servico-filtros-salvos-pacientes';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';
const PROFISSIONAL_ID = '10000000-0000-4000-8000-000000000003';

function profissional(): UsuarioAutenticado {
  return {
    usuarioId: USUARIO_ID,
    tenantId: TENANT_ID,
    papel: 'Professional',
    emailHash: 'hash',
    permissoes: ['pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar']
  };
}

function colaborador(): UsuarioAutenticado {
  return { ...profissional(), papel: 'Collaborator', permissoes: ['pacientes.listar', 'pacientes.ler'] };
}

describe('ServicoFiltrosSalvosPacientes.criar', () => {
  it('cifra o nome e guarda somente criterio estruturado', async () => {
    const { servico, repositorio, criptografia } = montar();
    const resumo = await servico.criar(TENANT_ID, profissional(), {
      nome: 'Risco alto sem retorno',
      origem: 'pessoal',
      criterios: { risco: 'alto', semProximaConsulta: true }
    });

    const salvo = repositorio.registros[0];
    expect(Buffer.isBuffer(salvo.nomeCriptografado)).toBe(true);
    expect(criptografia.descriptografar(salvo.nomeCriptografado)).toBe('Risco alto sem retorno');
    expect(salvo.criterios).toEqual({ risco: 'alto', semProximaConsulta: true });
    expect(resumo.nome).toBe('Risco alto sem retorno');
  });

  it('rejeita o texto da busca livre', async () => {
    const { servico } = montar();
    await expect(servico.criar(TENANT_ID, profissional(), {
      nome: 'Maria', origem: 'pessoal', criterios: { busca: 'Maria' } as never
    })).rejects.toThrow('Criterio nao suportado em filtro salvo: busca.');
  });

  it('exige pacientes.gerenciar para filtro de clinica', async () => {
    const { servico } = montar();
    await expect(servico.criar(TENANT_ID, colaborador(), {
      nome: 'Da clinica', origem: 'clinica', criterios: {}
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('filtro pessoal exige profissional vinculado e clinica exige nulo', async () => {
    const { servico, repositorio } = montar();
    await servico.criar(TENANT_ID, profissional(), { nome: 'Minha', origem: 'pessoal', criterios: {} });
    await servico.criar(TENANT_ID, profissional(), { nome: 'Nossa', origem: 'clinica', criterios: {} });
    expect(repositorio.registros[0].profissionalId).toBe(PROFISSIONAL_ID);
    expect(repositorio.registros[1].profissionalId).toBeUndefined();
  });

  it('barra ao atingir o teto de filtros ativos', async () => {
    const { servico, repositorio } = montar();
    repositorio.registros = Array.from({ length: 20 }, (_, indice) => ({
      id: `id-${indice}`, tenantId: TENANT_ID, origem: 'pessoal',
      profissionalId: PROFISSIONAL_ID, arquivadoEm: null
    }));
    await expect(servico.criar(TENANT_ID, profissional(), {
      nome: 'Excedente', origem: 'pessoal', criterios: {}
    })).rejects.toThrow('Limite de 20 filtros salvos atingido.');
  });

  it('filtro arquivado nao conta para o teto', async () => {
    const { servico, repositorio } = montar();
    repositorio.registros = Array.from({ length: 20 }, (_, indice) => ({
      id: `id-${indice}`, tenantId: TENANT_ID, origem: 'pessoal',
      profissionalId: PROFISSIONAL_ID, arquivadoEm: new Date()
    }));
    await expect(servico.criar(TENANT_ID, profissional(), {
      nome: 'Cabe', origem: 'pessoal', criterios: {}
    })).resolves.toBeDefined();
  });
});
```

Com `montar()` no mesmo arquivo:

```ts
/** Casa a condicao do TypeORM; IsNull() chega como objeto com _type 'isNull'. */
function casa(registro: any, condicao: any): boolean {
  return Object.entries(condicao).every(([chave, valor]: [string, any]) => {
    if (valor && typeof valor === 'object' && valor._type === 'isNull') {
      return registro[chave] === undefined || registro[chave] === null;
    }
    return registro[chave] === valor;
  });
}

function criarRepositorio(iniciais: any[] = []) {
  const repositorio = {
    registros: [...iniciais] as any[],
    find: jest.fn(async (opcoes: any = {}) => {
      const condicoes = Array.isArray(opcoes.where) ? opcoes.where : [opcoes.where].filter(Boolean);
      if (!condicoes.length) return [...repositorio.registros];
      return repositorio.registros.filter((registro) =>
        condicoes.some((condicao: any) => casa(registro, condicao)));
    }),
    findOne: jest.fn(async (opcoes: any) =>
      repositorio.registros.find((registro) => registro.id === opcoes.where.id) ?? null),
    count: jest.fn(async (opcoes: any) => repositorio.registros.filter((registro) =>
      registro.origem === opcoes.where.origem
      && (opcoes.where.profissionalId === undefined || registro.profissionalId === opcoes.where.profissionalId)
      && !registro.arquivadoEm).length),
    create: jest.fn((dados: any) => ({ id: `filtro-${repositorio.registros.length}`, atualizadoEm: new Date(), ...dados })),
    save: jest.fn(async (registro: any) => {
      const indice = repositorio.registros.findIndex((existente) => existente.id === registro.id);
      if (indice >= 0) repositorio.registros[indice] = registro;
      else repositorio.registros.push(registro);
      return registro;
    })
  };
  return repositorio;
}

function montar() {
  const criptografia = new CriptografiaDadosSensiveis();
  const repositorio = criarRepositorio();
  const profissionais = {
    findOne: jest.fn(async () => ({
      id: PROFISSIONAL_ID, tenantId: TENANT_ID, usuarioId: USUARIO_ID, arquivadoEm: null
    }))
  };
  const gerenciador = {
    getRepository: (entidade: any) => (entidade.name === 'ProfissionalOrm' ? profissionais : repositorio)
  };
  const executorTenant = {
    executar: async (_tenantId: string, operacao: any) => operacao(gerenciador)
  } as unknown as ExecutorTenant;

  return {
    servico: new ServicoFiltrosSalvosPacientes(executorTenant, criptografia),
    repositorio,
    criptografia
  };
}
```

A `CriptografiaDadosSensiveis` e usada de verdade, sem duble: ela nao toca o
banco, so `process.env.CRIPTOGRAFIA_CHAVE_AES_256`, que tem padrao local. Isso
faz o teste de cifra provar cifra de verdade em vez de provar o duble.

O `find` do duble honra o `where` como um OU entre as condicoes, que e como o
TypeORM trata um array. Isso importa: o `listar` da Task 4 delega toda a
visibilidade a esse array, entao um duble permissivo devolveria o filtro pessoal
de outro profissional e o teste passaria escondendo o vazamento.

Os testes de `count` e `findOne` deste arquivo tambem dependem do duble, e os
tres precisam ser fieis ao TypeORM naquilo que o servico usa - nada alem disso.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```
cd octaclin-backend && pnpm test -- servico-filtros-salvos-pacientes
```
Esperado: FAIL, modulo nao encontrado.

- [ ] **Step 3: Escrever os DTOs**

Criar `aplicacao/dtos-filtros-salvos.ts`:

```ts
import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { CriteriosFiltroSalvo, OrigemFiltroSalvo } from '../dominio/filtros-salvos';

export class CriarFiltroSalvoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nome: string;

  @IsIn(['pessoal', 'clinica'])
  origem: OrigemFiltroSalvo;

  @IsObject()
  criterios: CriteriosFiltroSalvo;
}

export class ListarFiltrosSalvosDto {
  @IsOptional()
  @IsIn(['pessoal', 'clinica'])
  origem?: OrigemFiltroSalvo;
}
```

- [ ] **Step 4: Escrever o servico**

Criar `aplicacao/servico-filtros-salvos-pacientes.ts`:

```ts
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import type { PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { TETO_FILTROS_SALVOS, validarCriteriosFiltroSalvo } from '../dominio/filtros-salvos';
import { FiltroSalvoPacienteOrm } from '../infraestrutura/filtro-salvo-paciente.orm';
import { CriarFiltroSalvoDto } from './dtos-filtros-salvos';

/** Visoes de trabalho da lista de pacientes. Guarda criterio, nunca busca livre. */
@Injectable()
export class ServicoFiltrosSalvosPacientes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async criar(tenantId: string, usuario: UsuarioAutenticado, dados: CriarFiltroSalvoDto) {
    this.garantirAcesso(usuario, dados.origem === 'clinica' ? 'pacientes.gerenciar' : 'pacientes.listar');

    let criterios;
    try {
      criterios = validarCriteriosFiltroSalvo(dados.criterios);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      if (dados.origem === 'pessoal' && !profissionalId) {
        throw new ForbiddenException('Filtro pessoal exige um profissional vinculado ao usuario.');
      }

      const repositorio = gerenciador.getRepository(FiltroSalvoPacienteOrm);
      const ativos = await repositorio.count({
        where: dados.origem === 'pessoal'
          ? { tenantId, origem: 'pessoal', profissionalId, arquivadoEm: IsNull() }
          : { tenantId, origem: 'clinica', arquivadoEm: IsNull() }
      });
      if (ativos >= TETO_FILTROS_SALVOS) {
        throw new BadRequestException(`Limite de ${TETO_FILTROS_SALVOS} filtros salvos atingido.`);
      }

      const nome = dados.nome.trim();
      const filtro = repositorio.create({
        tenantId,
        origem: dados.origem,
        profissionalId: dados.origem === 'pessoal' ? profissionalId : undefined,
        nomeCriptografado: this.criptografia.criptografar(nome),
        criterios,
        criadoPorUsuarioId: usuario.usuarioId
      });
      await repositorio.save(filtro);
      return this.resumo(filtro, nome);
    });
  }

  private resumo(filtro: FiltroSalvoPacienteOrm, nome: string) {
    return {
      id: filtro.id,
      nome,
      origem: filtro.origem,
      criterios: filtro.criterios,
      atualizadoEm: filtro.atualizadoEm
    };
  }

  private garantirAcesso(usuario: UsuarioAutenticado, permissao: PermissaoOctaClin) {
    if (!usuario.permissoes.includes(permissao)) {
      throw new ForbiddenException('Permissao insuficiente para operar filtros salvos.');
    }
  }
}
```

Nota deliberada: `garantirAcesso` **nao** bloqueia `Collaborator` por papel,
diferente de `ServicoReceitasNutricionais`. Colaborador tem `pacientes.listar` e
precisa ler e usar filtro de clinica; so a escrita de filtro de clinica exige
`pacientes.gerenciar`, que ele nao tem.

- [ ] **Step 5: Rodar o teste e confirmar que passa**

```
cd octaclin-backend && pnpm test -- servico-filtros-salvos-pacientes
```
Esperado: PASS, 6 testes.

- [ ] **Step 6: Commit**

```bash
git add octaclin-backend/src/modulos/pacientes/aplicacao/dtos-filtros-salvos.ts \
        octaclin-backend/src/modulos/pacientes/aplicacao/servico-filtros-salvos-pacientes.ts \
        octaclin-backend/src/modulos/pacientes/aplicacao/servico-filtros-salvos-pacientes.spec.ts
git commit -m "feat(fase-254): criar filtro salvo com allowlist e teto"
```

---

### Task 4: Servico de filtros salvos - listar e arquivar

**Files:**
- Modify: `octaclin-backend/src/modulos/pacientes/aplicacao/servico-filtros-salvos-pacientes.ts`
- Modify: `octaclin-backend/src/modulos/pacientes/aplicacao/servico-filtros-salvos-pacientes.spec.ts`

**Interfaces:**
- Consumes: tudo da Task 3.
- Produces:
  - `listar(tenantId, usuario, consulta?): Promise<{ itens: ResumoFiltroSalvo[] }>`
  - `arquivar(tenantId, filtroId, usuario): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao spec:

```ts
describe('ServicoFiltrosSalvosPacientes.listar', () => {
  it('devolve os pessoais do proprio profissional e todos os de clinica', async () => {
    const { servico, repositorio, criptografia } = montar();
    repositorio.registros = [
      { id: 'a', tenantId: TENANT_ID, origem: 'pessoal', profissionalId: PROFISSIONAL_ID,
        nomeCriptografado: criptografia.criptografar('Minha'), criterios: {}, arquivadoEm: null, atualizadoEm: new Date() },
      { id: 'b', tenantId: TENANT_ID, origem: 'pessoal', profissionalId: 'outro-profissional',
        nomeCriptografado: criptografia.criptografar('Do outro'), criterios: {}, arquivadoEm: null, atualizadoEm: new Date() },
      { id: 'c', tenantId: TENANT_ID, origem: 'clinica', profissionalId: null,
        nomeCriptografado: criptografia.criptografar('Da clinica'), criterios: {}, arquivadoEm: null, atualizadoEm: new Date() }
    ];

    const { itens } = await servico.listar(TENANT_ID, profissional());
    expect(itens.map((item) => item.nome).sort()).toEqual(['Da clinica', 'Minha']);
  });

  it('nao devolve filtro arquivado', async () => {
    const { servico, repositorio, criptografia } = montar();
    repositorio.registros = [
      { id: 'a', tenantId: TENANT_ID, origem: 'clinica', profissionalId: null,
        nomeCriptografado: criptografia.criptografar('Arquivada'), criterios: {},
        arquivadoEm: new Date(), atualizadoEm: new Date() }
    ];
    const { itens } = await servico.listar(TENANT_ID, profissional());
    expect(itens).toHaveLength(0);
  });
});

describe('ServicoFiltrosSalvosPacientes.arquivar', () => {
  it('impede arquivar filtro pessoal de outro profissional', async () => {
    const { servico, repositorio, criptografia } = montar();
    repositorio.registros = [
      { id: 'b', tenantId: TENANT_ID, origem: 'pessoal', profissionalId: 'outro-profissional',
        nomeCriptografado: criptografia.criptografar('Do outro'), criterios: {}, arquivadoEm: null, atualizadoEm: new Date() }
    ];
    await expect(servico.arquivar(TENANT_ID, 'b', profissional())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige pacientes.gerenciar para arquivar filtro de clinica', async () => {
    const { servico, repositorio, criptografia } = montar();
    repositorio.registros = [
      { id: 'c', tenantId: TENANT_ID, origem: 'clinica', profissionalId: null,
        nomeCriptografado: criptografia.criptografar('Da clinica'), criterios: {}, arquivadoEm: null, atualizadoEm: new Date() }
    ];
    await expect(servico.arquivar(TENANT_ID, 'c', colaborador())).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```
cd octaclin-backend && pnpm test -- servico-filtros-salvos-pacientes
```
Esperado: FAIL, `servico.listar is not a function`.

- [ ] **Step 3: Implementar listar e arquivar**

Acrescentar ao servico:

```ts
  async listar(tenantId: string, usuario: UsuarioAutenticado, consulta: ListarFiltrosSalvosDto = new ListarFiltrosSalvosDto()) {
    this.garantirAcesso(usuario, 'pacientes.listar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const repositorio = gerenciador.getRepository(FiltroSalvoPacienteOrm);
      const visiveis = [
        { tenantId, origem: 'clinica' as const, arquivadoEm: IsNull() },
        ...(profissionalId ? [{ tenantId, origem: 'pessoal' as const, profissionalId, arquivadoEm: IsNull() }] : [])
      ];
      const filtros = await repositorio.find({
        where: consulta.origem ? visiveis.filter((onde) => onde.origem === consulta.origem) : visiveis,
        order: { atualizadoEm: 'DESC', id: 'DESC' }
      });
      return {
        itens: filtros.map((filtro) => this.resumo(filtro, this.criptografia.descriptografar(filtro.nomeCriptografado)))
      };
    });
  }

  async arquivar(tenantId: string, filtroId: string, usuario: UsuarioAutenticado) {
    this.garantirAcesso(usuario, 'pacientes.listar');
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const repositorio = gerenciador.getRepository(FiltroSalvoPacienteOrm);
      const filtro = await repositorio.findOne({ where: { tenantId, id: filtroId, arquivadoEm: IsNull() } });
      if (!filtro) throw new NotFoundException('Filtro salvo nao encontrado.');

      if (filtro.origem === 'clinica') {
        this.garantirAcesso(usuario, 'pacientes.gerenciar');
      } else if (filtro.profissionalId !== profissionalId) {
        throw new ForbiddenException('Filtro pessoal pertence a outro profissional.');
      }

      filtro.arquivadoEm = new Date();
      await repositorio.save(filtro);
    });
  }
```

Acrescentar `NotFoundException` ao import de `@nestjs/common` e
`ListarFiltrosSalvosDto` ao import de `./dtos-filtros-salvos`.

Se `profissionalId` for `undefined` - papel com visao tenant-wide como
`SuperAdmin` - a comparacao de dono no `arquivar` nunca casa e o filtro pessoal
alheio fica protegido. Isso e intencional: visao ampla de leitura nao e licenca
para mexer em preferencia de outra pessoa.

- [ ] **Step 4: Rodar e confirmar que passa**

```
cd octaclin-backend && pnpm test -- servico-filtros-salvos-pacientes
```
Esperado: PASS, 10 testes.

- [ ] **Step 5: Commit**

```bash
git add octaclin-backend/src/modulos/pacientes/aplicacao/servico-filtros-salvos-pacientes.ts \
        octaclin-backend/src/modulos/pacientes/aplicacao/servico-filtros-salvos-pacientes.spec.ts
git commit -m "feat(fase-254): listar e arquivar filtros salvos por dono"
```

---

### Task 5: Extrair a verificacao de duplicidade

**Esta task e uma extracao, nao uma escrita.** `buscarPossiveisDuplicidades` ja
existe como metodo privado em
`servico-perfil-cadastro-paciente.ts:203`, e ja resolve a parte dificil:
`ArrayOverlap(buscaHashes)` sobre o indice GIN da migration `1013`, escopo por
`profissionalResponsavelId`, corte em 5 e decifra com fallback. Ler esse metodo
inteiro antes de comecar.

O trabalho e mover essa logica para um servico com duas entradas, fazer o perfil
chamar o servico e apagar a copia privada. Um segundo detector ao lado do
primeiro seria duas regras de duplicidade divergindo na primeira manutencao.

**Files:**
- Create: `octaclin-backend/src/modulos/pacientes/aplicacao/servico-duplicidade-pacientes.ts`
- Test: `octaclin-backend/src/modulos/pacientes/aplicacao/servico-duplicidade-pacientes.spec.ts`
- Modify: `octaclin-backend/src/modulos/pacientes/aplicacao/servico-perfil-cadastro-paciente.ts` (remove o metodo privado e passa a delegar)
- Modify: `octaclin-backend/src/modulos/pacientes/aplicacao/servico-perfil-cadastro-paciente.spec.ts` (fiacao do servico novo no duble)

**Interfaces:**
- Consumes: `ExecutorTenant`, `CriptografiaDadosSensiveis.gerarHashesConsultaPii`
  e `.descriptografar`, `resolverProfissionalIdDoUsuario`, `PacienteOrm`,
  `ServicoAuditoria.registrar`.
- Produces:
  - `type MotivoDuplicidade = 'nome_e_nascimento' | 'contato' | 'nome'`
  - `interface CandidatoDuplicidade { pacienteId: string; nome: string; motivos: MotivoDuplicidade[] }`
  - `verificarPorTexto(gerenciador, tenantId, usuario, { nome, contato?, dataNascimento? }): Promise<CandidatoDuplicidade[]>`
  - `verificarPorPaciente(gerenciador, tenantId, usuario, pacienteAtual, contatoPerfil?): Promise<CandidatoDuplicidade[]>`
  - `verificar(tenantId, usuario, dados): Promise<{ candidatos: CandidatoDuplicidade[] }>` - abre o `ExecutorTenant` e delega a `verificarPorTexto`, para uso pelo controlador
  - `registrarDispensa(tenantId, usuario, pacienteCriadoId, candidatosDispensados): Promise<void>`

As duas entradas `verificarPor*` recebem `gerenciador` porque o perfil ja esta
dentro de uma transacao quando chama. Abrir um `ExecutorTenant` aninhado ali
criaria transacao dentro de transacao.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoDuplicidadePacientes } from './servico-duplicidade-pacientes';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';
const PROFISSIONAL_ID = '10000000-0000-4000-8000-000000000003';

const criptografia = new CriptografiaDadosSensiveis();

function profissional(): UsuarioAutenticado {
  return {
    usuarioId: USUARIO_ID, tenantId: TENANT_ID, papel: 'Professional',
    emailHash: 'hash', permissoes: ['pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar']
  };
}

function pacienteSintetico(id: string, nome: string, nascimento?: string, contato?: string) {
  return {
    id,
    tenantId: TENANT_ID,
    profissionalResponsavelId: PROFISSIONAL_ID,
    nomeCriptografado: criptografia.criptografar(nome),
    contatoCriptografado: contato ? criptografia.criptografar(JSON.stringify({ email: contato })) : undefined,
    dataNascimento: nascimento,
    buscaHashes: criptografia.gerarHashesBuscaPii(TENANT_ID, [nome, contato]),
    arquivadoEm: null
  };
}

describe('ServicoDuplicidadePacientes.verificar', () => {
  it('aponta nome_e_nascimento quando os dois batem', async () => {
    const { servico } = montarCom([pacienteSintetico('p1', 'Maria Silva', '1990-03-04')]);
    const { candidatos } = await servico.verificar(TENANT_ID, profissional(), {
      nome: 'Maria Silva', dataNascimento: '1990-03-04'
    });
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].motivos).toContain('nome_e_nascimento');
    expect(candidatos[0].pacienteId).toBe('p1');
  });

  it('aponta nome sozinho quando nao ha nascimento dos dois lados', async () => {
    const { servico } = montarCom([pacienteSintetico('p1', 'Maria Silva')]);
    const { candidatos } = await servico.verificar(TENANT_ID, profissional(), { nome: 'Maria Silva' });
    expect(candidatos[0].motivos).toEqual(['nome']);
  });

  it('nao aponta nome sozinho quando ha nascimento diferente', async () => {
    const { servico } = montarCom([pacienteSintetico('p1', 'Maria Silva', '1990-03-04')]);
    const { candidatos } = await servico.verificar(TENANT_ID, profissional(), {
      nome: 'Maria Silva', dataNascimento: '1985-01-01'
    });
    expect(candidatos).toHaveLength(0);
  });

  it('aponta contato mesmo com nome diferente', async () => {
    const { servico } = montarCom([pacienteSintetico('p1', 'Maria Silva', undefined, 'maria@exemplo.test')]);
    const { candidatos } = await servico.verificar(TENANT_ID, profissional(), {
      nome: 'Maria Souza', contato: 'maria@exemplo.test'
    });
    expect(candidatos[0].motivos).toContain('contato');
  });

  it('nao busca fora da carteira do profissional', async () => {
    const { servico, consultasFeitas } = montarCom([]);
    await servico.verificar(TENANT_ID, profissional(), { nome: 'Maria Silva' });
    expect(consultasFeitas[0].where.profissionalResponsavelId).toBe(PROFISSIONAL_ID);
  });

  it('devolve no maximo 5 candidatos', async () => {
    const registros = Array.from({ length: 9 }, (_, indice) =>
      pacienteSintetico(`p${indice}`, 'Maria Silva'));
    const { servico } = montarCom(registros);
    const { candidatos } = await servico.verificar(TENANT_ID, profissional(), { nome: 'Maria Silva' });
    expect(candidatos).toHaveLength(5);
  });

  it('nao devolve o proprio paciente na entrada por paciente salvo', async () => {
    const atual = pacienteSintetico('p1', 'Maria Silva', '1990-03-04');
    const { servico, gerenciador } = montarCom([atual]);
    const candidatos = await servico.verificarPorPaciente(gerenciador, TENANT_ID, profissional(), atual as never);
    expect(candidatos).toHaveLength(0);
  });
});

describe('ServicoDuplicidadePacientes.registrarDispensa', () => {
  it('grava apenas UUID na auditoria, nunca nome', async () => {
    const { servico, auditoria } = montarCom([]);
    await servico.registrarDispensa(TENANT_ID, profissional(), 'paciente-novo', ['candidato-1']);
    const entrada = auditoria.registrar.mock.calls[0][0];
    expect(entrada.acao).toBe('paciente.duplicidade_dispensada');
    expect(entrada.metadados).toEqual({ candidatosDispensados: ['candidato-1'] });
  });
});
```

Com `montarCom()`:

```ts
function montarCom(registros: any[]) {
  const consultasFeitas: any[] = [];
  const pacientes = {
    find: jest.fn(async (opcoes: any) => {
      consultasFeitas.push(opcoes);
      return [...registros];
    })
  };
  const profissionais = {
    findOne: jest.fn(async () => ({
      id: PROFISSIONAL_ID, tenantId: TENANT_ID, usuarioId: USUARIO_ID, arquivadoEm: null
    }))
  };
  const gerenciador = {
    getRepository: (entidade: any) => (entidade.name === 'ProfissionalOrm' ? profissionais : pacientes)
  };
  const executorTenant = {
    executar: async (_tenantId: string, operacao: any) => operacao(gerenciador)
  } as unknown as ExecutorTenant;
  const auditoria = { registrar: jest.fn(async () => undefined) };

  return {
    servico: new ServicoDuplicidadePacientes(executorTenant, criptografia, auditoria as never),
    consultasFeitas,
    gerenciador,
    auditoria
  };
}
```

O duble de `find` devolve tudo de proposito: o `ArrayOverlap` e pre-filtro do
Postgres e nao ha Postgres aqui. O que os testes provam e a regra de decisao
sobre os candidatos, que e a parte que o codigo desta task controla.

- [ ] **Step 2: Rodar e confirmar que falha**

```
cd octaclin-backend && pnpm test -- servico-duplicidade-pacientes
```
Esperado: FAIL, modulo nao encontrado.

- [ ] **Step 3: Implementar o servico movendo a logica existente**

Os tres auxiliares privados de `servico-perfil-cadastro-paciente.ts` -
`normalizar` (linha 328), `descriptografarSeguro` (linha 333) e
`obterContatoComparavel` (linha 310) - **mudam de casa** para este servico. O
perfil ainda usa `descriptografarSeguro` e `normalizar` em outros pontos, entao
esses dois ficam nos dois lugares; `obterContatoComparavel` so servia a
duplicidade e sai do perfil.

```ts
import { Injectable } from '@nestjs/common';
import { ArrayOverlap, EntityManager, IsNull } from 'typeorm';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

export type MotivoDuplicidade = 'nome_e_nascimento' | 'contato' | 'nome';

export interface CandidatoDuplicidade {
  pacienteId: string;
  nome: string;
  motivos: MotivoDuplicidade[];
}

const MAXIMO_CANDIDATOS = 5;

/**
 * Aviso consultivo de possivel cadastro repetido, compartilhado pelo cadastro
 * novo e pelo perfil do paciente.
 *
 * ponytail: ArrayOverlap sobre hashes e so pre-filtro; a decisao final e
 * igualdade sobre texto normalizado, que nao remove acento e nao tolera erro de
 * digitacao. Upgrade, se doer: NFKD em normalizar e comparacao fonetica.
 */
@Injectable()
export class ServicoDuplicidadePacientes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly auditoria: ServicoAuditoria
  ) {}

  /** Entrada do controlador: abre a transacao e delega. */
  async verificar(
    tenantId: string,
    usuario: UsuarioAutenticado,
    dados: { nome: string; contato?: string; dataNascimento?: string }
  ): Promise<{ candidatos: CandidatoDuplicidade[] }> {
    const candidatos = await this.executorTenant.executar(tenantId, (gerenciador) =>
      this.verificarPorTexto(gerenciador, tenantId, usuario, dados));
    return { candidatos };
  }

  /** Cadastro novo: ainda nao existe paciente, so o que foi digitado. */
  async verificarPorTexto(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    dados: { nome: string; contato?: string; dataNascimento?: string }
  ): Promise<CandidatoDuplicidade[]> {
    const hashes = this.criptografia.gerarHashesBuscaPii(tenantId, [dados.nome, dados.contato]);
    return this.comparar(gerenciador, tenantId, usuario, hashes, {
      nome: this.normalizar(dados.nome),
      contato: this.normalizar(dados.contato),
      nascimento: dados.dataNascimento,
      ignorarId: undefined
    });
  }

  /** Perfil: o paciente ja existe e nao pode ser candidato de si mesmo. */
  async verificarPorPaciente(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    pacienteAtual: PacienteOrm,
    contatoPerfil?: { email?: string; celular?: string }
  ): Promise<CandidatoDuplicidade[]> {
    return this.comparar(gerenciador, tenantId, usuario, pacienteAtual.buscaHashes ?? [], {
      nome: this.normalizar(this.descriptografarSeguro(pacienteAtual.nomeCriptografado)),
      contato: this.normalizar(
        contatoPerfil?.email ?? contatoPerfil?.celular ?? this.obterContatoComparavel(pacienteAtual)
      ),
      nascimento: pacienteAtual.dataNascimento ? String(pacienteAtual.dataNascimento) : undefined,
      ignorarId: pacienteAtual.id
    });
  }

  async registrarDispensa(
    tenantId: string,
    usuario: UsuarioAutenticado,
    pacienteCriadoId: string,
    candidatosDispensados: string[]
  ) {
    await this.auditoria.registrar({
      tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'paciente.duplicidade_dispensada',
      recursoTipo: 'paciente',
      recursoId: pacienteCriadoId,
      metadados: { candidatosDispensados }
    });
  }

  private async comparar(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    hashes: string[],
    alvo: { nome?: string; contato?: string; nascimento?: string; ignorarId?: string }
  ): Promise<CandidatoDuplicidade[]> {
    if (!hashes.length) return [];
    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const candidatos = await gerenciador.getRepository(PacienteOrm).find({
      where: {
        tenantId,
        arquivadoEm: IsNull(),
        buscaHashes: ArrayOverlap(hashes),
        ...(profissionalResponsavelId ? { profissionalResponsavelId } : {})
      },
      select: { id: true, nomeCriptografado: true, contatoCriptografado: true, dataNascimento: true }
    });

    return candidatos.flatMap((candidato) => {
      if (candidato.id === alvo.ignorarId) return [];
      const nomeCandidato = this.normalizar(this.descriptografarSeguro(candidato.nomeCriptografado));
      const nascimentoCandidato = candidato.dataNascimento ? String(candidato.dataNascimento) : undefined;
      const mesmoNome = Boolean(alvo.nome && nomeCandidato && alvo.nome === nomeCandidato);

      const motivos: MotivoDuplicidade[] = [];
      if (mesmoNome && alvo.nascimento && alvo.nascimento === nascimentoCandidato) {
        motivos.push('nome_e_nascimento');
      } else if (mesmoNome && !alvo.nascimento && !nascimentoCandidato) {
        motivos.push('nome');
      }
      if (alvo.contato && alvo.contato === this.normalizar(this.obterContatoComparavel(candidato))) {
        motivos.push('contato');
      }

      return motivos.length
        ? [{
            pacienteId: candidato.id,
            nome: this.descriptografarSeguro(candidato.nomeCriptografado) ?? 'Paciente',
            motivos
          }]
        : [];
    }).slice(0, MAXIMO_CANDIDATOS);
  }

  private obterContatoComparavel(paciente: PacienteOrm): string | undefined {
    const contato = this.descriptografarSeguro(paciente.contatoCriptografado);
    if (!contato) return undefined;
    try {
      const parseado = JSON.parse(contato) as { email?: unknown; whatsapp?: unknown };
      if (typeof parseado.email === 'string') return parseado.email;
      if (typeof parseado.whatsapp === 'string') return parseado.whatsapp;
      return undefined;
    } catch {
      return contato;
    }
  }

  private normalizar(valor?: string): string | undefined {
    const normalizado = valor?.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
    return normalizado || undefined;
  }

  private descriptografarSeguro(valor?: Buffer): string | undefined {
    if (!valor) return undefined;
    try { return this.criptografia.descriptografar(valor); } catch { return undefined; }
  }
}
```

Duas mudancas de comportamento em relacao ao metodo original, ambas
intencionais e cobertas por teste:

1. O motivo `nome` sozinho e novo, e so dispara quando **nenhum dos dois lados**
   tem nascimento. Sem isso a checagem seria inutil durante a digitacao, que e
   onde ela serve.
2. Nome igual com nascimentos **diferentes** nao lista, igual ao original. Dois
   pacientes de mesmo nome e nascimentos distintos sao pessoas distintas.

O `catch` do `JSON.parse` devolve o contato cru em vez de `undefined`: o
original tinha o mesmo `catch`; confira a linha 318 do arquivo de origem e
preserve o comportamento que estiver la, sem "melhorar" de passagem.

- [ ] **Step 4: Fazer o perfil delegar e apagar a copia privada**

Em `servico-perfil-cadastro-paciente.ts`: injetar
`ServicoDuplicidadePacientes` no construtor, trocar cada chamada de
`this.buscarPossiveisDuplicidades(gerenciador, tenantId, pacienteAtual, usuario, contatoPerfil)`
por
`this.duplicidade.verificarPorPaciente(gerenciador, tenantId, usuario, pacienteAtual, contatoPerfil)`,
e remover o metodo privado e o `obterContatoComparavel`.

Atualizar `servico-perfil-cadastro-paciente.spec.ts` para construir o servico
com o novo argumento.

- [ ] **Step 5: Rodar os dois specs e confirmar que passam**

```
cd octaclin-backend && pnpm test -- servico-duplicidade-pacientes
cd octaclin-backend && pnpm test -- servico-perfil-cadastro-paciente
```
Esperado: PASS nos dois. O spec do perfil e a rede de seguranca da extracao: se
o comportamento mudou onde nao devia, ele acusa.

- [ ] **Step 6: Commit**

```bash
git add octaclin-backend/src/modulos/pacientes/aplicacao/servico-duplicidade-pacientes.ts \
        octaclin-backend/src/modulos/pacientes/aplicacao/servico-duplicidade-pacientes.spec.ts \
        octaclin-backend/src/modulos/pacientes/aplicacao/servico-perfil-cadastro-paciente.ts \
        octaclin-backend/src/modulos/pacientes/aplicacao/servico-perfil-cadastro-paciente.spec.ts
git commit -m "refactor(fase-254): extrair verificacao de duplicidade compartilhada"
```

---

### Task 6: Rotas e fiacao

**Files:**
- Create: `octaclin-backend/src/modulos/pacientes/apresentacao/controlador-filtros-salvos-pacientes.ts`
- Modify: `octaclin-backend/src/modulos/pacientes/apresentacao/controlador-pacientes.ts`
- Modify: `octaclin-backend/src/modulos/pacientes/modulo-pacientes.ts`

**Interfaces:**
- Consumes: `ServicoFiltrosSalvosPacientes` (Tasks 3-4) e
  `ServicoDuplicidadePacientes` (Task 5).
- Produces: as rotas HTTP.

- [ ] **Step 1: Escrever o controlador de filtros salvos**

**Atencao ao copiar do vizinho:** `controlador-condutas-terapeuticas.ts` declara
`@Papeis('SuperAdmin', 'Professional')`. Este controlador precisa dos **tres**
papeis, como `controlador-pacientes.ts` (linha 29), senao `Collaborator` - que
tem `pacientes.listar` e `pacientes.ler` - perde acesso as visoes de clinica que
ele deveria poder usar.

```ts
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriarFiltroSalvoDto, ListarFiltrosSalvosDto } from '../aplicacao/dtos-filtros-salvos';
import { ServicoFiltrosSalvosPacientes } from '../aplicacao/servico-filtros-salvos-pacientes';

@Controller('pacientes/filtros-salvos')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
export class ControladorFiltrosSalvosPacientes {
  constructor(
    private readonly servico: ServicoFiltrosSalvosPacientes,
    private readonly auditoria: ServicoAuditoria
  ) {}

  @Get()
  @Permissoes('pacientes.listar')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() consulta: ListarFiltrosSalvosDto) {
    return this.servico.listar(usuario.tenantId, usuario, consulta);
  }

  @Post()
  @Permissoes('pacientes.listar')
  async criar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarFiltroSalvoDto
  ) {
    const filtro = await this.servico.criar(usuario.tenantId, usuario, dados);
    await this.auditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.filtro_salvo.criar',
      recursoTipo: 'filtro_salvo_paciente',
      recursoId: filtro.id,
      ip: requisicao.ip,
      userAgent: requisicao.get('user-agent'),
      metadados: { origem: filtro.origem }
    });
    return filtro;
  }

  @Delete(':filtroId')
  @Permissoes('pacientes.listar')
  async arquivar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('filtroId', ParseUUIDPipe) filtroId: string
  ) {
    await this.servico.arquivar(usuario.tenantId, filtroId, usuario);
    await this.auditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.filtro_salvo.arquivar',
      recursoTipo: 'filtro_salvo_paciente',
      recursoId: filtroId,
      ip: requisicao.ip,
      userAgent: requisicao.get('user-agent')
    });
    return { arquivado: true };
  }
}
```

Os metadados de auditoria guardam apenas `origem` e o UUID. O nome da visao e
cifrado no banco e nao entra em log.

A permissao de rota e `pacientes.listar` nas tres; a exigencia extra de
`pacientes.gerenciar` para origem `clinica` fica no servico, porque depende do
corpo da requisicao e do registro alvo, e nao da rota.

- [ ] **Step 2: Acrescentar a rota de duplicidade**

Em `controlador-pacientes.ts`, acrescentar `ServicoDuplicidadePacientes` ao
construtor e a rota. Ela fica **antes** de qualquer rota `@Post(':id/...')` no
arquivo: `verificacao-duplicidade` casaria com `:id` se viesse depois, e o
`ParseUUIDPipe` rejeitaria a string com 400.

```ts
  @Post('verificacao-duplicidade')
  @Permissoes('pacientes.gerenciar')
  async verificarDuplicidade(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dados: VerificarDuplicidadePacienteDto
  ) {
    return this.duplicidade.verificar(usuario.tenantId, usuario, dados);
  }
```

Com o DTO em `aplicacao/dtos.ts`:

```ts
export class VerificarDuplicidadePacienteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  contato?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;
}
```

`POST` e nao `GET` porque nome e contato sao PII e nao podem ir em query
string. A rota **nao** registra auditoria: consultar duplicidade e leitura e
acontece a cada digitacao; o que vira trilha e a decisao de dispensar, na
Task 5.

- [ ] **Step 3: Fiar no modulo**

Em `modulo-pacientes.ts`: importar `FiltroSalvoPacienteOrm` no
`TypeOrmModule.forFeature`, e acrescentar `ServicoFiltrosSalvosPacientes` e
`ServicoDuplicidadePacientes` a `providers`, alem do
`ControladorFiltrosSalvosPacientes` em `controllers`.

- [ ] **Step 4: Rodar a suite do modulo e os portoes**

```
cd octaclin-backend && pnpm test -- pacientes
cd octaclin-backend && pnpm typecheck
cd octaclin-backend && pnpm build
```
Esperado: PASS, sem erro de tipo, `dist/main.js` gerado.

Se `build` reclamar de artefato ausente, apagar `dist` e
`tsconfig.build.tsbuildinfo` antes de repetir: build incremental com `outDir`
antigo pula o emit.

- [ ] **Step 5: Rodar a suite completa do backend**

```
cd octaclin-backend && pnpm test
```
Esperado: verde, com a excecao conhecida de `catalogo-taco.spec.ts`, que falha
neste checkout Windows por `LF/CRLF` e passa no CI.

- [ ] **Step 6: Commit**

```bash
git add octaclin-backend/src/modulos/pacientes/apresentacao/ \
        octaclin-backend/src/modulos/pacientes/modulo-pacientes.ts
git commit -m "feat(fase-254): expor rotas de filtros salvos e duplicidade"
```

---

## Cobertura do spec

| Item do Incremento 1 no spec | Onde |
| --- | --- |
| Migration `1720000001035` aditiva | Task 1 |
| Registro no array explicito de `migrations` | Task 1, Steps 5 e 6 |
| Allowlist estrita de criterios | Task 2 (dominio) e Task 3 (uso) |
| Teto de 20, arquivado nao conta | Task 3 |
| `origem` pessoal exige profissional, clinica exige nulo | Task 3 |
| Criar, listar, arquivar | Tasks 3 e 4 |
| **Aplicar** | Sem codigo novo. Ver nota abaixo. |
| Duplicidade sem DDL, limitada a carteira | Task 5 |
| Auditoria da dispensa so com UUID | Task 5 |
| Sem interface, sem backfill | Nenhuma task toca `octaclin-web` |

**Sobre "aplicar":** o spec lista `aplicar` entre as operacoes do servico, mas
ele nao vira metodo. Os quatro criterios da allowlist - `risco`, `status`,
`profissionalId`, `semProximaConsulta` - sao exatamente os campos que
`ListarPacientesDto` ja aceita, e `servico-pacientes.listar` ja os trata em
`montarFiltrosListagem`. Aplicar uma visao salva e o cliente ler `criterios` e
mandar na listagem que ja existe. Escrever um `aplicar` no servico seria um
passa-adiante sem comportamento proprio.

Duas consequencias que o Incremento 3 herda: o escopo por profissional
responsavel continua valendo, entao filtro de clinica nao amplia carteira; e a
validacao de criterio caducado reusa `validarCriteriosFiltroSalvo` do dominio,
que ja esta pronto na Task 2.

## Rollout apos o merge

Na ordem, sem pular etapa:

1. Backup de producao com teste de restore real.
2. `migration:run` contra `octaclin_test_fase150b`, verificando tabela,
   indices, RLS e politica.
3. Merge do PR do Incremento 1.
4. `migration:run` fora de banda com `neondb_owner` contra producao. A role de
   runtime `octaclin_app_producao` nao tem `CREATE` no schema `public`.
5. Deploy do backend.
6. `curl -s https://octaclin-backend-producao.onrender.com/health/detalhado` e
   conferir 48 migrations e `status: "ok"`.
7. Disparar o monitor de producao e confirmar verde.

Nenhuma string de conexao entra em documento, commit ou log. Os comandos de
banco sao executados por quem tem a credencial, com o runbook em maos.
