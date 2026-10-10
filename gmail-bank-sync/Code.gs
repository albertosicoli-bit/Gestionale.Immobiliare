const FINECO_QUERY = 'from:service@finecobank.com subject:"bonifico in ingresso" newer_than:30d';
const FUNCTION_NAME = 'bank-transfer-notification';

function setupFinecoSync() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SUPABASE_URL') || !props.getProperty('BANK_WEBHOOK_SECRET')) {
    throw new Error('Imposta SUPABASE_URL e BANK_WEBHOOK_SECRET nelle proprietà dello script.');
  }
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'scanFinecoIncomingTransfers').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('scanFinecoIncomingTransfers').timeBased().everyMinutes(5).create();
  scanFinecoIncomingTransfers();
}

function generateWebhookSecret() {
  const secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('BANK_WEBHOOK_SECRET', secret);
  Logger.log('Copia questo valore e salvalo anche nei Supabase Function Secrets come BANK_WEBHOOK_SECRET: ' + secret);
}

function scanFinecoIncomingTransfers() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = (props.getProperty('SUPABASE_URL') || '').replace(/\/$/, '');
  const hookSecret = props.getProperty('BANK_WEBHOOK_SECRET');
  if (!baseUrl || !hookSecret) throw new Error('Configura SUPABASE_URL e BANK_WEBHOOK_SECRET nelle proprietà dello script.');
  const token = ScriptApp.getOAuthToken();
  const messages = gmailGet_('/users/me/messages?q=' + encodeURIComponent(FINECO_QUERY) + '&maxResults=100', token).messages || [];
  const known = props.getProperties();
  for (const item of messages) {
    if (known['done_' + item.id]) continue;
    const message = gmailGet_('/users/me/messages/' + encodeURIComponent(item.id) + '?format=full', token);
    const headers = message.payload?.headers || [];
    const header = name => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    const from = header('From').toLowerCase();
    if (!from.includes('service@finecobank.com')) continue;
    const parsed = parseFineco_(message.payload);
    if (!parsed) continue;
    const payload = {
      message_id: item.id,
      sender_name: parsed.senderName,
      credited_on: parsed.creditedOn,
      amount: parsed.amount
    };
    const response = UrlFetchApp.fetch(baseUrl + '/functions/v1/' + FUNCTION_NAME, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-bank-hook-secret': hookSecret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    let result = {};
    try { result = JSON.parse(response.getContentText() || '{}'); } catch (_) {}
    if (code >= 200 && code < 300 && !result.unmatched) props.setProperty('done_' + item.id, new Date().toISOString());
    else if (code < 200 || code >= 300) console.error('Supabase ha risposto ' + code + ': ' + response.getContentText());
  }
  trimProcessedIds_(props);
}

function parseFineco_(payload) {
  const text = collectText_(payload).replace(/\r/g, '');
  const sender = text.match(/Ordinante\s*:\s*([^\n\r]+)/i)?.[1]?.trim();
  const date = text.match(/Data\s+accredito\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const amountText = text.match(/Importo\s*:\s*([\d.,]+)\s*(?:EUR|€)?/i)?.[1];
  if (!sender || !date || !amountText) return null;
  const amount = parseItalianAmount_(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { senderName: sender, creditedOn: date[3] + '-' + date[2] + '-' + date[1], amount: Math.round(amount * 100) / 100 };
}

function collectText_(part) {
  let text = '';
  if (part?.mimeType === 'text/plain' && part.body?.data) text += decodeBody_(part.body.data) + '\n';
  (part?.parts || []).forEach(child => { text += collectText_(child); });
  if (!text && part?.mimeType === 'text/html' && part.body?.data) text = decodeBody_(part.body.data).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  return text;
}

function decodeBody_(data) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(data)).getDataAsString('UTF-8');
}

function parseItalianAmount_(value) {
  let text = String(value).replace(/\s/g, '');
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  return Number(text);
}

function gmailGet_(path, token) {
  const response = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1' + path, {
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error('Gmail API ' + response.getResponseCode() + ': ' + response.getContentText());
  return JSON.parse(response.getContentText());
}

function trimProcessedIds_(props) {
  const entries = Object.entries(props.getProperties()).filter(([key]) => key.startsWith('done_')).sort((a, b) => a[1].localeCompare(b[1]));
  entries.slice(0, Math.max(0, entries.length - 500)).forEach(([key]) => props.deleteProperty(key));
}
