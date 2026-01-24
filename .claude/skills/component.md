# component

Cria um novo componente React seguindo os padrões do projeto myPay.

## Usage

```bash
/component [nome-do-componente] [--ui] [--page]
```

## Description

Esta skill cria componentes React otimizados para o projeto myPay, seguindo as convenções estabelecidas:

**Opções:**
- `--ui`: Cria um componente UI reutilizável em `src/components/ui/`
- `--page`: Cria um componente de página em `src/pages/`
- Sem flags: Cria em `src/components/`

**O componente criado inclui:**
- Importações corretas (React, Lucide icons, componentes UI)
- Suporte ao tema dark (cores dark-*)
- PropTypes ou JSDoc quando apropriado
- Estrutura responsiva com Tailwind CSS
- Strings em português (pt-BR) para UI

**Para componentes UI:**
- Export nomeado
- Adiciona ao barrel file `src/components/ui/index.js`
- Documentação de props

## Instructions

1. Pergunte o nome do componente se não foi fornecido
2. Confirme se é componente UI, página ou componente comum
3. Crie o arquivo no diretório apropriado
4. Se for componente UI, adicione ao `index.js`
5. Inclua exemplo de uso em comentário no topo do arquivo
6. Use apenas ícones do lucide-react
7. Mantenha consistência com componentes existentes em `src/components/ui/`
