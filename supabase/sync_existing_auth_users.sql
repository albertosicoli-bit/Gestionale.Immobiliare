-- Crea il profilo gestionale per gli account Supabase già registrati
-- prima dell'attivazione del trigger handle_new_user.
-- Gli utenti senza profilo ricevono il ruolo tenant; i ruoli già assegnati restano invariati.
insert into public.profiles (id, role, email, display_name, phone)
select
  u.id,
  'tenant',
  u.email,
  coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), nullif(split_part(u.email, '@', 1), ''), 'Utente'),
  u.raw_user_meta_data ->> 'phone'
from auth.users as u
on conflict (id) do nothing;
