# deploy

Prepara e executa deploy do app myPay para produção.

## Usage

```bash
/deploy [--check] [--build-only]
```

## Description

Executa o processo completo de deploy do aplicativo.

**Opções:**
- `--check`: Apenas verifica se está tudo pronto para deploy (lint, env vars, build test)
- `--build-only`: Apenas faz o build sem fazer deploy

**Verificações realizadas:**
1. Variáveis de ambiente (.env)
2. ESLint (npm run lint)
3. Build de produção (npm run build)
4. Testa a preview build
5. Verifica configuração do Vercel (vercel.json)

**Processo de deploy:**
1. Roda todas as verificações
2. Mostra resumo do que será deployado
3. Executa build de produção
4. Se Vercel configurado, faz deploy automático

## Instructions

1. Verificar se todas as env vars necessárias estão no .env:
   - VITE_FIREBASE_*
   - VITE_GOOGLE_AI_KEY
   - VITE_S3_*
2. Executar `npm run lint` e corrigir erros se houver
3. Executar `npm run build` e verificar sucesso
4. Se `--check` foi passado, parar aqui e mostrar status
5. Se `--build-only`, parar após build
6. Caso contrário, verificar vercel.json e orientar sobre deploy
7. Mostrar checklist de pós-deploy:
   - [ ] Firebase rules atualizadas
   - [ ] Env vars no Vercel configuradas
   - [ ] Testar login Google em produção
   - [ ] Testar upload de documentos
