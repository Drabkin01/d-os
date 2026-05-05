// ── D-OS AI Engine ────────────────────────────────────────────────────────────

const AI_SYSTEM_PROMPT = `You are the D-OS intelligence engine for Liam Caldwell.

Profile:
- Technical Support Engineer at truID (South African FinTech, identity verification)
- Monthly income: R19,200 (R16,200 salary + R3,000 family support)
- Fixed costs: R12,809/month (Rent R10,000, Fuel R600, Training R1,300, Wifi R479, Hair R430)
- Trains CrossFit, BJJ, and Muay Thai — multi-discipline athlete, watch for overtraining
- Studying AWS Cloud Practitioner (target: May 2026) → Solutions Architect → AI/ML specialty
- Long-term goal: Russia 2027 trip to Dagestan for BJJ — saving R73,000, studying Russian
- Tracks 4 life stats: Health, Finances, Intelligence, Work

Your role: Each evening Liam sends a day summary. You read it alongside his current app data and return tomorrow's prioritised focus. Flag Russia 2027 readiness issues: savings behind pace, Russian streak broken, BJJ frequency dropping.

Tone rules:
- Finances: Caleb Hammer energy — blunt, data-driven, call out waste by name, no sugarcoating
- Health: acknowledge the multi-discipline load, flag recovery gaps, respect the training
- Intelligence: connect what he's learning to his company vision AND his Russia trip prep
- Work: push momentum on personal projects, not just ticket management
- No motivational fluff. No "great job". Specific to his actual numbers.

Respond ONLY with valid JSON. No markdown code fences, no explanation outside the JSON:
{
  "greeting": "One sharp sentence acknowledging today. Reference something specific.",
  "priorities": [
    { "stat": "health|finances|intelligence|work", "action": "Concrete specific action", "why": "Data-driven reason referencing his actual numbers" },
    { "stat": "...", "action": "...", "why": "..." },
    { "stat": "...", "action": "...", "why": "..." }
  ],
  "insight": "One blunt, direct observation. Caleb Hammer level honesty. No padding.",
  "focusStat": "health|finances|intelligence|work"
}`;

// ── ISO Week Helper ───────────────────────────────────────────────────────────

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return d.getUTCFullYear() + '-W' +
    String(Math.ceil((((d - yearStart) / 86400000) + 1) / 7)).padStart(2, '0');
}

// ── Context Builder ───────────────────────────────────────────────────────────

function buildAIContext() {
  const char  = DOS.data.character;
  const health = DOS.data.health;
  const fin   = DOS.data.finances;
  const intel = DOS.data.intelligence;
  const work  = DOS.data.work;

  const now        = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const weekStart  = getWeekStart();

  const totalIncome  = fin.income.reduce((s,i) => s+i.amount, 0);
  const monthExpenses = fin.expenses.filter(e => e.date >= monthStart);
  const monthSpent   = monthExpenses.reduce((s,e) => s+e.amount, 0);
  const balance      = totalIncome - monthSpent;

  const catSpend = {};
  monthExpenses.forEach(e => { catSpend[e.category] = (catSpend[e.category]||0) + e.amount; });
  const topCats = Object.entries(catSpend).sort((a,b) => b[1]-a[1]).slice(0,4);

  const weekWorkouts = health.workouts.filter(w => w.date >= weekStart);
  const allWorkouts  = [...health.workouts].sort((a,b) => a.date > b.date ? -1 : 1);
  const lastWorkout  = allWorkouts[0];
  const daysSince    = lastWorkout
    ? Math.floor((now - new Date(lastWorkout.date)) / 86400000)
    : null;

  const knowledgeNotes = intel.knowledgeNotes || [];
  const weekNotes   = knowledgeNotes.filter(n => n.date >= weekStart).length;
  const openTickets = work.tickets.filter(t => t.status !== 'closed').length;

  // Active cert (v2 schema)
  const certs       = intel.certifications || [];
  const activeCert  = certs.find(c => c.status === 'in_progress');
  const certSessions = activeCert ? (activeCert.studySessions || []) : [];
  const hoursStudied = certSessions.reduce((s, ss) => s + (ss.duration_minutes || 0) / 60, 0);

  // Body weight (v2 schema, fall back to legacy)
  const bwLog       = health.bodyWeight?.length ? health.bodyWeight : (health.weight || []);
  const latestWeight = bwLog.length ? bwLog[bwLog.length - 1] : null;

  // Russia 2027
  const russian      = intel.russian || {};
  const russiaGoal   = (fin.savingsGoals || []).find(g => g.id === 'sg-russia');
  const daysToRussia = Math.ceil((new Date('2027-10-01') - now) / 86400000);
  const bjjThisWeek  = weekWorkouts.filter(w => w.type === 'bjj' || w.type === 'muay-thai').length;

  // Recurring fixed costs
  const recurring    = fin.recurringExpenses || [];
  const totalFixed   = recurring.reduce((s, r) => s + r.amount, 0);

  return {
    date: now.toDateString(),
    statLevels: Object.fromEntries(Object.entries(char.stats).map(([k,v]) => [k, `Level ${v.level}`])),
    health: {
      workoutsThisWeek:     weekWorkouts.length,
      workoutTypes:         [...new Set(weekWorkouts.map(w => w.type))],
      bjjMTThisWeek:        bjjThisWeek,
      daysSinceLastWorkout: daysSince !== null ? `${daysSince} days` : 'never logged',
      currentWeightKg:      latestWeight ? latestWeight.weight_kg || latestWeight.kg : 'untracked'
    },
    finances: {
      monthlyIncome:      `R${totalIncome.toLocaleString()}`,
      fixedCosts:         `R${totalFixed.toLocaleString()}`,
      spentThisMonth:     `R${Math.round(monthSpent).toLocaleString()}`,
      balanceRemaining:   `R${Math.round(balance).toLocaleString()}`,
      spendingRate:       `${Math.round((monthSpent / totalIncome) * 100)}% of income`,
      topCategories:      topCats.map(([cat, amt]) => `${cat}: R${Math.round(amt)}`),
      savingsGoals:       (fin.savingsGoals || []).map(g => `${g.name}: R${g.current} of R${g.target}`)
    },
    intelligence: {
      activeCert:         activeCert ? activeCert.name : 'None',
      certProgress:       activeCert ? `${activeCert.progress}%` : 'N/A',
      examTarget:         activeCert?.targetDate || 'Not set',
      hoursStudied:       `${hoursStudied.toFixed(1)}h`,
      notesThisWeek:      weekNotes,
      booksReading:       (intel.books || []).filter(b => b.status === 'reading').map(b => b.title),
      russianStreak:      `${russian.streakDays || 0} days`,
      russianVocab:       `${russian.vocabCount || 0} words`
    },
    russia2027: {
      daysUntilTrip:      daysToRussia,
      savings:            russiaGoal ? `R${russiaGoal.current} of R${russiaGoal.target}` : 'Not tracked',
      monthlyTarget:      russiaGoal ? `R${russiaGoal.monthlyTarget}/month` : 'R3,000/month',
      bjjSessionsThisWeek: bjjThisWeek,
      bjjTarget:          '3x/week',
      savingsOnTrack:     russiaGoal
        ? (russiaGoal.current / russiaGoal.target) >= ((now - new Date('2025-01-01')) / (new Date('2027-10-01') - new Date('2025-01-01')))
        : false
    },
    work: {
      openTickets,
      activeProjects: (work.projects || [])
        .filter(p => p.status === 'active')
        .map(p => `${p.name} (${(p.timeLogged || 0).toFixed(1)}h total)`)
    }
  };
}

// ── API Call ──────────────────────────────────────────────────────────────────

async function sendDailyBriefing(summaryText) {
  if (!summaryText.trim()) {
    showToast('Write something about your day first.', 'error');
    return;
  }

  const context = buildAIContext();
  const userMsg = `My day: ${summaryText.trim()}\n\nCurrent data:\n${JSON.stringify(context, null, 2)}`;

  const btn = document.getElementById('ai-submit-btn');
  const spinner = document.getElementById('ai-spinner');
  if (btn)     { btn.disabled = true; btn.textContent = 'Thinking...'; }
  if (spinner) spinner.classList.remove('hidden');

  try {
    const resp = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: AI_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error || `Server error ${resp.status}`);

    // Strip markdown code fences if present
    const cleaned = data.content.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim();
    let briefing;
    try {
      briefing = JSON.parse(cleaned);
    } catch {
      throw new Error('AI returned invalid JSON. Try again.');
    }

    validateBriefing(briefing);
    storeBriefing(briefing, summaryText);
    renderTodaysFocus(briefing);
    closeAIModal();
    DOS.navigate('dashboard');
    showToast("Today's focus updated", 'gold');

  } catch (err) {
    showToast(`AI error: ${err.message}`, 'error');
    console.error('[D-OS AI]', err);
  } finally {
    if (btn)     { btn.disabled = false; btn.textContent = 'Get Briefing'; }
    if (spinner) spinner.classList.add('hidden');
  }
}

function validateBriefing(b) {
  if (!b.greeting || !Array.isArray(b.priorities) || !b.insight || !b.focusStat) {
    throw new Error('Briefing missing required fields.');
  }
  if (b.priorities.length < 1) throw new Error('No priorities returned.');
}

// ── Persistence ───────────────────────────────────────────────────────────────

function storeBriefing(briefing, summary) {
  localStorage.setItem('dos_briefing', JSON.stringify({ briefing, summary, date: today() }));
}

function loadLastBriefing() {
  try {
    const raw = localStorage.getItem('dos_briefing');
    if (!raw) return null;
    const record = JSON.parse(raw);
    return record.date === today() ? record.briefing : null;
  } catch { return null; }
}

// ── Dashboard Render ──────────────────────────────────────────────────────────

const STAT_ICONS = { health: '❤️', finances: '💰', intelligence: '🧠', work: '⚙️' };

function renderTodaysFocus(briefing) {
  const container = document.getElementById('todays-focus');
  if (!container) return;

  container.innerHTML = `
    <div class="focus-header">
      <span class="focus-label">TODAY'S FOCUS</span>
      <button class="focus-refresh-btn" onclick="openAIModal()" title="New briefing">↺</button>
    </div>
    <div class="focus-greeting">${briefing.greeting}</div>
    <div class="focus-priorities">
      ${briefing.priorities.slice(0,3).map((p,i) => `
        <div class="focus-card ${p.stat}">
          <div class="focus-card-top">
            <span class="focus-rank">${i+1}</span>
            <span class="focus-stat-badge ${p.stat}">${STAT_ICONS[p.stat]||''} ${capitalize(p.stat)}</span>
          </div>
          <div class="focus-action">${p.action}</div>
          <div class="focus-why">${p.why}</div>
        </div>`).join('')}
    </div>
    <div class="focus-insight">"${briefing.insight}"</div>`;

  container.classList.remove('hidden');
}

function renderFocusPlaceholder() {
  const container = document.getElementById('todays-focus');
  if (!container) return;
  container.innerHTML = `
    <div class="focus-header">
      <span class="focus-label">TODAY'S FOCUS</span>
    </div>
    <div class="focus-empty">
      <p>Send a day summary and the AI will set your priorities.</p>
      <button class="btn btn-primary btn-sm-full" onclick="openAIModal()">Daily Briefing</button>
    </div>`;
  container.classList.remove('hidden');
}

function renderFocusFromStorage() {
  const briefing = loadLastBriefing();
  briefing ? renderTodaysFocus(briefing) : renderFocusPlaceholder();
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openAIModal() {
  const modal = document.getElementById('ai-modal');
  if (!modal) return;
  modal.classList.add('open');
  const input = document.getElementById('ai-summary-input');
  if (input) { input.value = ''; input.focus(); }
}

function closeAIModal() {
  document.getElementById('ai-modal')?.classList.remove('open');
}
