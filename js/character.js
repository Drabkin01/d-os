// ── Character System ─────────────────────────────────────────────────────────

const XP_TABLE = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5800, 8000];
// Level 1→2: 100xp, 2→3: 250xp, ... maps to index = level

const TIER_THRESHOLDS = [0, 5, 10, 15, 20, 25];
// Tier = 0..5 based on average stat level

const TIER_NAMES = [
  "Bare Bones",
  "Rough Around the Edges",
  "Sharp Dresser",
  "Hat and Gloves",
  "The Dapper Detective",
  "Legendary"
];

const TIER_UNLOCKS = [
  "The skeleton itself — nothing more.",
  "Basic suit jacket and trousers.",
  "Full suit, white shirt, deep red tie.",
  "Wide-brimmed hat, leather gloves.",
  "Pocket square, gold cane, dress shoes.",
  "Glowing blue eyes, gold trim, full swagger."
];

function xpToNextLevel(level) {
  if (level >= XP_TABLE.length - 1) return Infinity;
  return XP_TABLE[level] - (XP_TABLE[level - 1] || 0);
}

function totalXpForLevel(level) {
  return XP_TABLE[Math.min(level - 1, XP_TABLE.length - 1)] || 0;
}

function levelFromXP(xp) {
  let level = 1;
  for (let i = 1; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) level = i + 1;
    else break;
  }
  return Math.min(level, XP_TABLE.length);
}

function calcTier(stats) {
  const avg = (
    stats.health.level +
    stats.finances.level +
    stats.intelligence.level +
    stats.work.level
  ) / 4;
  for (let t = TIER_THRESHOLDS.length - 1; t >= 0; t--) {
    if (avg >= TIER_THRESHOLDS[t]) return t;
  }
  return 0;
}

function awardXP(stat, amount, reason = 'Activity logged') {
  const data = DOS.data.character;
  const s = data.stats[stat];
  s.xp += amount;
  const newLevel = levelFromXP(s.xp);
  const levelled = newLevel > s.level;
  s.level = newLevel;
  data.tier = calcTier(data.stats);

  if (!data.xpHistory) data.xpHistory = [];
  data.xpHistory.push({
    id: `xp-${Date.now()}`,
    date: new Date().toISOString(),
    stat, amount, reason
  });

  DOS.save('character');
  renderCharacter();

  // Haptic + flyout
  if (navigator.vibrate) navigator.vibrate(30);
  _showXPFlyout(stat, amount);

  if (levelled) triggerLevelUpAnim(stat, newLevel);
  return { levelled, newLevel };
}

function _showXPFlyout(stat, amount) {
  const anchor = document.querySelector(`.stat-ring-wrap[data-stat="${stat}"]`);
  if (!anchor) return;
  const el = document.createElement('div');
  el.className = 'xp-flyout';
  el.textContent = `+${amount} XP`;
  el.style.color = `var(--${stat})`;
  const rect = anchor.getBoundingClientRect();
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top  = `${rect.top}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// ── SVG Tier Rendering ────────────────────────────────────────────────────────

function renderCharacter() {
  const data = DOS.data.character;
  const tier = data.tier;
  const svg = document.getElementById('skulduggery-svg');
  if (!svg) return;

  // Remove all tier classes, apply current
  svg.className.baseVal = svg.className.baseVal.replace(/\btier-\d\b/g, '').trim();
  svg.classList.add(`tier-${tier}`);

  // Update stat rings
  ['health', 'finances', 'intelligence', 'work'].forEach(stat => {
    updateStatRing(stat, data.stats[stat]);
  });

  // Update tier label
  const tierLabel = document.getElementById('tier-label');
  if (tierLabel) tierLabel.textContent = TIER_NAMES[tier];

  // Update overall level display
  const avgLevel = Math.floor(
    (data.stats.health.level + data.stats.finances.level +
     data.stats.intelligence.level + data.stats.work.level) / 4
  );
  const lvlEl = document.getElementById('char-level');
  if (lvlEl) lvlEl.textContent = `Lv. ${avgLevel}`;

  // Update character name display
  const nameEl = document.getElementById('char-name-display');
  if (nameEl) nameEl.textContent = data.name || 'Skulduggery Pleasant';

  // Update daily streak badge
  const streakEl = document.getElementById('daily-streak-display');
  if (streakEl) {
    const streak = data.dailyStreak?.count || 0;
    if (streak > 0) {
      streakEl.textContent = `🔥 ${streak}d streak`;
      streakEl.style.display = '';
    } else {
      streakEl.style.display = 'none';
    }
  }
}

function updateStatRing(stat, statData) {
  const ring = document.getElementById(`ring-${stat}`);
  const label = document.getElementById(`ring-${stat}-level`);
  if (!ring || !label) return;

  const level = statData.level;
  const xp = statData.xp;
  const prevXP = totalXpForLevel(level);
  const nextXP = totalXpForLevel(level + 1);

  // At max level prevXP === nextXP → show full ring instead of NaN
  const progress = (nextXP <= prevXP) ? 1
    : nextXP === Infinity       ? 1
    : Math.max(0, Math.min(1, (xp - prevXP) / (nextXP - prevXP)));

  const circumference = 2 * Math.PI * 44;
  ring.style.strokeDasharray  = circumference;
  ring.style.strokeDashoffset = circumference * (1 - progress);
  label.textContent = `Lv.${level}`;
}

// ── Level Up Animation ────────────────────────────────────────────────────────

function triggerLevelUpAnim(stat, level) {
  const el = document.querySelector(`.stat-ring-wrap[data-stat="${stat}"]`);
  if (el) {
    el.classList.add('level-up-flash');
    setTimeout(() => el.classList.remove('level-up-flash'), 1200);
  }
  showToast(`${stat.toUpperCase()} reached Level ${level}!`, 'gold');
  _showLevelUpCelebration(stat, level);
}

const _STAT_LU_ICONS = { health: '❤️', finances: '💰', intelligence: '📚', work: '⚙️' };

function _showLevelUpCelebration(stat, level) {
  const overlay = document.createElement('div');
  overlay.className = 'levelup-overlay';
  overlay.innerHTML = `
    <div class="levelup-backdrop"></div>
    <div class="levelup-card">
      <div class="levelup-badge">Level Up</div>
      <div class="levelup-text">LEVEL ${level}!</div>
      <div class="levelup-stat-name" style="color:var(--${stat})">${_STAT_LU_ICONS[stat] || '⚡'} ${stat.toUpperCase()}</div>
    </div>`;
  document.body.appendChild(overlay);
  if (navigator.vibrate) navigator.vibrate([50, 30, 80]);
  requestAnimationFrame(() => overlay.classList.add('show'));
  setTimeout(() => {
    overlay.classList.add('hide');
    setTimeout(() => overlay.remove(), 400);
  }, 2400);
}

// ── Daily Streak ──────────────────────────────────────────────────────────────

function checkDailyStreak() {
  const char = DOS.data.character;
  if (!char.dailyStreak) char.dailyStreak = { count: 0, lastDate: null };

  const todayStr = today();
  const { count, lastDate } = char.dailyStreak;
  if (lastDate === todayStr) return;

  const yd = new Date();
  yd.setDate(yd.getDate() - 1);
  const yesterStr = yd.toISOString().split('T')[0];

  char.dailyStreak.count    = lastDate === yesterStr ? count + 1 : 1;
  char.dailyStreak.lastDate = todayStr;
  DOS.save('character');

  const newStreak = char.dailyStreak.count;
  if ([7, 14, 30, 60, 100].includes(newStreak)) {
    setTimeout(() => _showStreakMilestone(newStreak), 1000);
  } else if (newStreak > 1) {
    setTimeout(() => showToast(`🔥 ${newStreak} day streak`, 'gold'), 800);
  }
}

function _showStreakMilestone(days) {
  const overlay = document.createElement('div');
  overlay.className = 'levelup-overlay';
  overlay.innerHTML = `
    <div class="levelup-backdrop"></div>
    <div class="levelup-card">
      <div class="levelup-badge">Streak Milestone</div>
      <div class="levelup-text">🔥 ${days} DAYS!</div>
      <div class="levelup-stat-name" style="color:var(--gold)">Consistency unlocked</div>
    </div>`;
  document.body.appendChild(overlay);
  if (navigator.vibrate) navigator.vibrate([40, 20, 40, 20, 80]);
  requestAnimationFrame(() => overlay.classList.add('show'));
  setTimeout(() => {
    overlay.classList.add('hide');
    setTimeout(() => overlay.remove(), 400);
  }, 2800);
}

// ── Dev / Test Panel ──────────────────────────────────────────────────────────

function devSetTier(tier) {
  const svg = document.getElementById('skulduggery-svg');
  if (!svg) return;
  svg.className.baseVal = svg.className.baseVal.replace(/\btier-\d\b/g, '').trim();
  svg.classList.add(`tier-${tier}`);

  const devTierName = document.getElementById('dev-tier-name');
  if (devTierName) devTierName.textContent = `Tier ${tier}: ${TIER_NAMES[tier]}`;

  const devUnlock = document.getElementById('dev-tier-unlock');
  if (devUnlock) devUnlock.textContent = TIER_UNLOCKS[tier];

  // Highlight active button
  document.querySelectorAll('.dev-tier-btn').forEach((b, i) => {
    b.classList.toggle('active', i === tier);
  });
}

function devSetLevel(level) {
  // Set all stats to this level for preview
  const avgXp = totalXpForLevel(parseInt(level));
  ['health', 'finances', 'intelligence', 'work'].forEach(stat => {
    const s = DOS.data.character.stats[stat];
    s.xp = avgXp;
    s.level = levelFromXP(avgXp);
  });
  DOS.data.character.tier = calcTier(DOS.data.character.stats);
  renderCharacter();

  const devLevelDisplay = document.getElementById('dev-level-display');
  if (devLevelDisplay) devLevelDisplay.textContent = level;
}

let idleAnimActive = false;
function toggleIdleAnim() {
  const svg = document.getElementById('skulduggery-svg');
  if (!svg) return;
  idleAnimActive = !idleAnimActive;
  svg.classList.toggle('idle-anim', idleAnimActive);
  const btn = document.getElementById('dev-anim-btn');
  if (btn) btn.textContent = idleAnimActive ? 'Stop Animation' : 'Test Idle Animation';
}
