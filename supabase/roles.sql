-- Rode este script no Supabase (SQL Editor) DEPOIS do schema.sql original.
-- Ele cria a tabela de perfis (com o papel de cada usuário) e promove sua conta
-- já existente para administrador.

-- ---------- Tabela de perfis ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'cliente',      -- 'cliente' | 'admin'
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Cada pessoa só pode ver e editar o próprio perfil (nome/telefone, nunca o papel)
create policy "Usuário vê o próprio perfil"
  on profiles for select
  using (auth.uid() = id);

create policy "Usuário cria o próprio perfil"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Usuário edita o próprio nome/telefone"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- Criação automática de perfil ----------
-- Sempre que alguém se cadastra (supabase.auth.signUp), este gatilho cria
-- automaticamente uma linha em "profiles" com role = 'cliente' por padrão.
-- Ninguém consegue virar admin sozinho pelo app — só você, rodando o UPDATE abaixo.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'cliente', new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- Promover a SUA conta (a que você já criou) para admin ----------
-- Troque 'seu-email@exemplo.com' pelo e-mail que você usou para criar a conta
-- na tela de Painel. Rode este UPDATE uma vez.

update profiles
set role = 'admin'
where id = (select id from auth.users where email = 'seu-email@exemplo.com');

-- Caso essa conta tenha sido criada ANTES deste script (ou seja, antes do gatilho
-- existir), ela pode não ter uma linha em "profiles" ainda. Neste caso, rode:
insert into profiles (id, role)
select id, 'admin' from auth.users
where email = 'seu-email@exemplo.com'
on conflict (id) do update set role = 'admin';

-- ---------- Ajuste das políticas de serviços e agendamentos ----------
-- Antes, qualquer usuário autenticado podia gerenciar. Agora, só quem tem role = 'admin'.

drop policy if exists "Somente admin gerencia serviços" on services;
create policy "Somente admin gerencia serviços"
  on services for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Somente admin atualiza agendamento" on appointments;
create policy "Somente admin atualiza agendamento"
  on appointments for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Somente admin exclui agendamento" on appointments;
create policy "Somente admin exclui agendamento"
  on appointments for delete
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
