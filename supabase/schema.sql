-- Rode este script inteiro no Supabase: painel do projeto > SQL Editor > New query > colar > Run

-- Extensão para gerar IDs automáticos
create extension if not exists "pgcrypto";

-- ---------- Tabela de serviços ----------
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_min integer not null default 0,
  full_day boolean not null default false,
  price_pequeno numeric not null default 0,
  price_medio numeric not null default 0,
  price_grande numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Tabela de agendamentos ----------
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  services jsonb not null default '[]',       -- [{id, name, duration, fullDay, price}, ...]
  full_day boolean not null default false,
  vehicle text not null,                       -- 'pequeno' | 'medio' | 'grande'
  price numeric not null default 0,
  duration_min integer not null default 0,
  appt_date date not null,
  appt_time text not null,                     -- '08:00' | '13:00'
  client_name text not null,
  client_phone text not null,
  notes text default '',
  status text not null default 'pendente',     -- pendente | confirmado | concluido | cancelado
  created_at timestamptz not null default now()
);

create index if not exists appointments_date_idx on appointments (appt_date, appt_time);

-- ---------- Segurança (Row Level Security) ----------
-- Clientes (sem login) podem ler serviços e criar agendamentos.
-- Só o dono autenticado (login do painel) pode alterar/excluir.

alter table services enable row level security;
alter table appointments enable row level security;

-- Qualquer pessoa pode ver os serviços (para montar a tela de agendamento)
create policy "Serviços são públicos para leitura"
  on services for select
  using (true);

-- Só usuários autenticados (o dono, logado no painel) podem criar/editar/excluir serviços
create policy "Somente admin gerencia serviços"
  on services for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Qualquer pessoa pode criar um agendamento (o cliente, sem estar logado)
create policy "Qualquer um pode criar agendamento"
  on appointments for insert
  with check (true);

-- Qualquer pessoa pode ver os agendamentos (necessário para checar horários ocupados
-- na tela de agendamento do cliente)
create policy "Agendamentos são públicos para leitura"
  on appointments for select
  using (true);

-- Só o admin autenticado pode aprovar, mudar status ou excluir
create policy "Somente admin atualiza agendamento"
  on appointments for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Somente admin exclui agendamento"
  on appointments for delete
  using (auth.role() = 'authenticated');

-- ---------- Serviços iniciais (pode editar tudo depois, pelo painel do app) ----------
insert into services (name, duration_min, full_day, price_pequeno, price_medio, price_grande)
values
  ('Lavagem completa', 90, false, 70, 85, 100),
  ('Lavagem detalhada', 180, false, 150, 170, 190),
  ('Polimento comercial', 240, false, 300, 350, 400),
  ('Polimento técnico', 480, true, 550, 650, 750),
  ('Vitrificação dos vidros', 120, false, 220, 250, 280)
on conflict do nothing;
