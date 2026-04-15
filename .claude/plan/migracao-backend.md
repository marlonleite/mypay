# Plano de Migração: myPay Backend (Firebase → FastAPI + PostgreSQL)

## Contexto

O myPay é um app de finanças pessoais (single-user) com frontend React + Vite e backend 100% Firebase (Firestore, Auth, Storage, FCM). Um incidente de perda de dados expôs fragilidades: sem transações ACID, sem soft delete, sem migrations versionadas, credenciais S3 expostas no bundle do frontend, e zero controle sobre o banco de dados.

**Objetivo:** migrar o backend para FastAPI + PostgreSQL 17 na VPS existente (OVH VPS-3, 8 vCores, 24GB RAM, 200GB SSD), mantendo Firebase Auth e FCM. Frontend permanece React + Vite na Vercel.

**Resultado esperado:** dados financeiros protegidos por ACID, soft delete, audit trail completo, credenciais seguras no servidor, pipeline de IA robusta em Python, backups testados automaticamente.

---

## 1. Decisões Arquiteturais (Consolidado)

### Stack final

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite (mantido, Vercel) |
| Auth | Firebase Auth (mantido — Google Sign-In, verify token no backend) |
| Backend | FastAPI + Pydantic v2 + SQLAlchemy 2.0 async |
| Database | PostgreSQL 17 (dedicated container, Easypanel) |
| Migrations | Alembic |
| Storage | Cloudflare R2 via `boto3` (backend) |
| Push | FCM via `firebase-admin` (backend) |
| IA | `pypdfium2` + `pdfplumber` + `instructor` + Gemini |
| Scheduler | APScheduler in-process |
| Logs | `structlog` |
| Testes | `pytest` + `testcontainers` |
| Deps | uv (lock file, builds ~30x mais rápido que Poetry) |
| Deploy | Docker → Easypanel (VPS OVH) |

### Padrões adotados

- **UseCase + DTO** (não Command/Handler — CRUD dominante, menos boilerplate)
- **Repository pattern** leve (abstrai queries, facilita testes)
- **Unit of Work** via SQLAlchemy `AsyncSession` context manager
- **Soft delete** (`deleted_at`) em tabelas financeiras
- **Audit trail** com `old_data`/`new_data` JSONB
- **SSE + Postgres LISTEN/NOTIFY** para real-time (substitui `onSnapshot`)
- **Domain exceptions** mapeadas para HTTP em middleware

### Padrões rejeitados (e motivo)

- **Celery** — overkill para 2-3 tasks/dia; APScheduler resolve
- **Redis** — sem cache, sessão, rate limit ou fila que justifique
- **CQRS** — volume equilibrado de reads/writes, dataset pequeno
- **SAGA** — 1 Postgres, transações ACID nativas
- **Command/Handler** — pode migrar no futuro se necessário; hoje UseCase é suficiente

---

## 2. Infraestrutura

### Topologia de deploy

```
Vercel (CDN global)
└── mypay.palmadigital.com.br        ← Frontend React

Easypanel (VPS OVH — 158.69.204.96)
├── mypay-api                         ← FastAPI (Docker)
│   └── api.mypay.palmadigital.com.br
├── mypay-postgres                    ← PostgreSQL 17 (dedicado)
└── backup-dbs                        ← Já existente, adicionar env vars myPay
```

### DNS (palmadigital.com.br)

```
mypay       CNAME   cname.vercel-dns.com.
api.mypay   A       158.69.204.96
api.mypay   AAAA    2607:5300:205:200::c3c
```

### Variáveis de ambiente — mypay-api

```
# Database
DATABASE_URL=postgresql+asyncpg://mypay:***@mypay-postgres:5432/mypay

# Firebase Admin (verify tokens + FCM)
FIREBASE_PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT_JSON=...   # ou path para credentials.json

# Gemini AI
GOOGLE_AI_KEY=...                   # sai do frontend, vai pro backend

# Cloudflare R2 (sai do frontend, vai pro backend)
S3_ENDPOINT_URL=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
S3_PUBLIC_URL=...

# App
CORS_ORIGINS=https://mypay.palmadigital.com.br
SECRET_KEY=...                      # para assinatura interna se necessário
ENVIRONMENT=production
```

### Variáveis de ambiente — backup-dbs (adicionar)

```
MYPAY_DB_TYPE=postgres
MYPAY_DB_HOST=mypay-postgres
MYPAY_DB_PORT=5432
MYPAY_DB_NAME=mypay
MYPAY_DB_USER=mypay
MYPAY_DB_PASS=...
MYPAY_GDRIVE_PATH=mypay/daily
MYPAY_MONTHLY_GDRIVE_PATH=mypay/monthly
MYPAY_RETENTION=14
MYPAY_SCHEDULE=0 3 * * *
MYPAY_PG_VERSION=17
```

### Checklist de infra (pré-desenvolvimento)

- [ ] Ativar snapshot semanal OVH
- [ ] Configurar DNS `api.mypay.palmadigital.com.br` → IP da VPS
- [ ] Configurar DNS `mypay.palmadigital.com.br` → Vercel
- [ ] Criar serviço `mypay-postgres` no Easypanel (postgres:17-alpine)
- [ ] Criar serviço `mypay-api` no Easypanel (GitHub auto-build)
- [ ] Adicionar env vars do myPay no `backup-dbs`
- [ ] Atualizar `test-restore.sh` para versão dinâmica do PG (`${DB_PREFIX}_PG_VERSION`)
- [ ] Confirmar firewall: 5432 fechada externamente

---

## 3. Modelagem de Dados (PostgreSQL)

### Mapeamento Firestore → Postgres

```
Firestore                        Postgres
────────────────────────────────────────────
(Firebase Auth)              →   users
users/{uid}/transactions     →   transactions
users/{uid}/cards            →   cards
users/{uid}/cardExpenses     →   card_expenses
users/{uid}/accounts         →   accounts
users/{uid}/categories       →   categories
users/{uid}/tags             →   tags + transaction_tags (N:N)
users/{uid}/transfers        →   transfers
users/{uid}/budgets          →   budgets
users/{uid}/billPayments     →   bill_payments
users/{uid}/goals            →   goals
users/{uid}/imports          →   imports
users/{uid}/activities       →   activities
users/{uid}/settings/*       →   user_settings
```

**Total: 15 tabelas** (13 collections + `users` + `transaction_tags`)

### Schema das tabelas principais

```sql
-- Base: todos os IDs são UUID v7 (ordenáveis por tempo)
-- Timestamps: created_at, updated_at padrão em todas as tabelas

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid    TEXT UNIQUE NOT NULL,
    email           TEXT NOT NULL,
    display_name    TEXT,
    photo_url       TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);

CREATE TABLE accounts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    name        TEXT NOT NULL,
    type        TEXT DEFAULT 'checking',  -- checking, savings, investment, cash
    icon        TEXT DEFAULT 'Wallet',
    color       TEXT DEFAULT 'blue',
    bank_id     TEXT DEFAULT 'generic',   -- banco BR (nubank/itau/etc.) — BankIcon no frontend
    balance     NUMERIC(12,2) DEFAULT 0,
    archived    BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ
);

CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon        TEXT DEFAULT 'Tag',
    color       TEXT DEFAULT 'violet',
    archived    BOOLEAN DEFAULT false,
    is_default  BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ
);

CREATE TABLE cards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    name            TEXT NOT NULL,
    last_digits     TEXT,
    brand           TEXT,                  -- Visa/Mastercard/Elo (bandeira)
    credit_limit    NUMERIC(12,2),         -- Firestore: `limit` (legado) → `credit_limit`
    closing_day     SMALLINT,
    due_day         SMALLINT,
    color           TEXT DEFAULT 'violet',
    icon            TEXT DEFAULT 'CreditCard',
    bank_id         TEXT DEFAULT 'generic',-- banco BR (nubank/itau/etc.) — BankIcon no frontend
    archived        BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);

CREATE TABLE tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name)
);

CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    account_id      UUID REFERENCES accounts(id),
    category_id     UUID REFERENCES categories(id),
    description     TEXT NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    date            DATE NOT NULL,
    notes           TEXT,
    is_paid         BOOLEAN DEFAULT true,
    is_transfer     BOOLEAN DEFAULT false,
    opposite_transaction_id UUID REFERENCES transactions(id),
    recurrence_group TEXT,
    deleted_at      TIMESTAMPTZ,       -- soft delete
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);

CREATE TABLE transaction_tags (
    transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE transaction_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    url             TEXT NOT NULL,       -- public R2 URL
    storage_key     TEXT NOT NULL,       -- R2 object key (para DELETE no bucket)
    name            TEXT NOT NULL,       -- filename original
    content_type    TEXT NOT NULL,       -- MIME type
    size_bytes      BIGINT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_transaction_attachments_tx ON transaction_attachments(transaction_id);

CREATE TABLE card_expenses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    card_id             UUID NOT NULL REFERENCES cards(id),
    category_id         UUID REFERENCES categories(id),
    description         TEXT NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    type                TEXT NOT NULL DEFAULT 'expense'
        CHECK (type IN ('income', 'expense')),  -- estorno = 'income'
    date                DATE NOT NULL,
    bill_month          SMALLINT NOT NULL,      -- 1-12 (Postgres convention; JS é 0-11)
    bill_year           SMALLINT NOT NULL,
    installment         SMALLINT DEFAULT 1,
    total_installments  SMALLINT DEFAULT 1,
    installment_group_id UUID,                  -- agrupa parcelas da mesma compra
    deleted_at          TIMESTAMPTZ,            -- soft delete
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ
);

-- Junction: tags de card_expenses (mesmo padrão de transaction_tags)
CREATE TABLE card_expense_tags (
    card_expense_id UUID NOT NULL REFERENCES card_expenses(id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (card_expense_id, tag_id)
);

CREATE TABLE transfers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    from_account_id     UUID NOT NULL REFERENCES accounts(id),
    to_account_id       UUID NOT NULL REFERENCES accounts(id),
    out_transaction_id  UUID REFERENCES transactions(id),
    in_transaction_id   UUID REFERENCES transactions(id),
    amount              NUMERIC(12,2) NOT NULL,
    date                DATE NOT NULL,
    description         TEXT,
    deleted_at          TIMESTAMPTZ,    -- soft delete
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE budgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    category_id     UUID NOT NULL REFERENCES categories(id),
    amount          NUMERIC(12,2) NOT NULL,
    month           SMALLINT NOT NULL,
    year            SMALLINT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ,
    UNIQUE(user_id, category_id, month, year)
);

CREATE TABLE bill_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    card_id             UUID NOT NULL REFERENCES cards(id),
    account_id          UUID REFERENCES accounts(id),
    transaction_id      UUID REFERENCES transactions(id),
    month               SMALLINT NOT NULL,
    year                SMALLINT NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    total_bill          NUMERIC(12,2),
    carry_over_balance  NUMERIC(12,2) DEFAULT 0,
    is_partial          BOOLEAN DEFAULT false,
    paid_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    category_id     UUID REFERENCES categories(id),
    name            TEXT NOT NULL,
    type            TEXT DEFAULT 'saving',  -- saving, reduction, payment
    target_amount   NUMERIC(12,2) NOT NULL,
    current_amount  NUMERIC(12,2) DEFAULT 0,
    deadline        DATE,
    icon            TEXT DEFAULT 'Target',
    color           TEXT DEFAULT 'violet',
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    completed_at    TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,    -- soft delete
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);

CREATE TABLE imports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    card_id         UUID REFERENCES cards(id),
    document_type   TEXT,
    file_name       TEXT,
    file_url        TEXT,
    status          TEXT DEFAULT 'completed',
    items_imported  INTEGER DEFAULT 0,
    total_amount    NUMERIC(12,2),
    ai_model        TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    action          TEXT NOT NULL,      -- create, update, delete, restore
    entity_type     TEXT NOT NULL,      -- transaction, card_expense, etc.
    entity_id       UUID NOT NULL,
    entity_name     TEXT,
    entity_subtype  TEXT,               -- income/expense para transactions
    old_data        JSONB,              -- snapshot ANTES (null em create)
    new_data        JSONB,              -- snapshot DEPOIS (null em delete)
    metadata        JSONB,              -- info extra (source: web/import/api)
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_settings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID UNIQUE NOT NULL REFERENCES users(id),
    theme       TEXT DEFAULT 'dark',
    show_values BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN DEFAULT false,
    onboarding_step INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ
);
```

### Índices

```sql
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_account ON transactions(user_id, account_id);
CREATE INDEX idx_transactions_active ON transactions(user_id, date) WHERE deleted_at IS NULL;

CREATE INDEX idx_card_expenses_user_bill ON card_expenses(user_id, card_id, bill_year, bill_month);
CREATE INDEX idx_card_expenses_active ON card_expenses(user_id, card_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_card_expenses_group ON card_expenses(installment_group_id) WHERE installment_group_id IS NOT NULL;

CREATE INDEX idx_budgets_user_period ON budgets(user_id, month, year);
CREATE INDEX idx_bill_payments_user_period ON bill_payments(user_id, month, year);
CREATE INDEX idx_activities_user_date ON activities(user_id, created_at DESC);
CREATE INDEX idx_transfers_user_date ON transfers(user_id, date DESC);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_imports_user_date ON imports(user_id, created_at DESC);
```

---

## 4. Estrutura do Backend (FastAPI)

### Estrutura de pastas

```
mypay-api/
├── Dockerfile
├── pyproject.toml
├── alembic.ini
├── alembic/
│   └── versions/           # migrations versionadas
├── src/
│   ├── main.py             # FastAPI app factory
│   ├── api/                # Routers (HTTP thin layer)
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── transactions.py
│   │   ├── cards.py
│   │   ├── card_expenses.py
│   │   ├── accounts.py
│   │   ├── categories.py
│   │   ├── tags.py
│   │   ├── transfers.py
│   │   ├── budgets.py
│   │   ├── bill_payments.py
│   │   ├── goals.py
│   │   ├── imports.py
│   │   ├── documents.py    # upload + processamento IA
│   │   ├── events.py       # SSE endpoint
│   │   └── settings.py
│   ├── schemas/            # Pydantic v2 DTOs (request/response)
│   │   ├── __init__.py
│   │   ├── transactions.py
│   │   ├── cards.py
│   │   ├── card_expenses.py
│   │   └── ...
│   ├── usecases/           # Regras de negócio + orquestração
│   │   ├── __init__.py
│   │   ├── transactions.py
│   │   ├── cards.py
│   │   ├── card_expenses.py
│   │   ├── transfers.py
│   │   └── ...
│   ├── repositories/       # Acesso a dados (SQLAlchemy queries)
│   │   ├── __init__.py
│   │   ├── base.py         # CRUD genérico + SoftDeleteMixin
│   │   ├── transactions.py
│   │   └── ...
│   ├── models/             # SQLAlchemy ORM (tabelas)
│   │   ├── __init__.py
│   │   ├── base.py         # declarative base, mixins
│   │   ├── user.py
│   │   ├── transaction.py
│   │   └── ...
│   ├── core/               # Config, auth, deps, exceptions
│   │   ├── __init__.py
│   │   ├── config.py       # Pydantic Settings
│   │   ├── auth.py         # Firebase token verification
│   │   ├── database.py     # async engine, session factory
│   │   ├── deps.py         # Depends() factories
│   │   └── exceptions.py   # Domain exceptions → HTTP mapping
│   └── services/           # Integrações externas
│       ├── __init__.py
│       ├── ai/
│       │   ├── pipeline.py     # Orquestrador da pipeline
│       │   ├── extractor.py    # pdfplumber/pypdfium2
│       │   ├── parsers/        # Parsers determinísticos por emissor
│       │   │   ├── base.py
│       │   │   ├── nubank.py
│       │   │   └── c6.py
│       │   ├── llm.py          # instructor + Gemini
│       │   └── validator.py    # Regras de validação pós-extração
│       ├── push.py         # FCM via firebase-admin
│       ├── storage.py      # Cloudflare R2 via boto3
│       └── events.py       # Postgres LISTEN/NOTIFY helper
└── tests/
    ├── conftest.py         # fixtures (testcontainers Postgres)
    ├── test_transactions.py
    └── ...
```

### Fluxo de uma request

```
HTTP Request
    ↓
Router (api/transactions.py)     ← Validação HTTP, auth via Depends
    ↓
DTO (schemas/transactions.py)    ← Pydantic valida input
    ↓
UseCase (usecases/transactions.py) ← Regra de negócio, orquestração
    ↓
Repository (repositories/transactions.py) ← Query SQL via SQLAlchemy
    ↓
Model (models/transaction.py)    ← ORM mapping
    ↓
PostgreSQL
```

### Auth: Firebase token → FastAPI

```python
# core/auth.py
from firebase_admin import auth as fb_auth

async def get_current_user(authorization: str = Header(...)) -> User:
    token = authorization.removeprefix("Bearer ").strip()
    decoded = fb_auth.verify_id_token(token)
    return await user_repo.get_or_create_by_firebase_uid(
        decoded["uid"], decoded.get("email"), decoded.get("name")
    )
```

### Real-time: SSE + LISTEN/NOTIFY

```python
# api/events.py
@router.get("/events")
async def stream(user: User = Depends(get_current_user)):
    async def event_generator():
        async with db_listen(f"user_{user.id}") as listener:
            async for payload in listener:
                yield {"event": payload["entity"], "data": payload["json"]}
    return EventSourceResponse(event_generator())
```

Frontend escuta via `EventSource` e invalida queries afetadas.

---

## 5. Pipeline de IA (Backend Python)

### Arquitetura

```
PDF upload → Detecção de tipo → Extração de texto → Detecção de emissor
                                                          ↓
                                              ┌───────────┴───────────┐
                                              ↓                       ↓
                                    Parser determinístico       LLM (fallback)
                                    (Nubank, C6, etc.)     instructor + Gemini
                                              ↓                       ↓
                                              └───────────┬───────────┘
                                                          ↓
                                              Validação por regras
                                              (soma, datas, dedup)
                                                          ↓
                                              Resultado validado (Pydantic model)
```

### Bibliotecas

| Etapa | Biblioteca |
|---|---|
| Render/texto PDF | `pypdfium2` ou `PyMuPDF` |
| Extração de tabelas | `pdfplumber` |
| OCR fallback (scans) | `paddleocr` (fase 2) |
| LLM structured output | `instructor` + `pydantic` v2 |
| Cliente Gemini | `google-genai` |
| Hashing/dedup | `hashlib` (stdlib) |

### Validação com instructor + Pydantic

```python
class CardInvoice(BaseModel):
    issuer: str
    billing_month: int
    billing_year: int
    total_amount: Decimal
    transactions: list[Transaction]

    @model_validator(mode="after")
    def transactions_sum_matches_total(self):
        soma = sum(t.amount for t in self.transactions)
        if abs(soma - self.total_amount) > Decimal("0.02"):
            raise ValueError(f"Soma {soma} != total {self.total_amount}")
        return self
```

`instructor` reenvia automaticamente ao LLM com a mensagem de erro se a validação falhar (até 3 tentativas).

### Fases de implementação da IA

- **Fase 1:** `pypdfium2` + `pdfplumber` + `instructor` + Gemini structured output
- **Fase 2:** Parsers determinísticos para emissores mais usados (Nubank, C6, Bradesco)
- **Fase 3:** `paddleocr` para PDFs scaneados, multi-modelo fallback

---

## 6. Soft Delete + Audit Trail

### Soft delete

**Tabelas com `deleted_at`:** transactions, card_expenses, transfers, bill_payments, goals

**Comportamento:**
- Toda query padrão filtra `WHERE deleted_at IS NULL`
- `DELETE` no endpoint → `UPDATE SET deleted_at = now()`
- `POST /{id}/restore` → `UPDATE SET deleted_at = NULL`
- Frontend: toast "Removido. [Desfazer]" por 8 segundos (UndoContext já existe)
- Purge automático: não implementar no v1 (disco barato)

### Audit trail (activities)

**Toda escrita** (create/update/delete/restore) registra em `activities`:
- `old_data` JSONB: snapshot completo ANTES da mudança (null em create)
- `new_data` JSONB: snapshot completo DEPOIS da mudança (null em delete)
- Permite reconstruir qualquer registro deletado

---

## 7. Migração de Dados

### Estratégia: Big-bang (ETL one-shot)

Escolhida por: single-user, volume pequeno (~milhares de docs), todas as collections interconectadas.

### 7.1 Onde vive o código do ETL (e por quê)

**Localização:** `mypay-api/scripts/migrate_firestore_to_postgres/` (dentro do repo do backend, isolado do código de aplicação em `src/`).

**Motivação:**

| Alternativa | Decisão |
|---|---|
| Repo separado só pro ETL | **Rejeitado** — duplica schema, mappers, validações; qualquer mudança no backend quebra sincronização. |
| Dentro de `mypay-api/src/` como usecase/endpoint | **Rejeitado** — ETL é one-shot, não deve expor superfície HTTP nem poluir o domain layer. |
| `mypay-api/scripts/` fora de `src/` | **Adotado** — reusa models SQLAlchemy, mappers, `DATABASE_URL` e credenciais Firebase (já necessárias pra Auth/FCM); permanece isolado da API de runtime. |

**Ganhos concretos:**

- Reusa `src/infra/database/models/` — se uma coluna muda, o ETL acompanha automaticamente.
- Reusa `src/infra/database/mappers.py` e validações Pydantic — transforms consistentes com a API.
- Mesma infra de testes (pytest + testcontainers) serve pra dry-run com dump Firestore fake.
- `firebase-admin` já é dep do backend (Auth + FCM), sem custo adicional.

### 7.2 Estrutura do script ETL

```
mypay-api/
└── scripts/
    └── migrate_firestore_to_postgres/
        ├── __init__.py
        ├── __main__.py                     # entry point: python -m scripts.migrate_firestore_to_postgres
        ├── config.py                       # load env: FIREBASE_CREDENTIALS, DATABASE_URL, R2 (read-only)
        ├── export.py                       # leitura do Firestore via firebase-admin
        ├── id_map.py                       # cache in-memory: Firestore doc_id (str) → UUID novo
        ├── transform/                      # uma transform por entidade
        │   ├── __init__.py
        │   ├── users.py
        │   ├── accounts.py
        │   ├── categories.py
        │   ├── tags.py
        │   ├── cards.py
        │   ├── transactions.py
        │   ├── transaction_tags.py         # junction derivada de transactions.tags[]
        │   ├── transaction_attachments.py  # achata attachments[] embutidos; deriva storage_key da URL R2
        │   ├── card_expenses.py
        │   ├── transfers.py
        │   ├── budgets.py
        │   ├── bill_payments.py
        │   ├── goals.py
        │   ├── imports.py
        │   ├── activities.py
        │   └── user_settings.py
        ├── load.py                         # insert no Postgres reusando models SQLAlchemy
        ├── validate.py                     # contagens pós-carga (Firestore docs == Postgres rows)
        └── README.md                       # como rodar (dry-run, cutover)
```

### 7.3 Contrato: transforms lêem os entity maps

**Fonte canônica das transformações por entidade:** `mypay-api/.claude/map/entities/<entidade>.md`.

Cada arquivo `transform/<entidade>.py` implementa **exatamente** o mapeamento declarado no entity map correspondente:
- Renomes de campo (camelCase → snake_case)
- Transformações de tipo (float → Decimal, Timestamp → datetime, string id → UUID, 0-indexed month → 1-indexed, etc.)
- Derivações (storage_key extraído de URL, junction tables de arrays, sub-docs → rows)
- Defaults e nullability

Se um transform divergir do entity map, é **o map que governa** — ajuste o código, não o map. Se o map estiver errado, corrija o map primeiro, depois o código.

### 7.4 Ordem de dependências (canônica)

Inserção segue a ordem de FKs. Qualquer mudança neste grafo implica revisar os entity maps:

```
1.  users
2.  accounts          (FK: users)
3.  categories        (FK: users, self-ref parent)
4.  tags              (FK: users)
5.  cards             (FK: users)
6.  transactions      (FK: users, accounts, categories)
7.  transaction_tags  (FK: transactions, tags)
8.  transaction_attachments  (FK: transactions, users)
9.  card_expenses     (FK: users, cards, categories)
10. transfers         (FK: users, accounts × 2, transactions × 2)
11. budgets           (FK: users, categories)
12. bill_payments     (FK: users, cards)
13. goals             (FK: users)
14. imports           (FK: users)
15. activities        (FK: users; audit trail)
16. user_settings     (FK: users; 1:1)
```

### 7.5 Transforms críticos (resumo — detalhes nos entity maps)

| Transform | Escopo | Detalhe |
|---|---|---|
| `Timestamp → datetime` | Todas as entidades com `createdAt`/`updatedAt` | `firebase_admin.firestore.SERVER_TIMESTAMP` → `datetime` tz-aware (UTC) |
| `float → Decimal` | `transactions.amount`, `card_expenses.amount`, `transfers.amount`, `budgets.amount`, `bill_payments.*` | `Decimal(str(v))` — NUNCA `Decimal(v)` direto (perde precisão) |
| `string id → UUID` | Todas as FKs | `uuid.uuid4()` novo por doc; cache em `id_map.py` resolve FKs |
| `month 0-indexed → 1-indexed` | `budgets.month`, `card_expenses.bill_month`, qualquer campo de mês | JS usa 0=Jan, Postgres usa 1=Jan |
| `tags array → junction` | `transactions.tags[]` → `transaction_tags` | Resolve nome → UUID via tags já carregadas |
| `attachments[] embutido → rows` | `transactions.attachments[]` → `transaction_attachments` | Achata array; `storage_key` extraído da URL R2 via regex (`comprovantes/{uid}/{ts}_{file}`) |
| `settings sub-docs → row` | Múltiplos sub-docs em `users/{uid}/settings/*` | Consolida em 1 row `user_settings` |
| `attachment singular → attachments[]` | Docs legado com campo `attachment` único | Normaliza pra array de 1 item antes do achatamento |
| `limit → credit_limit` | `cards.limit` (Firestore) | Rename: campo em Firestore é `limit`, Postgres é `credit_limit` (evita shadow de keyword SQL) |
| `bankId → bank_id` | `cards`, `accounts` | Adicionado em 2026-04-15; default `'generic'`; controla `<BankIcon />` no frontend |
| `card_expenses.tags[] → card_expense_tags` | `card_expenses` | Mesmo padrão de transactions: junction; resolve nome→tag.id (cria tag user-scope se não existir) |
| `card_expenses sem type → 'expense'` | `card_expenses` | Docs Firestore antigos sem `type` recebem 'expense'. Estorno = `'income'` |
| **Drop em card_expenses:** `notes`, `attachments`, `isFixed`, `fixedFrequency`, `recurrenceGroup` | `card_expenses` | Decisão 2026-04-15: dead-code do Firestore schemaless. ETL DEVE ignorar esses campos — não tentar mapear (anexos vivem em `bill_payment`; recorrência só em `transactions`) |
| `transfers.fromAccountName/toAccountName` → drop (denormalizado) | `transfers` | Backend resolve via JOIN em accounts; ETL não precisa migrar esses campos |
| `transfers` cria 2 transactions vinculadas + transfer atomicamente | `transfers` | ETL: para cada doc Firestore `transfers/*`, gera 2 rows em `transactions` (out=expense, in=income, ambos `is_transfer=true`) com `opposite_transaction_id` cruzado, + 1 row em `transfers` com FKs `out_transaction_id`/`in_transaction_id`. Não copiar `category` antigo (`transfer_out`/`transfer_in`) — backend não usa |
| `budgets.month 0→1-indexed` | `budgets` | Mesmo padrão de `card_expenses.bill_month` — JS 0=Jan, Postgres 1=Jan; **UNIQUE constraint** (user_id, category_id, month, year) impede duplicata por categoria/mês |
| `copy-previous` server-side | `budgets` | Backend handles Jan→Dec rollback e skip de duplicatas. Frontend chama 1 POST `/budgets/copy-previous` em vez de orquestrar busca + N inserts |

### 7.6 Garantias operacionais

- **Transação única.** Todo o load envelopado em `async with session.begin()`. Falha em qualquer etapa = rollback total. Sem estado parcial no Postgres.
- **Idempotência em staging.** Antes de rodar: `alembic downgrade base && alembic upgrade head` para drop + recreate. Em **produção, nunca** — a única ação idempotente em prod é "nunca rodar duas vezes".
- **Validação pós-carga.** `validate.py` compara:
  - Contagem de docs Firestore vs. rows Postgres por entidade
  - Soma de `amount` em transactions (Firestore) vs. soma em Postgres
  - Integridade referencial (FKs não-órfãs)
  - Presença de `user_settings` para cada user
- **Anexos (R2) não movem.** Objetos permanecem no bucket atual; só metadados migram. `storage_key` é derivado da URL pública; se regex falhar pra algum item, ETL aborta com erro claro.
- **Auditoria desativada durante ETL.** O decorator `@audited` não roda no load (usa models diretamente, não usecases). Activities históricas migram do Firestore como dados; futuras serão escritas pela API normalmente.

### 7.7 Como rodar

**Dry-run local (contra Postgres de staging):**

```bash
cd mypay-api

# Staging: drop + recreate
DATABASE_URL=postgresql+asyncpg://.../mypay_staging \
  uv run alembic downgrade base && uv run alembic upgrade head

# ETL
FIREBASE_CREDENTIALS=/path/to/service-account.json \
DATABASE_URL=postgresql+asyncpg://.../mypay_staging \
  uv run python -m scripts.migrate_firestore_to_postgres --dry-run

# Sem --dry-run: commita de fato
FIREBASE_CREDENTIALS=/path/to/service-account.json \
DATABASE_URL=postgresql+asyncpg://.../mypay_staging \
  uv run python -m scripts.migrate_firestore_to_postgres
```

**Cutover em produção:**

```bash
# Opção 1: da máquina do dev, apontando pra Postgres de prod via túnel/IP permitido
FIREBASE_CREDENTIALS=/path/to/service-account.json \
DATABASE_URL=postgresql+asyncpg://.../mypay_prod \
  uv run python -m scripts.migrate_firestore_to_postgres

# Opção 2: exec no container do backend em prod
docker exec -it mypay-api python -m scripts.migrate_firestore_to_postgres
```

### 7.8 Testes do ETL

- `mypay-api/tests/etl/` com testcontainers:
  - Fixture injeta dump Firestore fake (dict de collections)
  - Roda ETL completo contra Postgres ephemeral
  - Asserta contagens, transforms críticos e integridade referencial
- Pelo menos 1 teste por entity map: valida que cada transform respeita o contrato declarado.

### Dia do cutover

```
09:00  Modo manutenção (ou simplesmente não usa)
09:01  Roda script ETL (seção 7.7)
09:05  Valida contagens e integridade (validate.py)
09:10  Push frontend apontando pra nova API (Vercel)
09:15  Testa fluxos principais
09:20  Volta a usar normalmente
       Firestore intocado como backup por 30 dias
```

---

## 8. Adaptação do Frontend

### O que muda

| De (Firestore) | Para (REST API) |
|---|---|
| `onSnapshot()` listeners (13 hooks) | `fetch()` + SSE invalidation |
| `addDoc()` / `updateDoc()` / `deleteDoc()` | `POST` / `PUT` / `DELETE` endpoints |
| Firebase SDK direto no browser | `fetch('/api/v1/...')` com Bearer token |
| Credenciais S3 no bundle | Upload via backend (seguro) |
| Gemini API key no bundle | Processamento IA no backend |

### O que NÃO muda

- Firebase Auth (login com Google permanece idêntico)
- FCM push notifications (service worker mantido)
- React Router, Context API, Tailwind CSS, Recharts, Lucide
- Todas as pages e componentes visuais (UI intocada)

### Hooks: de Firestore para API

Cada hook em `useFirestore.js` vira um hook que chama a API REST:

```javascript
// ANTES: useFirestore.js
const unsubscribe = onSnapshot(query(...), (snapshot) => {
  setTransactions(snapshot.docs.map(...))
})

// DEPOIS: useTransactions.js
const fetchTransactions = async () => {
  const res = await fetch(`/api/v1/transactions?month=${month}&year=${year}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  setTransactions(await res.json())
}

// SSE para invalidação
useEffect(() => {
  const es = new EventSource('/api/v1/events')
  es.addEventListener('transaction', () => fetchTransactions())
  return () => es.close()
}, [])
```

### Variáveis de ambiente do frontend (simplificado)

```
# Mantém (Firebase Auth + FCM)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...

# NOVO (API backend)
VITE_API_URL=https://api.mypay.palmadigital.com.br

# REMOVIDOS (migram pro backend)
# VITE_GOOGLE_AI_KEY        → backend
# VITE_S3_*                 → backend
# VITE_FIREBASE_STORAGE_BUCKET → não mais necessário
```

---

## 9. API Endpoints

### Estrutura: `/api/v1/{resource}`

```
Auth
  POST   /api/v1/auth/me                    # get/create user from Firebase token

Transactions
  GET    /api/v1/transactions               # ?month=&year=&account_id=&category_id=
  POST   /api/v1/transactions
  PUT    /api/v1/transactions/{id}
  DELETE /api/v1/transactions/{id}          # soft delete
  POST   /api/v1/transactions/{id}/restore
  GET    /api/v1/transactions/{id}/attachments
  POST   /api/v1/transactions/{id}/attachments        # multipart upload (file)
  DELETE /api/v1/transactions/{id}/attachments/{attachment_id}

Cards
  GET    /api/v1/cards
  POST   /api/v1/cards
  PUT    /api/v1/cards/{id}
  DELETE /api/v1/cards/{id}

Card Expenses
  GET    /api/v1/card-expenses              # ?card_id=&month=&year=
  POST   /api/v1/card-expenses
  PUT    /api/v1/card-expenses/{id}
  DELETE /api/v1/card-expenses/{id}         # soft delete
  POST   /api/v1/card-expenses/{id}/restore

Accounts
  GET    /api/v1/accounts
  POST   /api/v1/accounts
  PUT    /api/v1/accounts/{id}
  DELETE /api/v1/accounts/{id}

Categories
  GET    /api/v1/categories
  POST   /api/v1/categories
  PUT    /api/v1/categories/{id}
  DELETE /api/v1/categories/{id}
  POST   /api/v1/categories/initialize      # default categories

Tags
  GET    /api/v1/tags
  POST   /api/v1/tags
  PUT    /api/v1/tags/{id}
  DELETE /api/v1/tags/{id}

Transfers
  GET    /api/v1/transfers                  # ?month=&year=
  POST   /api/v1/transfers                  # cria 2 transactions + transfer
  DELETE /api/v1/transfers/{id}             # soft delete (+ transactions vinculadas)

Budgets
  GET    /api/v1/budgets                    # ?month=&year=
  POST   /api/v1/budgets
  PUT    /api/v1/budgets/{id}
  DELETE /api/v1/budgets/{id}
  POST   /api/v1/budgets/copy-previous      # copia do mês anterior

Bill Payments
  GET    /api/v1/bill-payments              # ?month=&year=
  POST   /api/v1/bill-payments
  DELETE /api/v1/bill-payments/{id}

Goals
  GET    /api/v1/goals
  POST   /api/v1/goals
  PUT    /api/v1/goals/{id}
  PATCH  /api/v1/goals/{id}/progress
  DELETE /api/v1/goals/{id}                 # soft delete

Documents (IA)
  POST   /api/v1/documents/process          # upload + pipeline IA
  GET    /api/v1/documents/imports           # histórico

Settings
  GET    /api/v1/settings
  PUT    /api/v1/settings

Events (SSE)
  GET    /api/v1/events                     # Server-Sent Events stream

Export
  GET    /api/v1/export/csv                 # ?type=transactions|card_expenses|full
  GET    /api/v1/export/json

Push Notifications
  POST   /api/v1/push/register              # salvar FCM token
  DELETE /api/v1/push/unregister
```

---

## 10. Fases de Desenvolvimento

### Fase A — Fundação (1-2 semanas)

**Objetivo:** projeto FastAPI funcional com auth e infraestrutura base.

- [ ] Criar repositório `mypay-api`
- [ ] Scaffold FastAPI + pyproject.toml + Dockerfile
- [ ] Config: Pydantic Settings, structlog
- [ ] Database: SQLAlchemy 2.0 async engine + session factory
- [ ] Alembic: setup + migration inicial (todas as 15 tabelas)
- [ ] Auth: Firebase token verification via `Depends`
- [ ] Middleware: CORS, error handler (domain exceptions → HTTP), request ID
- [ ] Repository base: CRUD genérico + SoftDeleteMixin
- [ ] Testes: conftest com testcontainers (Postgres real)
- [ ] CI: lint (ruff) + testes
- [ ] Deploy: Docker → Easypanel (health check endpoint)

### Fase B — Core financeiro (2-3 semanas)

**Objetivo:** todos os endpoints CRUD para as entidades financeiras.

- [ ] `accounts` — CRUD + archive + defaults
- [ ] `categories` — CRUD + hierarquia (parent_id) + archive + defaults
- [ ] `tags` — CRUD + junction table
- [ ] `transactions` — CRUD + soft delete + restore + filtros (mês, conta, categoria)
- [ ] `transaction_attachments` — upload/list/delete de comprovantes (R2 + metadata)
- [ ] `transfers` — create (2 transactions vinculadas) + delete
- [ ] `cards` — CRUD
- [ ] `card_expenses` — CRUD + parcelas + installment_group_id + soft delete
- [ ] `bill_payments` — CRUD + cálculo parcial + carry over
- [ ] `budgets` — CRUD + copy from previous month
- [ ] `activities` — audit trail automático em todo usecase
- [ ] `settings` — CRUD (tema, privacidade, onboarding)

### Fase C — IA + Importação (1-2 semanas)

**Objetivo:** pipeline de processamento de documentos.

- [ ] Upload de PDF/imagem via endpoint
- [ ] Extração de texto com `pypdfium2`/`pdfplumber`
- [ ] Structured output com `instructor` + Gemini
- [ ] Validação por regras (soma, datas, dedup)
- [ ] Endpoint de processamento + histórico de imports
- [ ] Testes com faturas reais (Nubank, C6, Bradesco)
- [ ] Storage: upload para R2 via backend (remove credenciais do frontend)

### Fase D — Complementos (1 semana)

**Objetivo:** features restantes + real-time.

- [ ] `goals` — CRUD + progresso + archive
- [ ] SSE: endpoint `/events` + Postgres LISTEN/NOTIFY
- [ ] Push: registrar FCM token + enviar via `firebase-admin`
- [ ] Export: CSV/JSON via backend
- [ ] Insights: mover `insightService.js` para backend
- [ ] Parsers determinísticos por emissor (Nubank, C6) — fase 2 da IA

### Fase E — Frontend + Cutover (1-2 semanas)

**Objetivo:** adaptar frontend e migrar dados.

- [ ] Criar `src/api/client.js` — fetch wrapper com auth token
- [ ] Migrar hooks: `useFirestore.js` → hooks individuais chamando API
- [ ] Integrar SSE para invalidação de queries
- [ ] Remover dependências Firebase Firestore do frontend
- [ ] Remover variáveis VITE_S3_* e VITE_GOOGLE_AI_KEY
- [ ] Script ETL em `mypay-api/scripts/migrate_firestore_to_postgres/` (ver seção 7.1–7.8)
- [ ] Testes do ETL em `mypay-api/tests/etl/` com testcontainers
- [ ] Dry-run do ETL em staging (múltiplas vezes)
- [ ] Cutover big-bang (ver seção 7 e 7.7)
- [ ] Smoke test em produção
- [ ] Monitorar 1 semana
- [ ] Decomissionar Firestore após 30 dias

---

## 11. Segurança

> Modelo em camadas (defense in depth). Cada camada é independente — se uma falha, a próxima ainda protege. Status real refletido em ✅ (implementado), 🟡 (parcial), 🔴 (gap aberto).

### 11.1 Modelo em camadas

```
┌──────────────────────────────────────────────────────────┐
│  L1 — TRANSPORTE        HTTPS + CORS whitelist           │
│  L2 — AUTENTICAÇÃO      Firebase JWT (firebase-admin)    │
│  L3 — AUTORIZAÇÃO       user_id em todas as queries      │
│  L4 — VALIDAÇÃO         Pydantic + CHECK constraint + FK │
│  L5 — SECRETS           Env do servidor (nunca bundle)   │
│  L6 — RATE LIMITING     Por IP + por user                │
│  L7 — AUDITORIA         @audited → activities (JSONB)    │
│  L8 — BACKUP / RECOVERY Backup diário + soft delete      │
└──────────────────────────────────────────────────────────┘
```

### 11.2 Estado por camada

#### L1 — Transporte
| Item | Status | Notas |
|---|:-:|---|
| HTTPS no backend (Let's Encrypt via Traefik/Easypanel) | ✅ | Cert renova automaticamente |
| HTTPS no frontend (Vercel managed cert) | ✅ | — |
| CORS whitelist explícita (sem `*`) | ✅ | Lista origens permitidas em settings |
| **CSP header** (`Content-Security-Policy`) | 🔴 | Vercel headers config — `default-src 'self'`; restringe origens de scripts/styles |
| **WAF / Cloudflare proxied** | 🔴 | DDoS, scanners, SQL injection automatizada |

#### L2 — Autenticação
| Item | Status | Notas |
|---|:-:|---|
| Firebase Auth no frontend (login Google) | ✅ | Mantido pós-cutover |
| `firebase-admin` valida JWT no backend (`Depends(get_current_db_user)`) | ✅ | Aplicado em todo endpoint exceto `/health` |
| Token expiração padrão (~1h) + refresh automático no SDK | ✅ | Firebase SDK gerencia |
| Endpoint admin "logout all devices" (`revokeRefreshTokens`) | 🔴 | Útil em compromise de conta — Firebase admin já suporta |
| **2FA opcional (TOTP)** | 🔴 | Firebase suporta — habilitar em Settings da conta |

#### L3 — Autorização
| Item | Status | Notas |
|---|:-:|---|
| Todo usecase recebe `user_id` do token (não do request) | ✅ | Padrão consistente |
| Queries filtram por `WHERE user_id = ?` | ✅ | Sem vazamento cross-user |
| Ownership check em get/update/delete | ✅ | Retorna 404 (não 403) pra evitar enumeration |
| Frontend nunca decide autorização (só esconde botão) | ✅ | Backend é a fonte de verdade |

#### L4 — Validação
| Item | Status | Notas |
|---|:-:|---|
| Pydantic v2 em todo Create/Update | ✅ | `Field(min, max, ge, le, pattern)` |
| CHECK constraints no Postgres | ✅ | `type IN ('income', 'expense')`, dates válidas, etc. |
| Foreign Keys com integridade referencial | ✅ | Sem orphan records |
| Soft delete (`deleted_at`) | ✅ | Em transactions, card_expenses, transfers, goals, billpayments |
| MIME validation em uploads (PDF/JPG/PNG, 10MB) | ✅ | Backend rejeita antes de mandar pro R2 |
| **Antivírus em uploads (ClamAV)** | 🔴 | Considerar se escala — hoje é single-user, baixo risco |
| Validação UX no frontend (não confiar) | ✅ | Apenas pra feedback rápido |

#### L5 — Secrets
| Item | Status | Notas |
|---|:-:|---|
| `.env` no `.gitignore` | ✅ | Confirmado |
| Secrets via env do container (Easypanel) | ✅ | Nunca em código |
| Service account Firebase (admin) via env base64 | ✅ | Não commitado |
| Credenciais R2 + Gemini só no backend | ✅ (após cutover) | Hoje frontend ainda usa R2/Gemini direto até migração concluir |
| `pydantic-settings` carrega/valida envs | ✅ | Falha rápido se faltar var crítica |
| **Rotação periódica de chaves** | 🔴 | Sem processo definido — manual hoje |

#### L6 — Rate limiting
| Item | Status | Notas |
|---|:-:|---|
| **Rate limit global por IP** | 🔴 | `slowapi` middleware: 60 req/min default |
| **Rate limit em `/auth/me`** | 🔴 | Brute force em login: 10 req/min por IP |
| **Rate limit em `/documents/process`** (IA pesada) | 🔴 | 10 req/min por user — protege custo Gemini |
| **Rate limit em uploads** (`/attachments`) | 🔴 | 30 req/min por user |
| Limite de tamanho de body (1MB padrão) | ✅ | FastAPI default + override em endpoints multipart (10MB) |

#### L7 — Auditoria
| Item | Status | Notas |
|---|:-:|---|
| Decorator `@audited` em todo usecase mutação | ✅ | Captura action, entity_type, entity_id, old_data, new_data |
| Tabela `activities` (JSONB) | ✅ | Permite query histórica + diff |
| Logs estruturados (`structlog` JSON) | ✅ | Stack + request_id + user_id |
| Logs **não vazam** token, password, body com PII | ✅ | Convenção: nunca logar `Authorization` header |
| **Retenção de logs definida** (30d quente / 90d frio / purge) | 🔴 | Hoje retém indefinido — definir política |
| **Alerta em spike de 401/403** (>100/min) | 🔴 | Grafana + webhook Slack |
| **Alerta em erros 500** (>10/min) | 🔴 | Mesmo |
| Activities pra forense pós-incidente | ✅ | Query SQL direto resolve |

#### L8 — Backup / Recovery
| Item | Status | Notas |
|---|:-:|---|
| Backup diário Postgres → Google Drive | ✅ | Configurado, rodando |
| `test-restore.sh` valida que backup é restaurável | ✅ | Roda periodicamente |
| Soft delete (recuperação de erro humano) | ✅ | Com endpoint `/restore` em transactions e card_expenses |
| Firestore intocado por 30d pós-cutover (rollback de emergência) | ✅ | Documentado em seção 7 |
| **RTO/RPO documentados** | 🔴 | Definir: aceitamos perder X horas de dados? Quanto tempo voltar online? |

### 11.3 Gaps abertos (priorizados)

#### 🔴 Bloqueia cutover (resolver antes do go-live)

| # | Gap | Mitigação | Critério de aceite |
|---|---|---|---|
| 1 | Sem rate limiting | `slowapi` configurado em endpoints sensíveis | `pytest` que valida 11º request em 1 min retorna 429 |
| 2 | CORS whitelist final | Lista de origens de produção em `settings.py` | Request de origem não-listada retorna preflight 403 |
| 3 | CSP header no frontend | `vercel.json` com `Content-Security-Policy` | Browser DevTools não reporta CSP violations no fluxo principal |

#### 🟡 Importante (resolver em ≤ 2 semanas pós-cutover)

| # | Gap | Mitigação | Critério de aceite |
|---|---|---|---|
| 4 | Alertas em 401/403/500 spike | Grafana + Prometheus + webhook Slack | Receber alerta em <2 min após 100 401/min sintético |
| 5 | Retenção de logs definida | Política escrita: 30d/90d/purge | Job de purge rodando + documentado em runbook |
| 6 | RTO/RPO documentados | Discussão + número aceito + simulação | Documento `docs/recovery.md` com simulação em staging |

#### 🟢 Nice to have (avaliar conforme necessidade)

| # | Gap | Mitigação | Quando atacar |
|---|---|---|---|
| 7 | 2FA opcional (TOTP) | Habilitar em Firebase Auth + UI em Settings | Se entrar mais usuários ou risco de phishing aumentar |
| 8 | WAF / Cloudflare proxied | DNS aponta pra CF; CF proxia pro Easypanel | Se receber tráfego anômalo / scanners |
| 9 | "Logout all devices" admin | Endpoint protegido + UI em Settings | Em compromise de conta — pode ser feito manual via Firebase Console enquanto não tem |
| 10 | Rotação periódica de chaves | Runbook trimestral: R2 keys, Gemini key, Firebase service account | Após 1 ano de operação |
| 11 | ClamAV em uploads | Container ClamAV + integração no usecase de upload | Se base de users crescer e upload externo virar attack vector |

### 11.4 Checklist pré-cutover de segurança

Antes do `git push` que aponta o frontend pra API nova em produção, **TODOS** abaixo devem estar ✅:

- [ ] Rate limiting ativo em `/auth/me`, `/documents/process`, `/attachments`, e default global
- [ ] Teste de rate limiting passando (`pytest tests/test_rate_limit.py`)
- [ ] CORS whitelist com APENAS origens de produção (sem `localhost`, sem `*`)
- [ ] CSP header configurado em `vercel.json` e validado em browser
- [ ] `DEBUG=False` confirmado em prod (`/docs` retorna 404)
- [ ] `.env` de produção sem keys de dev/staging
- [ ] Service account Firebase de prod (separado de dev)
- [ ] Backup automático rodou nas últimas 24h e `test-restore.sh` passou
- [ ] Health check (`GET /health`) responde 200 sem auth
- [ ] Endpoint não-`/health` sem token retorna 401 (não 500)
- [ ] Endpoint com token de outro user retorna 404 em recursos alheios
- [ ] Body inválido retorna 422 (não 500) com mensagem útil
- [ ] Upload de arquivo >10MB retorna 413
- [ ] Upload de MIME não-permitido retorna 422
- [ ] Logs de prod NÃO contêm: tokens, senhas, body de requests com PII
- [ ] Firestore continua escrevendo (rede de segurança) — desligar só após 30d

### 11.5 Princípios operacionais

1. **Backend é a única fonte de verdade de autorização.** Frontend pode esconder botão pra UX, mas request sempre passa pela validação server-side.
2. **Zero trust no input.** Todo body/query/header passa por Pydantic. Se Pydantic aceita, vai pro usecase. Se não, 422 antes de chegar no domain layer.
3. **Princípio do menor privilégio.** Frontend tem só credenciais Firebase Auth/FCM. Backend tem credenciais R2/Gemini/Postgres — todas em env do servidor. DB user da aplicação não é superuser.
4. **Falhas seguras.** Erro de auth → nega. Erro de validação → rejeita. Falha de upload R2 → rollback da metadata.
5. **Auditabilidade.** Toda mutação passa por `@audited` → activities table.
6. **Defense in depth.** Validação em 4 camadas (UX → Pydantic → CHECK constraint → FK). Se uma falha, próxima pega.
7. **Logs nunca vazam segredos.** Se em dúvida sobre logar, não loga. Use `request_id` pra correlacionar sem expor PII.

---

## 12. Verificação

### Por fase

**Fase A:**
- [ ] `GET /health` retorna 200
- [ ] `GET /api/v1/auth/me` com Firebase token válido retorna user
- [ ] Alembic migration roda sem erro
- [ ] pytest com testcontainers passa

**Fase B:**
- [ ] CRUD completo de cada entidade via Swagger UI (`/docs`)
- [ ] Soft delete + restore funciona
- [ ] Activities registram create/update/delete com old_data/new_data
- [ ] FKs impedem dados inconsistentes (ex: transaction com account_id inexistente)
- [ ] `NUMERIC(12,2)` sem erros de arredondamento

**Fase C:**
- [ ] Upload de fatura PDF → JSON estruturado com transações
- [ ] Validação pega soma incorreta e reenvia ao LLM
- [ ] Faturas reais dos 3 emissores principais processam corretamente

**Fase D:**
- [ ] SSE endpoint envia eventos quando dados mudam
- [ ] Push notification chega no browser via FCM

**Fase E:**
- [ ] Script ETL migra todos os dados com contagens corretas
- [ ] Frontend funciona 100% apontando para nova API
- [ ] Todos os fluxos testados: criar transação, importar fatura, pagar fatura, transferir, criar meta, ver relatórios
- [ ] `npm run lint` sem erros no frontend
- [ ] Backup do myPay-postgres aparece no Google Drive
- [ ] test-restore.sh valida o backup com sucesso

### Critérios de rollback

Se algum problema crítico for detectado após cutover:
1. Reverter deploy do frontend na Vercel (1 clique — volta pra versão Firestore)
2. Firestore permanece intocado por 30 dias como rede de segurança
3. Nenhum dado é perdido em nenhum cenário

---

## 13. Roadmap pós-cutover (débito técnico identificado)

> Itens **fora do escopo da migração** mas registrados para tratamento depois que a Fase E estabilizar.

### 13.1 Refatorar recorrência de `transactions` — modelo "template indeterminado"

**Problema atual:**
Recorrência fixa em `transactions` (ex.: condomínio, salário, mensalidade) é implementada como **"expansão eager em 12 ocorrências"** — ao criar a despesa fixa, o frontend gera 12 rows em `transactions` com `recurrence_group` em comum (`Transactions.jsx:658-678`). Isso tem dois problemas:

1. **Limite arbitrário de 12.** Despesas verdadeiramente indeterminadas (aluguel sem prazo, condomínio enquanto morar lá, salário enquanto trabalhar) acabam após 12 meses e o usuário precisa recriar manualmente.
2. **Edição em massa sofre.** Mudou o valor do condomínio? Tem que editar via `updateRecurrenceGroup` que percorre todas as 12 ocorrências; mudou só pra frente? Precisa lógica complexa de quais ainda não passaram.

**Modelo proposto: template + ocorrências on-demand.**

```sql
-- Nova tabela: padrão da recorrência
CREATE TABLE recurrence_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    description     TEXT NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    account_id      UUID REFERENCES accounts(id),
    category_id     UUID REFERENCES categories(id),
    frequency       TEXT NOT NULL,           -- daily/weekly/monthly/...
    day_of_period   SMALLINT,                -- ex.: dia 5 do mês
    start_date      DATE NOT NULL,
    end_date        DATE,                    -- NULL = indeterminado
    last_generated  DATE,                    -- até que data já existem rows em transactions
    archived        BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);

-- Transactions ganha FK opcional pro template (em vez de só recurrence_group string)
ALTER TABLE transactions ADD COLUMN recurrence_template_id UUID REFERENCES recurrence_templates(id);
```

**Geração on-demand:**
- Quando o usuário navega pra um mês, o backend (ou um job) garante que `transactions` tem rows pra esse mês baseado nos templates ativos do usuário.
- `last_generated` evita re-geração; só preenche o gap entre `last_generated` e o mês visualizado.
- Ocorrências individuais ficam em `transactions` normais — podem ser editadas individualmente sem afetar template.

**Edição:**
- Mudar template (ex.: novo valor do condomínio) → afeta só ocorrências futuras (geradas após a edição).
- Mudar uma ocorrência específica → não toca o template; vira "exceção" pontual.
- "Editar todas" → propaga template change + atualiza ocorrências passadas se usuário pedir.

**Trade-offs:**
- ✅ Indeterminado de fato (não tem limite de 12).
- ✅ Edição mais previsível (template vs. ocorrência).
- ✅ Menos rows no Postgres (só gera quando necessário).
- ⚠️ Complica leitura: ao listar transactions de um mês, precisa "garantir geração" antes — latência adicional.
- ⚠️ Migração de dados existentes: `recurrence_group` virar template virtual? Ou só novos lançamentos usam o modelo novo?
- ⚠️ Card_expenses NÃO precisa disso (workflow de fatura PDF é diferente — confirmado em 2026-04-15).

**Quando atacar:** após Fase E concluída e cutover estabilizado por ~2 semanas. Antes disso o foco é não regredir features, não adicionar arquitetura nova.

**Origem:** mencionado pelo usuário em 2026-04-15 durante migração de `card_expenses` ("não curto muito o expande em 12 transactions, poderia ficar indeterminado o prazo").
