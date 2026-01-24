# page

Cria uma nova página/tab no app myPay.

## Usage

```bash
/page [nome-da-pagina]
```

## Description

Cria uma nova página completa com integração ao sistema de tabs do App.jsx.

**A página criada inclui:**
- Componente funcional com hooks necessários
- Integração com AuthContext para pegar user
- Props de selectedMonth e selectedYear (passadas do App.jsx)
- Layout responsivo com tema dark
- Estados de loading e empty state
- Componentes UI do projeto (Card, Button, EmptyState, etc)
- Strings em português (pt-BR)

**Também atualiza:**
- `App.jsx` - Adiciona nova tab ao sistema de navegação
- Importações necessárias
- Ícone apropriado do lucide-react

## Instructions

1. Pergunte o nome e propósito da página
2. Confirme qual ícone usar (sugerir alguns do lucide-react)
3. Crie o arquivo em `src/pages/[NomePage].jsx`
4. Implemente estrutura base com:
   - Header com título
   - MonthSelector se precisar filtrar por mês
   - Loading state
   - Empty state
   - Grid/lista para conteúdo
5. Atualize `App.jsx`:
   - Import da página
   - Adicione tab ao array de tabs
   - Adicione case no switch/ternário
6. Use hooks do Firestore se a página precisar de dados
7. Mantenha consistência visual com páginas existentes
