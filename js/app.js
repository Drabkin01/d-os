// ── D-OS Core App ─────────────────────────────────────────────────────────────

const DOS = {
  data: {},

  init() {
    DOS_MIGRATION.run();
    this.loadAll();
    this.bindNav();
    checkDailyStreak();
    renderCharacter();
    renderDashboard();

    // Handle PWA shortcut URLs (?view=health, ?briefing=1)
    const params = new URLSearchParams(window.location.search);
    const targetView = params.get('view');
    if (targetView) this.navigate(targetView);
    if (params.get('briefing') === '1') setTimeout(openAIModal, 400);

    console.log('[D-OS] Initialised — version 0.1');
  },

  loadAll() {
    const keys = ['character', 'health', 'finances', 'intelligence', 'work'];
    keys.forEach(k => {
      const saved = localStorage.getItem(`dos_${k}`);
      this.data[k] = saved ? JSON.parse(saved) : deepClone(DOS_SEEDS[k]);
    });

    // Rehydrate stat levels from XP (in case XP was saved but level wasn't)
    const stats = this.data.character.stats;
    Object.keys(stats).forEach(s => {
      stats[s].level = levelFromXP(stats[s].xp);
    });
    this.data.character.tier = calcTier(stats);
  },

  save(key) {
    localStorage.setItem(`dos_${key}`, JSON.stringify(this.data[key]));
  },

  saveAll() {
    ['character', 'health', 'finances', 'intelligence', 'work'].forEach(k => this.save(k));
  },

  reset() {
    dosConfirm('Reset ALL data? This cannot be undone.', () => {
      localStorage.clear();
      location.reload();
    });
  },

  bindNav() {
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.view));
    });
    this._bindSwipe();
  },

  _bindSwipe() {
    const main = document.querySelector('.app-main');
    if (!main) return;
    let _sx = 0, _sy = 0;
    main.addEventListener('touchstart', e => {
      _sx = e.touches[0].clientX;
      _sy = e.touches[0].clientY;
    }, { passive: true });
    main.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - _sx;
      const dy = e.changedTouches[0].clientY - _sy;
      if (Math.abs(dx) < 52 || Math.abs(dy) > Math.abs(dx) * 0.9) return;
      const views = ['dashboard','health','finances','intelligence','work','profile'];
      const cur   = views.indexOf(DOS._currentView || 'dashboard');
      const next  = dx < 0 ? Math.min(cur + 1, views.length - 1) : Math.max(cur - 1, 0);
      if (next !== cur) DOS.navigate(views[next]);
    }, { passive: true });
  },

  navigate(view) {
    const VIEW_ORDER = ['dashboard','health','finances','intelligence','work','profile'];
    const prevIdx    = VIEW_ORDER.indexOf(DOS._currentView || 'dashboard');
    const nextIdx    = VIEW_ORDER.indexOf(view);
    const dir        = nextIdx >= prevIdx ? 'right' : 'left';
    DOS._currentView = view;

    // Hide all, show target with direction-aware animation
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active','page-enter-right','page-enter-left');
    });
    document.querySelectorAll('[data-view]').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    const target = document.getElementById(`view-${view}`);
    if (target) {
      target.classList.add('active', `page-enter-${dir}`);
    }

    // Slide nav pill to active button
    _updateNavPill(view);

    // Render view-specific content then stagger cards
    switch (view) {
      case 'dashboard':    renderDashboard();    break;
      case 'health':       renderHealth();       break;
      case 'finances':     renderFinances();     break;
      case 'intelligence': renderIntelligence(); break;
      case 'work':         renderWork();         break;
      case 'profile':      renderProfile();      break;
    }
    _staggerCards(view);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
};

// ── Nav pill slider ───────────────────────────────────────────────────────────
function _updateNavPill(view) {
  const pill = document.getElementById('nav-pill');
  const btn  = document.querySelector(`[data-view="${view}"]`);
  const nav  = document.getElementById('bottom-nav');
  if (!pill || !btn || !nav) return;
  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  pill.style.left  = `${btnRect.left - navRect.left}px`;
  pill.style.width = `${btnRect.width}px`;
}

// ── Card stagger ──────────────────────────────────────────────────────────────
function _staggerCards(view) {
  const el = document.getElementById(`view-${view}`);
  if (!el) return;
  requestAnimationFrame(() => {
    el.querySelectorAll('.card').forEach((card, i) => {
      card.classList.add('card-stagger');
      card.style.setProperty('--stagger-i', i);
    });
  });
}

// ── Scroll-aware header ───────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.querySelector('.app-header')
    ?.classList.toggle('scrolled', window.scrollY > 8);
}, { passive: true });

// ── Utilities ─────────────────────────────────────────────────────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function formatZAR(amount) {
  return `R${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function showToast(msg, type = 'info') {
  // Route gold/level-up toasts through KAI speech bubble
  if ((type === 'gold' || type === 'success') && typeof kaiSpeechBubble === 'function') {
    kaiSpeechBubble(msg, 3200);
  }

  // Also show standard toast for non-KAI contexts
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ── OLED Mode ─────────────────────────────────────────────────────────────────
function toggleOLED() {
  const on = document.documentElement.classList.toggle('oled-mode');
  localStorage.setItem('dos_oled_mode', on ? '1' : '0');
  const btn = document.getElementById('oled-btn');
  if (btn) btn.style.color = on ? 'var(--gold)' : '';
  showToast(on ? 'OLED black on' : 'OLED black off', 'info');
}

// ── Quick Log ─────────────────────────────────────────────────────────────────
function openQuickLog() {
  const body = document.getElementById('quick-log-body');
  if (!body) return;
  const ACTIONS = [
    { icon: '💪', label: 'Workout done',    stat: 'health',       xp: 25 },
    { icon: '📚', label: 'Study session',   stat: 'intelligence', xp: 15 },
    { icon: '⚙️', label: 'Task completed', stat: 'work',         xp: 20 },
    { icon: '💰', label: 'Log expense',     stat: 'finances',     xp: 0,  nav: 'finances' },
    { icon: '🥋', label: 'BJJ / Martial',  stat: 'health',       xp: 30 },
    { icon: '📝', label: 'Add a note',      stat: 'intelligence', xp: 10 },
  ];
  body.innerHTML = `
    <div style="padding:0 0 8px">
      <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:12px">What did you do right now?</div>
      <div class="quick-log-grid">
        ${ACTIONS.map((a, i) => `
          <button class="quick-log-btn" onclick="_quickLogAction(${i})">
            <span class="quick-log-btn-icon">${a.icon}</span>
            <span class="quick-log-btn-label">${a.label}</span>
            <span class="quick-log-btn-xp">${a.xp > 0 ? `+${a.xp} ${a.stat} XP` : 'Go to ' + a.stat}</span>
            <div class="quick-log-stat-bar" style="background:var(--${a.stat})"></div>
          </button>`).join('')}
      </div>
    </div>`;
  document.getElementById('quick-log-modal')?.classList.add('open');
  window._qlActions = ACTIONS;
}

function _quickLogAction(i) {
  const a = window._qlActions?.[i];
  if (!a) return;
  closeQuickLog();
  if (a.nav) { DOS.navigate(a.nav); return; }
  awardXP(a.stat, a.xp, a.label);
  showToast(`${a.icon} ${a.label} — +${a.xp} XP`, 'gold');
}

function closeQuickLog() {
  document.getElementById('quick-log-modal')?.classList.remove('open');
}

// ── DOS Dialog Helpers ────────────────────────────────────────────────────────

let _dosPromptCb = null;

function dosPrompt(title, placeholder, defaultVal, onConfirm, type = 'text') {
  _dosPromptCb = onConfirm;
  const modal   = document.getElementById('dos-prompt-modal');
  const heading = document.getElementById('dos-prompt-heading');
  const input   = document.getElementById('dos-prompt-input');
  if (!modal) { onConfirm(window.prompt(title, defaultVal ?? '')); return; }
  heading.textContent = title;
  input.type          = type;
  input.value         = defaultVal ?? '';
  input.placeholder   = placeholder ?? '';
  modal.classList.add('open');
  requestAnimationFrame(() => input.focus());
  input.onkeydown = e => { if (e.key === 'Enter') confirmDosPrompt(); };
}

function confirmDosPrompt() {
  const val = document.getElementById('dos-prompt-input')?.value ?? '';
  document.getElementById('dos-prompt-modal')?.classList.remove('open');
  if (_dosPromptCb) { const cb = _dosPromptCb; _dosPromptCb = null; cb(val.trim()); }
}

function cancelDosPrompt() {
  document.getElementById('dos-prompt-modal')?.classList.remove('open');
  _dosPromptCb = null;
}

let _dosConfirmCb = null;

function dosConfirm(text, onConfirm, danger = true) {
  _dosConfirmCb = onConfirm;
  const modal  = document.getElementById('dos-confirm-modal');
  const textEl = document.getElementById('dos-confirm-text');
  const btn    = document.getElementById('dos-confirm-btn');
  if (!modal) { if (window.confirm(text)) onConfirm(); return; }
  textEl.textContent = text;
  if (btn) btn.className = `btn w-full ${danger ? 'btn-danger' : 'btn-primary'}`;
  modal.classList.add('open');
}

function confirmDosConfirm() {
  document.getElementById('dos-confirm-modal')?.classList.remove('open');
  if (_dosConfirmCb) { const cb = _dosConfirmCb; _dosConfirmCb = null; cb(); }
}

function cancelDosConfirm() {
  document.getElementById('dos-confirm-modal')?.classList.remove('open');
  _dosConfirmCb = null;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Dashboard Render ──────────────────────────────────────────────────────────

function renderDashboard() {
  renderCharacter();
  if (typeof renderKaiDashboardCard === 'function') renderKaiDashboardCard();
  renderMonthSummary();
  renderRussiaGoalCard();
  if (typeof renderFocusFromStorage === 'function') renderFocusFromStorage();
  renderTodaysCalendarEvents();
}

async function renderTodaysCalendarEvents() {
  const el = document.getElementById('dashboard-calendar');
  if (!el) return;
  if (typeof isGoogleConnected !== 'function' || !isGoogleConnected()) { el.innerHTML = ''; return; }

  const STAT_COLOR = {
    health: 'var(--health)', intelligence: 'var(--intelligence)',
    finances: 'var(--finances)', work: 'var(--work)'
  };

  try {
    const events   = await fetchCalendarEvents(1);
    const todayStr = new Date().toISOString().split('T')[0];
    const todays   = events.filter(ev => (ev.start || '').startsWith(todayStr));
    if (!todays.length) { el.innerHTML = ''; return; }

    el.innerHTML = `
      <div class="dash-cal-card">
        <div class="dash-cal-header">
          <span class="dash-cal-title">Today's Schedule</span>
          <button class="btn btn-sm" onclick="DOS.navigate('work');setTimeout(()=>switchWorkTab('calendar'),80)">See all →</button>
        </div>
        ${todays.map(ev => {
          const color = STAT_COLOR[ev.stat] || 'var(--border)';
          const time  = ev.allDay ? 'All day'
            : new Date(ev.start).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
          return `
            <div class="dash-cal-event">
              <span class="dash-cal-dot" style="background:${color}"></span>
              <span class="dash-cal-time">${time}</span>
              <span class="dash-cal-name">${ev.title}</span>
            </div>`;
        }).join('')}
      </div>`;
  } catch { el.innerHTML = ''; }
}

function renderRussiaGoalCard() {
  const el = document.getElementById('russia-goal-card');
  if (!el) return;

  const daysLeft = Math.ceil((new Date('2027-10-01') - new Date()) / 86400000);

  const fin         = DOS.data.finances;
  const russiaGoal  = (fin.savingsGoals || []).find(g => g.id === 'sg-russia');
  const savedAmt    = russiaGoal?.current || 0;
  const targetAmt   = russiaGoal?.target  || 73000;
  const savingsPct  = Math.min((savedAmt / targetAmt) * 100, 100);

  const russian     = DOS.data.intelligence?.russian || {};
  const streak      = russian.streakDays || 0;
  const streakPct   = Math.min((streak / 30) * 100, 100); // 30-day ring target

  const C           = 2 * Math.PI * 22; // circumference for r=22
  const savingsOff  = (C * (1 - savingsPct  / 100)).toFixed(1);
  const streakOff   = (C * (1 - streakPct   / 100)).toFixed(1);
  const Cf          = C.toFixed(1);

  const isClose = savingsPct >= 80;
  el.innerHTML = `
    <section class="card russia-goal-card${isClose ? ' goal-proximity-hot' : ''}">
      ${isClose ? `<div class="goal-proximity-badge">🎯 Almost there!</div>` : ''}
      <div class="russia-goal-header">
        <div>
          <div class="russia-goal-title">🇷🇺 Russia 2027</div>
          <div class="sub-text">Dagestan · Oct 1, 2027</div>
        </div>
        <div class="russia-countdown">
          <span class="russia-days-num">${daysLeft}</span>
          <span class="russia-days-label">days</span>
        </div>
      </div>
      <div class="russia-rings-row">
        <div class="russia-ring-item">
          <svg class="russia-ring-svg" viewBox="0 0 54 54">
            <circle cx="27" cy="27" r="22" class="ring-bg"/>
            <circle cx="27" cy="27" r="22"
                    stroke="#63b3ed" stroke-width="4" fill="none"
                    stroke-dasharray="${Cf}" stroke-dashoffset="${savingsOff}"
                    transform="rotate(-90 27 27)" stroke-linecap="round"/>
          </svg>
          <div class="russia-ring-label">
            <div class="russia-ring-val">${Math.round(savingsPct)}%</div>
            <div class="russia-ring-sub">Savings<br/>${formatZAR(savedAmt)}</div>
          </div>
        </div>
        <div class="russia-ring-item">
          <svg class="russia-ring-svg" viewBox="0 0 54 54">
            <circle cx="27" cy="27" r="22" class="ring-bg"/>
            <circle cx="27" cy="27" r="22"
                    stroke="#fc8181" stroke-width="4" fill="none"
                    stroke-dasharray="${Cf}" stroke-dashoffset="${streakOff}"
                    transform="rotate(-90 27 27)" stroke-linecap="round"/>
          </svg>
          <div class="russia-ring-label">
            <div class="russia-ring-val">${streak}d</div>
            <div class="russia-ring-sub">Russian<br/>streak</div>
          </div>
        </div>
        <div class="russia-quick-actions">
          <button class="btn btn-outline btn-sm" onclick="DOS.navigate('intelligence');setTimeout(()=>switchIntelTab('languages'),80)">
            📚 Russian
          </button>
          <button class="btn btn-outline btn-sm" onclick="DOS.navigate('finances');setTimeout(()=>switchFinTab('goals'),80)">
            💰 Savings
          </button>
        </div>
      </div>
    </section>`
}

function renderMonthSummary() {
  const fin = DOS.data.finances;
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

  const monthlyExpenses = fin.expenses
    .filter(e => e.date >= monthStart)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalIncome = fin.income.reduce((sum, i) => sum + i.amount, 0);
  const balance = totalIncome - monthlyExpenses;

  const el = document.getElementById('dash-balance');
  if (el) {
    el.textContent = formatZAR(balance);
    el.className = `dash-balance ${balance >= 0 ? 'positive' : 'negative'}`;
  }

  const spentEl = document.getElementById('dash-spent');
  if (spentEl) spentEl.textContent = formatZAR(monthlyExpenses);

  const incomeEl = document.getElementById('dash-income');
  if (incomeEl) incomeEl.textContent = formatZAR(totalIncome);

  // Workouts this week
  const weekStart = getWeekStart();
  const weekWorkouts = DOS.data.health.workouts.filter(w => w.date >= weekStart).length;
  const wEl = document.getElementById('dash-workouts');
  if (wEl) wEl.textContent = weekWorkouts;
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil((((d - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
}

// ── renderHealth / renderFinances / renderIntelligence / renderWork live in their module files ──


function renderProfile() {
  const container = document.getElementById('profile-content');
  if (!container) return;
  const char = DOS.data.character;
  const stats = char.stats;

  const totalXP = Object.values(stats).reduce((s, st) => s + st.xp, 0);
  const avgLevel = Math.floor(Object.values(stats).reduce((s, st) => s + st.level, 0) / 4);

  // KAI customisation card sits above profile content
  const kaiCardHTML = typeof buildKaiProfileCard === 'function' ? buildKaiProfileCard() : '';

  container.innerHTML = kaiCardHTML + `
    <section class="card profile-hero">
      <div class="profile-title">
        <div class="profile-name">${char.name}</div>
        <div class="profile-archetype">${char.archetype}</div>
        <div class="profile-tier-badge tier-${char.tier}">${TIER_NAMES[char.tier]}</div>
      </div>
      <div class="profile-xp-block">
        <span class="big-number">Lv. ${avgLevel}</span>
        <span class="sub-text">Overall Level</span>
        <span class="xp-total">${totalXP.toLocaleString()} Total XP</span>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Stat Breakdown</h2></div>
      <div class="stat-breakdown">
        ${Object.entries(stats).map(([key, s]) => `
          <div class="stat-row">
            <span class="stat-label ${key}">${capitalize(key)}</span>
            <div class="stat-xp-bar-wrap">
              <div class="stat-xp-bar ${key}" style="width:${xpProgressPct(s)}%"></div>
            </div>
            <span class="stat-level-badge">Lv.${s.level}</span>
            <span class="sub-text">${s.xp} XP</span>
          </div>`).join('')}
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Tier Progress</h2></div>
      <div class="tier-roadmap">
        ${TIER_NAMES.map((name, i) => `
          <div class="tier-row ${i <= char.tier ? 'achieved' : 'locked'}">
            <span class="tier-indicator">${i <= char.tier ? '◆' : '◇'}</span>
            <div>
              <div class="tier-row-name">Tier ${i}: ${name}</div>
              <div class="sub-text">${TIER_UNLOCKS[i]}</div>
            </div>
          </div>`).join('')}
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <h2>Character</h2>
        <span class="card-action" onclick="toggleProfileEdit()">Edit</span>
      </div>
      <div id="profile-edit-form" class="hidden" style="display:flex;flex-direction:column;gap:8px">
        <input id="edit-char-name"      type="text" class="input-field" placeholder="Name"      value="${char.name}"/>
        <input id="edit-char-archetype" type="text" class="input-field" placeholder="Archetype" value="${char.archetype}"/>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" style="flex:1" onclick="toggleProfileEdit()">Cancel</button>
          <button class="btn btn-primary" style="flex:1" onclick="saveProfileEdit()">Save</button>
        </div>
      </div>
      <div id="profile-view-mode">
        <div style="font-size:0.85rem;color:var(--text-sub)">${char.archetype}</div>
        <div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px">🔥 ${char.dailyStreak?.count || 0} day streak · ${char.xpHistory?.length || 0} XP events logged</div>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Recent XP</h2></div>
      ${(char.xpHistory || []).slice().reverse().slice(0, 8).map(e => `
        <div class="list-item">
          <span class="list-item-icon" style="font-size:0.85rem">${{health:'❤️',finances:'💰',intelligence:'🧠',work:'⚙️'}[e.stat]||'⚡'}</span>
          <div class="list-item-grow">
            <div class="list-item-title" style="font-size:0.82rem">${e.reason || capitalize(e.stat)}</div>
            <div class="list-item-sub">${formatDate(e.date)}</div>
          </div>
          <span style="font-size:0.82rem;font-weight:700;color:var(--gold)">+${e.amount}</span>
        </div>`).join('') || '<p class="empty-state">No XP earned yet.</p>'}
    </section>

    <section class="card danger-zone">
      <div class="card-header"><h2>Data</h2></div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline w-full" onclick="exportData()">⬇ Export</button>
          <button class="btn btn-outline w-full" onclick="importData()">⬆ Import</button>
        </div>
        <div class="sub-text" style="font-size:0.72rem;color:var(--text-dim)">
          Export saves a full JSON backup. Import restores it. Use before clearing browser storage or switching devices.
        </div>
        <button class="btn btn-danger" onclick="DOS.reset()">Reset All Data</button>
      </div>
    </section>`;

  // Boot Rive on the profile canvas if kai.riv is present
  if (typeof kaiProfileMounted === 'function') kaiProfileMounted();
}

function xpProgressPct(stat) {
  const prev = totalXpForLevel(stat.level);
  const next = totalXpForLevel(stat.level + 1);
  if (next === Infinity || next === prev) return 100;
  return Math.min(((stat.xp - prev) / (next - prev)) * 100, 100);
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// ── Data Export / Import ──────────────────────────────────────────────────────

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
    character:    DOS.data.character,
    health:       DOS.data.health,
    finances:     DOS.data.finances,
    intelligence: DOS.data.intelligence,
    work:         DOS.data.work
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `dos-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup exported ✓', 'gold');
}

function importData() {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        // Basic validation
        const keys = ['character','health','finances','intelligence','work'];
        const valid = keys.some(k => data[k]);
        if (!valid) { showToast('Invalid backup file.', 'error'); return; }
        const dateLabel = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('en-ZA') : 'unknown date';
        dosConfirm(`Import backup from ${dateLabel}? This will replace ALL current data.`, () => {
          keys.forEach(k => { if (data[k]) localStorage.setItem(`dos_${k}`, JSON.stringify(data[k])); });
          showToast('Backup imported. Reloading...', 'gold');
          setTimeout(() => location.reload(), 1200);
        }, true);
      } catch {
        showToast('Could not parse backup file.', 'error');
      }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

// ── Profile Editing ───────────────────────────────────────────────────────────

function toggleProfileEdit() {
  const form = document.getElementById('profile-edit-form');
  const view = document.getElementById('profile-view-mode');
  if (!form) return;
  const isHidden = form.classList.contains('hidden');
  form.classList.toggle('hidden', !isHidden);
  if (view) view.classList.toggle('hidden', isHidden);
}

function saveProfileEdit() {
  const name      = document.getElementById('edit-char-name')?.value.trim();
  const archetype = document.getElementById('edit-char-archetype')?.value.trim();
  if (!name) { showToast('Name cannot be empty.', 'error'); return; }
  DOS.data.character.name      = name;
  DOS.data.character.archetype = archetype || DOS.data.character.archetype;
  DOS.save('character');
  renderCharacter();
  renderProfile();
  showToast('Profile updated.', 'gold');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  DOS.init();
  // Position nav pill on first load (needs layout to settle)
  setTimeout(() => _updateNavPill('dashboard'), 80);
});
