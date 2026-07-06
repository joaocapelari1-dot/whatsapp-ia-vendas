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

-- ============================================
-- Sales Brain (Fase 1) — estado e auditoria
-- ============================================

-- Estado persistente de cada conversa (memória de trabalho do Decision Engine)
create table if not exists conversation_state (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) unique,
  product_id uuid references produtos(id),
  stage text default 'discovery',
  buy_score integer default 20,
  interest_level text,
  objections jsonb default '[]',
  last_questions jsonb default '[]',
  sentiment text default 'neutral',
  checkout_generated boolean default false,
  purchase_completed boolean default false,
  waiting_human boolean default false,
  messages_count integer default 0,
  updated_at timestamptz default now()
);

-- Log de auditoria: rastro completo de cada decisão tomada pelo backend
create table if not exists decision_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  product_id uuid references produtos(id),
  mensagem_recebida text,
  intent text,
  confidence numeric,
  stage text,
  emotion text,
  objection text,
  buy_score_delta integer,
  estrategia text,
  motivo_estrategia text,
  resposta_gerada text,
  resposta_valida boolean,
  motivo_invalidacao text,
  criado_em timestamptz default now()
);

create index if not exists idx_conversation_state_lead on conversation_state(lead_id);
create index if not exists idx_decision_logs_lead on decision_logs(lead_id);

-- ============================================
-- Market Brain (v1) — radar de produtos
-- ============================================

create table if not exists market_products (
  id uuid primary key default gen_random_uuid(),
  plataforma text not null,          -- hotmart | kiwify
  external_id text not null,
  nome text,
  categoria text,
  preco numeric,
  comissao_pct numeric,
  comissao_valor numeric,
  temperatura numeric,
  url text,
  primeiro_visto timestamptz default now(),
  ultimo_visto timestamptz default now(),
  importado boolean default false,
  unique(plataforma, external_id)
);

create table if not exists market_snapshots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references market_products(id),
  data date not null,
  opportunity_score numeric,
  confidence_score numeric,
  trend_score numeric,
  commission_score numeric,
  competition_score numeric,
  landing_score numeric,
  raw jsonb,
  unique(product_id, data)
);

create index if not exists idx_market_snapshots_data on market_snapshots(data);
create index if not exists idx_market_products_plataforma on market_products(plataforma);

-- ============================================
-- Traffic Brain (v1) — planos de tráfego
-- ============================================

create table if not exists traffic_plans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references produtos(id) unique,
  landing_score numeric,
  landing_detalhes jsonb,
  plano jsonb,
  criado_em timestamptz default now()
);

-- Market Brain — evolução: fingerprint cross-plataforma e Market DNA
alter table market_products add column if not exists fingerprint text;
alter table market_products add column if not exists dna jsonb;
create index if not exists idx_market_products_fingerprint on market_products(fingerprint);

-- Sessões persistentes de login por plataforma (pareamento manual).
-- Evita repetir login toda vez que o coletor roda — resolve o problema
-- de 2FA/confirmação por e-mail: você loga uma vez manualmente no seu PC
-- (scripts/pareamento.js), a sessão fica salva aqui, e o coletor no
-- servidor reaproveita os cookies em vez de logar de novo.
create table if not exists platform_sessions (
  plataforma text primary key,
  cookies jsonb not null,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);
