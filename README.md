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
