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

// ── Stub renders for other views (expanded in phase 2+) ──────────────────────

function renderHealth() {
  const container = document.getElementById('health-content');
  if (!container) return;
  const h = DOS.data.health;
  const workouts = h.workouts.slice(-5).reverse();

  container.innerHTML = `
    <section class="card">
      <div class="card-header">
        <h2>Log Workout</h2>
      </div>
      <div class="workout-log-form">
        <select id="wkt-type" class="input-field">
          <option value="crossfit">CrossFit</option>
          <option value="bjj">BJJ</option>
          <option value="muay-thai">Muay Thai</option>
          <option value="other">Other</option>
        </select>
        <input id="wkt-notes" type="text" placeholder="Notes (movements, rounds, PR...)" class="input-field"/>
        <input id="wkt-duration" type="number" placeholder="Duration (mins)" class="input-field" min="1"/>
        <button class="btn btn-primary" onclick="logWorkout()">Log Session +XP</button>
      </div>
    </section>
    <section class="card">
      <div class="card-header"><h2>Recent Sessions</h2></div>
      ${workouts.length === 0 ? '<p class="empty-state">No workouts logged yet. Get after it.</p>' :
        workouts.map(w => `
          <div class="list-item">
            <span class="list-item-icon">${workoutIcon(w.type)}</span>
            <div>
              <div class="list-item-title">${capitalize(w.type)}</div>
              <div class="list-item-sub">${formatDate(w.date)} · ${w.duration || '?'} min${w.notes ? ' · ' + w.notes : ''}</div>
            </div>
          </div>`).join('')}
    </section>
    <section class="card">
      <div class="card-header">
        <h2>Weight</h2>
        <span class="card-action" onclick="showWeightModal()">+ Log</span>
      </div>
      ${weightTrendHTML()}
    </section>`;
}

function workoutIcon(type) {
  const icons = { crossfit: '🏋️', bjj: '🥋', 'muay-thai': '🥊', other: '💪' };
  return icons[type] || '💪';
}

function logWorkout() {
  const type = document.getElementById('wkt-type').value;
  const notes = document.getElementById('wkt-notes').value;
  const duration = parseInt(document.getElementById('wkt-duration').value) || 0;

  if (!type) return;

  const entry = { id: Date.now(), type, notes, duration, date: today() };
  DOS.data.health.workouts.push(entry);
  DOS.save('health');

  const { levelled, newLevel } = awardXP('health', 25);
  showToast(`${capitalize(type)} logged! +25 Health XP`, 'gold');
  renderHealth();
}

function weightTrendHTML() {
  const entries = DOS.data.health.weight.slice(-7);
  if (!entries.length) return '<p class="empty-state">No weight entries yet.</p>';
  const latest = entries[entries.length - 1];
  return `<div class="weight-latest"><span class="big-number">${latest.kg}kg</span><span class="sub-text">${formatDate(latest.date)}</span></div>`;
}

function renderFinances() {
  const container = document.getElementById('finances-content');
  if (!container) return;
  const fin = DOS.data.finances;
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const totalIncome = fin.income.reduce((s, i) => s + i.amount, 0);
  const monthExpenses = fin.expenses.filter(e => e.date >= monthStart);
  const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalSpent;

  const categories = {};
  monthExpenses.forEach(e => {
    categories[e.category] = (categories[e.category] || 0) + e.amount;
  });

  container.innerHTML = `
    <section class="card balance-card">
      <div class="balance-grid">
        <div class="balance-item">
          <span class="balance-label">Monthly Income</span>
          <span class="balance-amount income">${formatZAR(totalIncome)}</span>
        </div>
        <div class="balance-item">
          <span class="balance-label">Spent This Month</span>
          <span class="balance-amount expense">${formatZAR(totalSpent)}</span>
        </div>
        <div class="balance-item span-2">
          <span class="balance-label">Remaining</span>
          <span class="balance-amount ${balance >= 0 ? 'income' : 'negative'} large">${formatZAR(balance)}</span>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Log Expense</h2></div>
      <div class="expense-form">
        <input id="exp-desc" type="text" placeholder="Description" class="input-field"/>
        <input id="exp-amount" type="number" placeholder="Amount (R)" class="input-field" min="0" step="0.01"/>
        <select id="exp-cat" class="input-field">
          <option value="food">Food</option>
          <option value="transport">Transport</option>
          <option value="subscriptions">Subscriptions</option>
          <option value="health">Health/Gym</option>
          <option value="entertainment">Entertainment</option>
          <option value="clothing">Clothing</option>
          <option value="savings">Savings</option>
          <option value="other">Other</option>
        </select>
        <button class="btn btn-primary" onclick="logExpense()">Add Expense</button>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Recent Expenses</h2></div>
      ${monthExpenses.length === 0 ? '<p class="empty-state">No expenses logged this month.</p>' :
        [...monthExpenses].reverse().slice(0, 10).map(e => `
          <div class="list-item">
            <span class="expense-cat-dot cat-${e.category}"></span>
            <div class="list-item-grow">
              <div class="list-item-title">${e.description}</div>
              <div class="list-item-sub">${capitalize(e.category)} · ${formatDate(e.date)}</div>
            </div>
            <span class="expense-amount">${formatZAR(e.amount)}</span>
          </div>`).join('')}
    </section>

    <section class="card">
      <div class="card-header"><h2>Emergency Fund</h2></div>
      ${emergencyFundHTML(fin.emergencyFund)}
    </section>

    <section class="card">
      <div class="card-header"><h2>Save Up For</h2></div>
      ${fin.savingsGoals.map(g => savingsGoalHTML(g)).join('')}
      <button class="btn btn-outline mt-8" onclick="addSavingsGoal()">+ Add Goal</button>
    </section>`;
}

function logExpense() {
  const desc = document.getElementById('exp-desc').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const category = document.getElementById('exp-cat').value;
  if (!desc || !amount) { showToast('Fill in description and amount.', 'error'); return; }

  DOS.data.finances.expenses.push({ id: Date.now(), description: desc, amount, category, date: today() });
  DOS.save('finances');
  showToast(`Expense logged: ${formatZAR(amount)}`, 'info');
  renderFinances();
}

function emergencyFundHTML(fund) {
  const pct = Math.min((fund.current / fund.target) * 100, 100);
  return `
    <div class="progress-block">
      <div class="progress-labels">
        <span>${formatZAR(fund.current)}</span>
        <span class="sub-text">Target: ${formatZAR(fund.target)}</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill gold" style="width:${pct}%"></div>
      </div>
      <div class="sub-text mt-4">${pct.toFixed(1)}% complete</div>
    </div>
    <button class="btn btn-outline mt-8" onclick="addToEmergencyFund()">+ Add Funds</button>`;
}

function addToEmergencyFund() {
  dosPrompt('Add to Emergency Fund', 'Amount (R)', '', val => {
    const amt = parseFloat(val);
    if (!amt || isNaN(amt) || amt <= 0) { showToast('Enter a valid amount.', 'error'); return; }
    DOS.data.finances.emergencyFund.current += amt;
    DOS.save('finances');
    awardXP('finances', 10);
    showToast(`Emergency fund updated +${formatZAR(amt)}`, 'gold');
    renderFinances();
  }, 'number');
}

function savingsGoalHTML(g) {
  const pct = Math.min((g.current / g.target) * 100, 100);
  return `
    <div class="savings-goal">
      <div class="savings-goal-header">
        <span>${g.emoji} ${g.name}</span>
        <span class="sub-text">${formatZAR(g.current)} / ${formatZAR(g.target)}</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill green" style="width:${pct}%"></div>
      </div>
    </div>`;
}

function addSavingsGoal() {
  const name = prompt('Goal name:');
  if (!name) return;
  const target = parseFloat(prompt('Target amount (R):'));
  if (!target || isNaN(target)) return;
  const emoji = prompt('Emoji (optional):', '🎯') || '🎯';
  DOS.data.finances.savingsGoals.push({ id: Date.now(), name, target, current: 0, emoji });
  DOS.save('finances');
  renderFinances();
}

function renderIntelligence() {
  const container = document.getElementById('intelligence-content');
  if (!container) return;
  const intel = DOS.data.intelligence;

  container.innerHTML = `
    <section class="card">
      <div class="card-header"><h2>AWS Certification Path</h2></div>
      <div class="cert-path">
        ${certPathHTML(intel.study)}
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Books</h2>
        <span class="card-action" onclick="addBook()">+ Add</span>
      </div>
      ${intel.books.length === 0 ? '<p class="empty-state">No books added yet.</p>' :
        intel.books.map(b => bookHTML(b)).join('')}
    </section>

    <section class="card">
      <div class="card-header"><h2>Quick Note</h2></div>
      <div class="note-form">
        <input id="note-topic" type="text" placeholder="Topic (e.g. AWS, Cybersecurity, BJJ)" class="input-field"/>
        <textarea id="note-body" placeholder="What did you learn?" class="input-field textarea" rows="3"></textarea>
        <button class="btn btn-primary" onclick="addNote()">Capture +XP</button>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Recent Notes</h2></div>
      ${intel.notes.length === 0 ? '<p class="empty-state">Start capturing knowledge.</p>' :
        intel.notes.slice(-5).reverse().map(n => `
          <div class="list-item column">
            <div class="list-item-header">
              <span class="tag">${n.topic}</span>
              <span class="sub-text">${formatDate(n.date)}</span>
            </div>
            <p class="note-body-text">${n.body}</p>
          </div>`).join('')}
    </section>`;
}

const CERT_PATH = [
  { id: 'ccp',  name: 'Cloud Practitioner',      level: 'Foundational' },
  { id: 'saa',  name: 'Solutions Architect',      level: 'Associate' },
  { id: 'sec',  name: 'Security Specialty',       level: 'Specialty' },
  { id: 'ml',   name: 'Machine Learning Specialty', level: 'Specialty' }
];

function certPathHTML(study) {
  return `
    <div class="cert-track">
      ${CERT_PATH.map((c, i) => {
        const done = study.completed.includes(c.id);
        const active = study.currentCert === c.name && !done;
        return `
          <div class="cert-node ${done ? 'done' : active ? 'active' : 'locked'}">
            <div class="cert-dot">${done ? '✓' : i + 1}</div>
            <div class="cert-info">
              <div class="cert-name">${c.name}</div>
              <div class="sub-text">${c.level}</div>
              ${active ? `<div class="progress-bar-track mt-4"><div class="progress-bar-fill blue" style="width:${study.certProgress}%"></div></div>
              <div class="sub-text mt-2">${study.certProgress}%</div>` : ''}
            </div>
            ${active ? `<button class="btn btn-sm" onclick="updateCertProgress()">Update</button>` : ''}
          </div>`;
      }).join('<div class="cert-connector"></div>')}
    </div>`;
}

function updateCertProgress() {
  const val = parseInt(prompt('Current progress % (0-100):'));
  if (isNaN(val)) return;
  DOS.data.intelligence.study.certProgress = Math.max(0, Math.min(100, val));
  if (val >= 100) {
    const cert = CERT_PATH.find(c => c.name === DOS.data.intelligence.study.currentCert);
    if (cert) DOS.data.intelligence.study.completed.push(cert.id);
    const nextCert = CERT_PATH.find(c => !DOS.data.intelligence.study.completed.includes(c.id));
    if (nextCert) {
      DOS.data.intelligence.study.currentCert = nextCert.name;
      DOS.data.intelligence.study.certProgress = 0;
      showToast('Certification complete! Next unlocked.', 'gold');
      awardXP('intelligence', 200);
    }
  }
  DOS.save('intelligence');
  renderIntelligence();
}

function addNote() {
  const topic = document.getElementById('note-topic').value.trim();
  const body = document.getElementById('note-body').value.trim();
  if (!topic || !body) return;
  DOS.data.intelligence.notes.push({ id: Date.now(), topic, body, date: today() });
  DOS.save('intelligence');
  awardXP('intelligence', 10);
  showToast('Note captured +10 Intelligence XP', 'info');
  renderIntelligence();
}

function addBook() {
  const title = prompt('Book title:');
  if (!title) return;
  const author = prompt('Author:') || '';
  DOS.data.intelligence.books.push({ id: Date.now(), title, author, status: 'want', notes: '', date: today() });
  DOS.save('intelligence');
  renderIntelligence();
}

function bookHTML(b) {
  const icons = { want: '📚', reading: '📖', done: '✅' };
  return `
    <div class="list-item">
      <span class="list-item-icon">${icons[b.status] || '📚'}</span>
      <div>
        <div class="list-item-title">${b.title}</div>
        <div class="list-item-sub">${b.author}</div>
      </div>
      <button class="btn btn-sm" onclick="cycleBookStatus(${b.id})">${capitalize(b.status)}</button>
    </div>`;
}

function cycleBookStatus(id) {
  const book = DOS.data.intelligence.books.find(b => b.id === id);
  if (!book) return;
  const cycle = { want: 'reading', reading: 'done', done: 'want' };
  book.status = cycle[book.status];
  if (book.status === 'done') awardXP('intelligence', 50);
  DOS.save('intelligence');
  renderIntelligence();
}

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
