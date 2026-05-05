// ── KAI Avatar Engine ──────────────────────────────────────────────────────────
// Dual render mode:
//   → Rive canvas  — when assets/kai.riv is present (drop it in to activate)
//   → SVG fallback — works out of the box right now
//
// Accent-coloured elements (both modes): bandana · iris · gi lapels · scarf
// ─────────────────────────────────────────────────────────────────────────────

// ── Colour map — from KAI reference sheets ────────────────────────────────────
// riveIndex → colorIndex number input in Rive (0–9).
// Create a numbered condition in Rive: 0=magenta(default), 1=orange-red(fitness),
// 2=gold(finances), 3=cyan(work), 4=teal(study), 5=sea-green(wellness),
// 6=crimson(martial), 7=purple(creative), 8=coral(social), 9=midnight(sleep)
const KAI_COLOURS = {
  // ── Core stat colours (XP system) ─────────────────────────────────────────
  health:       { accent: '#FF4500', dim: '#7A2000', lite: '#FF7040', rgb: '255,69,0',    riveIndex: 1 },
  finances:     { accent: '#FFD700', dim: '#7A6500', lite: '#FFE44D', rgb: '255,215,0',   riveIndex: 2 },
  intelligence: { accent: '#00C896', dim: '#005C45', lite: '#33D9AC', rgb: '0,200,150',   riveIndex: 4 },
  work:         { accent: '#00BFFF', dim: '#005C7A', lite: '#33CCFF', rgb: '0,191,255',   riveIndex: 3 },
  // ── Extended calendar activity colours ────────────────────────────────────
  martial_arts: { accent: '#DC143C', dim: '#6B0A1D', lite: '#E8476A', rgb: '220,20,60',   riveIndex: 6 },
  wellness:     { accent: '#20B2AA', dim: '#0E5450', lite: '#4DC4BC', rgb: '32,178,170',  riveIndex: 5 },
  creative:     { accent: '#9B59B6', dim: '#4A2458', lite: '#B07CC6', rgb: '155,89,182',  riveIndex: 7 },
  social:       { accent: '#FF6B6B', dim: '#7A3333', lite: '#FF8E8E', rgb: '255,107,107', riveIndex: 8 },
  // ── Special states ────────────────────────────────────────────────────────
  _idle:        { accent: '#FF69B4', dim: '#7A3256', lite: '#FF8EC7', rgb: '255,105,180', riveIndex: 0 },
  _sleep:       { accent: '#191970', dim: '#0A0A35', lite: '#3333CC', rgb: '25,25,112',   riveIndex: 9 },
  _default:     { accent: '#FF69B4', dim: '#7A3256', lite: '#FF8EC7', rgb: '255,105,180', riveIndex: 0 }
};

// ── Activity → animation + outfit + colour ────────────────────────────────────
// outfit: which Rive artboard outfit to show (set KAI_RIVE_OUTFIT_IDX in Rive)
// colKey: which KAI_COLOURS entry drives the accent
const KAI_ACTIVITY = {
  // ── Core stat activities ───────────────────────────────────────────────────
  health:        { anim: 'fitness',      label: 'Training',       icon: '💪', outfit: 'gi',      colKey: 'health'       },
  finances:      { anim: 'finances',     label: 'Finance mode',   icon: '💰', outfit: 'gi',      colKey: 'finances'     },
  intelligence:  { anim: 'intelligence', label: 'Study mode',     icon: '📚', outfit: 'gi',      colKey: 'intelligence' },
  work:          { anim: 'work',         label: 'Work session',   icon: '⚙️', outfit: 'suit',    colKey: 'work'         },
  // ── Extended calendar activities ──────────────────────────────────────────
  martial_arts:  { anim: 'martial',      label: 'Martial arts',   icon: '🥋', outfit: 'ninja',   colKey: 'martial_arts' },
  wellness:      { anim: 'wellness',     label: 'Wellness',       icon: '🧘', outfit: 'gi',      colKey: 'wellness'     },
  creative:      { anim: 'creative',     label: 'Creative mode',  icon: '🎨', outfit: 'gi',      colKey: 'creative'     },
  social:        { anim: 'social',       label: 'Social mode',    icon: '🤝', outfit: 'gi',      colKey: 'social'       },
  // ── Penalty states (inactivity) ───────────────────────────────────────────
  _penalty_lazy: { anim: 'lazy',         label: 'Needs a push…',  icon: '😴', outfit: 'gi',      colKey: '_idle'        },
  _penalty_dead: { anim: 'dead',         label: 'System failure', icon: '💀', outfit: 'gi',      colKey: '_sleep'       },
  // ── Special states ────────────────────────────────────────────────────────
  _idle:         { anim: 'idle',         label: 'Off duty',       icon: '✦',  outfit: 'gi',      colKey: '_idle'        },
  _sleep:        { anim: 'sleep',        label: 'Rest time',      icon: '🌙', outfit: 'pyjamas', colKey: '_sleep'       }
};

// ── Rive wiring constants ─────────────────────────────────────────────────────
// These names must match EXACTLY what you create in the Rive editor.
const KAI_RIVE_FILE     = 'assets/kai.riv';
const KAI_RIVE_SM       = 'KAI_States';   // State machine name
const KAI_RIVE_ACTIVITY = 'activity';     // Number  0–11 (see KAI_RIVE_ANIM_IDX)
const KAI_RIVE_COLOUR   = 'colorIndex';   // Number  0–9  (see KAI_COLOURS riveIndex)
const KAI_RIVE_OUTFIT   = 'outfit';       // Number  0=gi 1=suit 2=pyjamas 3=ninja
const KAI_RIVE_FEMALE   = 'isFemale';     // Boolean

// Animation name → Rive activity number
const KAI_RIVE_ANIM_IDX = {
  idle: 0, fitness: 1, work: 2, intelligence: 3, finances: 4,
  sleep: 5, martial: 6, wellness: 7, creative: 8, social: 9,
  lazy: 10, dead: 11
};

// Outfit name → Rive outfit number
const KAI_RIVE_OUTFIT_IDX = { gi: 0, suit: 1, pyjamas: 2, ninja: 3 };

// Google Calendar keyword → KAI activity key
// Add more phrases here as you discover how your calendar events are named.
const KAI_CALENDAR_MAP = {
  // Fitness / health
  gym: 'health', workout: 'health', run: 'health', training: 'health',
  hike: 'health', swim: 'health', cycle: 'health', sport: 'health',
  // Martial arts
  karate: 'martial_arts', judo: 'martial_arts', boxing: 'martial_arts',
  mma: 'martial_arts', 'martial arts': 'martial_arts', sparring: 'martial_arts',
  // Finance
  budget: 'finances', invoic: 'finances', payroll: 'finances',
  tax: 'finances', finance: 'finances', bank: 'finances', invest: 'finances',
  // Work
  meeting: 'work', standup: 'work', sprint: 'work', deploy: 'work',
  interview: 'work', presentation: 'work', deadline: 'work', client: 'work',
  // Study / intelligence
  study: 'intelligence', read: 'intelligence', course: 'intelligence',
  lecture: 'intelligence', research: 'intelligence', learn: 'intelligence',
  // Wellness
  meditat: 'wellness', yoga: 'wellness', therapy: 'wellness',
  wellness: 'wellness', mindful: 'wellness',
  // Creative
  design: 'creative', art: 'creative', music: 'creative', paint: 'creative',
  creative: 'creative', write: 'creative', record: 'creative',
  // Social
  lunch: 'social', dinner: 'social', coffee: 'social', call: 'social',
  meet: 'social', birthday: 'social', date: 'social', party: 'social'
};

// ── Rive runtime state (per canvas) ──────────────────────────────────────────
const _kaiRiveInst   = {};  // canvasId → rive.Rive
const _kaiRiveInputs = {};  // canvasId → SMI input array

// ── Config helpers ────────────────────────────────────────────────────────────
function kaiGetConfig() {
  const char = DOS.data.character;
  if (!char.kai) {
    char.kai = { gender: 'male', name: 'KAI', forcedStat: null };
    DOS.save('character');
  }
  return char.kai;
}
function kaiSaveConfig(updates) {
  DOS.data.character.kai = { ...kaiGetConfig(), ...updates };
  DOS.save('character');
}

// ── Determine current activity ────────────────────────────────────────────────
function kaiCurrentActivity() {
  // 1. Manual mode override — works with or without calendar
  try {
    const manual = JSON.parse(localStorage.getItem('dos_manual_mode') || 'null');
    if (manual && Date.now() < manual.until) return manual.stat || '_idle';
  } catch {}

  // 2. Penalty check — inactivity overrides everything except sleep
  const penalty = _kaiPenaltyState();
  if (penalty) return penalty;

  // 3. Live calendar theme (written by google-api.js applyThemeColour)
  if (typeof _gToken !== 'undefined' && _gToken) {
    const stored = JSON.parse(localStorage.getItem('dos_theme') || 'null');
    if (stored && Date.now() - stored.ts < 2 * 3600 * 1000) {
      const eventTitle = (stored.eventTitle || '').toLowerCase();
      const mapped = _kaiMapCalendarEvent(eventTitle);
      return mapped || stored.stat || null;
    }
  }

  // 4. Time-of-day fallback
  const h = new Date().getHours();
  if (h >= 22 || h < 6) return '_sleep';
  return null;  // → idle
}

// Map a calendar event title to a KAI activity key using keyword matching
function _kaiMapCalendarEvent(title) {
  if (!title) return null;
  for (const [keyword, actKey] of Object.entries(KAI_CALENDAR_MAP)) {
    if (title.includes(keyword)) return actKey;
  }
  return null;
}

// Check XP history for inactivity penalty states
function _kaiPenaltyState() {
  const history = DOS.data.character?.xpHistory;
  if (!history || history.length === 0) return null;
  const lastEntry = history[history.length - 1];
  const msSince   = Date.now() - new Date(lastEntry.date).getTime();
  const daysSince = msSince / (1000 * 60 * 60 * 24);
  if (daysSince >= 3) return '_penalty_dead';
  if (daysSince >= 1) return '_penalty_lazy';
  return null;
}

// ── Apply accent colour: CSS vars + app-wide --gold sync + Rive ──────────────
function kaiApplyColour(colKey) {
  const c = KAI_COLOURS[colKey] || KAI_COLOURS._default;
  const root = document.documentElement;
  root.style.setProperty('--kai-accent',      c.accent);
  root.style.setProperty('--kai-accent-dim',  c.dim);
  root.style.setProperty('--kai-accent-lite', c.lite);
  root.style.setProperty('--kai-accent-rgb',  c.rgb);
  // Sync app accent — nav highlights, buttons, headers all use --gold
  root.style.setProperty('--gold',      c.accent);
  root.style.setProperty('--gold-dim',  c.dim);
  root.style.setProperty('--gold-lite', c.lite);
  _kaiRiveSet(null, KAI_RIVE_COLOUR, c.riveIndex);
}

// ── Apply outfit to Rive ──────────────────────────────────────────────────────
function kaiApplyOutfit(outfitName) {
  const idx = KAI_RIVE_OUTFIT_IDX[outfitName] ?? 0;
  _kaiRiveSet(null, KAI_RIVE_OUTFIT, idx);
}

// ── Rive helpers ──────────────────────────────────────────────────────────────

// Set a named input on one canvas (null = all)
function _kaiRiveSet(canvasId, inputName, value) {
  const ids = canvasId ? [canvasId] : Object.keys(_kaiRiveInputs);
  ids.forEach(id => {
    const inp = (_kaiRiveInputs[id] || []).find(i => i.name === inputName);
    if (!inp) return;
    if (typeof value === 'boolean') inp.value = value;
    else inp.value = value;
  });
}

// Boot a Rive instance on a <canvas id="canvasId">.
// Silently no-ops if Rive runtime isn't loaded or kai.riv doesn't exist yet.
async function kaiInitRive(canvasId) {
  if (typeof rive === 'undefined') return;

  // Only attempt if the file actually exists on the server
  try {
    const res = await fetch(KAI_RIVE_FILE, { method: 'HEAD' });
    if (!res.ok) return;
  } catch { return; }

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Tear down previous instance on this canvas
  if (_kaiRiveInst[canvasId]) {
    try { _kaiRiveInst[canvasId].cleanup(); } catch {}
    delete _kaiRiveInst[canvasId];
    delete _kaiRiveInputs[canvasId];
  }

  const cfg      = kaiGetConfig();
  const statKey  = kaiCurrentActivity();
  const actInfo  = KAI_ACTIVITY[statKey] || KAI_ACTIVITY._idle;
  const colKey   = actInfo.colKey || '_default';
  const colData  = KAI_COLOURS[colKey] || KAI_COLOURS._default;
  const isFemale = cfg.gender === 'female';
  const outfitIdx = KAI_RIVE_OUTFIT_IDX[actInfo.outfit || 'gi'] ?? 0;

  const inst = new rive.Rive({
    src: KAI_RIVE_FILE,
    canvas,
    stateMachines: KAI_RIVE_SM,
    autoplay: true,
    onLoad() {
      const inputs = inst.stateMachineInputs(KAI_RIVE_SM);
      _kaiRiveInputs[canvasId] = inputs;
      _kaiRiveInst[canvasId]   = inst;

      const get = name => inputs?.find(i => i.name === name);

      const actInp = get(KAI_RIVE_ACTIVITY);
      if (actInp) actInp.value = KAI_RIVE_ANIM_IDX[actInfo.anim] ?? 0;

      const colInp = get(KAI_RIVE_COLOUR);
      if (colInp) colInp.value = colData.riveIndex;

      const outfitInp = get(KAI_RIVE_OUTFIT);
      if (outfitInp) outfitInp.value = outfitIdx;

      const femInp = get(KAI_RIVE_FEMALE);
      if (femInp) femInp.value = isFemale;

      // Show canvas, hide the SVG fallback sitting beside it
      canvas.style.display = '';
      const stage = canvas.closest('.kai-stage, .kai-profile-stage');
      const svg   = stage?.querySelector('.kai-svg');
      if (svg) svg.style.display = 'none';
    }
  });
}

// Switch animation state on one canvas (null = all)
function kaiSetRiveState(canvasId, statKey) {
  const actInfo = KAI_ACTIVITY[statKey] || KAI_ACTIVITY._idle;
  _kaiRiveSet(canvasId, KAI_RIVE_ACTIVITY, KAI_RIVE_ANIM_IDX[actInfo.anim] ?? 0);
}

// ── Stage builder — canvas + SVG fallback + familiar orb ──────────────────────
// The canvas is hidden on creation; kaiInitRive() reveals it if kai.riv loads.
function buildKaiStage(canvasId, small = false) {
  const cfg     = kaiGetConfig();
  const statKey = kaiCurrentActivity();
  const actInfo = KAI_ACTIVITY[statKey] || KAI_ACTIVITY._idle;
  const cw = small ? 111 : 160;
  const ch = small ? 111 : 160;

  return `
    <canvas id="${canvasId}" width="${cw}" height="${ch}"
            style="display:none;width:${cw}px;height:${ch}px"></canvas>
    ${buildKaiSVG({ gender: cfg.gender || 'male', animClass: `kai-anim-${actInfo.anim}`, small })}
    <div class="kai-familiar-orb"></div>`;
}

// ── SVG fallback — v5: exact Figma paths, accent colors as CSS vars ────────────
// Accent elements (swap via --kai-accent): eye irises · headband · scarf · belt
//   · gi lapel V · blush · accent stripes
// #C16775 → ${A}  (accent fill)   |   #5C3443 → ${AD}  (dark accent strokes)
function buildKaiSVG({ gender = 'male', accentColour = '#FF69B4', animClass = 'kai-anim-idle', small = false, bust = false }) {
  const w   = small ? 111 : 160;
  const h   = small ? 111 : 160;
  const uid = Math.random().toString(36).slice(2,7);

  // Read CSS variable values at render time via getComputedStyle so the SVG
  // always reflects the current colour (set by stylesheet OR inline setProperty).
  // Using var() inside SVG <style> blocks is unreliable across browsers — baking
  // direct hex values is the only cross-browser-safe approach.
  const _v = (name, fallback) => {
    try {
      const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      // getComputedStyle returns the raw declaration for custom properties, so
      // if the value is still a var() reference (e.g. --kai-sword: var(--kai-accent))
      // it hasn't resolved — fall through to fallback.
      if (!val || val.startsWith('var(')) return fallback;
      return val;
    } catch(e) { return fallback; }
  };

  const A   = _v('--kai-accent',     accentColour);   // accent fill
  const AD  = _v('--kai-accent-dim', '#6B0A1D');      // dark accent for depth
  const SK  = _v('--kai-skin',       '#F0BA8F');      // skin tone
  const GI  = _v('--kai-gi',        '#111111');       // clothing — gi, pants, shoes
  const MK  = _v('--kai-mask',      '#111111');       // flowing cape / face scarf
  const HR  = _v('--kai-hair',      '#5E5E69');       // hair colour
  const SW  = _v('--kai-sword',      A);              // sword / weapon decals → falls back to accent
  const OL  = _v('--kai-outline',   'rgba(255,255,255,0.28)'); // stroke outline — light on dark bg by default
  // bust=true → tight crop on face/head for companion bubble
  const vb  = bust ? '80 2 108 108' : '0 0 200 200';

  return `
<svg id="ks${uid}" class="kai-svg ${animClass}" xmlns="http://www.w3.org/2000/svg"
     viewBox="${vb}" width="${w}" height="${h}" fill="none" style="overflow:visible">
<style>
#ks${uid} .ksk{fill:${SK}}
#ks${uid} .kgi{fill:${GI}}
#ks${uid} .kmk{fill:${AD}}
#ks${uid} .khr{fill:${HR}}
#ks${uid} .ksw{fill:${SW}}
#ks${uid} .ka {fill:${A}}
</style>

<!-- RIGHT FOOT: skin layer first, then sandal/shoe paints on top -->
<path d="M116 179.182L117 176.345V175.4H108.5L99 173.036L98 176.345L91 181.545L90 186.745L95 187.691L101 188.636L114 184.855L117 183.909V182.491L116 179.182Z" class="ksk" stroke="${OL}"/>
<path d="M99 170.673V172.564L103 173.982L108 174.927H112.5H116H118V173.982V172.564V170.673L120.5 169.727V168.309H121.5L125 165.945L128 164.527L129.5 159.8V156.491L131.5 155.073L133.5 153.182H134.5V151.291V147.509V143.255V139.473V135.218H133.5H129.5H127H123.5H118H111.5L109.5 136.636L106 140.418L103 146.091L99 151.291L96 156.491V157.909L97 159.8L99 162.164L100.5 164.527V165.945V168.309V170.673H99Z" class="kgi" stroke="${OL}"/>
<path d="M117 187.218V183.909L115 185.327L112.5 186.273V183.436L112 182.018L110 179.182L105.5 178.236L100.5 179.182L97 176.818L94.5 178.236L92 180.127L91 181.073H94.5H97L98 183.436L99.5 183.909L100.5 183.436L102.5 182.018H106.5L107.5 183.909L109 186.273V187.218H105.5L100.5 188.636L92 187.218H89V190.055H90L98 191H102.5L107.5 190.055L112 188.636L117 187.218Z" class="kgi"/>
<path d="M89 187.218V190.055H90L98 191H102.5L107.5 190.055L112 188.636L117 187.218V183.909L115 185.327L112.5 186.273V183.436L112 182.018L110 179.182L105.5 178.236L100.5 179.182L97 176.818L94.5 178.236L92 180.127L91 181.073M89 187.218L90 186.273V182.018L91 181.073M89 187.218H92L100.5 188.636L105.5 187.218H109V186.273L107.5 183.909L106.5 182.018H102.5L100.5 183.436L99.5 183.909L98 183.436L97 181.073H94.5H91" stroke="${OL}"/>
<!-- LEFT FOOT: skin layer first, then sandal/shoe paints on top -->
<path d="M147 182.964L148 177.764L147 174.927L148.5 175.4L154 174.927H157.5L162.5 173.982H163.5L165 172.091L167.5 177.764L174 182.964L175.5 183.909V186.745H174L171 187.691H169L167.5 186.745V187.691H162.5L157.5 186.745L150.5 184.855L147 182.964Z" class="ksk"/>
<path d="M167.5 186.745V187.691H162.5L157.5 186.745L150.5 184.855L147 182.964L148 177.764L147 174.927L148.5 175.4L154 174.927H157.5L162.5 173.982H163.5L165 172.091L167.5 177.764L174 182.964L175.5 183.909V186.745H174L171 187.691H169L167.5 186.745ZM167.5 186.745L166.5 184.855" stroke="${OL}"/>
<path d="M152 184.855L147 183.436V187.218L155 189.109L161.5 190.527H170.5L175.5 189.109V186.273L169.5 187.218H163.5H156.5L157.5 184.855L161.5 182.018L166 183.436L169.5 181.073L172.5 182.018L167.5 179.182H165H156.5L152 184.855Z" class="kgi" stroke="${OL}"/>
<path d="M146.5 173.509V175.873H152.5L158.5 174.455L164 173.509L165 172.564L164 168.782V164.527L167 162.636L169 158.855V155.545L165 148.455L161.5 142.782L158.5 137.582L156.5 134.745H149L144.5 136.636H139.5L134.5 137.582L133.5 152.236L136.5 159.8L138.5 164.527L143.5 166.891L144.5 168.782L146.5 170.2V172.564V173.509Z" class="kgi" stroke="${OL}"/>
<path d="M87.5 92.6727L90.5 91.7273L92 92.6727L93 93.6182V94.5636L95.5 96.9273L99 100.709L102.5 104.491L104 105.436L102.5 107.327L101 111.109L97 113.473L95.5 111.109L97 108.745L95.5 107.327L89.5 102.127L85 98.3454H83.5V96.9273L85 94.5636L87.5 92.6727Z" fill="#140B0B" stroke="${OL}"/>
<path d="M91.5 101.182L91 97.8727L94.5 98.8182V101.182H91.5Z" class="ksw"/>
<path d="M97 105.909L96.5 103.545L99 104.018L99.5 106.382L97 105.909Z" class="ksw"/>
<path d="M86.5 96.9273L85.5 98.8182H84.5H83.5H82.5V97.8727V96.9273L83.5 95.5091L84 94.5636L85.5 93.1455L87 92.2L88.5 91.7273L90.5 91.2545L91.5 91.7273L93 93.1455V94.0909H92.5L91 93.6182L89.5 94.0909L88 95.5091L86.5 96.9273Z" class="ksw"/>
<path d="M95 111.109L96.5 108.745L99.5 108.273L101 107.327L102 106.382L102.5 104.491V103.545H103H104L105 103.779V105.436L104 106.382L103 107.327L102.5 108.273L101 112.055L99.5 113L98.5 113.473L96.5 114.418V113.473L95.5 112.055L95 111.109Z" class="ksw"/>
<path d="M91.5 101.182L91 97.8727L94.5 98.8182V101.182H91.5Z" stroke="${OL}"/>
<path d="M97 105.909L96.5 103.545L99 104.018L99.5 106.382L97 105.909Z" stroke="${OL}"/>
<path d="M86.5 96.9273L85.5 98.8182H84.5H83.5H82.5V97.8727V96.9273L83.5 95.5091L84 94.5636L85.5 93.1455L87 92.2L88.5 91.7273L90.5 91.2545L91.5 91.7273L93 93.1455V94.0909H92.5L91 93.6182L89.5 94.0909L88 95.5091L86.5 96.9273Z" stroke="${OL}"/>
<path d="M95 111.109L96.5 108.745L99.5 108.273L101 107.327L102 106.382L102.5 104.491V103.545H103H104L105 103.779V105.436L104 106.382L103 107.327L102.5 108.273L101 112.055L99.5 113L98.5 113.473L96.5 114.418V113.473L95.5 112.055L95 111.109Z" stroke="${OL}"/>
<path d="M142 109.691L140.25 111.72" stroke="${OL}"/>
<path d="M130 109.691L123.5 106.855L115 99.7636L122 101.182H123.224H124.449L125 95.7455L120 94.5636L112.5 93.1455L109 91.2546L106 87.4727L102.5 86.0546H101.5L100.5 87.4727H97L95 86.0546L90.5 82.7455L88 79.9091V76.6L89 74.2364L95 76.6L97 79.9091L102.5 82.7455L100.5 69.0364L104.5 61L106 57.2182L122 54.8546H140L152.5 55.8L167 61L166 67.1455L164 74.2364L162 80.8546L164 81.8L167 80.8546L170 76.6L171.5 74.2364L175 75.6546V77.5455L174 81.8L171.5 84.6364L166 87.4727L162 88.8909L160 87.4727L157.5 89.8364L154.5 91.2546L149.5 93.1455L142 95.9818H140.25L140 101.182L143 104.491L142 109.691C140.917 111.109 136.8 115.647 136 114.891L130 109.691Z" class="ksk"/>
<path d="M124.449 101.182H123.224M124.449 101.182L125 95.7455M124.449 101.182H122L115 99.7636L123.5 106.855L130 109.691L136 114.891M125 95.7455L130 96.9273H134L138.5 95.9818H140.25M125 95.7455L120 94.5636L112.5 93.1455L109 91.2546L106 87.4727L102.5 86.0546H101.5L100.5 87.4727H97L95 86.0546L90.5 82.7455L88 79.9091V76.6L89 74.2364L95 76.6L97 79.9091L102.5 82.7455L100.5 69.0364L104.5 61L106 57.2182L122 54.8546H140L152.5 55.8L167 61L166 67.1455L164 74.2364L162 80.8546L164 81.8L167 80.8546L170 76.6L171.5 74.2364L175 75.6546V77.5455L174 81.8L171.5 84.6364L166 87.4727L162 88.8909L160 87.4727L157.5 89.8364L154.5 91.2546L149.5 93.1455L142 95.9818H140.25M140.25 95.9818L140 101.182L143 104.491L142 109.691C140.917 111.109 136.8 115.647 136 114.891M136 114.891L134 112.527L133 111.582L135 113.709" stroke="${OL}"/>
<path d="M140.25 111.72L136.591 114.891" stroke="${OL}"/>
<path d="M126.295 88.7636L123.966 88.3091L123.5 89.6727V90.8546L124.897 92.4909L127.575 94.0364L130.719 94.9455H135.027L137.705 94.0364L139.219 92.4909L140.5 91.1273V89.6727V88.7636L139.219 87.9455L138.404 88.3091H136.541L133.863 87.9455H132.349H130.719H128.856L126.295 88.7636Z" fill="${GI}" stroke="${A}"/>
<path d="M126.295 91.3091L125.712 92.3091L127.575 93.7636L131.069 95.0363L135.842 94.5818L137.473 93.7636L139.569 91.8545V91.3091L137.473 89.6727H135.26H128.856L127.575 90.1272L126.295 91.3091Z" fill="${GI}" stroke="${A}"/>
<path d="M127.692 89.8545L126.294 88.6727L128.274 88.2182H131.534H133.397H135.842H138.637V88.6727L136.075 90.2182L135.842 89.3091L135.027 89.8545H128.274V89.3091L127.692 89.8545Z" fill="${GI}" stroke="${A}"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M163.5 105.701L160 100.485L158 102.856H154L150.5 105.701L147 108.072L144 108.546L141 109.969L136 110.918L130.5 109.969L125 109.021L120 106.649L116 104.753L112 104.278L106 102.856L105 99.0619V100.485L104 102.856L101 105.701L99 109.495L97 110.918H95L94 112.814L91.5 114.711L89.5 116.608L87 118.505L85.5 119.454L81.5 121.825L75.5 123.247L68.5 124.67H64L59 121.825V124.196L59.5 127.041L61 129.887L62 131.784L65 133.68L68.5 135.577H71.5V137H73H77H79.5L84.5 132.732L92.5 129.412L95 127.99H101H105H108H111L112 127.041L114 125.144L116.5 123.247L118 120.402L124.5 125.144L126.5 120.402L128.5 118.031L136 114.711L143.5 118.031L151.5 115.186L159 118.505L169 116.608H171.5H175L177 118.031L181 121.825L189 125.144L186.5 120.402L182.5 116.608L175 113.763L169 110.918L166 108.072L163.5 105.701Z" class="ka"/>
<path d="M116.5 93.8454L113 91L108 91.9485L109 95.268L108 97.1649L105 99.0619L106 102.856L112 104.278L116 104.753L120 106.649L125 109.021L130.5 109.969L136 110.918L141 109.969L144 108.546L147 108.072L150.5 105.701L154 102.856H158L160 100.485L158 97.1649L155 96.2165L157 93.8454L155 91H151.5V91.9485H149.5L145.5 93.8454L140 96.2165H136H133H128.5L116.5 93.8454Z" class="ka"/>
<path d="M160 100.485L158 97.1649L155 96.2165L157 93.8454L155 91H151.5V91.9485H149.5L145.5 93.8454L140 96.2165H136H133H128.5L116.5 93.8454L113 91L108 91.9485L109 95.268L108 97.1649L105 99.0619M160 100.485L163.5 105.701L166 108.072L169 110.918L175 113.763L182.5 116.608L186.5 120.402L189 125.144L181 121.825L177 118.031L175 116.608H171.5H169L159 118.505L151.5 115.186L143.5 118.031L136 114.711L128.5 118.031L126.5 120.402L124.5 125.144L118 120.402L116.5 123.247L114 125.144L112 127.041L111 127.99H108H105H101H95L92.5 129.412L84.5 132.732L79.5 137H77H73H71.5V135.577H68.5L65 133.68L62 131.784L61 129.887L59.5 127.041L59 124.196V121.825L64 124.67H68.5L75.5 123.247L81.5 121.825L85.5 119.454L87 118.505L89.5 116.608L91.5 114.711L94 112.814L95 110.918H97L99 109.495L101 105.701L104 102.856L105 100.485V99.0619M160 100.485L158 102.856H154L150.5 105.701L147 108.072L144 108.546L141 109.969L136 110.918L130.5 109.969L125 109.021L120 106.649L116 104.753L112 104.278L106 102.856L105 99.0619" stroke="${OL}"/>
<path d="M154 128.6H150L144 130.018L140.5 128.6H130L128 130.018L121 128.6H110.5V124.345V121.509L111.5 119.618V114.891L110.5 105.909L107 102.6L115.5 100.236L122 105.436L125.5 107.8L131 110.636L133 112.527L136.5 114.891V113.473L138.5 110.636L141.5 109.218L143 105.436L144 104.018L149 102.127L153.5 102.6H155.5H157L158.5 104.018H157L155.5 111.582V118.673L157 124.345V126.709L155.5 128.6H154Z" class="kgi"/>
<path d="M149 102.127L153.5 102.6H155.5H157M149 102.127L150 102.6H157M149 102.127L144 104.018L143 105.436L141.5 109.218L138.5 110.636L136.5 113.473V114.891L133 112.527L131 110.636L125.5 107.8L122 105.436L115.5 100.236L107 102.6L110.5 105.909L111.5 114.891V119.618L110.5 121.509V124.345V128.6H121L128 130.018L130 128.6H140.5L144 130.018L150 128.6H154H155.5L157 126.709V124.345L155.5 118.673V111.582L157 104.018H158.5L157 102.6" stroke="${OL}"/>
<path d="M115.5 129.073H110.5V132.855L109.5 134.745H112H116.5H124L121 136.636L119.5 141.836L110.5 144.673L108 146.564H110.5L115.5 147.982L121 149.4L124 146.564L127.5 141.836V139.473L130.5 136.636H140L142 139.473V143.255V145.618L140 149.4H142H145.5L149 144.673L147.5 139.473L144.5 134.745H152L155.5 133.8V130.018L154 129.073H150L145.5 130.018H142L140 129.073H134H130.5L129.5 130.018H127.5L121 129.073H115.5Z" class="ka" stroke="${OL}"/>
<path d="M117 101.182L124 106.382L131 110.636L133 111.582L136.064 114.479L138 110.636L141 107L142.5 104.491L148.5 101.655L151.5 102.127L148.5 105.436L145 109.218L141.5 113.473L138 117.905L144.5 130.964H141.5H139L136.5 126.709L133.5 121.036L131.5 117.255L127 113.473L121.5 109.218L118 106.382L115 103.073L113.5 101.182V100.709L115 99.7636L117 101.182Z" class="ka"/>
<path d="M136.064 114.479L133 111.582L131 110.636L124 106.382L117 101.182L115 99.7636L113.5 100.709V101.182L115 103.073L118 106.382L121.5 109.218L127 113.473L131.5 117.255L133.5 121.036L136.5 126.709L139 130.964H141.5H144.5L138 117.905M136.064 114.479L136.5 114.891L138 117.905M136.064 114.479L138 110.636L141 107L142.5 104.491L148.5 101.655L151.5 102.127L148.5 105.436L145 109.218L141.5 113.473L138 117.905" stroke="${OL}"/>
<path d="M162 105.436L158 104.018L156.5 110.164V113.473V117.254V118.673V121.509L158 124.818V127.654L160 130.018L162 133.8L165 130.018L169 127.654L172 126.709H176L173.5 124.818L169 120.091L166.5 115.836L165 112.054L164 108.745L162 105.436Z" class="ksk"/>
<path d="M182.5 149.873L183.5 147.982L179 146.564L177 147.982L176 146.564V144.673H173.5H171V145.618H169.5H169L169.5 148.454L172 149.873H173.5L174.5 151.291H177H180L182.5 149.873Z" class="ksk"/>
<path d="M162 105.436L158 104.018L156.5 110.164V113.473V117.254V118.673V121.509L158 124.818V127.654L160 130.018L162 133.8L165 130.018L169 127.654L172 126.709H176L173.5 124.818L169 120.091L166.5 115.836L165 112.054L164 108.745L162 105.436Z" stroke="${OL}"/>
<path d="M182.5 149.873L183.5 147.982L179 146.564L177 147.982L176 146.564V144.673H173.5H171V145.618H169.5H169L169.5 148.454L172 149.873H173.5L174.5 151.291H177H180L182.5 149.873Z" stroke="${OL}"/>
<path d="M164 131.436L162.5 133.8L164 135.218L167.5 137.582L169 139.945L167.5 142.782L169 145.145H171H176.5L180 146.564L183.5 147.509L185.5 143.727L183.5 140.891L181.5 138.527L180 135.218L178 131.436L176.5 126.709H172L167.5 128.6L164 131.436Z" class="kgi" stroke="${OL}"/>
<path d="M92.5 122.455L90.5 125.764L97.5 126.709L104 131.436L106 125.764L110 122.455L113 116.782V111.109L111 106.382L108.5 103.073L105 104.491L102 108.273L100.5 113L97.5 116.782L95.5 120.091L92.5 122.455Z" class="ksk"/>
<path d="M99 143.727L97.5 142.782H95.5L94 143.727V145.618H90.5V146.564H88L85 147.982H80.5L81.5 150.345H82.5L85 151.764H88H92.5L94 149.4L97.5 150.345L99 143.727Z" class="ksk"/>
<path d="M92.5 122.455L90.5 125.764L97.5 126.709L104 131.436L106 125.764L110 122.455L113 116.782V111.109L111 106.382L108.5 103.073L105 104.491L102 108.273L100.5 113L97.5 116.782L95.5 120.091L92.5 122.455Z" stroke="${OL}"/>
<path d="M99 143.727L97.5 142.782H95.5L94 143.727V145.618H90.5V146.564H88L85 147.982H80.5L81.5 150.345H82.5L85 151.764H88H92.5L94 149.4L97.5 150.345L99 143.727Z" stroke="${OL}"/>
<path d="M93.5 125.291L89 126.236L88 127.182V128.6L86.5 131.436L84.5 134.745V135.691L83 137.582L81.5 139.473L80.5 141.364L79.5 143.727V146.091L80.5 148.455H84.5L88 147.036L91 146.091L92.5 145.145H93.5L97 143.727H99.5L98.5 139.473V137.582L100.5 135.691L104.5 132.855L103.5 131.436L100.5 128.6L97 126.236L93.5 125.291Z" class="kgi" stroke="${OL}"/>
<path d="M142 73.7636L142.5 71.8727L143.5 70.9273L145.5 69.9818L148 69.5091H150H152H153.5L154.5 69.9818L156 70.4545L156.5 70.9273L157.5 71.8727L158 73.2909L158.5 75.1818V76.6V78.0182L157.5 79.4363V79.9091L156.5 80.8545L155.5 81.8L154.5 82.2727L153 82.7454H150H148.5H147L145.5 82.2727L144 81.8H143.5L142.5 80.8545L142 79.4363L141.5 78.0182V76.1273V75.1818L142 73.7636Z" fill="#FFF8F8"/>
<path d="M121 71.8727L122 73.2909L122.5 73.7636V75.1818V77.0727V78.4909L122 79.9091L121.5 80.8545L121 81.8L120 82.2727L118.5 83.2182H116.5H115H114.5H113L111.5 82.7454H110.5L109.5 82.2727L108 81.8L106.5 80.8545L105.5 79.9091L105 78.4909L104.5 77.0727L105 75.1818V73.7636L106.5 71.8727L107.5 70.4545L109.5 69.5091L112.5 69.0363H115L118.5 69.5091L120 70.4545L121 71.8727Z" fill="#FFF8F8"/>
<path d="M142 73.7636L142.5 71.8727L143.5 70.9273L145.5 69.9818L148 69.5091H150H152H153.5L154.5 69.9818L156 70.4545L156.5 70.9273L157.5 71.8727L158 73.2909L158.5 75.1818V76.6V78.0182L157.5 79.4363V79.9091L156.5 80.8545L155.5 81.8L154.5 82.2727L153 82.7454H150H148.5H147L145.5 82.2727L144 81.8H143.5L142.5 80.8545L142 79.4363L141.5 78.0182V76.1273V75.1818L142 73.7636Z" stroke="${OL}"/>
<path d="M121 71.8727L122 73.2909L122.5 73.7636V75.1818V77.0727V78.4909L122 79.9091L121.5 80.8545L121 81.8L120 82.2727L118.5 83.2182H116.5H115H114.5H113L111.5 82.7454H110.5L109.5 82.2727L108 81.8L106.5 80.8545L105.5 79.9091L105 78.4909L104.5 77.0727L105 75.1818V73.7636L106.5 71.8727L107.5 70.4545L109.5 69.5091L112.5 69.0363H115L118.5 69.5091L120 70.4545L121 71.8727Z" stroke="${OL}"/>
<path d="M156.5 75.6545C156.5 79.3096 153.59 82.2727 150 82.2727C146.41 82.2727 143.5 79.3096 143.5 75.6545C143.5 71.9994 146.41 69.0363 150 69.0363C153.59 69.0363 156.5 71.9994 156.5 75.6545Z" class="ka"/>
<path d="M120.5 75.7224C120.5 79.3775 117.59 82.3405 114 82.3405C110.41 82.3405 107.5 79.3775 107.5 75.7224C107.5 72.0672 110.41 69.1042 114 69.1042C117.59 69.1042 120.5 72.0672 120.5 75.7224Z" class="ka"/>
<path d="M118.28 76.2244C118.28 78.0519 116.713 79.5335 114.78 79.5335C112.847 79.5335 111.28 78.0519 111.28 76.2244C111.28 74.3968 112.847 72.9153 114.78 72.9153C116.713 72.9153 118.28 74.3968 118.28 76.2244Z" fill="#161515"/>
<path d="M153.5 75.9902C153.5 77.8177 151.933 79.2993 150 79.2993C148.067 79.2993 146.5 77.8177 146.5 75.9902C146.5 74.1626 148.067 72.6811 150 72.6811C151.933 72.6811 153.5 74.1626 153.5 75.9902Z" fill="#161515"/>
<ellipse cx="117.5" cy="74.7091" rx="1" ry="0.945454" fill="#D9D9D9"/>
<ellipse cx="152.5" cy="74.7091" rx="1" ry="0.945454" fill="#D9D9D9"/>
<path d="M104.5 78.4909L105.5 79.4363L104.5 77.5454V75.6545V74.2363L105.5 72.8181L107.5 70.9272L110.5 69.0363L113.5 68.5636L117.5 69.0363L120.5 70.9272V69.9818V69.0363L118.5 68.0909L117 67.6182L115.5 67.1454L114 66.6727H112.5L110.5 66.2L109.5 65.7272L109 67.6182H107.5H106.5H104L105.5 68.5636L104 69.9818H102L103.5 70.9272L102 71.8727L101 72.8181L103 74.2363L103.5 76.6L104.5 78.4909Z" class="khr"/>
<path d="M123 64.3091L122 62.4182L119 61L116.5 60.0545L114 59.5818H111.5H109L107.5 60.0545L106.5 61.4727L105.5 62.4182L107 61.9454H108H109L110.5 62.4182L113.5 62.8909L114.5 63.3636L117 63.8363H118.5L120.5 64.7818L122.5 65.2545L123 64.3091Z" class="khr"/>
<path d="M104.5 78.4909L105.5 79.4363L104.5 77.5454V75.6545V74.2363L105.5 72.8181L107.5 70.9272L110.5 69.0363L113.5 68.5636L117.5 69.0363L120.5 70.9272V69.9818V69.0363L118.5 68.0909L117 67.6182L115.5 67.1454L114 66.6727H112.5L110.5 66.2L109.5 65.7272L109 67.6182H107.5H106.5H104L105.5 68.5636L104 69.9818H102L103.5 70.9272L102 71.8727L101 72.8181L103 74.2363L103.5 76.6L104.5 78.4909Z" stroke="${OL}"/>
<path d="M123 64.3091L122 62.4182L119 61L116.5 60.0545L114 59.5818H111.5H109L107.5 60.0545L106.5 61.4727L105.5 62.4182L107 61.9454H108H109L110.5 62.4182L113.5 62.8909L114.5 63.3636L117 63.8363H118.5L120.5 64.7818L122.5 65.2545L123 64.3091Z" stroke="${OL}"/>
<path d="M141.5 63.8363V65.2545L146 64.3091L149.5 62.8909L154 61.9454L157.5 61.4727L156.5 60.5272L153.5 59.5818H150H148.5L145.5 60.5272L144 61.4727L142.5 62.8909L141.5 63.8363Z" class="khr"/>
<path d="M144 69.5091L142.5 71.8727L145.5 69.9818L148.5 69.0363H151H153L154.5 69.5091L156.5 70.4545L157.5 71.8727L158.5 73.2909L159 75.6545V77.0727L157.5 79.9091L159 78.4909L160.5 75.1818L161.5 73.2909L162.5 72.3454L161.5 71.8727L160 70.4545L160.5 69.9818L158.5 69.0363L159 67.1454L157.5 68.0909H155.5L154 67.1454V66.2L152 67.1454H149.5L146.5 68.0909L144 69.5091Z" class="khr"/>
<path d="M141.5 63.8363V65.2545L146 64.3091L149.5 62.8909L154 61.9454L157.5 61.4727L156.5 60.5272L153.5 59.5818H150H148.5L145.5 60.5272L144 61.4727L142.5 62.8909L141.5 63.8363Z" stroke="${OL}"/>
<path d="M144 69.5091L142.5 71.8727L145.5 69.9818L148.5 69.0363H151H153L154.5 69.5091L156.5 70.4545L157.5 71.8727L158.5 73.2909L159 75.6545V77.0727L157.5 79.9091L159 78.4909L160.5 75.1818L161.5 73.2909L162.5 72.3454L161.5 71.8727L160 70.4545L160.5 69.9818L158.5 69.0363L159 67.1454L157.5 68.0909H155.5L154 67.1454V66.2L152 67.1454H149.5L146.5 68.0909L144 69.5091Z" stroke="${OL}"/>
<path d="M105 82.05L102.5 79.35V83.85L103.5 88.35L109 91.05L116.5 93.75L127 96H140L146 93.75L154 91.05L159 88.35L162.5 84.75V82.05V78L156 83.85L152.5 84.75L144 83.85L137.5 82.05L131.5 78L126 82.05L118.5 84.75H113L105 82.05Z" class="kgi" stroke="${OL}"/>
<path d="M124 37.3636L118 54.3818L115 47.2909V39.2545L109 44.4545L104 54.3818L105.421 58.4113L106.25 58.1636L111 56.7455L118.8 55.3273L124 54.3818H136.5L143.5 54.9835L147.5 55.3273L158.5 58.3606L159.5 58.6364L166 61.4727L173.5 66.6727L174.5 68.5636L177 76.1273L171 72.8182L168 78.4909L162 84.6364V80.8545L164.5 72.8182L162 65.7273L158.5 58.3606L147.5 55.3273L143.5 54.9835L138.5 66.6727L136.5 63.3636L137.5 68.5636L138.5 72.8182L130 66.6727V70.9273L119.5 56.7455L118.8 55.3273L111 56.7455L106.25 58.1636L102.5 64.7818L99 70.9273L100.5 76.1273L102.5 84.6364L95 78.4909L93.4444 75.1818L88.5 72.8182L90 67.6182L95 63.3636L101.5 59.5818L105.232 58.4675L102.5 56.7455L100.5 42.5636L95 48.7091L93 52.0182L92 58.6364V64.7818L87.5 58.6364L84 67.6182V55.3273H75.5L80.5 50.1273L87.5 39.2545H85.5L79 34.5273L86.5 33.5818L95 30.2727L92 24.1273L93 17.0364L96 20.8182L104 22.7091L102.5 18.9273L104 15.1455L107.5 18.9273L113.5 20.8182L118 19.8727L125 18.9273H128.5L121.5 14.2L125 15.1455L128.5 16.0909H132L136.5 17.0364L141 20.8182L143 18.9273V15.1455L140 9L146.5 12.7818L149.5 18.9273L152.5 15.1455V19.8727L151 24.1273H156.5L164.5 27.9091H171L166 30.2727L171 33.5818L177 37.3636H184L182.5 39.2545L175.5 42.5636L178 44.4545L181.5 50.1273L185.5 54.3818H179V63.3636L177 60.5273L171 48.7091V55.3273L168 61.4727L166 54.3818L158.5 40.6727L159.5 47.2909L153.5 55.3273V45.8727L149.5 37.3636L136.5 35.9455H132L124 37.3636Z" class="khr"/>
<path d="M104 95.5091L109 91.7273L104 87L97.5 87.9455V89.8364L98 91.7273L101.5 87.9455V89.3636L104 93.1455V95.5091Z" class="khr"/>
<path d="M164.5 87.9455L159.5 87L158.5 89.8364L154.5 91.7273L159.5 95.5091V91.7273L160.5 89.8364L164.5 91.7273V87.9455Z" class="khr"/>
<path d="M93.4444 75.1818L88.5 72.8182L90 67.6182L95 63.3636M95 63.3636L101.5 59.5818L106.25 58.1636M95 63.3636L92 66.6727V71.8727L93 74.2364L95 78.4909L102.5 84.6364L100.5 76.1273L99 70.9273L102.5 64.7818L106.25 58.1636M158.5 58.3606L147.5 55.3273L143.5 54.9835M158.5 58.3606L159.5 58.6364L166 61.4727L173.5 66.6727L174.5 68.5636L177 76.1273L171 72.8182L168 78.4909L162 84.6364V80.8545L164.5 72.8182L162 65.7273L158.5 58.3606ZM143.5 54.9835L136.5 54.3818H124L118.8 55.3273M143.5 54.9835L138.5 66.6727L136.5 63.3636L137.5 68.5636L138.5 72.8182L130 66.6727V70.9273L119.5 56.7455L118.8 55.3273M118.8 55.3273L111 56.7455L106.25 58.1636M118 54.3818L124 37.3636L132 35.9455H136.5L149.5 37.3636L153.5 45.8727V55.3273L159.5 47.2909L158.5 40.6727L166 54.3818L168 61.4727L171 55.3273V48.7091L177 60.5273L179 63.3636V54.3818H185.5L181.5 50.1273L178 44.4545L175.5 42.5636L182.5 39.2545L184 37.3636H177L171 33.5818L166 30.2727L171 27.9091H164.5L156.5 24.1273H151L152.5 19.8727V15.1455L149.5 18.9273L146.5 12.7818L140 9L143 15.1455V18.9273L141 20.8182L136.5 17.0364L132 16.0909H128.5L125 15.1455L121.5 14.2L128.5 18.9273H125L118 19.8727L113.5 20.8182L107.5 18.9273L104 15.1455L102.5 18.9273L104 22.7091L96 20.8182L93 17.0364L92 24.1273L95 30.2727L86.5 33.5818L79 34.5273L85.5 39.2545H87.5L80.5 50.1273L75.5 55.3273H84V67.6182L87.5 58.6364L92 64.7818V58.6364L93 52.0182L95 48.7091L100.5 42.5636L102.5 56.7455L105.5 58.6364L104 54.3818L109 44.4545L115 39.2545V47.2909L118 54.3818ZM109 91.7273L104 95.5091V93.1455L101.5 89.3636V87.9455L98 91.7273L97.5 89.8364V87.9455L104 87L109 91.7273ZM159.5 87L164.5 87.9455V91.7273L160.5 89.8364L159.5 91.7273V95.5091L154.5 91.7273L158.5 89.8364L159.5 87Z" stroke="${OL}" stroke-width="2"/>
<path d="M17 90.7818L11 93.1455L12 90.7818L17 86.5273L23.5 82.7455L29.5 80.3818H54L62.5 78.4909L66 76.1273L68 73.7636L73 69.5091L78 68.0909L86.5 66.2L87.5 64.7818L81.5 66.2H71L66 67.1455L62.5 69.5091L58 72.3455L55 70.9273H50L46 69.5091H42L48 66.2L51 63.8364L58 61.9455L62.5 60.5273L70 61.9455H80L83 60.5273L87.5 63.8364V60.5273L88.5 61.9455L90 63.8364H92.5V57.2182L93.5 53.9091V51.0727L95 49.6545L97 46.3455L100 42.5636L101 44.4545V49.6545L102 53.9091L104.5 56.7455L106 50.6L107 47.7636L108.5 46.3455L109.5 43.5091L111 41.6182L112.5 40.6727L115 39.7273V47.7636L116.5 52.0182L119 53.9091L120 49.6545L121 46.3455L122 40.6727L124.5 36.8909L127.5 36.4182H140L144 36.8909L149 37.8364L150.5 39.7273L152.5 44.4545L153.5 47.7636V51.0727L154 55.8L155.5 52.9636L159 47.7636L160 44.4545L161.5 46.3455L164 50.6L167 57.2182L169 60.5273L170.5 57.2182L171.5 52.9636V50.6L175 55.8V69.5091L171.5 64.7818L166 60.5273L157 57.2182L148 54.8545L140.5 53.9091H122L113.5 55.8L104.5 57.2182L97 61.9455L93.5 63.8364L90 67.1455L88.5 69.5091L87.5 70.9273L85 72.3455L80 73.7636L78 75.1818L77 77.0727L75.5 80.3818L73 86.5273L71 90.7818L67 95.0364L62.5 98.8182L54 103.545H48L43 101.182L37 97.4L30.5 95.0364L23.5 91.7273L17 90.7818Z" class="kmk"/>
<path d="M104.5 57.2182L97 61.9455L93.5 63.8364L90 67.1455L88.5 69.5091L87.5 70.9273L85 72.3455L80 73.7636L78 75.1818L77 77.0727L75.5 80.3818L73 86.5273L71 90.7818L67 95.0364L62.5 98.8182L54 103.545H48L43 101.182L37 97.4L30.5 95.0364L23.5 91.7273L17 90.7818L11 93.1455L12 90.7818L17 86.5273L23.5 82.7455L29.5 80.3818H54L62.5 78.4909L66 76.1273L68 73.7636L73 69.5091L78 68.0909L86.5 66.2L87.5 64.7818L81.5 66.2H71L66 67.1455L62.5 69.5091L58 72.3455L55 70.9273H50L46 69.5091H42L48 66.2L51 63.8364L58 61.9455L62.5 60.5273L70 61.9455H80L83 60.5273L87.5 63.8364V60.5273L88.5 61.9455L90 63.8364H92.5V57.2182L93.5 53.9091V51.0727L95 49.6545L97 46.3455L100 42.5636L101 44.4545V49.6545L102 53.9091L104.5 56.7455M104.5 57.2182L113.5 55.8L122 53.9091H140.5L148 54.8545L157 57.2182L166 60.5273L171.5 64.7818L175 69.5091V55.8L171.5 50.6V52.9636L170.5 57.2182L169 60.5273L167 57.2182L164 50.6L161.5 46.3455L160 44.4545L159 47.7636L155.5 52.9636L154 55.8L153.5 51.0727V47.7636L152.5 44.4545L150.5 39.7273L149 37.8364L144 36.8909L140 36.4182H127.5L124.5 36.8909L122 40.6727L121 46.3455L120 49.6545L119 53.9091L116.5 52.0182L115 47.7636V39.7273L112.5 40.6727L111 41.6182L109.5 43.5091L108.5 46.3455L107 47.7636L106 50.6L104.5 56.7455M104.5 57.2182V56.7455M131 47.7636L133 52.0182L136 47.7636L141.5 45.4L136 43.5091L134 37.8364L131 42.5636L124.5 44.4545L131 47.7636Z" stroke="${A}"/>
<path d="M134 37.8364L131.5 42.5636L124.5 44.9273L131.5 48.2364L133 52.0182L136.5 47.2909L141.5 44.9273L135.5 42.5636L134 37.8364Z" class="ksw" stroke="${OL}"/>

</svg>`;
}

// ── Zzz visibility helper ─────────────────────────────────────────────────────
function _kaiUpdateZzz(el, isSleep) {
  const zzz = el?.querySelector('.kai-zzz-group');
  if (zzz) zzz.style.opacity = isSleep ? '1' : '0';
}

// ── Master sync ───────────────────────────────────────────────────────────────
function kaiUpdate() {
  const statKey = kaiCurrentActivity();
  const actInfo = KAI_ACTIVITY[statKey] || KAI_ACTIVITY._idle;
  const cfg     = kaiGetConfig();
  // colKey comes from actInfo — covers extended activities (martial_arts, creative, etc.)
  const colKey = actInfo.colKey || '_default';

  kaiApplyColour(colKey);
  kaiApplyOutfit(actInfo.outfit || 'gi');
  kaiSetRiveState(null, statKey);     // Rive: switch animation state on all canvases
  _kaiUpdateDashCard(statKey, actInfo, cfg);
  _kaiRefreshProfilePreview(cfg, actInfo.anim);
}

// ── Today strip ───────────────────────────────────────────────────────────────
function _buildTodayStrip() {
  const todayStr = new Date().toISOString().split('T')[0];
  const items = [];

  const workouts = (DOS.data.health?.workouts || []).filter(w => w.date === todayStr);
  if (workouts.length) items.push(`💪 ${workouts.length} workout${workouts.length > 1 ? 's' : ''}`);

  const expenses = (DOS.data.finances?.expenses || []).filter(e => e.date === todayStr);
  if (expenses.length) {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    items.push(`💰 R${Math.round(total)} logged`);
  }

  const xpToday = (DOS.data.character?.xpHistory || [])
    .filter(h => h.date && h.date.startsWith(todayStr))
    .reduce((s, h) => s + h.amount, 0);
  if (xpToday > 0) items.push(`⚡ +${xpToday} XP`);

  const sessions = (DOS.data.intelligence?.certifications || [])
    .flatMap(c => c.studySessions || [])
    .filter(s => s.date && s.date.startsWith(todayStr));
  if (sessions.length) items.push(`📚 ${sessions.length} study session${sessions.length > 1 ? 's' : ''}`);

  if (!items.length) {
    return `<div class="kai-today-strip">
      <span class="kai-today-empty">Nothing logged yet today</span>
    </div>`;
  }
  return `<div class="kai-today-strip">
    <div class="kai-today-events">${items.map(i => `<span class="kai-today-chip">${i}</span>`).join('')}</div>
  </div>`;
}

// ── Avatar tap reaction ────────────────────────────────────────────────────────
const _KAI_REACTIONS = [
  'Focus. Train. Level up.',
  'No excuses, only results.',
  'What will you log today?',
  'The grind continues.',
  'System online.',
  'Another day, another rep.',
  'Pain is temporary. Progress is permanent.',
  'Log something. Anything.',
];
let _reactionIdx = 0;

function kaiTapReaction() {
  const svg = document.querySelector('#kai-dashboard-card .kai-svg');
  if (svg) {
    svg.classList.remove('kai-tap-bounce');
    void svg.offsetWidth;
    svg.classList.add('kai-tap-bounce');
    setTimeout(() => svg.classList.remove('kai-tap-bounce'), 500);
  }
  const msg = _KAI_REACTIONS[_reactionIdx++ % _KAI_REACTIONS.length];
  if (typeof kaiSpeechBubble === 'function') kaiSpeechBubble(msg, 2400);
  if (navigator.vibrate) navigator.vibrate(18);
}

// ── Idle escalation ───────────────────────────────────────────────────────────
let _kaiIdleTimer = null;

function _kaiScheduleIdleNudge() {
  if (_kaiIdleTimer) clearTimeout(_kaiIdleTimer);
  _kaiIdleTimer = setTimeout(() => {
    if (typeof kaiSpeechBubble === 'function') kaiSpeechBubble('Still there? Log something.', 3000);
    _kaiIdleTimer = null;
  }, 30000);
}

function _kaiResetIdle() {
  if (_kaiIdleTimer) { clearTimeout(_kaiIdleTimer); _kaiIdleTimer = null; }
  _kaiScheduleIdleNudge();
}
document.addEventListener('touchstart', _kaiResetIdle, { passive: true });
document.addEventListener('click',      _kaiResetIdle, { passive: true });

// ── DASHBOARD CARD ────────────────────────────────────────────────────────────
function renderKaiDashboardCard() {
  const el = document.getElementById('kai-dashboard-card');
  if (!el) return;

  const cfg     = kaiGetConfig();
  const statKey = kaiCurrentActivity();
  const actInfo = KAI_ACTIVITY[statKey] || KAI_ACTIVITY._idle;
  const colKey  = statKey && statKey !== '_sleep' && statKey !== '_idle' ? statKey : '_default';

  kaiApplyColour(colKey);

  const char  = DOS.data.character;
  const stats = char.stats;
  const avgLv = Math.floor((stats.health.level + stats.finances.level +
                             stats.intelligence.level + stats.work.level) / 4);
  const streak  = char.dailyStreak?.count || 0;
  const isSleep = statKey === '_sleep';

  el.innerHTML = `
    <div class="kai-card kai-dashboard-card">
      <div class="kai-dash-inner">

        <div class="kai-stage" onclick="kaiTapReaction()" style="cursor:pointer">
          ${buildKaiStage('kai-canvas-dash', false)}
        </div>

        <div class="kai-info-panel">
          <div class="kai-name-row">
            <span class="kai-display-name">${cfg.name || 'KAI'}</span>
            <span class="kai-level-badge">Lv. ${avgLv}</span>
          </div>

          <div class="kai-activity-badge">
            <div class="kai-activity-dot"></div>
            <div class="kai-activity-text">
              <span class="kai-activity-label">${actInfo.icon} ${actInfo.label}</span>
              ${statKey && statKey !== '_idle' && statKey !== '_sleep'
                ? `<span style="font-size:0.7rem;color:var(--text-dim)">${capitalize(statKey)} stat active</span>`
                : `<span style="font-size:0.7rem;color:var(--text-dim)">Tap avatar for a push</span>`
              }
            </div>
          </div>

          <div class="kai-mini-stats">
            <div class="kai-mini-stat" onclick="DOS.navigate('health')" title="Go to Health">
              <span class="kai-mini-val health">Lv.${stats.health.level}</span>
              <span class="kai-mini-lbl">Health</span>
            </div>
            <div class="kai-mini-stat" onclick="DOS.navigate('finances')" title="Go to Finances">
              <span class="kai-mini-val finances">Lv.${stats.finances.level}</span>
              <span class="kai-mini-lbl">Finance</span>
            </div>
            <div class="kai-mini-stat" onclick="DOS.navigate('intelligence')" title="Go to Intelligence">
              <span class="kai-mini-val intelligence">Lv.${stats.intelligence.level}</span>
              <span class="kai-mini-lbl">Intel</span>
            </div>
            <div class="kai-mini-stat" onclick="DOS.navigate('work')" title="Go to Work">
              <span class="kai-mini-val work">Lv.${stats.work.level}</span>
              <span class="kai-mini-lbl">Work</span>
            </div>
          </div>

          ${streak > 0
            ? `<div class="kai-streak-pill">🔥 ${streak} day streak</div>`
            : `<div class="kai-streak-pill" style="color:var(--text-dim)">No streak yet — log today</div>`
          }

          ${_buildTodayStrip()}
        </div>

      </div>
    </div>`;

  _kaiUpdateZzz(el, isSleep);
  kaiInitRive('kai-canvas-dash');
  _kaiScheduleIdleNudge();
}

// ── Internal: lightweight update (no full re-render) ─────────────────────────
function _kaiUpdateDashCard(statKey, actInfo, cfg) {
  const stageEl = document.querySelector('#kai-dashboard-card .kai-stage');
  if (!stageEl) { renderKaiDashboardCard(); return; }

  // If Rive is active, just change its state
  if (_kaiRiveInst['kai-canvas-dash']) {
    kaiSetRiveState('kai-canvas-dash', statKey);
  } else {
    // SVG bakes hex colours at render-time — must re-render to pick up new accent
    const tmp = document.createElement('div');
    tmp.innerHTML = buildKaiSVG({ gender: cfg.gender || 'male', animClass: `kai-anim-${actInfo.anim}` });
    const oldSVG = stageEl.querySelector('.kai-svg');
    const newSVG = tmp.firstElementChild;
    if (oldSVG && newSVG) oldSVG.replaceWith(newSVG);
  }

  _kaiUpdateZzz(stageEl, statKey === '_sleep');

  const labelEl = document.querySelector('#kai-dashboard-card .kai-activity-label');
  if (labelEl) labelEl.textContent = `${actInfo.icon} ${actInfo.label}`;
}

// ── PROFILE CARD ──────────────────────────────────────────────────────────────
function buildKaiProfileCard() {
  const cfg     = kaiGetConfig();
  const statKey = kaiCurrentActivity();
  const actInfo = KAI_ACTIVITY[statKey] || KAI_ACTIVITY._idle;

  return `
    <section class="kai-card kai-profile-card">
      <div class="kai-profile-heading">Your Second Self</div>

      <div class="kai-profile-body">
        <div class="kai-profile-stage" id="kai-profile-stage">
          ${buildKaiStage('kai-canvas-profile', true)}
        </div>

        <div class="kai-controls">

          <div>
            <span class="kai-ctrl-label">Avatar</span>
            <div class="kai-gender-toggle">
              <button class="kai-toggle-btn ${cfg.gender !== 'female' ? 'active' : ''}"
                      onclick="kaiSetGender('male')">♂ Male</button>
              <button class="kai-toggle-btn ${cfg.gender === 'female' ? 'active' : ''}"
                      onclick="kaiSetGender('female')">♀ Female</button>
            </div>
          </div>

          <div>
            <span class="kai-ctrl-label">Name</span>
            <input id="kai-name-input" class="kai-name-input"
                   type="text" maxlength="16"
                   value="${cfg.name || 'KAI'}"
                   placeholder="Name your avatar"/>
          </div>

          <div>
            <span class="kai-ctrl-label">Current state</span>
            <div style="display:flex;align-items:center;gap:7px;font-size:0.78rem;color:var(--text-dim)">
              <div class="kai-activity-dot"
                   style="width:7px;height:7px;border-radius:50%;background:var(--kai-accent);animation:kai-pulse 2.4s ease-in-out infinite"></div>
              ${actInfo.icon} ${actInfo.label}
            </div>
          </div>

          <div>
            <span class="kai-ctrl-label">Appearance</span>
            <div class="kai-appearance-pickers">
              <label class="kai-picker-row">
                <span>Skin</span>
                <input type="color" id="kai-skin-pick" value="${cfg.skin || '#F0BA8F'}"
                       oninput="kaiPreviewAppearance()">
              </label>
              <label class="kai-picker-row">
                <span>Hair</span>
                <input type="color" id="kai-hair-pick" value="${cfg.hair || '#5E5E69'}"
                       oninput="kaiPreviewAppearance()">
              </label>
              <label class="kai-picker-row">
                <span>Clothes</span>
                <input type="color" id="kai-gi-pick" value="${cfg.gi || '#111111'}"
                       oninput="kaiPreviewAppearance()">
              </label>
            </div>
          </div>

          <div class="kai-rive-status" id="kai-rive-status" style="font-size:0.7rem;color:var(--text-dim);display:none">
            🎨 Rive model active
          </div>

          <div class="kai-save-row">
            <button class="kai-save-btn"    onclick="kaiSaveProfile()">Save KAI</button>
            <button class="kai-preview-btn" onclick="kaiCyclePreview()">Preview →</button>
          </div>

        </div>
      </div>

      <div style="font-size:0.7rem;color:var(--text-dim);line-height:1.5;padding-top:8px;border-top:1px solid var(--border-lite)">
        KAI mirrors your calendar — accent colour and animation change automatically when a Health, Work, Intelligence or Finance event is active.
      </div>
    </section>`;
}

// ── Profile action handlers ───────────────────────────────────────────────────
let _kaiPreviewStat = 0;
const _KAI_PREVIEW_CYCLE = ['idle', 'fitness', 'work', 'intelligence', 'finances', 'sleep'];

function kaiSetGender(gender) {
  kaiSaveConfig({ gender });
  document.querySelectorAll('.kai-gender-toggle .kai-toggle-btn').forEach((btn, i) => {
    btn.classList.toggle('active', (i === 0 && gender === 'male') || (i === 1 && gender === 'female'));
  });
  // Rive: update isFemale input
  _kaiRiveSet(null, KAI_RIVE_FEMALE, gender === 'female');
  // SVG fallback: full re-render (gender changes the hair shape)
  if (!_kaiRiveInst['kai-canvas-profile']) {
    _kaiRefreshProfilePreview(kaiGetConfig());
  }
  renderKaiDashboardCard();
}

function kaiPreviewAppearance() {
  const skin = document.getElementById('kai-skin-pick')?.value;
  const hair = document.getElementById('kai-hair-pick')?.value;
  const gi   = document.getElementById('kai-gi-pick')?.value;
  const root = document.documentElement;
  if (skin) root.style.setProperty('--kai-skin', skin);
  if (hair) root.style.setProperty('--kai-hair', hair);
  if (gi)   root.style.setProperty('--kai-gi',   gi);
  _kaiRefreshProfilePreview(kaiGetConfig());
}

function kaiApplyAppearance() {
  const cfg  = kaiGetConfig();
  const root = document.documentElement;
  if (cfg.skin) root.style.setProperty('--kai-skin', cfg.skin);
  if (cfg.hair) root.style.setProperty('--kai-hair', cfg.hair);
  if (cfg.gi)   root.style.setProperty('--kai-gi',   cfg.gi);
}

function kaiSaveProfile() {
  const name = document.getElementById('kai-name-input')?.value?.trim() || 'KAI';
  const skin = document.getElementById('kai-skin-pick')?.value;
  const hair = document.getElementById('kai-hair-pick')?.value;
  const gi   = document.getElementById('kai-gi-pick')?.value;
  kaiSaveConfig({ name, ...(skin && { skin }), ...(hair && { hair }), ...(gi && { gi }) });
  kaiApplyAppearance();
  showToast(`KAI saved ✓`, 'gold');
  renderKaiDashboardCard();
  renderKaiCompanion();
}

function kaiCyclePreview() {
  _kaiPreviewStat = (_kaiPreviewStat + 1) % _KAI_PREVIEW_CYCLE.length;
  const animName  = _KAI_PREVIEW_CYCLE[_kaiPreviewStat];

  if (_kaiRiveInst['kai-canvas-profile']) {
    // Rive mode: just push the input
    _kaiRiveSet('kai-canvas-profile', KAI_RIVE_ACTIVITY, KAI_RIVE_ANIM_IDX[animName] ?? 0);
  } else {
    // SVG fallback: re-render stage with new animClass
    const cfg   = kaiGetConfig();
    const stage = document.getElementById('kai-profile-stage');
    if (stage) {
      stage.innerHTML = buildKaiSVG({ gender: cfg.gender || 'male',
                                      animClass: `kai-anim-${animName}`, small: true });
      _kaiUpdateZzz(stage, animName === 'sleep');
    }
  }
}


function _kaiRefreshProfilePreview(cfg, animClass) {
  if (_kaiRiveInst['kai-canvas-profile']) return; // Rive handles its own render
  const stage = document.getElementById('kai-profile-stage');
  if (!stage) return;
  const ac = animClass
    ? `kai-anim-${animClass}`
    : `kai-anim-${(KAI_ACTIVITY[kaiCurrentActivity()] || KAI_ACTIVITY._idle).anim}`;
  stage.innerHTML = buildKaiSVG({ gender: cfg.gender || 'male', animClass: ac, small: true });
}

// ── Profile card post-insert hook ─────────────────────────────────────────────
// Called by app.js renderProfile() after the card HTML is in the DOM
function kaiProfileMounted() {
  kaiInitRive('kai-canvas-profile').then(() => {
    // Show Rive status badge if loaded
    if (_kaiRiveInst['kai-canvas-profile']) {
      const badge = document.getElementById('kai-rive-status');
      if (badge) badge.style.display = '';
    }
  });
}

// ── PERSISTENT COMPANION ─────────────────────────────────────────────────────

let _companionOpen = false;
let _speechTimer   = null;

// Render the mini avatar into the companion bubble
function renderKaiCompanion() {
  const avatarEl = document.getElementById('kai-companion-avatar');
  if (!avatarEl) return;

  const cfg     = kaiGetConfig();
  const statKey = kaiCurrentActivity();
  const actInfo = KAI_ACTIVITY[statKey] || KAI_ACTIVITY._idle;

  // Bust crop (face/head viewBox) so the circular companion frame shows the face
  avatarEl.innerHTML = buildKaiSVG({
    gender: cfg.gender || 'male',
    animClass: `kai-anim-${actInfo.anim}`,
    small: true,
    bust: true
  });

  // Update status dot colour
  const dot = document.getElementById('kai-companion-dot');
  if (dot) dot.style.background = 'var(--kai-accent)';
}

// Called when user taps the companion bubble
function kaiCompanionTap() {
  if (_companionOpen) { kaiCompanionClose(); return; }

  // Populate sheet with dashboard card content
  const sheetBody = document.getElementById('kai-sheet-body');
  if (sheetBody) {
    const cfg     = kaiGetConfig();
    const statKey = kaiCurrentActivity();
    const actInfo = KAI_ACTIVITY[statKey] || KAI_ACTIVITY._idle;
    const colKey  = actInfo.colKey || '_default';
    kaiApplyColour(colKey);

    const char  = DOS.data.character;
    const stats = char.stats;
    const avgLv = Math.floor((stats.health.level + stats.finances.level +
                               stats.intelligence.level + stats.work.level) / 4);
    const streak = char.dailyStreak?.count || 0;

    sheetBody.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;padding:8px 0 16px">
        <div style="width:90px;height:120px;display:flex;align-items:flex-end;justify-content:center;
                    background:var(--bg-section);border-radius:14px;overflow:hidden;flex-shrink:0">
          ${buildKaiSVG({ gender: cfg.gender || 'male', animClass: `kai-anim-${actInfo.anim}`, small: true })}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px">
          <div style="font-size:1.1rem;font-weight:900;color:var(--text)">${cfg.name || 'KAI'}</div>
          <div class="kai-level-badge" style="display:inline-flex;width:fit-content">Lv. ${avgLv}</div>
          <div class="kai-activity-badge">
            <div class="kai-activity-dot"></div>
            <div>
              <div class="kai-activity-label">${actInfo.icon} ${actInfo.label}</div>
              <div style="font-size:0.68rem;color:var(--text-dim)">
                ${colKey !== '_default' && colKey !== '_idle' ? capitalize(colKey.replace('_',' ')) + ' mode' : 'No active event'}
              </div>
            </div>
          </div>
          ${streak > 0 ? `<div class="kai-streak-pill">🔥 ${streak} day streak</div>` : ''}
        </div>
      </div>
      <div class="kai-mini-stats" style="margin-bottom:16px">
        <div class="kai-mini-stat"><span class="kai-mini-val health">Lv.${stats.health.level}</span><span class="kai-mini-lbl">Health</span></div>
        <div class="kai-mini-stat"><span class="kai-mini-val finances">Lv.${stats.finances.level}</span><span class="kai-mini-lbl">Finance</span></div>
        <div class="kai-mini-stat"><span class="kai-mini-val intelligence">Lv.${stats.intelligence.level}</span><span class="kai-mini-lbl">Intel</span></div>
        <div class="kai-mini-stat"><span class="kai-mini-val work">Lv.${stats.work.level}</span><span class="kai-mini-lbl">Work</span></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" style="flex:1;font-size:0.8rem"
                onclick="kaiCompanionClose();DOS.navigate('dashboard')">Dashboard</button>
        <button class="btn btn-outline" style="flex:1;font-size:0.8rem"
                onclick="kaiCompanionClose();DOS.navigate('profile')">Customise KAI</button>
      </div>`;
  }

  document.getElementById('kai-sheet-backdrop')?.classList.add('open');
  document.getElementById('kai-bottom-sheet')?.classList.add('open');
  _companionOpen = true;
}

function kaiCompanionClose() {
  document.getElementById('kai-sheet-backdrop')?.classList.remove('open');
  document.getElementById('kai-bottom-sheet')?.classList.remove('open');
  _companionOpen = false;
}

// ── KAI speech bubble ────────────────────────────────────────────────────────
function kaiSpeechBubble(msg, duration = 3000) {
  const bubble = document.getElementById('kai-speech-bubble');
  if (!bubble) return;
  if (_speechTimer) clearTimeout(_speechTimer);

  bubble.textContent = msg;
  bubble.classList.add('visible');

  _speechTimer = setTimeout(() => {
    bubble.classList.remove('visible');
    _speechTimer = null;
  }, duration);
}

// ── Poll calendar every 5 min ─────────────────────────────────────────────────
setInterval(kaiUpdate, 5 * 60 * 1000);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    if (DOS.data.character?.kaiColors) {
      delete DOS.data.character.kaiColors;
      DOS.save();
    }
    kaiApplyAppearance();
    kaiUpdate();
    renderKaiCompanion();
  }, 200));
} else {
  setTimeout(() => {
    if (DOS.data.character?.kaiColors) {
      delete DOS.data.character.kaiColors;
      DOS.save();
    }
    kaiApplyAppearance();
    kaiUpdate();
    renderKaiCompanion();
  }, 200);
}
