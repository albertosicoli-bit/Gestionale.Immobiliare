(() => {
  "use strict";

  const CONFIG = window.PROPERTY_MANAGER_CONFIG || {};
  const APP_NAME = CONFIG.appName || "Property Manager";
  const STORAGE_KEY = "propertyManagerStateV1";
  const app = document.querySelector("#app");
  const dialog = document.querySelector("#app-dialog");
  const toastRegion = document.querySelector("#toast-region");

  let supabaseClient = null;
  const supabasePublicKey = CONFIG.supabasePublishableKey || CONFIG.supabaseAnonKey;
  if (CONFIG.supabaseUrl && supabasePublicKey && window.supabase?.createClient) {
    supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, supabasePublicKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }

  const formatter = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });

  const state = {
    mode: null,
    activeView: "dashboard",
    selectedPropertyId: null,
    propertyTab: "overview",
    propertyFilter: "all",
    propertySearch: "",
    demoTenantId: "tenant-demo-1",
    sessionUser: null,
    profile: null,
    loading: false,
    data: loadData()
  };

  function newId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
  }

  function isoMonth(offset = 0) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() + offset);
    return date.toISOString().slice(0, 7);
  }

  function dateISO(offset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  function demoData() {
    const month = isoMonth();
    const lastMonth = isoMonth(-1);
    return {
      version: 1,
      properties: [
        {
          id: "property-demo-1",
          name: "Appartamento Centro",
          address: "Via esempio 24",
          city: "Napoli",
          postal_code: "80100",
          type: "Appartamento",
          status: "rented",
          estimated_value: 225000,
          notes: "Unità a reddito. Dati di esempio modificabili o eliminabili.",
          created_at: dateISO(-240)
        },
        {
          id: "property-demo-2",
          name: "Bilocale Parco",
          address: "Via esempio 8",
          city: "Aversa",
          postal_code: "81031",
          type: "Bilocale",
          status: "vacant",
          estimated_value: 155000,
          notes: "Da preparare per la prossima locazione.",
          created_at: dateISO(-210)
        },
        {
          id: "property-demo-3",
          name: "Casa personale",
          address: "Via esempio 11",
          city: "Napoli",
          postal_code: "80121",
          type: "Abitazione",
          status: "personal",
          estimated_value: 430000,
          notes: "Uso personale.",
          created_at: dateISO(-120)
        }
      ],
      profiles: [
        {
          id: "tenant-demo-1",
          role: "tenant",
          display_name: "Giulia Rossi",
          username: "giulia.rossi",
          email: "giulia.rossi@example.com",
          phone: "+39 333 0000000"
        },
        {
          id: "tenant-demo-2",
          role: "tenant",
          display_name: "Luca Bianchi",
          username: "luca.bianchi",
          email: "luca.bianchi@example.com",
          phone: "+39 333 0000001"
        }
      ],
      leases: [
        {
          id: "lease-demo-1",
          property_id: "property-demo-1",
          tenant_ids: ["tenant-demo-1", "tenant-demo-2"],
          monthly_rent: 950,
          deposit: 1900,
          due_day: 5,
          start_date: dateISO(-210),
          end_date: dateISO(155),
          status: "active",
          contract_reference: "Contratto demo 01/2026"
        }
      ],
      rent_payments: [
        {
          id: "payment-demo-current",
          property_id: "property-demo-1",
          lease_id: "lease-demo-1",
          tenant_id: "tenant-demo-1",
          period: month,
          due_date: `${month}-05`,
          amount_due: 950,
          amount_paid: 0,
          status: "pending",
          receipt_name: ""
        },
        {
          id: "payment-demo-last",
          property_id: "property-demo-1",
          lease_id: "lease-demo-1",
          tenant_id: "tenant-demo-1",
          period: lastMonth,
          due_date: `${lastMonth}-05`,
          paid_at: `${lastMonth}-03`,
          amount_due: 950,
          amount_paid: 950,
          status: "paid",
          receipt_name: "bonifico_canone.pdf"
        }
      ],
      utility_accounts: [
        {
          id: "utility-demo-1",
          property_id: "property-demo-1",
          kind: "Luce",
          provider: "Gestore energia",
          holder: "owner",
          recharged_to_tenant: true,
          contract_code: "POD demo",
          notes: "Il proprietario anticipa e riaddebita."
        },
        {
          id: "utility-demo-2",
          property_id: "property-demo-1",
          kind: "Gas",
          provider: "Gestore gas",
          holder: "tenant",
          recharged_to_tenant: false,
          contract_code: "PDR demo",
          notes: "Intestata agli inquilini."
        },
        {
          id: "utility-demo-3",
          property_id: "property-demo-3",
          kind: "Condominio",
          provider: "Amministrazione condominio",
          holder: "owner",
          recharged_to_tenant: false,
          contract_code: "",
          notes: "Spese personali."
        }
      ],
      utility_bills: [
        {
          id: "bill-demo-1",
          utility_id: "utility-demo-1",
          property_id: "property-demo-1",
          period: month,
          due_date: dateISO(10),
          amount: 86,
          status: "pending",
          document_name: "bolletta_luce.pdf"
        }
      ],
      mortgages: [
        {
          id: "mortgage-demo-1",
          property_id: "property-demo-3",
          lender: "Banca demo",
          original_amount: 210000,
          remaining_amount: 172400,
          monthly_payment: 842,
          rate: 2.85,
          due_day: 1,
          end_date: "2048-05-01"
        }
      ],
      financial_entries: [
        {
          id: "finance-demo-1",
          property_id: "property-demo-1",
          direction: "income",
          category: "Canone di locazione",
          amount: 950,
          date: `${lastMonth}-03`,
          status: "paid",
          description: "Canone del mese precedente"
        },
        {
          id: "finance-demo-2",
          property_id: "property-demo-1",
          direction: "expense",
          category: "Condominio",
          amount: 115,
          date: `${month}-02`,
          status: "paid",
          description: "Quota condominiale"
        },
        {
          id: "finance-demo-3",
          property_id: "property-demo-3",
          direction: "expense",
          category: "Rata mutuo",
          amount: 842,
          date: `${month}-01`,
          status: "paid",
          description: "Rata mensile"
        }
      ],
      documents: [
        {
          id: "document-demo-1",
          property_id: "property-demo-1",
          category: "Contratto di locazione",
          name: "contratto_locazione.pdf",
          visible_to_tenant: true,
          uploaded_at: dateISO(-200),
          uploaded_by: "admin"
        },
        {
          id: "document-demo-2",
          property_id: "property-demo-1",
          category: "Verbale consegna",
          name: "verbale_consegna.pdf",
          visible_to_tenant: true,
          uploaded_at: dateISO(-196),
          uploaded_by: "admin"
        },
        {
          id: "document-demo-3",
          property_id: "property-demo-3",
          category: "Mutuo",
          name: "piano_ammortamento.pdf",
          visible_to_tenant: false,
          uploaded_at: dateISO(-80),
          uploaded_by: "admin"
        }
      ],
      service_providers: [
        {
          id: "provider-demo-1",
          display_name: "Marco Esposito",
          company_name: "ME Impianti",
          category: "Elettricista",
          email: "marco@example.com",
          phone: "+39 333 1111111",
          notes: "Disponibile per interventi urgenti."
        },
        {
          id: "provider-demo-2",
          display_name: "Raffaele Russo",
          company_name: "Idra Service",
          category: "Idraulico",
          email: "raffaele@example.com",
          phone: "+39 333 2222222",
          notes: ""
        }
      ],
      maintenance_jobs: [
        {
          id: "job-demo-1",
          property_id: "property-demo-1",
          provider_id: "provider-demo-1",
          title: "Verifica quadro elettrico",
          category: "Elettrico",
          priority: "normal",
          status: "scheduled",
          scheduled_date: dateISO(4),
          completed_date: "",
          total_cost: 0,
          notes: "Verifica interruttore differenziale."
        },
        {
          id: "job-demo-2",
          property_id: "property-demo-2",
          provider_id: "provider-demo-2",
          title: "Riparazione miscelatore",
          category: "Idraulico",
          priority: "high",
          status: "done",
          scheduled_date: dateISO(-8),
          completed_date: dateISO(-7),
          total_cost: 145,
          notes: "Sostituita cartuccia e guarnizione."
        }
      ],
      tenant_permissions: [
        {
          id: "permission-demo-1",
          property_id: "property-demo-1",
          tenant_id: "tenant-demo-1",
          show_documents: true,
          show_utilities: true,
          show_maintenance: false,
          allow_payment_upload: true,
          allow_utility_upload: false
        },
        {
          id: "permission-demo-2",
          property_id: "property-demo-1",
          tenant_id: "tenant-demo-2",
          show_documents: true,
          show_utilities: true,
          show_maintenance: false,
          allow_payment_upload: true,
          allow_utility_upload: false
        }
      ]
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1) return parsed;
      }
    } catch (error) {
      console.warn("Impossibile leggere i dati locali", error);
    }
    return demoData();
  }

  function persistData() {
    if (supabaseClient && state.sessionUser) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function resetDemo() {
    state.data = demoData();
    state.activeView = "dashboard";
    state.selectedPropertyId = null;
    state.propertyFilter = "all";
    state.propertySearch = "";
    persistData();
    render();
    toast("Dati demo ripristinati.");
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function money(value) {
    return formatter.format(Number(value || 0));
  }

  function decimal(value) {
    return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(Number(value || 0));
  }

  function dateLabel(value, options = { day: "2-digit", month: "short", year: "numeric" }) {
    if (!value) return "—";
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.valueOf())) return value;
    return new Intl.DateTimeFormat("it-IT", options).format(date);
  }

  function monthLabel(value) {
    if (!value) return "—";
    const [year, month] = value.split("-");
    return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(
      new Date(Number(year), Number(month) - 1, 1)
    );
  }

  function initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function statusLabel(status) {
    const labels = {
      rented: "Fittata",
      vacant: "Sfitta",
      personal: "Personale",
      maintenance: "In manutenzione",
      active: "Attivo",
      pending: "Da pagare",
      paid: "Pagato",
      partial: "Parziale",
      late: "In ritardo",
      scheduled: "Programmato",
      done: "Concluso",
      cancelled: "Annullato"
    };
    return labels[status] || status || "—";
  }

  function badge(status) {
    return `<span class="badge ${esc(status)}">${esc(statusLabel(status))}</span>`;
  }

  function getProperty(id) {
    return state.data.properties.find((property) => property.id === id);
  }

  function getProfile(id) {
    return state.data.profiles.find((profile) => profile.id === id);
  }

  function getLease(id) {
    return state.data.leases.find((lease) => lease.id === id);
  }

  function getActiveLeases(propertyId) {
    return state.data.leases.filter((lease) => lease.property_id === propertyId && lease.status === "active");
  }

  function getTenantsForProperty(propertyId) {
    const ids = getActiveLeases(propertyId).flatMap((lease) => lease.tenant_ids || []);
    return [...new Set(ids)].map(getProfile).filter(Boolean);
  }

  function getPrimaryLease(propertyId) {
    return getActiveLeases(propertyId)[0] || null;
  }

  function getPermissions(propertyId, tenantId) {
    return (
      state.data.tenant_permissions.find(
        (permission) => permission.property_id === propertyId && permission.tenant_id === tenantId
      ) || {
        property_id: propertyId,
        tenant_id: tenantId,
        show_documents: false,
        show_utilities: false,
        show_maintenance: false,
        allow_payment_upload: true,
        allow_utility_upload: false
      }
    );
  }

  function getMortgage(propertyId) {
    return state.data.mortgages.find((item) => item.property_id === propertyId) || null;
  }

  function getProvider(id) {
    return state.data.service_providers.find((provider) => provider.id === id);
  }

  function propertyRent(propertyId) {
    return getActiveLeases(propertyId).reduce((sum, lease) => sum + Number(lease.monthly_rent || 0), 0);
  }

  function propertyCurrentCosts(propertyId) {
    const current = isoMonth();
    return state.data.financial_entries
      .filter((entry) => entry.property_id === propertyId && entry.direction === "expense" && entry.date?.startsWith(current))
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }

  function totalFor(direction, month = null) {
    return state.data.financial_entries
      .filter((entry) => entry.direction === direction && (!month || entry.date?.startsWith(month)))
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }

  function expectedMonthlyRent() {
    return state.data.properties.reduce((sum, property) => sum + propertyRent(property.id), 0);
  }

  function tenantProperties(tenantId) {
    const propertyIds = state.data.leases
      .filter((lease) => lease.status === "active" && (lease.tenant_ids || []).includes(tenantId))
      .map((lease) => lease.property_id);
    return state.data.properties.filter((property) => propertyIds.includes(property.id));
  }

  function isDemo() {
    return !supabaseClient || !state.sessionUser;
  }

  function navItems() {
    return [
      { id: "dashboard", label: "Dashboard", icon: "⌂" },
      { id: "properties", label: "Immobili", icon: "▣" },
      { id: "finance", label: "Conto economico", icon: "€" },
      { id: "maintenance", label: "Manutenzioni", icon: "⌁" },
      { id: "people", label: "Persone", icon: "♙" },
      { id: "settings", label: "Impostazioni", icon: "⚙" }
    ];
  }

  function renderLogin() {
    const connected = Boolean(supabaseClient);
    document.title = `${APP_NAME} · Accesso`;
    app.innerHTML = `
      <main class="login-shell">
        <section class="login-visual" aria-label="Presentazione">
          <div class="brand brand-inverse">${brandMark()}<span>${esc(APP_NAME)}</span></div>
          <div class="login-copy">
            <p class="eyebrow">Gestionale immobiliare privato</p>
            <h1>Tieni insieme immobili, persone e numeri.</h1>
            <p>Una scheda per ogni proprietà, con contratti, inquilini, utenze, mutui, pagamenti e interventi sempre ordinati.</p>
            <div class="login-points">
              <div class="login-point"><strong>Portale inquilino</strong><span>Canoni, bollette e caricamento della contabile.</span></div>
              <div class="login-point"><strong>Conto economico</strong><span>Entrate, uscite e redditività per immobile.</span></div>
              <div class="login-point"><strong>Permessi granulari</strong><span>Decidi tu cosa ciascun utente può vedere.</span></div>
            </div>
          </div>
          <div class="login-foot">PWA installabile · Dati protetti con ruoli e permessi</div>
        </section>
        <section class="login-panel">
          <div class="login-card">
            <div class="brand">${brandMark()}<span>${esc(APP_NAME)}</span></div>
            <h2>Accedi al gestionale</h2>
            <p>${connected ? "Usa le credenziali che ti ha assegnato l’amministratore." : "La configurazione del backend non è ancora inserita: puoi esplorare subito il prototipo."}</p>
            ${connected ? renderLoginForm() : renderDemoLogin()}
          </div>
        </section>
      </main>`;
  }

  function renderLoginForm() {
    return `
      <form data-form="login" class="stack">
        <div class="field">
          <label for="login-email">Email</label>
          <input id="login-email" type="email" name="email" autocomplete="email" required placeholder="nome@email.it" />
        </div>
        <div class="field">
          <label for="login-password">Password</label>
          <input id="login-password" type="password" name="password" autocomplete="current-password" required placeholder="••••••••" />
        </div>
        <button class="button full" type="submit">Accedi</button>
      </form>
      <div class="info-banner"><span>🔒</span><span><strong>Accesso separato.</strong> Ogni inquilino visualizza esclusivamente le informazioni autorizzate per la propria abitazione.</span></div>
      <button class="button ghost full" data-action="demo-admin">Apri comunque la demo locale</button>`;
  }

  function renderDemoLogin() {
    return `
      <div class="info-banner"><span>◉</span><span><strong>Modalità demo locale.</strong> I dati inseriti ora restano solo su questo browser. Con Supabase avrai accessi reali, sincronizzazione e documenti privati.</span></div>
      <div class="demo-actions">
        <button class="button" data-action="demo-admin">Entra come admin</button>
        <button class="button secondary" data-action="demo-tenant">Vedi area inquilino</button>
      </div>
      <div class="or">oppure</div>
      <button class="button ghost full" data-action="show-architecture">Vedi come sarà collegata</button>`;
  }

  function brandMark() {
    return `<span class="brand-mark" aria-hidden="true">⌂</span>`;
  }

  function renderShell() {
    const items = navItems();
    const page = pageMeta();
    document.title = `${APP_NAME} · ${page.title}`;
    app.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand">${brandMark()}<span>${esc(APP_NAME)}</span></div>
          <div class="sidebar-section">Gestione</div>
          <nav class="nav-list" aria-label="Navigazione principale">
            ${items.map((item) => navButton(item)).join("")}
          </nav>
          <div class="sidebar-spacer"></div>
          <div class="sidebar-mode">
            <small>${isDemo() ? "MODALITÀ LOCALE" : "ACCOUNT CONNESSO"}</small>
            <strong>${esc(state.profile?.display_name || "Proprietario")}</strong>
          </div>
          <div class="sidebar-footer"><span class="online-dot"></span><span>${isDemo() ? "Dati nel browser" : "Dati sincronizzati"}</span></div>
        </aside>
        <main class="app-main">
          <header class="topbar">
            <div>
              <h1 class="page-title">${esc(page.title)}</h1>
              <p class="page-subtitle">${esc(page.subtitle)}</p>
            </div>
            <div class="topbar-actions">
              <button class="button secondary" data-action="export-csv">⇩ Esporta dati</button>
              <button class="button secondary icon-button" title="Aggiorna" aria-label="Aggiorna" data-action="refresh">↻</button>
              ${page.action ? `<button class="button" data-action="${page.action}">${page.actionLabel}</button>` : ""}
            </div>
          </header>
          <section class="content" id="view-content"></section>
        </main>
        <nav class="mobile-nav" aria-label="Navigazione mobile">
          ${items.slice(0, 5).map((item) => mobileNavButton(item)).join("")}
        </nav>
      </div>`;
    renderView();
  }

  function navButton(item) {
    return `<button class="nav-button ${state.activeView === item.id ? "active" : ""}" data-action="navigate" data-view="${item.id}"><span class="nav-icon">${item.icon}</span>${esc(item.label)}</button>`;
  }

  function mobileNavButton(item) {
    return `<button class="${state.activeView === item.id ? "active" : ""}" data-action="navigate" data-view="${item.id}"><span>${item.icon}</span>${esc(item.label)}</button>`;
  }

  function pageMeta() {
    const meta = {
      dashboard: { title: "Buongiorno, Alberto", subtitle: "Panoramica del patrimonio e delle attività da seguire.", action: "add-property", actionLabel: "+ Nuovo immobile" },
      properties: { title: "Immobili", subtitle: "Schede, contratti, utenze, mutui e documenti.", action: "add-property", actionLabel: "+ Nuovo immobile" },
      property: { title: "Scheda immobile", subtitle: "Gestisci tutti i dati collegati a questa proprietà.", action: "edit-property", actionLabel: "Modifica immobile" },
      finance: { title: "Conto economico", subtitle: "Entrate e uscite per avere un quadro netto del portafoglio.", action: "add-financial", actionLabel: "+ Registra movimento" },
      maintenance: { title: "Manutenzioni", subtitle: "Fornitori, lavori eseguiti e costi di intervento.", action: "add-maintenance", actionLabel: "+ Nuovo intervento" },
      people: { title: "Persone", subtitle: "Inquilini e manutentori collegati alle proprietà.", action: "add-tenant", actionLabel: "+ Nuovo inquilino" },
      settings: { title: "Impostazioni e accessi", subtitle: "Connessione sicura, ruoli e gestione del prototipo.", action: null, actionLabel: "" }
    };
    return meta[state.activeView] || meta.dashboard;
  }

  function renderView() {
    const content = document.querySelector("#view-content");
    if (!content) return;
    const renderers = {
      dashboard: renderDashboard,
      properties: renderProperties,
      property: renderPropertyDetail,
      finance: renderFinance,
      maintenance: renderMaintenance,
      people: renderPeople,
      settings: renderSettings
    };
    content.innerHTML = (renderers[state.activeView] || renderDashboard)();
  }

  function renderDashboard() {
    const properties = state.data.properties;
    const rented = properties.filter((property) => property.status === "rented").length;
    const vacant = properties.filter((property) => property.status === "vacant").length;
    const monthlyIncome = expectedMonthlyRent();
    const month = isoMonth();
    const expense = totalFor("expense", month);
    const incomeRecorded = totalFor("income", month);
    const upcoming = state.data.maintenance_jobs
      .filter((job) => job.status !== "done" && job.status !== "cancelled")
      .sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)))
      .slice(0, 4);
    const payments = state.data.rent_payments
      .filter((payment) => payment.period === month)
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    const propertyRows = properties.slice(0, 5);
    return `
      <div class="kpi-grid">
        ${kpiCard("Immobili", properties.length, `${rented} fittati · ${vacant} sfitti`, "⌂")}
        ${kpiCard("Canoni attesi", money(monthlyIncome), "al mese, contratti attivi", "↗")}
        ${kpiCard("Entrate registrate", money(incomeRecorded), `nel mese di ${monthLabel(month)}`, "✓")}
        ${kpiCard("Uscite registrate", money(expense), `nel mese di ${monthLabel(month)}`, "↘")}
        ${kpiCard("Saldo del mese", money(incomeRecorded - expense), "movimenti effettivamente segnati", "◒", "highlight")}
      </div>
      <div class="page-grid">
        <section class="panel">
          <div class="panel-head"><div><h2>Stato degli immobili</h2><p>Apri una scheda per gestire contratti, documenti e costi.</p></div><button class="button ghost small" data-action="navigate" data-view="properties">Vedi tutti →</button></div>
          <div class="property-list">
            ${propertyRows.map((property) => propertyRow(property)).join("") || empty("⌂", "Nessun immobile", "Aggiungi il primo immobile per iniziare.")}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>Portafoglio</h2><p>Distribuzione attuale.</p></div></div>
          ${occupancyPanel(properties, rented, vacant)}
        </section>
      </div>
      <div class="page-grid">
        <section class="panel">
          <div class="panel-head"><div><h2>Canoni del mese</h2><p>Contabili caricate dagli inquilini e stato di verifica.</p></div><button class="button ghost small" data-action="navigate" data-view="finance">Conto economico →</button></div>
          <div class="property-list">
            ${payments.length ? payments.map(paymentRow).join("") : empty("€", "Nessun canone pianificato", "I canoni compariranno qui quando associ un contratto attivo.")}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>Da seguire</h2><p>Interventi e scadenze vicine.</p></div><button class="button ghost small" data-action="navigate" data-view="maintenance">Manutenzioni →</button></div>
          <div class="task-list">
            ${upcoming.length ? upcoming.map(taskRow).join("") : empty("✓", "Tutto in ordine", "Non ci sono interventi aperti.")}
          </div>
        </section>
      </div>`;
  }

  function kpiCard(label, value, note, icon, extraClass = "") {
    return `<article class="kpi-card ${extraClass}"><div class="kpi-label"><span>${esc(label)}</span><span>${icon}</span></div><div class="kpi-value">${esc(value)}</div><div class="kpi-note">${esc(note)}</div></article>`;
  }

  function occupancyPanel(properties, rented, vacant) {
    const personal = properties.filter((property) => property.status === "personal").length;
    const total = properties.length || 1;
    const rentedPercent = Math.round((rented / total) * 100);
    return `<div class="donut-layout"><div class="donut"><span class="donut-label">${rentedPercent}%</span></div><div class="legend"><div class="legend-item"><span class="legend-label"><i class="legend-dot" style="background:#118a7e"></i>Fittati</span><strong>${rented}</strong></div><div class="legend-item"><span class="legend-label"><i class="legend-dot" style="background:#e8ad2b"></i>Sfitti</span><strong>${vacant}</strong></div><div class="legend-item"><span class="legend-label"><i class="legend-dot" style="background:#d9e3e8"></i>Personali/altri</span><strong>${personal}</strong></div></div></div>`;
  }

  function propertyRow(property) {
    const tenants = getTenantsForProperty(property.id);
    return `<article class="property-row">
      <button class="property-title" data-action="open-property" data-property-id="${property.id}"><span class="property-avatar">⌂</span><span><strong>${esc(property.name)}</strong><span>${esc(property.address)}, ${esc(property.city)}</span></span></button>
      <span class="tenant-col">${badge(property.status)}</span>
      <span class="rent-col row-number">${property.status === "rented" ? money(propertyRent(property.id)) : "—"}</span>
      <span class="row-muted">${tenants.length ? esc(tenants.map((tenant) => tenant.display_name.split(" ")[0]).join(", ")) : "Nessun inquilino"}</span>
      <button class="row-action" aria-label="Apri ${esc(property.name)}" data-action="open-property" data-property-id="${property.id}">›</button>
    </article>`;
  }

  function paymentRow(payment) {
    const property = getProperty(payment.property_id);
    const tenant = getProfile(payment.tenant_id);
    return `<article class="property-row">
      <div class="property-title"><span class="property-avatar">€</span><span><strong>${esc(property?.name || "Immobile")}</strong><span>${esc(tenant?.display_name || "Inquilino")} · ${esc(monthLabel(payment.period))}</span></span></div>
      <span class="tenant-col">${badge(payment.status)}</span>
      <span class="rent-col row-number">${money(payment.amount_due)}</span>
      <span class="row-muted">Scad. ${dateLabel(payment.due_date, { day: "2-digit", month: "short" })}</span>
      <button class="row-action" data-action="open-payment" data-payment-id="${payment.id}" aria-label="Gestisci pagamento">›</button>
    </article>`;
  }

  function taskRow(job) {
    const property = getProperty(job.property_id);
    const date = new Date(`${job.scheduled_date}T12:00:00`);
    const day = Number.isNaN(date.valueOf()) ? "—" : date.getDate();
    const month = Number.isNaN(date.valueOf()) ? "" : new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date);
    return `<article class="task-row"><div class="task-date"><strong>${day}</strong>${esc(month)}</div><div class="task-copy"><strong>${esc(job.title)}</strong><span>${esc(property?.name || "Immobile")} · ${esc(getProvider(job.provider_id)?.display_name || "Fornitore non assegnato")}</span></div>${badge(job.status)}</article>`;
  }

  function renderProperties() {
    const query = state.propertySearch.trim().toLowerCase();
    const properties = state.data.properties.filter((property) => {
      const matchingFilter = state.propertyFilter === "all" || property.status === state.propertyFilter;
      const haystack = `${property.name} ${property.address} ${property.city} ${property.type}`.toLowerCase();
      return matchingFilter && (!query || haystack.includes(query));
    });
    return `
      <div class="toolbar">
        <label class="search"><span>⌕</span><input data-input="property-search" value="${esc(state.propertySearch)}" placeholder="Cerca per nome, città o indirizzo" /></label>
        <div class="filter-row">
          ${filterChip("all", "Tutti")}${filterChip("rented", "Fittati")}${filterChip("vacant", "Sfitti")}${filterChip("personal", "Personali")}
        </div>
      </div>
      ${properties.length ? `<div class="card-grid">${properties.map(propertyCard).join("")}</div>` : empty("⌂", "Nessun immobile trovato", "Modifica i filtri oppure aggiungi una nuova proprietà.")}`;
  }

  function filterChip(value, label) {
    return `<button class="filter-chip ${state.propertyFilter === value ? "active" : ""}" data-action="property-filter" data-filter="${value}">${esc(label)}</button>`;
  }

  function propertyCard(property) {
    const tenants = getTenantsForProperty(property.id);
    const cost = propertyCurrentCosts(property.id);
    return `<article class="property-card">
      <div class="card-top"><div><h2 class="card-property-title">${esc(property.name)}</h2><p class="card-address">${esc(property.address)}, ${esc(property.city)}</p></div>${badge(property.status)}</div>
      <div class="card-metrics"><div class="card-metric"><span>Canone mensile</span><strong>${property.status === "rented" ? money(propertyRent(property.id)) : "—"}</strong></div><div class="card-metric"><span>Costi del mese</span><strong>${money(cost)}</strong></div></div>
      <div class="card-bottom"><div class="avatar-stack">${tenants.length ? tenants.map((tenant) => `<span class="avatar" title="${esc(tenant.display_name)}">${esc(initials(tenant.display_name))}</span>`).join("") : `<span class="row-muted">Nessun inquilino</span>`}</div><button class="button secondary small" data-action="open-property" data-property-id="${property.id}">Apri scheda</button></div>
    </article>`;
  }

  function renderPropertyDetail() {
    const property = getProperty(state.selectedPropertyId);
    if (!property) {
      state.activeView = "properties";
      return renderProperties();
    }
    const tabs = [
      ["overview", "Panoramica"], ["tenants", "Inquilini e contratto"], ["finance", "Conto economico"], ["utilities", "Utenze"], ["documents", "Documenti"], ["mortgage", "Mutuo"], ["maintenance", "Manutenzioni"], ["permissions", "Permessi"]
    ];
    return `
      <section class="property-hero">
        <div><p class="eyebrow">${esc(property.type || "Immobile")}</p><h2>${esc(property.name)}</h2><p>${esc(property.address)}, ${esc(property.postal_code || "")} ${esc(property.city)}</p><div class="property-hero-meta">${badge(property.status)}<span class="hero-pill">Valore stimato ${money(property.estimated_value)}</span><span class="hero-pill">${getTenantsForProperty(property.id).length} inquilino/i</span></div></div>
        <button class="button secondary" data-action="navigate" data-view="properties">← Immobili</button>
      </section>
      <nav class="property-tabs" aria-label="Sezioni della scheda immobile">${tabs.map(([id, label]) => `<button class="property-tab ${state.propertyTab === id ? "active" : ""}" data-action="property-tab" data-tab="${id}">${label}</button>`).join("")}</nav>
      ${renderPropertyTab(property)}`;
  }

  function renderPropertyTab(property) {
    const tab = state.propertyTab;
    if (tab === "tenants") return renderPropertyTenants(property);
    if (tab === "finance") return renderPropertyFinance(property);
    if (tab === "utilities") return renderPropertyUtilities(property);
    if (tab === "documents") return renderPropertyDocuments(property);
    if (tab === "mortgage") return renderPropertyMortgage(property);
    if (tab === "maintenance") return renderPropertyMaintenance(property);
    if (tab === "permissions") return renderPropertyPermissions(property);
    return renderPropertyOverview(property);
  }

  function renderPropertyOverview(property) {
    const mortgage = getMortgage(property.id);
    const lease = getPrimaryLease(property.id);
    const docs = state.data.documents.filter((document) => document.property_id === property.id).length;
    const utilityCount = state.data.utility_accounts.filter((utility) => utility.property_id === property.id).length;
    return `<div class="stack">
      <section class="detail-grid">
        <article class="data-tile"><span>Canone attivo</span><strong>${property.status === "rented" ? money(propertyRent(property.id)) : "—"}</strong></article>
        <article class="data-tile"><span>Costi nel mese</span><strong>${money(propertyCurrentCosts(property.id))}</strong></article>
        <article class="data-tile"><span>Mutuo residuo</span><strong>${mortgage ? money(mortgage.remaining_amount) : "Nessun mutuo"}</strong></article>
        <article class="data-tile"><span>Documenti</span><strong>${docs} file</strong></article>
        <article class="data-tile"><span>Utenze censite</span><strong>${utilityCount}</strong></article>
        <article class="data-tile"><span>Scadenza contratto</span><strong>${lease ? dateLabel(lease.end_date) : "—"}</strong></article>
      </section>
      <div class="split">
        <section class="panel pad"><div class="section-head"><div><h2>Note sull’immobile</h2><p>Informazioni ad uso amministrativo.</p></div></div><p style="margin:0;color:#557082;font-size:.84rem;line-height:1.65">${esc(property.notes || "Nessuna nota inserita.")}</p></section>
        <section class="panel pad"><div class="section-head"><div><h2>Azioni rapide</h2><p>Aggiorna gli elementi più frequenti.</p></div></div><div class="stack"><button class="button secondary full" data-action="add-document" data-property-id="${property.id}">⇧ Carica documento</button><button class="button secondary full" data-action="add-utility" data-property-id="${property.id}">+ Registra utenza/bolletta</button><button class="button secondary full" data-action="add-maintenance" data-property-id="${property.id}">+ Registra intervento</button></div></section>
      </div>
    </div>`;
  }

  function renderPropertyTenants(property) {
    const leases = state.data.leases.filter((lease) => lease.property_id === property.id);
    return `<section class="panel"><div class="panel-head"><div><h2>Inquilini e contratti</h2><p>Una locazione può contenere più inquilini, ognuno con il proprio profilo di accesso.</p></div><div class="panel-actions"><button class="button secondary small" data-action="add-tenant" data-property-id="${property.id}">+ Collega inquilino</button><button class="button small" data-action="add-payment" data-property-id="${property.id}">+ Canone</button></div></div>
      ${leases.length ? leases.map((lease) => leaseCard(lease)).join("") : empty("♙", "Nessun contratto attivo", "Collega un inquilino per creare il primo contratto.")}
    </section>`;
  }

  function leaseCard(lease) {
    const tenants = (lease.tenant_ids || []).map(getProfile).filter(Boolean);
    return `<div style="padding:0 20px 20px"><div class="panel pad" style="box-shadow:none;border-radius:14px"><div class="section-head"><div><h2>${esc(lease.contract_reference || "Contratto di locazione")}</h2><p>${dateLabel(lease.start_date)} — ${dateLabel(lease.end_date)} · Scadenza canone giorno ${esc(lease.due_day)}</p></div>${badge(lease.status === "active" ? "active" : lease.status)}</div><div class="detail-grid"><article class="data-tile"><span>Canone mensile</span><strong>${money(lease.monthly_rent)}</strong></article><article class="data-tile"><span>Deposito</span><strong>${money(lease.deposit)}</strong></article><article class="data-tile"><span>Inquilini</span><strong>${tenants.length}</strong></article></div><div class="detail-list" style="margin-top:13px">${tenants.map((tenant) => `<div class="detail-list-row"><span><strong style="text-align:left">${esc(tenant.display_name)}</strong><br><small>${esc(tenant.email || tenant.username || "")}</small></span><span>${esc(tenant.phone || "—")}</span></div>`).join("")}</div></div></div>`;
  }

  function renderPropertyFinance(property) {
    const entries = state.data.financial_entries.filter((entry) => entry.property_id === property.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const income = entries.filter((entry) => entry.direction === "income").reduce((sum, entry) => sum + Number(entry.amount), 0);
    const expenses = entries.filter((entry) => entry.direction === "expense").reduce((sum, entry) => sum + Number(entry.amount), 0);
    return `<div class="stack"><section class="detail-grid"><article class="data-tile"><span>Entrate registrate</span><strong>${money(income)}</strong></article><article class="data-tile"><span>Uscite registrate</span><strong>${money(expenses)}</strong></article><article class="data-tile"><span>Saldo storico</span><strong>${money(income - expenses)}</strong></article></section><section class="panel"><div class="panel-head"><div><h2>Movimenti dell’immobile</h2><p>Canoni, rate, manutenzioni, condominio e altri costi.</p></div><button class="button small" data-action="add-financial" data-property-id="${property.id}">+ Movimento</button></div>${financeTable(entries)}</section></div>`;
  }

  function renderPropertyUtilities(property) {
    const utilities = state.data.utility_accounts.filter((utility) => utility.property_id === property.id);
    const bills = state.data.utility_bills.filter((bill) => bill.property_id === property.id).sort((a, b) => String(b.period).localeCompare(String(a.period)));
    return `<div class="stack"><section class="panel"><div class="panel-head"><div><h2>Utenze</h2><p>Indica chi è intestatario e se il costo viene riaddebitato agli inquilini.</p></div><button class="button small" data-action="add-utility" data-property-id="${property.id}">+ Utenza o bolletta</button></div>${utilities.length ? `<div class="table-wrap"><table><thead><tr><th>Utenza</th><th>Fornitore</th><th>Intestata a</th><th>Riaddebito</th></tr></thead><tbody>${utilities.map((utility) => `<tr><td><strong>${esc(utility.kind)}</strong><br><small>${esc(utility.contract_code || "")}</small></td><td>${esc(utility.provider || "—")}</td><td>${utility.holder === "owner" ? "Proprietario" : "Inquilino"}</td><td>${utility.recharged_to_tenant ? "Sì" : "No"}</td></tr>`).join("")}</tbody></table></div>` : empty("⚡", "Nessuna utenza censita", "Aggiungi luce, gas, acqua, condominio o altri servizi.")}</section><section class="panel"><div class="panel-head"><div><h2>Bollettini e scadenze</h2><p>Documenta le fatture anche quando il contratto non è intestato all’inquilino.</p></div></div>${bills.length ? `<div class="table-wrap"><table><thead><tr><th>Periodo</th><th>Utenza</th><th>Scadenza</th><th>Importo</th><th>Stato</th></tr></thead><tbody>${bills.map((bill) => `<tr><td>${esc(monthLabel(bill.period))}</td><td>${esc(state.data.utility_accounts.find((utility) => utility.id === bill.utility_id)?.kind || "Utenza")}</td><td>${dateLabel(bill.due_date)}</td><td class="number">${money(bill.amount)}</td><td>${badge(bill.status)}</td></tr>`).join("")}</tbody></table></div>` : empty("▤", "Nessuna bolletta", "Le nuove bollette saranno archiviate qui.")}</section></div>`;
  }

  function renderPropertyDocuments(property) {
    const docs = state.data.documents.filter((document) => document.property_id === property.id).sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)));
    return `<section class="panel"><div class="panel-head"><div><h2>Archivio documenti</h2><p>Contratti, verbali, bollette, mutui e documentazione di manutenzione.</p></div><button class="button small" data-action="add-document" data-property-id="${property.id}">⇧ Carica file</button></div>${docs.length ? `<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Categoria</th><th>Caricato</th><th>Visibilità inquilino</th></tr></thead><tbody>${docs.map((document) => `<tr><td><strong>${esc(document.name)}</strong></td><td>${esc(document.category)}</td><td>${dateLabel(document.uploaded_at)}</td><td>${document.visible_to_tenant ? badge("active") : "<span class=\"row-muted\">Solo admin</span>"}</td></tr>`).join("")}</tbody></table></div>` : empty("▤", "Archivio vuoto", "Carica il contratto o qualsiasi documento utile per la gestione.")}</section>`;
  }

  function renderPropertyMortgage(property) {
    const mortgage = getMortgage(property.id);
    if (!mortgage) return `<section class="panel">${empty("⌁", "Nessun mutuo registrato", "Puoi aggiungerlo dalla sezione mutuo quando attiveremo la configurazione completa del backend.")}</section>`;
    const paid = Math.max(0, Number(mortgage.original_amount) - Number(mortgage.remaining_amount));
    const percent = mortgage.original_amount ? Math.round((paid / mortgage.original_amount) * 100) : 0;
    return `<section class="panel pad"><div class="section-head"><div><h2>Mutuo</h2><p>${esc(mortgage.lender)} · scadenza ${dateLabel(mortgage.end_date)}</p></div></div><div class="detail-grid"><article class="data-tile"><span>Importo iniziale</span><strong>${money(mortgage.original_amount)}</strong></article><article class="data-tile"><span>Residuo</span><strong>${money(mortgage.remaining_amount)}</strong></article><article class="data-tile"><span>Rata mensile</span><strong>${money(mortgage.monthly_payment)}</strong></article><article class="data-tile"><span>Tasso</span><strong>${decimal(mortgage.rate)}%</strong></article><article class="data-tile"><span>Scadenza rata</span><strong>Giorno ${esc(mortgage.due_day)}</strong></article><article class="data-tile"><span>Capitale rimborsato</span><strong>${percent}%</strong></article></div></section>`;
  }

  function renderPropertyMaintenance(property) {
    const jobs = state.data.maintenance_jobs.filter((job) => job.property_id === property.id).sort((a, b) => String(b.scheduled_date).localeCompare(String(a.scheduled_date)));
    return `<section class="panel"><div class="panel-head"><div><h2>Interventi</h2><p>Ogni intervento conserva attività svolta, fornitore e costo.</p></div><button class="button small" data-action="add-maintenance" data-property-id="${property.id}">+ Intervento</button></div>${jobs.length ? maintenanceTable(jobs) : empty("⌁", "Nessun intervento", "Registra qui le chiamate a elettricisti, idraulici, muratori e altri manutentori.")}</section>`;
  }

  function renderPropertyPermissions(property) {
    const tenants = getTenantsForProperty(property.id);
    if (!tenants.length) return `<section class="panel">${empty("♙", "Nessun inquilino collegato", "Prima collega un inquilino o un contratto, poi potrai decidere cosa vede nel suo portale.")}</section>`;
    return `<section class="panel"><div class="panel-head"><div><h2>Visibilità del portale inquilino</h2><p>Questi permessi vengono applicati separatamente per ogni persona collegata all’immobile.</p></div></div><div style="padding:0 20px 20px" class="stack">${tenants.map((tenant) => permissionCard(property, tenant)).join("")}</div></section>`;
  }

  function permissionCard(property, tenant) {
    const permissions = getPermissions(property.id, tenant.id);
    return `<div class="panel pad" style="box-shadow:none;border-radius:14px"><div class="section-head"><div><h2>${esc(tenant.display_name)}</h2><p>${esc(tenant.email || tenant.username || "Profilo inquilino")}</p></div><button class="button secondary small" data-action="edit-permissions" data-property-id="${property.id}" data-tenant-id="${tenant.id}">Modifica</button></div><div class="permission-grid"><div class="permission"><span>${permissions.show_documents ? "✓" : "—"}</span><span><strong>Documenti</strong><span>Documenti abilitati</span></span></div><div class="permission"><span>${permissions.show_utilities ? "✓" : "—"}</span><span><strong>Utenze</strong><span>Bollettini e scadenze</span></span></div><div class="permission"><span>${permissions.show_maintenance ? "✓" : "—"}</span><span><strong>Interventi</strong><span>Stato manutenzioni</span></span></div><div class="permission"><span>${permissions.allow_payment_upload ? "✓" : "—"}</span><span><strong>Contabili</strong><span>Caricamento pagamento</span></span></div></div></div>`;
  }

  function renderFinance() {
    const month = isoMonth();
    const entries = [...state.data.financial_entries].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const income = totalFor("income", month);
    const costs = totalFor("expense", month);
    const scheduledRent = expectedMonthlyRent();
    return `<div class="kpi-grid"><article class="kpi-card"><div class="kpi-label"><span>Canoni attesi</span><span>↗</span></div><div class="kpi-value">${money(scheduledRent)}</div><div class="kpi-note">contratti attivi</div></article><article class="kpi-card"><div class="kpi-label"><span>Entrate mese</span><span>✓</span></div><div class="kpi-value">${money(income)}</div><div class="kpi-note">già registrate</div></article><article class="kpi-card"><div class="kpi-label"><span>Uscite mese</span><span>↘</span></div><div class="kpi-value">${money(costs)}</div><div class="kpi-note">già registrate</div></article><article class="kpi-card highlight"><div class="kpi-label"><span>Saldo mese</span><span>◒</span></div><div class="kpi-value">${money(income - costs)}</div><div class="kpi-note">movimenti effettivi</div></article><article class="kpi-card"><div class="kpi-label"><span>Valore stimato</span><span>⌂</span></div><div class="kpi-value">${money(state.data.properties.reduce((sum,p) => sum + Number(p.estimated_value || 0), 0))}</div><div class="kpi-note">portafoglio immobiliare</div></article></div><section class="panel" style="margin-top:20px"><div class="panel-head"><div><h2>Movimenti</h2><p>Inserisci ogni entrata e uscita; poi esporta un CSV per consulente o commercialista.</p></div><button class="button small" data-action="add-financial">+ Registra movimento</button></div>${financeTable(entries)}</section>`;
  }

  function financeTable(entries) {
    return entries.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Immobile</th><th>Categoria</th><th>Tipo</th><th>Importo</th><th>Stato</th></tr></thead><tbody>${entries.map((entry) => `<tr><td>${dateLabel(entry.date)}</td><td><strong>${esc(getProperty(entry.property_id)?.name || "Generale")}</strong></td><td>${esc(entry.category)}</td><td>${entry.direction === "income" ? "Entrata" : "Uscita"}</td><td class="number" style="color:${entry.direction === "income" ? "#087468" : "#b54d4d"}">${entry.direction === "income" ? "+" : "−"} ${money(entry.amount)}</td><td>${badge(entry.status || "paid")}</td></tr>`).join("")}</tbody></table></div>` : empty("€", "Nessun movimento", "Registra il primo costo o la prima entrata.");
  }

  function renderMaintenance() {
    const jobs = [...state.data.maintenance_jobs].sort((a, b) => String(b.scheduled_date).localeCompare(String(a.scheduled_date)));
    const providers = state.data.service_providers;
    return `<div class="split"><section class="panel"><div class="panel-head"><div><h2>Interventi</h2><p>Lavoro svolto, costo e fornitore rimangono collegati alla proprietà.</p></div><button class="button small" data-action="add-maintenance">+ Intervento</button></div>${jobs.length ? maintenanceTable(jobs) : empty("⌁", "Nessun intervento", "Quando chiami un manutentore, registra qui attività e preventivo.")}</section><section class="panel"><div class="panel-head"><div><h2>Rubrica manutentori</h2><p>Elettricisti, idraulici, muratori e altri professionisti.</p></div><button class="button secondary small" data-action="add-provider">+ Fornitore</button></div><div class="task-list">${providers.length ? providers.map(providerCard).join("") : empty("♙", "Rubrica vuota", "Aggiungi il primo manutentore.")}</div></section></div>`;
  }

  function maintenanceTable(jobs) {
    return `<div class="table-wrap"><table><thead><tr><th>Intervento</th><th>Immobile</th><th>Fornitore</th><th>Data</th><th>Costo</th><th>Stato</th></tr></thead><tbody>${jobs.map((job) => `<tr><td><strong>${esc(job.title)}</strong><br><small>${esc(job.category || "")}</small></td><td>${esc(getProperty(job.property_id)?.name || "—")}</td><td>${esc(getProvider(job.provider_id)?.display_name || "Non assegnato")}</td><td>${dateLabel(job.completed_date || job.scheduled_date)}</td><td class="number">${job.total_cost ? money(job.total_cost) : "—"}</td><td>${badge(job.status)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function providerCard(provider) {
    return `<article class="task-row"><span class="property-avatar">${esc(initials(provider.display_name))}</span><div class="task-copy"><strong>${esc(provider.display_name)}</strong><span>${esc(provider.category)}${provider.company_name ? ` · ${esc(provider.company_name)}` : ""}<br>${esc(provider.phone || provider.email || "")}</span></div></article>`;
  }

  function renderPeople() {
    const tenants = state.data.profiles.filter((profile) => profile.role === "tenant");
    const providers = state.data.service_providers;
    return `<div class="split"><section class="panel"><div class="panel-head"><div><h2>Inquilini</h2><p>Ogni inquilino può avere credenziali proprie e più persone possono condividere lo stesso contratto.</p></div><button class="button small" data-action="add-tenant">+ Nuovo inquilino</button></div>${tenants.length ? `<div class="table-wrap"><table><thead><tr><th>Inquilino</th><th>Immobile</th><th>Contatto</th><th>Profilo</th></tr></thead><tbody>${tenants.map((tenant) => { const properties = tenantProperties(tenant.id); return `<tr><td><strong>${esc(tenant.display_name)}</strong><br><small>@${esc(tenant.username || "utente")}</small></td><td>${properties.length ? properties.map((property) => esc(property.name)).join("<br>") : "—"}</td><td>${esc(tenant.phone || tenant.email || "—")}</td><td>${badge("active")}</td></tr>`; }).join("")}</tbody></table></div>` : empty("♙", "Nessun inquilino", "Crea un profilo e poi collegalo a un contratto.")}</section><section class="panel"><div class="panel-head"><div><h2>Manutentori</h2><p>Profili professionali riutilizzabili per ogni casa.</p></div><button class="button secondary small" data-action="add-provider">+ Fornitore</button></div><div class="task-list">${providers.length ? providers.map(providerCard).join("") : empty("⌁", "Nessun manutentore", "Aggiungi la tua rubrica di fiducia.")}</div></section></div>`;
  }

  function renderSettings() {
    return `<div class="split"><section class="panel pad"><div class="section-head"><div><h2>Stato della piattaforma</h2><p>La PWA funziona già come prototipo locale; il backend abilita il lavoro condiviso.</p></div></div><div class="detail-list"><div class="detail-list-row"><span>Modalità attuale</span><strong>${isDemo() ? "Demo locale" : "Backend collegato"}</strong></div><div class="detail-list-row"><span>Autenticazione</span><strong>${supabaseClient ? "Configurata" : "Da configurare"}</strong></div><div class="detail-list-row"><span>Archivio documenti</span><strong>${supabaseClient ? "Storage privato" : "Solo metadati demo"}</strong></div><div class="detail-list-row"><span>Permessi</span><strong>Admin / Inquilino / Manutentore</strong></div></div><div class="callout" style="margin-top:18px">I dati della demo non sono condivisi e non devono essere usati per documenti reali. Dopo il collegamento a Supabase, le policy del database garantiscono che ogni inquilino acceda solo ai propri dati autorizzati.</div></section><section class="panel pad"><div class="section-head"><div><h2>Azioni</h2><p>Esportazione, ripristino e guida alla connessione.</p></div></div><div class="stack"><button class="button secondary full" data-action="export-csv">⇩ Esporta tutti i dati in CSV</button><button class="button secondary full" data-action="show-architecture">◌ Vedi architettura</button>${isDemo() ? `<button class="button danger full" data-action="reset-demo">Ripristina dati demo</button>` : `<button class="button danger full" data-action="logout">Esci dall’account</button>`}</div></section></div>`;
  }

  function renderTenantPortal() {
    const tenantId = state.sessionUser?.id || state.demoTenantId;
    const tenant = state.profile?.role === "tenant" ? state.profile : getProfile(tenantId);
    const properties = tenantProperties(tenantId);
    const property = properties[0];
    document.title = `${APP_NAME} · Area inquilino`;
    if (!property) {
      app.innerHTML = `<main class="tenant-shell"><header class="tenant-topbar"><div class="brand brand-inverse">${brandMark()}<span>${esc(APP_NAME)}</span></div><button class="button secondary small" data-action="logout">Esci</button></header><section class="tenant-main"><div class="panel">${empty("⌂", "Nessun immobile associato", "Chiedi all’amministratore di collegare il tuo profilo a un contratto attivo.")}</div></section></main>`;
      return;
    }
    const lease = getPrimaryLease(property.id);
    const permissions = getPermissions(property.id, tenantId);
    const payments = state.data.rent_payments.filter((payment) => payment.property_id === property.id && (!payment.tenant_id || payment.tenant_id === tenantId)).sort((a,b) => String(b.period).localeCompare(String(a.period)));
    const currentPayment = payments.find((payment) => payment.period === isoMonth()) || payments[0];
    const docs = state.data.documents.filter((document) => document.property_id === property.id && document.visible_to_tenant);
    const utilityBills = state.data.utility_bills.filter((bill) => bill.property_id === property.id);
    const utilities = state.data.utility_accounts.filter((utility) => utility.property_id === property.id);
    const jobs = state.data.maintenance_jobs.filter((job) => job.property_id === property.id);
    app.innerHTML = `
      <main class="tenant-shell">
        <header class="tenant-topbar"><div class="brand brand-inverse">${brandMark()}<span>${esc(APP_NAME)}</span></div><div style="display:flex;align-items:center;gap:11px"><span style="font-size:.8rem;color:rgba(255,255,255,.76)">Ciao, ${esc(tenant?.display_name || "inquilino")}</span><button class="button secondary small" data-action="logout">Esci</button></div></header>
        <section class="tenant-main">
          <div class="tenant-welcome"><div><p class="eyebrow">Area inquilino</p><h1>La tua abitazione, tutto in ordine.</h1><p>Consulta solo le informazioni che l’amministratore ha reso disponibili per te.</p></div>${isDemo() ? `<button class="button secondary" data-action="demo-admin">← Torna alla demo admin</button>` : ""}</div>
          <div class="tenant-grid">
            <section class="rent-card"><p class="eyebrow">Canone ${esc(monthLabel(currentPayment?.period || isoMonth()))}</p><h2>${currentPayment?.status === "paid" ? "Pagamento registrato" : "Prossimo pagamento"}</h2><div class="rent-amount">${money(currentPayment?.amount_due || lease?.monthly_rent || 0)}</div><p>Scadenza ${dateLabel(currentPayment?.due_date || `${isoMonth()}-${String(lease?.due_day || 5).padStart(2, "0")}`)} · Stato: ${statusLabel(currentPayment?.status || "pending")}</p><div class="rent-actions">${permissions.allow_payment_upload ? `<button class="button" data-action="upload-payment" data-payment-id="${currentPayment?.id || ""}" data-property-id="${property.id}">⇧ Carica contabile</button>` : ""}${currentPayment?.receipt_name ? `<span class="button secondary">✓ ${esc(currentPayment.receipt_name)}</span>` : ""}</div></section>
            <section class="panel tenant-address"><p class="eyebrow">Immobile</p><h3>${esc(property.name)}</h3><p>${esc(property.address)}, ${esc(property.postal_code || "")} ${esc(property.city)}</p><dl><div><dt>Contratto</dt><dd>${lease ? dateLabel(lease.end_date) : "—"}</dd></div><div><dt>Canone</dt><dd>${money(lease?.monthly_rent || 0)}</dd></div></dl></section>
          </div>
          <div class="page-grid" style="margin-top:18px">
            <section class="panel"><div class="panel-head"><div><h2>I tuoi pagamenti</h2><p>Storico dei canoni e contabili caricate.</p></div></div>${payments.length ? `<div class="table-wrap"><table><thead><tr><th>Periodo</th><th>Scadenza</th><th>Importo</th><th>Contabile</th><th>Stato</th></tr></thead><tbody>${payments.map((payment) => `<tr><td>${esc(monthLabel(payment.period))}</td><td>${dateLabel(payment.due_date)}</td><td class="number">${money(payment.amount_due)}</td><td>${payment.receipt_name ? esc(payment.receipt_name) : "—"}</td><td>${badge(payment.status)}</td></tr>`).join("")}</tbody></table></div>` : empty("€", "Nessun canone disponibile", "I prossimi pagamenti saranno indicati qui.")}</section>
            <section class="panel"><div class="panel-head"><div><h2>Riepilogo accessi</h2><p>Contenuti abilitati dall’amministratore.</p></div></div><div class="task-list"><div class="task-row"><span class="property-avatar">▤</span><div class="task-copy"><strong>Documenti</strong><span>${permissions.show_documents ? `${docs.length} file disponibili` : "Non abilitati"}</span></div></div><div class="task-row"><span class="property-avatar">⚡</span><div class="task-copy"><strong>Utenze</strong><span>${permissions.show_utilities ? `${utilityBills.length} bollette visibili` : "Non abilitate"}</span></div></div><div class="task-row"><span class="property-avatar">⌁</span><div class="task-copy"><strong>Manutenzioni</strong><span>${permissions.show_maintenance ? `${jobs.length} interventi visibili` : "Non abilitate"}</span></div></div></div></section>
          </div>
          ${permissions.show_documents || permissions.show_utilities || permissions.show_maintenance ? `<div class="page-grid"><section class="panel"><div class="panel-head"><div><h2>Documenti e utenze</h2><p>Materiale condiviso per l’abitazione.</p></div></div>${permissions.show_documents ? `<div class="task-list">${docs.length ? docs.map((document) => `<article class="task-row"><span class="property-avatar">▤</span><div class="task-copy"><strong>${esc(document.name)}</strong><span>${esc(document.category)} · ${dateLabel(document.uploaded_at)}</span></div></article>`).join("") : `<p class="row-muted">Nessun documento condiviso.</p>`}</div>` : ""}${permissions.show_utilities ? `<div class="table-wrap" style="border-left:0;border-right:0;border-bottom:0"><table><thead><tr><th>Utenza</th><th>Periodo</th><th>Importo</th><th>Scadenza</th></tr></thead><tbody>${utilityBills.map((bill) => `<tr><td>${esc(utilities.find((utility) => utility.id === bill.utility_id)?.kind || "Utenza")}</td><td>${esc(monthLabel(bill.period))}</td><td class="number">${money(bill.amount)}</td><td>${dateLabel(bill.due_date)}</td></tr>`).join("")}</tbody></table></div>` : ""}</section><section class="panel"><div class="panel-head"><div><h2>Assistenza</h2><p>Per segnalazioni urgenti usa i riferimenti concordati con l’amministratore.</p></div></div><div class="task-list">${permissions.show_maintenance ? jobs.map((job) => taskRow(job)).join("") : `<article class="task-row"><span class="property-avatar">i</span><div class="task-copy"><strong>Visibilità degli interventi</strong><span>Le manutenzioni non sono attualmente condivise con il tuo profilo.</span></div></article>`}</div></section></div>` : ""}
        </section>
      </main>`;
  }

  function empty(icon, title, description) {
    return `<div class="empty"><div><div class="empty-icon">${icon}</div><strong>${esc(title)}</strong><p>${esc(description)}</p></div></div>`;
  }

  function render() {
    if (!state.mode) renderLogin();
    else if (state.mode === "tenant") renderTenantPortal();
    else renderShell();
  }

  function toast(message, type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type === "error" ? "error" : ""}`;
    el.innerHTML = `<span class="toast-dot"></span><span>${esc(message)}</span>`;
    toastRegion.append(el);
    window.setTimeout(() => el.remove(), 3600);
  }

  function openDialog(content) {
    dialog.innerHTML = content;
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
    dialog.innerHTML = "";
  }

  function dialogTemplate(title, subtitle, body, footer = "") {
    return `<div class="dialog-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="dialog-close" data-action="close-dialog" aria-label="Chiudi">×</button></div><div class="dialog-body">${body}</div>${footer ? `<div class="dialog-foot">${footer}</div>` : ""}`;
  }

  function field(label, name, type = "text", value = "", options = {}) {
    const { required = false, placeholder = "", help = "", attributes = "" } = options;
    return `<div class="field"><label for="field-${name}">${esc(label)}</label><input id="field-${name}" type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? "required" : ""} ${attributes} />${help ? `<small>${esc(help)}</small>` : ""}</div>`;
  }

  function selectField(label, name, value, options, extra = "") {
    return `<div class="field"><label for="field-${name}">${esc(label)}</label><select id="field-${name}" name="${name}" ${extra}>${options.map(([optionValue, optionLabel]) => `<option value="${esc(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${esc(optionLabel)}</option>`).join("")}</select></div>`;
  }

  function propertyOptions(selected = "") {
    return state.data.properties.map((property) => [property.id, property.name, selected === property.id]).map(([id, name, isSelected]) => `<option value="${esc(id)}" ${isSelected ? "selected" : ""}>${esc(name)}</option>`).join("");
  }

  function providerOptions(selected = "") {
    return [`<option value="">Non assegnato</option>`, ...state.data.service_providers.map((provider) => `<option value="${esc(provider.id)}" ${selected === provider.id ? "selected" : ""}>${esc(provider.display_name)} · ${esc(provider.category)}</option>`)].join("");
  }

  function openForm(kind, context = {}) {
    const property = context.propertyId ? getProperty(context.propertyId) : null;
    if (kind === "property") {
      const item = context.propertyId ? getProperty(context.propertyId) : null;
      const body = `<form data-form="property" data-property-id="${esc(item?.id || "")}"><div class="form-grid">${field("Nome identificativo", "name", "text", item?.name || "", { required: true, placeholder: "es. Appartamento Via Gramsci" })}${selectField("Stato", "status", item?.status || "rented", [["rented", "Fittata"], ["vacant", "Sfitta"], ["personal", "Personale"], ["maintenance", "In manutenzione"]])}${field("Indirizzo", "address", "text", item?.address || "", { required: true })}${field("Città", "city", "text", item?.city || "", { required: true })}${field("CAP", "postal_code", "text", item?.postal_code || "")}${field("Tipologia", "type", "text", item?.type || "Appartamento")}${field("Valore stimato", "estimated_value", "number", item?.estimated_value || "", { attributes: "min=0 step=1000" })}<div class="field"><label for="field-notes">Note</label><textarea id="field-notes" name="notes" placeholder="Informazioni utili sulla proprietà">${esc(item?.notes || "")}</textarea></div></div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">${item ? "Salva modifiche" : "Crea immobile"}</button></div></form>`;
      openDialog(dialogTemplate(item ? "Modifica immobile" : "Nuovo immobile", "La scheda diventerà il contenitore di contratti, costi e documenti.", body));
      return;
    }
    if (kind === "tenant") {
      const body = `<form data-form="tenant" data-property-id="${esc(context.propertyId || "")}"><div class="callout">In demo viene creato un profilo locale. Con Supabase, l’email e la password scelti qui diventeranno le credenziali reali dell’inquilino.</div><div class="form-separator"></div><div class="form-grid">${field("Nome e cognome", "display_name", "text", "", { required: true })}${field("Username visualizzato", "username", "text", "", { required: true, placeholder: "nome.cognome" })}${field("Email", "email", "email", "", { required: true })}${field("Password iniziale", "password", "password", "", { required: true, help: "Almeno 8 caratteri. Sarà richiesta solo nel backend, non viene salvata nella scheda." })}${field("Telefono", "phone", "tel", "")}${selectField("Immobile", "property_id", context.propertyId || "", state.data.properties.map((p) => [p.id, p.name]))}${field("Canone mensile", "monthly_rent", "number", property ? propertyRent(property.id) || "" : "", { required: true, attributes: "min=0 step=1" })}${field("Scadenza canone", "due_day", "number", "5", { required: true, attributes: "min=1 max=28" })}${field("Inizio contratto", "start_date", "date", dateISO(), { required: true })}${field("Fine contratto", "end_date", "date", dateISO(365), { required: true })}</div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Crea e collega</button></div></form>`;
      openDialog(dialogTemplate("Nuovo inquilino", "Crea il profilo e il relativo contratto attivo.", body));
      return;
    }
    if (kind === "provider") {
      const body = `<form data-form="provider"><div class="form-grid">${field("Nome e cognome", "display_name", "text", "", { required: true })}${field("Azienda", "company_name", "text", "")}${selectField("Categoria", "category", "Elettricista", [["Elettricista", "Elettricista"], ["Idraulico", "Idraulico"], ["Muratore", "Muratore"], ["Falegname", "Falegname"], ["Climatizzazione", "Climatizzazione"], ["Altro", "Altro"]])}${field("Telefono", "phone", "tel", "", { required: true })}${field("Email", "email", "email", "")}<div class="field"><label for="field-notes">Note</label><textarea id="field-notes" name="notes" placeholder="Orari, area di intervento, condizioni…"></textarea></div></div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Aggiungi manutentore</button></div></form>`;
      openDialog(dialogTemplate("Nuovo manutentore", "Inserisci professionisti e imprese da riutilizzare sugli interventi.", body));
      return;
    }
    if (kind === "maintenance") {
      const body = `<form data-form="maintenance"><div class="form-grid">${selectField("Immobile", "property_id", context.propertyId || "", state.data.properties.map((p) => [p.id, p.name]))}<div class="field"><label for="field-provider_id">Fornitore</label><select id="field-provider_id" name="provider_id">${providerOptions()}</select></div>${field("Titolo intervento", "title", "text", "", { required: true, placeholder: "es. Sostituzione scaldabagno" })}${selectField("Categoria", "category", "Idraulico", [["Elettrico", "Elettrico"], ["Idraulico", "Idraulico"], ["Muratura", "Muratura"], ["Pulizia", "Pulizia"], ["Altro", "Altro"]])}${selectField("Priorità", "priority", "normal", [["low", "Bassa"], ["normal", "Normale"], ["high", "Alta"], ["urgent", "Urgente"]])}${selectField("Stato", "status", "scheduled", [["scheduled", "Programmato"], ["done", "Concluso"], ["cancelled", "Annullato"]])}${field("Data prevista/eseguita", "scheduled_date", "date", dateISO(), { required: true })}${field("Costo complessivo", "total_cost", "number", "", { attributes: "min=0 step=0.01", help: "Se concluso, il costo genera anche una uscita nel conto economico." })}<div class="field span-2"><label for="field-notes">Cosa è stato fatto</label><textarea id="field-notes" name="notes" placeholder="Descrizione dell’intervento, materiali, garanzia…"></textarea></div></div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Salva intervento</button></div></form>`;
      openDialog(dialogTemplate("Registra intervento", "Collega attività, costo e manutentore alla singola proprietà.", body));
      return;
    }
    if (kind === "financial") {
      const body = `<form data-form="financial"><div class="form-grid">${selectField("Immobile", "property_id", context.propertyId || "", [["", "Generale/non attribuito"], ...state.data.properties.map((p) => [p.id, p.name])])}${selectField("Tipo", "direction", "expense", [["income", "Entrata"], ["expense", "Uscita"]])}${field("Categoria", "category", "text", "", { required: true, placeholder: "es. Condominio, canone, IMU" })}${field("Importo", "amount", "number", "", { required: true, attributes: "min=0 step=0.01" })}${field("Data", "date", "date", dateISO(), { required: true })}${selectField("Stato", "status", "paid", [["paid", "Pagato/incassato"], ["pending", "Da pagare"], ["partial", "Parziale"]])}<div class="field span-2"><label for="field-description">Descrizione</label><textarea id="field-description" name="description" placeholder="Nota opzionale"></textarea></div></div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Registra movimento</button></div></form>`;
      openDialog(dialogTemplate("Nuovo movimento", "Ogni voce entra nel conto economico dell’immobile e nel totale del portafoglio.", body));
      return;
    }
    if (kind === "utility") {
      const body = `<form data-form="utility"><div class="form-grid">${selectField("Immobile", "property_id", context.propertyId || "", state.data.properties.map((p) => [p.id, p.name]))}${selectField("Tipologia utenza", "kind", "Luce", [["Luce", "Luce"], ["Gas", "Gas"], ["Acqua", "Acqua"], ["Internet", "Internet"], ["Condominio", "Condominio"], ["TARI", "TARI"], ["Altro", "Altro"]])}${field("Fornitore", "provider", "text", "", { required: true })}${selectField("Intestatario", "holder", "owner", [["owner", "Proprietario"], ["tenant", "Inquilino"]])}${field("Codice contratto/POD/PDR", "contract_code", "text", "")}${selectField("Riaddebitata all’inquilino", "recharged_to_tenant", "false", [["false", "No"], ["true", "Sì"]])}${field("Importo bolletta", "amount", "number", "", { attributes: "min=0 step=0.01" })}${field("Scadenza bolletta", "due_date", "date", dateISO(10))}${field("Periodo bolletta", "period", "month", isoMonth())}<div class="field span-2"><label for="field-notes">Note</label><textarea id="field-notes" name="notes" placeholder="Eventuali regole di rimborso o dettagli"></textarea></div></div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Salva utenza</button></div></form>`;
      openDialog(dialogTemplate("Utenza e bolletta", "Registra l’intestatario e, se presente, la prima bolletta/scadenza.", body));
      return;
    }
    if (kind === "document") {
      const body = `<form data-form="document" enctype="multipart/form-data"><div class="form-grid">${selectField("Immobile", "property_id", context.propertyId || "", state.data.properties.map((p) => [p.id, p.name]))}${selectField("Categoria", "category", "Contratto", [["Contratto", "Contratto"], ["Verbale", "Verbale"], ["Bolletta", "Bolletta"], ["Mutuo", "Mutuo"], ["Manutenzione", "Manutenzione"], ["Altro", "Altro"]])}<label class="file-input field span-2"><input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"/><span><strong>Seleziona un documento</strong><span>PDF, foto o documento di lavoro.</span></span></label><label class="permission span-2"><input type="checkbox" name="visible_to_tenant" /><span><strong>Rendi visibile agli inquilini autorizzati</strong><span>È sempre possibile cambiare il livello di accesso in seguito.</span></span></label></div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Carica documento</button></div></form>`;
      openDialog(dialogTemplate("Carica documento", "In produzione il file sarà custodito in un archivio privato, non pubblico.", body));
      return;
    }
    if (kind === "payment") {
      const activeLease = property ? getPrimaryLease(property.id) : null;
      if (!activeLease) { toast("Collega prima un contratto attivo a questo immobile.", "error"); return; }
      const body = `<form data-form="payment"><input type="hidden" name="property_id" value="${esc(property.id)}" /><input type="hidden" name="lease_id" value="${esc(activeLease.id)}" /><div class="form-grid">${field("Periodo", "period", "month", isoMonth(), { required: true })}${field("Scadenza", "due_date", "date", `${isoMonth()}-${String(activeLease.due_day).padStart(2, "0")}`, { required: true })}${field("Importo dovuto", "amount_due", "number", activeLease.monthly_rent, { required: true, attributes: "min=0 step=0.01" })}${selectField("Stato iniziale", "status", "pending", [["pending", "Da pagare"], ["paid", "Pagato"], ["partial", "Parziale"]])}</div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Crea canone</button></div></form>`;
      openDialog(dialogTemplate("Nuovo canone", "Crea una richiesta mensile per gli inquilini del contratto attivo.", body));
      return;
    }
    if (kind === "payment-proof") {
      const payment = state.data.rent_payments.find((item) => item.id === context.paymentId);
      const body = `<form data-form="payment-proof" data-payment-id="${esc(payment?.id || "")}" data-property-id="${esc(context.propertyId || payment?.property_id || "")}" enctype="multipart/form-data"><div class="callout">Carica la contabile del bonifico. L’amministratore la vedrà e potrà confermare il pagamento.</div><div class="form-separator"></div><label class="file-input"><input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png"/><span><strong>Seleziona contabile</strong><span>PDF, JPG o PNG.</span></span></label><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Invia contabile</button></div></form>`;
      openDialog(dialogTemplate("Carica contabile", `Pagamento ${payment ? monthLabel(payment.period) : ""}`, body));
      return;
    }
    if (kind === "permissions") {
      const tenant = getProfile(context.tenantId);
      const permissions = getPermissions(context.propertyId, context.tenantId);
      const body = `<form data-form="permissions" data-property-id="${esc(context.propertyId)}" data-tenant-id="${esc(context.tenantId)}"><p class="callout">Queste scelte definiscono cosa comparirà nel portale di ${esc(tenant?.display_name || "questo inquilino")}. I dati economici completi e il mutuo restano sempre solo per l’admin.</p><div class="form-separator"></div><div class="permission-grid">${checkboxPermission("show_documents", "Documenti", "Contratti, verbali e file marcati come visibili.", permissions.show_documents)}${checkboxPermission("show_utilities", "Utenze", "Bollettini e scadenze delle utenze condivise.", permissions.show_utilities)}${checkboxPermission("show_maintenance", "Manutenzioni", "Stato degli interventi aperti per l’immobile.", permissions.show_maintenance)}${checkboxPermission("allow_payment_upload", "Caricamento contabili", "Invio della ricevuta di pagamento del canone.", permissions.allow_payment_upload)}${checkboxPermission("allow_utility_upload", "Caricamento utenze", "Invio di documenti relativi alle utenze.", permissions.allow_utility_upload)}</div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Salva permessi</button></div></form>`;
      openDialog(dialogTemplate("Permessi inquilino", "La visibilità è gestita per persona e per immobile.", body));
      return;
    }
  }

  function checkboxPermission(name, title, description, checked) {
    return `<label class="permission"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}/><span><strong>${esc(title)}</strong><span>${esc(description)}</span></span></label>`;
  }

  function openArchitectureDialog() {
    openDialog(dialogTemplate("Architettura della piattaforma", "La PWA è pubblicata su GitHub Pages; i dati e i file non sono pubblici.", `<div class="stack"><div class="detail-list"><div class="detail-list-row"><span><strong>1. Frontend PWA</strong><br><small>Dashboard e portale inquilino, installabili su telefono e PC.</small></span><strong>GitHub Pages</strong></div><div class="detail-list-row"><span><strong>2. Identità e ruoli</strong><br><small>Login email/password; amministratore, inquilino e manutentore.</small></span><strong>Supabase Auth</strong></div><div class="detail-list-row"><span><strong>3. Dati gestionali</strong><br><small>Immobili, contratti, movimenti, utenze, mutui e interventi.</small></span><strong>PostgreSQL + RLS</strong></div><div class="detail-list-row"><span><strong>4. File privati</strong><br><small>Contratti, bollette e contabili con accesso verificato.</small></span><strong>Storage privato</strong></div></div><div class="callout warning"><strong>Perché non solo GitHub?</strong><br>Un sito statico non può custodire password o autorizzare un inquilino senza esporre dati. Il codice resta su GitHub; il backend applica i diritti di accesso.</div></div>`, `<button class="button" data-action="close-dialog">Ho capito</button>`));
  }

  async function handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "demo-admin") {
      state.mode = "admin";
      state.profile = { id: "admin-demo", role: "admin", display_name: "Alberto Sicoli" };
      state.activeView = "dashboard";
      render();
      return;
    }
    if (action === "demo-tenant") {
      state.mode = "tenant";
      state.profile = getProfile(state.demoTenantId);
      render();
      return;
    }
    if (action === "logout") {
      if (supabaseClient && state.sessionUser) await supabaseClient.auth.signOut();
      state.mode = null;
      state.sessionUser = null;
      state.profile = null;
      state.activeView = "dashboard";
      closeDialog();
      render();
      return;
    }
    if (action === "navigate") {
      state.activeView = target.dataset.view;
      if (state.activeView !== "property") state.selectedPropertyId = null;
      renderShell();
      return;
    }
    if (action === "open-property") {
      state.selectedPropertyId = target.dataset.propertyId;
      state.activeView = "property";
      state.propertyTab = "overview";
      renderShell();
      return;
    }
    if (action === "property-tab") {
      state.propertyTab = target.dataset.tab;
      renderView();
      return;
    }
    if (action === "property-filter") {
      state.propertyFilter = target.dataset.filter;
      renderView();
      return;
    }
    if (action === "add-property") return openForm("property");
    if (action === "edit-property") return openForm("property", { propertyId: state.selectedPropertyId });
    if (action === "add-tenant") return openForm("tenant", { propertyId: target.dataset.propertyId || "" });
    if (action === "add-provider") return openForm("provider");
    if (action === "add-maintenance") return openForm("maintenance", { propertyId: target.dataset.propertyId || "" });
    if (action === "add-financial") return openForm("financial", { propertyId: target.dataset.propertyId || "" });
    if (action === "add-utility") return openForm("utility", { propertyId: target.dataset.propertyId || "" });
    if (action === "add-document") return openForm("document", { propertyId: target.dataset.propertyId || "" });
    if (action === "add-payment") return openForm("payment", { propertyId: target.dataset.propertyId || "" });
    if (action === "upload-payment") return openForm("payment-proof", { paymentId: target.dataset.paymentId || "", propertyId: target.dataset.propertyId || "" });
    if (action === "open-payment") return openForm("payment-proof", { paymentId: target.dataset.paymentId || "", propertyId: state.data.rent_payments.find((item) => item.id === target.dataset.paymentId)?.property_id || "" });
    if (action === "edit-permissions") return openForm("permissions", { propertyId: target.dataset.propertyId, tenantId: target.dataset.tenantId });
    if (action === "close-dialog") return closeDialog();
    if (action === "show-architecture") return openArchitectureDialog();
    if (action === "reset-demo") return resetDemo();
    if (action === "export-csv") return exportCSV();
    if (action === "refresh") return refreshData();
  }

  function handleInput(event) {
    if (event.target.dataset.input === "property-search") {
      state.propertySearch = event.target.value;
      renderView();
      const replacement = document.querySelector('[data-input="property-search"]');
      if (replacement) {
        replacement.focus();
        replacement.setSelectionRange(state.propertySearch.length, state.propertySearch.length);
      }
    }
  }

  async function handleSubmit(event) {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const type = form.dataset.form;
    const data = new FormData(form);
    const value = (name) => String(data.get(name) ?? "").trim();
    try {
      if (type === "login") {
        await login(value("email"), value("password"));
        return;
      }
      if (type === "property") {
        const item = {
          id: form.dataset.propertyId || newId(),
          name: value("name"), address: value("address"), city: value("city"), postal_code: value("postal_code"), type: value("type"), status: value("status"), estimated_value: Number(value("estimated_value") || 0), notes: value("notes"), created_at: dateISO()
        };
        const index = state.data.properties.findIndex((property) => property.id === item.id);
        if (index >= 0) state.data.properties[index] = { ...state.data.properties[index], ...item };
        else state.data.properties.push(item);
        await syncEntity("property", item, index >= 0 ? "update" : "insert");
        finishMutation(index >= 0 ? "Immobile aggiornato." : "Immobile creato.");
        return;
      }
      if (type === "tenant") {
        const tenant = { id: newId(), role: "tenant", display_name: value("display_name"), username: value("username"), email: value("email"), phone: value("phone"), password: value("password") };
        const existingLease = getPrimaryLease(value("property_id"));
        const lease = existingLease
          ? { ...existingLease, tenant_ids: [...new Set([...(existingLease.tenant_ids || []), tenant.id])] }
          : { id: newId(), property_id: value("property_id"), tenant_ids: [tenant.id], monthly_rent: Number(value("monthly_rent")), deposit: 0, due_day: Number(value("due_day")), start_date: value("start_date"), end_date: value("end_date"), status: "active", contract_reference: `Contratto ${tenant.display_name}` };
        if (supabaseClient && state.sessionUser) {
          const invited = await inviteTenant({ ...tenant, role: "tenant" });
          tenant.id = invited.id;
          lease.tenant_ids = existingLease
            ? [...new Set([...(existingLease.tenant_ids || []), tenant.id])]
            : [tenant.id];
        }
        const tenantProfile = { ...tenant };
        delete tenantProfile.password;
        state.data.profiles.push(tenantProfile);
        if (existingLease) Object.assign(existingLease, lease); else state.data.leases.push(lease);
        state.data.tenant_permissions.push({ id: newId(), property_id: lease.property_id, tenant_id: tenant.id, show_documents: true, show_utilities: true, show_maintenance: false, allow_payment_upload: true, allow_utility_upload: false });
        if (supabaseClient && state.sessionUser) await syncTenantRelations(tenantProfile, lease);
        finishMutation(existingLease ? "Inquilino collegato al contratto esistente." : "Inquilino e contratto creati.");
        return;
      }
      if (type === "provider") {
        const provider = { id: newId(), display_name: value("display_name"), company_name: value("company_name"), category: value("category"), email: value("email"), phone: value("phone"), notes: value("notes") };
        state.data.service_providers.push(provider);
        await syncEntity("provider", provider, "insert");
        finishMutation("Manutentore aggiunto.");
        return;
      }
      if (type === "maintenance") {
        const job = { id: newId(), property_id: value("property_id"), provider_id: value("provider_id") || null, title: value("title"), category: value("category"), priority: value("priority"), status: value("status"), scheduled_date: value("scheduled_date"), completed_date: value("status") === "done" ? value("scheduled_date") : "", total_cost: Number(value("total_cost") || 0), notes: value("notes") };
        state.data.maintenance_jobs.push(job);
        if (job.status === "done" && job.total_cost > 0) state.data.financial_entries.push({ id: newId(), property_id: job.property_id, direction: "expense", category: `Manutenzione · ${job.category}`, amount: job.total_cost, date: job.completed_date, status: "paid", description: job.title });
        await syncEntity("maintenance", job, "insert");
        finishMutation("Intervento salvato.");
        return;
      }
      if (type === "financial") {
        const entry = { id: newId(), property_id: value("property_id") || null, direction: value("direction"), category: value("category"), amount: Number(value("amount")), date: value("date"), status: value("status"), description: value("description") };
        state.data.financial_entries.push(entry);
        await syncEntity("financial", entry, "insert");
        finishMutation("Movimento registrato.");
        return;
      }
      if (type === "utility") {
        const utility = { id: newId(), property_id: value("property_id"), kind: value("kind"), provider: value("provider"), holder: value("holder"), recharged_to_tenant: value("recharged_to_tenant") === "true", contract_code: value("contract_code"), notes: value("notes") };
        state.data.utility_accounts.push(utility);
        const amount = Number(value("amount") || 0);
        if (amount > 0) state.data.utility_bills.push({ id: newId(), utility_id: utility.id, property_id: utility.property_id, period: value("period"), due_date: value("due_date"), amount, status: "pending", document_name: "" });
        await syncEntity("utility", utility, "insert");
        finishMutation("Utenza salvata.");
        return;
      }
      if (type === "document") {
        const file = data.get("file");
        if (!(file instanceof File) || !file.name) throw new Error("Seleziona un file prima di caricare.");
        const documentItem = { id: newId(), property_id: value("property_id"), category: value("category"), name: file.name, visible_to_tenant: data.get("visible_to_tenant") === "on", uploaded_at: dateISO(), uploaded_by: state.sessionUser?.id || "admin", storage_path: "" };
        if (supabaseClient && state.sessionUser) documentItem.storage_path = await uploadAdminDocument(file, documentItem);
        state.data.documents.push(documentItem);
        await syncEntity("document", documentItem, "insert");
        finishMutation("Documento archiviato.");
        return;
      }
      if (type === "payment") {
        const lease = getLease(value("lease_id"));
        const payment = { id: newId(), property_id: value("property_id"), lease_id: value("lease_id"), tenant_id: lease?.tenant_ids?.[0] || null, period: value("period"), due_date: value("due_date"), amount_due: Number(value("amount_due")), amount_paid: value("status") === "paid" ? Number(value("amount_due")) : 0, paid_at: value("status") === "paid" ? dateISO() : "", status: value("status"), receipt_name: "" };
        state.data.rent_payments.push(payment);
        await syncEntity("payment", payment, "insert");
        finishMutation("Canone creato.");
        return;
      }
      if (type === "payment-proof") {
        const file = data.get("file");
        if (!(file instanceof File) || !file.name) throw new Error("Seleziona la contabile prima di inviare.");
        const payment = state.data.rent_payments.find((item) => item.id === form.dataset.paymentId);
        if (!payment) throw new Error("Pagamento non trovato.");
        payment.receipt_name = file.name;
        payment.status = payment.status === "paid" ? "paid" : "pending";
        payment.receipt_uploaded_at = dateISO();
        if (supabaseClient && state.sessionUser) payment.receipt_path = await uploadPaymentProof(file, payment);
        await syncEntity("payment", payment, "update");
        finishMutation("Contabile inviata all’amministratore.");
        return;
      }
      if (type === "permissions") {
        const propertyId = form.dataset.propertyId;
        const tenantId = form.dataset.tenantId;
        const existing = state.data.tenant_permissions.find((item) => item.property_id === propertyId && item.tenant_id === tenantId);
        const permissions = { id: existing?.id || newId(), property_id: propertyId, tenant_id: tenantId, show_documents: data.get("show_documents") === "on", show_utilities: data.get("show_utilities") === "on", show_maintenance: data.get("show_maintenance") === "on", allow_payment_upload: data.get("allow_payment_upload") === "on", allow_utility_upload: data.get("allow_utility_upload") === "on" };
        if (existing) Object.assign(existing, permissions); else state.data.tenant_permissions.push(permissions);
        await syncEntity("permissions", permissions, existing ? "update" : "insert");
        finishMutation("Permessi aggiornati.");
      }
    } catch (error) {
      console.error(error);
      toast(error.message || "Non è stato possibile completare l’operazione.", "error");
    }
  }

  function finishMutation(message) {
    persistData();
    closeDialog();
    render();
    toast(message);
  }

  async function login(email, password) {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    state.sessionUser = data.user;
    await hydrateSession(data.user);
    render();
  }

  async function hydrateSession(user) {
    state.loading = true;
    const { data: profile, error } = await supabaseClient.from("profiles").select("*").eq("id", user.id).single();
    if (error) throw error;
    state.profile = profile;
    state.mode = profile.role === "tenant" ? "tenant" : "admin";
    await hydrateRemoteData();
    state.loading = false;
  }

  async function hydrateRemoteData() {
    if (!supabaseClient || !state.sessionUser) return;
    const tables = [
      "properties", "property_private_details", "profiles", "leases", "lease_tenants", "rent_payments", "utility_accounts", "utility_bills", "mortgages", "financial_entries", "documents", "service_providers", "maintenance_jobs", "property_tenant_permissions"
    ];
    const results = await Promise.all(tables.map(async (table) => {
      const { data, error } = await supabaseClient.from(table).select("*");
      if (error) throw new Error(`Errore nel leggere ${table}: ${error.message}`);
      return [table, data || []];
    }));
    const remote = Object.fromEntries(results);
    const tenantIdsByLease = new Map();
    remote.lease_tenants.forEach((relation) => {
      if (!tenantIdsByLease.has(relation.lease_id)) tenantIdsByLease.set(relation.lease_id, []);
      tenantIdsByLease.get(relation.lease_id).push(relation.tenant_id);
    });
    state.data = {
      version: 1,
      properties: remote.properties.map((property) => {
        const details = remote.property_private_details.find((detail) => detail.property_id === property.id);
        return {
          ...property,
          estimated_value: details?.estimated_value ?? 0,
          notes: details?.notes ?? ""
        };
      }),
      profiles: remote.profiles,
      leases: remote.leases.map((lease) => ({ ...lease, tenant_ids: tenantIdsByLease.get(lease.id) || [] })),
      rent_payments: remote.rent_payments.map((payment) => ({ ...payment, period: String(payment.period || "").slice(0, 7) })),
      utility_accounts: remote.utility_accounts,
      utility_bills: remote.utility_bills.map((bill) => ({ ...bill, period: String(bill.period || "").slice(0, 7) })),
      mortgages: remote.mortgages,
      financial_entries: remote.financial_entries,
      documents: remote.documents,
      service_providers: remote.service_providers,
      maintenance_jobs: remote.maintenance_jobs,
      tenant_permissions: remote.property_tenant_permissions
    };
  }

  async function refreshData() {
    if (!supabaseClient || !state.sessionUser) {
      render();
      toast("Dati locali aggiornati.");
      return;
    }
    try {
      await hydrateRemoteData();
      render();
      toast("Dati sincronizzati.");
    } catch (error) {
      toast(error.message || "Aggiornamento non riuscito.", "error");
    }
  }

  async function inviteTenant(tenant) {
    const { data, error } = await supabaseClient.functions.invoke("admin-create-user", {
      body: { email: tenant.email, password: tenant.password, display_name: tenant.display_name, phone: tenant.phone, role: "tenant" }
    });
    if (error) throw new Error(error.message || "Invito non riuscito.");
    if (!data?.id) throw new Error("Il backend non ha restituito l’ID del nuovo inquilino.");
    return data;
  }

  async function syncTenantRelations(tenant, lease) {
    const payload = { id: tenant.id, display_name: tenant.display_name, username: tenant.username, email: tenant.email, phone: tenant.phone, role: "tenant" };
    const profileResult = await supabaseClient.from("profiles").upsert(payload);
    if (profileResult.error) throw profileResult.error;
    const leasePayload = { ...lease };
    delete leasePayload.tenant_ids;
    const leaseResult = await supabaseClient.from("leases").upsert(leasePayload);
    if (leaseResult.error) throw leaseResult.error;
    const relationResult = await supabaseClient.from("lease_tenants").upsert({ lease_id: lease.id, tenant_id: tenant.id });
    if (relationResult.error) throw relationResult.error;
    const permission = state.data.tenant_permissions.find((p) => p.tenant_id === tenant.id && p.property_id === lease.property_id);
    if (permission) {
      const result = await supabaseClient.from("property_tenant_permissions").upsert(permission);
      if (result.error) throw result.error;
    }
  }

  async function syncEntity(type, item, mode) {
    if (!supabaseClient || !state.sessionUser) return;
    const mapping = {
      property: ["properties", (value) => {
        const { estimated_value, notes, ...publicFields } = value;
        return publicFields;
      }],
      provider: ["service_providers", (value) => value],
      maintenance: ["maintenance_jobs", (value) => value],
      financial: ["financial_entries", (value) => value],
      utility: ["utility_accounts", (value) => value],
      document: ["documents", (value) => ({ ...value, uploaded_by: state.sessionUser.id })],
      payment: ["rent_payments", (value) => ({ ...value, period: value.period?.length === 7 ? `${value.period}-01` : value.period })],
      permissions: ["property_tenant_permissions", (value) => value]
    };
    const [table, transform] = mapping[type] || [];
    if (!table) return;
    const payload = transform(item);
    const request = mode === "update" ? supabaseClient.from(table).update(payload).eq("id", item.id) : supabaseClient.from(table).insert(payload);
    const { error } = await request;
    if (error) throw new Error(`Salvataggio remoto non riuscito: ${error.message}`);
    if (type === "property") {
      const { error: privateError } = await supabaseClient.from("property_private_details").upsert({
        property_id: item.id,
        estimated_value: Number(item.estimated_value || 0),
        notes: item.notes || ""
      });
      if (privateError) throw new Error(`Salvataggio dei dettagli riservati non riuscito: ${privateError.message}`);
    }
    if (type === "utility") {
      const bills = state.data.utility_bills.filter((bill) => bill.utility_id === item.id);
      if (bills.length) {
        const result = await supabaseClient.from("utility_bills").upsert(bills.map((bill) => ({ ...bill, period: bill.period?.length === 7 ? `${bill.period}-01` : bill.period })));
        if (result.error) throw result.error;
      }
    }
    if (type === "maintenance" && item.status === "done" && item.total_cost > 0) {
      const entries = state.data.financial_entries.filter((entry) => entry.description === item.title && entry.property_id === item.property_id && entry.amount === item.total_cost);
      if (entries.length) {
        const result = await supabaseClient.from("financial_entries").upsert(entries);
        if (result.error) throw result.error;
      }
    }
  }

  async function uploadAdminDocument(file, item) {
    const path = `property/${item.property_id}/${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await supabaseClient.storage.from("property-documents").upload(path, file, { upsert: false });
    if (error) throw new Error(`Caricamento file non riuscito: ${error.message}`);
    return path;
  }

  async function uploadPaymentProof(file, payment) {
    const path = `tenant/${state.sessionUser.id}/${payment.id}/${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await supabaseClient.storage.from("property-documents").upload(path, file, { upsert: false });
    if (error) throw new Error(`Caricamento contabile non riuscito: ${error.message}`);
    return path;
  }

  function safeFileName(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  }

  function exportCSV() {
    const rows = [["Sezione", "Immobile", "Data/periodo", "Categoria", "Descrizione", "Entrate", "Uscite", "Stato"]];
    state.data.financial_entries.forEach((entry) => rows.push([
      "Conto economico", getProperty(entry.property_id)?.name || "Generale", entry.date || "", entry.category || "", entry.description || "", entry.direction === "income" ? entry.amount : "", entry.direction === "expense" ? entry.amount : "", entry.status || ""
    ]));
    state.data.rent_payments.forEach((payment) => rows.push([
      "Canone", getProperty(payment.property_id)?.name || "", payment.period || "", "Canone", getProfile(payment.tenant_id)?.display_name || "", payment.amount_paid || "", "", payment.status || ""
    ]));
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `property-manager-${dateISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Esportazione CSV avviata.");
  }

  async function bootstrap() {
    document.title = APP_NAME;
    dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
    document.addEventListener("click", handleClick);
    document.addEventListener("input", handleInput);
    document.addEventListener("submit", handleSubmit);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    if (supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getSession();
        if (data.session?.user) {
          state.sessionUser = data.session.user;
          await hydrateSession(data.session.user);
        }
      } catch (error) {
        console.warn("Sessione remota non recuperata", error);
        toast("Non è stato possibile recuperare la sessione remota.", "error");
      }
    }
    render();
  }

  bootstrap();
})();
