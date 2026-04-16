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

> **⚠️ Esta seção foi reescrita em 2026-04-15 para alinhar com o modelo Organizze. Veja seção 14 pra contexto e justificativa. Tabelas `card_expenses`, `bill_payments`, `transfers`, `card_expense_tags` foram absorvidas em `transactions`. Tabelas novas: `credit_card_invoices`, `recurrences`.**

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
    description TEXT,                     -- 🆕 (Organizze) texto livre adicional
    is_default  BOOLEAN DEFAULT false,    -- 🆕 (Organizze) marca conta padrão
    balance     NUMERIC(12,2) DEFAULT 0,  -- mantemos armazenado (Organizze calcula on-the-fly; manter por simplicidade)
    archived    BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ
);

CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),  -- ←→ Organizze `kind`
    icon        TEXT DEFAULT 'Tag',
    color       TEXT DEFAULT 'violet',
    group_id    TEXT,                     -- 🆕 (Organizze) semantic key: 'exp_food', 'ear_salary', 'exp_apartment'
    fixed       BOOLEAN DEFAULT false,    -- 🆕 (Organizze) categoria de gasto fixo
    essential   BOOLEAN DEFAULT false,    -- 🆕 (Organizze) categoria essencial vs supérflua
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
    brand           TEXT,                  -- Visa/Mastercard/Elo (bandeira) ←→ Organizze `card_network`
    credit_limit    NUMERIC(12,2),         -- Firestore: `limit` (legado) → `credit_limit`
    closing_day     SMALLINT,
    due_day         SMALLINT,
    color           TEXT DEFAULT 'violet',
    icon            TEXT DEFAULT 'CreditCard',
    bank_id         TEXT DEFAULT 'generic',-- banco BR ←→ Organizze `institution_id`
    description     TEXT,                  -- 🆕 (Organizze) texto livre
    is_default      BOOLEAN DEFAULT false, -- 🆕 (Organizze) marca cartão padrão
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

-- 🆕 Faturas como entidade própria (Organizze: credit_card_invoices)
-- Substitui o uso espalhado de bill_month/bill_year em card_expenses/bill_payments
CREATE TABLE credit_card_invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    card_id         UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    due_date        DATE NOT NULL,                  -- vencimento (Organizze: date)
    starting_date   DATE NOT NULL,                  -- início ciclo
    closing_date    DATE NOT NULL,                  -- fechamento
    -- amount, payment_amount, balance, previous_balance NÃO armazenados.
    -- Calculados on-demand via VIEW ou função:
    --   amount         = SUM(transactions.amount WHERE credit_card_invoice_id = invoice.id AND type='expense')
    --                  - SUM(transactions.amount WHERE credit_card_invoice_id = invoice.id AND type='income')
    --   payment_amount = SUM(transactions.amount WHERE paid_credit_card_invoice_id = invoice.id)
    --   previous_balance = balance da invoice imediatamente anterior do mesmo card (window function)
    --   balance        = previous_balance + amount - payment_amount
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (card_id, starting_date, closing_date)
);
CREATE INDEX idx_credit_card_invoices_card ON credit_card_invoices(card_id, due_date DESC);

-- 🆕 Templates de recorrência (Organizze: recurrences)
-- Substitui modelo "expand 12 transactions" por "template + geração on-demand"
-- (absorve a seção 13.1 deste plano)
CREATE TABLE recurrences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    description     TEXT NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    account_id      UUID REFERENCES accounts(id),
    category_id     UUID REFERENCES categories(id),
    frequency       TEXT NOT NULL,                  -- daily/weekly/biweekly/monthly/bimonthly/quarterly/semiannual/annual
    day_of_period   SMALLINT,                       -- ex.: dia 5 do mês
    start_date      DATE NOT NULL,
    end_date        DATE,                           -- NULL = indeterminado
    last_generated  DATE,                           -- materialização incremental
    archived        BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);

CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    account_id      UUID REFERENCES accounts(id),
    category_id     UUID REFERENCES categories(id),
    description     TEXT NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,         -- sempre positivo; sinal vem de `type`
    type            TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    date            DATE NOT NULL,
    notes           TEXT,
    is_paid         BOOLEAN DEFAULT true,
    is_transfer     BOOLEAN DEFAULT false,
    opposite_transaction_id UUID REFERENCES transactions(id),

    -- 🆕 Compra de cartão (Organizze: credit_card_id + credit_card_invoice_id)
    credit_card_id          UUID REFERENCES cards(id),
    credit_card_invoice_id  UUID REFERENCES credit_card_invoices(id),

    -- 🆕 Pagamento de fatura (Organizze: paid_credit_card_id + paid_credit_card_invoice_id)
    paid_credit_card_id          UUID REFERENCES cards(id),
    paid_credit_card_invoice_id  UUID REFERENCES credit_card_invoices(id),

    -- 🆕 Parcelamento (antes só em card_expenses)
    installment             SMALLINT DEFAULT 1,
    total_installments      SMALLINT DEFAULT 1,
    installment_group_id    UUID,                   -- agrupa parcelas de uma compra

    -- 🆕 Recorrência (template FK; recurrence_group legado dropado na Onda 7)
    recurrence_id           UUID REFERENCES recurrences(id),

    deleted_at      TIMESTAMPTZ,                    -- soft delete
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ,

    -- Constraint: as três "naturezas especiais" são exclusivas entre si
    CHECK (
        -- compra de cartão: credit_card_id + credit_card_invoice_id juntos
        (credit_card_id IS NULL AND credit_card_invoice_id IS NULL)
        OR (credit_card_id IS NOT NULL AND credit_card_invoice_id IS NOT NULL)
    ),
    CHECK (
        -- pagamento de fatura: paid_credit_card_id + paid_credit_card_invoice_id juntos
        (paid_credit_card_id IS NULL AND paid_credit_card_invoice_id IS NULL)
        OR (paid_credit_card_id IS NOT NULL AND paid_credit_card_invoice_id IS NOT NULL)
    )
);
CREATE INDEX idx_transactions_credit_card ON transactions(credit_card_id, credit_card_invoice_id) WHERE credit_card_id IS NOT NULL;
CREATE INDEX idx_transactions_paid_credit_card ON transactions(paid_credit_card_invoice_id) WHERE paid_credit_card_invoice_id IS NOT NULL;
CREATE INDEX idx_transactions_recurrence ON transactions(recurrence_id) WHERE recurrence_id IS NOT NULL;

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

-- ❌ TABELAS REMOVIDAS NO REFACTOR DE 2026-04-15 (alinhamento Organizze):
--
--   card_expenses          → vira `transactions` com `credit_card_id` + `credit_card_invoice_id` populados
--   card_expense_tags      → drop (tags ficam em `transaction_tags`, junction única)
--   transfers              → drop como tabela; relação fica via par de `transactions` com
--                            `opposite_transaction_id` cruzado e `is_transfer=true`.
--                            POST /api/v1/transfers continua existindo como conveniência
--                            mas internamente cria 2 rows em `transactions`.
--   bill_payments          → vira `transactions` com `paid_credit_card_id`
--                            + `paid_credit_card_invoice_id` populados.
--
-- Ver seção 14 pra justificativa, evidências da API Organizze, e plano de execução por ondas.

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

-- (bill_payments removida — ver bloco "TABELAS REMOVIDAS" acima.)

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
CREATE INDEX idx_tx_credit_card_invoice ON transactions(credit_card_invoice_id) WHERE credit_card_invoice_id IS NOT NULL;
CREATE INDEX idx_tx_recurrence ON transactions(recurrence_id) WHERE recurrence_id IS NOT NULL;

CREATE INDEX idx_credit_card_invoices_card ON credit_card_invoices(card_id, due_date DESC);
CREATE INDEX idx_recurrences_user_active ON recurrences(user_id) WHERE archived = false;

CREATE INDEX idx_budgets_user_period ON budgets(user_id, month, year);
CREATE INDEX idx_activities_user_date ON activities(user_id, created_at DESC);
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
│   │   ├── credit_card_invoices.py   # 🆕 Onda 2
│   │   ├── recurrences.py            # 🆕 Onda 3
│   │   ├── accounts.py
│   │   ├── categories.py
│   │   ├── tags.py
│   │   ├── transfers.py              # wrapper atômico (tabela dropada)
│   │   ├── budgets.py
│   │   ├── goals.py
│   │   ├── documents.py    # upload + processamento IA
│   │   ├── events.py       # SSE endpoint
│   │   └── settings.py
│   ├── schemas/            # Pydantic v2 DTOs (request/response)
│   │   ├── __init__.py
│   │   ├── transactions.py
│   │   ├── cards.py
│   │   ├── credit_card_invoice.py
│   │   ├── recurrence.py
│   │   └── ...
│   ├── usecases/           # Regras de negócio + orquestração
│   │   ├── __init__.py
│   │   ├── transactions.py
│   │   ├── cards.py
│   │   ├── credit_card_invoice.py
│   │   ├── recurrence.py
│   │   ├── transfer.py
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

**Tabelas com `deleted_at`:** transactions, goals
(Tabelas `card_expenses`, `transfers`, `bill_payments` foram dropadas no refactor Organizze — seção 14.)

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

> **Atualizado 2026-04-15** pós-refactor Organizze (seção 14). Arquitetura reflete:
> - Tabelas novas no Postgres: `credit_card_invoices`, `recurrences`
> - Tabelas dropadas no Postgres: `card_expenses`, `card_expense_tags`, `bill_payments`, `transfers`
> - Collections Firestore `cardExpenses`/`billPayments`/`transfers` ainda são source — mas unificam em `transactions` no destino (ver 14.6 + 7.5)

```
mypay-api/
└── scripts/
    └── migrate_firestore_to_postgres/
        ├── __init__.py
        ├── __main__.py                     # entry point: python -m scripts.migrate_firestore_to_postgres
        ├── config.py                       # load env: FIREBASE_CREDENTIALS, DATABASE_URL, R2 (read-only)
        ├── export.py                       # leitura do Firestore via firebase-admin
        ├── id_map.py                       # cache in-memory: Firestore doc_id (str) → UUID novo
        ├── transform/                      # uma transform por ENTIDADE DE DESTINO (Postgres)
        │   ├── __init__.py
        │   ├── users.py                    # from Firebase Auth Admin SDK (sem collection Firestore)
        │   ├── accounts.py
        │   ├── categories.py
        │   ├── tags.py
        │   ├── cards.py
        │   ├── credit_card_invoices.py     # 🆕 cria invoices pros períodos usados por card_expenses
        │   │                               #    (consome cards.closing_day/due_day; idempotente via UNIQUE)
        │   ├── recurrences.py              # 🆕 agrega transactions.recurrence_group → 1 template
        │   │                               #    + vincula recurrence_id nas ocorrências
        │   ├── transactions.py             # UNIFICADO — consome 4 collections Firestore:
        │   │                               #    • /transactions   → transactions base
        │   │                               #    • /cardExpenses   → transactions(credit_card_id, credit_card_invoice_id)
        │   │                               #    • /billPayments   → transactions(paid_credit_card_id, paid_credit_card_invoice_id)
        │   │                               #    • /transfers      → 2 transactions pareadas (is_transfer=true)
        │   ├── transaction_tags.py         # junction derivada de transactions.tags[] + cardExpenses.tags[]
        │   ├── transaction_attachments.py  # achata attachments[] embutidos; deriva storage_key da URL R2
        │   ├── budgets.py
        │   ├── goals.py
        │   ├── imports.py
        │   ├── activities.py
        │   └── user_settings.py
        ├── load.py                         # insert no Postgres reusando models SQLAlchemy
        ├── validate.py                     # contagens pós-carga (ver 7.6 — unified transactions count)
        └── README.md                       # como rodar (dry-run, cutover)
```

**Removidos da estrutura original (pré-refactor):**
- `transform/card_expenses.py` → lógica absorvida por `transform/transactions.py` (8b)
- `transform/bill_payments.py` → lógica absorvida por `transform/transactions.py` (8c)
- `transform/transfers.py` → lógica absorvida por `transform/transactions.py` (8d)

### 7.3 Contrato: transforms lêem os entity maps

**Fonte canônica das transformações por entidade:** `mypay-api/.claude/map/entities/<entidade>.md`.

Cada arquivo `transform/<entidade>.py` implementa **exatamente** o mapeamento declarado no entity map correspondente:
- Renomes de campo (camelCase → snake_case)
- Transformações de tipo (float → Decimal, Timestamp → datetime, string id → UUID, 0-indexed month → 1-indexed, etc.)
- Derivações (storage_key extraído de URL, junction tables de arrays, sub-docs → rows)
- Defaults e nullability

Se um transform divergir do entity map, é **o map que governa** — ajuste o código, não o map. Se o map estiver errado, corrija o map primeiro, depois o código.

### 7.4 Ordem de dependências (canônica)

Inserção segue a ordem de FKs. Qualquer mudança neste grafo implica revisar os entity maps.

> **Atualizado 2026-04-15** — reflete entidades novas (`credit_card_invoices`, `recurrences`) e unificação de `card_expenses`/`bill_payments`/`transfers` em `transactions`.

```
 1. users                    (from Firebase Auth Admin SDK — sem collection Firestore)
 2. accounts                 (FK: users)
 3. categories               (FK: users, self-ref parent)
 4. tags                     (FK: users)
 5. cards                    (FK: users)
 6. credit_card_invoices     (FK: users, cards)                              🆕
                             Criadas pré-transactions: todo txn com credit_card_id
                             exige invoice_id. ETL varre /cardExpenses e invoca
                             invoice_resolution.ensure_invoice_for_period(card, date).
 7. recurrences              (FK: users, accounts, categories)               🆕
                             Um template por recurrence_group único (inferido
                             da primeira ocorrência em /transactions).
 8. transactions             (FK: users, accounts, categories, cards,
                                credit_card_invoices, recurrences)
                             UNIFICADA — quatro fontes Firestore:
                             8a. /transactions      → linha direta
                             8b. /cardExpenses      → credit_card_id + invoice_id
                             8c. /billPayments      → paid_credit_card_id + paid_invoice_id
                             8d. /transfers        → 2 rows (opposite_transaction_id
                                                     cruzado, is_transfer=true)
 9. transaction_tags         (FK: transactions, tags)
                             Inclui tags de /transactions E /cardExpenses.
10. transaction_attachments  (FK: transactions, users)
11. budgets                  (FK: users, categories)
12. goals                    (FK: users)
13. imports                  (FK: users)
14. activities               (FK: users; audit trail)
15. user_settings            (FK: users; 1:1)
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
| **`transfers` → 2 transactions pareadas (sem row em transfers)** | `transfers` | Tabela `transfers` foi dropada (Onda 5). Para cada doc Firestore `/transfers`, ETL gera 2 rows em `transactions`: out=(type=expense, account_id=from, is_transfer=true), in=(type=income, account_id=to, is_transfer=true), com `opposite_transaction_id` cruzado. Não copiar `category` antigo (`transfer_out`/`transfer_in`) — backend não usa. |
| `budgets.month 0→1-indexed` | `budgets` | JS 0=Jan, Postgres 1=Jan; **UNIQUE constraint** (user_id, category_id, month, year) impede duplicata por categoria/mês |
| `copy-previous` server-side | `budgets` | Backend handles Jan→Dec rollback e skip de duplicatas. Frontend chama 1 POST `/budgets/copy-previous` em vez de orquestrar busca + N inserts |

#### Transforms específicos do refactor Organizze (adicionados 2026-04-15)

| Transform | Escopo | Detalhe |
|---|---|---|
| **Auto-resolve de invoice** em card_expenses | `/cardExpenses` | Pra cada doc, ETL chama `invoice_resolution.ensure_invoice_for_period(uow, user_id, card_id, doc.date)` ANTES de inserir a transaction. Função reusa a mesma que o backend usa em runtime (`src/application/services/invoice_resolution.py`). Invoices são criadas em `credit_card_invoices` (Onda 6 do map). `installment`/`total_installments`/`installment_group_id` copiados direto. |
| **`billPayments` → transactions + invoice FK** | `/billPayments` | Pra cada doc, ETL resolve invoice do período (`bill_month`/`bill_year`) via `ensure_invoice_for_period`, depois cria 1 row em `transactions` com: account_id=doc.accountId, type=expense, is_paid=true, paid_credit_card_id=doc.cardId, paid_credit_card_invoice_id=invoice.id. Campos derivados (`total_bill`, `carry_over_balance`, `is_partial`) NÃO migram — backend calcula via VIEW de balance. |
| **`recurrence_group` (string) → `recurrences` template** | `/transactions[recurrence_group != null]` | Coluna `recurrence_group` foi dropada na Onda 7. Para preservar vínculo: agrupe `/transactions` por `recurrence_group`, crie 1 row em `recurrences` inferindo `description`/`amount`/`type`/`frequency`/`day_of_period`/`start_date` da primeira ocorrência. Popule `recurrence_id` em todas as N transactions do grupo. `last_generated` = data da última ocorrência. Decisão (2026-04-15): `frequency` inferido dos gaps entre datas consecutivas (fallback `monthly` se ambíguo). |
| **`credit_card_invoices` — derivados não copiar** | `credit_card_invoices` | Campos `amount`/`payment_amount`/`previous_balance`/`balance` são computados via subquery + window function no repo (ver seção 14.4). ETL insere apenas `due_date`/`starting_date`/`closing_date`/`card_id`/`user_id`. |
| **Drop de fallback `recurrence_group` column** | `transactions` | Coluna não existe mais no Postgres (Onda 7). ETL NÃO pode popular — precisa converter pra `recurrence_id` ou aceitar perda do agrupamento. Decisão: converter (ver linha acima). |

### 7.6 Garantias operacionais

- **Transação única.** Todo o load envelopado em `async with session.begin()`. Falha em qualquer etapa = rollback total. Sem estado parcial no Postgres.
- **Idempotência em staging.** Antes de rodar: `alembic downgrade base && alembic upgrade head` para drop + recreate. Em **produção, nunca** — a única ação idempotente em prod é "nunca rodar duas vezes".
- **Validação pós-carga.** `validate.py` compara:
  - Contagem de docs Firestore vs. rows Postgres por entidade
  - **Transactions unificadas** (pós-refactor Organizze):
    ```
    count(pg.transactions) = count(fs.transactions)
                            + count(fs.cardExpenses)
                            + count(fs.billPayments)
                            + 2 * count(fs.transfers)
    ```
    Qualquer desvio indica doc perdido ou duplicado. Detalhar por fonte no relatório.
  - Soma de `amount` preservada por fonte: `sum(pg.transactions.amount WHERE credit_card_id IS NOT NULL) == sum(fs.cardExpenses.amount)` etc.
  - Integridade referencial (FKs não-órfãs — inclui `credit_card_invoice_id`, `paid_credit_card_invoice_id`, `recurrence_id`, `opposite_transaction_id`)
  - Presença de `user_settings` para cada user
  - `credit_card_invoices`: campos derivados (`amount`/`payment_amount`/`previous_balance`/`balance`) NÃO são armazenados — validar via SELECT da window function no repo, não comparar com Firestore.
  - `recurrences`: contagem = número de `recurrence_group` únicos em `fs.transactions`. Toda transaction com `recurrence_group` não-null deve terminar com `recurrence_id` preenchido no Postgres.
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

> **⚠️ Atualizado em 2026-04-15 (refactor Organizze).** Endpoints `/card-expenses`, `/bill-payments` removidos — viram filtros sobre `/transactions`. `/transfers` mantém POST como conveniência (cria 2 transactions atômicos), mas internamente sem tabela própria. Novos: `/credit-card-invoices`, `/recurrences`. Veja seção 14.

### Estrutura: `/api/v1/{resource}`

```
Auth
  POST   /api/v1/auth/me                    # get/create user from Firebase token

Transactions  (UNIFICADA: receitas, despesas, compras de cartão, pagamentos de fatura, transferências)
  GET    /api/v1/transactions               # ?month=&year=&account_id=&category_id=
                                            # &credit_card_id=&credit_card_invoice_id=
                                            # &paid_credit_card_invoice_id=&recurrence_id=
                                            # &is_transfer=
  POST   /api/v1/transactions               # body pode incluir: credit_card_id+credit_card_invoice_id (compra)
                                            # OU paid_credit_card_id+paid_credit_card_invoice_id (pagto fatura)
                                            # OU opposite_transaction_id (parte de transferência)
                                            # OU total_installments > 1 (gera N parcelas server-side)
                                            # OU recurrence_id (associa a template existente)
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

Credit Card Invoices  🆕 (Organizze: faturas como entidade)
  GET    /api/v1/credit-card-invoices       # ?card_id=
  GET    /api/v1/credit-card-invoices/{id}  # com balance/payment_amount/previous_balance computados
  # Auto-criadas pelo backend ao registrar primeira compra num período

Recurrences  🆕 (templates — substitui modelo "expand 12")
  GET    /api/v1/recurrences                # ?archived=
  POST   /api/v1/recurrences
  PUT    /api/v1/recurrences/{id}
  DELETE /api/v1/recurrences/{id}           # archive (soft); ocorrências geradas permanecem

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

Transfers  (mantido como conveniência; backend cria 2 transactions com opposite_transaction_id)
  GET    /api/v1/transfers                  # ?month=&year= — VIEW sobre transactions filtradas
  POST   /api/v1/transfers                  # cria 2 transactions atomicamente; sem tabela transfers
  DELETE /api/v1/transfers/{id}             # soft delete nas 2 transactions vinculadas

Budgets
  GET    /api/v1/budgets                    # ?month=&year=
  POST   /api/v1/budgets
  PUT    /api/v1/budgets/{id}
  DELETE /api/v1/budgets/{id}
  POST   /api/v1/budgets/copy-previous      # copia do mês anterior

# ❌ REMOVIDOS no refactor 2026-04-15:
# /api/v1/card-expenses/* → use /api/v1/transactions com credit_card_id no body/query
# /api/v1/bill-payments/* → use /api/v1/transactions com paid_credit_card_invoice_id

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

### 🆕 Fase B-Refactor — Alinhamento Organizze (3-5 dias) — INSERIDA 2026-04-15

**Objetivo:** unificar `card_expenses` + `bill_payments` + `transfers` em `transactions`; introduzir `credit_card_invoices` e `recurrences` como entidades. **Briefing completo na seção 14.7.**

> **Esta fase precede a continuação da Fase E.** Sem o refactor, hooks de `useCardExpenses`/`useBillPayments`/`useTransfers` viram filter views — não faz sentido migrar agora pra reescrever depois. Backend faz primeiro, frontend consolida em sequência.

**Onda 1 — Estender entidades existentes**
- [ ] `accounts`: adicionar `description`, `is_default`
- [ ] `categories`: adicionar `group_id`, `fixed`, `essential`
- [ ] `cards`: adicionar `description`, `is_default`
- [ ] `transactions`: adicionar `credit_card_id`, `credit_card_invoice_id`, `paid_credit_card_id`, `paid_credit_card_invoice_id`, `installment`, `total_installments`, `installment_group_id`, `recurrence_id` + CHECK constraints
- [ ] Migration alembic única
- [ ] Atualizar schemas + mappers + tests

**Onda 2 — Criar `credit_card_invoices`**
- [ ] Model + entity + repo + schema + usecase
- [ ] API: GET `/api/v1/credit-card-invoices?card_id=`, GET `/{id}`
- [ ] VIEW SQL ou função pra `balance`/`payment_amount`/`previous_balance` computados
- [ ] Lógica de auto-criação ao registrar primeira compra num período não coberto
- [ ] Tests

**Onda 3 — Criar `recurrences`**
- [ ] Model + entity + repo + schema + usecase + API CRUD
- [ ] Lógica de geração on-demand (chamada por list_transactions)
- [ ] Decisão: manter `recurrence_group` legado pra ETL Firestore, ou migrar tudo pra `recurrence_id`?
- [ ] Tests

**Onda 4 — Reescrever `bill_payment` como filter view**
- [ ] `POST /api/v1/transactions` com `paid_credit_card_id` + `paid_credit_card_invoice_id`
- [ ] DELETE: soft delete da transaction (já cobre)
- [ ] DROP da tabela `bill_payments` + endpoint `/bill-payments` (depois de validar zero data em prod)

**Onda 5 — Reescrever `transfers` como filter view + helper**
- [ ] `POST /api/v1/transfers` continua existindo (conveniência), mas internamente cria 2 rows em `transactions`
- [ ] GET `/api/v1/transfers` vira VIEW/query sobre transactions filtradas
- [ ] DROP tabela `transfers`

**Onda 6 — Reescrever `card_expense` como compras de cartão**
- [ ] DEPRECATE `POST /card-expenses`. Frontend passa a usar `POST /transactions` com `credit_card_id` + `credit_card_invoice_id`
- [ ] Backend cria invoice se não existir (lógica da Onda 2)
- [ ] Server-side ainda gera N parcelas via `total_installments`
- [ ] DROP `/card-expenses` endpoint + tabela + `card_expense_tags`

**Onda 7 — Cleanup**
- [ ] Drop migrations das 4 tabelas mortas
- [ ] Drop schemas, models, repos, usecases, APIs órfãos
- [ ] Atualizar `_status.md` no map; marcar entity maps mortos como DEPRECATED

### Fase E — Frontend + Cutover (1-2 semanas)

**Objetivo:** adaptar frontend e migrar dados.

- [ ] Criar `src/api/client.js` — fetch wrapper com auth token
- [ ] Migrar hooks: `useFirestore.js` → hooks individuais chamando API
  - Já migrados: `tags`, `categories`, `accounts`, `transactions`, `transaction_attachments`, `cards`, `card_expenses` (será reescrito), `transfers` (será reescrito), `budgets`
  - **Após Fase B-Refactor:** `useCardExpenses`/`useAllCardExpenses` viram filter views sobre `useTransactions`; `useBillPayments` idem; `useTransfers` idem. Adicionar: `useCreditCardInvoices`, `useRecurrences`.
  - Pendentes ainda: `goals`, `settings` (contexts), `activities`, `imports`, `documents` (IA), `push`
- [ ] Integrar SSE para invalidação de queries
- [ ] Remover dependências Firebase Firestore do frontend
- [ ] Remover variáveis VITE_S3_* e VITE_GOOGLE_AI_KEY
- [ ] Script ETL em `mypay-api/scripts/migrate_firestore_to_postgres/` (ver seção 7.1–7.8)
  - **Atualizado pós-refactor:** ETL precisa unificar `card_expenses` → `transactions(credit_card_id)`, `bill_payments` → `transactions(paid_credit_card_invoice_id)`, `transfers/*` → par de `transactions(opposite_transaction_id)`. Ver seção 14.6.
- [ ] Alternativa: ETL direto do Organizze (`scripts/migrate_organizze.py` no repo `mypay`) → `mypay-api/scripts/migrate_organizze_to_postgres/` (mapping quase 1:1; ver seção 14.6)
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

> **🔄 ABSORVIDO em 2026-04-15** pela Fase B-Refactor (Onda 3) e seção 14. A análise abaixo continua válida e foi confirmada pela validação direta da API Organizze (que faz exatamente este modelo). O timing mudou: era "pós-cutover", virou parte estruturante do refactor.

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

---

## 14. Decisão Arquitetural — Alinhamento com Modelo Organizze (2026-04-15)

> **Mudança de direção significativa.** Validação direta na API real do Organizze (com credenciais do usuário) revelou que o modelo de dados original do myPay (que se inspirou no Organizze) **divergiu substancialmente** ao longo do tempo, criando duplicações desnecessárias. Esta seção documenta a decisão de **refatorar o backend** para retornar ao modelo unificado do Organizze antes de continuar a Fase E.

### 14.1 Origem da decisão

Durante a migração de `bill_payments` (2026-04-15), surgiu a pergunta:
> *"O myPay foi modelado sobre o Organizze. Vale validar a API real antes de continuar fazendo decisões de schema."*

Validação rodada usando o proxy `api/organizze-proxy.js` + credenciais `VITE_ORGANIZZE_EMAIL/VITE_ORGANIZZE_API_KEY` contra `https://api.organizze.com.br/rest/v2`. Endpoints consultados: `/accounts`, `/categories`, `/credit_cards`, `/credit_cards/{id}/invoices`, `/transactions`, `/budgets`. Endpoints `/tags` e `/recurrences` retornam 404 (não expostos publicamente, mas os campos aparecem inline em `transactions`).

### 14.2 Achados — divergências fundamentais

#### Divergência 1: Duplicação de tabelas pra movimentações financeiras

| Tipo de movimentação | Organizze | myPay (atual) |
|---|---|---|
| Receita / despesa em conta | `transactions` | `transactions` |
| Compra de cartão de crédito | `transactions` (com `credit_card_id`) | `card_expenses` ❌ tabela separada |
| Pagamento de fatura | `transactions` (com `paid_credit_card_invoice_id`) | `bill_payments` + `transactions` ❌ duas tabelas |
| Transferência entre contas | par de `transactions` (com `oposite_transaction_id`) | `transfers` + 2 `transactions` ❌ três rows |

**Consequência:** myPay tem `notes`, `attachments`, `tags`, `type` espalhados em múltiplas tabelas com semântica inconsistente. Decisões anteriores ("dropar attachments em card_expenses porque vivem em bill_payment") foram **patches** pra essa divergência — a raiz é estrutural.

#### Divergência 2: Faturas (invoices) não são entidade

| Organizze | myPay (atual) |
|---|---|
| `credit_card_invoices` table com `id`, `due_date`, `starting_date`, `closing_date`, `amount_cents`, `payment_amount_cents`, `balance_cents`, `previous_balance_cents` | Apenas colunas `bill_month` (SMALLINT) e `bill_year` (SMALLINT) espalhadas em `card_expenses` e `bill_payments` |
| Pagamento de fatura aponta pra `paid_credit_card_invoice_id` (FK) | `bill_payment.transaction_id` aponta pra transação genérica |

**Consequência:** myPay perde:
- Saldo carry-over entre faturas como entidade computada
- Vista "fatura X tem N compras + Y pagamentos parciais"
- `previous_balance` automatizado
- Navegação direta por fatura

#### Divergência 3: Recorrência expandida vs. template

| Organizze | myPay (atual) |
|---|---|
| `recurring: true` + `recurrence_id` FK pra template | `recurrence_group: string` + 12 transactions geradas |
| **307 transactions recurring** na conta real do usuário (feature usada extensivamente) | Limite arbitrário de 12, edição em massa frágil |

Confirma a análise da seção 13.1 — Organizze valida que template-based é o padrão correto. **Não é mais "post-cutover"; faz parte do refactor agora.**

#### Divergência 4: Campos faltantes em entidades existentes

| Entidade | Faltante no myPay |
|---|---|
| `accounts` | `description` (texto livre adicional), `is_default` (marca conta padrão) |
| `categories` | `group_id` (semantic key: 'exp_food'/'ear_salary'), `fixed` (categoria fixa), `essential` (essencial vs supérfluo), `uuid` (id global separado) |
| `cards` | `description`, `is_default` |
| `transactions` | `installment` + `total_installments` + `installment_group_id` (parcelamento — hoje só em card_expenses), `recurrence_id` (FK pro template) |

### 14.3 Evidências (samples reais da API Organizze)

#### Account
```json
{ "id": 41766, "name": "carteira", "type": "checking",
  "institution_id": "default", "description": "Conta Corrente",
  "default": true, "archived": false }
```

#### Category (subcategoria)
```json
{ "id": 118813973, "name": "Supermercados / Mercearia",
  "color": "ff6600", "parent_id": 3344330,
  "group_id": "exp_food", "kind": "expenses",
  "fixed": false, "essential": false,
  "uuid": "7f423cb68fc4e1db910ca9d8eeac273df1e80c41",
  "archived": false }
```

#### Credit Card
```json
{ "id": 774825, "name": "C6 Bank Master Card",
  "card_network": "default", "institution_id": "c6bank",
  "limit_cents": 0, "closing_day": 31, "due_day": 10,
  "description": null, "default": false, "archived": false }
```

#### Credit Card Invoice (entidade nova)
```json
{ "id": 312, "credit_card_id": 774825,
  "date": "2026-01-10",                    // due_date (vencimento)
  "starting_date": "2025-12-01",
  "closing_date": "2025-12-31",
  "amount_cents": 0, "payment_amount_cents": 0,
  "balance_cents": 0, "previous_balance_cents": 0 }
```

#### Transaction — compra de cartão
```json
{ "id": 3109871406, "description": "Fatura Bradesco",
  "date": "2025-11-10", "paid": true,
  "amount_cents": -689418,                 // SIGNED no Organizze
  "account_id": 1524327, "category_id": 603630,
  "notes": null, "attachments_count": 1,
  "credit_card_id": 1524327,               // ← compra de cartão
  "credit_card_invoice_id": 310,           // ← qual fatura compõe
  "paid_credit_card_id": null,
  "paid_credit_card_invoice_id": null,
  "oposite_transaction_id": null,
  "total_installments": 1, "installment": 1,
  "recurring": false, "recurrence_id": null,
  "tags": [], "attachments": [{"url": "..."}] }
```

#### Transaction — pagamento de fatura
```json
{ "id": 3109871462, "description": "Pagamento de fatura",
  "date": "2025-11-10", "amount_cents": -689418,
  "account_id": 41766, "category_id": 110914800,
  "credit_card_id": null, "credit_card_invoice_id": null,
  "paid_credit_card_id": 1524327,          // ← qual cartão pagou
  "paid_credit_card_invoice_id": 310,      // ← qual fatura pagou
  "tags": [], "attachments": [] }
```

#### Transaction — recorrente
```json
{ "id": 2458178986, "description": "Unimed 2025",
  "date": "2025-12-29", "amount_cents": -53222,
  "account_id": 41766, "recurring": true,
  "recurrence_id": 21856672,               // ← FK pro template
  "attachments": [{"url": "..."}] }
```

#### Transaction — parcelada
```json
{ "id": 2458170211, "description": "Lote 5 VALENTHYM CONSTRUTORA",
  "amount_cents": -186839,
  "total_installments": 60, "installment": 44,
  "recurring": false, "recurrence_id": 21856539,  // template gerador
  "attachments_count": 2 }
```

### 14.4 Modelo proposto (alinhado Organizze)

#### Tabelas que **morrem** ❌

- `card_expenses` → vira `transactions` com `credit_card_id` populado
- `card_expense_tags` → drop (junction única em `transaction_tags`)
- `bill_payments` → vira `transactions` com `paid_credit_card_id` + `paid_credit_card_invoice_id`
- `transfers` → drop como tabela; relação fica via par de `transactions` com `opposite_transaction_id` cruzado (se quisermos listagem dedicada, usar VIEW SQL)

#### Tabelas que **evoluem**

- **`transactions`** ganha:
  - `credit_card_id UUID FK NULL` (compra de cartão)
  - `credit_card_invoice_id UUID FK NULL` (qual fatura essa compra compõe)
  - `paid_credit_card_id UUID FK NULL` (se é pagamento de fatura, qual cartão)
  - `paid_credit_card_invoice_id UUID FK NULL` (qual fatura foi paga)
  - `installment SMALLINT DEFAULT 1`
  - `total_installments SMALLINT DEFAULT 1`
  - `installment_group_id UUID NULL`
  - `recurrence_id UUID FK NULL` (template gerador)
  - **CHECK constraint:** uma transaction pode ter (`credit_card_id` + `credit_card_invoice_id`) OU (`paid_credit_card_id` + `paid_credit_card_invoice_id`) OU `opposite_transaction_id`, mas não combinações inválidas.
- **`accounts`** ganha: `description TEXT NULL`, `is_default BOOLEAN DEFAULT false`
- **`categories`** ganha: `group_id TEXT NULL` (semantic key tipo 'exp_food'), `fixed BOOLEAN DEFAULT false`, `essential BOOLEAN DEFAULT false`. Campo `uuid` opcional (Organizze tem; pode pular se id já é UUID).
- **`cards`** ganha: `description TEXT NULL`, `is_default BOOLEAN DEFAULT false`. (Já tem `bank_id` ✅)
- **`transaction_tags`** e **`transaction_attachments`** continuam como junction/tabela única — agora servem TODAS as transações (incluindo compras de cartão, pagamentos de fatura, transferências, recorrentes).

#### Tabelas **novas**

##### `credit_card_invoices`
```sql
CREATE TABLE credit_card_invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    card_id         UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    due_date        DATE NOT NULL,                  -- vencimento (Organizze: date)
    starting_date   DATE NOT NULL,                  -- início ciclo
    closing_date    DATE NOT NULL,                  -- fechamento
    -- amount, payment_amount, balance, previous_balance NÃO armazenados.
    -- Calculados via VIEW ou função:
    --   amount = SUM(transactions.amount WHERE credit_card_invoice_id = invoice.id)
    --   payment_amount = SUM(transactions.amount WHERE paid_credit_card_invoice_id = invoice.id)
    --   balance = amount - payment_amount + previous_balance
    --   previous_balance = balance da invoice imediatamente anterior do mesmo card (window function)
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (card_id, starting_date, closing_date)
);

-- VIEW pra cálculo on-demand:
CREATE VIEW credit_card_invoices_with_balance AS ...
```

**Geração de invoices:** quando a primeira compra é registrada num cartão pra um período (definido por `closing_day` do cartão), o backend cria automaticamente o row em `credit_card_invoices` se ainda não existir. Alternativa: job que pré-gera 12 meses na frente quando o cartão é criado.

##### `recurrences` (template)
```sql
CREATE TABLE recurrences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    description     TEXT NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    account_id      UUID REFERENCES accounts(id),
    category_id     UUID REFERENCES categories(id),
    frequency       TEXT NOT NULL,                  -- monthly, weekly, biweekly, daily, ...
    day_of_period   SMALLINT,                        -- ex.: dia 5 do mês
    start_date      DATE NOT NULL,
    end_date        DATE,                            -- NULL = indeterminado
    last_generated  DATE,                            -- até que data foi materializada
    archived        BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);
```

**Geração on-demand:** ao listar transactions de um mês, backend garante que `transactions` tem rows pra esse mês baseado nos templates ativos (`last_generated` evita duplicação). Cada ocorrência fica em `transactions` normal — pode ser editada individualmente sem afetar template.

### 14.5 Implicações pro frontend

**Hooks consolidam:**
- `useCardExpenses(cardId, month, year)` → vira `useTransactions({ creditCardId, billMonth, billYear })` — só filtro
- `useAllCardExpenses()` → `useTransactions({ creditCardId: 'any' })`
- `useBillPayments(month, year)` → `useTransactions({ paidCreditCard: true, billMonth, billYear })`
- `useTransfers(month, year)` → `useTransactions({ isTransfer: true, month, year })` (reconhecível por `oppositeTransactionId`)

Hooks novos:
- `useCreditCardInvoices(cardId)` — lista faturas do cartão com balance computado
- `useRecurrences()` — CRUD de templates

**Pages que mudam:**
- `Cards.jsx` — UI de fatura passa a ler de `useCreditCardInvoices` + filtrar transactions por `credit_card_invoice_id`
- `Accounts.jsx` (transferências) — passa a usar par de transactions com `opposite_transaction_id`
- `Budgets.jsx` — sem mudança
- Possivelmente nova page `Recurrences.jsx` ou seção em Settings pra gerenciar templates

**Hooks já migrados que continuam intactos:**
- `useTags`, `useCategories` (ganha campos opcionais), `useAccounts` (ganha campos opcionais), `useTransactions` (estende), `useBudgets`

**Hooks que viram filter views (descartar implementação atual):**
- `useCardExpenses`, `useAllCardExpenses` (`mapCardExpense`/`buildCardExpensePayload` viram desnecessários)
- `useTransfers` (`mapTransfer`/orquestração viram desnecessários)
- `useBillPayments` (será reescrito como filter view antes mesmo de migrar)

### 14.6 Implicações pro ETL

#### ETL do Organizze — agora trivial

O script `scripts/migrate_organizze.py` (no repo `mypay`) hoje converte Organizze → Firestore. **No novo modelo, é mapeamento quase 1:1 com o Postgres.** Pode até virar `mypay-api/scripts/migrate_organizze_to_postgres.py` substituindo o ETL via Firestore.

Mapping direto:
- `transactions[].amount_cents` → `transactions.amount = abs(cents)/100`, `type = 'income' if cents > 0 else 'expense'`
- `transactions[].credit_card_id` → `transactions.credit_card_id` (resolve via id_map)
- `transactions[].credit_card_invoice_id` → `transactions.credit_card_invoice_id`
- `transactions[].paid_credit_card_invoice_id` → idem
- `transactions[].oposite_transaction_id` → `transactions.opposite_transaction_id` (corrigindo o typo)
- `transactions[].recurrence_id` → cria `recurrences` row se não existe, depois liga
- `credit_card_invoices` → mapping 1:1 (drop dos campos derivados — calculados via VIEW)

#### ETL do Firestore (myPay atual)

ETL precisa **unificar** durante a migração (detalhes de transforms em 7.5):

- `cardExpenses[*]` → `transactions` com `credit_card_id` populado. Antes de inserir cada row, chama `invoice_resolution.ensure_invoice_for_period(uow, user, card, date)` — mesmo service que o backend usa em runtime — pra obter/criar a invoice do período. Popula `credit_card_invoice_id` no row resultante. Campos `installment`/`total_installments`/`installment_group_id` preservados.

- `billPayments[*]` → `transactions` com `paid_credit_card_id` + `paid_credit_card_invoice_id` populados. Antes, garante que `credit_card_invoices` existe pra cada `(card_id, bill_month, bill_year)` via mesmo `ensure_invoice_for_period`. Campos derivados (`total_bill`, `carry_over_balance`, `is_partial`) NÃO migram — calculados via VIEW de balance.

- `transfers[*]` → 2 rows em `transactions` com `opposite_transaction_id` cruzado + `is_transfer=true`. **A collection Firestore `/transfers` continua sendo source do ETL** (lida, processada), mas o ETL **não insere em tabela `transfers` do Postgres** — essa tabela foi dropada na Onda 5. Só gera as 2 transactions pareadas. Campos denormalizados `fromAccountName`/`toAccountName` descartados (backend resolve via JOIN).

- `transactions[*]` com `recurrence_group` não-null → agrupa por valor de `recurrence_group`, cria 1 row em `recurrences` (template inferido da primeira ocorrência: description, amount, type, frequency inferida dos gaps, day_of_period), popula `recurrence_id` em todas as N transactions do grupo. Column `recurrence_group` dropada no Postgres (Onda 7); este é o único caminho pra preservar o vínculo.

### 14.7 Plano de execução do refactor backend

> **Esse é o briefing pra sessão Claude no repo `mypay-api`.**

#### Pré-requisitos

1. Ler este plano completo (especialmente seção 14)
2. Ler entity maps em `mypay-api/.claude/map/entities/`:
   - `transactions.md` (estendido)
   - `accounts.md`, `categories.md`, `cards.md` (campos novos)
   - `credit-card-invoices.md` (novo)
   - `recurrences.md` (novo)
   - `card-expenses.md`, `bill-payments.md`, `transfers.md` (marcados como **DEPRECATED** — código existe mas vai morrer)
3. Confirmar que migration alembic atual (`a5f8b2d1c3e7`) está aplicada em staging

#### Ondas de execução

**Onda 1 — Estender entidades existentes**
- Adicionar campos a `accounts` (description, is_default), `categories` (group_id, fixed, essential), `cards` (description, is_default)
- Adicionar campos a `transactions` (credit_card_id, credit_card_invoice_id, paid_credit_card_id, paid_credit_card_invoice_id, installment, total_installments, installment_group_id, recurrence_id)
- Migration alembic única
- Atualizar schemas Pydantic + mappers
- Tests existentes devem continuar passando

**Onda 2 — Criar `credit_card_invoices`**
- Model + entity + repo + schema + usecase
- API: GET `/api/v1/credit-card-invoices?card_id=`, GET `/{id}`
- VIEW SQL `credit_card_invoices_with_balance` (ou função Python que calcula balance/previous_balance)
- Lógica de auto-criação de invoice quando primeira compra é registrada num período não coberto
- Tests

**Onda 3 — Criar `recurrences`**
- Model + entity + repo + schema + usecase + API CRUD
- Lógica de geração on-demand (chamada por list_transactions: garantir rows materializados pro período visualizado)
- Tests
- **NOTA:** a refatoração de recurrence em transactions **substitui** o `recurrence_group` (string) atual. Decidir: manter `recurrence_group` por compat ou drop?

**Onda 4 — Reescrever bill_payment usecase como filter view de transactions**
- POST `/api/v1/transactions` com `paid_credit_card_id` + `paid_credit_card_invoice_id` populados (sem tabela `bill_payments`)
- DELETE: soft delete da transaction (já cobre tudo)
- GET filtros já cobertos por `/api/v1/transactions?paid_credit_card_id=...`
- Eventualmente DROP da tabela `bill_payments` (depois de validar que não tem dado em prod — não tem porque ETL ainda não rodou)

**Onda 5 — Reescrever transfer usecase**
- POST `/api/v1/transfers` continua existindo como **conveniência** (1 chamada cria 2 transactions vinculadas)
- Mas backend agora não tem tabela `transfers` — só cria 2 rows em `transactions` com `opposite_transaction_id` + `is_transfer=true`
- GET `/api/v1/transfers` vira VIEW/query sobre transactions filtradas
- DROP tabela `transfers`

**Onda 6 — Reescrever card_expense como compras de cartão**
- POST `/api/v1/card-expenses` → DEPRECATED. Frontend passa a usar `POST /api/v1/transactions` com `credit_card_id` + `credit_card_invoice_id`
- Backend cria invoice se não existir (lógica da Onda 2)
- Server-side ainda gera N parcelas via `total_installments`
- Eventualmente DROP `/card-expenses` endpoint + tabela

**Onda 7 — Cleanup**
- Drop migrations das 4 tabelas mortas (card_expenses, card_expense_tags, bill_payments, transfers)
- Drop schemas, models, repos, usecases, APIs órfãos
- Atualizar `_status.md` no map

#### Critérios de aceite (por onda)

- ✅ Tests passam após cada onda (sem regressão)
- ✅ Migration alembic up + down rodam limpos
- ✅ Endpoint smoke test via Swagger UI ou curl
- ✅ Entity maps refletem mudanças

### 14.8 Estado do trabalho atual descartado

Ao iniciar este refactor, o seguinte trabalho da Fase E **continua válido**:
- ✅ `tags`, `categories`, `accounts` (precisa adicionar mapping de campos novos), `transactions` (precisa estender mapping), `transaction_attachments`, `budgets`

E o seguinte trabalho **será reescrito** quando a Onda correspondente do refactor backend chegar:
- 🔄 `cards` — adicionar `description`, `is_default` no mapper
- 🔄 `card_expenses` (ondas 2+6) — vai virar filter sobre `useTransactions`
- 🔄 `transfers` (onda 5) — POST `/transfers` permanece como conveniência mas internamente é par de transactions
- 🔴 `bill_payments` (onda 4) — não faz sentido migrar agora; vai ser reescrito como filter sobre `useTransactions` na onda 4

### 14.9 Risco e custo

- **Esforço estimado:** 3-5 dias backend + 1-2 dias frontend (consolidação dos hooks)
- **Trabalho descartado:** ~3 hooks da Fase E (`useCardExpenses`, `useTransfers`, e a migração planejada de `useBillPayments`). Código fica como referência mas vai ser reescrito.
- **Risco baixo de regressão de produção:** Firestore ainda tá no ar; backend não tem dados em prod. Migration destrutiva é segura.
- **Risco de escopo:** refactor pode revelar outras divergências. Mitigação: cada onda é independente — se onda 3 (recurrences) virar projeto grande, isolar como Fase pós-cutover novamente.

### 14.10 Decisão registrada

- **Data:** 2026-04-15
- **Quem decidiu:** usuário, após validação direta da API Organizze
- **Motivação:** "do organizze eu gosto como ele atua, podemos refatorar [...] como gerencia contas, tags, categoria, transacoes eram perfeitas"
- **Próximo passo concreto:** sessão Claude no repo `mypay-api` lê este plano e executa Onda 1.

### 14.11 Absorção da seção 13.1

A seção 13.1 ("Roadmap pós-cutover — refatorar recorrência de transactions") fica **absorvida pela Onda 3** deste refactor. Não é mais "pós-cutover" — vira parte estruturante do novo modelo. A análise técnica daquela seção continua válida; o que muda é o timing.
