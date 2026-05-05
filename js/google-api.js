// ── D-OS Google Integration ────────────────────────────────────────────────────
// Drive sync · Calendar read/write · Gmail alerts · Live theme colour
//
// Setup (one-time, ~10 min):
//  1. console.cloud.google.com → New project "D-OS"
//  2. APIs & Services → Enable: Google Calendar API, Gmail API, Drive API
//  3. APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web App)
//  4. Authorised origins:  https://d-os.vercel.app
//  5. Authorised redirect: https://d-os.vercel.app
//  6. Copy the Client ID
//  7. Vercel → d-os → Settings → Environment Variables → GOOGLE_CLIENT_ID = <paste>
//  8. vercel --prod  (redeploy)

// ── Calendar event → D-OS stat keyword map ────────────────────────────────────
const CALENDAR_KEYWORDS = {
  health:       ['gym','workout','crossfit','bjj','muay thai','muay-thai','training',
                 'run','swim','yoga','physio','doctor','medical','stretch'],
  intelligence: ['study','aws','cert','course','learn','lecture','class',
                 'read','research','tutorial','udemy','coursera','anki','russian'],
  finances:     ['bank','budget','finance','pay','salary','invoice','tax',
                 'accountant','insurance','debit','payment','rent'],
  work:         ['work','meeting','standup','call','interview','sprint','retro',
                 'client','truid','office','sync','review','deploy','on-call']
};

// Priority when events overlap: first match wins
const STAT_PRIORITY = ['work', 'health', 'intelligence', 'finances'];

// Hashtag → stat (checked before keyword matching; add your own here)
const TAG_MAP = {
  '#work': 'work',  '#truid': 'work',   '#meeting': 'work',
  '#health': 'health', '#gym': 'health', '#bjj': 'health', '#run': 'health', '#muay': 'health',
  '#study': 'intelligence', '#intel': 'intelligence', '#aws': 'intelligence', '#russian': 'intelligence', '#learn': 'intelligence',
  '#finance': 'finances', '#finances': 'finances', '#budget': 'finances', '#money': 'finances'
};

// Accent colours per stat (override the --gold variable on theme change)
const STAT_THEME = {
  health:       { accent: '#e05555', dim: '#661515', lite: '#f08080' },
  intelligence: { accent: '#3b82f6', dim: '#1e3a8a', lite: '#60a5fa' },
  finances:     { accent: '#38a169', dim: '#1a5230', lite: '#48bb78' },
  work:         { accent: '#9333ea', dim: '#4c1d95', lite: '#a855f7' },
  _default:     { accent: '#cc1a1a', dim: '#661010', lite: '#e63030' }
};

// ── State ─────────────────────────────────────────────────────────────────────
let _gToken         = null;
let _gTokenExpiry   = 0;
let _gClientId      = '';
let _calPollId      = null;
let _tickId         = null;   // 1-min countdown ticker
let _manualOverride = null;   // { stat, label, until } — user-forced mode

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.appdata'
].join(' ');

// ── Boot: fetch Client ID from /api/config ────────────────────────────────────
(async function loadGoogleConfig() {
  try {
    const res  = await fetch('/api/config');
    const data = await res.json();
    if (data.google_client_id) _gClientId = data.google_client_id;
  } catch { /* no config endpoint — use empty, user will see a message */ }

  // Restore light mode preference
  if (localStorage.getItem('dos_light_mode') === '1') {
    document.documentElement.classList.add('light-mode');
    const btn = document.getElementById('light-mode-btn');
    if (btn) btn.textContent = '◑';
  }

  // Restore manual mode override (if still within its 1-hour window)
  try {
    const mo = JSON.parse(localStorage.getItem('dos_manual_mode') || 'null');
    if (mo && Date.now() < mo.until) _manualOverride = mo;
    else localStorage.removeItem('dos_manual_mode');
  } catch { /* ignore */ }

  // If there was a saved token, restore it and start polling
  const saved   = localStorage.getItem('dos_google_token');
  const expiry  = parseInt(localStorage.getItem('dos_google_token_expiry') || '0');
  if (saved && Date.now() < expiry) {
    _gToken       = saved;
    _gTokenExpiry = expiry;
    startCalendarPolling();
  } else if (localStorage.getItem('dos_google_was_connected') === '1') {
    // Token expired but user has connected before — silently get a fresh one
    _attemptSilentReconnect();
  }

  // Restore last applied theme colour (or apply neutral if nothing stored)
  _restoreTheme();
})();

// ── Token helpers ─────────────────────────────────────────────────────────────
function _getToken() {
  if (_gToken && Date.now() < _gTokenExpiry) return _gToken;
  _gToken = null;
  return null;
}

function _saveToken(tokenObj) {
  _gToken       = tokenObj.access_token;
  _gTokenExpiry = Date.now() + (tokenObj.expires_in - 60) * 1000; // 1-min safety margin
  localStorage.setItem('dos_google_token',        _gToken);
  localStorage.setItem('dos_google_token_expiry', _gTokenExpiry.toString());
  localStorage.setItem('dos_google_was_connected', '1'); // remember for auto-reconnect
}

function isGoogleConnected() { return !!_getToken(); }

// ── Auth ──────────────────────────────────────────────────────────────────────
function googleSignIn() {
  if (!window.google?.accounts?.oauth2) {
    showToast('Google SDK not ready yet — try again in 2 sec', 'error'); return;
  }
  if (!_gClientId) {
    showToast('GOOGLE_CLIENT_ID not set in Vercel env vars', 'error'); return;
  }
  google.accounts.oauth2.initTokenClient({
    client_id: _gClientId,
    scope: SCOPES,
    callback(tok) {
      if (tok.error) { showToast(`Google auth failed: ${tok.error}`, 'error'); return; }
      _saveToken(tok);
      showToast('Google connected ✓', 'gold');
      updateGoogleStatusUI();
      startCalendarPolling();
    }
  }).requestAccessToken();
}

// Silent reconnect — called automatically on boot if previously connected.
// Uses prompt:'' so no popup appears; Google returns a fresh token if the
// user's browser session + app consent are still active (typically months).
async function _attemptSilentReconnect() {
  // Wait up to 6 s for the GIS SDK to finish loading (it's async defer)
  await new Promise(resolve => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const t = setInterval(() => {
      if (window.google?.accounts?.oauth2) { clearInterval(t); resolve(); }
    }, 150);
    setTimeout(() => { clearInterval(t); resolve(); }, 6000);
  });
  if (!window.google?.accounts?.oauth2 || !_gClientId) return;

  google.accounts.oauth2.initTokenClient({
    client_id: _gClientId,
    scope: SCOPES,
    prompt: '',   // silent — no popup; fails quietly if consent lapsed
    callback(tok) {
      if (tok.error || !tok.access_token) return;
      _saveToken(tok);
      updateGoogleStatusUI();
      startCalendarPolling();
    }
  }).requestAccessToken();
}

function googleSignOut() {
  if (_gToken && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(_gToken);
  }
  _gToken = null; _gTokenExpiry = 0;
  localStorage.removeItem('dos_google_token');
  localStorage.removeItem('dos_google_token_expiry');
  localStorage.removeItem('dos_google_was_connected');
  stopCalendarPolling();
  applyNeutralTheme();
  updateGoogleStatusUI();
  showToast('Google disconnected', 'info');
}

// ── Calendar: read ────────────────────────────────────────────────────────────
async function fetchCalendarEvents(daysAhead = 7) {
  const token = _getToken();
  if (!token) return [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const now = startOfDay.toISOString();
  const end = new Date(Date.now() + 86400000 * daysAhead).toISOString();

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
      `?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(end)}` +
      `&singleEvents=true&orderBy=startTime&maxResults=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 401) { googleSignOut(); return []; }
    const data = await res.json();
    return (data.items || []).map(_parseEvent);
  } catch (e) {
    console.error('[Calendar] fetch error', e);
    return [];
  }
}

function _parseEvent(e) {
  const title = e.summary || 'Untitled';
  const desc  = e.description || '';
  return {
    id:     e.id,
    title,
    start:  e.start?.dateTime || e.start?.date,
    end:    e.end?.dateTime   || e.end?.date,
    allDay: !e.start?.dateTime,
    stat:   _classifyEvent(title, desc),
    raw:    e
  };
}

function _classifyEvent(title, desc) {
  const raw  = `${title} ${desc}`;
  const lower = raw.toLowerCase();
  // Explicit #tags take priority over keyword matching
  for (const [tag, stat] of Object.entries(TAG_MAP)) {
    if (lower.includes(tag)) return stat;
  }
  for (const [stat, kw] of Object.entries(CALENDAR_KEYWORDS)) {
    if (kw.some(k => lower.includes(k))) return stat;
  }
  return null;
}

// Fetches a window spanning 8h back → 4h ahead to catch in-progress events
async function _fetchCurrentWindow() {
  const token = _getToken();
  if (!token) return [];
  const from = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
  const to   = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
      `?timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}` +
      `&singleEvents=true&orderBy=startTime&maxResults=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 401) { googleSignOut(); return []; }
    const data = await res.json();
    return (data.items || []).map(_parseEvent);
  } catch (e) {
    console.error('[Calendar] theme fetch error', e);
    return [];
  }
}

async function _getCurrentEvent() {
  const events = await _fetchCurrentWindow();
  const now    = new Date();
  const active = events.filter(ev => {
    if (ev.allDay) return false;
    return now >= new Date(ev.start) && now <= new Date(ev.end);
  });
  if (!active.length) return null;
  // Pick by priority: work > health > intelligence > finances
  for (const stat of STAT_PRIORITY) {
    const match = active.find(ev => ev.stat === stat);
    if (match) return match;
  }
  return active.find(ev => ev.stat) || null;
}

// ── Calendar: write ───────────────────────────────────────────────────────────
async function createCalendarEvent({ title, description = '', startISO, endISO, stat = null }) {
  const token = _getToken();
  if (!token) { showToast('Connect Google first', 'error'); return null; }

  // Map stat → Google Calendar colorId
  const COLOR_ID = { health: '11', finances: '10', intelligence: '9', work: '3' };
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const body = {
    summary:     title,
    description,
    start: { dateTime: startISO, timeZone: tz },
    end:   { dateTime: endISO,   timeZone: tz },
    ...(stat && COLOR_ID[stat] ? { colorId: COLOR_ID[stat] } : {})
  };

  try {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast(`"${title}" → Google Calendar ✓`, 'gold');
    return await res.json();
  } catch (e) {
    showToast(`Calendar write failed: ${e.message}`, 'error');
    return null;
  }
}

// Show a quick "Add to Calendar" modal
function showAddCalendarEventModal(prefill = {}) {
  const existing = document.getElementById('cal-event-modal');
  if (existing) existing.remove();

  const now   = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const fmt   = d => d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"

  const modal = document.createElement('div');
  modal.id    = 'cal-event-modal';
  modal.className = 'cal-modal-overlay';
  modal.innerHTML = `
    <div class="cal-modal-sheet">
      <div class="cal-modal-header">
        <span>📅 Add to Google Calendar</span>
        <button class="icon-btn" onclick="document.getElementById('cal-event-modal').remove()">✕</button>
      </div>
      <input id="cal-title"  type="text"     placeholder="Event title"  class="input-field" value="${prefill.title || ''}"/>
      <input id="cal-desc"   type="text"     placeholder="Description (optional)" class="input-field"/>
      <div class="input-row">
        <input id="cal-start" type="datetime-local" class="input-field" value="${fmt(now)}"/>
        <input id="cal-end"   type="datetime-local" class="input-field" value="${fmt(later)}"/>
      </div>
      <select id="cal-stat" class="input-field">
        <option value="">No category (default colour)</option>
        <option value="work">Work (purple)</option>
        <option value="health">Health (red)</option>
        <option value="intelligence">Intelligence (blue)</option>
        <option value="finances">Finances (green)</option>
      </select>
      <button class="btn btn-primary w-full" onclick="submitCalendarEvent()">Add Event</button>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('cal-title')?.focus();
}

async function submitCalendarEvent() {
  const title = document.getElementById('cal-title')?.value.trim();
  const desc  = document.getElementById('cal-desc')?.value.trim() || '';
  const start = document.getElementById('cal-start')?.value;
  const end   = document.getElementById('cal-end')?.value;
  const stat  = document.getElementById('cal-stat')?.value || null;

  if (!title || !start || !end) { showToast('Title, start and end required', 'error'); return; }

  const result = await createCalendarEvent({
    title, description: desc,
    startISO: new Date(start).toISOString(),
    endISO:   new Date(end).toISOString(),
    stat
  });
  if (result) document.getElementById('cal-event-modal')?.remove();
}

// ── Gmail: primary inbox unread (for automation) ─────────────────────────────
async function fetchInboxEmails(maxResults = 20) {
  const token = _getToken();
  if (!token) return [];
  try {
    const q   = encodeURIComponent('is:unread category:primary');
    const res = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 401) { googleSignOut(); return []; }
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.messages?.length) return [];
    const details = await Promise.all(
      data.messages.map(m =>
        fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(r => r.json())
      )
    );
    return details.map(msg => {
      const headers = msg.payload?.headers || [];
      return {
        id:      msg.id,
        subject: headers.find(h => h.name === 'Subject')?.value || '(no subject)',
        from:    headers.find(h => h.name === 'From')?.value    || '',
        snippet: msg.snippet || ''
      };
    });
  } catch (e) { console.error('[Gmail Inbox]', e); return []; }
}

// ── Gmail: important unread messages ─────────────────────────────────────────
async function fetchGmailAlerts() {
  const token = _getToken();
  if (!token) return [];

  try {
    const q   = encodeURIComponent('is:unread (invoice OR salary OR statement OR alert OR "payment" OR "debit order" OR "account")');
    const res = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.messages?.length) return [];

    const details = await Promise.all(
      (data.messages || []).map(m =>
        fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}` +
          `?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(r => r.json())
      )
    );

    return details.map(msg => {
      const headers = msg.payload?.headers || [];
      return {
        id:      msg.id,
        subject: headers.find(h => h.name === 'Subject')?.value || '(no subject)',
        from:    headers.find(h => h.name === 'From')?.value    || '',
        snippet: msg.snippet || ''
      };
    });
  } catch (e) {
    console.error('[Gmail]', e);
    return [];
  }
}

// ── Live theme colour (Google Calendar → UI accent) ───────────────────────────
function startCalendarPolling() {
  _checkAndApplyTheme();
  _calPollId = setInterval(_checkAndApplyTheme, 5 * 60 * 1000);
  _startCountdownTick();
}
function stopCalendarPolling() {
  if (_calPollId) { clearInterval(_calPollId); _calPollId = null; }
  if (_tickId)    { clearInterval(_tickId);    _tickId    = null; }
}

function _startCountdownTick() {
  if (_tickId) return;
  _tickId = setInterval(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('dos_theme') || 'null');
      if (!stored) return;
      const c = STAT_THEME[stored.stat] || STAT_THEME._default;
      _renderThemeBar(stored.stat, stored.label, c.accent, stored.endISO);
    } catch { /* ignore */ }
  }, 60 * 1000);
}

async function _checkAndApplyTheme() {
  // Manual override takes priority
  if (_manualOverride) {
    if (Date.now() < _manualOverride.until) {
      applyThemeColour(_manualOverride.stat, `${_manualOverride.label} ·manual`, null);
      return;
    }
    _manualOverride = null;
    localStorage.removeItem('dos_manual_mode');
  }
  const ev = await _getCurrentEvent();
  if (ev?.stat) applyThemeColour(ev.stat, ev.title, ev.end);
  else          applyNeutralTheme();
}

function applyThemeColour(stat, label = '', endISO = null) {
  const c = STAT_THEME[stat] || STAT_THEME._default;
  localStorage.setItem('dos_theme', JSON.stringify({ stat, label, endISO, ts: Date.now() }));
  _renderThemeBar(stat, label, c.accent, endISO);
  // Let KAI drive --gold / --kai-accent so all accents stay in sync
  if (typeof kaiUpdate === 'function') kaiUpdate();
}

function applyNeutralTheme() {
  localStorage.removeItem('dos_theme');
  _renderThemeBar(null);
  // Let KAI drive the accent — it uses activity-based colours as the idle/neutral state
  if (typeof kaiUpdate === 'function') kaiUpdate();
}

function _restoreTheme() {
  if (_manualOverride) {
    applyThemeColour(_manualOverride.stat, `${_manualOverride.label} ·manual`, null);
    return;
  }
  try {
    const stored = JSON.parse(localStorage.getItem('dos_theme') || 'null');
    if (!stored) { applyNeutralTheme(); return; }
    // Stale if > 2 hours old and event has ended (or no endISO)
    const ended = stored.endISO ? Date.now() > new Date(stored.endISO).getTime() : false;
    if (ended || Date.now() - stored.ts > 2 * 3600 * 1000) {
      applyNeutralTheme();
    } else {
      applyThemeColour(stored.stat, stored.label, stored.endISO);
    }
  } catch { applyNeutralTheme(); }
}

function _renderThemeBar(stat, label = '', colour = '', endISO = null) {
  const bar = document.getElementById('theme-bar');
  if (!bar) return;
  bar.style.display  = 'flex';
  bar.style.cursor   = 'pointer';
  bar.onclick        = _showModeOverride;

  if (!stat) {
    bar.style.background  = 'var(--bg-card)';
    bar.style.borderColor = 'var(--border)';
    bar.innerHTML = `
      <span style="font-size:0.72rem;color:var(--text-sub)">No active mode</span>
      <span style="margin-left:auto;font-size:0.72rem;color:var(--text-sub);font-weight:600">Set mode ›</span>`;
    return;
  }

  let timeStr = '';
  if (endISO) {
    const minsLeft = Math.round((new Date(endISO) - Date.now()) / 60000);
    if (minsLeft > 0 && minsLeft < 300) timeStr = ` · ${minsLeft}m left`;
  }

  bar.style.background  = colour + '16';
  bar.style.borderColor = colour + '40';
  bar.innerHTML = `
    <span class="theme-dot" style="background:${colour}"></span>
    <span style="font-size:0.72rem;color:${colour}">Now: <strong>${label}</strong>${timeStr}</span>
    <span style="margin-left:auto;font-size:0.72rem;color:${colour}88;font-weight:600">Change ›</span>`;
}

// ── Manual mode override ───────────────────────────────────────────────────────
function _showModeOverride(e) {
  e?.stopPropagation();
  const existing = document.getElementById('mode-override-panel');
  if (existing) { existing.remove(); return; }

  // Use KAI_COLOURS if available (kai.js loaded), otherwise fall back to STAT_THEME
  const kc = (typeof KAI_COLOURS !== 'undefined') ? KAI_COLOURS : {};
  const MODES = [
    ['work',         '⚙️ Work',       (kc.work         || STAT_THEME.work).accent],
    ['health',       '💪 Health',     (kc.health       || STAT_THEME.health).accent],
    ['intelligence', '📚 Study',      (kc.intelligence || STAT_THEME.intelligence).accent],
    ['finances',     '💰 Finance',    (kc.finances     || STAT_THEME.finances).accent],
    ['martial_arts', '🥋 Martial',    (kc.martial_arts || {}).accent || '#DC143C'],
    ['wellness',     '🧘 Wellness',   (kc.wellness     || {}).accent || '#20B2AA'],
    ['creative',     '🎨 Creative',   (kc.creative     || {}).accent || '#9B59B6'],
    ['social',       '🤝 Social',     (kc.social       || {}).accent || '#FF6B6B'],
    ['_sleep',       '🌙 Sleep',      (kc._sleep       || {}).accent || '#191970'],
    [null,           '↺ Auto',        '#888888'],
  ];

  const panel = document.createElement('div');
  panel.id        = 'mode-override-panel';
  panel.className = 'mode-override-panel';
  panel.innerHTML = `
    <div class="override-label">Preview mode · 1 hour</div>
    <div class="override-btns">
      ${MODES.map(([stat, label, col]) => `
        <button class="mode-override-btn"
          onclick="_setManualMode(${stat ? `'${stat}'` : 'null'}, '${label.replace(/\S+\s/, '')}')"
          style="color:${col};border:1px solid ${col}55;background:${col}18">
          ${label}
        </button>`).join('')}
    </div>`;

  const bar = document.getElementById('theme-bar');
  bar.after(panel);

  setTimeout(() => {
    document.addEventListener('click', function dismiss(ev) {
      if (!panel.contains(ev.target) && ev.target.id !== 'theme-bar') {
        panel.remove();
        document.removeEventListener('click', dismiss);
      }
    });
  }, 100);
}

function _setManualMode(stat, label) {
  document.getElementById('mode-override-panel')?.remove();
  if (!stat) {
    _manualOverride = null;
    localStorage.removeItem('dos_manual_mode');
    _checkAndApplyTheme(); // calls applyNeutralTheme → kaiUpdate internally
    return;
  }
  _manualOverride = { stat, label, until: Date.now() + 3600 * 1000 };
  localStorage.setItem('dos_manual_mode', JSON.stringify(_manualOverride));
  applyThemeColour(stat, `${label} ·manual`, null); // calls kaiUpdate internally
}

// ── Light / dark mode toggle ───────────────────────────────────────────────────
function toggleLightMode() {
  const isLight = document.documentElement.classList.toggle('light-mode');
  localStorage.setItem('dos_light_mode', isLight ? '1' : '0');
  const btn = document.getElementById('light-mode-btn');
  if (btn) btn.textContent = isLight ? '◑' : '◐';
  // Reapply neutral colours for the new background brightness
  const stored = JSON.parse(localStorage.getItem('dos_theme') || 'null');
  if (!stored && !_manualOverride) applyNeutralTheme();
}

// ── Drive backup ───────────────────────────────────────────────────────────────
function _saveSyncTimestamp() {
  localStorage.setItem('dos_last_sync', Date.now().toString());
}

function getLastSyncLabel() {
  const ts = parseInt(localStorage.getItem('dos_last_sync') || '0');
  if (!ts) return 'Never synced';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

async function syncToDrive() {
  if (!_gClientId) { showToast('GOOGLE_CLIENT_ID not configured in Vercel', 'error'); return; }
  const token = _getToken();
  if (!token) { showToast('Connecting to Google...', 'info'); googleSignIn(); return; }
  try {
    for (const key of ['character','health','finances','intelligence','work']) {
      await _driveWrite(`dos_${key}.json`, DOS.data[key], token);
    }
    _saveSyncTimestamp();
    showToast('Synced to Google Drive ✓', 'gold');
    updateGoogleStatusUI();
  } catch (e) {
    _gToken = null;
    showToast('Drive sync failed — try reconnecting', 'error');
  }
}

async function syncFromDrive() {
  const token = _getToken();
  if (!token) { showToast('Connect Google first', 'error'); return; }
  let loaded = 0;
  for (const key of ['character','health','finances','intelligence','work']) {
    const data = await _driveRead(`dos_${key}.json`, token);
    if (data) { DOS.data[key] = data; DOS.save(key); loaded++; }
  }
  if (loaded) { showToast(`Loaded ${loaded} files from Drive ✓`, 'gold'); DOS.navigate('dashboard'); }
  else showToast('No Drive backup found', 'info');
}

async function _driveWrite(filename, data, token) {
  const content = JSON.stringify(data, null, 2);
  // Find existing file to upsert (avoid accumulating duplicates)
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${filename}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchJson = await searchRes.json();
  const existingId = searchJson.files?.[0]?.id;

  const fileBlob = new Blob([content], { type: 'application/json' });

  if (existingId) {
    // PATCH existing file (update content only, no reparenting)
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: fileBlob }
    );
    if (!res.ok) throw new Error(`Drive update ${res.status}`);
  } else {
    // POST new file
    const meta = { name: filename, parents: ['appDataFolder'] };
    const body = new FormData();
    body.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    body.append('file', fileBlob);
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body }
    );
    if (!res.ok) throw new Error(`Drive create ${res.status}`);
  }
}

async function _driveRead(filename, token) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${filename}'&orderBy=modifiedTime+desc&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const list = await res.json();
  if (!list.files?.length) return null;
  const fr = await fetch(
    `https://www.googleapis.com/drive/v3/files/${list.files[0].id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return await fr.json();
}

// ── Google status UI helper ────────────────────────────────────────────────────
function updateGoogleStatusUI() {
  const el = document.getElementById('google-status-row');
  if (!el) return;
  const connected = isGoogleConnected();
  el.innerHTML = connected
    ? `<span style="color:var(--positive)">● Connected</span>
       <button class="btn btn-sm" onclick="googleSignOut()">Disconnect</button>`
    : `<span style="color:var(--text-dim)">○ Not connected</span>
       <button class="btn btn-primary btn-sm" onclick="googleSignIn()">Connect</button>`;

  const actions = document.getElementById('google-cal-actions');
  if (actions) actions.style.display = connected ? 'flex' : 'none';

  // Drive sync row — show last sync time + manual sync button
  const syncRow = document.getElementById('google-sync-row');
  if (syncRow) {
    syncRow.style.display = connected ? 'flex' : 'none';
    if (connected) {
      syncRow.innerHTML = `
        <span>Drive backup: <strong>${getLastSyncLabel()}</strong></span>
        <button class="btn btn-sm" onclick="syncToDrive()">Sync now</button>`;
    }
  }
}

// ── Push notifications (local, no server needed) ───────────────────────────────
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

function checkAndFireNotifications() {
  if (Notification.permission !== 'granted') return;
  const now  = new Date();
  const hour = now.getHours();
  if (hour < 8 || hour > 21) return; // quiet hours

  const intel   = DOS.data.intelligence;
  const health  = DOS.data.health;
  const russian = intel?.russian || {};
  const todayStr = today();

  // Russian streak at risk
  if (russian.streakDays > 0 && russian.lastStudyDate !== todayStr && hour >= 19) {
    _fireNotification(
      '🇷🇺 Russian streak at risk',
      `${russian.streakDays} day streak — log 10 min to keep it alive`,
      'russian'
    );
    return;
  }

  // BJJ check (evenings)
  if (hour >= 16) {
    const wkStart   = getWeekStart();
    const bjjCount  = (health.workouts || []).filter(w =>
      (w.type === 'bjj' || w.type === 'muay-thai') && (w.date || '') >= wkStart
    ).length;
    if (bjjCount < 3) {
      _fireNotification(
        '🥋 Dagestan prep',
        `${bjjCount}/3 BJJ sessions this week — train today`,
        'bjj'
      );
      return;
    }
  }

  // Exam countdown warning
  const certs      = intel?.certifications || [];
  const activeCert = certs.find(c => c.status === 'in_progress');
  if (activeCert?.targetDate) {
    const days = Math.ceil((new Date(activeCert.targetDate) - now) / 86400000);
    if (days > 0 && days <= 14 && activeCert.progress < 90) {
      _fireNotification(
        `☁️ ${activeCert.name}`,
        `${days} days to exam · ${activeCert.progress}% ready — study today`,
        'exam'
      );
    }
  }
}

function _fireNotification(title, body, tag) {
  const last = parseInt(localStorage.getItem(`dos_notif_${tag}`) || '0');
  if (Date.now() - last < 4 * 3600 * 1000) return; // max 1x per 4h per tag
  localStorage.setItem(`dos_notif_${tag}`, Date.now().toString());

  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag });
  } else {
    new Notification(title, { body, tag, icon: '/assets/icon-192.png' });
  }
}

