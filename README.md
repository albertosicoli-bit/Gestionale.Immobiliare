# Property Manager

PWA per gestire un piccolo o medio portafoglio immobiliare: una scheda per ogni immobile, contratti con più inquilini, canoni, utenze, documenti, mutui, conto economico e manutenzioni.

## Cosa è già incluso

- Dashboard con immobili, canoni attesi, entrate, uscite e attività da seguire.
- Stato immobile: **fittata**, **sfitta**, **personale** o **in manutenzione**.
- Scheda dell’immobile con:
  - contratti e più inquilini;
  - canoni mensili e contabili;
  - utenze intestate al proprietario o agli inquilini;
  - bollette, mutuo, documenti e manutenzioni;
  - conto economico per singola casa.
- Rubrica di elettricisti, idraulici, muratori e altri fornitori, con intervento, attività svolta e costo.
- Portale inquilino: visualizza solo la propria abitazione, carica la contabile e vede esclusivamente le sezioni abilitate dall’amministratore.
- Permessi per ogni inquilino e immobile: documenti, utenze, manutenzioni e upload contabile.
- Esportazione CSV e installazione PWA su computer o telefono.

## Architettura corretta

GitHub Pages ospita il frontend PWA. Per login, dati condivisi e documenti privati serve Supabase:

| Componente | Dove | Perché |
|---|---|---|
| App e interfaccia | GitHub Pages | Gratuita, veloce e installabile |
| Login e ruoli | Supabase Auth | Account distinti per admin e inquilini |
| Dati | Supabase PostgreSQL | Immobili, contratti, movimenti e permessi |
| File | Supabase Storage privato | Contratti, bollette e contabili non pubblici |

Non usare solo `localStorage` per documenti o accessi degli inquilini: i dati resterebbero nel solo browser dell’amministratore e non sarebbero protetti per utente.

## Avvio immediato: demo locale

Apri `index.html` con un server statico oppure pubblica il progetto su GitHub Pages senza configurare Supabase. L’app partirà in **modalità demo locale** e permetterà di provare tutti i flussi; i dati resteranno solo nel browser in uso.

## Configurazione multiutente sicura

### 1. Crea il progetto Supabase

1. Crea un nuovo progetto su [Supabase](https://supabase.com/).
2. In **SQL Editor**, incolla ed esegui tutto il file `supabase/schema.sql`.
3. In **Authentication > Providers**, lascia attivo Email/Password.
4. Crea il tuo primo utente in **Authentication > Users**.
5. Nello SQL Editor esegui, sostituendo l’indirizzo:

```sql
update public.profiles
set role = 'admin'
where email = 'la-tua-email@example.com';
```

Questo è l’unico bootstrap manuale: nessun utente può auto-attribuirsi il ruolo di amministratore.

### 2. Pubblica la funzione di creazione utenti

La funzione `supabase/functions/admin-create-user/index.ts` consente al solo admin di creare un account inquilino o manutentore dall’app, con email e password iniziale.

Con Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref IL_TUO_PROJECT_REF
npx supabase functions deploy admin-create-user
```

La funzione usa le variabili protette già disponibili in Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Non inserire mai la service role key nel repository o in `config.js`.

### 3. Inserisci la configurazione pubblica dell’app

In Supabase vai in **Project Settings > API** e copia Project URL e la chiave `anon` pubblica. Poi modifica `config.js`:

```js
window.PROPERTY_MANAGER_CONFIG = {
  supabaseUrl: "https://TUO-PROGETTO.supabase.co",
  supabaseAnonKey: "LA_TUA_CHIAVE_ANON",
  appName: "Property Manager"
};
```

La chiave `anon` è pensata per essere presente nel frontend. La sicurezza effettiva è garantita dalle policy RLS presenti nello schema SQL.

### 4. Pubblica su GitHub Pages

1. Crea un repository, ad esempio `property-manager`, nell’account `albertosicoli-bit`.
2. Carica tutti i file di questa cartella nella root del repository.
3. In **Settings > Pages**, seleziona `Deploy from a branch` → `main` → `/ (root)`.
4. L’indirizzo sarà:

```text
https://albertosicoli-bit.github.io/property-manager/
```

Se il repository deve restare privato, GitHub Pages pubblico non è la scelta corretta: in quel caso usa un hosting con controllo accessi. Anche con Pages pubblico, però, dati e documenti restano protetti nel backend perché non sono nel repository.

## Ruoli e visibilità

| Ruolo | Può vedere / fare |
|---|---|
| Admin | Tutto: patrimonio, mutui, conto economico, documenti, utenti e impostazioni |
| Inquilino | Solo immobili e dati abilitati per il suo profilo; può caricare la contabile se consentito |
| Manutentore | Profilo professionale e, nelle estensioni successive, solo interventi assegnati |

Per ogni inquilino scegli dall’immobile se mostrare documenti, utenze, manutenzioni e se consentire il caricamento della contabile. Il mutuo e l’intero conto economico non vengono mai esposti al portale inquilino.

## Struttura dei dati

```text
Immobile
 ├── Contratti
 │    └── Uno o più inquilini
 ├── Canoni e contabili
 ├── Utenze e bollette
 ├── Documenti
 ├── Mutuo
 ├── Entrate e uscite
 └── Manutenzioni → manutentore → attività e costo
```

## Controlli prima dell’uso reale

1. Accedi come admin e crea un immobile di prova.
2. Crea un inquilino, collegalo al contratto e definisci i permessi.
3. Accedi da una finestra anonima con le credenziali dell’inquilino.
4. Verifica che non veda mutui, dati economici completi o altri immobili.
5. Carica una contabile e verifica che l’admin la veda.
6. Solo dopo carica contratti e documenti reali.

## Sviluppi già predisposti

- Inviti via email e reset password autonomo.
- Alert sulle scadenze (canoni, mutui, contratti, bollette e manutenzioni).
- PDF mensile per ciascun immobile.
- Collegamento a contabilità/gestione fiscale.
- Area manutentore con chiusura dell’intervento e caricamento fattura.
