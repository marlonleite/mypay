# myPay - Controle Financeiro Pessoal

Aplicativo de controle financeiro pessoal construído com React, Firebase e Tailwind CSS.

## Stack

- React 18 + Vite
- Firebase (Firestore + Auth)
- Tailwind CSS
- Lucide React (ícones)

## Funcionalidades

- Login com Google
- Dashboard com resumo mensal
- CRUD de receitas e despesas
- Gestão de cartões de crédito
- Suporte a parcelamento
- Filtro por mês
- Design dark mode
- PWA ready

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto
3. Ative o **Authentication** com provedor Google
4. Ative o **Cloud Firestore**
5. Copie as credenciais do projeto

### 3. Variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e preencha com suas credenciais:

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto_id
VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

### 4. Regras do Firestore

No Firebase Console, vá em Firestore > Rules e cole o conteúdo do arquivo `firestore.rules`.

### 5. Executar

```bash
npm run dev
```

O app estará disponível em `http://localhost:3000`

## Estrutura do Firestore

```
users/
  {userId}/
    transactions/
      {transactionId}/
        - description: string
        - amount: number
        - category: string
        - date: timestamp
        - type: "income" | "expense"
        - createdAt: timestamp

    cards/
      {cardId}/
        - name: string
        - closingDay: number
        - dueDay: number
        - color: string
        - createdAt: timestamp

    cardExpenses/
      {expenseId}/
        - cardId: string
        - description: string
        - amount: number
        - category: string
        - date: timestamp
        - installment: number
        - totalInstallments: number
        - createdAt: timestamp
```

## Build para produção

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`.

### Logo (marca)

O logo oficial está em **`public/logo-mypay.svg`** (favicon, `manifest.json`, tela de login, ícones em notificações web/FCM). O símbolo “$” usa fonte do sistema para renderizar sem depender do Montserrat.

**Ícones nativos (Android launcher + Electron dock / instalador):** a partir do mesmo SVG:

```bash
npm run icons:generate
```

Isso roda `@capacitor/assets` (Android mipmaps, adaptive icon, splashes) e gera `electron/icons/icon.png` (1024×1024) para o `electron-builder`. Rode de novo sempre que trocar `public/logo-mypay.svg`.

Para só uma plataforma: `npm run icons:android` ou `npm run icons:electron`.

## Electron e Android: builds e como atualizar

A **PWA** (ex.: Vercel) passa a servir o bundle novo após cada deploy. **Electron** e **Capacitor** embutem o `dist/` **no momento do build**: mudanças em `src/` só entram nesses apps depois que você gera de novo o instalador/APK e instala por cima.

**Pré-requisitos:**

- `.env` com `VITE_API_URL` apontando para a API de produção (builds nativos não usam o proxy do Vite).
- **API:** `CORS_ORIGINS` + `CORS_ORIGIN_REGEX` para loopback (ver `mypay-api`).
- **Firebase Auth:** domínios autorizados incluindo `127.0.0.1` e `localhost` (Electron).
- **Android:** Java 17, `ANDROID_HOME`, depuração USB ativa no aparelho.

### Electron (macOS)

| Objetivo | Comando |
|---------|---------|
| Desenvolvimento (Vite + janela) | `npm run electron:dev` |
| Gerar `.dmg` | `npm run electron:build:mac` |

O instalador sai em `dist-electron/myPay-<versão>.dmg` (pasta ignorada no git).

**Atualizar o app instalado:** `npm run native:install` (copia o `.app` para `/Applications` e atualiza o Android por USB) **ou** rode `npm run electron:build:mac`, abra o DMG e arraste **myPay** para **Aplicativos**.

### Android (USB / sideload, sem Play Store)

| Objetivo | Comando |
|---------|---------|
| Desenvolvimento no aparelho | `npm run android:dev` |
| APK **debug** instalável (`adb` ou arquivo) | `npm run android:build:debug` |
| APK release (não assinado no template atual) | `npm run android:build` → `app-release-unsigned.apk` **não** instala até assinar ou configurar keystore |

**Instalar / atualizar via USB (debug):**

```bash
npm run android:build:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**macOS + Android num comando** (um `vite build`, gera `.app`, copia para `/Applications`, gera APK debug e `adb install -r`):

```bash
npm run native:install
```

Use `SKIP_ELECTRON=1` ou `SKIP_ANDROID=1` se for só uma plataforma.

O `-r` substitui a instalação anterior. Para **release** assinado com keystore próprio, configure `signingConfigs` no Gradle (detalhes arquitetura em `PLAN-ELECTRON-CAPACITOR.md`).

## Deploy

### Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Vercel

```bash
npm install -g vercel
vercel
```

## Licença

MIT
