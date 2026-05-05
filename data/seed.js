// D-OS Seed Data — Flutter-ready schema v2
// All entries use ISO 8601 timestamps. All arrays start empty (real data only).

const DOS_SEEDS = {

  character: {
    name: "Skulduggery Pleasant",
    archetype: "Skeleton Detective",
    tier: 0,
    stats: {
      health:       { level: 1, xp: 0 },
      finances:     { level: 1, xp: 0 },
      intelligence: { level: 1, xp: 0 },
      work:         { level: 1, xp: 0 }
    },
    unlockedItems: [],
    xpHistory: [],          // { id, date (ISO), stat, amount, reason }
    dailyStreak: { count: 0, lastDate: null },
    createdAt: "2026-04-21T04:17:00.816Z"
  },

  health: {
    workouts: [],
    // { id, date (ISO), type: crossfit|bjj|muay_thai|gym|run|other,
    //   duration_minutes, intensity: high|medium|low,
    //   lifts: [{ exercise, sets: [{ reps, weight_kg }] }],
    //   notes, xpEarned }

    weight: [],
    // { id, date (YYYY-MM-DD), kg }

    bodyWeight: [],
    // { id, date (ISO), weight_kg }

    nutrition: []
    // { id, date (ISO date only), water_ml,
    //   meals: [{ time (HH:MM), description, calories }] }
  },

  finances: {
    income: [
      { id: "inc-1", source: "truID Salary",   amount: 16200,
        recurring: true, category: "salary",
        addedAt: "2026-04-21T00:00:00Z" },
      { id: "inc-2", source: "Family Support", amount: 3000,
        recurring: true, category: "family",
        addedAt: "2026-04-21T00:00:00Z" }
    ],

    expenses: [],
    // { id, date (ISO), amount, category: food|transport|fitness|
    //   subscriptions|entertainment|clothing|medical|other,
    //   description, merchant }

    groceryList: {
      template: [],
      currentWeek: {
        weekId: "2026-W17",
        items: [],
        completed: false,
        total: 0
      }
    },

    savingsGoals: [
      { id: "sg-emergency", name: "Emergency Fund",  emoji: "🛡️",
        target: 50000, current: 0, monthlyTarget: 1000,
        color: "gold",  locked: true,  history: [] },
      { id: "sg-holiday",   name: "Holiday Fund",    emoji: "✈️",
        target: 20000, current: 0, monthlyTarget: 500,
        color: "blue",  locked: false, history: [] },
      { id: "sg-gym",       name: "Gym Equipment",   emoji: "🏋️",
        target: 8000,  current: 0, monthlyTarget: 400,
        color: "red",   locked: false, history: [] },
      { id: "sg-tech",      name: "Tech Gear",       emoji: "💻",
        target: 15000, current: 0, monthlyTarget: 600,
        color: "blue",  locked: false, history: [] }
    ],
    // savingsGoals[].history: [{ id, date (ISO), amount, balance_after, note }]

    wishlist: []
    // { id, addedAt (ISO), name, price, url, priority: high|medium|low,
    //   purchased: false, purchasedAt: null }
  },

  intelligence: {
    certifications: [
      { id: "cert-aws-cp",   name: "AWS Cloud Practitioner",
        provider: "AWS", status: "in_progress", progress: 0,
        targetDate: null, completedDate: null, studySessions: [] },
      { id: "cert-aws-saa",  name: "AWS Solutions Architect Associate",
        provider: "AWS", status: "planned",     progress: 0,
        targetDate: null, completedDate: null, studySessions: [] },
      { id: "cert-aws-aiml", name: "AWS AI/ML Specialty",
        provider: "AWS", status: "planned",     progress: 0,
        targetDate: null, completedDate: null, studySessions: [] }
    ],
    // studySessions: [{ id, date (ISO), duration_minutes, topic, xpEarned }]

    books: [],
    // { id, addedAt (ISO), title, author,
    //   status: reading|completed|queued,
    //   startDate, completedDate, rating (1-5), notes }

    knowledgeNotes: []
    // { id, date (ISO), title, content, tags: [], xpEarned }
  },

  work: {
    projects: [
      { id: "proj-dos",     name: "D-OS",       lane: "personal", status: "active",  desc: "Personal operating system", timeLogged: 0, createdAt: "2026-04-21T00:00:00Z" },
      { id: "proj-solar",   name: "Solar Sim",  lane: "personal", status: "active",  desc: "Solar system simulator",    timeLogged: 0, createdAt: "2026-04-21T00:00:00Z" },
      { id: "proj-levelup", name: "LevelUp App",lane: "personal", status: "planned", desc: "Mobile leveling app",       timeLogged: 0, createdAt: "2026-04-21T00:00:00Z" }
    ],

    tickets: []
    // { id, createdAt (ISO), updatedAt (ISO), completedAt (ISO|null),
    //   title, description, lane: truid|personal,
    //   projectId, status: todo|in_progress|done|blocked,
    //   priority: high|medium|low, xpEarned }
  }

};
