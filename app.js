(() => {
  "use strict";

  const CONFIG = window.PROPERTY_MANAGER_CONFIG || {};
  const APP_NAME = CONFIG.appName || "Property Manager";
  const STORAGE_KEY = "propertyManagerStateV1";
  const app = document.querySelector("#app");
  const dialog = document.querySelector("#app-dialog");
  const toastRegion = document.querySelector("#toast-region");

  let supabaseClient = null;
  let pendingExcelImport = null;
  let excelImporting = false;
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
    selectedTenantId: null,
    propertyTab: "overview",
    propertyFilter: "all",
    propertySearch: "",
    demoTenantId: "tenant-demo-1",
    sessionUser: null,
    profile: null,
    loading: false,
    passwordRecovery: new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery",
    // I dati remoti vengono caricati solo dopo un accesso Supabase valido.
    data: emptyData()
  };

  function emptyData() {
    return {
      version: 1,
      properties: [],
      profiles: [],
      leases: [],
      rent_payments: [],
      utility_accounts: [],
      utility_bills: [],
      mortgages: [],
      financial_entries: [],
      documents: [],
      service_providers: [],
      maintenance_jobs: [],
      tenant_permissions: [],
      tenant_bank_sender_aliases: [],
      bank_transfer_events: []
    };
  }

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
    state.selectedTenantId = null;
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
      ended: "Terminato",
      draft: "Bozza",
      pending: "Da pagare",
      paid: "Pagato",
      review: "Da verificare",
      unmatched: "Da associare",
      partial: "Parziale",
      late: "In ritardo",
      missing: "Non registrato",
      upcoming: "In scadenza",
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

  function getTenantLeases(tenantId) {
    return state.data.leases.filter((lease) => (lease.tenant_ids || []).includes(tenantId));
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
        allow_payment_upload: false,
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

  function normalizedKey(value) {
    return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
  }

  function assertNoDuplicate(items, candidate, isDuplicate, message) {
    if (items.some((item) => item.id !== candidate.id && isDuplicate(item, candidate))) {
      throw new Error(message);
    }
  }

  function deleteButton(kind, id, label = "Elimina") {
    if (state.profile?.role !== "admin" || !id) return "";
    return `<button class="button danger small" type="button" data-action="request-delete" data-delete-type="${esc(kind)}" data-record-id="${esc(id)}">${uiIcon("trash", 14)}${esc(label)}</button>`;
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

  function monthPeriod(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function leaseRentLedger(lease) {
    if (!lease.start_date) return [];
    const start = new Date(`${String(lease.start_date).slice(0, 10)}T12:00:00`);
    const today = new Date();
    const currentPeriod = isoMonth();
    const end = lease.end_date ? new Date(`${String(lease.end_date).slice(0, 10)}T12:00:00`) : today;
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return [];
    const first = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    if (last < first) return [];
    const ledger = [];
    for (const cursor = new Date(first); cursor <= last; cursor.setMonth(cursor.getMonth() + 1)) {
      const period = monthPeriod(cursor);
      const payment = state.data.rent_payments.find((item) => item.lease_id === lease.id && String(item.period || "").slice(0, 7) === period);
      const amountDue = Number(payment?.amount_due ?? lease.monthly_rent ?? 0);
      const amountPaid = payment
        ? Number(payment.amount_paid || (payment.status === "paid" ? amountDue : 0))
        : 0;
      const dueDay = Math.min(28, Math.max(1, Number(lease.due_day || 5)));
      const dueDate = payment?.due_date || `${period}-${String(dueDay).padStart(2, "0")}`;
      const overdue = dueDate < dateISO();
      let status;
      if (payment) {
        status = payment.status === "cancelled" ? "cancelled"
          : amountPaid >= amountDue && amountDue > 0 ? "paid"
          : amountPaid > 0 || payment.status === "partial" ? "partial"
          : (payment.status === "late" || overdue) ? "late" : "pending";
      } else {
        status = period > currentPeriod || !overdue ? "upcoming" : "missing";
      }
      ledger.push({ lease, period, dueDate, amountDue, amountPaid, payment, status });
    }
    return ledger;
  }

  function isDemo() {
    return !supabaseClient || !state.sessionUser;
  }

  function navItems() {
    return [
      { id: "dashboard", label: "Dashboard", icon: "dashboard" },
      { id: "properties", label: "Immobili", icon: "building" },
      { id: "finance", label: "Conto economico", icon: "wallet" },
      { id: "maintenance", label: "Manutenzioni", icon: "wrench" },
      { id: "people", label: "Persone", icon: "users" },
      { id: "settings", label: "Impostazioni", icon: "settings" }
    ];
  }

  function uiIcon(name, size = 20, extraClass = "") {
    const paths = {
      dashboard: `<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="4" rx="1.5"/><rect x="13.5" y="10.5" width="7" height="10" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/>`,
      building: `<rect x="4" y="2.8" width="16" height="18.4" rx="2"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M9 21v-3h6v3"/>`,
      wallet: `<rect x="3" y="5" width="18" height="15" rx="2.5"/><path d="M3 9h18M16 14h.01"/><path d="M7 5V3.8A1.8 1.8 0 0 1 8.8 2h9.4"/>`,
      wrench: `<path d="M14.7 6.3a5 5 0 0 0-6.5 6.5L3.5 17.5a2.1 2.1 0 0 0 3 3l4.7-4.7a5 5 0 0 0 6.5-6.5l-3 3-3-3 3-3Z"/>`,
      users: `<path d="M16 21v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V21"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M17 11a3.5 3.5 0 0 0 0-7M21 21v-1.5a4 4 0 0 0-3-3.87"/>`,
      settings: `<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><circle cx="4" cy="12" r="2"/><circle cx="12" cy="10" r="2"/><circle cx="20" cy="14" r="2"/>`,
      home: `<path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5M9 21v-6h6v6"/>`,
      search: `<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>`,
      info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`,
      arrowUpRight: `<path d="M7 17 17 7M8 7h9v9"/>`,
      arrowDownRight: `<path d="m7 7 10 10M8 17h9V8"/>`,
      check: `<path d="m5 12 4 4L19 6"/>`,
      checkCircle: `<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 9"/>`,
      pieChart: `<path d="M11 3.1A9 9 0 1 0 20.9 13H11V3.1Z"/><path d="M14 3.3V10h6.7A9 9 0 0 0 14 3.3Z"/>`,
      euro: `<path d="M19 5.5a8 8 0 1 0 0 13"/><path d="M4 10h10M4 14h8"/>`,
      coins: `<circle cx="8" cy="8" r="5"/><path d="M8 5.5v5M6.5 7h3M14.5 10.5a5 5 0 1 1-4 8.1M15 13v5M13.5 14.5h3"/>`,
      arrowRight: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
      arrowLeft: `<path d="M19 12H5M11 18l-6-6 6-6"/>`,
      chevronRight: `<path d="m9 18 6-6-6-6"/>`,
      fileUpload: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M12 18v-6M9.5 14.5 12 12l2.5 2.5"/>`,
      fileText: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>`,
      utility: `<path d="m13 2-3 8h7l-6 12 1.5-9H6l7-11Z"/>`,
      refresh: `<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/>`,
      download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>`,
      upload: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>`,
      plus: `<path d="M12 5v14M5 12h14"/>`,
      edit: `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>`,
      trash: `<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>`,
      lock: `<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/><path d="M12 14v3"/>`
    };
    const className = extraClass ? ` ${extraClass}` : "";
    return `<svg class="ui-icon${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.dashboard}</svg>`;
  }

  function renderLogin() {
    const connected = Boolean(supabaseClient);
    const recoveringPassword = state.passwordRecovery;
    document.title = `${APP_NAME} · Accesso`;
    app.innerHTML = `
      <main class="login-shell">
        <section class="login-visual" aria-label="Presentazione">
          <div class="brand brand-inverse">${brandMark()}<span>${esc(APP_NAME)}</span></div>
          <div class="login-copy">
            <p class="eyebrow">Gestione immobiliare</p>
            <h1>Immobili. Persone. Controllo.</h1>
            <div class="login-features" aria-label="Funzioni principali">
              <span>Immobili e contratti</span>
              <span>Inquilini e pagamenti</span>
              <span>Documenti e manutenzioni</span>
            </div>
          </div>
          <div class="login-foot">Tutto il tuo patrimonio immobiliare, in un unico spazio.</div>
        </section>
        <section class="login-panel">
          <div class="login-card">
            <h2>${recoveringPassword ? "Nuova password" : "Accedi"}</h2>
            <p>${recoveringPassword ? "Scegli una nuova password per il tuo account." : connected ? "Entra nel tuo spazio di gestione." : "Accesso non ancora configurato."}</p>
            ${connected ? (recoveringPassword ? renderPasswordUpdateForm() : renderLoginForm()) : renderBackendSetup()}
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
          <div class="login-field-heading">
            <label for="login-password">Password</label>
            <button class="login-recovery-link" type="button" data-action="forgot-password">Password dimenticata?</button>
          </div>
          <input id="login-password" type="password" name="password" autocomplete="current-password" required placeholder="••••••••" />
        </div>
        <button class="button full" type="submit">Accedi</button>
      </form>
      `;
  }

  function renderPasswordUpdateForm() {
    return `
      <form data-form="password-recovery" class="stack">
        <div class="field">
          <label for="new-password">Nuova password</label>
          <input id="new-password" type="password" name="password" autocomplete="new-password" required minlength="8" placeholder="Almeno 8 caratteri" />
        </div>
        <div class="field">
          <label for="confirm-new-password">Conferma nuova password</label>
          <input id="confirm-new-password" type="password" name="password_confirmation" autocomplete="new-password" required minlength="8" placeholder="Ripeti la password" />
        </div>
        <button class="button full" type="submit">Salva nuova password</button>
      </form>
    `;
  }

  function renderBackendSetup() {
    return `
      <div class="info-banner"><span class="info-banner-icon">${uiIcon("lock", 19)}</span><span><strong>Accessi reali non ancora attivi.</strong> Nel file <code>config.js</code> del repository GitHub vanno inseriti il Project URL e la Publishable key del progetto Supabase.</span></div>
      <p class="row-muted">Non creare nuovi account: dopo il collegamento, gli utenti già presenti in Supabase accederanno con le loro credenziali attuali.</p>`;
  }

  function brandMark() {
    return `<span class="brand-mark" aria-hidden="true">${uiIcon("building", 24)}</span>`;
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
              <button class="button secondary" data-action="export-csv">${uiIcon("download", 16)} Esporta dati</button>
              <button class="button secondary icon-button" title="Aggiorna" aria-label="Aggiorna" data-action="refresh">${uiIcon("refresh", 18)}</button>
              ${page.action ? `<button class="button" data-action="${page.action}">${page.actionLabel.startsWith("+ ") ? `${uiIcon("plus", 16)} ${esc(page.actionLabel.slice(2))}` : page.action === "edit-property" ? `${uiIcon("edit", 16)} ${esc(page.actionLabel)}` : esc(page.actionLabel)}</button>` : ""}
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
    const active = state.activeView === item.id || (state.activeView === "tenant" && item.id === "people");
    return `<button class="nav-button ${active ? "active" : ""}" data-action="navigate" data-view="${item.id}"><span class="nav-icon">${uiIcon(item.icon, 19)}</span>${esc(item.label)}</button>`;
  }

  function mobileNavButton(item) {
    const active = state.activeView === item.id || (state.activeView === "tenant" && item.id === "people");
    return `<button class="${active ? "active" : ""}" data-action="navigate" data-view="${item.id}"><span>${uiIcon(item.icon, 20)}</span>${esc(item.label)}</button>`;
  }

  function pageMeta() {
    const tenant = getProfile(state.selectedTenantId);
    const meta = {
      dashboard: { title: "Buongiorno, Alberto", subtitle: "Panoramica del patrimonio e delle attività da seguire.", action: "add-property", actionLabel: "+ Nuovo immobile" },
      properties: { title: "Immobili", subtitle: "Schede, contratti, utenze, mutui e documenti.", action: "add-property", actionLabel: "+ Nuovo immobile" },
      property: { title: "Scheda immobile", subtitle: "Gestisci tutti i dati collegati a questa proprietà.", action: "edit-property", actionLabel: "Modifica immobile" },
      finance: { title: "Conto economico", subtitle: "Entrate e uscite per avere un quadro netto del portafoglio.", action: "add-financial", actionLabel: "+ Registra movimento" },
      maintenance: { title: "Manutenzioni", subtitle: "Fornitori, lavori eseguiti e costi di intervento.", action: "add-maintenance", actionLabel: "+ Nuovo intervento" },
      people: { title: "Persone", subtitle: "Inquilini e manutentori collegati alle proprietà.", action: "add-tenant", actionLabel: "+ Nuovo inquilino" },
      tenant: { title: tenant?.display_name || "Scheda inquilino", subtitle: "Contratti, canoni, bollette e storico personale.", action: null, actionLabel: "" },
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
      tenant: renderTenantDetail,
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
        ${kpiCard("Immobili", properties.length, `${rented} fittati · ${vacant} sfitti`, "building")}
        ${kpiCard("Canoni attesi", money(monthlyIncome), "al mese, contratti attivi", "arrowUpRight")}
        ${kpiCard("Entrate registrate", money(incomeRecorded), `nel mese di ${monthLabel(month)}`, "checkCircle")}
        ${kpiCard("Uscite registrate", money(expense), `nel mese di ${monthLabel(month)}`, "arrowDownRight")}
        ${kpiCard("Saldo del mese", money(incomeRecorded - expense), "movimenti effettivamente segnati", "pieChart", "highlight")}
      </div>
      <div class="page-grid">
        <section class="panel">
          <div class="panel-head"><div><h2>Stato degli immobili</h2><p>Apri una scheda per gestire contratti, documenti e costi.</p></div><button class="button ghost small" data-action="navigate" data-view="properties">Vedi tutti ${uiIcon("arrowRight", 15)}</button></div>
          <div class="property-list">
            ${propertyRows.map((property) => propertyRow(property)).join("") || empty("building", "Nessun immobile", "Aggiungi il primo immobile per iniziare.")}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>Portafoglio</h2><p>Distribuzione attuale.</p></div></div>
          ${occupancyPanel(properties, rented, vacant)}
        </section>
      </div>
      <div class="page-grid">
        <section class="panel">
          <div class="panel-head"><div><h2>Canoni del mese</h2><p>Contabili caricate dagli inquilini e stato di verifica.</p></div><button class="button ghost small" data-action="navigate" data-view="finance">Conto economico ${uiIcon("arrowRight", 15)}</button></div>
          <div class="property-list">
            ${payments.length ? payments.map(paymentRow).join("") : empty("coins", "Nessun canone pianificato", "I canoni compariranno qui quando associ un contratto attivo.")}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>Da seguire</h2><p>Interventi e scadenze vicine.</p></div><button class="button ghost small" data-action="navigate" data-view="maintenance">Manutenzioni ${uiIcon("arrowRight", 15)}</button></div>
          <div class="task-list">
            ${upcoming.length ? upcoming.map(taskRow).join("") : empty("checkCircle", "Tutto in ordine", "Non ci sono interventi aperti.")}
          </div>
        </section>
      </div>`;
  }

  function kpiCard(label, value, note, iconName, extraClass = "") {
    return `<article class="kpi-card ${extraClass}"><div class="kpi-label"><span>${esc(label)}</span><span class="kpi-icon">${uiIcon(iconName, 18)}</span></div><div class="kpi-value">${esc(value)}</div><div class="kpi-note">${esc(note)}</div></article>`;
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
      <button class="property-title" data-action="open-property" data-property-id="${property.id}"><span class="property-avatar">${uiIcon("building", 18)}</span><span><strong>${esc(property.name)}</strong><span>${esc(property.address)}, ${esc(property.city)}</span></span></button>
      <span class="tenant-col">${badge(property.status)}</span>
      <span class="rent-col row-number">${property.status === "rented" ? money(propertyRent(property.id)) : "—"}</span>
      <span class="row-muted">${tenants.length ? esc(tenants.map((tenant) => tenant.display_name.split(" ")[0]).join(", ")) : "Nessun inquilino"}</span>
      <span class="row-actions"><button class="row-action" aria-label="Apri ${esc(property.name)}" data-action="open-property" data-property-id="${property.id}">${uiIcon("chevronRight", 18)}</button>${deleteButton("property", property.id)}</span>
    </article>`;
  }

  function paymentRow(payment) {
    const property = getProperty(payment.property_id);
    const tenant = getProfile(payment.tenant_id);
    return `<article class="property-row">
      <div class="property-title"><span class="property-avatar">${uiIcon("euro", 18)}</span><span><strong>${esc(property?.name || "Immobile")}</strong><span>${esc(tenant?.display_name || "Inquilino")} · ${esc(monthLabel(payment.period))}</span></span></div>
      <span class="tenant-col">${badge(payment.status)}</span>
      <span class="rent-col row-number">${money(payment.amount_due)}</span>
      <span class="row-muted">Scad. ${dateLabel(payment.due_date, { day: "2-digit", month: "short" })}</span>
      <span class="row-actions"><button class="row-action" data-action="open-payment" data-payment-id="${payment.id}" aria-label="Gestisci pagamento">${uiIcon("chevronRight", 18)}</button>${deleteButton("payment", payment.id)}</span>
    </article>`;
  }

  function taskRow(job) {
    const property = getProperty(job.property_id);
    const date = new Date(`${job.scheduled_date}T12:00:00`);
    const day = Number.isNaN(date.valueOf()) ? "—" : date.getDate();
    const month = Number.isNaN(date.valueOf()) ? "" : new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date);
    return `<article class="task-row"><div class="task-date"><strong>${day}</strong>${esc(month)}</div><div class="task-copy"><strong>${esc(job.title)}</strong><span>${esc(property?.name || "Immobile")} · ${esc(getProvider(job.provider_id)?.display_name || "Fornitore non assegnato")}</span></div>${badge(job.status)}${deleteButton("maintenance", job.id)}</article>`;
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
        <label class="search"><span class="search-icon">${uiIcon("search", 17)}</span><input data-input="property-search" value="${esc(state.propertySearch)}" placeholder="Cerca per nome, città o indirizzo" /></label>
        <div class="filter-row">
          ${filterChip("all", "Tutti")}${filterChip("rented", "Fittati")}${filterChip("vacant", "Sfitti")}${filterChip("personal", "Personali")}
        </div>
      </div>
      ${properties.length ? `<div class="card-grid">${properties.map(propertyCard).join("")}</div>` : empty("building", "Nessun immobile trovato", "Modifica i filtri oppure aggiungi una nuova proprietà.")}`;
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
      <div class="card-bottom"><div class="avatar-stack">${tenants.length ? tenants.map((tenant) => `<span class="avatar" title="${esc(tenant.display_name)}">${esc(initials(tenant.display_name))}</span>`).join("") : `<span class="row-muted">Nessun inquilino</span>`}</div><div class="panel-actions"><button class="button secondary small" data-action="open-property" data-property-id="${property.id}">Apri scheda</button>${deleteButton("property", property.id)}</div></div>
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
        <div class="panel-actions"><button class="button secondary" data-action="navigate" data-view="properties">${uiIcon("arrowLeft", 16)} Immobili</button>${deleteButton("property", property.id)}</div>
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
        <section class="panel pad"><div class="section-head"><div><h2>Azioni rapide</h2><p>Aggiorna gli elementi più frequenti.</p></div></div><div class="stack"><button class="button secondary full" data-action="add-document" data-property-id="${property.id}">${uiIcon("fileUpload", 17)} Carica documento</button><button class="button secondary full" data-action="add-utility" data-property-id="${property.id}">${uiIcon("plus", 17)} Registra utenza/bolletta</button><button class="button secondary full" data-action="add-maintenance" data-property-id="${property.id}">${uiIcon("plus", 17)} Registra intervento</button></div></section>
      </div>
    </div>`;
  }

  function renderPropertyTenants(property) {
    const leases = state.data.leases.filter((lease) => lease.property_id === property.id);
    return `<section class="panel"><div class="panel-head"><div><h2>Inquilini e contratti</h2><p>Una locazione può contenere più inquilini, ognuno con il proprio profilo di accesso.</p></div><div class="panel-actions"><button class="button secondary small" data-action="add-tenant" data-property-id="${property.id}">${uiIcon("plus", 15)} Collega inquilino</button><button class="button small" data-action="add-payment" data-property-id="${property.id}">${uiIcon("plus", 15)} Canone</button></div></div>
      ${leases.length ? leases.map((lease) => leaseCard(lease)).join("") : empty("users", "Nessun contratto attivo", "Collega un inquilino per creare il primo contratto.")}
    </section>`;
  }

  function leaseCard(lease) {
    const tenants = (lease.tenant_ids || []).map(getProfile).filter(Boolean);
    return `<div style="padding:0 20px 20px"><div class="panel pad" style="box-shadow:none;border-radius:14px"><div class="section-head"><div><h2>${esc(lease.contract_reference || "Contratto di locazione")}</h2><p>${dateLabel(lease.start_date)} — ${dateLabel(lease.end_date)} · Scadenza canone giorno ${esc(lease.due_day)}</p></div><div class="panel-actions">${badge(lease.status === "active" ? "active" : lease.status)}${deleteButton("lease", lease.id)}</div></div><div class="detail-grid"><article class="data-tile"><span>Canone mensile</span><strong>${money(lease.monthly_rent)}</strong></article><article class="data-tile"><span>Deposito</span><strong>${money(lease.deposit)}</strong></article><article class="data-tile"><span>Inquilini</span><strong>${tenants.length}</strong></article></div><div class="detail-list" style="margin-top:13px">${tenants.map((tenant) => `<div class="detail-list-row"><span><strong style="text-align:left">${esc(tenant.display_name)}</strong><br><small>${esc(tenant.email || tenant.username || "")}</small></span><span>${esc(tenant.phone || "—")}</span></div>`).join("")}</div></div></div>`;
  }

  function renderPropertyFinance(property) {
    const entries = state.data.financial_entries.filter((entry) => entry.property_id === property.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const income = entries.filter((entry) => entry.direction === "income").reduce((sum, entry) => sum + Number(entry.amount), 0);
    const expenses = entries.filter((entry) => entry.direction === "expense").reduce((sum, entry) => sum + Number(entry.amount), 0);
    return `<div class="stack"><section class="detail-grid"><article class="data-tile"><span>Entrate registrate</span><strong>${money(income)}</strong></article><article class="data-tile"><span>Uscite registrate</span><strong>${money(expenses)}</strong></article><article class="data-tile"><span>Saldo storico</span><strong>${money(income - expenses)}</strong></article></section><section class="panel"><div class="panel-head"><div><h2>Movimenti dell’immobile</h2><p>Canoni, rate, manutenzioni, condominio e altri costi.</p></div><button class="button small" data-action="add-financial" data-property-id="${property.id}">${uiIcon("plus", 15)} Movimento</button></div>${financeTable(entries)}</section></div>`;
  }

  function renderPropertyUtilities(property) {
    const utilities = state.data.utility_accounts.filter((utility) => utility.property_id === property.id);
    const bills = state.data.utility_bills.filter((bill) => bill.property_id === property.id).sort((a, b) => String(b.period).localeCompare(String(a.period)));
    return `<div class="stack"><section class="panel"><div class="panel-head"><div><h2>Utenze</h2><p>Indica chi è intestatario e se il costo viene riaddebitato agli inquilini.</p></div><button class="button small" data-action="add-utility" data-property-id="${property.id}">${uiIcon("plus", 16)} Utenza o bolletta</button></div>${utilities.length ? `<div class="table-wrap"><table><thead><tr><th>Utenza</th><th>Fornitore</th><th>Intestata a</th><th>Riaddebito</th><th>Azioni</th></tr></thead><tbody>${utilities.map((utility) => `<tr><td><strong>${esc(utility.kind)}</strong><br><small>${esc(utility.contract_code || "")}</small></td><td>${esc(utility.provider || "—")}</td><td>${utility.holder === "owner" ? "Proprietario" : "Inquilino"}</td><td>${utility.recharged_to_tenant ? "Sì" : "No"}</td><td>${deleteButton("utility", utility.id)}</td></tr>`).join("")}</tbody></table></div>` : empty("utility", "Nessuna utenza censita", "Aggiungi luce, gas, acqua, condominio o altri servizi.")}</section><section class="panel"><div class="panel-head"><div><h2>Bollettini e scadenze</h2><p>Documenta le fatture anche quando il contratto non è intestato all’inquilino.</p></div></div>${bills.length ? `<div class="table-wrap"><table><thead><tr><th>Periodo</th><th>Utenza</th><th>Scadenza</th><th>Importo</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>${bills.map((bill) => `<tr><td>${esc(monthLabel(bill.period))}</td><td>${esc(state.data.utility_accounts.find((utility) => utility.id === bill.utility_id)?.kind || "Utenza")}</td><td>${dateLabel(bill.due_date)}</td><td class="number">${money(bill.amount)}</td><td>${badge(bill.status)}</td><td>${deleteButton("utility-bill", bill.id)}</td></tr>`).join("")}</tbody></table></div>` : empty("fileText", "Nessuna bolletta", "Le nuove bollette saranno archiviate qui.")}</section></div>`;
  }

  function renderPropertyDocuments(property) {
    const docs = state.data.documents.filter((document) => document.property_id === property.id).sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)));
    return `<section class="panel"><div class="panel-head"><div><h2>Archivio documenti</h2><p>Contratti, verbali, bollette, mutui e documentazione di manutenzione.</p></div><button class="button small" data-action="add-document" data-property-id="${property.id}">${uiIcon("fileUpload", 16)} Carica file</button></div>${docs.length ? `<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Categoria</th><th>Caricato</th><th>Visibilità inquilino</th><th>Azioni</th></tr></thead><tbody>${docs.map((document) => `<tr><td><strong>${esc(document.name)}</strong></td><td>${esc(document.category)}</td><td>${dateLabel(document.uploaded_at)}</td><td>${document.visible_to_tenant ? badge("active") : "<span class=\"row-muted\">Solo admin</span>"}</td><td>${deleteButton("document", document.id)}</td></tr>`).join("")}</tbody></table></div>` : empty("fileText", "Archivio vuoto", "Carica il contratto o qualsiasi documento utile per la gestione.")}</section>`;
  }

  function renderPropertyMortgage(property) {
    const mortgage = getMortgage(property.id);
    if (!mortgage) return `<section class="panel">${empty("building", "Nessun mutuo registrato", "Puoi aggiungerlo dalla sezione mutuo quando attiveremo la configurazione completa del backend.")}</section>`;
    const paid = Math.max(0, Number(mortgage.original_amount) - Number(mortgage.remaining_amount));
    const percent = mortgage.original_amount ? Math.round((paid / mortgage.original_amount) * 100) : 0;
    return `<section class="panel pad"><div class="section-head"><div><h2>Mutuo</h2><p>${esc(mortgage.lender)} · scadenza ${dateLabel(mortgage.end_date)}</p></div>${deleteButton("mortgage", mortgage.id)}</div><div class="detail-grid"><article class="data-tile"><span>Importo iniziale</span><strong>${money(mortgage.original_amount)}</strong></article><article class="data-tile"><span>Residuo</span><strong>${money(mortgage.remaining_amount)}</strong></article><article class="data-tile"><span>Rata mensile</span><strong>${money(mortgage.monthly_payment)}</strong></article><article class="data-tile"><span>Tasso</span><strong>${decimal(mortgage.rate)}%</strong></article><article class="data-tile"><span>Scadenza rata</span><strong>Giorno ${esc(mortgage.due_day)}</strong></article><article class="data-tile"><span>Capitale rimborsato</span><strong>${percent}%</strong></article></div></section>`;
  }

  function renderPropertyMaintenance(property) {
    const jobs = state.data.maintenance_jobs.filter((job) => job.property_id === property.id).sort((a, b) => String(b.scheduled_date).localeCompare(String(a.scheduled_date)));
    return `<section class="panel"><div class="panel-head"><div><h2>Interventi</h2><p>Ogni intervento conserva attività svolta, fornitore e costo.</p></div><button class="button small" data-action="add-maintenance" data-property-id="${property.id}">${uiIcon("plus", 16)} Intervento</button></div>${jobs.length ? maintenanceTable(jobs) : empty("wrench", "Nessun intervento", "Registra qui le chiamate a elettricisti, idraulici, muratori e altri manutentori.")}</section>`;
  }

  function renderPropertyPermissions(property) {
    const tenants = getTenantsForProperty(property.id);
    if (!tenants.length) return `<section class="panel">${empty("users", "Nessun inquilino collegato", "Prima collega un inquilino o un contratto, poi potrai decidere cosa vede nel suo portale.")}</section>`;
    return `<section class="panel"><div class="panel-head"><div><h2>Visibilità del portale inquilino</h2><p>Questi permessi vengono applicati separatamente per ogni persona collegata all’immobile.</p></div></div><div style="padding:0 20px 20px" class="stack">${tenants.map((tenant) => permissionCard(property, tenant)).join("")}</div></section>`;
  }

  function permissionCard(property, tenant) {
    const permissions = getPermissions(property.id, tenant.id);
    const savedPermission = state.data.tenant_permissions.find((item) => item.property_id === property.id && item.tenant_id === tenant.id);
    return `<div class="panel pad" style="box-shadow:none;border-radius:14px"><div class="section-head"><div><h2>${esc(tenant.display_name)}</h2><p>${esc(tenant.email || tenant.username || "Profilo inquilino")}</p></div><div class="panel-actions"><button class="button secondary small" data-action="edit-permissions" data-property-id="${property.id}" data-tenant-id="${tenant.id}">Modifica</button>${deleteButton("permission", savedPermission?.id)}</div></div><div class="permission-grid"><div class="permission"><span>${permissions.show_documents ? uiIcon("check", 14) : "—"}</span><span><strong>Documenti</strong><span>Documenti abilitati</span></span></div><div class="permission"><span>${permissions.show_utilities ? uiIcon("check", 14) : "—"}</span><span><strong>Utenze</strong><span>Bollettini e scadenze</span></span></div><div class="permission"><span>${permissions.show_maintenance ? uiIcon("check", 14) : "—"}</span><span><strong>Interventi</strong><span>Stato manutenzioni</span></span></div><div class="permission"><span>${permissions.allow_payment_upload ? uiIcon("check", 14) : "—"}</span><span><strong>Contabili</strong><span>Caricamento pagamento</span></span></div></div></div>`;
  }

  function renderFinance() {
    const month = isoMonth();
    const entries = [...state.data.financial_entries].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const income = totalFor("income", month);
    const costs = totalFor("expense", month);
    const scheduledRent = expectedMonthlyRent();
    return `<div class="kpi-grid"><article class="kpi-card"><div class="kpi-label"><span>Canoni attesi</span><span class="kpi-icon">${uiIcon("arrowUpRight", 18)}</span></div><div class="kpi-value">${money(scheduledRent)}</div><div class="kpi-note">contratti attivi</div></article><article class="kpi-card"><div class="kpi-label"><span>Entrate mese</span><span class="kpi-icon">${uiIcon("checkCircle", 18)}</span></div><div class="kpi-value">${money(income)}</div><div class="kpi-note">già registrate</div></article><article class="kpi-card"><div class="kpi-label"><span>Uscite mese</span><span class="kpi-icon">${uiIcon("arrowDownRight", 18)}</span></div><div class="kpi-value">${money(costs)}</div><div class="kpi-note">già registrate</div></article><article class="kpi-card highlight"><div class="kpi-label"><span>Saldo mese</span><span class="kpi-icon">${uiIcon("pieChart", 18)}</span></div><div class="kpi-value">${money(income - costs)}</div><div class="kpi-note">movimenti effettivi</div></article><article class="kpi-card"><div class="kpi-label"><span>Valore stimato</span><span class="kpi-icon">${uiIcon("building", 18)}</span></div><div class="kpi-value">${money(state.data.properties.reduce((sum,p) => sum + Number(p.estimated_value || 0), 0))}</div><div class="kpi-note">portafoglio immobiliare</div></article></div><section class="panel" style="margin-top:20px"><div class="panel-head"><div><h2>Movimenti</h2><p>Inserisci ogni entrata e uscita; poi esporta un CSV per consulente o commercialista.</p></div><button class="button small" data-action="add-financial">${uiIcon("plus", 15)} Registra movimento</button></div>${financeTable(entries)}</section>`;
  }

  function financeTable(entries) {
    return entries.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Immobile</th><th>Categoria</th><th>Tipo</th><th>Importo</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>${entries.map((entry) => `<tr><td>${dateLabel(entry.date)}</td><td><strong>${esc(getProperty(entry.property_id)?.name || "Generale")}</strong></td><td>${esc(entry.category)}</td><td>${entry.direction === "income" ? "Entrata" : "Uscita"}</td><td class="number" style="color:${entry.direction === "income" ? "#087468" : "#b54d4d"}">${entry.direction === "income" ? "+" : "−"} ${money(entry.amount)}</td><td>${badge(entry.status || "paid")}</td><td>${deleteButton("financial", entry.id)}</td></tr>`).join("")}</tbody></table></div>` : empty("coins", "Nessun movimento", "Registra il primo costo o la prima entrata.");
  }

  function renderMaintenance() {
    const jobs = [...state.data.maintenance_jobs].sort((a, b) => String(b.scheduled_date).localeCompare(String(a.scheduled_date)));
    const providers = state.data.service_providers;
    return `<div class="split"><section class="panel"><div class="panel-head"><div><h2>Interventi</h2><p>Lavoro svolto, costo e fornitore rimangono collegati alla proprietà.</p></div><button class="button small" data-action="add-maintenance">${uiIcon("plus", 15)} Intervento</button></div>${jobs.length ? maintenanceTable(jobs) : empty("wrench", "Nessun intervento", "Quando chiami un manutentore, registra qui attività e preventivo.")}</section><section class="panel"><div class="panel-head"><div><h2>Rubrica manutentori</h2><p>Elettricisti, idraulici, muratori e altri professionisti.</p></div><button class="button secondary small" data-action="add-provider">${uiIcon("plus", 15)} Fornitore</button></div><div class="task-list">${providers.length ? providers.map(providerCard).join("") : empty("users", "Rubrica vuota", "Aggiungi il primo manutentore.")}</div></section></div>`;
  }

  function maintenanceTable(jobs) {
    return `<div class="table-wrap"><table><thead><tr><th>Intervento</th><th>Immobile</th><th>Fornitore</th><th>Data</th><th>Costo</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>${jobs.map((job) => `<tr><td><strong>${esc(job.title)}</strong><br><small>${esc(job.category || "")}</small></td><td>${esc(getProperty(job.property_id)?.name || "—")}</td><td>${esc(getProvider(job.provider_id)?.display_name || "Non assegnato")}</td><td>${dateLabel(job.completed_date || job.scheduled_date)}</td><td class="number">${job.total_cost ? money(job.total_cost) : "—"}</td><td>${badge(job.status)}</td><td>${deleteButton("maintenance", job.id)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function providerCard(provider) {
    return `<article class="task-row"><span class="property-avatar">${esc(initials(provider.display_name))}</span><div class="task-copy"><strong>${esc(provider.display_name)}</strong><span>${esc(provider.category)}${provider.company_name ? ` · ${esc(provider.company_name)}` : ""}<br>${esc(provider.phone || provider.email || "")}</span></div>${deleteButton("provider", provider.id)}</article>`;
  }

  function renderPeople() {
    const tenants = [...new Map(
      state.data.profiles
        .filter((profile) => profile.role === "tenant")
        .map((profile) => [profile.id, profile])
    ).values()];
    const providers = state.data.service_providers;
    return `<div class="split"><section class="panel"><div class="panel-head"><div><h2>Inquilini</h2><p>Apri una scheda per consultare contratto, canoni e bollette di ogni persona.</p></div><button class="button small" data-action="add-tenant">${uiIcon("plus", 15)} Nuovo inquilino</button></div>${tenants.length ? `<div class="table-wrap"><table><thead><tr><th>Inquilino</th><th>Immobile</th><th>Contatto</th><th>Profilo</th><th>Azioni</th></tr></thead><tbody>${tenants.map((tenant) => { const properties = tenantProperties(tenant.id); return `<tr><td><strong>${esc(tenant.display_name)}</strong><br><small>@${esc(tenant.username || "utente")}</small></td><td>${properties.length ? properties.map((property) => esc(property.name)).join("<br>") : "—"}</td><td>${esc(tenant.phone || tenant.email || "—")}</td><td>${badge("active")}</td><td><div class="panel-actions"><button class="button secondary small" data-action="open-tenant" data-tenant-id="${esc(tenant.id)}">Apri scheda</button>${deleteButton("tenant", tenant.id)}</div></td></tr>`; }).join("")}</tbody></table></div>` : empty("users", "Nessun inquilino", "Crea un profilo e poi collegalo a un contratto.")}</section><section class="panel"><div class="panel-head"><div><h2>Manutentori</h2><p>Profili professionali riutilizzabili per ogni casa.</p></div><button class="button secondary small" data-action="add-provider">${uiIcon("plus", 15)} Fornitore</button></div><div class="task-list">${providers.length ? providers.map(providerCard).join("") : empty("wrench", "Nessun manutentore", "Aggiungi la tua rubrica di fiducia.")}</div></section></div>`;
  }

  function renderTenantDetail() {
    const tenant = getProfile(state.selectedTenantId);
    if (!tenant) return `<section class="panel">${empty("users", "Inquilino non trovato", "Torna all’elenco e seleziona una scheda valida.")}<div style="padding:0 20px 20px"><button class="button secondary" data-action="navigate" data-view="people">${uiIcon("arrowLeft", 16)} Torna a Persone</button></div></section>`;

    const leases = getTenantLeases(tenant.id).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
    const ledger = leases.flatMap(leaseRentLedger).sort((a, b) => String(b.period).localeCompare(String(a.period)));
    const dueRows = ledger.filter((row) => row.dueDate <= dateISO());
    const paidRows = dueRows.filter((row) => row.status === "paid");
    const outstanding = dueRows.reduce((sum, row) => sum + Math.max(0, row.amountDue - row.amountPaid), 0);
    const activeLeases = leases.filter((lease) => lease.status === "active");
    const activeRent = activeLeases.reduce((sum, lease) => sum + Number(lease.monthly_rent || 0), 0);
    const nextEnd = activeLeases.map((lease) => lease.end_date).filter(Boolean).sort()[0];
    const propertyIds = [...new Set(leases.map((lease) => lease.property_id))];
    const tenantUtilities = state.data.utility_accounts.filter((utility) => propertyIds.includes(utility.property_id) && (utility.recharged_to_tenant || utility.holder === "tenant"));
    const utilityIds = new Set(tenantUtilities.map((utility) => utility.id));
    const bills = state.data.utility_bills
      .filter((bill) => propertyIds.includes(bill.property_id) && utilityIds.has(bill.utility_id))
      .sort((a, b) => String(b.period).localeCompare(String(a.period)));
    const utilitySection = tenantUtilities.length
      ? `<section class="panel"><div class="panel-head"><div><h2>Bollette dell’inquilino</h2><p>Utenze intestate all’inquilino o riaddebitate dall’amministratore.</p></div></div><div class="callout history-note">Le bollette sono associate all’immobile, non a un singolo coinquilino: se il contratto è condiviso lo stato vale per la casa.</div>${bills.length ? `<div class="table-wrap"><table><thead><tr><th>Periodo</th><th>Immobile</th><th>Utenza</th><th>Scadenza</th><th>Importo</th><th>Stato</th><th></th></tr></thead><tbody>${bills.map((bill) => tenantUtilityBillRow(bill, tenantUtilities)).join("")}</tbody></table></div>` : empty("fileText", "Nessuna bolletta registrata", "Le bollette collegate a queste utenze compariranno qui.")}</section>`
      : `<section class="panel">${empty("utility", "Nessuna utenza riaddebitata", "Nella scheda dell’immobile indica quali utenze vengono riaddebitate all’inquilino.")}</section>`;

    return `<div class="stack">
      <button class="button ghost small back-link" data-action="navigate" data-view="people">${uiIcon("arrowLeft", 16)} Torna a Persone</button>
      <section class="property-hero tenant-profile-hero"><div><div class="eyebrow">SCHEDA INQUILINO</div><h2>${esc(tenant.display_name)}</h2><p>${esc(tenant.email || tenant.username || "Profilo inquilino")}${tenant.phone ? ` · ${esc(tenant.phone)}` : ""}</p><div class="property-hero-meta"><span class="hero-pill">${leases.length} ${leases.length === 1 ? "contratto" : "contratti"}</span><span class="hero-pill">${propertyIds.length} ${propertyIds.length === 1 ? "immobile" : "immobili"}</span></div></div><div class="panel-actions">${activeLeases.length ? `<button class="button hero-action" data-action="add-payment" data-property-id="${esc(activeLeases[0].property_id)}" data-lease-id="${esc(activeLeases[0].id)}">${uiIcon("plus", 15)} Registra canone</button>` : ""}${deleteButton("tenant", tenant.id)}</div></section>
      <section class="detail-grid tenant-summary-grid">
        <article class="data-tile"><span>Canone mensile attivo</span><strong>${activeLeases.length ? money(activeRent) : "Nessun contratto attivo"}</strong></article>
        <article class="data-tile"><span>Fine contratto più vicina</span><strong>${nextEnd ? dateLabel(nextEnd) : "—"}</strong></article>
        <article class="data-tile"><span>Mesi pagati / scaduti</span><strong>${paidRows.length} / ${dueRows.length}</strong></article>
        <article class="data-tile"><span>Residuo atteso da verificare</span><strong>${money(outstanding)}</strong></article>
      </section>
      <section class="panel"><div class="panel-head"><div><h2>Contratti</h2><p>Data di ingresso, scadenza e importo pattuito.</p></div></div>${leases.length ? `<div class="contract-list">${leases.map((lease) => `<article class="contract-summary"><div class="section-head"><div><h3>${esc(lease.contract_reference || getProperty(lease.property_id)?.name || "Contratto di locazione")}</h3><p>${esc(getProperty(lease.property_id)?.name || "Immobile non disponibile")} · ${dateLabel(lease.start_date)} — ${dateLabel(lease.end_date)}</p></div><div class="panel-actions">${badge(lease.status === "active" ? "active" : lease.status)}${deleteButton("lease", lease.id)}</div></div><div class="detail-grid"><article class="data-tile"><span>Canone mensile</span><strong>${money(lease.monthly_rent)}</strong></article><article class="data-tile"><span>Deposito</span><strong>${money(lease.deposit)}</strong></article><article class="data-tile"><span>Scadenza mensile</span><strong>Giorno ${esc(lease.due_day || "—")}</strong></article></div></article>`).join("")}</div>` : empty("fileText", "Nessun contratto collegato", "Collega l’inquilino a un contratto dalla scheda dell’immobile.")}</section>
      <section class="panel"><div class="panel-head"><div><h2>Storico canoni</h2><p>Una riga per ogni mese del contratto. I mesi senza registrazione sono da verificare.</p></div></div>${ledger.length ? `<div class="callout history-note">Se più inquilini condividono lo stesso contratto, importo e stato del canone sono riferiti al contratto condiviso.</div><div class="table-wrap"><table><thead><tr><th>Periodo</th><th>Immobile</th><th>Scadenza</th><th>Dovuto</th><th>Pagato</th><th>Stato</th><th></th></tr></thead><tbody>${ledger.map((row) => rentLedgerRow(row)).join("")}</tbody></table></div>` : empty("coins", "Nessuno storico canoni", "Le rate mensili compariranno qui quando è presente un contratto.")}</section>
      ${utilitySection}
    </div>`;
  }

  function rentLedgerRow(row) {
    let action = "";
    if (!row.payment && row.status !== "upcoming") {
      action = `<button class="button secondary small" data-action="add-payment" data-property-id="${esc(row.lease.property_id)}" data-lease-id="${esc(row.lease.id)}" data-period="${esc(row.period)}" data-due-date="${esc(row.dueDate)}">Registra canone</button>`;
    } else if (row.payment) {
      const statusAction = row.status !== "cancelled"
        ? `<button class="button secondary small" data-action="set-rent-payment-status" data-lease-id="${esc(row.lease.id)}" data-period="${esc(row.period)}" data-status="${row.status === "paid" ? "pending" : "paid"}">${row.status === "paid" ? "Riapri" : "Segna pagato"}</button>`
        : "";
      action = `<div class="panel-actions">${statusAction}${deleteButton("payment", row.payment.id)}</div>`;
    }
    return `<tr><td><strong>${esc(monthLabel(row.period))}</strong><br><small>${esc(row.lease.contract_reference || "Contratto")}</small></td><td>${esc(getProperty(row.lease.property_id)?.name || "—")}</td><td>${dateLabel(row.dueDate)}</td><td class="number">${money(row.amountDue)}</td><td class="number">${money(row.amountPaid)}</td><td>${badge(row.status)}${row.status === "missing" ? `<br><small>da verificare</small>` : ""}</td><td>${action}</td></tr>`;
  }

  function tenantUtilityBillRow(bill, utilities) {
    const utility = utilities.find((item) => item.id === bill.utility_id);
    const nextStatus = bill.status === "paid" ? "pending" : "paid";
    return `<tr><td>${esc(monthLabel(bill.period))}</td><td>${esc(getProperty(bill.property_id)?.name || "—")}</td><td>${esc(utility?.kind || "Utenza")}</td><td>${dateLabel(bill.due_date)}</td><td class="number">${money(bill.amount)}</td><td>${badge(bill.status)}</td><td><div class="panel-actions"><button class="button secondary small" data-action="set-utility-bill-status" data-bill-id="${esc(bill.id)}" data-status="${nextStatus}">${bill.status === "paid" ? "Segna da pagare" : "Segna pagata"}</button>${deleteButton("utility-bill", bill.id)}</div></td></tr>`;
  }

  function renderSettings() {
    const tenants = [...new Map(state.data.profiles.filter((profile) => profile.role === "tenant").map((profile) => [profile.id, profile])).values()];
    return `<div class="stack">
      ${renderExcelImportCard()}
      ${renderBankTransferCard(tenants)}
      <section class="panel pad"><div class="section-head"><div><h2>Ruoli e permessi</h2><p>Gli accessi sono determinati dal ruolo dell’account e dalle autorizzazioni associate.</p></div></div><div class="role-grid">
        <article class="role-card role-admin"><div class="role-title"><span class="role-mark">A</span><div><h3>Admin</h3><small>Amministratore</small></div></div><p>Gestisce immobili, persone, contratti, canoni, utenze e impostazioni. Può eliminare inquilini o immobili dopo la verifica esplicita.</p></article>
        <article class="role-card"><div class="role-title"><span class="role-mark">I</span><div><h3>Inquilino</h3><small>Accesso personale</small></div></div><p>Consulta solo gli immobili e le sezioni abilitate dall’amministratore; può inviare le proprie contabili. Non può modificare o cancellare i dati gestionali.</p></article>
        <article class="role-card"><div class="role-title"><span class="role-mark">M</span><div><h3>Manutentore</h3><small>Interventi assegnati</small></div></div><p>Può consultare gli interventi che gli sono stati assegnati. Non accede a canoni, dati patrimoniali o funzioni di cancellazione.</p></article>
      </div><div class="callout" style="margin-top:16px">Solo l’account con ruolo <strong>Admin</strong> può gestire e cancellare i dati. Le autorizzazioni del database verificano il ruolo anche quando l’utente opera dal sito.</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Eliminazione dati</h2><p>Ogni voce richiede una conferma digitata prima della cancellazione.</p></div></div><div class="settings-delete-grid">
        <section class="delete-group"><div class="section-head"><div><h3>Inquilini</h3><p>Rimuove accesso e profilo; i pagamenti storici restano anonimizzati.</p></div></div>${deleteManagementTable(tenants, "tenant")}</section>
        <section class="delete-group"><div class="section-head"><div><h3>Immobili</h3><p>Elimina anche contratti, canoni, utenze, documenti e interventi collegati.</p></div></div>${deleteManagementTable(state.data.properties, "property")}</section>
      </div><div class="callout warning delete-warning">La cancellazione è permanente. Per gli immobili, i movimenti economici collegati restano nello storico senza l’associazione alla casa.</div></section>
      <div class="split"><section class="panel pad"><div class="section-head"><div><h2>Stato della piattaforma</h2><p>Connessione e archivio dati.</p></div></div><div class="detail-list"><div class="detail-list-row"><span>Modalità attuale</span><strong>${isDemo() ? "Demo locale" : "Backend collegato"}</strong></div><div class="detail-list-row"><span>Autenticazione</span><strong>${supabaseClient ? "Configurata" : "Da configurare"}</strong></div><div class="detail-list-row"><span>Archivio documenti</span><strong>${supabaseClient ? "Storage privato" : "Solo metadati demo"}</strong></div><div class="detail-list-row"><span>Il tuo ruolo</span><strong>${esc(state.profile?.role === "admin" ? "Admin" : state.profile?.role || "Locale")}</strong></div></div><div class="callout" style="margin-top:18px">In modalità demo i dati restano in questo browser. Con Supabase, l’accesso ai dati condivisi è verificato dalle policy del database.</div></section><section class="panel pad"><div class="section-head"><div><h2>Azioni</h2><p>Esportazione e gestione della sessione.</p></div></div><div class="stack"><button class="button secondary full" data-action="export-csv">${uiIcon("download", 16)} Esporta tutti i dati in CSV</button><button class="button secondary full" data-action="show-architecture">${uiIcon("dashboard", 16)} Vedi architettura</button>${isDemo() ? `<button class="button danger full" data-action="reset-demo">Ripristina dati demo</button>` : `<button class="button danger full" data-action="logout">Esci dall’account</button>`}</div></section></div>
    </div>`;
  }

  function renderExcelImportCard() {
    if (state.profile?.role !== "admin") return "";
    const connected = Boolean(supabaseClient && state.sessionUser);
    return `<section class="panel pad"><div class="section-head"><div><h2>Carica dati da Excel</h2><p>Importa immobili, utenze e bollette dal file di verifica, dopo aver marcato le righe da caricare.</p></div><button class="button" data-action="open-excel-import" ${connected ? "" : "disabled"}>Scegli file Excel</button></div><p class="small-note">${connected ? "L’importazione mostra prima un riepilogo, ignora i duplicati e salva nel database Supabase." : "Per importare serve una sessione Admin collegata a Supabase."} Contratti, inquilini, spese aggregate e proposte di quote non vengono creati automaticamente.</p></section>`;
  }

  function renderBankTransferCard(tenants) {
    if (state.profile?.role !== "admin") return "";
    const aliases = [...(state.data.tenant_bank_sender_aliases || [])].sort((a, b) => a.sender_name.localeCompare(b.sender_name, "it"));
    const events = [...(state.data.bank_transfer_events || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 12);
    const aliasRows = aliases.length ? `<div class="table-wrap"><table><thead><tr><th>Ordinante email</th><th>Inquilino abbinato</th><th></th></tr></thead><tbody>${aliases.map((alias) => `<tr><td>${esc(alias.sender_name)}</td><td>${esc(getProfile(alias.tenant_id)?.display_name || "Profilo non trovato")}</td><td><button class="button danger small" type="button" data-action="remove-bank-sender-alias" data-alias-id="${esc(alias.id)}">Rimuovi</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="row-muted">Non hai ancora associato ordinanti.</p>`;
    const eventRows = events.length ? `<div class="table-wrap"><table><thead><tr><th>Accredito</th><th>Ordinante</th><th>Ricevuto</th><th>Canone atteso</th><th>Esito</th></tr></thead><tbody>${events.map((item) => `<tr><td>${dateLabel(item.credited_on)}</td><td>${esc(getProfile(item.tenant_id)?.display_name || item.sender_name)}</td><td class="number">${money(item.amount)}</td><td class="number">${item.expected_amount == null ? "—" : money(item.expected_amount)}</td><td>${badge(item.status === "matched" ? "paid" : item.status)}${item.review_reason ? `<br><small>${esc(item.review_reason)}</small>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="row-muted">Le notifiche ricevute compariranno qui.</p>`;
    const tenantOptions = tenants.map((tenant) => [tenant.id, `${tenant.display_name}${tenant.email ? ` · ${tenant.email}` : ""}`]);
    return `<section class="panel pad"><div class="section-head"><div><h2>Bonifici in ingresso da Gmail</h2><p>Associa il nome “Ordinante” della notifica Fineco all’inquilino. L’importo identico al canone aperto aggiorna il pagamento; importi diversi restano gialli da verificare.</p></div></div><form data-form="bank-sender-alias" class="form-grid"><div class="field"><label for="bank-alias-tenant">Inquilino</label><select id="bank-alias-tenant" name="tenant_id" required><option value="">Seleziona inquilino</option>${tenantOptions.map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join("")}</select></div><div class="field"><label for="bank-alias-name">Ordinante come appare nell’email</label><input id="bank-alias-name" name="sender_name" required placeholder="es. Roberto Antonella" /></div><div class="field" style="align-self:end"><button class="button" type="submit" ${supabaseClient && state.sessionUser ? "" : "disabled"}>Salva abbinamento</button></div></form><p class="small-note">Gmail controlla ogni 5 minuti solo le notifiche Fineco con oggetto “bonifico in ingresso” e invia al backend ordinante, data e importo. Il testo completo della mail non viene salvato.</p><div class="section-head" style="margin-top:20px"><div><h3>Abbinamenti attivi</h3></div></div>${aliasRows}<div class="section-head" style="margin-top:22px"><div><h3>Bonifici ricevuti</h3><p>Verde = canone aggiornato; giallo = importo o abbinamento da verificare.</p></div></div>${eventRows}</section>`;
  }

  function importText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLocaleLowerCase("it-IT")
      .replace(/\s+/g, " ");
  }

  function excelValue(row, header) {
    return row?.values?.[header] ?? "";
  }

  function importNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined || String(value).trim() === "") return null;
    let text = String(value).trim().replace(/[€\s]/g, "");
    if (text.includes(",") && text.includes(".")) text = text.replaceAll(".", "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replaceAll(".", "");
    else text = text.replace(",", ".");
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function importDate(value) {
    if (value instanceof Date && !Number.isNaN(value.valueOf())) {
      return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
    }
    if (typeof value === "number" && window.XLSX?.SSF?.parse_date_code) {
      const parts = window.XLSX.SSF.parse_date_code(value);
      if (parts) return parts.y + "-" + String(parts.m).padStart(2, "0") + "-" + String(parts.d).padStart(2, "0");
    }
    const text = String(value ?? "").trim();
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return iso[1] + "-" + String(iso[2]).padStart(2, "0") + "-" + String(iso[3]).padStart(2, "0");
    const italian = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (italian) return italian[3] + "-" + String(italian[2]).padStart(2, "0") + "-" + String(italian[1]).padStart(2, "0");
    return "";
  }

  async function stableExcelId(namespace, key) {
    if (!window.crypto?.subtle) throw new Error("Il browser non supporta l’importazione sicura. Usa il sito aggiornato con connessione HTTPS.");
    const input = new TextEncoder().encode(namespace + "|" + key);
    const digest = new Uint8Array(await window.crypto.subtle.digest("SHA-256", input));
    const bytes = [...digest.slice(0, 16)];
    bytes[6] = (bytes[6] & 0x0f) | 0x80;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.map((value) => value.toString(16).padStart(2, "0")).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20, 32);
  }

  function importPropertyStatus(value) {
    const status = importText(value);
    const map = { rented: "rented", fittata: "rented", vacant: "vacant", sfitta: "vacant", personal: "personal", personale: "personal", maintenance: "maintenance", "in manutenzione": "maintenance" };
    return map[status] || "";
  }

  function importBillStatus(value) {
    const status = importText(value);
    const map = { pending: "pending", "da pagare": "pending", paid: "paid", pagato: "paid", partial: "partial", parziale: "partial", late: "late", "in ritardo": "late", cancelled: "cancelled", annullato: "cancelled" };
    return map[status] || "";
  }

  function importPropertyKey(property) {
    return [property.name, property.address, property.city].map(importText).join("|");
  }

  function importAccountDuplicate(saved, next) {
    if (saved.property_id !== next.property_id ||
        importText(saved.kind) !== importText(next.kind) ||
        importText(saved.provider) !== importText(next.provider)) return false;
    const oldCode = importText(saved.contract_code);
    const newCode = importText(next.contract_code);
    return !oldCode || !newCode || oldCode === newCode;
  }

  function importBillDuplicate(saved, next) {
    return saved.utility_id === next.utility_id &&
      String(saved.period || "").slice(0, 7) === next.period.slice(0, 7) &&
      Number(saved.amount) === Number(next.amount);
  }

  function markImportRow(row, status, reason, ready = false, item = null) {
    row.status = status;
    row.reason = reason || "";
    row.ready = ready;
    row.item = item;
  }

  function canSelectExcelImportRow(row) {
    return !row.imported && !row.alreadyPresent && row.status !== "Già presente" && row.status !== "Duplicata nel file";
  }

  function excelImportRows(plan, kind) {
    return plan?.[{ property: "properties", account: "accounts", bill: "bills" }[kind]] || [];
  }

  function setExcelImportRowSelection(kind, index, selected) {
    const plan = pendingExcelImport;
    const row = excelImportRows(plan, kind)[index];
    if (!row || !canSelectExcelImportRow(row)) return;
    row.selected = Boolean(selected);

    if (row.selected && kind === "account" && row.ready) {
      const parentProperty = plan.properties.find((property) => property.ready && property.item?.id === row.item?.property_id);
      if (parentProperty) parentProperty.selected = true;
    }
    if (row.selected && kind === "bill" && row.ready) {
      const parentAccount = plan.accounts.find((account) => account.ready && account.item?.id === row.item?.utility_id);
      if (parentAccount) setExcelImportRowSelection("account", plan.accounts.indexOf(parentAccount), true);
    }

    if (!row.selected && kind === "property" && row.item?.id) {
      plan.accounts.forEach((account) => {
        if (account.item?.property_id === row.item.id) account.selected = false;
      });
      plan.bills.forEach((bill) => {
        if (bill.item?.property_id === row.item.id) bill.selected = false;
      });
    }
    if (!row.selected && kind === "account" && row.item?.id) {
      plan.bills.forEach((bill) => {
        if (bill.item?.utility_id === row.item.id) bill.selected = false;
      });
    }
  }

  function setExcelImportGroupSelection(kind, selected) {
    const rows = excelImportRows(pendingExcelImport, kind);
    if (selected) {
      rows.forEach((row, index) => {
        if (row.ready) setExcelImportRowSelection(kind, index, true);
      });
    } else {
      rows.forEach((row, index) => setExcelImportRowSelection(kind, index, false));
    }
    renderExcelImportDialog("", true);
  }

  function findImportProperty(name, plan) {
    const needle = importText(name);
    if (!needle) return { property: null, issue: "Manca il nome dell’immobile candidato." };
    const candidates = [
      ...state.data.properties,
      ...plan.properties.filter((row) => row.ready).map((row) => row.item)
    ].filter((property) => importText(property.name) === needle);
    const unique = [...new Map(candidates.map((property) => [property.id, property])).values()];
    if (unique.length === 1) return { property: unique[0], issue: "" };
    if (unique.length > 1) return { property: null, issue: "Il nome corrisponde a più immobili: verifica il collegamento." };
    return { property: null, issue: "Immobile non trovato: prima completa o importa la riga dell’immobile." };
  }

  function classifyExcelImport(plan) {
    const savedPropertyKeys = new Set(state.data.properties.map(importPropertyKey));
    const filePropertyKeys = new Set();
    for (const row of plan.properties) {
      if (row.imported) {
        markImportRow(row, "Importata", "Già salvata in questa operazione.");
        continue;
      }
      if (row.alreadyPresent) {
        markImportRow(row, "Già presente", "La stessa riga è stata salvata da un’altra sessione Admin.");
        continue;
      }
      if (row.failure) {
        markImportRow(row, "Errore", row.failure);
        continue;
      }
      const name = String(excelValue(row, "Nome · properties.name") || "").trim();
      const address = String(excelValue(row, "Indirizzo · properties.address") || "").trim();
      const city = String(excelValue(row, "Comune · properties.city") || "").trim();
      const type = String(excelValue(row, "Tipologia · properties.type") || "").trim();
      const status = importPropertyStatus(excelValue(row, "Stato · properties.status"));
      if (!name) {
        markImportRow(row, "Da correggere", "Manca il nome dell’immobile, necessario per riconoscerlo nella piattaforma.");
        continue;
      }
      const estimatedRaw = excelValue(row, "Valore stimato € · private_details");
      const estimated = importNumber(estimatedRaw);
      if (estimatedRaw !== "" && (estimated === null || estimated < 0)) {
        markImportRow(row, "Da correggere", "Il valore stimato deve essere un importo uguale o superiore a zero.");
        continue;
      }
      const item = {
        id: row.id || (row.id = newId()),
        name, address: address || "Da completare", city: city || "Da completare",
        postal_code: String(excelValue(row, "CAP · properties.postal_code") || "").trim(),
        type: type || "Appartamento", status: status || "vacant",
        estimated_value: estimated || 0,
        notes: String(excelValue(row, "Note admin · private_details.notes") || "").trim()
      };
      const key = importPropertyKey(item);
      if (savedPropertyKeys.has(key)) {
        markImportRow(row, "Già presente", "Immobile con nome e indirizzo già presente in piattaforma.");
        continue;
      }
      if (filePropertyKeys.has(key)) {
        markImportRow(row, "Duplicata nel file", "La stessa combinazione nome/indirizzo/comune compare più volte nel foglio.");
        continue;
      }
      filePropertyKeys.add(key);
      const propertyNeedsCompletion = !address || !city || !type || !status;
      markImportRow(row, propertyNeedsCompletion ? "Importabile · da completare" : "Pronta", propertyNeedsCompletion ? "La scheda verrà creata con campi provvisori: aprila nella piattaforma e completa indirizzo, comune, tipologia e stato." : "", true, item);
    }

    const savedAccounts = [...state.data.utility_accounts];
    for (const row of plan.accounts) {
      if (row.imported) {
        markImportRow(row, "Importata", "Già salvata in questa operazione.");
        continue;
      }
      if (row.alreadyPresent) {
        markImportRow(row, "Già presente", "La stessa utenza è stata salvata da un’altra sessione Admin.");
        continue;
      }
      if (row.failure) {
        markImportRow(row, "Errore", row.failure);
        continue;
      }
      const propertyName = excelValue(row, "Immobile candidato") || excelValue(row, "Immobile in Excel");
      const match = findImportProperty(propertyName, plan);
      const kind = String(excelValue(row, "Utenza · kind") || "").trim();
      const provider = String(excelValue(row, "Fornitore") || "").trim();
      const holder = importText(excelValue(row, "Intestatario · holder"));
      const recharged = excelValue(row, "Riaddebito inquilino");
      const rechargedText = importText(recharged);
      const rechargedValue = typeof recharged === "boolean" ? recharged
        : ["si", "true", "vero", "1"].includes(rechargedText) ? true
        : ["no", "false", "falso", "0"].includes(rechargedText) ? false
        : null;
      const missing = [];
      if (!match.property) missing.push(match.issue);
      if (!kind) missing.push("tipo utenza");
      if (rechargedValue === null) missing.push("riaddebito (TRUE/FALSE)");
      if (missing.length) {
        markImportRow(row, "Da completare", missing.join(" "));
        continue;
      }
      const contractCode = String(excelValue(row, "Codice contratto candidato") || excelValue(row, "Codice POD/servizio") || excelValue(row, "Codice cliente") || "").trim();
      const noteParts = [];
      const sourceStatus = String(excelValue(row, "Stato nel file") || "").trim();
      const clientCode = String(excelValue(row, "Codice cliente") || "").trim();
      const serviceCode = String(excelValue(row, "Codice POD/servizio") || "").trim();
      const sourceNote = String(excelValue(row, "Note candidate per la piattaforma") || "").trim();
      if (sourceStatus) noteParts.push("Stato nel file: " + sourceStatus);
      if (clientCode) noteParts.push("Codice cliente: " + clientCode);
      if (serviceCode) noteParts.push("Codice POD/servizio: " + serviceCode);
      if (sourceNote) noteParts.push(sourceNote);
      const item = {
        id: row.id || (row.id = newId()),
        property_id: match.property.id,
        kind, provider: provider || null,
        holder: ["owner", "tenant"].includes(holder) ? holder : "owner",
        recharged_to_tenant: rechargedValue ?? false,
        contract_code: contractCode || null,
        notes: noteParts.join(" · ") || null
      };
      if (savedAccounts.some((saved) => importAccountDuplicate(saved, item))) {
        markImportRow(row, "Già presente", "Utenza equivalente già presente per questo immobile.");
        continue;
      }
      savedAccounts.push(item);
      const accountNeedsCompletion = !["owner", "tenant"].includes(holder) || rechargedValue === null;
      markImportRow(row, accountNeedsCompletion ? "Importabile · da completare" : "Pronta", accountNeedsCompletion ? "Valori provvisori: intestatario proprietario e nessun riaddebito. Verifica e completa la scheda dalla piattaforma." : "", true, item);
    }

    const savedBills = [...state.data.utility_bills];
    const accountCandidates = [
      ...state.data.utility_accounts,
      ...plan.accounts.filter((row) => row.ready).map((row) => row.item)
    ];
    for (const row of plan.bills) {
      if (row.imported) {
        markImportRow(row, "Importata", "Già salvata in questa operazione.");
        continue;
      }
      if (row.alreadyPresent) {
        markImportRow(row, "Già presente", "La stessa bolletta è stata salvata da un’altra sessione Admin.");
        continue;
      }
      if (row.failure) {
        markImportRow(row, "Errore", row.failure);
        continue;
      }
      const propertyName = excelValue(row, "Immobile candidato") || excelValue(row, "Immobile in Excel");
      const match = findImportProperty(propertyName, plan);
      const kind = String(excelValue(row, "Utenza") || "").trim();
      const provider = String(excelValue(row, "Fornitore") || "").trim();
      const periodDate = importDate(excelValue(row, "Periodo candidato"));
      const amount = importNumber(excelValue(row, "Importo €"));
      const status = importBillStatus(excelValue(row, "Stato · utility_bills.status"));
      const dueRaw = excelValue(row, "Scadenza · due_date");
      const dueDate = dueRaw === "" || dueRaw === null ? null : importDate(dueRaw);
      const missing = [];
      if (!match.property) missing.push(match.issue);
      if (!kind) missing.push("tipo utenza");
      if (!periodDate) missing.push("periodo valido");
      if (amount === null || amount < 0) missing.push("importo valido");
      if (!status) missing.push("stato valido");
      if (dueRaw !== "" && dueRaw !== null && !dueDate) missing.push("scadenza non valida");
      let candidates = match.property
        ? accountCandidates.filter((account) => account.property_id === match.property.id && importText(account.kind) === importText(kind))
        : [];
      if (provider) candidates = candidates.filter((account) => importText(account.provider) === importText(provider));
      const explicitLink = importText(excelValue(row, "Collegamento utenza"));
      const linkedByCode = explicitLink
        ? candidates.filter((account) => importText(account.contract_code) === explicitLink)
        : [];
      if (linkedByCode.length) candidates = linkedByCode;
      const uniqueCandidates = [...new Map(candidates.map((account) => [account.id, account])).values()];
      if (uniqueCandidates.length !== 1) {
        missing.push(uniqueCandidates.length ? "collegamento utenza ambiguo: verifica il fornitore/codice." : "nessuna utenza corrispondente: seleziona o crea prima l’utenza.");
      }
      if (missing.length) {
        markImportRow(row, "Da completare", missing.join(" "));
        continue;
      }
      const period = periodDate.slice(0, 7) + "-01";
      const item = {
        id: row.id || (row.id = newId()),
        utility_id: uniqueCandidates[0].id,
        property_id: match.property.id,
        period,
        due_date: dueDate || null,
        amount,
        status
      };
      if (savedBills.some((saved) => importBillDuplicate(saved, item))) {
        markImportRow(row, "Già presente", "Bolletta con la stessa utenza, periodo e importo già presente.");
        continue;
      }
      savedBills.push(item);
      markImportRow(row, "Pronta", "", true, item);
    }
  }

  function excelImportRowTitle(kind, row) {
    if (kind === "property") return String(excelValue(row, "Nome · properties.name") || "Immobile senza nome");
    const property = String(excelValue(row, "Immobile candidato") || excelValue(row, "Immobile in Excel") || "Immobile non associato");
    if (kind === "account") return [property, excelValue(row, "Utenza · kind"), excelValue(row, "Fornitore")].filter(Boolean).join(" · ");
    return [property, excelValue(row, "Utenza"), importDate(excelValue(row, "Periodo candidato"))?.slice(0, 7), excelValue(row, "Importo €")].filter(Boolean).join(" · ");
  }

  function renderExcelImportGroup(title, kind, rows) {
    const visible = rows;
    if (!visible.length) return "";
    const readyRows = rows.filter((row) => row.ready);
    const selectedCount = rows.filter((row) => row.selected).length;
    const readySelectedCount = readyRows.filter((row) => row.selected).length;
    const allReadySelected = readyRows.length > 0 && readySelectedCount === readyRows.length;
    return `<section class="excel-import-group"><div class="excel-import-group-head"><div><h3>${esc(title)}</h3><small>${selectedCount} selezionate · ${readySelectedCount} complete e pronte</small></div>${readyRows.length ? `<button class="button secondary small" type="button" data-action="set-excel-import-group" data-import-type="${kind}" data-selected="${allReadySelected ? "false" : "true"}">${allReadySelected ? "Deseleziona pronte" : "Seleziona pronte"}</button>` : ""}</div><div class="excel-import-table"><table><thead><tr><th>Importa</th><th>Riga</th><th>Elemento</th><th>Esito</th></tr></thead><tbody>${visible.map((row, index) => {
      const statusClass = row.ready ? "ready" : row.imported ? "imported" : row.status === "Errore" || row.status === "Da correggere" || row.status === "Da completare" ? "error" : "";
      const sourceLine = excelValue(row, "Riga Excel") || row.excelRow;
      const selectable = canSelectExcelImportRow(row) && !excelImporting;
      const rowClass = row.selected ? " class=\"selected\"" : "";
      return `<tr${rowClass}><td class="excel-import-select-cell"><input type="checkbox" data-input="excel-import-selection" data-import-type="${kind}" data-import-index="${index}" aria-label="Seleziona ${esc(excelImportRowTitle(kind, row))}" ${row.selected ? "checked" : ""} ${selectable ? "" : "disabled"}/></td><td>${esc(sourceLine)}</td><td><strong>${esc(excelImportRowTitle(kind, row))}</strong><br><small>${esc(row.reason || (row.ready ? "Riga completa e pronta." : "Riga da verificare."))}</small></td><td><span class="excel-import-state ${statusClass}">${esc(row.status)}</span></td></tr>`;
    }).join("")}</tbody></table></div></section>`;
  }

  function renderExcelImportDialog(errorMessage = "", preserveScroll = false, focusSelection = null) {
    const plan = pendingExcelImport;
    const previousBodyScroll = preserveScroll ? dialog.querySelector(".dialog-body")?.scrollTop || 0 : 0;
    const previousTableScrolls = preserveScroll ? [...dialog.querySelectorAll(".excel-import-table")].map((table) => table.scrollTop) : [];
    const groups = plan ? [
      renderExcelImportGroup("Immobili", "property", plan.properties),
      renderExcelImportGroup("Utenze", "account", plan.accounts),
      renderExcelImportGroup("Bollette", "bill", plan.bills)
    ].filter(Boolean).join("") : "";
    const readyCount = plan ? [...plan.properties, ...plan.accounts, ...plan.bills].filter((row) => row.ready && row.selected).length : 0;
    const selectedIncompleteCount = plan ? [...plan.properties, ...plan.accounts, ...plan.bills].filter((row) => row.selected && !row.ready).length : 0;
    const body = `<div class="stack"><p>Carica il file Excel: dopo la lettura puoi spuntare nell’anteprima le righe che vuoi importare. Il riepilogo non salva nulla.</p>${errorMessage ? `<div class="callout danger">${esc(errorMessage)}</div>` : ""}<label class="file-input"><input type="file" accept=".xlsx" data-input="excel-import-file" ${excelImporting ? "disabled" : ""}/><span><strong>${plan ? "Seleziona un altro file Excel" : "Seleziona file Excel"}</strong><span>${plan ? esc(plan.fileName) : "Solo file .xlsx, massimo 20 MB."}</span></span></label>${plan ? `<div class="excel-import-summary"><div><strong>${plan.properties.filter((row) => row.selected).length}</strong><span>immobili selezionati</span></div><div><strong>${plan.accounts.filter((row) => row.selected).length}</strong><span>utenze selezionate</span></div><div><strong>${plan.bills.filter((row) => row.selected).length}</strong><span>bollette selezionate</span></div></div><div class="callout warning">Spunta le righe che vuoi importare. Verranno caricate le righe selezionate che hanno i dati minimi per creare una scheda. Immobili e utenze incomplete saranno importati con valori provvisori da completare poi nella piattaforma. Le bollette richiedono invece importo, periodo e utenza collegata. I duplicati vengono esclusi. Se selezioni un’utenza o una bolletta che richiede una nuova scheda collegata, l’immobile o l’utenza necessari vengono selezionati automaticamente. Contratti, inquilini, spese aggregate e quote non sono importabili da questo file.</div><div class="excel-import-groups">${groups}</div>${plan.failures?.length ? `<div class="callout danger">${esc(plan.failures.length)} righe non sono state salvate. Controlla l’esito e riprova dopo aver corretto i dati o la connessione.</div>` : ""}` : ""}</div>`;
    const closeButton = `<button class="button secondary" type="button" data-action="close-dialog" ${excelImporting ? "disabled" : ""}>Chiudi</button>`;
    const importButton = plan ? `<button class="button" type="button" data-action="commit-excel-import" ${readyCount && !excelImporting ? "" : "disabled"}>${excelImporting ? "Salvataggio…" : "Importa " + readyCount + " righe selezionate"}</button>` : "";
    const recheckButton = plan?.failures?.length && !excelImporting ? `<button class="button secondary" type="button" data-action="recheck-excel-import">Rivaluta le righe con errore</button>` : "";
    openDialog(dialogTemplate("Importa da Excel", plan ? "Controlla i dati prima di scriverli nel database." : "Seleziona il file rielaborato per vedere l’anteprima.", body, closeButton + recheckButton + importButton));
    if (preserveScroll) {
      const dialogBody = dialog.querySelector(".dialog-body");
      if (dialogBody) dialogBody.scrollTop = previousBodyScroll;
      dialog.querySelectorAll(".excel-import-table").forEach((table, index) => {
        table.scrollTop = previousTableScrolls[index] || 0;
      });
    }
    if (focusSelection) {
      dialog.querySelector(`[data-input="excel-import-selection"][data-import-type="${focusSelection.kind}"][data-import-index="${focusSelection.index}"]`)?.focus({ preventScroll: true });
    }
  }

  function openExcelImportDialog() {
    if (state.profile?.role !== "admin" || !supabaseClient || !state.sessionUser) {
      toast("L’importazione richiede un account Admin collegato a Supabase.", "error");
      return;
    }
    pendingExcelImport = null;
    renderExcelImportDialog();
  }

  async function readExcelImportFile(file) {
    if (!file) return;
    pendingExcelImport = null;
    try {
      const parsed = await window.PropertyExcelImport.read(file);
      pendingExcelImport = {
        fileName: parsed.fileName,
        properties: parsed.properties.map((row) => ({ ...row, id: "", imported: false, failure: "", selected: false })),
        accounts: parsed.accounts.map((row) => ({ ...row, id: "", imported: false, failure: "", selected: false })),
        bills: parsed.bills.map((row) => ({ ...row, id: "", imported: false, failure: "", selected: false })),
        failures: []
      };
      for (const row of pendingExcelImport.properties) {
        const key = [excelValue(row, "Nome · properties.name"), excelValue(row, "Indirizzo · properties.address"), excelValue(row, "Comune · properties.city")].map(importText).join("|");
        row.id = await stableExcelId("property", key);
      }
      for (const row of pendingExcelImport.accounts) {
        const key = [excelValue(row, "Immobile candidato") || excelValue(row, "Immobile in Excel"), excelValue(row, "Utenza · kind"), excelValue(row, "Fornitore"), excelValue(row, "Codice contratto candidato") || excelValue(row, "Codice POD/servizio") || excelValue(row, "Codice cliente")].map(importText).join("|");
        row.id = await stableExcelId("utility", key);
      }
      for (const row of pendingExcelImport.bills) {
        const key = [excelValue(row, "Immobile candidato") || excelValue(row, "Immobile in Excel"), excelValue(row, "Utenza"), excelValue(row, "Fornitore"), importDate(excelValue(row, "Periodo candidato")), importNumber(excelValue(row, "Importo €"))].map(importText).join("|");
        row.id = await stableExcelId("bill", key);
      }
      classifyExcelImport(pendingExcelImport);
      renderExcelImportDialog();
    } catch (error) {
      console.error("Lettura Excel non riuscita", error);
      pendingExcelImport = null;
      renderExcelImportDialog(error.message || "Non è stato possibile leggere il file Excel.");
    }
  }

  async function commitExcelImport() {
    const plan = pendingExcelImport;
    if (!plan || excelImporting) return;
    if (state.profile?.role !== "admin" || !supabaseClient || !state.sessionUser) {
      toast("Solo un Admin collegato a Supabase può importare dati.", "error");
      return;
    }
    excelImporting = true;
    plan.failures = [];
    renderExcelImportDialog();
    let imported = 0;
    const groups = [
      ["property", plan.properties],
      ["utility", plan.accounts],
      ["utilityBill", plan.bills]
    ];
    for (const [type, rows] of groups) {
      for (const row of rows.filter((item) => item.ready && item.selected)) {
        try {
          await syncEntity(type, row.item, "insert");
          if (type === "property") state.data.properties.push(row.item);
          if (type === "utility") state.data.utility_accounts.push(row.item);
          if (type === "utilityBill") state.data.utility_bills.push(row.item);
          row.imported = true;
          row.failure = "";
          imported += 1;
        } catch (error) {
          row.failure = error.message || "Salvataggio non riuscito.";
          plan.failures.push({ type, row, message: row.failure });
          console.error("Riga Excel non importata", row, error);
        }
        classifyExcelImport(plan);
        renderExcelImportDialog();
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
      }
    }
    try {
      await hydrateRemoteData();
    } catch (error) {
      console.error("Aggiornamento dati dopo import non riuscito", error);
      if (imported) plan.failures.push({ message: "Alcuni dati sono stati salvati; la rilettura da Supabase non è riuscita." });
    }
    const tableByType = { property: "properties", utility: "utility_accounts", utilityBill: "utility_bills" };
    plan.failures = plan.failures.filter((failure) => {
      const table = tableByType[failure.type];
      if (!table || !failure.row) return true;
      const exists = state.data[table]?.some((item) => item.id === failure.row.id);
      if (exists) {
        failure.row.failure = "";
        failure.row.alreadyPresent = true;
        return false;
      }
      return true;
    });
    classifyExcelImport(plan);
    excelImporting = false;
    if (plan.failures.length) {
      renderExcelImportDialog();
      toast("Importazione parziale: " + imported + " righe salvate. Controlla le righe con errore.", "error");
      return;
    }
    const importedProperties = plan.properties.filter((row) => row.imported).length;
    const importedAccounts = plan.accounts.filter((row) => row.imported).length;
    const importedBills = plan.bills.filter((row) => row.imported).length;
    pendingExcelImport = null;
    closeDialog();
    state.activeView = "properties";
    renderShell();
    toast("Importati: " + importedProperties + " immobili, " + importedAccounts + " utenze, " + importedBills + " bollette. I duplicati e le righe non complete sono stati saltati.");
  }

  function recheckExcelImport() {
    if (!pendingExcelImport || excelImporting) return;
    pendingExcelImport.failures = [];
    for (const group of [pendingExcelImport.properties, pendingExcelImport.accounts, pendingExcelImport.bills]) {
      group.forEach((row) => { row.failure = ""; row.alreadyPresent = false; });
    }
    classifyExcelImport(pendingExcelImport);
    renderExcelImportDialog();
  }

  function deleteManagementTable(items, kind) {
    if (!items.length) return empty(kind === "tenant" ? "users" : "home", "Nessuna voce da gestire", "Non ci sono elementi disponibili per la cancellazione.");
    const rows = kind === "tenant"
      ? items.map((item) => `<tr><td><strong>${esc(item.display_name)}</strong><br><small>${esc(item.email || item.username || "")}</small></td><td><button class="button danger small" data-action="request-delete" data-delete-type="tenant" data-record-id="${esc(item.id)}">Elimina</button></td></tr>`).join("")
      : items.map((item) => `<tr><td><strong>${esc(item.name)}</strong><br><small>${esc([item.address, item.city].filter(Boolean).join(", "))}</small></td><td><button class="button danger small" data-action="request-delete" data-delete-type="property" data-record-id="${esc(item.id)}">Elimina</button></td></tr>`).join("");
    return `<div class="table-wrap"><table><thead><tr><th>${kind === "tenant" ? "Profilo" : "Immobile"}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function getManagedRecord(kind, id) {
    const collections = {
      tenant: state.data.profiles,
      property: state.data.properties,
      lease: state.data.leases,
      payment: state.data.rent_payments,
      utility: state.data.utility_accounts,
      "utility-bill": state.data.utility_bills,
      mortgage: state.data.mortgages,
      financial: state.data.financial_entries,
      document: state.data.documents,
      maintenance: state.data.maintenance_jobs,
      provider: state.data.service_providers,
      permission: state.data.tenant_permissions
    };
    return collections[kind]?.find((item) => item.id === id) || null;
  }

  function openDeleteConfirmation(kind, id) {
    if (state.profile?.role !== "admin") {
      toast("Solo un amministratore può cancellare i dati.", "error");
      return;
    }
    const item = getManagedRecord(kind, id);
    if (!item) {
      toast("Elemento non trovato. Aggiorna la pagina e riprova.", "error");
      return;
    }
    const labels = {
      tenant: "inquilino", property: "immobile", lease: "contratto", payment: "canone",
      utility: "utenza", "utility-bill": "bolletta", mortgage: "mutuo", financial: "movimento",
      document: "documento", maintenance: "intervento", provider: "manutentore", permission: "permesso"
    };
    const title = item.display_name || item.name || item.title || item.contract_reference || item.lender || item.kind || item.category || labels[kind];
    const detailsByKind = {
      tenant: `L’account di ${title} e i relativi permessi saranno eliminati. I canoni storici resteranno senza il collegamento al profilo; un contratto condiviso resterà attivo per gli altri inquilini.`,
      property: `L’immobile ${title} e contratti, canoni, utenze, bollette, mutuo, documenti e interventi collegati saranno eliminati. I movimenti economici resteranno nello storico senza l’immobile.`,
      lease: `Il contratto ${title} e i canoni collegati saranno eliminati. I profili degli inquilini resteranno nell’archivio.`,
      payment: `Il canone ${monthLabel(item.period)} e la contabile collegata saranno eliminati.`,
      utility: `L’utenza ${title} e le bollette collegate saranno eliminate.`,
      "utility-bill": `La bolletta ${monthLabel(item.period)} e il documento collegato saranno eliminati.`,
      mortgage: `Il mutuo registrato per l’immobile sarà eliminato.`,
      financial: `Il movimento ${title} sarà eliminato dal conto economico.`,
      document: `Il documento ${title} e il file privato collegato saranno eliminati.`,
      maintenance: `L’intervento ${title} sarà eliminato. Eventuali movimenti economici già registrati resteranno nello storico.`,
      provider: `Il manutentore ${title} sarà rimosso dalla rubrica. Gli interventi resteranno, senza fornitore assegnato.`,
      permission: `Le autorizzazioni personalizzate di questo inquilino per l’immobile saranno rimosse e torneranno i valori predefiniti.`
    };
    const details = detailsByKind[kind] || `L’elemento ${title} sarà eliminato definitivamente.`;
    const body = `<div class="stack"><div class="callout warning">${esc(details)}</div><form data-form="delete-record" data-delete-type="${esc(kind)}" data-record-id="${esc(item.id)}"><div class="field"><label for="delete-confirmation">Digita <strong>ELIMINA</strong> per confermare</label><input id="delete-confirmation" name="confirmation" type="text" autocomplete="off" required data-input="delete-confirmation" placeholder="ELIMINA" /></div><label class="delete-ack"><input type="checkbox" name="acknowledged" data-input="delete-confirmation-check" /><span>Ho verificato l’elemento e confermo la cancellazione permanente.</span></label><div class="dialog-foot" style="margin:18px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button danger" type="submit" data-delete-submit disabled>Conferma cancellazione</button></div></form></div>`;
    openDialog(dialogTemplate(`Elimina ${labels[kind] || "elemento"}`, "Questa operazione non si può annullare.", body));
  }

  function updateDeleteConfirmation(form) {
    if (!form) return;
    const phrase = String(form.elements.confirmation?.value || "").trim();
    const acknowledged = Boolean(form.elements.acknowledged?.checked);
    const button = form.querySelector("[data-delete-submit]");
    if (button) button.disabled = phrase !== "ELIMINA" || !acknowledged;
  }

  function renderProviderPortal() {
    const provider = state.data.service_providers.find((item) => item.profile_id === state.sessionUser?.id);
    const jobs = provider ? state.data.maintenance_jobs.filter((job) => job.provider_id === provider.id).sort((a, b) => String(b.scheduled_date).localeCompare(String(a.scheduled_date))) : [];
    document.title = `${APP_NAME} · Area manutentore`;
    app.innerHTML = `<main class="tenant-shell"><header class="tenant-topbar"><div class="brand brand-inverse">${brandMark()}<span>${esc(APP_NAME)}</span></div><button class="button secondary small" data-action="logout">Esci</button></header><section class="tenant-main"><div class="tenant-welcome"><div><p class="eyebrow">AREA MANUTENTORE</p><h1>${esc(state.profile?.display_name || "Manutentore")}</h1><p>Visualizzi solo gli interventi che ti sono stati assegnati.</p></div></div><section class="panel"><div class="panel-head"><div><h2>I miei interventi</h2><p>Dettagli operativi, data e stato.</p></div></div>${jobs.length ? `<div class="table-wrap"><table><thead><tr><th>Intervento</th><th>Categoria</th><th>Data</th><th>Stato</th></tr></thead><tbody>${jobs.map((job) => `<tr><td><strong>${esc(job.title)}</strong><br><small>${esc(job.notes || "")}</small></td><td>${esc(job.category || "—")}</td><td>${dateLabel(job.completed_date || job.scheduled_date)}</td><td>${badge(job.status)}</td></tr>`).join("")}</tbody></table></div>` : empty("wrench", "Nessun intervento assegnato", provider ? "Quando l’amministratore ti assegnerà un intervento, lo vedrai qui." : "L’amministratore deve collegare il tuo profilo alla scheda manutentore.")}</section></section></main>`;
  }

  function renderTenantPortal() {
    const tenantId = state.sessionUser?.id || state.demoTenantId;
    const tenant = state.profile?.role === "tenant" ? state.profile : getProfile(tenantId);
    const properties = tenantProperties(tenantId);
    const property = properties[0];
    document.title = `${APP_NAME} · Area inquilino`;
    if (!property) {
      app.innerHTML = `<main class="tenant-shell"><header class="tenant-topbar"><div class="brand brand-inverse">${brandMark()}<span>${esc(APP_NAME)}</span></div><button class="button secondary small" data-action="logout">Esci</button></header><section class="tenant-main"><div class="panel">${empty("home", "Nessun immobile associato", "Chiedi all’amministratore di collegare il tuo profilo a un contratto attivo.")}</div></section></main>`;
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
          <div class="tenant-welcome"><div><p class="eyebrow">Area inquilino</p><h1>La tua abitazione, tutto in ordine.</h1><p>Consulta solo le informazioni che l’amministratore ha reso disponibili per te.</p></div></div>
          <div class="tenant-grid">
            <section class="rent-card"><p class="eyebrow">Canone ${esc(monthLabel(currentPayment?.period || isoMonth()))}</p><h2>${currentPayment?.status === "paid" ? "Pagamento registrato" : "Prossimo pagamento"}</h2><div class="rent-amount">${money(currentPayment?.amount_due || lease?.monthly_rent || 0)}</div><p>Scadenza ${dateLabel(currentPayment?.due_date || `${isoMonth()}-${String(lease?.due_day || 5).padStart(2, "0")}`)} · Stato: ${statusLabel(currentPayment?.status || "pending")}</p><div class="rent-actions">${permissions.allow_payment_upload ? `<button class="button" data-action="upload-payment" data-payment-id="${currentPayment?.id || ""}" data-property-id="${property.id}">${uiIcon("upload", 16)} Carica contabile</button>` : ""}${currentPayment?.receipt_name ? `<span class="button secondary">${uiIcon("checkCircle", 15)} ${esc(currentPayment.receipt_name)}</span>` : ""}</div></section>
            <section class="panel tenant-address"><p class="eyebrow">Immobile</p><h3>${esc(property.name)}</h3><p>${esc(property.address)}, ${esc(property.postal_code || "")} ${esc(property.city)}</p><dl><div><dt>Contratto</dt><dd>${lease ? dateLabel(lease.end_date) : "—"}</dd></div><div><dt>Canone</dt><dd>${money(lease?.monthly_rent || 0)}</dd></div></dl></section>
          </div>
          <div class="page-grid" style="margin-top:18px">
            <section class="panel"><div class="panel-head"><div><h2>I tuoi pagamenti</h2><p>Storico dei canoni e contabili caricate.</p></div></div>${payments.length ? `<div class="table-wrap"><table><thead><tr><th>Periodo</th><th>Scadenza</th><th>Importo</th><th>Contabile</th><th>Stato</th></tr></thead><tbody>${payments.map((payment) => `<tr><td>${esc(monthLabel(payment.period))}</td><td>${dateLabel(payment.due_date)}</td><td class="number">${money(payment.amount_due)}</td><td>${payment.receipt_name ? esc(payment.receipt_name) : "—"}</td><td>${badge(payment.status)}</td></tr>`).join("")}</tbody></table></div>` : empty("coins", "Nessun canone disponibile", "I prossimi pagamenti saranno indicati qui.")}</section>
            <section class="panel"><div class="panel-head"><div><h2>Riepilogo accessi</h2><p>Contenuti abilitati dall’amministratore.</p></div></div><div class="task-list"><div class="task-row"><span class="property-avatar">${uiIcon("fileText", 18)}</span><div class="task-copy"><strong>Documenti</strong><span>${permissions.show_documents ? `${docs.length} file disponibili` : "Non abilitati"}</span></div></div><div class="task-row"><span class="property-avatar">${uiIcon("utility", 18)}</span><div class="task-copy"><strong>Utenze</strong><span>${permissions.show_utilities ? `${utilityBills.length} bollette visibili` : "Non abilitate"}</span></div></div><div class="task-row"><span class="property-avatar">${uiIcon("wrench", 18)}</span><div class="task-copy"><strong>Manutenzioni</strong><span>${permissions.show_maintenance ? `${jobs.length} interventi visibili` : "Non abilitate"}</span></div></div></div></section>
          </div>
          ${permissions.show_documents || permissions.show_utilities || permissions.show_maintenance ? `<div class="page-grid"><section class="panel"><div class="panel-head"><div><h2>Documenti e utenze</h2><p>Materiale condiviso per l’abitazione.</p></div></div>${permissions.show_documents ? `<div class="task-list">${docs.length ? docs.map((document) => `<article class="task-row"><span class="property-avatar">${uiIcon("fileText", 18)}</span><div class="task-copy"><strong>${esc(document.name)}</strong><span>${esc(document.category)} · ${dateLabel(document.uploaded_at)}</span></div></article>`).join("") : `<p class="row-muted">Nessun documento condiviso.</p>`}</div>` : ""}${permissions.show_utilities ? `<div class="table-wrap" style="border-left:0;border-right:0;border-bottom:0"><table><thead><tr><th>Utenza</th><th>Periodo</th><th>Importo</th><th>Scadenza</th></tr></thead><tbody>${utilityBills.map((bill) => `<tr><td>${esc(utilities.find((utility) => utility.id === bill.utility_id)?.kind || "Utenza")}</td><td>${esc(monthLabel(bill.period))}</td><td class="number">${money(bill.amount)}</td><td>${dateLabel(bill.due_date)}</td></tr>`).join("")}</tbody></table></div>` : ""}</section><section class="panel"><div class="panel-head"><div><h2>Assistenza</h2><p>Per segnalazioni urgenti usa i riferimenti concordati con l’amministratore.</p></div></div><div class="task-list">${permissions.show_maintenance ? jobs.map((job) => taskRow(job)).join("") : `<article class="task-row"><span class="property-avatar">${uiIcon("info", 18)}</span><div class="task-copy"><strong>Visibilità degli interventi</strong><span>Le manutenzioni non sono attualmente condivise con il tuo profilo.</span></div></article>`}</div></section></div>` : ""}
        </section>
      </main>`;
  }

  function empty(iconName, title, description) {
    return `<div class="empty"><div><div class="empty-icon">${uiIcon(iconName, 30)}</div><strong>${esc(title)}</strong><p>${esc(description)}</p></div></div>`;
  }

  function render() {
    if (state.passwordRecovery) renderLogin();
    else if (!state.mode) renderLogin();
    else if (state.mode === "tenant") renderTenantPortal();
    else if (state.mode === "provider") renderProviderPortal();
    else if (state.mode === "admin") renderShell();
    else renderLogin();
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
    const contextLease = context.leaseId ? getLease(context.leaseId) : null;
    const property = context.propertyId ? getProperty(context.propertyId) : contextLease ? getProperty(contextLease.property_id) : null;
    if (kind === "property") {
      const item = context.propertyId ? getProperty(context.propertyId) : null;
      const body = `<form data-form="property" data-property-id="${esc(item?.id || "")}"><div class="form-grid">${field("Nome identificativo", "name", "text", item?.name || "", { required: true, placeholder: "es. Appartamento Via Gramsci" })}${selectField("Stato", "status", item?.status || "rented", [["rented", "Fittata"], ["vacant", "Sfitta"], ["personal", "Personale"], ["maintenance", "In manutenzione"]])}${field("Indirizzo", "address", "text", item?.address || "", { required: true })}${field("Città", "city", "text", item?.city || "", { required: true })}${field("CAP", "postal_code", "text", item?.postal_code || "")}${field("Tipologia", "type", "text", item?.type || "Appartamento")}${field("Valore stimato", "estimated_value", "number", item?.estimated_value || "", { attributes: "min=0 step=1000" })}<div class="field"><label for="field-notes">Note</label><textarea id="field-notes" name="notes" placeholder="Informazioni utili sulla proprietà">${esc(item?.notes || "")}</textarea></div></div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">${item ? "Salva modifiche" : "Crea immobile"}</button></div></form>`;
      openDialog(dialogTemplate(item ? "Modifica immobile" : "Nuovo immobile", "La scheda diventerà il contenitore di contratti, costi e documenti.", body));
      return;
    }
    if (kind === "tenant") {
      const body = `<form data-form="tenant" data-property-id="${esc(context.propertyId || "")}"><div class="callout">In demo viene creato un profilo locale. Con Supabase, l’email e la password scelti qui diventeranno le credenziali reali dell’inquilino.</div><div class="form-separator"></div><div class="form-grid">${field("Nome e cognome", "display_name", "text", "", { required: true })}${field("Username visualizzato", "username", "text", "", { required: true, placeholder: "nome.cognome" })}${field("Email", "email", "email", "", { required: true })}${field("Password iniziale", "password", "password", "", { required: true, help: "Almeno 8 caratteri. Sarà richiesta solo nel backend, non viene salvata nella scheda." })}${field("Telefono", "phone", "tel", "")}${selectField("Immobile", "property_id", context.propertyId || "", state.data.properties.map((p) => [p.id, p.name]))}${field("Canone mensile", "monthly_rent", "number", property ? propertyRent(property.id) || "" : "", { required: true, attributes: "min=0 step=1" })}${field("Scadenza canone (giorno del mese)", "due_day", "number", "5", { required: true, attributes: "min=1 max=28", help: "Questo giorno servirà per programmare gli alert di scadenza." })}${field("Inizio contratto", "start_date", "date", dateISO(), { required: true })}${field("Fine contratto", "end_date", "date", dateISO(365), { required: true })}</div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Crea e collega</button></div></form>`;
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
      const body = `<form data-form="utility"><div class="form-grid">${selectField("Immobile", "property_id", context.propertyId || "", state.data.properties.map((p) => [p.id, p.name]))}${selectField("Tipologia utenza", "kind", "Luce", [["Luce", "Luce"], ["Gas", "Gas"], ["Acqua", "Acqua"], ["Internet", "Internet"], ["Condominio", "Condominio"], ["TARI", "TARI"], ["Altro", "Altro"]])}${field("Fornitore", "provider", "text", "", { required: true })}${selectField("Intestatario", "holder", "owner", [["owner", "Proprietario"], ["tenant", "Inquilino"]])}${field("Codice contratto/POD/PDR", "contract_code", "text", "")}${selectField("Riaddebitata all’inquilino", "recharged_to_tenant", "false", [["false", "No"], ["true", "Sì"]])}${field("Importo bolletta", "amount", "number", "", { attributes: "min=0 step=0.01" })}${field("Scadenza bolletta", "due_date", "date", dateISO(10))}${field("Periodo bolletta", "period", "month", isoMonth())}${selectField("Stato bolletta", "bill_status", "pending", [["pending", "Da pagare"], ["paid", "Pagata"], ["partial", "Parziale"], ["late", "In ritardo"]])}<div class="field span-2"><label for="field-notes">Note</label><textarea id="field-notes" name="notes" placeholder="Eventuali regole di rimborso o dettagli"></textarea></div></div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Salva utenza</button></div></form>`;
      openDialog(dialogTemplate("Utenza e bolletta", "Registra l’intestatario e, se presente, la prima bolletta/scadenza.", body));
      return;
    }
    if (kind === "document") {
      const body = `<form data-form="document" enctype="multipart/form-data"><div class="form-grid">${selectField("Immobile", "property_id", context.propertyId || "", state.data.properties.map((p) => [p.id, p.name]))}${selectField("Categoria", "category", "Contratto", [["Contratto", "Contratto"], ["Verbale", "Verbale"], ["Bolletta", "Bolletta"], ["Mutuo", "Mutuo"], ["Manutenzione", "Manutenzione"], ["Altro", "Altro"]])}<label class="file-input field span-2"><input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"/><span><strong>Seleziona un documento</strong><span>PDF, foto o documento di lavoro.</span></span></label><label class="permission span-2"><input type="checkbox" name="visible_to_tenant" /><span><strong>Rendi visibile agli inquilini autorizzati</strong><span>È sempre possibile cambiare il livello di accesso in seguito.</span></span></label></div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Carica documento</button></div></form>`;
      openDialog(dialogTemplate("Carica documento", "In produzione il file sarà custodito in un archivio privato, non pubblico.", body));
      return;
    }
    if (kind === "payment") {
      const activeLease = contextLease || (property ? getPrimaryLease(property.id) : null);
      if (!activeLease) { toast("Collega prima un contratto attivo a questo immobile.", "error"); return; }
      const period = context.period || isoMonth();
      const dueDate = context.dueDate || `${period}-${String(activeLease.due_day || 5).padStart(2, "0")}`;
      const body = `<form data-form="payment" data-tenant-id="${esc(context.tenantId || "")}"><input type="hidden" name="property_id" value="${esc(activeLease.property_id)}" /><input type="hidden" name="lease_id" value="${esc(activeLease.id)}" /><div class="form-grid">${field("Periodo", "period", "month", period, { required: true })}${field("Scadenza", "due_date", "date", dueDate, { required: true })}${field("Importo dovuto", "amount_due", "number", activeLease.monthly_rent, { required: true, attributes: "min=0 step=0.01" })}${selectField("Stato iniziale", "status", "pending", [["pending", "Da pagare"], ["paid", "Pagato"], ["partial", "Parziale"]])}</div><div class="dialog-foot" style="margin:20px -22px -20px"><button class="button secondary" type="button" data-action="close-dialog">Annulla</button><button class="button" type="submit">Crea canone</button></div></form>`;
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
    if (action === "open-excel-import") return openExcelImportDialog();
    if (action === "set-excel-import-group") {
      setExcelImportGroupSelection(target.dataset.importType, target.dataset.selected === "true");
      return;
    }
    if (action === "commit-excel-import") return commitExcelImport();
    if (action === "recheck-excel-import") return recheckExcelImport();
    if (action === "remove-bank-sender-alias") {
      if (state.profile?.role !== "admin") return toast("Solo un Admin può modificare gli abbinamenti.", "error");
      const { error } = await supabaseClient.from("tenant_bank_sender_aliases").delete().eq("id", target.dataset.aliasId);
      if (error) return toast("Non è stato possibile rimuovere l’abbinamento: " + error.message, "error");
      await hydrateRemoteData();
      renderShell();
      toast("Abbinamento rimosso.");
      return;
    }
    if (action === "forgot-password") {
      await requestPasswordReset();
      return;
    }
    if (action === "demo-admin" || action === "demo-tenant" || action === "reset-demo") {
      toast("La modalità demo è disattivata. Accedi con un account Supabase registrato.", "error");
      return;
    }
    if (action === "logout") {
      if (supabaseClient && state.sessionUser) await supabaseClient.auth.signOut();
      state.mode = null;
      state.sessionUser = null;
      state.profile = null;
      state.activeView = "dashboard";
      state.selectedTenantId = null;
      closeDialog();
      render();
      return;
    }
    if (action === "navigate") {
      state.activeView = target.dataset.view;
      if (state.activeView !== "property") state.selectedPropertyId = null;
      if (state.activeView !== "tenant") state.selectedTenantId = null;
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
    if (action === "open-tenant") {
      state.selectedTenantId = target.dataset.tenantId;
      state.selectedPropertyId = null;
      state.activeView = "tenant";
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
    if (action === "add-payment") return openForm("payment", {
      propertyId: target.dataset.propertyId || "",
      leaseId: target.dataset.leaseId || "",
      tenantId: state.selectedTenantId || "",
      period: target.dataset.period || "",
      dueDate: target.dataset.dueDate || ""
    });
    if (action === "set-rent-payment-status") {
      try {
        await setRentPaymentStatus(target.dataset.leaseId, target.dataset.period, target.dataset.status);
      } catch (error) {
        console.error(error);
        toast(error.message || "Non è stato possibile aggiornare il canone.", "error");
      }
      return;
    }
    if (action === "set-utility-bill-status") {
      try {
        await setUtilityBillStatus(target.dataset.billId, target.dataset.status);
      } catch (error) {
        console.error(error);
        toast(error.message || "Non è stato possibile aggiornare la bolletta.", "error");
      }
      return;
    }
    if (action === "request-delete") {
      openDeleteConfirmation(target.dataset.deleteType, target.dataset.recordId);
      return;
    }
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
    if (event.type === "change" && event.target.dataset.input === "excel-import-file") {
      const file = event.target.files?.[0];
      event.target.value = "";
      void readExcelImportFile(file);
      return;
    }
    if (event.type === "change" && event.target.dataset.input === "excel-import-selection") {
      const kind = event.target.dataset.importType;
      const index = Number(event.target.dataset.importIndex);
      setExcelImportRowSelection(kind, index, event.target.checked);
      renderExcelImportDialog("", true, { kind, index });
      return;
    }
    if (event.target.dataset.input === "delete-confirmation" || event.target.dataset.input === "delete-confirmation-check") {
      updateDeleteConfirmation(event.target.closest('form[data-form="delete-record"]'));
    }
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
    // Impedisce doppi invii mentre una richiesta Supabase è ancora in corso.
    if (form.dataset.submitting === "true") return;
    form.dataset.submitting = "true";
    const submitButtons = [...form.querySelectorAll('button[type="submit"]')];
    const submitLabels = submitButtons.map((button) => button.textContent);
    submitButtons.forEach((button) => {
      button.disabled = true;
      button.textContent = "Salvataggio…";
    });
    const type = form.dataset.form;
    const data = new FormData(form);
    const value = (name) => String(data.get(name) ?? "").trim();
    try {
      if (type === "delete-record") {
        if (value("confirmation") !== "ELIMINA" || data.get("acknowledged") !== "on") {
          throw new Error("Completa la verifica prima di cancellare.");
        }
        await deleteManagedRecord(form.dataset.deleteType, form.dataset.recordId);
        return;
      }
      if (type === "bank-sender-alias") {
        if (state.profile?.role !== "admin" || !supabaseClient || !state.sessionUser) throw new Error("Serve una sessione Admin collegata a Supabase.");
        const tenantId = value("tenant_id");
        const senderName = value("sender_name").replace(/\s+/g, " ");
        if (!tenantId || !senderName) throw new Error("Seleziona l’inquilino e inserisci il nome dell’ordinante.");
        const senderKey = importText(senderName);
        const duplicate = state.data.tenant_bank_sender_aliases.find((alias) => alias.sender_key === senderKey);
        if (duplicate) throw new Error(`Questo ordinante è già associato a ${getProfile(duplicate.tenant_id)?.display_name || "un inquilino"}.`);
        const { error } = await supabaseClient.from("tenant_bank_sender_aliases").insert({ tenant_id: tenantId, sender_name: senderName, sender_key: senderKey });
        if (error) throw new Error(error.code === "23505" ? "Questo ordinante è già stato associato." : error.message);
        await hydrateRemoteData();
        renderShell();
        toast("Ordinante associato all’inquilino.");
        return;
      }
      if (type === "login") {
        await login(value("email"), value("password"));
        return;
      }
      if (type === "password-recovery") {
        if (value("password").length < 8) throw new Error("La password deve contenere almeno 8 caratteri.");
        if (value("password") !== value("password_confirmation")) throw new Error("Le due password non coincidono.");
        await updateRecoveredPassword(value("password"));
        return;
      }
      if (type === "property") {
        const item = {
          id: form.dataset.propertyId || newId(),
          name: value("name"), address: value("address"), city: value("city"), postal_code: value("postal_code"), type: value("type"), status: value("status"), estimated_value: Number(value("estimated_value") || 0), notes: value("notes"), created_at: dateISO()
        };
        assertNoDuplicate(state.data.properties, item, (saved, next) =>
          normalizedKey(saved.name) === normalizedKey(next.name) &&
          normalizedKey(saved.address) === normalizedKey(next.address) &&
          normalizedKey(saved.city) === normalizedKey(next.city),
        "Esiste già un immobile con lo stesso nome e indirizzo.");
        const index = state.data.properties.findIndex((property) => property.id === item.id);
        await syncEntity("property", item, index >= 0 ? "update" : "insert");
        if (index >= 0) state.data.properties[index] = { ...state.data.properties[index], ...item };
        else state.data.properties.push(item);
        finishMutation(index >= 0 ? "Immobile aggiornato." : "Immobile creato.");
        return;
      }
      if (type === "tenant") {
        const email = value("email").toLocaleLowerCase("it-IT");
        const propertyId = value("property_id");
        const knownEmailProfile = state.data.profiles.find((profile) => normalizedKey(profile.email) === normalizedKey(email));
        const knownTenant = knownEmailProfile?.role === "tenant" ? knownEmailProfile : null;
        const knownUsername = state.data.profiles.find((profile) => normalizedKey(profile.username) === normalizedKey(value("username")));
        const sameContact = state.data.profiles.find((profile) => profile.role === "tenant" &&
          normalizedKey(profile.display_name) === normalizedKey(value("display_name")) &&
          value("phone") && normalizedKey(profile.phone) === normalizedKey(value("phone")));
        if (sameContact && normalizedKey(sameContact.email) !== normalizedKey(email)) {
          throw new Error(`Esiste già un inquilino con questo nome e telefono (${sameContact.email || "email non indicata"}). Controlla i dati prima di creare un altro profilo.`);
        }
        const activeLeaseForProperty = getActiveLeases(propertyId).find((lease) => lease.tenant_ids?.includes(knownTenant?.id));
        if (knownTenant && activeLeaseForProperty) {
          throw new Error("Questo inquilino è già collegato a un contratto attivo per l’immobile selezionato.");
        }
        if (knownTenant) {
          throw new Error("Esiste già un profilo inquilino con questa email. Apri la scheda esistente per evitare di creare un duplicato.");
        }
        if (knownEmailProfile) {
          throw new Error("Questa email è già associata a un account della piattaforma. Controlla l’indirizzo prima di creare il profilo.");
        }
        if (knownUsername) {
          throw new Error("Questo username è già utilizzato da un altro account. Scegline uno diverso.");
        }
        const tenant = { id: knownTenant?.id || newId(), role: "tenant", display_name: value("display_name"), username: value("username"), email, phone: value("phone"), password: value("password") };
        const existingLease = activeLeaseForProperty;
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
        const existingPermission = state.data.tenant_permissions.find((permission) => permission.property_id === lease.property_id && permission.tenant_id === tenant.id);
        const permission = existingPermission || { id: newId(), property_id: lease.property_id, tenant_id: tenant.id, show_documents: true, show_utilities: true, show_maintenance: false, allow_payment_upload: true, allow_utility_upload: false };
        if (supabaseClient && state.sessionUser) await syncTenantRelations(tenantProfile, lease, permission);
        const profileIndex = state.data.profiles.findIndex((profile) => profile.id === tenant.id);
        if (profileIndex >= 0) {
          state.data.profiles[profileIndex] = { ...state.data.profiles[profileIndex], ...tenantProfile };
        } else {
          state.data.profiles.push(tenantProfile);
        }
        if (existingLease) Object.assign(existingLease, lease); else state.data.leases.push(lease);
        if (!existingPermission) state.data.tenant_permissions.push(permission);
        finishMutation(existingLease ? "Inquilino collegato al contratto esistente." : "Inquilino e contratto creati.");
        return;
      }
      if (type === "provider") {
        const provider = { id: newId(), display_name: value("display_name"), company_name: value("company_name"), category: value("category"), email: value("email"), phone: value("phone"), notes: value("notes") };
        assertNoDuplicate(state.data.service_providers, provider, (saved, next) => {
          const sameEmail = normalizedKey(next.email) && normalizedKey(saved.email) === normalizedKey(next.email);
          const samePhoneAndName = normalizedKey(saved.display_name) === normalizedKey(next.display_name) && normalizedKey(saved.phone) === normalizedKey(next.phone);
          return sameEmail || samePhoneAndName;
        }, "Questo manutentore è già presente nella rubrica.");
        await syncEntity("provider", provider, "insert");
        state.data.service_providers.push(provider);
        finishMutation("Manutentore aggiunto.");
        return;
      }
      if (type === "maintenance") {
        const job = { id: newId(), property_id: value("property_id"), provider_id: value("provider_id") || null, title: value("title"), category: value("category"), priority: value("priority"), status: value("status"), scheduled_date: value("scheduled_date"), completed_date: value("status") === "done" ? value("scheduled_date") : "", total_cost: Number(value("total_cost") || 0), notes: value("notes") };
        assertNoDuplicate(state.data.maintenance_jobs, job, (saved, next) =>
          saved.property_id === next.property_id && saved.provider_id === next.provider_id &&
          normalizedKey(saved.title) === normalizedKey(next.title) && saved.scheduled_date === next.scheduled_date,
        "Questo intervento risulta già registrato per la stessa data e immobile.");
        const generatedExpense = job.status === "done" && job.total_cost > 0
          ? { id: newId(), property_id: job.property_id, direction: "expense", category: `Manutenzione · ${job.category}`, amount: job.total_cost, date: job.completed_date, status: "paid", description: job.title }
          : null;
        const expenseAlreadyExists = generatedExpense && state.data.financial_entries.some((saved) =>
          saved.property_id === generatedExpense.property_id && saved.direction === generatedExpense.direction &&
          saved.amount === generatedExpense.amount && saved.date === generatedExpense.date &&
          normalizedKey(saved.category) === normalizedKey(generatedExpense.category) &&
          normalizedKey(saved.description) === normalizedKey(generatedExpense.description));
        await syncEntity("maintenance", job, "insert");
        if (generatedExpense && !expenseAlreadyExists) await syncEntity("financial", generatedExpense, "insert");
        state.data.maintenance_jobs.push(job);
        if (generatedExpense && !expenseAlreadyExists) state.data.financial_entries.push(generatedExpense);
        finishMutation("Intervento salvato.");
        return;
      }
      if (type === "financial") {
        const entry = { id: newId(), property_id: value("property_id") || null, direction: value("direction"), category: value("category"), amount: Number(value("amount")), date: value("date"), status: value("status"), description: value("description") };
        assertNoDuplicate(state.data.financial_entries, entry, (saved, next) =>
          saved.property_id === next.property_id && saved.direction === next.direction &&
          saved.amount === next.amount && saved.date === next.date &&
          normalizedKey(saved.category) === normalizedKey(next.category) &&
          normalizedKey(saved.description) === normalizedKey(next.description),
        "Questo movimento economico è già presente con gli stessi dati.");
        await syncEntity("financial", entry, "insert");
        state.data.financial_entries.push(entry);
        finishMutation("Movimento registrato.");
        return;
      }
      if (type === "utility") {
        const draftUtility = { id: newId(), property_id: value("property_id"), kind: value("kind"), provider: value("provider"), holder: value("holder"), recharged_to_tenant: value("recharged_to_tenant") === "true", contract_code: value("contract_code"), notes: value("notes") };
        const existingUtility = state.data.utility_accounts.find((saved) =>
          saved.property_id === draftUtility.property_id &&
          saved.holder === draftUtility.holder &&
          normalizedKey(saved.kind) === normalizedKey(draftUtility.kind) &&
          normalizedKey(saved.provider) === normalizedKey(draftUtility.provider) &&
          normalizedKey(saved.contract_code) === normalizedKey(draftUtility.contract_code)
        );
        const amount = Number(value("amount") || 0);
        if (existingUtility && amount <= 0) {
          throw new Error("Questa utenza è già censita. Per aggiungere una bolletta, inserisci anche importo e periodo.");
        }
        const period = value("period");
        if (existingUtility && state.data.utility_bills.some((bill) => bill.utility_id === existingUtility.id && String(bill.period || "").slice(0, 7) === period)) {
          throw new Error("La bolletta di questo periodo è già presente per l’utenza selezionata.");
        }
        const utility = existingUtility || draftUtility;
        const bill = amount > 0 ? { id: newId(), utility_id: utility.id, property_id: utility.property_id, period, due_date: value("due_date"), amount, status: value("bill_status") || "pending", document_name: "" } : null;
        if (!existingUtility) await syncEntity("utility", utility, "insert");
        if (bill) await syncEntity("utilityBill", bill, "insert");
        if (!existingUtility) state.data.utility_accounts.push(utility);
        if (bill) state.data.utility_bills.push(bill);
        finishMutation(existingUtility ? "Bolletta aggiunta all’utenza esistente." : "Utenza salvata.");
        return;
      }
      if (type === "document") {
        const file = data.get("file");
        if (!(file instanceof File) || !file.name) throw new Error("Seleziona un file prima di caricare.");
        const documentItem = { id: newId(), property_id: value("property_id"), category: value("category"), name: file.name, visible_to_tenant: data.get("visible_to_tenant") === "on", uploaded_at: dateISO(), uploaded_by: state.sessionUser?.id || "admin", storage_path: "" };
        assertNoDuplicate(state.data.documents, documentItem, (saved, next) =>
          saved.property_id === next.property_id && normalizedKey(saved.category) === normalizedKey(next.category) && normalizedKey(saved.name) === normalizedKey(next.name),
        "Esiste già un documento con questo nome e categoria per l’immobile. Rinomina il nuovo file se si tratta di una versione diversa.");
        if (supabaseClient && state.sessionUser) documentItem.storage_path = await uploadAdminDocument(file, documentItem);
        await syncEntity("document", documentItem, "insert");
        state.data.documents.push(documentItem);
        finishMutation("Documento archiviato.");
        return;
      }
      if (type === "payment") {
        const lease = getLease(value("lease_id"));
        const payment = { id: newId(), property_id: value("property_id"), lease_id: value("lease_id"), tenant_id: form.dataset.tenantId || lease?.tenant_ids?.[0] || null, period: value("period"), due_date: value("due_date"), amount_due: Number(value("amount_due")), amount_paid: value("status") === "paid" ? Number(value("amount_due")) : 0, paid_at: value("status") === "paid" ? dateISO() : null, status: value("status"), receipt_name: "" };
        assertNoDuplicate(state.data.rent_payments, payment, (saved, next) => saved.lease_id === next.lease_id && String(saved.period || "").slice(0, 7) === String(next.period || "").slice(0, 7), "Per questo contratto il canone del mese è già registrato.");
        await syncEntity("payment", payment, "insert");
        state.data.rent_payments.push(payment);
        finishMutation("Canone creato.");
        return;
      }
      if (type === "payment-proof") {
        const file = data.get("file");
        if (!(file instanceof File) || !file.name) throw new Error("Seleziona la contabile prima di inviare.");
        const payment = state.data.rent_payments.find((item) => item.id === form.dataset.paymentId);
        if (!payment) throw new Error("Pagamento non trovato.");
        const previousReceiptPath = payment.receipt_path;
        const updatedPayment = {
          ...payment,
          receipt_name: file.name,
          status: payment.status === "paid" ? "paid" : "pending",
          receipt_uploaded_at: dateISO()
        };
        if (supabaseClient && state.sessionUser) updatedPayment.receipt_path = await uploadPaymentProof(file, updatedPayment);
        await syncEntity("payment", updatedPayment, "update");
        Object.assign(payment, updatedPayment);
        if (previousReceiptPath && previousReceiptPath !== updatedPayment.receipt_path) {
          try { await deleteStoragePaths([previousReceiptPath]); }
          catch (error) { console.warn("La nuova contabile è salvata, ma la precedente non è stata rimossa.", error); }
        }
        finishMutation("Contabile inviata all’amministratore.");
        return;
      }
      if (type === "permissions") {
        const propertyId = form.dataset.propertyId;
        const tenantId = form.dataset.tenantId;
        const existing = state.data.tenant_permissions.find((item) => item.property_id === propertyId && item.tenant_id === tenantId);
        const permissions = { id: existing?.id || newId(), property_id: propertyId, tenant_id: tenantId, show_documents: data.get("show_documents") === "on", show_utilities: data.get("show_utilities") === "on", show_maintenance: data.get("show_maintenance") === "on", allow_payment_upload: data.get("allow_payment_upload") === "on", allow_utility_upload: data.get("allow_utility_upload") === "on" };
        await syncEntity("permissions", permissions, existing ? "update" : "insert");
        if (existing) Object.assign(existing, permissions); else state.data.tenant_permissions.push(permissions);
        finishMutation("Permessi aggiornati.");
      }
    } catch (error) {
      console.error(error);
      toast(error.message || "Non è stato possibile completare l’operazione.", "error");
    } finally {
      if (form.isConnected) {
        delete form.dataset.submitting;
        submitButtons.forEach((button, index) => {
          button.disabled = false;
          button.textContent = submitLabels[index];
        });
      }
    }
  }

  function finishMutation(message) {
    persistData();
    closeDialog();
    render();
    toast(message);
  }

  async function setRentPaymentStatus(leaseId, period, status) {
    const payment = state.data.rent_payments.find((item) => item.lease_id === leaseId && String(item.period || "").slice(0, 7) === period);
    if (!payment) throw new Error("Canone non trovato. Registra prima il mese selezionato.");
    const updated = {
      ...payment,
      status,
      amount_paid: status === "paid" ? Number(payment.amount_due || 0) : 0,
      paid_at: status === "paid" ? dateISO() : null
    };
    await syncEntity("payment", updated, "update");
    Object.assign(payment, updated);
    finishMutation(status === "paid" ? "Canone segnato come pagato." : "Canone riaperto come da pagare.");
  }

  async function setUtilityBillStatus(billId, status) {
    const bill = state.data.utility_bills.find((item) => item.id === billId);
    if (!bill) throw new Error("Bolletta non trovata.");
    const updated = { ...bill, status };
    await syncEntity("utilityBill", updated, "update");
    Object.assign(bill, updated);
    finishMutation(status === "paid" ? "Bolletta segnata come pagata." : "Bolletta segnata come da pagare.");
  }

  async function deleteManagedRecord(kind, id) {
    if (state.profile?.role !== "admin") throw new Error("Operazione riservata all’amministratore.");
    if (kind === "property") {
      const property = getProperty(id);
      if (!property) throw new Error("Immobile non trovato.");
      let storedPaths = [];
      let remoteDelete = false;
      if (supabaseClient && state.sessionUser) {
        const paymentPaths = state.data.rent_payments.filter((payment) => payment.property_id === id).map((payment) => payment.receipt_path);
        const documentPaths = state.data.documents.filter((document) => document.property_id === id).map((document) => document.storage_path);
        const billPaths = state.data.utility_bills.filter((bill) => bill.property_id === id).map((bill) => bill.document_path);
        const folderPaths = await listStorageFolderPaths(`property/${id}`);
        storedPaths = [...folderPaths, ...paymentPaths, ...documentPaths, ...billPaths];
        const { error } = await supabaseClient.from("properties").delete().eq("id", id);
        if (error) throw new Error(`Cancellazione immobile non riuscita: ${error.message}`);
        remoteDelete = true;
      }
      removePropertyFromState(id);
      let message = "Immobile e dati collegati cancellati.";
      if (remoteDelete) {
        try { await deleteStoragePaths(storedPaths); }
        catch (error) { console.warn(error); message = "Immobile cancellato; alcuni file privati non sono stati rimossi dall’archivio."; }
      }
      finishMutation(message);
      return;
    }
    if (kind === "tenant") {
      const tenant = getProfile(id);
      if (!tenant || tenant.role !== "tenant") throw new Error("Profilo inquilino non trovato.");
      let storedPaths = [];
      let remoteDelete = false;
      if (supabaseClient && state.sessionUser) {
        const receiptPaths = state.data.rent_payments.filter((payment) => payment.tenant_id === id).map((payment) => payment.receipt_path);
        const folderPaths = await listStorageFolderPaths(`tenant/${id}`);
        storedPaths = [...folderPaths, ...receiptPaths];
        const { error } = await supabaseClient.rpc("admin_delete_user", { target_user_id: id });
        if (error) throw new Error(`Cancellazione profilo non riuscita: ${error.message}. Verifica che la funzione admin_delete_user sia stata installata in Supabase.`);
        remoteDelete = true;
      }
      removeTenantFromState(id);
      let message = "Profilo inquilino cancellato con verifica completata.";
      if (remoteDelete) {
        try { await deleteStoragePaths(storedPaths); }
        catch (error) { console.warn(error); message = "Profilo cancellato; alcune contabili private non sono state rimosse dall’archivio."; }
      }
      finishMutation(message);
      return;
    }
    const tables = {
      lease: "leases",
      payment: "rent_payments",
      utility: "utility_accounts",
      "utility-bill": "utility_bills",
      mortgage: "mortgages",
      financial: "financial_entries",
      document: "documents",
      maintenance: "maintenance_jobs",
      provider: "service_providers",
      permission: "property_tenant_permissions"
    };
    const item = getManagedRecord(kind, id);
    const table = tables[kind];
    if (!item || !table) throw new Error("Elemento non trovato o tipo di cancellazione non riconosciuto.");

    let storedPaths = [];
    if (kind === "payment") storedPaths = [item.receipt_path];
    if (kind === "lease") storedPaths = state.data.rent_payments.filter((payment) => payment.lease_id === id).map((payment) => payment.receipt_path);
    if (kind === "utility") storedPaths = state.data.utility_bills.filter((bill) => bill.utility_id === id).map((bill) => bill.document_path);
    if (kind === "utility-bill") storedPaths = [item.document_path];
    if (kind === "document") storedPaths = [item.storage_path];

    if (supabaseClient && state.sessionUser) {
      const { error } = await supabaseClient.from(table).delete().eq("id", id);
      if (error) throw new Error(`Cancellazione non riuscita: ${error.message}`);
    }
    removeManagedRecordFromState(kind, id);
    let message = `${labelsForDelete[kind] || "Elemento"} eliminato.`;
    if (supabaseClient && state.sessionUser && storedPaths.some(Boolean)) {
      try { await deleteStoragePaths(storedPaths); }
      catch (error) { console.warn(error); message += " Il record è stato eliminato, ma un file privato potrebbe essere ancora nell’archivio."; }
    }
    finishMutation(message);
  }

  const labelsForDelete = {
    lease: "Contratto", payment: "Canone", utility: "Utenza", "utility-bill": "Bolletta",
    mortgage: "Mutuo", financial: "Movimento", document: "Documento", maintenance: "Intervento",
    provider: "Manutentore", permission: "Permesso"
  };

  function removeManagedRecordFromState(kind, id) {
    if (kind === "lease") {
      state.data.leases = state.data.leases.filter((lease) => lease.id !== id);
      state.data.rent_payments = state.data.rent_payments.filter((payment) => payment.lease_id !== id);
      if (state.selectedTenantId && !getTenantLeases(state.selectedTenantId).length) state.selectedTenantId = null;
      return;
    }
    if (kind === "payment") state.data.rent_payments = state.data.rent_payments.filter((payment) => payment.id !== id);
    if (kind === "utility") {
      state.data.utility_accounts = state.data.utility_accounts.filter((utility) => utility.id !== id);
      state.data.utility_bills = state.data.utility_bills.filter((bill) => bill.utility_id !== id);
    }
    if (kind === "utility-bill") state.data.utility_bills = state.data.utility_bills.filter((bill) => bill.id !== id);
    if (kind === "mortgage") state.data.mortgages = state.data.mortgages.filter((mortgage) => mortgage.id !== id);
    if (kind === "financial") state.data.financial_entries = state.data.financial_entries.filter((entry) => entry.id !== id);
    if (kind === "document") state.data.documents = state.data.documents.filter((document) => document.id !== id);
    if (kind === "maintenance") state.data.maintenance_jobs = state.data.maintenance_jobs.filter((job) => job.id !== id);
    if (kind === "provider") {
      state.data.service_providers = state.data.service_providers.filter((provider) => provider.id !== id);
      state.data.maintenance_jobs = state.data.maintenance_jobs.map((job) => job.provider_id === id ? { ...job, provider_id: null } : job);
    }
    if (kind === "permission") state.data.tenant_permissions = state.data.tenant_permissions.filter((permission) => permission.id !== id);
  }

  async function listStorageFolderPaths(folderPath) {
    if (!supabaseClient || !state.sessionUser) return [];
    const paths = [];
    const pending = [folderPath];
    while (pending.length) {
      const folder = pending.pop();
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await supabaseClient.storage.from("property-documents").list(folder, { limit: 100, offset });
        if (error) throw new Error(`Verifica dei file prima della cancellazione non riuscita: ${error.message}`);
        for (const entry of data || []) {
          const path = `${folder}/${entry.name}`;
          if (entry.id === null) pending.push(path);
          else paths.push(path);
        }
        if (!data || data.length < 100) break;
      }
    }
    return paths;
  }

  async function deleteStoragePaths(paths) {
    if (!supabaseClient || !state.sessionUser) return;
    const unique = [...new Set(paths.filter(Boolean))];
    for (let index = 0; index < unique.length; index += 100) {
      const { error } = await supabaseClient.storage.from("property-documents").remove(unique.slice(index, index + 100));
      if (error) throw new Error(`Rimozione dei file non riuscita: ${error.message}. Il record può essere già stato cancellato; controlla l’archivio dei file.`);
    }
  }

  function removePropertyFromState(propertyId) {
    const leaseIds = new Set(state.data.leases.filter((lease) => lease.property_id === propertyId).map((lease) => lease.id));
    const utilityIds = new Set(state.data.utility_accounts.filter((utility) => utility.property_id === propertyId).map((utility) => utility.id));
    state.data.properties = state.data.properties.filter((property) => property.id !== propertyId);
    state.data.leases = state.data.leases.filter((lease) => lease.property_id !== propertyId);
    state.data.rent_payments = state.data.rent_payments.filter((payment) => !leaseIds.has(payment.lease_id) && payment.property_id !== propertyId);
    state.data.utility_accounts = state.data.utility_accounts.filter((utility) => utility.property_id !== propertyId);
    state.data.utility_bills = state.data.utility_bills.filter((bill) => bill.property_id !== propertyId && !utilityIds.has(bill.utility_id));
    state.data.mortgages = state.data.mortgages.filter((mortgage) => mortgage.property_id !== propertyId);
    state.data.documents = state.data.documents.filter((document) => document.property_id !== propertyId);
    state.data.maintenance_jobs = state.data.maintenance_jobs.filter((job) => job.property_id !== propertyId);
    state.data.tenant_permissions = state.data.tenant_permissions.filter((permission) => permission.property_id !== propertyId);
    state.data.financial_entries = state.data.financial_entries.map((entry) => entry.property_id === propertyId ? { ...entry, property_id: null } : entry);
    if (state.selectedPropertyId === propertyId) state.selectedPropertyId = null;
  }

  function removeTenantFromState(tenantId) {
    state.data.profiles = state.data.profiles.filter((profile) => profile.id !== tenantId);
    state.data.tenant_permissions = state.data.tenant_permissions.filter((permission) => permission.tenant_id !== tenantId);
    state.data.service_providers = state.data.service_providers.map((provider) => provider.profile_id === tenantId ? { ...provider, profile_id: null } : provider);
    state.data.rent_payments = state.data.rent_payments.map((payment) => payment.tenant_id === tenantId ? { ...payment, tenant_id: null } : payment);
    state.data.leases = state.data.leases.map((lease) => {
      if (!(lease.tenant_ids || []).includes(tenantId)) return lease;
      const tenantIds = lease.tenant_ids.filter((id) => id !== tenantId);
      return { ...lease, tenant_ids: tenantIds, status: tenantIds.length ? lease.status : "ended" };
    });
    if (state.selectedTenantId === tenantId) state.selectedTenantId = null;
  }

  async function login(email, password) {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    state.sessionUser = data.user;
    await hydrateSession(data.user);
    render();
  }

  async function requestPasswordReset() {
    const email = String(document.querySelector('#login-email')?.value || "").trim();
    if (!email) {
      toast("Inserisci prima la tua email nel campo qui sopra.", "error");
      document.querySelector('#login-email')?.focus();
      return;
    }
    if (!supabaseClient) {
      toast("Il collegamento a Supabase non è disponibile.", "error");
      return;
    }
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      toast("Se l’email è registrata, riceverai un messaggio con il link per reimpostare la password.");
    } catch (error) {
      console.error("Richiesta reset password non riuscita", error);
      toast(error.message || "Non è stato possibile inviare il link di reset.", "error");
    }
  }

  async function updateRecoveredPassword(password) {
    if (!supabaseClient) throw new Error("Il collegamento a Supabase non è disponibile.");
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw error;
    await supabaseClient.auth.signOut();
    state.passwordRecovery = false;
    state.sessionUser = null;
    state.profile = null;
    state.mode = null;
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    render();
    toast("Password aggiornata. Ora accedi con la nuova password.");
  }

  async function hydrateSession(user) {
    state.loading = true;
    const { data: profile, error } = await supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    if (!profile) {
      state.loading = false;
      throw new Error("Account riconosciuto, ma senza profilo gestionale. L’amministratore deve sincronizzare gli utenti già registrati in Supabase.");
    }
    state.profile = profile;
    if (!profile || !["admin", "tenant", "provider"].includes(profile.role)) {
      throw new Error("Il profilo non ha un ruolo valido. Contatta l’amministratore.");
    }
    state.mode = profile.role;
    await hydrateRemoteData();
    state.loading = false;
  }

  async function hydrateRemoteData() {
    if (!supabaseClient || !state.sessionUser) return;
    const tables = [
      "properties", "property_private_details", "profiles", "leases", "lease_tenants", "rent_payments", "utility_accounts", "utility_bills", "mortgages", "financial_entries", "documents", "service_providers", "maintenance_jobs", "property_tenant_permissions", "tenant_bank_sender_aliases", "bank_transfer_events"
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
      tenant_permissions: remote.property_tenant_permissions,
      tenant_bank_sender_aliases: remote.tenant_bank_sender_aliases,
      bank_transfer_events: remote.bank_transfer_events
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

  async function syncTenantRelations(tenant, lease, permission = null) {
    const payload = { id: tenant.id, display_name: tenant.display_name, username: tenant.username, email: tenant.email, phone: tenant.phone, role: "tenant" };
    const profileResult = await supabaseClient.from("profiles").upsert(payload);
    if (profileResult.error) throw profileResult.error;
    const leasePayload = { ...lease };
    delete leasePayload.tenant_ids;
    const leaseResult = await supabaseClient.from("leases").upsert(leasePayload);
    if (leaseResult.error) throw leaseResult.error;
    const relationResult = await supabaseClient.from("lease_tenants").upsert({ lease_id: lease.id, tenant_id: tenant.id });
    if (relationResult.error) throw relationResult.error;
    const savedPermission = permission || state.data.tenant_permissions.find((p) => p.tenant_id === tenant.id && p.property_id === lease.property_id);
    if (savedPermission) {
      const result = await supabaseClient.from("property_tenant_permissions").upsert(savedPermission);
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
      utilityBill: ["utility_bills", (value) => ({ ...value, period: value.period?.length === 7 ? `${value.period}-01` : value.period })],
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
    const path = `tenant/${state.sessionUser.id}/${payment.id}/${safeFileName(file.name)}`;
    const { error } = await supabaseClient.storage.from("property-documents").upload(path, file, { upsert: true });
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
    document.addEventListener("change", handleInput);
    document.addEventListener("submit", handleSubmit);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    if (supabaseClient) {
      supabaseClient.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          state.passwordRecovery = true;
          window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
          render();
        }
      });
      try {
        const { data } = await supabaseClient.auth.getSession();
        if (data.session?.user && !state.passwordRecovery) {
          state.sessionUser = data.session.user;
          await hydrateSession(data.session.user);
        }
      } catch (error) {
        console.warn("Sessione remota non recuperata", error);
        toast("Non è stato possibile recuperare la sessione remota.", "error");
      }
    }
    if (window.location.hash.includes("type=recovery")) state.passwordRecovery = true;
    render();
  }

  bootstrap();
})();
