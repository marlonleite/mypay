# Plan: Electron + Capacitor wrappers para PWA `mypay`

## Context

O ecossistema myPay hoje tem três clientes:
- **PWA** React/Vite em `/Users/marlon/Code/mypay/` (web).
- **Flutter Android+macOS** em `/Users/marlon/Code/mypay-mobile/` (mobile + desktop).
- **API** FastAPI em `/Users/marlon/Code/mypay-api/`.

Problemas observados na sessão atual:
1. **macOS Flutter**: `Firebase.initializeApp` trava no SDK nativo macOS (combinação `firebase_messaging` + falta de `aps-environment` + Apple Developer pago para resolver).
2. **Layout Flutter ≠ PWA**: usuário (single-user) prefere paridade visual 100% com a PWA.
3. **Manutenção em duplicidade**: features novas vivem ou na PWA ou no Flutter, nunca em ambos.

**Decisão arquitetural**: colapsar os clientes não-web em wrappers da própria PWA — Capacitor (Android) e Electron (macOS/Win/Linux). Resultado:
- 1 codebase de UI (`src/`), 3 builds (web, Android, desktop).
- 100% paridade visual.
- 1 PR fixa bug nos 3 alvos.
- Custo financeiro **R$0**: sem Apple Developer (ad-hoc signing local), sem Google Play Developer ($25 só se publicar).
- O repo `mypay-mobile` (Flutter) é arquivado/descartado após validação.

Decisões já tomadas pelo usuário:
- AppId Android: **`com.mypay.mypay_mobile`** (reaproveita app Firebase + `google-services.json` + SHA-1 já cadastrado).
- Sequenciamento: **Capacitor (Android) primeiro**, **Electron depois**. Android é o gap urgente; Capacitor surface as abstrações mais difíceis (auth/push/router); Electron fica trivial depois.

---

## Arquitetura final

```
/Users/marlon/Code/mypay/
├── src/                              # PWA React (modificada — target-aware)
│   ├── main.jsx                      # SW gating; Router wrapper
│   ├── router/Router.jsx             # NEW — BrowserRouter (web) | HashRouter (native)
│   ├── services/platform.js          # NEW — isWeb / isNative / isElectron
│   ├── services/auth/index.js        # NEW — facade
│   │   ├── auth/web.js               # signInWithPopup
│   │   └── auth/native.js            # @capacitor-firebase/authentication
│   ├── services/push/index.js        # NEW — facade (renomeia pushNotifications.js)
│   │   ├── push/web.js               # FCM web SDK (lógica atual)
│   │   ├── push/native.js            # @capacitor-firebase/messaging
│   │   └── push/electron.js          # native Notification API (no token)
│   └── ...                           # demais arquivos sem alteração
├── public/
│   ├── sw.js                         # MANTIDO (só web registra)
│   └── firebase-messaging-sw.js      # MANTIDO (só web registra)
├── dist/                             # vite build → entrada de Electron e Capacitor
├── electron/                         # NEW — wrapper desktop
│   ├── main.cjs                      # BrowserWindow + popup handler
│   └── preload.cjs                   # contextBridge mínimo
├── android/                          # NEW — gerado por `npx cap add android`
│   └── app/google-services.json      # copiado de mypay-mobile
├── capacitor.config.ts               # NEW
├── electron-builder.yml              # NEW
├── vite.config.js                    # MODIFIED — base: './'
├── package.json                      # MODIFIED — scripts + deps
└── vercel.json                       # SEM alteração (web continua igual)

/Users/marlon/Code/mypay-mobile/      # ARCHIVED após validação
/Users/marlon/Code/mypay-api/         # SEM alteração
```

---

## Phase A — PWA prep (target-aware)

Abstrações para o mesmo `src/` rodar em web, Android e desktop.

### A.1 Vite: relative base

`vite.config.js` — adicionar `base: './'`. Sem isso, `dist/index.html` referencia `/assets/...`, que quebra em `file://` (Electron) e `capacitor://localhost` (Android).

### A.2 Platform detector

`src/services/platform.js` (novo):

```js
export const isElectron = () =>
  typeof window !== 'undefined' &&
  (!!window.process?.versions?.electron ||
    /Electron/.test(navigator.userAgent));

export const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

export const isWeb = () => !isElectron() && !isNative();

export const target = () => (isElectron() ? 'electron' : isNative() ? 'native' : 'web');
```

### A.3 Router target-aware

`src/router/Router.jsx` (novo): exporta `<AppRouter>` que escolhe `BrowserRouter` para web (preserva URLs limpas no Vercel) e `HashRouter` para native/electron (compatível com `file://` e `capacitor://`).

`src/main.jsx` passa a importar `AppRouter` no lugar de `BrowserRouter` direto.

### A.4 Service workers gated

`src/main.jsx:40-61` — gate com `if (isWeb()) { /* register sw.js + firebase-messaging-sw.js */ }`. Os arquivos em `public/` permanecem (web continua tendo PWA installable + push web), só a chamada `serviceWorker.register()` que vira condicional.

`src/services/pushNotifications.js:16-46` (`initializeServiceWorker`) — mesmo gate.

### A.5 Auth facade

Novo `src/services/auth/index.js`:

```js
import { isNative } from '../platform';
export const signInWithGoogle = async () =>
  isNative() ? (await import('./native')).signInWithGoogle()
             : (await import('./web')).signInWithGoogle();
```

- `auth/web.js`: extrai a lógica de `signInWithPopup` que está em `src/contexts/AuthContext.jsx:47`.
- `auth/native.js`: usa `@capacitor-firebase/authentication` `FirebaseAuthentication.signInWithGoogle()` — esse plugin internamente chama `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))`, então o `onAuthStateChanged` em `AuthContext.jsx:28` continua funcionando inalterado.

`src/contexts/AuthContext.jsx:47` passa a chamar `signInWithGoogle()` da facade.

### A.6 Push facade

Refatorar `src/services/pushNotifications.js` em três módulos:
- `src/services/push/web.js` — código atual (FCM web, `getToken`, `onMessage`, local Notification).
- `src/services/push/native.js` — `@capacitor/push-notifications` register + `@capacitor-firebase/messaging` para FCM token Android.
- `src/services/push/electron.js` — apenas `new Notification(title, opts)` (sem token; push remoto fica para depois).
- `src/services/push/index.js` — exporta `requestPermission()`, `getToken()`, `onMessage()`, `showLocalNotification()` que delegam para o módulo correto.

Consumidores em `src/contexts/NotificationContext.jsx` e similares passam a importar de `services/push`.

**Gates específicos para native (descobertos em validação)**:
- `isPushSupported()` em `index.js` deve **retornar `true` direto em `isNative()`** — Android WebView não expõe `Notification` API, mas o suporte vem do plugin Capacitor (sempre incluído no APK).
- `getNotificationPermission()` em `index.js` deve **retornar `'default'` em `isNative()`** — o estado real é assíncrono (`PushNotifications.checkPermissions`); a fonte sync ficaria errada e bloquearia o botão "Ativar".
- O botão "Testar notificação" do app **não funciona em Android** porque `showLocalNotification` chama `new Notification()`. Validação real de push em native via FCM disparado pelo backend (ou Firebase Console > Messaging > "Enviar mensagem de teste").

### A.7 API base + Vite proxy (dev) — descoberto durante validação

O `apiClient.js` lê `import.meta.env.VITE_API_URL` (fallback `localhost:8000`). Em **dev web**, apontar absoluto para prod (`https://mypay-api.palmadigital.com.br`) gera CORS bloqueado em `http://localhost:3000`. Em **build de Capacitor/Electron**, precisa de URL absoluta (sem proxy disponível).

Solução: Vite proxy em dev + URL absoluta em build, controlado por arquivos `.env`:
- `.env` (versão default usada por `vite build`): `VITE_API_URL=https://mypay-api.palmadigital.com.br`.
- `.env.development.local` (sobrepõe só em `vite dev`, gitignored): `VITE_API_URL=` (vazio → path relativo) + `DEV_PROXY_API_TARGET=https://mypay-api.palmadigital.com.br`.
- `vite.config.js` carrega via `loadEnv()` e configura `server.proxy['/api/v1'].target = env.DEV_PROXY_API_TARGET || 'http://localhost:8000'`.

`apiClient.js`/`eventStream.js` não precisam de mudança: `?? fallback` só faz fallback em null/undefined; string vazia passa direto e gera fetch relativo.

---

## Phase C — Capacitor (Android)

### C.1 Install

```bash
cd /Users/marlon/Code/mypay
npm i @capacitor/core@^6 @capacitor/cli@^6 @capacitor/android@^6 \
      @capacitor/app@^6 @capacitor/push-notifications@^6 \
      @capacitor-firebase/authentication@^6 @capacitor-firebase/messaging@^6
```

### C.2 Init + add Android

```bash
npx cap init "myPay" "com.mypay.mypay_mobile" --web-dir dist
npm run build           # gera dist/
npx cap add android
```

Isso cria `capacitor.config.ts` e `android/`.

### C.3 `capacitor.config.ts`

```ts
import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.mypay.mypay_mobile',
  appName: 'myPay',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    FirebaseAuthentication: {
      // true → plugin retorna o credential ao JS; nós chamamos signInWithCredential
      // no Firebase Web SDK manualmente (auth/native.js), e o onAuthStateChanged dispara.
      // false (default) só autentica o SDK nativo, deixando o Web SDK no escuro.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};
export default config;
```

> **Nota:** o `strings.xml` com `capacitor_firebase_authentication_providers` (convenção de versões antigas do plugin) **não é mais lido** pela versão 6 — a fonte de verdade é `capacitor.config.ts`.

### C.4 Firebase Android resources

Copiar **`google-services.json`** de `/Users/marlon/Code/mypay-mobile/android/app/google-services.json` para `/Users/marlon/Code/mypay/android/app/google-services.json` (mesmo `applicationId`, mesmo SHA-1 já cadastrado).

O template do Capacitor 6 já vem com o bloco condicional em `android/app/build.gradle`:
```gradle
try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
    }
} catch(Exception e) { ... }
```

E o classpath em `android/build.gradle` (root): `classpath 'com.google.gms:google-services:4.4.0'`. Sem ações manuais no Gradle além de copiar o `google-services.json`.

### C.4.1 `play-services-auth` no APK (descoberto durante validação)

O plugin `@capacitor-firebase/authentication` declara `play-services-auth` como `compileOnly` por default — **não inclui no APK**. Sem fix, o app crasha com `NoClassDefFoundError: Lcom/google/android/gms/auth/api/signin/GoogleSignIn;` no boot.

Em `android/variables.gradle`, adicionar:
```gradle
ext {
    // ... vars existentes do template Capacitor
    rgcfaIncludeGoogle = true       // força inclusão de play-services-auth no APK
    playServicesAuthVersion = '21.0.0'
}
```

### C.5 Permissões + manifest

Capacitor 6 + `@capacitor/push-notifications` injeta as permissões necessárias. Verificar `android/app/src/main/AndroidManifest.xml` — não deve precisar de edit manual.

### C.6 Build + run

```bash
npm run build && npx cap sync android
npx cap run android --target ZF5242GHLZ      # roda no moto g52 já conectado
```

> **Nota sobre `--target`:** o script `npm run android:dev` no `package.json` **não passa `--target`** — sem ele, `cap run android` lista todos os devices/emuladores e fica esperando input interativo (o que trava builds não-interativos). Workarounds:
> - Adicionar variante `android:dev:moto` com `--target` fixo, ou
> - Usar `npx cap run android --target <id>` direto, pulando o npm script.

### C.6.1 Backend CORS para origens Capacitor (descoberto durante validação)

O Capacitor Android com `androidScheme: 'https'` carrega o app em `https://localhost`. O backend `mypay-api` precisa aceitar essa origem (e `capacitor://localhost` para iOS futuro).

Em `mypay-api/.env.prod` (e provisionado no host de produção via env vars do Easypanel/Coolify):
```
CORS_ORIGINS=["https://mypay.palmadigital.com.br","http://localhost:3000","https://localhost","capacitor://localhost"]
```

Atualizar a env var no host **e reiniciar o container** (FastAPI lê `CORS_ORIGINS` apenas no startup do uvicorn). Validar com:
```bash
curl -i -X OPTIONS https://mypay-api.palmadigital.com.br/api/v1/events \
  -H "Origin: https://localhost" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin
```

Esperado: `access-control-allow-origin: https://localhost`.

Validar:
- App abre com a UX 100% igual à PWA.
- Login Google funciona via native picker (não via popup).
- Foreground messages aparecem quando o backend dispara push.
- Refresh / hot-reload em dev: `npx cap run android` com `server.url` apontando pro Vite dev server (opcional para ciclos curtos).

---

## Phase B — Electron (macOS + bonus Win/Linux)

### B.1 Install

```bash
cd /Users/marlon/Code/mypay
npm i -D electron@^33 electron-builder@^25 concurrently wait-on
```

### B.2 `electron/main.cjs`

Cria `BrowserWindow`, em dev carrega `http://localhost:5173`, em prod carrega `file://${__dirname}/../dist/index.html`. Configurações críticas:
- `webPreferences.contextIsolation: true`, `nodeIntegration: false`.
- `preload: path.join(__dirname, 'preload.cjs')`.
- `setWindowOpenHandler(() => ({ action: 'allow' }))` na webContents — necessário para `signInWithPopup` funcionar.

### B.3 `electron-builder.yml`

```yaml
appId: br.com.mypay.desktop
productName: myPay
directories:
  output: dist-electron
files:
  - dist/**/*
  - electron/**/*
mac:
  target: dmg
  identity: null      # ad-hoc signing (sem Apple Developer)
win:
  target: nsis
linux:
  target: AppImage
```

### B.4 Build + run

```bash
npm run electron:dev          # vite dev + electron
npm run electron:build        # vite build && electron-builder
```

---

## Phase D — npm scripts

`package.json` (modificado):

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "android:dev": "npm run build && npx cap sync android && npx cap run android",
    "android:open": "npx cap open android",
    "android:build": "npm run build && npx cap sync android && cd android && ./gradlew assembleRelease",
    "electron:dev": "concurrently -k \"vite\" \"wait-on http://localhost:5173 && electron electron/main.cjs\"",
    "electron:build": "npm run build && electron-builder",
    "electron:build:mac": "npm run build && electron-builder --mac"
  }
}
```

---

## Critical files — referência rápida

Arquivos que serão **modificados** (existentes):

- `/Users/marlon/Code/mypay/vite.config.js` — `base: './'`
- `/Users/marlon/Code/mypay/src/main.jsx` — gate SW + Router wrapper
- `/Users/marlon/Code/mypay/src/contexts/AuthContext.jsx` — usar facade `signInWithGoogle()`
- `/Users/marlon/Code/mypay/src/services/pushNotifications.js` — refatorado em `src/services/push/{web,native,electron,index}.js`
- `/Users/marlon/Code/mypay/package.json` — deps + scripts

Arquivos **novos**:

- `/Users/marlon/Code/mypay/src/router/Router.jsx`
- `/Users/marlon/Code/mypay/src/services/platform.js`
- `/Users/marlon/Code/mypay/src/services/auth/{index,web,native}.js`
- `/Users/marlon/Code/mypay/src/services/push/{index,web,native,electron}.js`
- `/Users/marlon/Code/mypay/capacitor.config.ts`
- `/Users/marlon/Code/mypay/android/` (gerado por `npx cap add android`)
- `/Users/marlon/Code/mypay/android/app/google-services.json` (copiado de mypay-mobile)
- `/Users/marlon/Code/mypay/electron/main.cjs`
- `/Users/marlon/Code/mypay/electron/preload.cjs`
- `/Users/marlon/Code/mypay/electron-builder.yml`

---

## Verificação — end-to-end

### Web (regressão — não pode quebrar)

1. `npm run dev` → `http://localhost:5173` abre normalmente.
2. Login Google via popup.
3. SW se registra (DevTools → Application → Service Workers).
4. Push web funciona (token recuperado, notificação foreground via Notification).
5. `npm run build && npm run preview` → SPA estática OK.

### Android (Capacitor)

1. `npm run android:dev` → APK instalado no moto g52 (`ZF5242GHLZ`).
2. Layout idêntico à PWA web.
3. Botão "Continuar com Google" abre **picker nativo** (não popup), retorna ao app autenticado.
4. `onAuthStateChanged` dispara, dashboard carrega dados da API.
5. Push: enviar mensagem do Firebase Console → notificação chega; foreground listener mostra snackbar.
6. SW **não** registrado (DevTools remote: `chrome://inspect`).

### Desktop (Electron)

1. `npm run electron:dev` → janela macOS abre carregando Vite dev server.
2. Layout idêntico à PWA web.
3. Login Google abre popup window do Electron, retorna autenticado.
4. `npm run electron:build:mac` → `dist-electron/myPay-1.x.x.dmg` ad-hoc signed.
5. Abrir `.dmg`, arrastar para Applications, executar — funciona sem prompts de "developer não verificado" (ou um único prompt resolvido em "Abrir mesmo assim").

---

---

## Pré-requisitos do ambiente macOS (descobertos durante validação)

Antes de qualquer build Android, o shell precisa ter:

```bash
# Adicionar ao ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Java 17 obrigatório (Gradle 8.2.1 do Capacitor 6 não aceita Java 22+)
# Instalar: brew install openjdk@17
export JAVA_HOME=/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
```

Sintoma sem `JAVA_HOME` correto (Java 22 ativo): `BUG! exception in phase 'semantic analysis' in source unit '_BuildScript_' Unsupported class file major version 66`.

Antes do primeiro `cap run android` em uma sessão nova, verificar:
- `adb devices` mostra o device como `device` (não `unauthorized`).
- Se aparecer `unauthorized`, desbloquear o telefone e aceitar o popup "Permitir depuração USB" (marcando "Sempre permitir").

---

## Items entregues / pendentes desta validação

**Entregue (validado em runtime):**
- ✅ Phase A: Router target-aware, platform detector, gates SW, auth/push facades.
- ✅ Phase C: Capacitor Android — login Google nativo + Web SDK propagado, dados carregam via API (CORS liberado), push FCM end-to-end (token registrado + entrega real do Firebase Console).
- ✅ Phase B: Electron macOS — janela carrega Vite dev server, login popup OK, dados carregam.

**Não executado (próxima sessão):**
- 🚧 `npm run electron:build:mac` → gerar `.dmg` ad-hoc signed e validar instalação.
- 🚧 `npm run android:build` → gerar `assembleRelease` e instalar APK release.
- 🚧 Versionamento sincronizado entre `package.json` e `android/app/build.gradle` (`versionCode`/`versionName`) via hook em `update-version.js`.
- 🚧 Arquivar `mypay-mobile` (após mais alguns dias de uso real do Capacitor).
- 🚧 CI/CD para release builds.

---

## Out of scope (follow-ups)

1. **Arquivar `mypay-mobile`**: depois que Capacitor estiver provado em uso real por ~1 semana, mover repo para `~/Code/_archive/mypay-mobile/` ou marcar branch read-only.
2. **Push remoto no Electron**: hoje só `Notification` local; FCM Web SDK no Electron é possível mas exige fluxo separado de token. Implementar só se for necessidade real.
3. **Apple Developer Program** ($99/ano): se quiser distribuir o `.dmg` para terceiros sem prompts de segurança, ou se push macOS via APNs vier a ser necessário.
4. **Google Play Developer** ($25 único): só se publicar APK na Play Store. Para sideload pessoal, dispensável.
5. **CI/CD**: GitHub Actions para build de release Android (`assembleRelease`) + Electron (`electron-builder --mac --win --linux`) ao taggear release.
6. **Versionamento conjunto**: `commit-and-tag-version` (já está no projeto) deve bumpar versão em `android/app/build.gradle` (versionName/versionCode) e `electron-builder` (lê do package.json) automaticamente — adicionar hook em `prebuild` ou no `update-version.js` existente.
