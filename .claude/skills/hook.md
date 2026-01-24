# hook

Cria um novo custom hook do Firestore seguindo o padrão do projeto.

## Usage

```bash
/hook [nome-da-colecao]
```

## Description

Cria um custom hook para gerenciar uma coleção do Firestore, seguindo o padrão estabelecido em `src/hooks/useFirestore.js`.

**O hook criado inclui:**
- Operações CRUD completas (add, update, delete)
- Real-time subscription com `onSnapshot`
- Estados de loading e error
- Path correto: `users/{userId}/[colecao]/`
- Tratamento de erros com console.error
- Cleanup de subscriptions no useEffect

**Padrão de retorno:**
```javascript
{
  data: [],
  loading: boolean,
  error: string | null,
  addItem: (data) => Promise<string>,
  updateItem: (id, data) => Promise<void>,
  deleteItem: (id) => Promise<void>
}
```

## Instructions

1. Pergunte o nome da coleção se não fornecido
2. Adicione o novo hook em `src/hooks/useFirestore.js`
3. Use a estrutura de path: `users/${user.uid}/[colecao]`
4. Implemente operações CRUD seguindo o padrão dos hooks existentes
5. Exporte o hook no final do arquivo
6. Se necessário, adicione ordenação ou filtros específicos
7. Mantenha consistência com hooks existentes (useTransactions, useCards, etc)
