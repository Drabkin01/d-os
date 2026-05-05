// ── Finances Module ───────────────────────────────────────────────────────────

let _finTab          = 'overview';
let _manageIncomeOpen = false;
let _manageFixedOpen  = false;
let _addGoalVisible   = false;
let _editGoalId       = null;

// ── Tab Router ────────────────────────────────────────────────────────────────

function renderFinances() {
  const container = document.getElementById('finances-content');
  if (!container) return;
  ensureGroceryWeek();
  container.innerHTML = buildStatAICard('finances') + `
    <nav class="fin-tabs">
      <button class="fin-tab" data-tab="overview"  onclick="switchFinTab('overview')">Overview</button>
      <button class="fin-tab" data-tab="grocery"   onclick="switchFinTab('grocery')">Grocery</button>
      <button class="fin-tab" data-tab="goals"     onclick="switchFinTab('goals')">Goals</button>
      <button class="fin-tab" data-tab="wishlist"  onclick="switchFinTab('wishlist')">Wishlist</button>
      <button class="fin-tab" data-tab="stats"     onclick="switchFinTab('stats')">Stats</button>
    </nav>
    <div id="fin-content"></div>`;
  switchFinTab(_finTab);
}

function switchFinTab(tab) {
  _finTab = tab;
  document.querySelectorAll('#finances-content .fin-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  const el = document.getElementById('fin-content');
  if (!el) return;
  switch (tab) {
    case 'overview':  el.innerHTML = buildOverviewHTML(); break;
    case 'grocery':   el.innerHTML = buildGroceryHTML();  break;
    case 'goals':     el.innerHTML = buildGoalsHTML();    break;
    case 'wishlist':  el.innerHTML = buildWishlistHTML(); break;
    case 'stats':
      el.innerHTML = buildFinStatsHTML();
      requestAnimationFrame(() => renderFinCharts());
      break;
  }
}

// ── Overview ──────────────────────────────────────────────────────────────────

function buildOverviewHTML() {
  const fin        = DOS.data.finances;
  const now        = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const weekStart  = getWeekStart();

  const totalIncome    = fin.income.reduce((s,i) => s+i.amount, 0);
  const recurring      = fin.recurringExpenses || [];
  const totalFixed     = recurring.reduce((s,r) => s+r.amount, 0);
  const discretionary  = totalIncome - totalFixed;

  const monthExp       = fin.expenses.filter(e => e.date >= monthStart);
  const monthSpent     = monthExp.reduce((s,e) => s+e.amount, 0);
  const weekSpent      = fin.expenses.filter(e => e.date >= weekStart).reduce((s,e) => s+e.amount, 0);
  const variableSpent  = monthExp.filter(e => !e.isFixed).reduce((s,e) => s+e.amount, 0);
  const remainingDisc  = discretionary - variableSpent;
  const discPct        = Math.min((variableSpent / Math.max(discretionary, 1)) * 100, 100);

  const fixedLoggedThisMonth = recurring.length > 0 && recurring.every(r =>
    fin.expenses.some(e => e.isFixed && e.recurringId === r.id && e.date >= monthStart)
  );

  const cats = {};
  monthExp.filter(e => !e.isFixed).forEach(e => { cats[e.category] = (cats[e.category]||0) + e.amount; });
  const catEntries = Object.entries(cats).sort((a,b) => b[1]-a[1]);

  const CAT_COLORS = {
    food:'#f6ad55', transport:'#63b3ed', subscriptions:'#b794f4',
    health:'#fc8181', fitness:'#fc8181', entertainment:'#f687b3', clothing:'#76e4f7',
    savings:'#68d391', groceries:'#48bb78', housing:'#f6ad55', personal:'#b794f4', other:'#718096'
  };

  return `
    <section class="card budget-reality-card accent-left">
      <div class="budget-reality-header">
        <div>
          <div class="balance-hero-label">Discretionary left</div>
          <div class="balance-hero-amount ${remainingDisc >= 0 ? 'positive' : 'negative'}">${formatZAR(remainingDisc)}</div>
        </div>
        <div class="balance-mini-stats">
          <div class="balance-mini"><span class="bm-label">Income</span><span class="bm-val income">${formatZAR(totalIncome)}</span></div>
          <div class="balance-mini"><span class="bm-label">Fixed</span><span class="bm-val expense">${formatZAR(totalFixed)}</span></div>
          <div class="balance-mini"><span class="bm-label">Free</span><span class="bm-val gold">${formatZAR(discretionary)}</span></div>
        </div>
      </div>

      <!-- INCOME -->
      <div class="fixed-expenses-list">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span class="section-label">Income</span>
          <button class="btn btn-sm" onclick="toggleManageIncome()">Manage</button>
        </div>
        ${fin.income.map(i => `
          <div class="fixed-exp-row">
            <span class="fixed-exp-name">${i.source}</span>
            <span class="bm-val income">${formatZAR(i.amount)}/mo</span>
          </div>`).join('')}
        <div id="manage-income-panel" class="${_manageIncomeOpen ? '' : 'hidden'} manage-panel">
          ${fin.income.map(i => `
            <div class="manage-row">
              <span class="manage-row-name">${i.source}</span>
              <div class="manage-row-actions">
                <span class="manage-row-amount income">${formatZAR(i.amount)}</span>
                <button class="btn btn-sm" onclick="editIncome('${i.id}')">Edit</button>
                <button class="icon-btn" onclick="deleteIncome('${i.id}')">×</button>
              </div>
            </div>`).join('')}
          <div class="input-row" style="margin-top:10px">
            <input id="new-income-source" type="text"   placeholder="Source (e.g. Freelance)" class="input-field"/>
            <input id="new-income-amount" type="number" placeholder="R/mo" class="input-field" min="0" style="width:110px"/>
          </div>
          <button class="btn btn-primary w-full" onclick="addIncome()">+ Add Income Source</button>
        </div>
      </div>

      <!-- FIXED COSTS -->
      <div class="fixed-expenses-list" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span class="section-label">Fixed Costs</span>
          <button class="btn btn-sm" onclick="toggleManageFixed()">Manage</button>
        </div>
        ${recurring.map(r => `
          <div class="fixed-exp-row">
            <span class="fixed-exp-name">${r.name}</span>
            <span class="fixed-exp-amount">${formatZAR(r.amount)}</span>
          </div>`).join('')}
        <div id="manage-fixed-panel" class="${_manageFixedOpen ? '' : 'hidden'} manage-panel">
          ${recurring.map(r => `
            <div class="manage-row">
              <span class="manage-row-name">${r.name}</span>
              <div class="manage-row-actions">
                <span class="manage-row-amount expense">${formatZAR(r.amount)}</span>
                <button class="btn btn-sm" onclick="editFixed('${r.id}')">Edit</button>
                <button class="icon-btn" onclick="deleteFixed('${r.id}')">×</button>
              </div>
            </div>`).join('')}
          <div class="input-row" style="margin-top:10px">
            <input id="new-fixed-name"   type="text"   placeholder="Name (e.g. Insurance)" class="input-field"/>
            <input id="new-fixed-amount" type="number" placeholder="R"                      class="input-field" min="0" style="width:90px"/>
          </div>
          <select id="new-fixed-cat" class="input-field">
            <option value="housing">Housing</option>
            <option value="transport">Transport</option>
            <option value="fitness">Fitness</option>
            <option value="subscriptions">Subscriptions</option>
            <option value="personal">Personal</option>
            <option value="other">Other</option>
          </select>
          <button class="btn btn-primary w-full" onclick="addFixed()">+ Add Fixed Cost</button>
        </div>
      </div>

      ${!fixedLoggedThisMonth ? `
        <button class="btn btn-outline w-full" style="margin-top:10px;font-size:0.8rem"
                onclick="logFixedExpenses()">📋 Log This Month's Fixed Expenses</button>` : `
        <div class="sub-text" style="margin-top:8px;font-size:0.72rem;color:var(--text-dim)">
          ✓ Fixed costs logged for ${now.toLocaleString('en-ZA',{month:'long'})}
        </div>`}
    </section>

    <section class="card" style="padding:14px 16px">
      <div class="balance-row" style="margin-bottom:8px">
        <span class="sub-text" style="font-size:0.75rem">Variable spend vs discretionary</span>
        <span class="sub-text">${formatZAR(variableSpent)} / ${formatZAR(discretionary)}</span>
      </div>
      <div class="spend-bar-track">
        <div class="spend-bar-fill ${discPct > 85 ? 'danger' : discPct > 65 ? 'warning' : 'safe'}"
             style="width:${discPct}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px">
        <span class="sub-text">${Math.round(discPct)}% used this month</span>
        <span class="sub-text">This week: ${formatZAR(weekSpent)}</span>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>Log Expense</h2></div>
      <div class="expense-form">
        <input id="exp-desc" type="text" placeholder="Description" class="input-field"/>
        <div class="input-row">
          <input id="exp-amount" type="number" placeholder="Amount (R)" class="input-field" min="0" step="0.01"/>
          <select id="exp-cat" class="input-field">
            <option value="food">Food</option>
            <option value="transport">Transport</option>
            <option value="subscriptions">Subscriptions</option>
            <option value="health">Health/Gym</option>
            <option value="entertainment">Entertainment</option>
            <option value="clothing">Clothing</option>
            <option value="savings">Savings</option>
            <option value="groceries">Groceries</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button class="btn btn-primary w-full" onclick="logExpense()">Add Expense</button>
      </div>
    </section>

    ${catEntries.length ? `
    <section class="card">
      <div class="card-header"><h2>By Category</h2><span class="sub-text">${now.toLocaleString('en-ZA',{month:'long'})}</span></div>
      <div class="cat-breakdown">
        ${catEntries.map(([cat, amt]) => {
          const pct = (amt / Math.max(totalIncome,1)) * 100;
          const color = CAT_COLORS[cat] || '#718096';
          return `
            <div class="cat-row">
              <span class="cat-dot" style="background:${color}"></span>
              <span class="cat-name">${capitalize(cat)}</span>
              <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width:${Math.min(pct,100)}%;background:${color}20;border-left:3px solid ${color}"></div>
              </div>
              <span class="cat-amount">${formatZAR(amt)}</span>
            </div>`;
        }).join('')}
      </div>
    </section>` : ''}

    <section class="card">
      <div class="card-header"><h2>Recent Expenses</h2></div>
      ${monthExp.length === 0
        ? '<p class="empty-state">No expenses logged this month.</p>'
        : [...monthExp].reverse().slice(0,15).map(e => `
            <div class="list-item">
              <span class="cat-dot" style="background:${CAT_COLORS[e.category]||'#718096'}"></span>
              <div class="list-item-grow">
                <div class="list-item-title">${e.description}</div>
                <div class="list-item-sub">${capitalize(e.category)} · ${formatDate(e.date)}</div>
              </div>
              <span class="expense-amount">${formatZAR(e.amount)}</span>
              <button class="icon-btn" onclick="deleteExpense(${e.id})" title="Delete">×</button>
            </div>`).join('')}
    </section>`;
}

function toggleManageIncome() {
  _manageIncomeOpen = !_manageIncomeOpen;
  document.getElementById('manage-income-panel')?.classList.toggle('hidden', !_manageIncomeOpen);
}

function toggleManageFixed() {
  _manageFixedOpen = !_manageFixedOpen;
  document.getElementById('manage-fixed-panel')?.classList.toggle('hidden', !_manageFixedOpen);
}

function addIncome() {
  const source = document.getElementById('new-income-source')?.value.trim();
  const amount = parseFloat(document.getElementById('new-income-amount')?.value);
  if (!source || !amount || isNaN(amount) || amount <= 0) { showToast('Enter source and amount.', 'error'); return; }
  DOS.data.finances.income.push({
    id: `inc-${Date.now()}`, source, amount,
    recurring: true, category: 'other', addedAt: new Date().toISOString()
  });
  DOS.save('finances');
  showToast(`${source} added (${formatZAR(amount)}/mo)`, 'gold');
  _manageIncomeOpen = true;
  switchFinTab('overview');
}

function editIncome(id) {
  const inc = DOS.data.finances.income.find(i => i.id === id);
  if (!inc) return;
  dosPrompt(`Edit "${inc.source}" amount`, 'Amount (R/mo)', inc.amount, val => {
    const amt = parseFloat(val);
    if (!isNaN(amt) && amt > 0) { inc.amount = amt; DOS.save('finances'); switchFinTab('overview'); }
  }, 'number');
}

function deleteIncome(id) {
  dosConfirm('Remove this income source?', () => {
    DOS.data.finances.income = DOS.data.finances.income.filter(i => i.id !== id);
    DOS.save('finances');
    _manageIncomeOpen = true;
    switchFinTab('overview');
  });
}

function addFixed() {
  const name   = document.getElementById('new-fixed-name')?.value.trim();
  const amount = parseFloat(document.getElementById('new-fixed-amount')?.value);
  const cat    = document.getElementById('new-fixed-cat')?.value || 'other';
  if (!name || !amount || isNaN(amount) || amount <= 0) { showToast('Enter name and amount.', 'error'); return; }
  if (!DOS.data.finances.recurringExpenses) DOS.data.finances.recurringExpenses = [];
  DOS.data.finances.recurringExpenses.push({ id: `re-${Date.now()}`, name, amount, category: cat, dueDay: 1 });
  DOS.save('finances');
  showToast(`${name} added as fixed cost`, 'gold');
  _manageFixedOpen = true;
  switchFinTab('overview');
}

function editFixed(id) {
  const rec = (DOS.data.finances.recurringExpenses || []).find(r => r.id === id);
  if (!rec) return;
  dosPrompt(`Edit "${rec.name}" amount`, 'Amount (R)', rec.amount, val => {
    const amt = parseFloat(val);
    if (!isNaN(amt) && amt > 0) { rec.amount = amt; DOS.save('finances'); switchFinTab('overview'); }
  }, 'number');
}

function deleteFixed(id) {
  dosConfirm('Remove this fixed cost?', () => {
    DOS.data.finances.recurringExpenses = (DOS.data.finances.recurringExpenses || []).filter(r => r.id !== id);
    DOS.save('finances');
    _manageFixedOpen = true;
    switchFinTab('overview');
  });
}

function logFixedExpenses() {
  const fin       = DOS.data.finances;
  const recurring = fin.recurringExpenses || [];
  const dateStr   = today();
  recurring.forEach(r => {
    fin.expenses.push({
      id: `fixed-${r.id}-${Date.now()}`,
      description: r.name, amount: r.amount,
      category: r.category, date: dateStr,
      isFixed: true, recurringId: r.id
    });
  });
  DOS.save('finances');
  const total = recurring.reduce((s,r) => s+r.amount, 0);
  awardXP('finances', 10, 'Monthly fixed expenses logged');
  showToast(`${formatZAR(total)} in fixed costs logged`, 'gold');
  switchFinTab('overview');
}

function deleteExpense(id) {
  DOS.data.finances.expenses = DOS.data.finances.expenses.filter(e => e.id !== id);
  DOS.save('finances');
  switchFinTab('overview');
}

function logExpense() {
  const desc     = document.getElementById('exp-desc')?.value.trim();
  const amount   = parseFloat(document.getElementById('exp-amount')?.value);
  const category = document.getElementById('exp-cat')?.value;
  if (!desc || !amount || isNaN(amount) || amount <= 0) { showToast('Fill in description and amount.', 'error'); return; }
  DOS.data.finances.expenses.push({ id: Date.now(), description: desc, amount, category, date: today() });
  DOS.save('finances');
  showToast(`Expense logged: ${formatZAR(amount)}`, 'info');
  switchFinTab('overview');
}

// ── Grocery ───────────────────────────────────────────────────────────────────

function ensureGroceryWeek() {
  const fin = DOS.data.finances;
  if (!fin.groceryList) {
    fin.groceryList = { template: defaultGroceryTemplate(), currentWeek: { weekId: '', items: [], completed: false, total: 0 } };
  }
  const weekId = getISOWeek(new Date());
  if (fin.groceryList.currentWeek.weekId !== weekId) {
    fin.groceryList.currentWeek = {
      weekId, completed: false, total: 0,
      items: fin.groceryList.template.map(t => ({ ...t, checked: false }))
    };
    DOS.save('finances');
  }
}

function defaultGroceryTemplate() {
  return [
    { id: 'gt-1', name: 'Chicken breast',  qty: '1kg',  price: 80,  category: 'protein' },
    { id: 'gt-2', name: 'Eggs',            qty: '18',   price: 55,  category: 'protein' },
    { id: 'gt-3', name: 'Rice',            qty: '2kg',  price: 40,  category: 'carbs'   },
    { id: 'gt-4', name: 'Oats',            qty: '1kg',  price: 32,  category: 'carbs'   },
    { id: 'gt-5', name: 'Broccoli',        qty: '500g', price: 28,  category: 'veggies' },
    { id: 'gt-6', name: 'Sweet potato',    qty: '1kg',  price: 22,  category: 'veggies' },
    { id: 'gt-7', name: 'Milk',            qty: '2L',   price: 38,  category: 'dairy'   },
    { id: 'gt-8', name: 'Greek yoghurt',   qty: '500g', price: 52,  category: 'dairy'   },
    { id: 'gt-9', name: 'Peanut butter',   qty: '400g', price: 45,  category: 'fats'    },
  ];
}

function buildGroceryHTML() {
  const grocery = DOS.data.finances.groceryList;
  const week    = grocery.currentWeek;
  const items   = week.items;

  const checked     = items.filter(i => i.checked);
  const runningTotal = checked.reduce((s,i) => s+(i.price||0), 0);
  const fullTotal    = items.reduce((s,i) => s+(i.price||0), 0);

  const CAT_ORDER = ['protein','carbs','veggies','dairy','fats','snacks','other'];
  const grouped = {};
  items.forEach(i => { const c = i.category||'other'; if (!grouped[c]) grouped[c] = []; grouped[c].push(i); });
  const catEmoji = { protein:'🥩', carbs:'🌾', veggies:'🥦', dairy:'🥛', fats:'🥑', snacks:'🍎', other:'🛒' };

  return `
    <section class="card grocery-header-card">
      <div class="grocery-week-label">Week ${week.weekId?.split('-W')[1] || '?'} ${week.completed ? '· ✓ Done' : ''}</div>
      <div class="grocery-totals">
        <div class="grocery-total-item"><span class="gt-label">Basket</span><span class="gt-val">${formatZAR(runningTotal)}</span></div>
        <div class="grocery-total-item"><span class="gt-label">Est. total</span><span class="gt-val dim">${formatZAR(fullTotal)}</span></div>
        <div class="grocery-total-item"><span class="gt-label">Items</span><span class="gt-val">${checked.length}/${items.length}</span></div>
      </div>
      <div class="grocery-actions">
        ${!week.completed
          ? `<button class="btn btn-primary" onclick="completeGroceryShop()">Complete → Log ${formatZAR(runningTotal)}</button>`
          : `<button class="btn btn-outline" onclick="resetGroceryShop()">Reset for New Shop</button>`}
        <button class="btn btn-outline" onclick="showGroceryEditor()">Edit List</button>
      </div>
    </section>

    <section class="card" id="grocery-list-card">
      ${CAT_ORDER.filter(c => grouped[c]?.length).map(cat => `
        <div class="grocery-category">
          <div class="grocery-cat-header">${catEmoji[cat]||'🛒'} ${capitalize(cat)}</div>
          ${grouped[cat].map(item => `
            <label class="grocery-item ${item.checked ? 'checked' : ''}" onclick="toggleGroceryItem('${item.id}')">
              <span class="grocery-checkbox">${item.checked ? '✓' : ''}</span>
              <span class="grocery-item-name">${item.name}</span>
              <span class="grocery-item-meta">${item.qty}</span>
              <span class="grocery-item-price">${formatZAR(item.price||0)}</span>
            </label>`).join('')}
        </div>`).join('')}
    </section>

    <div id="grocery-editor" class="card hidden">
      <div class="card-header"><h2>Add Item</h2><span class="card-action" onclick="document.getElementById('grocery-editor').classList.add('hidden')">✕</span></div>
      <input id="groc-name"  type="text"   placeholder="Item name"       class="input-field"/>
      <div class="input-row">
        <input id="groc-qty"   type="text"   placeholder="Qty (e.g. 1kg)" class="input-field"/>
        <input id="groc-price" type="number" placeholder="Est. price (R)" class="input-field" min="0"/>
      </div>
      <select id="groc-cat" class="input-field">
        <option value="protein">Protein</option>
        <option value="carbs">Carbs</option>
        <option value="veggies">Veggies</option>
        <option value="dairy">Dairy</option>
        <option value="fats">Fats/Nuts</option>
        <option value="snacks">Snacks/Fruit</option>
        <option value="other">Other</option>
      </select>
      <button class="btn btn-primary w-full" onclick="addGroceryItem()">Add to List</button>
    </div>`;
}

function showGroceryEditor() { document.getElementById('grocery-editor')?.classList.toggle('hidden'); }

function toggleGroceryItem(id) {
  const item = DOS.data.finances.groceryList.currentWeek.items.find(i => i.id === id);
  if (item) { item.checked = !item.checked; DOS.save('finances'); }
  switchFinTab('grocery');
}

function addGroceryItem() {
  const name  = document.getElementById('groc-name')?.value.trim();
  const qty   = document.getElementById('groc-qty')?.value.trim();
  const price = parseFloat(document.getElementById('groc-price')?.value) || 0;
  const cat   = document.getElementById('groc-cat')?.value || 'other';
  if (!name) return showToast('Item name required', 'error');
  const newItem = { id: `g-${Date.now()}`, name, qty, price, category: cat };
  const grocery = DOS.data.finances.groceryList;
  grocery.template.push(newItem);
  grocery.currentWeek.items.push({ ...newItem, checked: false });
  DOS.save('finances');
  switchFinTab('grocery');
}

function completeGroceryShop() {
  const week = DOS.data.finances.groceryList.currentWeek;
  const done = week.items.filter(i => i.checked);
  if (!done.length) { showToast('Tick some items first.', 'error'); return; }
  const total = done.reduce((s,i) => s+(i.price||0), 0);
  DOS.data.finances.expenses.push({
    id: Date.now(), description: `Grocery shop (${done.length} items)`,
    amount: total, category: 'groceries', date: today()
  });
  week.completed = true;
  week.total = total;
  DOS.save('finances');
  awardXP('finances', 15, 'Weekly grocery shop completed');
  showToast(`${formatZAR(total)} logged as groceries`, 'gold');
  switchFinTab('grocery');
}

function resetGroceryShop() {
  const week = DOS.data.finances.groceryList.currentWeek;
  week.items.forEach(i => i.checked = false);
  week.completed = false;
  DOS.save('finances');
  switchFinTab('grocery');
}

// ── Goals ─────────────────────────────────────────────────────────────────────

function buildGoalsHTML() {
  const fin = DOS.data.finances;
  if (!fin.savingsGoals) fin.savingsGoals = [];

  // Ensure emergency fund exists
  if (!fin.savingsGoals.find(g => g.id === 'sg-emergency')) {
    fin.savingsGoals.unshift({ id: 'sg-emergency', name: 'Emergency Fund', emoji: '🛡️', target: 50000, current: 0, monthlyTarget: 1000, color: 'gold', locked: true, history: [] });
  }

  const totalSaved  = fin.savingsGoals.reduce((s,g) => s+g.current, 0);
  const totalTarget = fin.savingsGoals.reduce((s,g) => s+g.target, 0);
  const efGoal      = fin.savingsGoals.find(g => g.id === 'sg-emergency');

  return `
    <section class="card">
      <div class="goals-summary">
        <div class="goals-summary-item"><span class="gs-label">Total saved</span><span class="gs-val gold">${formatZAR(totalSaved)}</span></div>
        <div class="goals-summary-item"><span class="gs-label">Total target</span><span class="gs-val">${formatZAR(totalTarget)}</span></div>
      </div>
    </section>

    ${efGoal ? buildEmergencyFundCard(efGoal) : ''}

    ${fin.savingsGoals.filter(g => g.id !== 'sg-emergency').map(g => buildGoalCard(g)).join('')}

    <div id="add-goal-form" class="${_addGoalVisible ? '' : 'hidden'}">
      <section class="card">
        <div class="card-header"><h2>New Goal</h2><span class="card-action" onclick="toggleAddGoal()">✕</span></div>
        <input id="new-goal-name"    type="text"   placeholder="Goal name (e.g. New PC)"    class="input-field"/>
        <div class="input-row">
          <input id="new-goal-emoji"   type="text"   placeholder="Emoji" class="input-field" style="width:70px" maxlength="2"/>
          <input id="new-goal-target"  type="number" placeholder="Target (R)"               class="input-field"/>
        </div>
        <input id="new-goal-monthly" type="number" placeholder="Monthly contribution (R)"   class="input-field"/>
        <button class="btn btn-primary w-full" onclick="saveNewGoal()">Add Goal</button>
      </section>
    </div>

    <button class="btn btn-outline w-full" onclick="toggleAddGoal()"
            style="${_addGoalVisible ? 'display:none' : ''}">+ Add Goal</button>`;
}

function buildEmergencyFundCard(g) {
  const pct       = Math.min((g.current / g.target) * 100, 100);
  const remaining = Math.max(g.target - g.current, 0);
  return `
    <section class="card goal-card accent-left">
      <div class="goal-header">
        <span class="goal-emoji">${g.emoji}</span>
        <div class="goal-title-block">
          <div class="goal-name">${g.name}</div>
          <div class="goal-sub">${formatZAR(g.monthlyTarget)}/month target</div>
        </div>
        <div class="goal-amounts">
          <div class="goal-current">${formatZAR(g.current)}</div>
          <div class="goal-target sub-text">of ${formatZAR(g.target)}</div>
        </div>
      </div>
      <div class="progress-bar-track mt-8">
        <div class="progress-bar-fill gold" style="width:${pct}%"></div>
      </div>
      <div class="goal-pct-row">
        <span class="sub-text">${pct.toFixed(1)}%</span>
        <span class="sub-text">${formatZAR(remaining)} to go</span>
      </div>
      <div class="goal-actions">
        <button class="btn btn-outline btn-sm" onclick="addToGoal('sg-emergency')">+ Add Funds</button>
      </div>
    </section>`;
}

function buildGoalCard(g) {
  const pct        = Math.min((g.current / g.target) * 100, 100);
  const remaining  = Math.max(g.target - g.current, 0);
  const monthsLeft = g.monthlyTarget > 0 ? Math.ceil(remaining / g.monthlyTarget) : '?';
  const isEditing  = _editGoalId === g.id;

  return `
    <section class="card goal-card">
      <div class="goal-header">
        <span class="goal-emoji">${g.emoji}</span>
        <div class="goal-title-block">
          <div class="goal-name">${g.name}</div>
          <div class="goal-sub">${formatZAR(g.monthlyTarget)}/month · ~${monthsLeft} months</div>
        </div>
        <div class="goal-amounts">
          <div class="goal-current">${formatZAR(g.current)}</div>
          <div class="goal-target sub-text">of ${formatZAR(g.target)}</div>
        </div>
      </div>
      <div class="progress-bar-track mt-8">
        <div class="progress-bar-fill ${g.color||'gold'}" style="width:${pct}%"></div>
      </div>
      <div class="goal-pct-row">
        <span class="sub-text">${pct.toFixed(1)}%</span>
        <span class="sub-text">${formatZAR(remaining)} to go</span>
      </div>
      <div class="goal-actions">
        <button class="btn btn-outline btn-sm" onclick="addToGoal('${g.id}')">+ Funds</button>
        <button class="btn btn-outline btn-sm" onclick="toggleEditGoal('${g.id}')">${isEditing ? 'Cancel' : 'Edit'}</button>
        ${!g.locked ? `<button class="icon-btn" onclick="deleteGoal('${g.id}')">×</button>` : ''}
      </div>
      <div id="edit-goal-${g.id}" class="${isEditing ? 'inline-form' : 'hidden'}">
        <input id="edit-target-${g.id}"  type="number" placeholder="New target (R)"    class="input-field" value="${g.target}"/>
        <input id="edit-monthly-${g.id}" type="number" placeholder="Monthly (R)"        class="input-field" value="${g.monthlyTarget}"/>
        <button class="btn btn-primary w-full" onclick="saveEditGoal('${g.id}')">Save Changes</button>
      </div>
    </section>`;
}

function toggleAddGoal() {
  _addGoalVisible = !_addGoalVisible;
  switchFinTab('goals');
}

function saveNewGoal() {
  const name    = document.getElementById('new-goal-name')?.value.trim();
  const emoji   = document.getElementById('new-goal-emoji')?.value.trim() || '🎯';
  const target  = parseFloat(document.getElementById('new-goal-target')?.value);
  const monthly = parseFloat(document.getElementById('new-goal-monthly')?.value) || 0;
  if (!name || !target || isNaN(target) || target <= 0) { showToast('Enter name and target amount.', 'error'); return; }
  DOS.data.finances.savingsGoals.push({
    id: `sg-${Date.now()}`, name, emoji, target, current: 0,
    monthlyTarget: monthly, color: 'gold', locked: false, history: []
  });
  DOS.save('finances');
  _addGoalVisible = false;
  switchFinTab('goals');
}

function addToGoal(id) {
  const goal = DOS.data.finances.savingsGoals.find(g => g.id === id);
  if (!goal) return;
  dosPrompt(`Add to "${goal.name}"`, 'Amount (R)', '', val => {
    const amt = parseFloat(val);
    if (!amt || isNaN(amt) || amt <= 0) { showToast('Enter a valid amount.', 'error'); return; }
    goal.current += amt;
    DOS.data.finances.expenses.push({
      id: Date.now(), description: `${goal.name} contribution`,
      amount: amt, category: 'savings', date: today()
    });
    DOS.save('finances');
    awardXP('finances', 20, `Savings: ${goal.name}`);
    showToast(`${formatZAR(amt)} added to ${goal.name}`, 'gold');
    switchFinTab('goals');
  }, 'number');
}

function toggleEditGoal(id) {
  _editGoalId = _editGoalId === id ? null : id;
  switchFinTab('goals');
}

function saveEditGoal(id) {
  const goal    = DOS.data.finances.savingsGoals.find(g => g.id === id);
  if (!goal) return;
  const target  = parseFloat(document.getElementById(`edit-target-${id}`)?.value);
  const monthly = parseFloat(document.getElementById(`edit-monthly-${id}`)?.value);
  if (!isNaN(target) && target > 0)   goal.target        = target;
  if (!isNaN(monthly) && monthly >= 0) goal.monthlyTarget = monthly;
  DOS.save('finances');
  _editGoalId = null;
  showToast('Goal updated.', 'gold');
  switchFinTab('goals');
}

function deleteGoal(id) {
  const goal = DOS.data.finances.savingsGoals.find(g => g.id === id);
  dosConfirm(`Delete "${goal?.name || 'this goal'}"?`, () => {
    DOS.data.finances.savingsGoals = DOS.data.finances.savingsGoals.filter(g => g.id !== id);
    DOS.save('finances');
    switchFinTab('goals');
  });
}

// ── Wishlist ──────────────────────────────────────────────────────────────────

const STORES = {
  'takealot.com':   { name: 'Takealot',  color: '#0077cc' },
  'amazon.com':     { name: 'Amazon',    color: '#ff9900' },
  'amazon.co.za':   { name: 'Amazon ZA', color: '#ff9900' },
  'game.co.za':     { name: 'Game',      color: '#e60000' },
  'makro.co.za':    { name: 'Makro',     color: '#0033a0' },
  'wootware.co.za': { name: 'Wootware',  color: '#e63900' },
  'evetech.co.za':  { name: 'Evetech',   color: '#00aacc' },
  'apple.com':      { name: 'Apple',     color: '#555'    },
  'loot.co.za':     { name: 'Loot',      color: '#cc0000' },
};

function detectStore(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace('www.','');
    for (const [domain, info] of Object.entries(STORES)) {
      if (host.includes(domain)) return info;
    }
    return { name: host, color: '#666' };
  } catch { return null; }
}

function buildWishlistHTML() {
  const fin = DOS.data.finances;
  if (!fin.wishlist) fin.wishlist = [];

  const pending  = fin.wishlist.filter(i => !i.purchased);
  const bought   = fin.wishlist.filter(i => i.purchased);
  const totalWant = pending.reduce((s,i) => s+(i.price||0), 0);

  const PRIORITY_LABELS = { 1: 'High', 2: 'Medium', 3: 'Low' };
  const PRIORITY_COLORS = { 1: 'var(--negative)', 2: 'var(--gold)', 3: 'var(--text-dim)' };

  const renderItem = item => {
    const store = detectStore(item.link);
    return `
      <div class="wishlist-card ${item.purchased ? 'purchased' : ''}">
        <div class="wl-header">
          <div class="wl-title-block">
            <div class="wl-name">${item.name}</div>
            ${store ? `<span class="wl-store-badge" style="background:${store.color}22;color:${store.color};border-color:${store.color}44">${store.name}</span>` : ''}
          </div>
          <div class="wl-price">${formatZAR(item.price||0)}</div>
        </div>
        ${item.notes ? `<div class="wl-notes">${item.notes}</div>` : ''}
        <div class="wl-footer">
          <span class="wl-priority" style="color:${PRIORITY_COLORS[item.priority]||PRIORITY_COLORS[3]}">${PRIORITY_LABELS[item.priority]||'Low'}</span>
          <div class="wl-actions">
            ${item.link ? `<a href="${item.link}" target="_blank" rel="noopener" class="btn btn-sm wl-link-btn">View →</a>` : ''}
            ${!item.purchased ? `<button class="btn btn-sm" onclick="markWishlistPurchased('${item.id}')">✓ Got it</button>` : ''}
            <button class="icon-btn" onclick="deleteWishlistItem('${item.id}')">×</button>
          </div>
        </div>
      </div>`;
  };

  return `
    ${pending.length ? `
    <section class="card">
      <div class="card-header"><h2>Save Up For</h2><span class="sub-text">${formatZAR(totalWant)} total</span></div>
      ${pending.sort((a,b) => a.priority-b.priority).map(renderItem).join('')}
    </section>` : ''}

    <button class="btn btn-primary w-full" onclick="showWishlistForm()">+ Add Item</button>

    <div id="wishlist-form" class="card hidden mt-8">
      <div class="card-header"><h2>New Item</h2><span class="card-action" onclick="document.getElementById('wishlist-form').classList.add('hidden')">✕</span></div>
      <input id="wl-name"     type="text"   placeholder="Item name"                     class="input-field"/>
      <input id="wl-price"    type="number" placeholder="Price (R)"                     class="input-field" min="0"/>
      <input id="wl-url"      type="url"    placeholder="Product link (optional)"        class="input-field" oninput="previewStore(this.value)"/>
      <div id="wl-store-preview" class="wl-store-preview hidden"></div>
      <select id="wl-priority" class="input-field">
        <option value="1">High priority</option>
        <option value="2" selected>Medium priority</option>
        <option value="3">Low priority</option>
      </select>
      <input id="wl-notes" type="text" placeholder="Notes (optional)" class="input-field"/>
      <button class="btn btn-primary w-full" onclick="addWishlistItem()">Add to Wishlist</button>
    </div>

    ${bought.length ? `
    <section class="card mt-8">
      <div class="card-header"><h2>Purchased</h2></div>
      ${bought.map(renderItem).join('')}
    </section>` : ''}`;
}

function showWishlistForm() { document.getElementById('wishlist-form')?.classList.toggle('hidden'); }

function previewStore(url) {
  const preview = document.getElementById('wl-store-preview');
  if (!preview) return;
  const store = detectStore(url);
  if (store && url) { preview.innerHTML = `<span style="color:${store.color}">Detected: ${store.name}</span>`; preview.classList.remove('hidden'); }
  else preview.classList.add('hidden');
}

function addWishlistItem() {
  const name     = document.getElementById('wl-name')?.value.trim();
  const price    = parseFloat(document.getElementById('wl-price')?.value) || 0;
  const link     = document.getElementById('wl-url')?.value.trim();
  const priority = parseInt(document.getElementById('wl-priority')?.value) || 2;
  const notes    = document.getElementById('wl-notes')?.value.trim();
  if (!name) { showToast('Item name required', 'error'); return; }
  const store = detectStore(link);
  if (!DOS.data.finances.wishlist) DOS.data.finances.wishlist = [];
  DOS.data.finances.wishlist.push({
    id: `wl-${Date.now()}`, name, price, link, priority, notes,
    store: store?.name || null, purchased: false, addedDate: today()
  });
  DOS.save('finances');
  showToast(`${name} added`, 'info');
  switchFinTab('wishlist');
}

function markWishlistPurchased(id) {
  const item = DOS.data.finances.wishlist.find(i => i.id === id);
  if (!item) return;
  item.purchased = true;
  item.purchasedDate = today();
  if (item.price) {
    DOS.data.finances.expenses.push({ id: Date.now(), description: item.name, amount: item.price, category: 'other', date: today() });
  }
  DOS.save('finances');
  showToast(`${item.name} marked as purchased`, 'gold');
  switchFinTab('wishlist');
}

function deleteWishlistItem(id) {
  dosConfirm('Remove from wishlist?', () => {
    DOS.data.finances.wishlist = DOS.data.finances.wishlist.filter(i => i.id !== id);
    DOS.save('finances');
    switchFinTab('wishlist');
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function buildFinStatsHTML() {
  const fin        = DOS.data.finances;
  const totalIncome = fin.income.reduce((s,i) => s+i.amount, 0);
  const totalSaved  = fin.savingsGoals.reduce((s,g) => s+g.current, 0);
  return `
    <section class="card">
      <div class="card-header"><h2>Monthly Spend</h2><span class="sub-text">vs Income · last 6 months</span></div>
      <div class="chart-wrap" style="height:200px"><canvas id="chart-monthly-spend"></canvas></div>
    </section>
    <section class="card">
      <div class="card-header"><h2>Category Breakdown</h2><span class="sub-text">This month</span></div>
      <div class="chart-wrap" style="height:220px"><canvas id="chart-cat-donut"></canvas></div>
    </section>
    <section class="card">
      <div class="card-header"><h2>Snapshot</h2></div>
      <div class="balance-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="balance-item"><span class="balance-label">Income</span><span class="balance-amount income" style="font-size:14px">${formatZAR(totalIncome)}</span></div>
        <div class="balance-item"><span class="balance-label">Saved</span><span class="balance-amount gold" style="font-size:14px">${formatZAR(totalSaved)}</span></div>
        <div class="balance-item"><span class="balance-label">Expenses</span><span class="balance-amount expense" style="font-size:14px">${fin.expenses.length}</span></div>
      </div>
    </section>`;
}

function renderFinCharts() {
  renderMonthlySpendChart();
  renderCategoryDonutChart();
}

function renderMonthlySpendChart() {
  const fin    = DOS.data.finances;
  const income = fin.income.reduce((s,i) => s+i.amount, 0);
  const now    = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({
      label:  d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' }),
      prefix: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    });
  }
  const spendByMonth = months.map(m => fin.expenses.filter(e => e.date?.startsWith(m.prefix)).reduce((s,e) => s+e.amount, 0));
  dosChart('chart-monthly-spend', {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Spent', data: spendByMonth, backgroundColor: 'rgba(204,26,26,0.5)', borderColor: '#cc1a1a', borderWidth: 1, borderRadius: 3, order: 2 },
        { label: 'Income', data: months.map(() => income), type: 'line', borderColor: '#38a169', borderWidth: 2, pointRadius: 0, fill: false, tension: 0, order: 1 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: dosLegend() }, scales: dosScales() }
  });
}

function renderCategoryDonutChart() {
  const fin = DOS.data.finances;
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const cats = {};
  fin.expenses.filter(e => e.date?.startsWith(prefix)).forEach(e => { cats[e.category] = (cats[e.category]||0)+e.amount; });
  const labels = Object.keys(cats);
  const data   = Object.values(cats);
  if (!labels.length) {
    const c = document.getElementById('chart-cat-donut');
    if (c) c.parentElement.innerHTML = '<p class="empty-state">No expenses this month.</p>';
    return;
  }
  const CAT_COLORS = { food:'#f6ad55', transport:'#63b3ed', subscriptions:'#b794f4', health:'#fc8181', entertainment:'#f687b3', clothing:'#76e4f7', savings:'#68d391', groceries:'#48bb78', other:'#718096' };
  const colors = labels.map(l => CAT_COLORS[l]||'#718096');
  dosChart('chart-cat-donut', {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c+'cc'), borderColor: colors, borderWidth: 2, hoverBorderColor: '#0a0a0a' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: dosLegend(),
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: R${ctx.raw.toLocaleString('en-ZA',{minimumFractionDigits:2})}` } }
      }
    }
  });
}

