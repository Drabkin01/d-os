// ── Health Module ─────────────────────────────────────────────────────────────

let _healthTab    = 'log';
let _weightFilter = '1M';
let _liftFilter   = '';
let _pendingLifts = [];

// ── Chart helpers (shared with finances/intelligence/work) ────────────────────

function dosChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  return new Chart(canvas, config);
}

const DOS_CHART_STYLE = {
  color: '#888',
  gridColor: '#1a1a1a',
  fontFamily: "'system-ui', sans-serif"
};

function dosScales(opts = {}) {
  return {
    x: { ticks: { color: DOS_CHART_STYLE.color, font: { family: DOS_CHART_STYLE.fontFamily } }, grid: { color: DOS_CHART_STYLE.gridColor }, ...opts.x },
    y: { ticks: { color: DOS_CHART_STYLE.color, font: { family: DOS_CHART_STYLE.fontFamily } }, grid: { color: DOS_CHART_STYLE.gridColor }, beginAtZero: true, ...opts.y }
  };
}

function dosLegend() {
  return { labels: { color: '#aaa', font: { family: DOS_CHART_STYLE.fontFamily } } };
}

// ── Tab Router ────────────────────────────────────────────────────────────────

function renderHealth() {
  const container = document.getElementById('health-content');
  if (!container) return;
  container.innerHTML = `
    <nav class="fin-tabs">
      <button class="fin-tab" data-tab="log"       onclick="switchHealthTab('log')">Log</button>
      <button class="fin-tab" data-tab="history"   onclick="switchHealthTab('history')">History</button>
      <button class="fin-tab" data-tab="nutrition" onclick="switchHealthTab('nutrition')">Nutrition</button>
      <button class="fin-tab" data-tab="stats"     onclick="switchHealthTab('stats')">Stats</button>
    </nav>
    <div id="health-tab-content"></div>`;
  switchHealthTab(_healthTab);
}

function switchHealthTab(tab) {
  _healthTab = tab;
  document.querySelectorAll('#health-content .fin-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  const el = document.getElementById('health-tab-content');
  if (!el) return;
  switch (tab) {
    case 'log':       el.innerHTML = buildHealthLogHTML();       break;
    case 'history':   el.innerHTML = buildHealthHistoryHTML();   break;
    case 'nutrition': el.innerHTML = buildNutritionHTML();       break;
    case 'stats':
      el.innerHTML = buildHealthStatsHTML();
      requestAnimationFrame(() => renderHealthCharts());
      break;
  }
}

// ── Log Tab ───────────────────────────────────────────────────────────────────

function buildHealthLogHTML() {
  const pendingLiftsHTML = _pendingLifts.length ? `
    <div class="pending-lifts">
      ${_pendingLifts.map((l,i) => `
        <div class="pending-lift-row">
          <span class="lift-name">${l.exercise}</span>
          <span class="lift-detail">${l.sets}×${l.reps} @ ${l.weight_kg}kg</span>
          <button class="icon-btn" onclick="removePendingLift(${i})">×</button>
        </div>`).join('')}
    </div>` : '';

  const pastExercises = [...new Set(
    DOS.data.health.workouts.flatMap(w => (w.lifts||[]).map(l => l.exercise))
  )].sort();

  return `
    <section class="card">
      <div class="card-header"><h2>Log Workout</h2></div>
      <div class="workout-log-form">
        <select id="wkt-type" class="input-field">
          <option value="crossfit">CrossFit</option>
          <option value="bjj">BJJ</option>
          <option value="muay-thai">Muay Thai</option>
          <option value="gym">Gym</option>
          <option value="run">Run</option>
          <option value="other">Other</option>
        </select>
        <input id="wkt-notes"    type="text"   placeholder="Notes (movements, rounds, PRs...)" class="input-field"/>
        <input id="wkt-duration" type="number" placeholder="Duration (mins)" class="input-field" min="1"/>
        <div class="lift-section">
          <div class="lift-section-label">Lifts <span class="sub-text">(optional)</span></div>
          ${pendingLiftsHTML}
          <datalist id="exercise-list">
            ${pastExercises.map(e => `<option value="${e}">`).join('')}
          </datalist>
          <div class="lift-add-row">
            <input id="lift-exercise" type="text"   list="exercise-list" placeholder="Exercise (e.g. Deadlift)" class="input-field"/>
            <input id="lift-weight"   type="number" placeholder="kg"  class="input-field" min="0" step="0.5" style="width:70px"/>
          </div>
          <div class="lift-add-row">
            <input id="lift-sets" type="number" placeholder="Sets" class="input-field" min="1" style="width:80px"/>
            <input id="lift-reps" type="number" placeholder="Reps" class="input-field" min="1" style="width:80px"/>
            <button class="btn btn-outline" onclick="addPendingLift()" style="flex:1">+ Add Lift</button>
          </div>
        </div>
        <button class="btn btn-primary w-full" onclick="logWorkout()">Log Session +XP</button>
      </div>
    </section>

    ${buildDagestanPrepCard()}

    <section class="card">
      <div class="card-header"><h2>Log Body Weight</h2></div>
      <div class="input-row">
        <input id="wgt-kg" type="number" placeholder="Weight (kg)" class="input-field" step="0.1" min="30" max="300"/>
        <button class="btn btn-primary" onclick="logBodyWeight()">Log</button>
      </div>
      ${latestWeightHTML()}
    </section>

    <section class="card">
      <div class="card-header"><h2>Water</h2></div>
      <div class="input-row">
        <input id="water-ml" type="number" placeholder="Water (ml)" class="input-field" step="100" min="0"/>
        <button class="btn btn-primary" onclick="logWater()">Log</button>
      </div>
      ${todayWaterHTML()}
    </section>`;
}

function buildDagestanPrepCard() {
  const daysLeft  = Math.ceil((new Date('2027-10-01') - new Date()) / 86400000);
  const weekStart = getWeekStart();
  const maThisWeek = DOS.data.health.workouts.filter(w => {
    const d = (w.date||'').substring(0,10);
    return d >= weekStart && (w.type==='bjj'||w.type==='muay-thai'||w.type==='muay_thai');
  }).length;
  const target = 3;
  const pct    = Math.min((maThisWeek/target)*100, 100);
  const color  = pct>=100?'income':pct>=66?'gold':'negative';
  return `
    <section class="card dagestan-card">
      <div class="dagestan-header">
        <span style="font-size:1.6rem">🥋</span>
        <div style="flex:1">
          <div class="dagestan-title">Dagestan Prep</div>
          <div class="sub-text">Russia 2027 · Oct 1</div>
        </div>
        <div class="dagestan-countdown">
          <span class="dagestan-days-num">${daysLeft}</span>
          <span class="dagestan-days-label">days</span>
        </div>
      </div>
      <div style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span class="sub-text">BJJ / MT this week</span>
          <span class="sub-text">${maThisWeek} / ${target} sessions</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill ${color}" style="width:${pct}%"></div>
        </div>
      </div>
    </section>`;
}

function latestWeightHTML() {
  const w = DOS.data.health.weight || [];
  if (!w.length) return '<p class="empty-state" style="margin-top:8px">No weight logged yet.</p>';
  const last = w[w.length-1];
  return `<div class="sub-text" style="margin-top:6px">Last: <strong>${last.kg}kg</strong> · ${formatDate(last.date)}</div>`;
}

function todayWaterHTML() {
  const entry = DOS.data.health.nutrition.find(n => n.date === today());
  const ml    = entry?.water_ml || 0;
  const pct   = Math.min((ml/3000)*100, 100);
  return `
    <div style="margin-top:8px">
      <div class="progress-bar-track">
        <div class="progress-bar-fill blue" style="width:${pct}%"></div>
      </div>
      <div class="sub-text mt-4">${ml}ml · target 3,000ml</div>
    </div>`;
}

function logBodyWeight() {
  const kg = parseFloat(document.getElementById('wgt-kg')?.value);
  if (!kg||isNaN(kg)||kg<20||kg>300) { showToast('Enter a valid weight.','error'); return; }
  const iso = new Date().toISOString();
  if (!DOS.data.health.weight) DOS.data.health.weight = [];
  DOS.data.health.weight.push({ id: Date.now(), date: today(), kg });
  if (!DOS.data.health.bodyWeight) DOS.data.health.bodyWeight = [];
  DOS.data.health.bodyWeight.push({ id: `bw-${Date.now()}`, date: iso, weight_kg: kg });
  DOS.save('health');
  awardXP('health', 5, 'Body weight logged');
  showToast(`${kg}kg logged +5 Health XP`, 'gold');
  switchHealthTab('log');
}

function logWater() {
  const ml = parseInt(document.getElementById('water-ml')?.value);
  if (!ml||isNaN(ml)||ml<=0) { showToast('Enter ml amount.','error'); return; }
  const existing = DOS.data.health.nutrition.find(n => n.date === today());
  if (existing) { existing.water_ml = (existing.water_ml||0)+ml; }
  else { DOS.data.health.nutrition.push({ id:`nut-${Date.now()}`, date:today(), water_ml:ml, meals:[] }); }
  DOS.save('health');
  showToast(`+${ml}ml logged`, 'info');
  switchHealthTab('log');
}

function addPendingLift() {
  const exercise  = document.getElementById('lift-exercise')?.value.trim();
  const weight_kg = parseFloat(document.getElementById('lift-weight')?.value);
  const sets      = parseInt(document.getElementById('lift-sets')?.value);
  const reps      = parseInt(document.getElementById('lift-reps')?.value);
  if (!exercise)              { showToast('Enter exercise name.','error'); return; }
  if (!weight_kg||weight_kg<0){ showToast('Enter weight (kg).','error');  return; }
  if (!sets||sets<1)          { showToast('Enter sets.','error');          return; }
  if (!reps||reps<1)          { showToast('Enter reps.','error');          return; }
  _pendingLifts.push({ exercise: capitalize(exercise), weight_kg, sets, reps });
  document.getElementById('health-tab-content').innerHTML = buildHealthLogHTML();
}

function removePendingLift(index) {
  _pendingLifts.splice(index, 1);
  document.getElementById('health-tab-content').innerHTML = buildHealthLogHTML();
}

function logWorkout() {
  const type     = document.getElementById('wkt-type')?.value;
  const notes    = document.getElementById('wkt-notes')?.value || '';
  const duration = parseInt(document.getElementById('wkt-duration')?.value) || 0;
  if (!type) return;
  const liftBonus = _pendingLifts.length * 5;
  const xpEarned  = 25 + liftBonus;
  DOS.data.health.workouts.push({
    id: Date.now(), type, notes, duration, date: today(),
    lifts: [..._pendingLifts], xpEarned
  });
  _pendingLifts = [];
  DOS.save('health');
  awardXP('health', xpEarned, `${capitalize(type.replace('-',' '))} session`);
  showToast(`${capitalize(type)} logged! +${xpEarned} Health XP`, 'gold');
  switchHealthTab('history');
}

// ── History Tab ───────────────────────────────────────────────────────────────

function buildHealthHistoryHTML() {
  const workouts = DOS.data.health.workouts.slice().reverse().slice(0,20);
  const weights  = (DOS.data.health.weight||[]).slice().reverse().slice(0,10);

  return `
    <section class="card">
      <div class="card-header"><h2>Recent Workouts</h2></div>
      ${workouts.length===0
        ? '<p class="empty-state">No workouts logged yet. Get after it.</p>'
        : workouts.map(w => `
            <div class="list-item" style="flex-direction:column;align-items:flex-start;gap:4px;padding:12px 0">
              <div style="display:flex;width:100%;align-items:center;gap:8px">
                <span class="list-item-icon">${workoutIcon(w.type)}</span>
                <div class="list-item-grow">
                  <div class="list-item-title">${capitalize(w.type.replace('-',' '))}</div>
                  <div class="list-item-sub">${formatDate(w.date)}${w.duration?' · '+w.duration+' min':''}${w.notes?' · '+w.notes:''}</div>
                </div>
                <span class="sub-text">${w.xpEarned||25} XP</span>
                <button class="icon-btn" onclick="deleteWorkout(${w.id})" title="Delete">×</button>
              </div>
              ${w.lifts&&w.lifts.length ? `
                <div class="lift-summary">
                  ${w.lifts.map(l => `<span class="lift-pill">${l.exercise} ${l.sets}×${l.reps}@${l.weight_kg}kg</span>`).join('')}
                </div>` : ''}
            </div>`).join('')}
    </section>

    <section class="card">
      <div class="card-header"><h2>Weight Log</h2></div>
      ${weights.length===0
        ? '<p class="empty-state">No weight entries yet.</p>'
        : weights.map(w => `
            <div class="list-item">
              <span class="list-item-icon">⚖️</span>
              <div class="list-item-grow">
                <div class="list-item-title">${w.kg} kg</div>
                <div class="list-item-sub">${formatDate(w.date)}</div>
              </div>
              <button class="icon-btn" onclick="deleteWeightEntry(${w.id})" title="Delete">×</button>
            </div>`).join('')}
    </section>`;
}

function workoutIcon(type) {
  return {crossfit:'🏋️',bjj:'🥋','muay-thai':'🥊',gym:'💪',run:'🏃',other:'⚡'}[type]||'💪';
}

function deleteWorkout(id) {
  dosConfirm('Delete this session?', () => {
    DOS.data.health.workouts = DOS.data.health.workouts.filter(w => w.id !== id);
    DOS.save('health');
    switchHealthTab('history');
  });
}

function deleteWeightEntry(id) {
  DOS.data.health.weight = (DOS.data.health.weight||[]).filter(w => w.id !== id);
  DOS.data.health.bodyWeight = (DOS.data.health.bodyWeight||[]).filter(w => w.id !== id && w.id !== `bw-${id}`);
  DOS.save('health');
  switchHealthTab('history');
}

// ── Nutrition Tab ─────────────────────────────────────────────────────────────

function buildNutritionHTML() {
  const todayStr  = today();
  const entry     = DOS.data.health.nutrition.find(n => n.date === todayStr) || { water_ml: 0, meals: [] };
  const meals     = entry.meals || [];
  const water     = entry.water_ml || 0;
  const waterPct  = Math.min((water/3000)*100, 100);
  const totalKcal = meals.reduce((s,m) => s+(m.calories||0), 0);

  const recentEntries = DOS.data.health.nutrition
    .filter(n => n.date !== todayStr && (n.water_ml||0) > 0)
    .slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);

  return `
    <!-- Water -->
    <section class="card">
      <div class="card-header">
        <h2>Water</h2>
        <span class="sub-text">${water}ml / 3,000ml</span>
      </div>
      <div class="progress-bar-track" style="height:10px">
        <div class="progress-bar-fill blue" style="width:${waterPct}%;height:100%"></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
        ${[250,500,750].map(ml => `
          <button class="btn btn-outline btn-sm" onclick="quickLogWater(${ml})">+${ml}ml</button>`).join('')}
        <div class="input-row" style="flex:1;min-width:160px;margin:0">
          <input id="water-custom" type="number" placeholder="Custom ml" class="input-field" min="1" style="margin:0"/>
          <button class="btn btn-primary" onclick="customLogWater()">Log</button>
        </div>
      </div>
    </section>

    <!-- Meals today -->
    <section class="card">
      <div class="card-header">
        <h2>Meals Today</h2>
        ${totalKcal > 0 ? `<span class="sub-text">${totalKcal} kcal</span>` : ''}
      </div>
      ${meals.length===0
        ? '<p class="empty-state">No meals logged today.</p>'
        : meals.map((m,i) => `
            <div class="meal-row">
              <span class="meal-time">${m.time||''}</span>
              <span class="meal-desc">${m.description}</span>
              <span class="meal-kcal">${m.calories?m.calories+' kcal':''}</span>
              <button class="icon-btn" onclick="deleteMeal(${i})">×</button>
            </div>`).join('')}
      <div class="inline-form">
        <div class="input-row">
          <input id="meal-time"  type="time"   class="input-field" style="width:100px"/>
          <input id="meal-desc"  type="text"   placeholder="What did you eat?" class="input-field"/>
        </div>
        <div class="input-row">
          <input id="meal-kcal"  type="number" placeholder="Calories (optional)" class="input-field" min="0"/>
          <button class="btn btn-primary" onclick="logMeal()">Add Meal</button>
        </div>
      </div>
    </section>

    <!-- Recent water history -->
    ${recentEntries.length ? `
    <section class="card">
      <div class="card-header"><h2>Water History</h2></div>
      ${recentEntries.map(n => {
        const pct = Math.min(((n.water_ml||0)/3000)*100, 100);
        return `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span class="sub-text">${formatDate(n.date)}</span>
              <span class="sub-text">${n.water_ml||0}ml</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill blue" style="width:${pct}%"></div>
            </div>
          </div>`;
      }).join('')}
    </section>` : ''}`;
}

function quickLogWater(ml) {
  const existing = DOS.data.health.nutrition.find(n => n.date === today());
  if (existing) { existing.water_ml = (existing.water_ml||0)+ml; }
  else { DOS.data.health.nutrition.push({ id:`nut-${Date.now()}`, date:today(), water_ml:ml, meals:[] }); }
  DOS.save('health');
  showToast(`+${ml}ml logged`, 'info');
  switchHealthTab('nutrition');
}

function customLogWater() {
  const ml = parseInt(document.getElementById('water-custom')?.value);
  if (!ml||ml<=0) { showToast('Enter a valid amount.','error'); return; }
  quickLogWater(ml);
}

function logMeal() {
  const desc = document.getElementById('meal-desc')?.value.trim();
  if (!desc) { showToast('Enter what you ate.','error'); return; }
  const time = document.getElementById('meal-time')?.value || new Date().toTimeString().slice(0,5);
  const kcal = parseInt(document.getElementById('meal-kcal')?.value) || 0;

  let entry = DOS.data.health.nutrition.find(n => n.date === today());
  if (!entry) {
    entry = { id:`nut-${Date.now()}`, date:today(), water_ml:0, meals:[] };
    DOS.data.health.nutrition.push(entry);
  }
  if (!entry.meals) entry.meals = [];
  entry.meals.push({ time, description: desc, calories: kcal||null });
  DOS.save('health');
  awardXP('health', 5, 'Meal logged');
  showToast('Meal logged +5 Health XP', 'info');
  switchHealthTab('nutrition');
}

function deleteMeal(index) {
  const entry = DOS.data.health.nutrition.find(n => n.date === today());
  if (!entry?.meals) return;
  entry.meals.splice(index, 1);
  DOS.save('health');
  switchHealthTab('nutrition');
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────

function buildHealthStatsHTML() {
  const exercises = [...new Set(
    DOS.data.health.workouts.flatMap(w => (w.lifts||[]).map(l => l.exercise))
  )].sort();
  if (!_liftFilter && exercises.length) _liftFilter = exercises[0];

  return `
    <section class="card">
      <div class="card-header">
        <h2>Body Weight</h2>
        <div class="chart-filter-btns">
          ${['1W','1M','3M','ALL'].map(f => `
            <button class="chart-filter-btn ${_weightFilter===f?'active':''}" onclick="setWeightFilter('${f}')">${f}</button>`).join('')}
        </div>
      </div>
      <div class="chart-wrap" style="height:200px"><canvas id="chart-weight"></canvas></div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Lift Progress</h2>
        ${exercises.length ? `
          <select class="input-field" style="width:auto;font-size:0.75rem;padding:4px 8px" onchange="setLiftFilter(this.value)">
            ${exercises.map(e => `<option value="${e}" ${e===_liftFilter?'selected':''}>${e}</option>`).join('')}
          </select>` : ''}
      </div>
      <div class="chart-wrap" style="height:200px"><canvas id="chart-lift-progress"></canvas></div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Workout Frequency</h2><span class="sub-text">Sessions / week</span></div>
      <div class="chart-wrap" style="height:180px"><canvas id="chart-wkt-freq"></canvas></div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Workout Split</h2></div>
      <div class="chart-wrap" style="height:200px"><canvas id="chart-wkt-split"></canvas></div>
    </section>`;
}

function setWeightFilter(f) {
  _weightFilter = f;
  if (_healthTab==='stats') { document.getElementById('health-tab-content').innerHTML = buildHealthStatsHTML(); requestAnimationFrame(()=>renderHealthCharts()); }
}

function setLiftFilter(exercise) {
  _liftFilter = exercise;
  if (_healthTab==='stats') { document.getElementById('health-tab-content').innerHTML = buildHealthStatsHTML(); requestAnimationFrame(()=>renderHealthCharts()); }
}

function renderHealthCharts() {
  renderWeightChart();
  renderLiftProgressChart();
  renderWorkoutFreqChart();
  renderWorkoutSplitChart();
}

function renderWeightChart() {
  const all    = (DOS.data.health.weight||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const now    = new Date();
  const cutoff = {'1W':new Date(now-7*86400000),'1M':new Date(now-30*86400000),'3M':new Date(now-90*86400000),'ALL':new Date(0)}[_weightFilter];
  const filtered = all.filter(w => new Date(w.date) >= cutoff);
  if (!filtered.length) {
    const c = document.getElementById('chart-weight');
    if (c) c.parentElement.innerHTML = '<p class="empty-state">No weight data for this period.</p>';
    return;
  }
  dosChart('chart-weight', {
    type: 'line',
    data: {
      labels: filtered.map(w => new Date(w.date).toLocaleDateString('en-ZA',{day:'numeric',month:'short'})),
      datasets: [{ label:'kg', data: filtered.map(w=>w.kg), borderColor:'#38a169', backgroundColor:'rgba(56,161,105,0.08)', borderWidth:2, pointRadius:4, pointBackgroundColor:'#38a169', fill:true, tension:0.3 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:dosScales({y:{beginAtZero:false}}) }
  });
}

function renderLiftProgressChart() {
  if (!_liftFilter) {
    const c = document.getElementById('chart-lift-progress');
    if (c) c.parentElement.innerHTML = '<p class="empty-state">Log workouts with lifts to track progress.</p>';
    return;
  }
  const points = [];
  DOS.data.health.workouts.filter(w=>w.lifts?.length).sort((a,b)=>a.date.localeCompare(b.date)).forEach(w => {
    const matching = w.lifts.filter(l=>l.exercise===_liftFilter);
    if (!matching.length) return;
    points.push({ date:w.date, weight_kg:Math.max(...matching.map(l=>l.weight_kg)) });
  });
  if (!points.length) {
    const c = document.getElementById('chart-lift-progress');
    if (c) c.parentElement.innerHTML = `<p class="empty-state">No ${_liftFilter} data yet.</p>`;
    return;
  }
  dosChart('chart-lift-progress', {
    type:'line',
    data:{
      labels: points.map(p=>new Date(p.date).toLocaleDateString('en-ZA',{day:'numeric',month:'short'})),
      datasets:[{ label:`${_liftFilter} (kg)`, data:points.map(p=>p.weight_kg), borderColor:'#cc1a1a', backgroundColor:'rgba(204,26,26,0.08)', borderWidth:2, pointRadius:5, pointBackgroundColor:'#cc1a1a', fill:true, tension:0.2 }]
    },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:dosScales({y:{beginAtZero:false}}) }
  });
}

function renderWorkoutFreqChart() {
  const now   = new Date();
  const weeks = [];
  for (let i=7;i>=0;i--) { const d=new Date(now-i*7*86400000); weeks.push(getISOWeek(d)); }
  const byWeek = {};
  weeks.forEach(w=>byWeek[w]=0);
  DOS.data.health.workouts.forEach(w => { const wk=getISOWeek(new Date(w.date)); if(byWeek[wk]!==undefined)byWeek[wk]++; });
  dosChart('chart-wkt-freq',{
    type:'bar',
    data:{ labels:weeks.map(w=>`W${w.split('-W')[1]}`), datasets:[{label:'Sessions',data:weeks.map(w=>byWeek[w]),backgroundColor:'rgba(59,130,246,0.6)',borderColor:'#3b82f6',borderWidth:1,borderRadius:3}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:dosScales({y:{ticks:{stepSize:1}}}) }
  });
}

function renderWorkoutSplitChart() {
  const counts = {};
  DOS.data.health.workouts.forEach(w => { const l=capitalize(w.type.replace('-',' ')); counts[l]=(counts[l]||0)+1; });
  const labels = Object.keys(counts);
  const data   = Object.values(counts);
  if (!labels.length) {
    const c = document.getElementById('chart-wkt-split');
    if (c) c.parentElement.innerHTML = '<p class="empty-state">Log workouts to see your split.</p>';
    return;
  }
  const COLORS=['#cc1a1a','#63b3ed','#f6ad55','#68d391','#b794f4','#f687b3'];
  dosChart('chart-wkt-split',{
    type:'doughnut',
    data:{ labels, datasets:[{data,backgroundColor:COLORS.slice(0,labels.length),borderWidth:2,borderColor:'#0a0a0a'}] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:dosLegend(), tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${ctx.raw} session${ctx.raw!==1?'s':''}`}} }
    }
  });
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil((((d-yearStart)/86400000)+1)/7)).padStart(2,'0')}`;
}
