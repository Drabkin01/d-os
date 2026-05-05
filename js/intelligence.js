// ── Intelligence Module — schema v2 (certifications + knowledgeNotes) ──────────

let _intelTab = 'certs';

// ── Tab Router ─────────────────────────────────────────────────────────────────

function renderIntelligence() {
  const container = document.getElementById('intelligence-content');
  if (!container) return;

  container.innerHTML = buildStatAICard('intelligence') + `
    <nav class="fin-tabs">
      <button class="fin-tab" data-tab="certs"     onclick="switchIntelTab('certs')">Certs</button>
      <button class="fin-tab" data-tab="languages" onclick="switchIntelTab('languages')">🇷🇺 Russian</button>
      <button class="fin-tab" data-tab="books"     onclick="switchIntelTab('books')">Books</button>
      <button class="fin-tab" data-tab="notes"     onclick="switchIntelTab('notes')">Notes</button>
      <button class="fin-tab" data-tab="stats"     onclick="switchIntelTab('stats')">Stats</button>
    </nav>
    <div id="intel-tab-content"></div>`;

  switchIntelTab(_intelTab);
}

function switchIntelTab(tab) {
  _intelTab = tab;
  document.querySelectorAll('#intelligence-content .fin-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  const el = document.getElementById('intel-tab-content');
  if (!el) return;
  switch (tab) {
    case 'certs':     el.innerHTML = buildCertsHTML();     break;
    case 'languages': el.innerHTML = buildLanguagesHTML(); break;
    case 'books':     el.innerHTML = buildBooksHTML();     break;
    case 'notes':     el.innerHTML = buildNotesHTML();     break;
    case 'stats':
      el.innerHTML = buildIntelStatsHTML();
      requestAnimationFrame(() => renderIntelCharts());
      break;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getActiveCert() {
  return (DOS.data.intelligence.certifications || []).find(c => c.status === 'in_progress');
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  const now    = new Date();
  return Math.ceil((target - now) / 86400000);
}

function studyHoursLogged() {
  return (DOS.data.intelligence.certifications || [])
    .flatMap(c => c.studySessions || [])
    .reduce((s, ss) => s + (ss.duration_minutes || 0) / 60, 0);
}

// ── Certs Tab ──────────────────────────────────────────────────────────────────

function buildCertsHTML() {
  const certs      = DOS.data.intelligence.certifications || [];
  const activeCert = certs.find(c => c.status === 'in_progress');
  const days       = activeCert ? daysUntil(activeCert.targetDate) : null;
  const hoursTotal = studyHoursLogged();

  // Exam countdown banner for active cert
  const countdownBanner = activeCert && days !== null ? (() => {
    const weeksLeft    = days / 7;
    const hoursNeeded  = Math.max(0, 60 - hoursTotal); // ~60h for CCP
    const hrsPerWeek   = weeksLeft > 0 ? (hoursNeeded / weeksLeft).toFixed(1) : '—';
    const urgency      = days <= 7 ? 'negative' : days <= 21 ? 'gold' : 'income';
    return `
      <section class="card exam-countdown-card">
        <div class="exam-countdown-header">
          <div>
            <div class="exam-cert-name">${activeCert.name}</div>
            <div class="sub-text">Target exam date</div>
          </div>
          <div class="exam-days-badge" style="color:var(--${urgency})">
            <span class="exam-days-num">${days}</span>
            <span class="exam-days-label">days</span>
          </div>
        </div>
        <div class="exam-stats-row">
          <div class="exam-stat">
            <span class="exam-stat-val">${hoursTotal.toFixed(1)}h</span>
            <span class="exam-stat-label">Studied</span>
          </div>
          <div class="exam-stat">
            <span class="exam-stat-val">${hrsPerWeek}h</span>
            <span class="exam-stat-label">Needed/week</span>
          </div>
          <div class="exam-stat">
            <span class="exam-stat-val">${activeCert.progress}%</span>
            <span class="exam-stat-label">Progress</span>
          </div>
        </div>
        <div class="progress-bar-track mt-8">
          <div class="progress-bar-fill blue" style="width:${activeCert.progress}%"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-primary" style="flex:1" onclick="showStudyLogForm()">+ Log Study Session</button>
          <button class="btn btn-outline" onclick="updateCertProgress()">Update %</button>
        </div>
        <div id="study-log-form" class="hidden" style="margin-top:12px">
          <input id="study-topic"    type="text"   placeholder="Topic (e.g. IAM, S3, VPC)" class="input-field"/>
          <div class="input-row" style="margin-top:6px">
            <input id="study-duration" type="number" placeholder="Duration (mins)" class="input-field" min="1"/>
            <button class="btn btn-primary" onclick="logStudySession()">Log +XP</button>
          </div>
        </div>
      </section>`;
  })() : '';

  // Cert path
  const certPathHTML = `
    <section class="card">
      <div class="card-header"><h2>AWS Certification Path</h2></div>
      <div class="cert-track">
        ${certs.map((c, i) => {
          const done   = c.status === 'completed';
          const active = c.status === 'in_progress';
          const certDays = daysUntil(c.targetDate);
          return `
            <div class="cert-node ${done ? 'done' : active ? 'active' : 'locked'}">
              <div class="cert-dot">${done ? '✓' : i + 1}</div>
              <div class="cert-info">
                <div class="cert-name">${c.name}</div>
                <div class="sub-text">${c.provider} · ${c.status === 'completed' ? 'Complete' : c.status === 'in_progress' ? 'In Progress' : 'Planned'}</div>
                ${active ? `
                  <div class="progress-bar-track mt-4">
                    <div class="progress-bar-fill blue" style="width:${c.progress}%"></div>
                  </div>
                  <div class="sub-text mt-2">${c.progress}%${certDays !== null ? ` · ${certDays} days to exam` : ''}</div>` : ''}
                ${done && c.completedDate ? `<div class="sub-text">${formatDate(c.completedDate)}</div>` : ''}
              </div>
              ${active ? `
                <button class="btn btn-sm" onclick="setExamDate('${c.id}')">
                  ${c.targetDate ? '📅' : 'Set date'}
                </button>` : ''}
            </div>
            ${i < certs.length - 1 ? '<div class="cert-connector"></div>' : ''}`;
        }).join('')}
      </div>
    </section>`;

  return countdownBanner + certPathHTML;
}

function showStudyLogForm() {
  const form = document.getElementById('study-log-form');
  if (form) form.classList.toggle('hidden');
}

function setExamDate(certId) {
  const cert = (DOS.data.intelligence.certifications || []).find(c => c.id === certId);
  if (!cert) return;
  dosPrompt('Set exam date', 'YYYY-MM-DD', cert.targetDate || '2026-05-31', val => {
    if (!val) return;
    cert.targetDate = val;
    DOS.save('intelligence');
    switchIntelTab('certs');
  }, 'date');
}

function updateCertProgress() {
  const activeCert = getActiveCert();
  if (!activeCert) { showToast('No active certification found.', 'error'); return; }
  dosPrompt(`${activeCert.name}`, 'Progress % (0–100)', activeCert.progress, val => {
    const pct = parseInt(val);
    if (isNaN(pct)) return;
    activeCert.progress = Math.max(0, Math.min(100, pct));
    if (pct >= 100) {
      activeCert.status        = 'completed';
      activeCert.completedDate = today();
      awardXP('intelligence', 200, `AWS cert completed: ${activeCert.name}`);
      showToast('Certification complete! 🎉', 'gold');
      const next = (DOS.data.intelligence.certifications||[]).find(c => c.status === 'planned');
      if (next) next.status = 'in_progress';
    }
    DOS.save('intelligence');
    switchIntelTab('certs');
  }, 'number');
}

function logStudySession() {
  const topic    = document.getElementById('study-topic')?.value.trim();
  const duration = parseInt(document.getElementById('study-duration')?.value) || 0;
  if (!topic || !duration) { showToast('Fill in topic and duration.', 'error'); return; }

  const activeCert = getActiveCert();
  const xp = Math.max(10, Math.floor(duration / 10) * 10);

  if (activeCert) {
    if (!activeCert.studySessions) activeCert.studySessions = [];
    activeCert.studySessions.push({
      id: `ss-${Date.now()}`,
      date: new Date().toISOString(),
      duration_minutes: duration,
      topic,
      xpEarned: xp
    });
  }

  DOS.save('intelligence');
  awardXP('intelligence', xp, `Study session: ${topic}`);
  showToast(`${duration} min session logged · +${xp} XP`, 'gold');
  switchIntelTab('certs');
}

// ── Languages Tab (Russian / Dagestan 2027 prep) ───────────────────────────────

function buildLanguagesHTML() {
  if (!DOS.data.intelligence.russian) {
    DOS.data.intelligence.russian = {
      streakDays: 0, lastStudyDate: null,
      vocabCount: 0, weeklyGoalMinutes: 60, studySessions: []
    };
  }
  const russian  = DOS.data.intelligence.russian;
  const streak   = russian.streakDays   || 0;
  const vocab    = russian.vocabCount   || 0;
  const sessions = russian.studySessions || [];
  const weekGoal = russian.weeklyGoalMinutes || 60;

  // Weekly minutes (current week, comparing YYYY-MM-DD prefix)
  const weekStart = getWeekStart();
  const weekMins  = sessions
    .filter(s => s.date && s.date.substring(0, 10) >= weekStart)
    .reduce((sum, s) => sum + (s.minutes || 0), 0);
  const weekPct = Math.min((weekMins / weekGoal) * 100, 100);

  const MILESTONES = [
    { count: 100,  label: '100 words',  emoji: '🔤' },
    { count: 250,  label: '250 words',  emoji: '📖' },
    { count: 500,  label: '500 words',  emoji: '🗣️' },
    { count: 1000, label: '1000 words', emoji: '🌟' }
  ];

  // Dagestan countdown (shared with health)
  const daysLeft = Math.ceil((new Date('2027-10-01') - new Date()) / 86400000);

  return `
    <!-- Russia / Dagestan header -->
    <section class="card lang-header-card">
      <div class="lang-flag-row">
        <span style="font-size:1.5rem">🇷🇺</span>
        <div>
          <div class="lang-title">Russian Language</div>
          <div class="sub-text">Dagestan 2027 · <strong style="color:var(--gold)">${daysLeft}</strong> days to go</div>
        </div>
        <div class="streak-badge-wrap ${streak > 0 ? 'active' : ''}">
          <span class="streak-num">${streak}</span>
          <span class="streak-unit">day streak</span>
        </div>
      </div>
    </section>

    <!-- Log session -->
    <section class="card">
      <div class="card-header"><h2>Log Study Session</h2></div>
      <div class="workout-log-form">
        <div class="input-row">
          <input id="ru-mins" type="number" placeholder="Minutes studied" class="input-field" min="1"/>
          <select id="ru-method" class="input-field">
            <option value="anki">Anki (flashcards)</option>
            <option value="pimsleur">Pimsleur</option>
            <option value="duolingo">Duolingo</option>
            <option value="speaking">Speaking practice</option>
            <option value="reading">Reading / listening</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button class="btn btn-primary w-full" onclick="logRussianSession()">Log Session +XP</button>
      </div>
    </section>

    <!-- Weekly goal -->
    <section class="card">
      <div class="card-header">
        <h2>Weekly Goal</h2>
        <span class="sub-text">${weekMins} / ${weekGoal} min</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill ${weekPct >= 100 ? 'income' : weekPct >= 60 ? 'gold' : 'blue'}"
             style="width:${weekPct}%"></div>
      </div>
      <div class="sub-text mt-4">${Math.round(weekPct)}% of weekly goal complete</div>
    </section>

    <!-- Vocabulary -->
    <section class="card">
      <div class="card-header">
        <h2>Vocabulary</h2>
        <button class="btn btn-sm" onclick="updateVocabCount()">Update count</button>
      </div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px">
        <span style="font-size:2rem;font-weight:900;color:var(--text)">${vocab}</span>
        <span class="sub-text">words learned</span>
      </div>
      <div class="milestone-row">
        ${MILESTONES.map(m => `
          <div class="milestone-badge ${vocab >= m.count ? 'achieved' : 'locked'}">
            <span class="milestone-emoji">${m.emoji}</span>
            <span class="milestone-label">${m.label}</span>
          </div>`).join('')}
      </div>
    </section>

    <!-- Recent sessions -->
    ${sessions.length ? `
    <section class="card">
      <div class="card-header"><h2>Recent Sessions</h2></div>
      ${sessions.slice().reverse().slice(0, 8).map(s => `
        <div class="list-item">
          <span class="list-item-icon">🇷🇺</span>
          <div class="list-item-grow">
            <div class="list-item-title">${capitalize(s.method || 'other')}</div>
            <div class="list-item-sub">${s.minutes} min · ${formatDate(s.date)}</div>
          </div>
          <span class="sub-text" style="color:var(--gold)">+${s.xpEarned} XP</span>
        </div>`).join('')}
    </section>` : '<p class="empty-state" style="padding:16px">Log your first Russian session above. Начинай!</p>'}`;
}

function logRussianSession() {
  const mins   = parseInt(document.getElementById('ru-mins')?.value) || 0;
  const method = document.getElementById('ru-method')?.value || 'other';
  if (!mins || mins < 1) { showToast('Enter minutes studied.', 'error'); return; }

  if (!DOS.data.intelligence.russian) {
    DOS.data.intelligence.russian = {
      streakDays: 0, lastStudyDate: null,
      vocabCount: 0, weeklyGoalMinutes: 60, studySessions: []
    };
  }

  const russian   = DOS.data.intelligence.russian;
  const todayStr  = today(); // YYYY-MM-DD
  const yd        = new Date(); yd.setDate(yd.getDate() - 1);
  const yesterStr = yd.toISOString().split('T')[0];

  // Streak logic
  if (russian.lastStudyDate === todayStr) {
    // already logged today — no streak change
  } else if (russian.lastStudyDate === yesterStr) {
    russian.streakDays = (russian.streakDays || 0) + 1;
  } else {
    russian.streakDays = 1;
  }
  russian.lastStudyDate = todayStr;

  const xp = Math.max(10, Math.floor(mins / 10) * 10);
  if (!russian.studySessions) russian.studySessions = [];
  russian.studySessions.push({
    id: `ru-${Date.now()}`,
    date: new Date().toISOString(),
    minutes: mins,
    method,
    xpEarned: xp
  });

  DOS.save('intelligence');
  awardXP('intelligence', xp, `Russian study: ${mins} min (${method})`);
  showToast(`${mins} min logged · 🔥 ${russian.streakDays} day streak · +${xp} XP`, 'gold');
  switchIntelTab('languages');
}

function updateVocabCount() {
  if (!DOS.data.intelligence.russian) return;
  const current = DOS.data.intelligence.russian.vocabCount || 0;
  dosPrompt('Update vocabulary count', `Current: ${current} words`, current, val => {
    const count = parseInt(val);
    if (isNaN(count) || count < 0) return;
    const MILESTONES = [100, 250, 500, 1000];
    const crossed = MILESTONES.filter(m => count >= m && current < m);
    DOS.data.intelligence.russian.vocabCount = count;
    DOS.save('intelligence');
    if (crossed.length) {
      crossed.forEach(m => { awardXP('intelligence', m, `Russian vocab: ${m} words`); showToast(`🎉 ${m} word milestone! +${m} XP`, 'gold'); });
    } else {
      showToast(`Vocabulary: ${count} words`, 'info');
    }
    switchIntelTab('languages');
  }, 'number');
}

// ── Books Tab ──────────────────────────────────────────────────────────────────

function buildBooksHTML() {
  const books   = DOS.data.intelligence.books || [];
  const reading = books.filter(b => b.status === 'reading');
  const want    = books.filter(b => b.status === 'want');
  const done    = books.filter(b => b.status === 'done');

  return `
    <section class="card">
      <div class="card-header"><h2>Add Book</h2></div>
      <div class="workout-log-form">
        <input id="book-title"  type="text" placeholder="Title"  class="input-field"/>
        <input id="book-author" type="text" placeholder="Author" class="input-field"/>
        <select id="book-status" class="input-field">
          <option value="want">Want to read</option>
          <option value="reading">Currently reading</option>
        </select>
        <button class="btn btn-primary w-full" onclick="addBook()">Add Book</button>
      </div>
    </section>

    ${reading.length ? `
    <section class="card">
      <div class="card-header"><h2>📖 Currently Reading</h2></div>
      ${reading.map(b => bookHTML(b)).join('')}
    </section>` : ''}

    ${want.length ? `
    <section class="card">
      <div class="card-header"><h2>📚 Want to Read</h2></div>
      ${want.map(b => bookHTML(b)).join('')}
    </section>` : ''}

    ${done.length ? `
    <section class="card">
      <div class="card-header"><h2>✅ Completed (${done.length})</h2></div>
      ${done.slice().reverse().map(b => bookHTML(b)).join('')}
    </section>` : ''}

    ${!books.length ? '<p class="empty-state" style="padding:16px">No books added yet.</p>' : ''}`;
}

function bookHTML(b) {
  const icons = { want: '📚', reading: '📖', done: '✅' };
  return `
    <div class="list-item">
      <span class="list-item-icon">${icons[b.status] || '📚'}</span>
      <div class="list-item-grow">
        <div class="list-item-title">${b.title}</div>
        <div class="list-item-sub">${b.author || 'Unknown'}</div>
      </div>
      <button class="btn btn-sm" onclick="cycleBookStatus(${b.id})">${capitalize(b.status)}</button>
    </div>`;
}

function addBook() {
  const title  = document.getElementById('book-title')?.value.trim();
  const author = document.getElementById('book-author')?.value.trim() || '';
  const status = document.getElementById('book-status')?.value || 'want';
  if (!title) { showToast('Book title required.', 'error'); return; }

  if (!DOS.data.intelligence.books) DOS.data.intelligence.books = [];
  DOS.data.intelligence.books.push({
    id: Date.now(), title, author, status, notes: '',
    date: today(),
    startDate: status === 'reading' ? today() : null,
    completedDate: null, rating: null
  });
  DOS.save('intelligence');
  showToast(`"${title}" added`, 'info');
  switchIntelTab('books');
}

function cycleBookStatus(id) {
  const books = DOS.data.intelligence.books || [];
  const book  = books.find(b => b.id === id);
  if (!book) return;
  const cycle = { want: 'reading', reading: 'done', done: 'want' };
  book.status = cycle[book.status];
  if (book.status === 'reading') book.startDate    = today();
  if (book.status === 'done')   {
    book.completedDate = today();
    awardXP('intelligence', 50, `Book completed: ${book.title}`);
    showToast(`Book complete! +50 Intelligence XP`, 'gold');
  }
  DOS.save('intelligence');
  switchIntelTab('books');
}

// ── Notes Tab ──────────────────────────────────────────────────────────────────

function buildNotesHTML() {
  const notes = (DOS.data.intelligence.knowledgeNotes || []).slice().reverse().slice(0, 20);

  return `
    <section class="card">
      <div class="card-header"><h2>Capture Knowledge</h2></div>
      <div class="note-form">
        <input id="note-topic" type="text"     placeholder="Topic (e.g. AWS IAM, BJJ guard, Security)" class="input-field"/>
        <textarea id="note-body" placeholder="What did you learn?" class="input-field textarea" rows="4"></textarea>
        <button class="btn btn-primary w-full" onclick="addNote()">Capture +XP</button>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Recent Notes</h2></div>
      ${notes.length === 0
        ? '<p class="empty-state">Start capturing knowledge.</p>'
        : notes.map(n => `
            <div style="padding:12px 0;border-bottom:1px solid var(--border-lite)">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span class="tag">${n.title || n.topic || ''}</span>
                <span class="sub-text">${formatDate(n.date)}</span>
              </div>
              <p style="margin:4px 0 0;font-size:0.85rem;color:var(--text)">${n.content || n.body || ''}</p>
            </div>`).join('')}
    </section>`;
}

function addNote() {
  const topic = document.getElementById('note-topic')?.value.trim();
  const body  = document.getElementById('note-body')?.value.trim();
  if (!topic || !body) { showToast('Fill in topic and note.', 'error'); return; }

  const xp  = 10;
  const iso  = new Date().toISOString();

  if (!DOS.data.intelligence.knowledgeNotes) DOS.data.intelligence.knowledgeNotes = [];
  DOS.data.intelligence.knowledgeNotes.push({
    id: `kn-${Date.now()}`, date: iso,
    title: topic, content: body, tags: [topic], xpEarned: xp
  });

  DOS.save('intelligence');
  awardXP('intelligence', xp, `Knowledge note: ${topic}`);
  showToast(`Note captured +${xp} Intelligence XP`, 'info');
  if (typeof isGoogleConnected === 'function' && isGoogleConnected()) syncToDrive().catch(() => {});
  switchIntelTab('notes');
}

// ── Stats Tab ──────────────────────────────────────────────────────────────────

function buildIntelStatsHTML() {
  const certs      = DOS.data.intelligence.certifications || [];
  const books      = DOS.data.intelligence.books || [];
  const notes      = DOS.data.intelligence.knowledgeNotes || [];
  const done       = books.filter(b => b.status === 'done').length;
  const hoursTotal = studyHoursLogged();
  const activeCert = certs.find(c => c.status === 'in_progress');
  const days       = activeCert ? daysUntil(activeCert.targetDate) : null;

  return `
    <section class="card">
      <div class="card-header"><h2>Study Hours</h2><span class="sub-text">Last 8 weeks</span></div>
      <div class="chart-wrap" style="height:180px">
        <canvas id="chart-study-hours"></canvas>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Cert Progress</h2></div>
      ${certs.map(c => {
        const pct = c.progress || 0;
        const color = { in_progress: '#63b3ed', planned: '#333', completed: '#68d391' }[c.status] || '#333';
        return `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:13px;font-weight:700">${c.name}</span>
              <span class="sub-text">${c.status === 'completed' ? '✓ Done' : c.status === 'in_progress' ? pct + '%' : 'Planned'}</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
          </div>`;
      }).join('')}
    </section>

    <section class="card">
      <div class="card-header"><h2>Knowledge Snapshot</h2></div>
      <div class="balance-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="balance-item">
          <span class="balance-label">Hours</span>
          <span class="balance-amount intelligence">${hoursTotal.toFixed(1)}</span>
        </div>
        <div class="balance-item">
          <span class="balance-label">Notes</span>
          <span class="balance-amount">${notes.length}</span>
        </div>
        <div class="balance-item">
          <span class="balance-label">Books</span>
          <span class="balance-amount gold">${done}</span>
        </div>
        <div class="balance-item">
          <span class="balance-label">Days left</span>
          <span class="balance-amount ${days !== null && days <= 21 ? 'negative' : 'income'}">${days !== null ? days : '—'}</span>
        </div>
      </div>
    </section>`;
}

function renderIntelCharts() {
  renderStudyHoursChart();
}

function renderStudyHoursChart() {
  const now   = new Date();
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now - i * 7 * 86400000);
    weeks.push(getISOWeek(d));
  }

  const hoursByWeek = {};
  weeks.forEach(w => hoursByWeek[w] = 0);

  (DOS.data.intelligence.certifications || []).forEach(c => {
    (c.studySessions || []).forEach(s => {
      const wk = getISOWeek(new Date(s.date));
      if (hoursByWeek[wk] !== undefined) {
        hoursByWeek[wk] += (s.duration_minutes || 0) / 60;
      }
    });
  });

  const activeCert = getActiveCert();
  const days       = activeCert ? daysUntil(activeCert.targetDate) : null;
  const weeksLeft  = days ? days / 7 : null;
  const hoursTotal = studyHoursLogged();
  const hoursNeeded = Math.max(0, 60 - hoursTotal);
  const goalPerWeek = weeksLeft && weeksLeft > 0 ? hoursNeeded / weeksLeft : null;

  dosChart('chart-study-hours', {
    type: 'bar',
    data: {
      labels: weeks.map(w => `W${w.split('-W')[1]}`),
      datasets: [
        {
          label: 'Hours studied',
          data: weeks.map(w => parseFloat(hoursByWeek[w].toFixed(1))),
          backgroundColor: 'rgba(183,148,244,0.7)',
          borderColor: '#b794f4',
          borderWidth: 1,
          borderRadius: 4
        },
        ...(goalPerWeek ? [{
          label: `Goal (${goalPerWeek.toFixed(1)}h/wk)`,
          data: weeks.map(() => parseFloat(goalPerWeek.toFixed(1))),
          type: 'line',
          borderColor: '#f6ad55',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }] : [])
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: dosLegend() },
      scales: dosScales()
    }
  });
}
