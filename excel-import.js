(() => {
  "use strict";

  function readRows(workbook, sheetName, headerIndex, requiredHeaders) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error("Nel file manca il foglio «" + sheetName + ".»");
    const matrix = window.XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: true
    });
    const headers = (matrix[headerIndex] || []).map((value) => String(value || "").trim());
    const missing = requiredHeaders.filter((name) => !headers.includes(name));
    if (missing.length) {
      throw new Error("Il foglio «" + sheetName + "» non ha le colonne attese: " + missing.join(", ") + ".");
    }
    const records = [];
    for (let offset = headerIndex + 1; offset < matrix.length; offset += 1) {
      const cells = matrix[offset] || [];
      if (!cells.some((value) => value !== "" && value !== null && value !== undefined)) break;
      const values = {};
      headers.forEach((name, column) => {
        if (name) values[name] = cells[column] ?? "";
      });
      records.push({ excelRow: offset + 1, values });
    }
    return records;
  }

  async function read(file) {
    if (!window.XLSX) throw new Error("Il lettore Excel non è disponibile. Ricarica la pagina quando la connessione è attiva.");
    if (!file || !/\.xlsx$/i.test(file.name)) throw new Error("Seleziona il file Excel .xlsx rielaborato.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Il file supera il limite di 20 MB.");
    const workbook = window.XLSX.read(new Uint8Array(await file.arrayBuffer()), {
      type: "array",
      cellDates: true
    });
    const properties = readRows(workbook, "Import immobili", 4, [
      "Riga Excel", "Nome · properties.name", "Indirizzo · properties.address", "Comune · properties.city",
      "CAP · properties.postal_code", "Tipologia · properties.type", "Stato · properties.status",
      "Valore stimato € · private_details", "Note admin · private_details.notes"
    ]);
    const accounts = readRows(workbook, "Utenze e bollette", 4, [
      "Immobile candidato", "Utenza · kind", "Fornitore", "Codice cliente", "Codice POD/servizio",
      "Codice contratto candidato", "Intestatario · holder", "Riaddebito inquilino",
      "Note candidate per la piattaforma"
    ]);
    const bills = readRows(workbook, "Utenze e bollette", 29, [
      "Immobile candidato", "Utenza", "Fornitore", "Periodo candidato", "Importo €",
      "Stato · utility_bills.status", "Scadenza · due_date", "Collegamento utenza"
    ]);
    return { fileName: file.name, properties, accounts, bills };
  }

  window.PropertyExcelImport = { read };
})();
