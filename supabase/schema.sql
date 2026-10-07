-- Property Manager · schema iniziale per Supabase
-- Esegui questo file UNA VOLTA nello SQL Editor di un nuovo progetto Supabase.
-- Prima crea il tuo utente in Authentication > Users, poi esegui la query
-- di bootstrap dell'amministratore indicata nel README.

create extension if not exists pgcrypto;

-- ==============================
-- Tabelle principali
-- ==============================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'tenant' check (role in ('admin', 'tenant', 'provider')),
  display_name text not null default 'Utente',
  username text unique,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  postal_code text,
  type text not null default 'Appartamento',
  status text not null default 'vacant' check (status in ('rented', 'vacant', 'personal', 'maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dati patrimoniali e note amministrative non sono inclusi nella riga visibile
-- all'inquilino: la tabella separata è accessibile solo al proprietario/admin.
create table if not exists public.property_private_details (
  property_id uuid primary key references public.properties(id) on delete cascade,
  estimated_value numeric(14, 2) not null default 0 check (estimated_value >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  monthly_rent numeric(12, 2) not null check (monthly_rent >= 0),
  deposit numeric(12, 2) not null default 0 check (deposit >= 0),
  due_day smallint not null default 5 check (due_day between 1 and 28),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'ended', 'draft')),
  contract_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lease_tenants (
  lease_id uuid not null references public.leases(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lease_id, tenant_id)
);

create table if not exists public.property_tenant_permissions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  show_documents boolean not null default false,
  show_utilities boolean not null default false,
  show_maintenance boolean not null default false,
  allow_payment_upload boolean not null default true,
  allow_utility_upload boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, tenant_id)
);

create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  tenant_id uuid references public.profiles(id) on delete set null,
  period date not null,
  due_date date not null,
  amount_due numeric(12, 2) not null check (amount_due >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  paid_at date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'partial', 'late', 'cancelled')),
  receipt_name text,
  receipt_path text,
  receipt_uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id, period)
);

create table if not exists public.utility_accounts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  kind text not null,
  provider text,
  holder text not null default 'owner' check (holder in ('owner', 'tenant')),
  recharged_to_tenant boolean not null default false,
  contract_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.utility_bills (
  id uuid primary key default gen_random_uuid(),
  utility_id uuid not null references public.utility_accounts(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  period date not null,
  due_date date,
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'partial', 'late', 'cancelled')),
  document_name text,
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mortgages (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  lender text not null,
  original_amount numeric(14, 2) not null check (original_amount >= 0),
  remaining_amount numeric(14, 2) not null check (remaining_amount >= 0),
  monthly_payment numeric(12, 2) not null check (monthly_payment >= 0),
  rate numeric(7, 4),
  due_day smallint check (due_day between 1 and 28),
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  direction text not null check (direction in ('income', 'expense')),
  category text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  date date not null,
  status text not null default 'paid' check (status in ('pending', 'paid', 'partial', 'cancelled')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category text not null default 'Altro',
  name text not null,
  storage_path text,
  visible_to_tenant boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per eccezioni: un documento può essere assegnato solo a uno o più inquilini specifici.
create table if not exists public.document_access (
  document_id uuid not null references public.documents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, profile_id)
);

create table if not exists public.service_providers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null,
  company_name text,
  category text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  provider_id uuid references public.service_providers(id) on delete set null,
  title text not null,
  category text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  scheduled_date date,
  completed_date date,
  total_cost numeric(12, 2) not null default 0 check (total_cost >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leases_property_id_idx on public.leases(property_id);
create index if not exists lease_tenants_tenant_id_idx on public.lease_tenants(tenant_id);
create index if not exists rent_payments_property_id_idx on public.rent_payments(property_id);
create index if not exists utility_accounts_property_id_idx on public.utility_accounts(property_id);
create index if not exists documents_property_id_idx on public.documents(property_id);
create index if not exists maintenance_jobs_property_id_idx on public.maintenance_jobs(property_id);

-- ==============================
-- Trigger di servizio
-- ==============================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists properties_updated_at on public.properties;
create trigger properties_updated_at before update on public.properties for each row execute procedure public.set_updated_at();
drop trigger if exists property_private_details_updated_at on public.property_private_details;
create trigger property_private_details_updated_at before update on public.property_private_details for each row execute procedure public.set_updated_at();
drop trigger if exists leases_updated_at on public.leases;
create trigger leases_updated_at before update on public.leases for each row execute procedure public.set_updated_at();
drop trigger if exists property_tenant_permissions_updated_at on public.property_tenant_permissions;
create trigger property_tenant_permissions_updated_at before update on public.property_tenant_permissions for each row execute procedure public.set_updated_at();
drop trigger if exists rent_payments_updated_at on public.rent_payments;
create trigger rent_payments_updated_at before update on public.rent_payments for each row execute procedure public.set_updated_at();
drop trigger if exists utility_accounts_updated_at on public.utility_accounts;
create trigger utility_accounts_updated_at before update on public.utility_accounts for each row execute procedure public.set_updated_at();
drop trigger if exists utility_bills_updated_at on public.utility_bills;
create trigger utility_bills_updated_at before update on public.utility_bills for each row execute procedure public.set_updated_at();
drop trigger if exists mortgages_updated_at on public.mortgages;
create trigger mortgages_updated_at before update on public.mortgages for each row execute procedure public.set_updated_at();
drop trigger if exists financial_entries_updated_at on public.financial_entries;
create trigger financial_entries_updated_at before update on public.financial_entries for each row execute procedure public.set_updated_at();
drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at before update on public.documents for each row execute procedure public.set_updated_at();
drop trigger if exists service_providers_updated_at on public.service_providers;
create trigger service_providers_updated_at before update on public.service_providers for each row execute procedure public.set_updated_at();
drop trigger if exists maintenance_jobs_updated_at on public.maintenance_jobs;
create trigger maintenance_jobs_updated_at before update on public.maintenance_jobs for each row execute procedure public.set_updated_at();

-- Un nuovo account parte sempre come inquilino: il ruolo admin viene assegnato solo dal bootstrap o server-side.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, email, display_name, phone)
  values (
    new.id,
    'tenant',
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Utente'),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Gli inquilini possono caricare una contabile ma non alterare importi o stato del pagamento.
create or replace function public.guard_tenant_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
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

drop trigger if exists guard_tenant_payment_update on public.rent_payments;
create trigger guard_tenant_payment_update
  before update on public.rent_payments
  for each row execute procedure public.guard_tenant_payment_update();

-- ==============================
-- Funzioni di autorizzazione RLS
-- ==============================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.can_access_property(requested_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.leases l
    join public.lease_tenants lt on lt.lease_id = l.id
    where l.property_id = requested_property_id
      and l.status = 'active'
      and lt.tenant_id = auth.uid()
  );
$$;

-- Un inquilino può leggere solo il contratto di cui è intestatario,
-- anche quando più contratti riguardano lo stesso immobile.
create or replace function public.can_access_lease(requested_lease_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.lease_tenants lt
    join public.leases l on l.id = lt.lease_id
    where l.id = requested_lease_id
      and l.status = 'active'
      and lt.tenant_id = auth.uid()
  );
$$;

create or replace function public.can_view_documents(requested_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.property_tenant_permissions p
    where p.property_id = requested_property_id
      and p.tenant_id = auth.uid()
      and p.show_documents
  );
$$;

create or replace function public.can_view_utilities(requested_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.property_tenant_permissions p
    where p.property_id = requested_property_id
      and p.tenant_id = auth.uid()
      and p.show_utilities
  );
$$;

create or replace function public.can_view_maintenance(requested_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.property_tenant_permissions p
    where p.property_id = requested_property_id
      and p.tenant_id = auth.uid()
      and p.show_maintenance
  );
$$;

create or replace function public.can_upload_payment(requested_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.property_tenant_permissions p
    where p.property_id = requested_property_id
      and p.tenant_id = auth.uid()
      and p.allow_payment_upload
  );
$$;

create or replace function public.can_view_document(requested_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.documents d
    where d.id = requested_document_id
      and (
        exists (
          select 1 from public.document_access a
          where a.document_id = d.id and a.profile_id = auth.uid()
        )
        or (d.visible_to_tenant and public.can_view_documents(d.property_id))
      )
  );
$$;

-- ==============================
-- Row Level Security
-- ==============================

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_private_details enable row level security;
alter table public.leases enable row level security;
alter table public.lease_tenants enable row level security;
alter table public.property_tenant_permissions enable row level security;
alter table public.rent_payments enable row level security;
alter table public.utility_accounts enable row level security;
alter table public.utility_bills enable row level security;
alter table public.mortgages enable row level security;
alter table public.financial_entries enable row level security;
alter table public.documents enable row level security;
alter table public.document_access enable row level security;
alter table public.service_providers enable row level security;
alter table public.maintenance_jobs enable row level security;

-- L'app non espone dati a visitatori anonimi. Le operazioni degli utenti
-- autenticati restano limitate dalle policy RLS definite qui sotto.
grant usage on schema public to authenticated;
revoke all on table
  public.profiles,
  public.properties,
  public.property_private_details,
  public.leases,
  public.lease_tenants,
  public.property_tenant_permissions,
  public.rent_payments,
  public.utility_accounts,
  public.utility_bills,
  public.mortgages,
  public.financial_entries,
  public.documents,
  public.document_access,
  public.service_providers,
  public.maintenance_jobs
from public, anon;
grant select, insert, update, delete on table
  public.profiles,
  public.properties,
  public.property_private_details,
  public.leases,
  public.lease_tenants,
  public.property_tenant_permissions,
  public.rent_payments,
  public.utility_accounts,
  public.utility_bills,
  public.mortgages,
  public.financial_entries,
  public.documents,
  public.document_access,
  public.service_providers,
  public.maintenance_jobs
to authenticated;
grant all on table
  public.profiles,
  public.properties,
  public.property_private_details,
  public.leases,
  public.lease_tenants,
  public.property_tenant_permissions,
  public.rent_payments,
  public.utility_accounts,
  public.utility_bills,
  public.mortgages,
  public.financial_entries,
  public.documents,
  public.document_access,
  public.service_providers,
  public.maintenance_jobs
to service_role;

-- Rimuove policy con lo stesso nome in caso di esecuzione ripetuta.
drop policy if exists profiles_admin_all on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_admin_all on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists properties_admin_all on public.properties;
drop policy if exists properties_tenant_select on public.properties;
create policy properties_admin_all on public.properties for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy properties_tenant_select on public.properties for select to authenticated using (public.can_access_property(id));

drop policy if exists property_private_details_admin_all on public.property_private_details;
create policy property_private_details_admin_all on public.property_private_details for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists leases_admin_all on public.leases;
drop policy if exists leases_tenant_select on public.leases;
create policy leases_admin_all on public.leases for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy leases_tenant_select on public.leases for select to authenticated using (public.can_access_lease(id));

drop policy if exists lease_tenants_admin_all on public.lease_tenants;
drop policy if exists lease_tenants_tenant_select on public.lease_tenants;
create policy lease_tenants_admin_all on public.lease_tenants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lease_tenants_tenant_select on public.lease_tenants for select to authenticated using (tenant_id = auth.uid());

drop policy if exists permissions_admin_all on public.property_tenant_permissions;
drop policy if exists permissions_tenant_select on public.property_tenant_permissions;
create policy permissions_admin_all on public.property_tenant_permissions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy permissions_tenant_select on public.property_tenant_permissions for select to authenticated using (tenant_id = auth.uid());

drop policy if exists payments_admin_all on public.rent_payments;
drop policy if exists payments_tenant_select on public.rent_payments;
drop policy if exists payments_tenant_update_receipt on public.rent_payments;
create policy payments_admin_all on public.rent_payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy payments_tenant_select on public.rent_payments for select to authenticated using (public.can_access_lease(lease_id));
create policy payments_tenant_update_receipt on public.rent_payments for update to authenticated using (public.can_access_lease(lease_id) and public.can_upload_payment(property_id)) with check (public.can_access_lease(lease_id) and public.can_upload_payment(property_id));

drop policy if exists utilities_admin_all on public.utility_accounts;
drop policy if exists utilities_tenant_select on public.utility_accounts;
create policy utilities_admin_all on public.utility_accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy utilities_tenant_select on public.utility_accounts for select to authenticated using (public.can_view_utilities(property_id));

drop policy if exists bills_admin_all on public.utility_bills;
drop policy if exists bills_tenant_select on public.utility_bills;
create policy bills_admin_all on public.utility_bills for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy bills_tenant_select on public.utility_bills for select to authenticated using (public.can_view_utilities(property_id));

drop policy if exists mortgages_admin_all on public.mortgages;
create policy mortgages_admin_all on public.mortgages for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists financial_admin_all on public.financial_entries;
create policy financial_admin_all on public.financial_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists documents_admin_all on public.documents;
drop policy if exists documents_tenant_select on public.documents;
create policy documents_admin_all on public.documents for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy documents_tenant_select on public.documents for select to authenticated using (public.can_view_document(id));

drop policy if exists document_access_admin_all on public.document_access;
drop policy if exists document_access_tenant_select on public.document_access;
create policy document_access_admin_all on public.document_access for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy document_access_tenant_select on public.document_access for select to authenticated using (profile_id = auth.uid());

drop policy if exists providers_admin_all on public.service_providers;
drop policy if exists providers_own_select on public.service_providers;
create policy providers_admin_all on public.service_providers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy providers_own_select on public.service_providers for select to authenticated using (profile_id = auth.uid());

drop policy if exists maintenance_admin_all on public.maintenance_jobs;
drop policy if exists maintenance_tenant_select on public.maintenance_jobs;
drop policy if exists maintenance_provider_select on public.maintenance_jobs;
create policy maintenance_admin_all on public.maintenance_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy maintenance_tenant_select on public.maintenance_jobs for select to authenticated using (public.can_view_maintenance(property_id));
create policy maintenance_provider_select on public.maintenance_jobs for select to authenticated using (
  exists (select 1 from public.service_providers p where p.id = provider_id and p.profile_id = auth.uid())
);

-- ==============================
-- Storage documenti privati
-- ==============================

insert into storage.buckets (id, name, public)
values ('property-documents', 'property-documents', false)
on conflict (id) do update set public = false;

drop policy if exists storage_admin_all on storage.objects;
drop policy if exists storage_tenant_upload_receipt on storage.objects;
drop policy if exists storage_tenant_read_permitted on storage.objects;

create policy storage_admin_all
on storage.objects for all
to authenticated
using (bucket_id = 'property-documents' and public.is_admin())
with check (bucket_id = 'property-documents' and public.is_admin());

-- Il percorso tenant/{auth.uid()}/... impedisce a un inquilino di scrivere nella cartella di un altro.
create policy storage_tenant_upload_receipt
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'property-documents'
  and name like ('tenant/' || auth.uid()::text || '/%')
  and exists (
    select 1
    from public.rent_payments p
    where p.id::text = split_part(name, '/', 3)
      and public.can_access_lease(p.lease_id)
      and public.can_upload_payment(p.property_id)
  )
);

create policy storage_tenant_read_permitted
on storage.objects for select
to authenticated
using (
  bucket_id = 'property-documents'
  and (
    name like ('tenant/' || auth.uid()::text || '/%')
    or exists (
      select 1 from public.documents d
      where d.storage_path = name and public.can_view_document(d.id)
    )
    or exists (
      select 1 from public.rent_payments r
      where r.receipt_path = name and public.can_access_lease(r.lease_id)
    )
  )
);

-- Le funzioni usate dalle policy sono disponibili solo a utenti autenticati.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.can_access_property(uuid) from public, anon;
revoke execute on function public.can_access_lease(uuid) from public, anon;
revoke execute on function public.can_view_documents(uuid) from public, anon;
revoke execute on function public.can_view_utilities(uuid) from public, anon;
revoke execute on function public.can_view_maintenance(uuid) from public, anon;
revoke execute on function public.can_upload_payment(uuid) from public, anon;
revoke execute on function public.can_view_document(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_property(uuid) to authenticated;
grant execute on function public.can_access_lease(uuid) to authenticated;
grant execute on function public.can_view_documents(uuid) to authenticated;
grant execute on function public.can_view_utilities(uuid) to authenticated;
grant execute on function public.can_view_maintenance(uuid) to authenticated;
grant execute on function public.can_upload_payment(uuid) to authenticated;
grant execute on function public.can_view_document(uuid) to authenticated;

-- Bootstrap: dopo avere creato il tuo utente Auth, sostituisci l'email e lancia UNA volta.
-- update public.profiles set role = 'admin' where email = 'la-tua-email@example.com';
