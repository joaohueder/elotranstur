Reorganizar a tela de cadastro/edição de lead em três abas — Dados do Lead, Viagens de Interesse e Notas — e criar a estrutura de banco para armazenar notas com data/hora e descrição.

## O que será feito

1. **Banco de dados**
   - Criar tabela `public.crm_lead_notas` com: `id`, `lead_id`, `data_hora` (timestamptz), `descricao` (text), `created_at`, `created_by`.
   - Adicionar índice em `lead_id`.
   - Aplicar GRANTs e RLS com as mesmas permissões do módulo CRM (`is_admin` ou `can('crm', ...)`).
   - Criar trigger de `updated_at`.
   - Gerar arquivo `supabase/sql/014-crm-lead-notas.sql`.

2. **Tela de lead (`src/pages/LeadForm.tsx`)**
   - Substituir o layout atual de uma única grade por abas (Tabs do Radix UI, mesmo padrão usado em `ViagemForm`).
   - **Aba "Dados do Lead"**: nome, WhatsApp, origem e etapa do funil.
   - **Aba "Viagens de Interesse"**: mover o seletor e a lista de viagens atuais, mantendo o comportamento de adicionar/remover.
   - **Aba "Notas"**: listar notas ordenadas da mais recente para a mais antiga; formulário para adicionar nova nota com campos data/hora e descrição; permitir excluir nota.
   - As notas serão salvas imediatamente ao adicionar/excluir (não dependem do botão "Salvar" geral), pois são histórico vinculado ao lead.
   - Manter o botão "Salvar" responsável apenas pelos dados principais e viagens de interesse.

3. **Ajustes de tipos e helpers**
   - Adicionar tipo `CrmLeadNota` em `src/lib/crm.ts` se necessário.
   - Garantir que a aba ativa seja trocada automaticamente quando houver erro de validação nos "Dados do Lead".

## Detalhes técnicos
- Usar componente `Tabs` já existente em `@/components/ui/tabs`.
- Manter padrão de hints/ajudas em todos os campos.
- A tabela de notas seguirá o mesmo padrão de RLS das demais tabelas do CRM.
- Nenhuma alteração no schema das tabelas existentes (`crm_leads`, `crm_lead_viagens`, `crm_stages`, etc.).