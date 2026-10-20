-- Aggiunge una nota facoltativa a ogni rata. Eseguibile anche se la colonna esiste già.
alter table public.rent_payments
  add column if not exists note text;
