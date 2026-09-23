-- Rode este script no Supabase (SQL Editor) DEPOIS do schema.sql e do roles.sql.

-- ---------- Vincular agendamentos à conta do cliente (opcional: pode ficar nulo para convidados) ----------
alter table appointments add column if not exists client_id uuid references auth.users(id) on delete set null;
create index if not exists appointments_client_id_idx on appointments (client_id);

-- Um cliente só pode criar um agendamento em nome dele mesmo (ou como convidado, sem client_id)
drop policy if exists "Qualquer um pode criar agendamento" on appointments;
create policy "Criar agendamento (convidado ou da própria conta)"
  on appointments for insert
  with check (client_id is null or client_id = auth.uid());

-- ---------- Guardar o telefone informado no cadastro ----------
-- Atualiza a função para também gravar o telefone (vindo dos metadados do cadastro)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (new.id, 'cliente', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end;
$$;
