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
- Scheda per singolo inquilino con contratti, date, canone, storico mensile dei pagamenti e bollette riaddebitate.
- Ruoli Admin, Inquilino e Manutentore descritti nelle Impostazioni; cancellazioni amministrative protette da conferma digitata.
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

Valore stimato degli immobili e note amministrative sono conservati in una tabella separata, accessibile solo all'admin.

Non usare solo `localStorage` per documenti o accessi degli inquilini: i dati resterebbero nel solo browser dell’amministratore e non sarebbero protetti per utente.

## Avvio dell'app

L’app richiede Supabase per consentire l’accesso. Se URL e Publishable key non sono configurati, mostra le istruzioni di collegamento e non apre una sessione demo. I dati gestionali vengono caricati dal database solo dopo l’autenticazione.

## Configurazione multiutente sicura

### 1. Crea il progetto Supabase

1. Crea un progetto Supabase dedicato a Property Manager, separato da eventuali progetti di altre app. Per i dati, scegli **Central EU (Frankfurt)** e salva la password del database in un password manager; non inserirla nell’app.
2. In **SQL Editor**, incolla ed esegui tutto il file `supabase/schema.sql` una sola volta.
3. In **Authentication > Providers**, lascia attivo Email/Password.
4. Crea il tuo primo utente in **Authentication > Users**.
5. Nello SQL Editor esegui, sostituendo l’indirizzo:

```sql
update public.profiles
set role = 'admin'
where email = 'la-tua-email@example.com';
```

Questo è l’unico bootstrap manuale: nessun utente può auto-attribuirsi il ruolo di amministratore.

Se gli utenti erano già presenti in **Authentication > Users** prima dell’esecuzione dello schema, esegui anche `supabase/sync_existing_auth_users.sql`. Crea le schede mancanti come inquilini e non modifica i ruoli dei profili già esistenti. Verifica poi che l’account amministratore abbia `role = 'admin'`.

### 2. Pubblica la funzione di creazione utenti

La funzione `supabase/functions/admin-create-user/index.ts` consente al solo admin di creare un account inquilino o manutentore dall’app, con email e password iniziale.

Con Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref IL_TUO_PROJECT_REF
npx supabase functions deploy admin-create-user
```

La funzione usa le variabili protette già disponibili in Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Non inserire mai la service role key nel repository o in `config.js`.

### 2.1 Abilita la cancellazione sicura degli account

Per consentire all’Admin di cancellare un profilo inquilino anche da **Authentication**, esegui una volta il file `supabase/admin_delete_user.sql` nel SQL Editor del progetto. La funzione rifiuta la cancellazione di un account Admin e conserva lo storico dei canoni senza i dati personali dell’inquilino.

### 3. Inserisci la configurazione pubblica dell’app

In Supabase apri **Connect** oppure **Project Settings > API Keys** e copia il Project URL e la **Publishable key** (`sb_publishable_...`). Poi modifica `config.js`:

```js
window.PROPERTY_MANAGER_CONFIG = {
  supabaseUrl: "https://TUO-PROGETTO.supabase.co",
  supabasePublishableKey: "sb_publishable_...",
  appName: "Property Manager"
};
```

La Publishable key è destinata al frontend; lo schema abilita RLS e nega l'accesso anonimo ai dati. Non inserire mai una Secret key, una `service_role` key o la password del database in `config.js` o in GitHub. Dopo il deploy, gli utenti accedono con le credenziali già registrate in Supabase Auth.

### 4. Pubblica su GitHub Pages

1. Nell’account `albertosicoli-bit`, carica i file dell’app nella root del repository `Gestionale.Immobiliare`.
2. In **Settings > Pages**, seleziona `Deploy from a branch` → `main` → `/ (root)`.
3. L’indirizzo sarà:

```text
https://albertosicoli-bit.github.io/Gestionale.Immobiliare/
```

GitHub Pages rende pubblico il sito; il repository contiene solo il frontend. Dati e documenti restano su Supabase, con accessi controllati dal database e dallo Storage privato.

### 5. Importa il file Excel

Accedi alla piattaforma con un account **Admin** e apri **Impostazioni > Carica dati da Excel**. Seleziona il file `Verifica-immobili-Proprieta-Papa.xlsx`: l’anteprima indica quali righe sono pronte, già presenti o da completare. Solo dopo la conferma i dati vengono scritti in Supabase; il file Excel viene letto nel browser e non viene caricato.

Prima dell’importazione:

1. In **Import immobili**, completa nome, indirizzo, comune, tipologia e stato; imposta **Sì** in **Decisione importazione**.
2. In **Utenze e bollette**, per ogni utenza da importare conferma l’immobile, l’intestatario (`owner` o `tenant`), il riaddebito (`TRUE` o `FALSE`) e imposta **Sì**.
3. Per ogni bolletta da importare imposta **Sì** e conferma che immobile, utenza, periodo, importo e stato siano corretti. L’utenza deve essere già presente o selezionata per l’importazione.
4. Verifica il riepilogo nell’app e premi **Importa**.

Le righe incomplete, le associazioni ambigue e i duplicati vengono saltati. Puoi caricare di nuovo il file dopo averlo corretto: gli immobili con lo stesso nome/indirizzo/comune, le utenze equivalenti e le bollette con stessa utenza/periodo/importo non vengono reinseriti. Le bollette caricano i soli dati strutturati, non i PDF originali. **Dati economici aggregati, spese “General”, proposte di quote, contratti e inquilini** restano nel file: mancano date, collegamenti o campi sufficienti per registrarli correttamente nella piattaforma.

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
- Area manutentore in sola lettura per gli interventi assegnati.
