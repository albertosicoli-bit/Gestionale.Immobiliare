-- Installa una cancellazione account limitata agli amministratori.
-- Eseguire una sola volta nel SQL Editor di Supabase.

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Operazione riservata all’amministratore';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Non puoi cancellare il tuo account amministratore';
  end if;

  select role into target_role
  from public.profiles
  where id = target_user_id;

  if not found then
    raise exception 'Profilo non trovato';
  end if;
  if target_role = 'admin' then
    raise exception 'Non è consentito cancellare un account amministratore';
  end if;

  -- Se il contratto non ha altri inquilini, lo conserva come storico terminato.
  update public.leases l
  set status = 'ended'
  where l.status = 'active'
    and exists (
      select 1 from public.lease_tenants lt
      where lt.lease_id = l.id and lt.tenant_id = target_user_id
    )
    and not exists (
      select 1 from public.lease_tenants other_tenant
      where other_tenant.lease_id = l.id
        and other_tenant.tenant_id <> target_user_id
    );

  -- profiles.id punta ad auth.users con ON DELETE CASCADE.
  delete from auth.users where id = target_user_id;
  if not found then
    raise exception 'Account di autenticazione non trovato';
  end if;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
