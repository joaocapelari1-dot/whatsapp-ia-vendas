-- ============================================
-- Schema: Sistema de Automação WhatsApp + IA
-- Rodar isso no SQL Editor do Supabase
-- ============================================

-- Produtos (nasce do link, não cadastro manual)
create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null, -- ex: PX01, usado no link de clique-para-chat
  url_origem text not null,
  nome text,
  preco numeric,
  descricao_raw text, -- conteúdo bruto extraído do scraping
  conhecimento_ia text, -- resumo estruturado que o Claude gera pra "estudar" o produto
  link_pagamento_base text, -- link fixo do checkout (Hotmart/MP), se houver
  link_entrega text, -- link de acesso enviado após pagamento aprovado (se digital)
  status text default 'processando', -- processando | pronto | erro
  criado_em timestamptz default now()
);

-- Leads
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  telefone text unique not null,
  nome text,
  produto_atual_id uuid references produtos(id),
  status_funil text default 'novo', -- novo | conversando | interessado | comprou | perdido | escalado
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Histórico de conversa (contexto pra IA)
create table if not exists conversas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  produto_id uuid references produtos(id),
  remetente text not null, -- 'lead' | 'ia'
  mensagem text not null,
  criado_em timestamptz default now()
);

-- Vendas
create table if not exists vendas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  produto_id uuid references produtos(id),
  valor numeric,
  link_pagamento_gerado text,
  status_pagamento text default 'pendente', -- pendente | approved | rejected
  mp_payment_id text,
  criado_em timestamptz default now()
);

-- Índices úteis
create index if not exists idx_leads_telefone on leads(telefone);
create index if not exists idx_conversas_lead on conversas(lead_id);
create index if not exists idx_produtos_codigo on produtos(codigo);
create index if not exists idx_vendas_lead_produto on vendas(lead_id, produto_id);
