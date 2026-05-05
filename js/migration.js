// D-OS Data Migration — v2 schema upgrade
// Safe merge: adds missing fields, never overwrites real data.

const DOS_MIGRATION = {

  run() {
    console.log('[D-OS Migration] Starting schema v2 upgrade...');
    this.migrateCharacter();
    this.migrateHealth();
    this.migrateFinances();
    this.migrateIntelligence();
    this.migrateWork();
    console.log('[D-OS Migration] Complete.');
  },

  _get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },

  _set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  migrateCharacter() {
    const existing = this._get('dos_character') || {};
    const seed = DOS_SEEDS.character;
    const merged = {
      ...seed,
      ...existing,
      stats:         existing.stats         || seed.stats,
      xpHistory:     existing.xpHistory     || [],
      unlockedItems: existing.unlockedItems || [],
      dailyStreak:   existing.dailyStreak   || { count: 0, lastDate: null }
    };
    this._set('dos_character', merged);
  },

  migrateHealth() {
    const existing = this._get('dos_health') || {};
    const merged = {
      workouts:   existing.workouts   || [],
      weight:     existing.weight     || [],
      bodyWeight: existing.bodyWeight || [],
      nutrition:  existing.nutrition  || []
    };
    this._set('dos_health', merged);
  },

  migrateFinances() {
    const existing = this._get('dos_finances') || {};
    const seed = DOS_SEEDS.finances;

    // Preserve existing income, merge in addedAt if missing
    const income = (existing.income || seed.income).map(inc => ({
      ...inc,
      addedAt: inc.addedAt || new Date().toISOString()
    }));

    // Merge savings goals — preserve current balances, add history if missing
    const seedGoalsById = Object.fromEntries(seed.savingsGoals.map(g => [g.id, g]));
    const existingGoals = existing.savingsGoals || seed.savingsGoals;
    const savingsGoals = existingGoals.map(g => ({
      ...(seedGoalsById[g.id] || {}),
      ...g,
      history: g.history || []
    }));

    // Ensure Russia 2027 trip savings goal exists
    if (!savingsGoals.find(g => g.id === 'sg-russia')) {
      savingsGoals.push({
        id: 'sg-russia', name: 'Russia 2027 Trip', emoji: '🇷🇺',
        target: 73000, current: 0, monthlyTarget: 3000,
        color: 'blue', locked: false, history: []
      });
    }

    // Seed recurring fixed expenses if not already set
    const defaultRecurring = [
      { id: 're-rent',     name: 'Rent',                    amount: 10000, category: 'housing',       dueDay: 1 },
      { id: 're-fuel',     name: 'Fuel',                    amount: 600,   category: 'transport',     dueDay: 1 },
      { id: 're-training', name: 'Training (CrossFit/BJJ/MT)', amount: 1300, category: 'fitness',    dueDay: 1 },
      { id: 're-wifi',     name: 'Wifi',                    amount: 479,   category: 'subscriptions', dueDay: 1 },
      { id: 're-hair',     name: 'Hair',                    amount: 430,   category: 'personal',      dueDay: 1 }
    ];
    const recurringExpenses = existing.recurringExpenses || defaultRecurring;

    const merged = {
      income,
      expenses:           existing.expenses    || [],
      groceryList:        existing.groceryList || seed.groceryList,
      savingsGoals,
      wishlist:           existing.wishlist    || [],
      recurringExpenses
    };
    this._set('dos_finances', merged);
  },

  migrateIntelligence() {
    const existing = this._get('dos_intelligence') || {};
    const seed = DOS_SEEDS.intelligence;

    const certifications = existing.certifications || seed.certifications;
    // Set CCP exam deadline if not already set
    const ccp = certifications.find(c => c.id === 'cert-aws-cp');
    if (ccp && !ccp.targetDate) ccp.targetDate = '2026-05-31';

    // Migrate legacy notes → knowledgeNotes if present
    const legacyNotes = (existing.notes || []).map(n => ({
      id: `kn-${n.id || Date.now()}`,
      date: n.date ? new Date(n.date).toISOString() : new Date().toISOString(),
      title: n.topic || '',
      content: n.body || '',
      tags: [n.topic || ''],
      xpEarned: 10
    }));
    const knowledgeNotes = existing.knowledgeNotes?.length
      ? existing.knowledgeNotes
      : legacyNotes;

    // Russian language tracker — preserve existing, seed if absent
    const russian = existing.russian || {
      streakDays: 0,
      lastStudyDate: null,
      vocabCount: 0,
      weeklyGoalMinutes: 60,
      studySessions: []
    };

    const merged = {
      certifications,
      books:          existing.books || [],
      knowledgeNotes,
      russian
    };
    this._set('dos_intelligence', merged);
  },

  migrateWork() {
    const existing = this._get('dos_work') || {};
    const seed = DOS_SEEDS.work;
    const projects = (existing.projects || seed.projects).map(p => ({
      timeLogged: 0, desc: '', ...p
    }));
    const defaultEmailRules = [
      { id: 'er-truid',  name: 'truID emails',  type: 'domain',  value: 'truid.co',      lane: 'truid', priority: 'medium', enabled: true  },
      { id: 'er-alerts', name: 'System alerts',  type: 'subject', value: 'alert',          lane: 'truid', priority: 'high',   enabled: false },
      { id: 'er-errors', name: 'Error reports',  type: 'subject', value: 'error',          lane: 'truid', priority: 'high',   enabled: false },
    ];
    const merged = {
      projects,
      tickets:           existing.tickets           || [],
      emailRules:        existing.emailRules        || defaultEmailRules,
      processedEmailIds: existing.processedEmailIds || []
    };
    this._set('dos_work', merged);
  }

};
