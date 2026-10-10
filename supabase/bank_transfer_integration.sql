-- Integrazione Gmail/Fineco per notifiche di bonifici in ingresso.
-- Conserva solo mittente, importo e data, senza memorizzare il contenuto dell'email.
create table if not exists public.tenant_bank_sender_aliases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null,
  sender_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_transfer_events (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  sender_name text not null,
  sender_key text not null,
  credited_on date not null,
  amount numeric(12,2) not null check (amount > 0),
  tenant_id uuid references public.profiles(id) on delete set null,
  payment_id uuid references public.rent_payments(id) on delete set null,
  expected_amount numeric(12,2),
  status text not null default 'review' check (status in ('matched','review','unmatched')),
  review_reason text,
  created_at timestamptz not null default now()
);

alter table public.tenant_bank_sender_aliases enable row level security;
alter table public.bank_transfer_events enable row level security;
drop policy if exists tenant_bank_sender_aliases_admin_all on public.tenant_bank_sender_aliases;
create policy tenant_bank_sender_aliases_admin_all on public.tenant_bank_sender_aliases for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists bank_transfer_events_admin_all on public.bank_transfer_events;
create policy bank_transfer_events_admin_all on public.bank_transfer_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.tenant_bank_sender_aliases, public.bank_transfer_events to authenticated;
grant all on public.tenant_bank_sender_aliases, public.bank_transfer_events to service_role;

-- Consente al webhook autenticato via service role di aggiornare importo/stato;
-- gli aggiornamenti eseguiti dagli inquilini restano limitati dalla funzione esistente.
create or replace function public.guard_tenant_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  if old.property_id is distinct from new.property_id
     or old.lease_id is distinct from new.lease_id
     or old.tenant_id is distinct from new.tenant_id
     or old.period is distinct from new.period
     or old.due_date is distinct from new.due_date
     or old.amount_due is distinct from new.amount_due
     or old.amount_paid is distinct from new.amount_paid
     or old.paid_at is distinct from new.paid_at
     or old.status is distinct from new.status then
    raise exception 'Un inquilino può aggiornare solo la contabile di pagamento.';
  end if;
  return new;
end;
$$;
