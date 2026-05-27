

# Plano: Loading em tempo real na Prospecção + Central de Segurança de Leads

## O que será feito

### 1. Loading inteligente na Prospecção (estilo "IA pensando")
Na aba "Por Nicho", quando uma prospecção está em andamento, substituir o simples spinner por um feed de etapas em tempo real, mostrando o que está acontecendo:

- "Analisando perfil da empresa..."
- "Montando consultas de busca para o nicho..."
- "Buscando leads em sites públicos..."
- "Raspando páginas de contato..."
- "Calculando score ICP de cada lead..."
- "Salvando leads no banco de dados..."

Cada etapa aparece progressivamente com animação (fade-in), com ícone de check quando completa e spinner na etapa atual. Simula o progresso com timers baseados no tempo médio de execução (~30-60s total), e a última etapa só completa quando o backend responde.

### 2. Central de Segurança de Leads
Nova seção na página de Leads (botão "Segurança" no topo) que abre um painel/dialog com checagem automática:

- **Telefones duplicados**: leads com o mesmo telefone mas nomes diferentes
- **Nomes duplicados**: leads com o mesmo nome mas telefones diferentes
- **Leads sem telefone**: leads que não têm número cadastrado
- **Leads sem nome**: leads com telefone mas sem nome

Para cada problema encontrado, mostra os leads envolvidos com opções de: mesclar, corrigir ou excluir.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/Prospecting.tsx` | Adicionar componente de loading com etapas progressivas no card do job "running" |
| `src/pages/Leads.tsx` | Adicionar botão "Segurança" e dialog com análise de duplicatas e inconsistências |

## Detalhes técnicos

**Loading da Prospecção**: Array de etapas com delays progressivos (0s, 3s, 8s, 15s, 25s, 40s). Um `useEffect` com `setInterval` avança as etapas. A última etapa aguarda o retorno real do backend. Cada etapa renderiza com `animate-fade-in`.

**Central de Segurança**: Query no banco agrupando por `phone` e `name` com `HAVING count > 1`. Processamento client-side dos leads já carregados para detectar padrões. Ações de merge atualizam o lead principal e deletam os duplicados.

