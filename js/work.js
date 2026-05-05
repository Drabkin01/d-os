// ── Work Module — overrides app.js renderWork() ────────────────────────────────

let _workTab = 'tickets';

// ── Tab Router ─────────────────────────────────────────────────────────────────

function renderWork() {
  const container = document.getElementById('work-content');
  if (!container) return;

  container.innerHTML = buildStatAICard('work') + `
    <nav class="fin-tabs">
      <button class="fin-tab" data-tab="tickets"  onclick="switchWorkTab('tickets')">Tickets</button>
      <button class="fin-tab" data-tab="calendar" onclick="switchWorkTab('calendar')">Calendar</button>
      <button class="fin-tab" data-tab="projects" onclick="switchWorkTab('projects')">Projects</button>
      <button class="fin-tab" data-tab="stats"    onclick="switchWorkTab('stats')">Stats</button>
    </nav>
    <div id="work-tab-content"></div>`;

  switchWorkTab(_workTab);
}

function switchWorkTab(tab) {
  _workTab = tab;
  document.querySelectorAll('#work-content .fin-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  const el = document.getElementById('work-tab-content');
  if (!el) return;
  switch (tab) {
    case 'tickets':
      el.innerHTML = buildTicketsHTML();
      if (typeof isGoogleConnected === 'function' && isGoogleConnected()) loadGmailAlertsInTickets();
      break;
    case 'calendar':
      el.innerHTML = buildCalendarHTML();
      if (typeof isGoogleConnected === 'function' && isGoogleConnected()) loadCalendarEvents();
      break;
    case 'projects': el.innerHTML = buildProjectsHTML(); break;
    case 'stats':
      el.innerHTML = buildWorkStatsHTML();
      requestAnimationFrame(() => renderWorkCharts());
      break;
  }
}

// ── Calendar Tab ──────────────────────────────────────────────────────────────

function buildCalendarHTML() {
  if (typeof isGoogleConnected !== 'function' || !isGoogleConnected()) {
    return `
      <section class="card" style="text-align:center;padding:24px 16px">
        <div style="font-size:1.5rem;margin-bottom:8px">📅</div>
        <div style="font-size:0.9rem;font-weight:700;color:var(--text);margin-bottom:6px">Calendar not connected</div>
        <p class="sub-text" style="margin-bottom:14px">Connect Google in the Profile tab to see your schedule here.</p>
        <button class="btn btn-outline" onclick="DOS.navigate('profile')">Connect Google →</button>
      </section>`;
  }
  return `
    <div class="cal-loading" id="cal-loading">
      <div class="ai-spinner-dot"></div><div class="ai-spinner-dot"></div><div class="ai-spinner-dot"></div>
      <span class="sub-text">Loading calendar...</span>
    </div>
    <div id="cal-events-wrap"></div>
    <button class="btn btn-outline w-full" style="margin-top:8px" onclick="showAddCalendarEventModal()">+ Add Event</button>`;
}

async function loadCalendarEvents() {
  try {
    const events = await fetchCalendarEvents(14);
    document.getElementById('cal-loading')?.remove();
    const wrap = document.getElementById('cal-events-wrap');
    if (!wrap) return;
    if (!events.length) {
      wrap.innerHTML = '<p class="empty-state" style="padding:16px">No events in the next 2 weeks.</p>';
      return;
    }
    wrap.innerHTML = _buildCalGroupsHTML(events);
  } catch {
    document.getElementById('cal-loading')?.remove();
    const wrap = document.getElementById('cal-events-wrap');
    if (wrap) wrap.innerHTML = '<p class="empty-state">Could not load calendar. Try reconnecting Google.</p>';
  }
}

function _buildCalGroupsHTML(events) {
  const todayStr = new Date().toISOString().split('T')[0];
  const tmrwStr  = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const STAT_COLOR = {
    health: 'var(--health)', intelligence: 'var(--intelligence)',
    finances: 'var(--finances)', work: 'var(--work)'
  };

  const groups = {};
  events.forEach(ev => {
    const d = (ev.start || '').substring(0, 10);
    if (!groups[d]) groups[d] = [];
    groups[d].push(ev);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, evs]) => {
      const isToday = date === todayStr;
      const isTmrw  = date === tmrwStr;
      const label   = isToday ? 'Today' : isTmrw ? 'Tomorrow'
        : new Date(date + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' });

      return `
        <section class="cal-day-card card">
          <div class="cal-day-header">
            <span class="cal-day-label ${isToday ? 'today' : ''}">${label}</span>
            <span class="sub-text">${evs.length} event${evs.length !== 1 ? 's' : ''}</span>
          </div>
          ${evs.map(ev => {
            const color = STAT_COLOR[ev.stat] || 'var(--border)';
            const time  = ev.allDay ? 'All day'
              : new Date(ev.start).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
            return `
              <div class="cal-event-row" style="border-left-color:${color}">
                <span class="cal-event-time">${time}</span>
                <span class="cal-event-title">${ev.title}</span>
                ${ev.stat ? `<span class="cal-event-tag" style="color:${color}">${ev.stat}</span>` : ''}
              </div>`;
          }).join('')}
        </section>`;
    }).join('');
}

// ── Email Rule Engine ──────────────────────────────────────────────────────────

let _emailRulesOpen   = false;
let _cachedInboxEmails = null;
let _inboxCacheTime    = 0;

async function _getEmailsWithCache() {
  if (_cachedInboxEmails && Date.now() - _inboxCacheTime < 300000) return _cachedInboxEmails;
  _cachedInboxEmails = await fetchInboxEmails(20);
  _inboxCacheTime    = Date.now();
  return _cachedInboxEmails;
}

function _matchEmailRule(email, rules) {
  for (const rule of (rules || []).filter(r => r.enabled)) {
    const from    = (email.from    || '').toLowerCase();
    const subject = (email.subject || '').toLowerCase();
    switch (rule.type) {
      case 'domain':  if (from.includes(rule.value.toLowerCase()))    return rule; break;
      case 'subject': if (subject.includes(rule.value.toLowerCase())) return rule; break;
      case 'sender':  if (from.includes(rule.value.toLowerCase()))    return rule; break;
    }
  }
  return null;
}

function _markEmailProcessed(id) {
  if (!DOS.data.work.processedEmailIds) DOS.data.work.processedEmailIds = [];
  if (!DOS.data.work.processedEmailIds.includes(id)) {
    DOS.data.work.processedEmailIds.push(id);
    if (DOS.data.work.processedEmailIds.length > 500) {
      DOS.data.work.processedEmailIds = DOS.data.work.processedEmailIds.slice(-500);
    }
    DOS.save('work');
  }
}

function _createTicketEntry(email, lane, priority) {
  if ((DOS.data.work.tickets || []).some(t => t.emailId === email.id)) return false;
  DOS.data.work.tickets.push({
    id: `tkt-${Date.now()}`,
    title:       email.subject,
    lane:        lane     || 'truid',
    priority:    priority || 'medium',
    status:      'open',
    notes:       `From: ${email.from}\n\n${email.snippet}`,
    deadline:    null,
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    completedAt: null,
    xpEarned:    0,
    emailId:     email.id
  });
  DOS.save('work');
  awardXP('work', 5, `Email ticket: ${email.subject}`);
  return true;
}

async function loadGmailAlertsInTickets() {
  const container = document.getElementById('gmail-alerts-container');
  if (!container) return;
  try {
    const emails    = await _getEmailsWithCache();
    const work      = DOS.data.work;
    const rules     = work.emailRules    || [];
    const processed = new Set(work.processedEmailIds || []);
    const fresh     = emails.filter(e => !processed.has(e.id));

    if (!fresh.length) {
      container.innerHTML = '<p class="empty-state" style="font-size:0.72rem">Inbox clear.</p>';
      return;
    }

    const matched   = [];
    const unmatched = [];
    fresh.forEach(email => {
      const rule = _matchEmailRule(email, rules);
      if (rule) matched.push({ email, rule });
      else       unmatched.push(email);
    });

    let html = '';

    if (matched.length) {
      html += `
        <div class="email-match-banner">
          <span class="email-match-label">🎯 ${matched.length} rule match${matched.length !== 1 ? 'es' : ''}</span>
          <button class="btn btn-sm" onclick="createAllMatchedTickets()">Create ${matched.length} ticket${matched.length !== 1 ? 's' : ''}</button>
        </div>
        ${matched.map(({ email, rule }) => `
          <div class="gmail-alert-row matched">
            <div class="gmail-alert-rule-tag">${_escHtml(rule.name)}</div>
            <div class="gmail-alert-subject">${_escHtml(email.subject)}</div>
            <div class="gmail-alert-from">${_escHtml(email.from)}</div>
            <div class="gmail-alert-snippet">${_escHtml(email.snippet)}</div>
            <div class="gmail-alert-actions">
              <button class="btn btn-sm" onclick="convertEmailToTicket('${_esc(email.id)}','${rule.lane}','${rule.priority}')">→ Ticket</button>
              <button class="icon-btn" onclick="dismissEmail('${_esc(email.id)}')">×</button>
            </div>
          </div>`).join('')}`;
    }

    if (unmatched.length) {
      if (matched.length) html += `<div class="email-section-divider">Unmatched · ${unmatched.length}</div>`;
      html += unmatched.map(email => `
        <div class="gmail-alert-row">
          <div class="gmail-alert-subject">${_escHtml(email.subject)}</div>
          <div class="gmail-alert-from">${_escHtml(email.from)}</div>
          <div class="gmail-alert-snippet">${_escHtml(email.snippet)}</div>
          <div class="gmail-alert-actions">
            <button class="btn btn-sm" onclick="convertEmailToTicket('${_esc(email.id)}','truid','medium')">→ Ticket</button>
            <button class="icon-btn" onclick="dismissEmail('${_esc(email.id)}')">×</button>
          </div>
        </div>`).join('');
    }

    container.innerHTML = html;
  } catch {
    container.innerHTML = '<p class="empty-state" style="font-size:0.72rem">Could not load Gmail.</p>';
  }
}

function convertEmailToTicket(emailId, lane, priority) {
  const email = (_cachedInboxEmails || []).find(e => e.id === emailId);
  if (!email) return;
  _createTicketEntry(email, lane, priority);
  _markEmailProcessed(emailId);
  showToast('Ticket created ✓', 'gold');
  _cachedInboxEmails = null; // bust cache so dismissed email disappears
  switchWorkTab('tickets');
}

function createAllMatchedTickets() {
  const emails    = _cachedInboxEmails || [];
  const work      = DOS.data.work;
  const rules     = work.emailRules    || [];
  const processed = new Set(work.processedEmailIds || []);
  let count = 0;
  emails.filter(e => !processed.has(e.id)).forEach(email => {
    const rule = _matchEmailRule(email, rules);
    if (!rule) return;
    _createTicketEntry(email, rule.lane, rule.priority);
    _markEmailProcessed(email.id);
    count++;
  });
  showToast(`${count} ticket${count !== 1 ? 's' : ''} created ✓`, 'gold');
  _cachedInboxEmails = null;
  switchWorkTab('tickets');
}

function dismissEmail(emailId) {
  _markEmailProcessed(emailId);
  if (_cachedInboxEmails) _cachedInboxEmails = _cachedInboxEmails.filter(e => e.id !== emailId);
  loadGmailAlertsInTickets();
}

function _escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _esc(str) {
  return (str || '').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}

// ── Email Rules UI ─────────────────────────────────────────────────────────────

function buildEmailRulesHTML() {
  const rules = DOS.data.work.emailRules || [];
  return `
    <div id="email-rules-panel" class="${_emailRulesOpen ? 'email-rules-panel' : 'hidden'}">
      ${rules.length ? rules.map(r => `
        <div class="email-rule-row">
          <span class="email-rule-dot ${r.enabled ? 'on' : 'off'}"
                onclick="toggleEmailRule('${r.id}')"
                title="${r.enabled ? 'Enabled' : 'Disabled'}"></span>
          <div class="email-rule-name">${_escHtml(r.name)}</div>
          <div class="email-rule-meta">${r.type}:${r.value} → ${r.lane} · ${r.priority}</div>
          <button class="icon-btn" onclick="deleteEmailRule('${r.id}')">×</button>
        </div>`).join('') : '<p class="empty-state" style="font-size:0.72rem">No rules yet.</p>'}
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
        <div class="input-row" style="margin:0">
          <select id="rule-type"  class="input-field" style="margin:0;width:90px">
            <option value="domain">Domain</option>
            <option value="subject">Subject</option>
            <option value="sender">Sender</option>
          </select>
          <input id="rule-value" type="text" placeholder="e.g. truid.co" class="input-field" style="margin:0"/>
        </div>
        <div class="input-row" style="margin:0">
          <input id="rule-name" type="text" placeholder="Rule name" class="input-field" style="margin:0"/>
          <select id="rule-lane" class="input-field" style="margin:0;width:90px">
            <option value="truid">truID</option>
            <option value="personal">Personal</option>
          </select>
          <select id="rule-priority" class="input-field" style="margin:0;width:80px">
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </div>
        <button class="btn btn-primary w-full" onclick="addEmailRule()">+ Add Rule</button>
      </div>
    </div>`;
}

function toggleEmailRulesPanel() {
  _emailRulesOpen = !_emailRulesOpen;
  switchWorkTab('tickets');
}

function addEmailRule() {
  const type     = document.getElementById('rule-type')?.value    || 'domain';
  const value    = document.getElementById('rule-value')?.value.trim();
  const name     = document.getElementById('rule-name')?.value.trim() || value;
  const lane     = document.getElementById('rule-lane')?.value    || 'truid';
  const priority = document.getElementById('rule-priority')?.value || 'medium';
  if (!value) { showToast('Enter a rule value.', 'error'); return; }
  if (!DOS.data.work.emailRules) DOS.data.work.emailRules = [];
  DOS.data.work.emailRules.push({ id: `er-${Date.now()}`, name, type, value, lane, priority, enabled: true });
  DOS.save('work');
  _emailRulesOpen = true;
  _cachedInboxEmails = null;
  switchWorkTab('tickets');
}

function toggleEmailRule(id) {
  const rule = (DOS.data.work.emailRules || []).find(r => r.id === id);
  if (!rule) return;
  rule.enabled = !rule.enabled;
  DOS.save('work');
  _emailRulesOpen = true;
  _cachedInboxEmails = null;
  switchWorkTab('tickets');
}

function deleteEmailRule(id) {
  dosConfirm('Delete this rule?', () => {
    DOS.data.work.emailRules = (DOS.data.work.emailRules || []).filter(r => r.id !== id);
    DOS.save('work');
    _emailRulesOpen = true;
    switchWorkTab('tickets');
  });
}

// ── Tickets Tab ────────────────────────────────────────────────────────────────

const PRIORITY_COLORS = { high: 'var(--negative)', medium: 'var(--gold)', low: 'var(--text-dim)' };
const STATUS_COLORS   = { open: 'orange', 'in-progress': 'blue', blocked: 'red', closed: 'dim' };

function buildTicketsHTML() {
  const tickets  = DOS.data.work.tickets;
  const open     = tickets.filter(t => t.status !== 'closed');
  const closed   = tickets.filter(t => t.status === 'closed').slice(-5).reverse();
  const connected = typeof isGoogleConnected === 'function' && isGoogleConnected();

  const LANES = ['truid', 'personal'];

  return `
    <section class="card">
      <div class="card-header"><h2>Add Ticket</h2></div>
      <div class="workout-log-form">
        <input id="tkt-title" type="text" placeholder="Task or ticket title" class="input-field"/>
        <div class="input-row">
          <select id="tkt-lane" class="input-field">
            <option value="truid">truID</option>
            <option value="personal">Personal</option>
          </select>
          <select id="tkt-priority" class="input-field">
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </div>
        <button class="btn btn-primary w-full" onclick="addTicket()">Add Ticket +XP</button>
      </div>
    </section>

    ${connected ? `
    <section class="card">
      <div class="card-header">
        <h2>Email Alerts</h2>
        <button class="btn btn-sm" onclick="toggleEmailRulesPanel()">⚙ Rules</button>
      </div>
      ${buildEmailRulesHTML()}
      <div id="gmail-alerts-container">
        <div class="cal-loading" style="padding:8px 0">
          <div class="ai-spinner-dot"></div><div class="ai-spinner-dot"></div><div class="ai-spinner-dot"></div>
          <span class="sub-text">Loading inbox...</span>
        </div>
      </div>
    </section>` : ''}

    ${LANES.map(lane => {
      const laneTkts = open.filter(t => (t.lane || 'truid') === lane);
      if (!laneTkts.length) return '';
      return `
        <section class="card">
          <div class="card-header">
            <h2>${lane === 'truid' ? '🏢 truID' : '⚡ Personal'}</h2>
            <span class="sub-text">${laneTkts.length} open</span>
          </div>
          ${laneTkts.map(t => ticketHTML(t)).join('')}
        </section>`;
    }).join('')}

    ${!open.length ? '<p class="empty-state" style="padding:16px">No open tickets. Clean slate.</p>' : ''}

    ${closed.length ? `
    <section class="card">
      <div class="card-header"><h2>Recently Closed</h2></div>
      ${closed.map(t => ticketHTML(t)).join('')}
    </section>` : ''}`;
}

function ticketHTML(t) {
  const isClosed   = t.status === 'closed';
  const prioColor  = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium;
  const statusDot  = STATUS_COLORS[t.status] || 'dim';

  return `
    <div class="list-item" style="${isClosed ? 'opacity:0.5' : ''}">
      <span class="status-dot ${statusDot}"></span>
      <div class="list-item-grow">
        <div class="list-item-title">${t.title}</div>
        <div class="list-item-sub">
          <span style="color:${prioColor}">${capitalize(t.priority || 'medium')}</span>
          · ${capitalize(t.status)}
          ${t.completedAt ? ' · Done ' + formatDate(t.completedAt) : ''}
        </div>
      </div>
      ${!isClosed ? `
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm" onclick="cycleTicketStatus('${t.id}')">→</button>
          <button class="btn btn-sm" style="color:var(--text-dim)" onclick="closeTicket('${t.id}')">✓</button>
        </div>` : ''}
    </div>`;
}

function addTicket() {
  const title    = document.getElementById('tkt-title')?.value.trim();
  const lane     = document.getElementById('tkt-lane')?.value || 'truid';
  const priority = document.getElementById('tkt-priority')?.value || 'medium';
  if (!title) { showToast('Ticket title required.', 'error'); return; }

  const iso = new Date().toISOString();
  DOS.data.work.tickets.push({
    id: `tkt-${Date.now()}`,
    title, lane, priority,
    status: 'open',
    notes: '',
    deadline: null,
    createdAt: iso,
    updatedAt: iso,
    completedAt: null,
    xpEarned: 0
  });
  DOS.save('work');
  awardXP('work', 5, `Ticket created: ${title}`);
  showToast(`Ticket added +5 Work XP`, 'info');
  switchWorkTab('tickets');
}

function cycleTicketStatus(id) {
  const t = DOS.data.work.tickets.find(t => t.id === id);
  if (!t) return;
  const cycle = { open: 'in-progress', 'in-progress': 'blocked', blocked: 'open' };
  t.status    = cycle[t.status] || 'open';
  t.updatedAt = new Date().toISOString();
  DOS.save('work');
  switchWorkTab('tickets');
}

function closeTicket(id) {
  const t = DOS.data.work.tickets.find(t => t.id === id);
  if (!t) return;
  t.status      = 'closed';
  t.updatedAt   = new Date().toISOString();
  t.completedAt = new Date().toISOString();
  t.xpEarned    = 20;
  DOS.save('work');
  awardXP('work', 20, `Ticket closed: ${t.title}`);
  showToast('Ticket closed! +20 Work XP', 'gold');
  switchWorkTab('tickets');
}

// ── Projects Tab ───────────────────────────────────────────────────────────────

function buildProjectsHTML() {
  const projects = DOS.data.work.projects || [];

  return `
    <section class="card">
      <div class="card-header">
        <h2>Projects</h2>
        <span class="card-action" onclick="toggleAddProjectForm()">+ Add</span>
      </div>
      <div id="add-project-form" class="hidden inline-form">
        <input id="proj-name" type="text" placeholder="Project name" class="input-field"/>
        <input id="proj-desc" type="text" placeholder="Short description" class="input-field"/>
        <select id="proj-lane" class="input-field">
          <option value="personal">Personal</option>
          <option value="truid">truID</option>
        </select>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" style="flex:1" onclick="toggleAddProjectForm()">Cancel</button>
          <button class="btn btn-primary" style="flex:1" onclick="addProject()">Add</button>
        </div>
      </div>
      ${projects.length === 0
        ? '<p class="empty-state">No projects yet.</p>'
        : projects.map(p => projectHTML(p)).join('')}
    </section>

    `;
}

function projectHTML(p) {
  const statusColors = { active: 'green', planned: 'dim', paused: 'orange', done: 'gold' };
  return `
    <div style="padding:4px 0">
      <div class="list-item">
        <span class="status-dot ${statusColors[p.status] || 'dim'}"></span>
        <div class="list-item-grow">
          <div class="list-item-title">${p.name}</div>
          <div class="list-item-sub">${p.desc || capitalize(p.lane || 'personal')} · ${(p.timeLogged || 0).toFixed(1)}h logged</div>
        </div>
        <button class="btn btn-sm" onclick="toggleTimeLog('${p.id}')">+ Time</button>
      </div>
      <div id="timelog-${p.id}" class="hidden" style="padding:8px 0 4px;padding-left:20px">
        <div class="input-row">
          <input id="hours-${p.id}" type="number" placeholder="Hours" class="input-field" min="0.1" step="0.5"/>
          <button class="btn btn-primary" onclick="logProjectTime('${p.id}')">Log</button>
          <button class="btn btn-outline" onclick="toggleTimeLog('${p.id}')">✕</button>
        </div>
      </div>
    </div>`;
}

function toggleAddProjectForm() {
  document.getElementById('add-project-form')?.classList.toggle('hidden');
}

function addProject() {
  const name = document.getElementById('proj-name')?.value.trim();
  const desc = document.getElementById('proj-desc')?.value.trim() || '';
  const lane = document.getElementById('proj-lane')?.value || 'personal';
  if (!name) { showToast('Project name required.', 'error'); return; }
  if (!DOS.data.work.projects) DOS.data.work.projects = [];
  DOS.data.work.projects.push({
    id: `proj-${Date.now()}`, name, desc, lane,
    status: 'active', timeLogged: 0,
    createdAt: new Date().toISOString()
  });
  DOS.save('work');
  awardXP('work', 10, `Project created: ${name}`);
  showToast(`${name} added +10 Work XP`, 'gold');
  switchWorkTab('projects');
}

function toggleTimeLog(id) {
  document.getElementById(`timelog-${id}`)?.classList.toggle('hidden');
}

function logProjectTime(id) {
  const project = (DOS.data.work.projects || []).find(p => p.id === id);
  if (!project) return;
  const hours = parseFloat(document.getElementById(`hours-${id}`)?.value);
  if (!hours || isNaN(hours) || hours <= 0) { showToast('Enter valid hours.', 'error'); return; }
  project.timeLogged = (project.timeLogged || 0) + hours;
  DOS.save('work');
  const xp = Math.floor(hours * 15);
  awardXP('work', xp, `${hours}h on ${project.name}`);
  showToast(`${hours}h logged · +${xp} Work XP`, 'gold');
  document.getElementById(`timelog-${id}`)?.classList.add('hidden');
  switchWorkTab('projects');
}

function showCalendarSetup() {
  document.getElementById('calendar-setup-info')?.classList.toggle('hidden');
}

// ── Stats Tab ──────────────────────────────────────────────────────────────────

function buildWorkStatsHTML() {
  const tickets  = DOS.data.work.tickets || [];
  const projects = DOS.data.work.projects || [];
  const closed   = tickets.filter(t => t.status === 'closed').length;
  const open     = tickets.filter(t => t.status !== 'closed').length;
  const totalTime = projects.reduce((s, p) => s + (p.timeLogged || 0), 0);

  return `
    <section class="card">
      <div class="card-header"><h2>Ticket Velocity</h2><span class="sub-text">Closed per week</span></div>
      <div class="chart-wrap" style="height:180px">
        <canvas id="chart-ticket-velocity"></canvas>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Time by Project</h2></div>
      <div class="chart-wrap" style="height:200px">
        <canvas id="chart-project-time"></canvas>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Work Stats</h2></div>
      <div class="balance-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="balance-item">
          <span class="balance-label">Open</span>
          <span class="balance-amount expense">${open}</span>
        </div>
        <div class="balance-item">
          <span class="balance-label">Closed</span>
          <span class="balance-amount income">${closed}</span>
        </div>
        <div class="balance-item">
          <span class="balance-label">Hours Logged</span>
          <span class="balance-amount gold">${totalTime.toFixed(1)}h</span>
        </div>
      </div>
    </section>`;
}

function renderWorkCharts() {
  renderTicketVelocityChart();
  renderProjectTimeChart();
}

function renderTicketVelocityChart() {
  const now   = new Date();
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now - i * 7 * 86400000);
    weeks.push(getISOWeek(d));
  }

  const closedByWeek = {};
  weeks.forEach(w => closedByWeek[w] = 0);

  DOS.data.work.tickets
    .filter(t => t.status === 'closed' && t.completedAt)
    .forEach(t => {
      const wk = getISOWeek(new Date(t.completedAt));
      if (closedByWeek[wk] !== undefined) closedByWeek[wk]++;
    });

  dosChart('chart-ticket-velocity', {
    type: 'bar',
    data: {
      labels: weeks.map(w => `W${w.split('-W')[1]}`),
      datasets: [{
        label: 'Closed',
        data: weeks.map(w => closedByWeek[w]),
        backgroundColor: 'rgba(104,211,145,0.7)',
        borderColor: '#68d391',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: dosScales({ y: { ticks: { stepSize: 1 } } })
    }
  });
}

function renderProjectTimeChart() {
  const projects = (DOS.data.work.projects || []).filter(p => (p.timeLogged || 0) > 0);

  if (!projects.length) {
    const canvas = document.getElementById('chart-project-time');
    if (canvas) canvas.parentElement.innerHTML = '<p class="empty-state">Log time on projects to see breakdown.</p>';
    return;
  }

  const COLORS = ['#63b3ed','#f6ad55','#b794f4','#68d391','#fc8181','#f687b3'];

  dosChart('chart-project-time', {
    type: 'doughnut',
    data: {
      labels: projects.map(p => p.name),
      datasets: [{
        data: projects.map(p => p.timeLogged),
        backgroundColor: COLORS.slice(0, projects.length),
        borderWidth: 2,
        borderColor: '#0e0e1a'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: dosLegend(),
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw}h`
          }
        }
      }
    }
  });
}
