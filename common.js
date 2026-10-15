/* Sopa Jurídica — código compartido (tiempo real, avatares, sonidos) */
const SJ = (() => {
  const BROKERS = {
    emqx: 'wss://broker.emqx.io:8084/mqtt',
    hivemq: 'wss://broker.hivemq.com:8884/mqtt',
    local: 'ws://localhost:8888'
  };
  const params = new URLSearchParams(location.search);
  const SALA = (params.get('sala') || 'clase').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'clase';
  const BROKER = BROKERS[params.get('b')] || BROKERS.emqx;
  const BASE = 'sopajuridica-scg/v1/' + SALA;

  const DEFAULT_WORDS = ['DERECHO', 'JUEZ', 'LEY', 'AMPARO', 'CONTRATO', 'DEMANDA', 'TESTIGO', 'SENTENCIA', 'NOTARIO', 'DELITO'];

  /* ---------- almacenamiento seguro ---------- */
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('sj_' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('sj_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- RNG con semilla ---------- */
  function hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  }
  function rng(seed) {
    let a = hash(String(seed))();
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function normWord(w) {
    return w.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/Ñ/g, 'N').replace(/[^A-Z]/g, '');
  }

  /* ---------- generador de sopa de letras ---------- */
  const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
  const FILL = 'AAAAABCCDEEEEEFGHIIIILLLMMNNNOOOOPRRRSSSTTTUUVYZ';
  function buildPuzzle(words, seed) {
    const list = words.map(normWord).filter(w => w.length >= 2);
    const longest = Math.max(...list.map(w => w.length), 8);
    const size = Math.min(14, Math.max(11, longest + 2));
    for (let attempt = 0; attempt < 60; attempt++) {
      const r = rng(seed + '#' + attempt);
      const grid = Array.from({ length: size }, () => Array(size).fill(''));
      const placed = [];
      const sorted = [...list].sort((a, b) => b.length - a.length);
      let ok = true;
      for (const w of sorted) {
        let done = false;
        for (let t = 0; t < 400 && !done; t++) {
          const d = DIRS[Math.floor(r() * (t < 200 ? 8 : 4) + (t < 200 ? 0 : 0))];
          const r0 = Math.floor(r() * size), c0 = Math.floor(r() * size);
          const r1 = r0 + d[0] * (w.length - 1), c1 = c0 + d[1] * (w.length - 1);
          if (r1 < 0 || r1 >= size || c1 < 0 || c1 >= size) continue;
          let fits = true;
          for (let i = 0; i < w.length; i++) {
            const ch = grid[r0 + d[0] * i][c0 + d[1] * i];
            if (ch && ch !== w[i]) { fits = false; break; }
          }
          if (!fits) continue;
          const cells = [];
          for (let i = 0; i < w.length; i++) { grid[r0 + d[0] * i][c0 + d[1] * i] = w[i]; cells.push([r0 + d[0] * i, c0 + d[1] * i]); }
          placed.push({ word: w, cells });
          done = true;
        }
        if (!done) { ok = false; break; }
      }
      if (!ok) continue;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!grid[y][x]) grid[y][x] = FILL[Math.floor(r() * FILL.length)];
      return { size, grid, placed, words: list };
    }
    throw new Error('No se pudo generar la sopa');
  }

  /* ---------- avatares ---------- */
  const HATS = [
    { id: 'birrete', name: 'Birrete' },
    { id: 'peluca', name: 'Peluca de juez' },
    { id: 'copa', name: 'Sombrero de copa' },
    { id: 'charro', name: 'Charro' },
    { id: 'detective', name: 'Detective' },
    { id: 'corona', name: 'Corona Suprema' },
    { id: 'vikingo', name: 'Vikingo' },
    { id: 'chef', name: 'Chef del Derecho' },
    { id: 'ninguno', name: 'Sin sombrero' }
  ];
  const SKINS = ['#F8D5B5', '#E8B48A', '#C98E62', '#9C6B44', '#6E4A2E', '#FFE0C2'];
  const BGS = ['#C4B5FD', '#DDD6FE', '#A78BFA', '#F0ABFC', '#E9D5FF', '#D8B4FE', '#FBCFE8', '#BAE6FD'];
  const FACES = ['sonrisa', 'carcajada', 'sorpresa', 'picaro', 'serio', 'guino'];
  const ACCS = ['ninguno', 'lentes', 'monoculo', 'bigote', 'barba', 'lentesbigote'];
  const PROPS = ['mazo', 'codigo', 'balanza', 'maletin'];

  function randomLook(seed) {
    const r = rng(seed);
    const p = a => a[Math.floor(r() * a.length)];
    return { skin: p(SKINS), bg: p(BGS), face: p(FACES), acc: p(ACCS), prop: p(PROPS), hat: 'birrete' };
  }

  function hatSVG(h) {
    switch (h) {
      case 'birrete': return `<path d="M22 30 L50 18 L78 30 L50 42 Z" fill="#1F1235"/><rect x="34" y="31" width="32" height="10" rx="3" fill="#2E1A4D"/><path d="M50 30 L72 36 L72 50" stroke="#F5C542" stroke-width="2.5" fill="none"/><circle cx="72" cy="52" r="3.5" fill="#F5C542"/>`;
      case 'peluca': return `<g fill="#F7F5FF" stroke="#CFC6EA" stroke-width="1.2">${[[30, 34], [38, 26], [50, 23], [62, 26], [70, 34], [26, 46], [74, 46], [25, 58], [75, 58], [27, 70], [73, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8"/>`).join('')}</g>`;
      case 'copa': return `<ellipse cx="50" cy="34" rx="28" ry="5" fill="#120A20"/><rect x="34" y="6" width="32" height="28" rx="3" fill="#1A0F2E"/><rect x="34" y="25" width="32" height="6" fill="#8B5CF6"/>`;
      case 'charro': return `<ellipse cx="50" cy="35" rx="44" ry="9" fill="#7C4A1E"/><ellipse cx="50" cy="33" rx="44" ry="7" fill="#A0652C"/><path d="M34 34 Q36 10 50 10 Q64 10 66 34 Z" fill="#A0652C"/><path d="M35 28 Q50 22 65 28" stroke="#F5C542" stroke-width="3" fill="none"/><path d="M10 35 Q50 48 90 35" stroke="#F5C542" stroke-width="1.5" fill="none" stroke-dasharray="3 3"/>`;
      case 'detective': return `<path d="M24 36 Q26 14 50 13 Q74 14 76 36 Z" fill="#8A6A3B"/><path d="M24 36 Q50 30 76 36 L80 40 Q50 34 20 40 Z" fill="#6B4F28"/><path d="M30 30 L70 30 M28 24 L72 24 M34 18 L66 18" stroke="#5A4020" stroke-width="1.5"/><path d="M50 13 L50 8" stroke="#6B4F28" stroke-width="3"/>`;
      case 'corona': return `<path d="M27 36 L27 16 L37 26 L44 10 L50 22 L56 10 L63 26 L73 16 L73 36 Z" fill="#F5C542" stroke="#C9971A" stroke-width="1.5"/><circle cx="50" cy="29" r="3.5" fill="#8B5CF6"/><circle cx="37" cy="31" r="2.5" fill="#EC4899"/><circle cx="63" cy="31" r="2.5" fill="#22D3EE"/>`;
      case 'vikingo': return `<path d="M27 38 Q27 14 50 14 Q73 14 73 38 Z" fill="#9CA3AF"/><rect x="26" y="34" width="48" height="6" rx="2" fill="#6B7280"/><path d="M27 30 Q12 26 14 8 Q20 22 30 24 Z" fill="#FFF7E6" stroke="#D6C7A1"/><path d="M73 30 Q88 26 86 8 Q80 22 70 24 Z" fill="#FFF7E6" stroke="#D6C7A1"/>`;
      case 'chef': return `<rect x="33" y="22" width="34" height="14" fill="#fff" stroke="#E5E7EB"/><circle cx="38" cy="16" r="9" fill="#fff"/><circle cx="50" cy="11" r="10" fill="#fff"/><circle cx="62" cy="16" r="9" fill="#fff"/>`;
      default: return '';
    }
  }
  function faceSVG(f) {
    const eyes = f === 'guino'
      ? `<circle cx="42" cy="50" r="3" fill="#1F1235"/><path d="M55 50 Q59 47 62 50" stroke="#1F1235" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
      : f === 'sorpresa'
        ? `<circle cx="42" cy="49" r="4" fill="#fff" stroke="#1F1235" stroke-width="1.5"/><circle cx="42" cy="49" r="2" fill="#1F1235"/><circle cx="58" cy="49" r="4" fill="#fff" stroke="#1F1235" stroke-width="1.5"/><circle cx="58" cy="49" r="2" fill="#1F1235"/>`
        : `<circle cx="42" cy="50" r="3" fill="#1F1235"/><circle cx="58" cy="50" r="3" fill="#1F1235"/>`;
    const mouths = {
      sonrisa: `<path d="M41 61 Q50 69 59 61" stroke="#1F1235" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
      carcajada: `<path d="M40 59 Q50 74 60 59 Z" fill="#7F1D1D"/><path d="M44 66 Q50 70 56 66" fill="#F87171"/>`,
      sorpresa: `<ellipse cx="50" cy="64" rx="4" ry="5" fill="#7F1D1D"/>`,
      picaro: `<path d="M42 63 Q52 66 59 59" stroke="#1F1235" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
      serio: `<path d="M43 63 L57 63" stroke="#1F1235" stroke-width="2.5" stroke-linecap="round"/>`,
      guino: `<path d="M41 60 Q50 70 59 60" stroke="#1F1235" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    };
    const brows = f === 'serio' ? `<path d="M37 43 L46 45 M63 43 L54 45" stroke="#1F1235" stroke-width="2" stroke-linecap="round"/>` : f === 'picaro' ? `<path d="M37 44 Q42 41 46 44 M54 42 Q58 40 63 43" stroke="#1F1235" stroke-width="2" fill="none"/>` : '';
    return eyes + brows + (mouths[f] || mouths.sonrisa) + `<circle cx="36" cy="58" r="3.5" fill="#F472B6" opacity=".35"/><circle cx="64" cy="58" r="3.5" fill="#F472B6" opacity=".35"/>`;
  }
  function accSVG(a) {
    const lentes = `<g stroke="#1F1235" stroke-width="2" fill="rgba(255,255,255,.35)"><circle cx="42" cy="50" r="6.5"/><circle cx="58" cy="50" r="6.5"/><path d="M48.5 50 L51.5 50"/></g>`;
    const bigote = `<path d="M40 58 Q45 54 50 57 Q55 54 60 58 Q55 61 50 59 Q45 61 40 58 Z" fill="#3B2412"/>`;
    switch (a) {
      case 'lentes': return lentes;
      case 'monoculo': return `<circle cx="58" cy="50" r="6.5" stroke="#C9971A" stroke-width="2" fill="rgba(255,255,255,.3)"/><path d="M64 53 Q68 64 66 74" stroke="#C9971A" stroke-width="1" fill="none"/>`;
      case 'bigote': return bigote;
      case 'barba': return `<path d="M32 56 Q34 80 50 82 Q66 80 68 56 Q60 70 50 70 Q40 70 32 56 Z" fill="#4A2E18"/>`;
      case 'lentesbigote': return lentes + bigote;
      default: return '';
    }
  }
  function propSVG(p) {
    switch (p) {
      case 'mazo': return `<g transform="rotate(-30 80 82)"><rect x="76" y="78" width="4" height="18" fill="#7C4A1E"/><rect x="69" y="72" width="18" height="9" rx="2" fill="#A0652C"/></g>`;
      case 'codigo': return `<rect x="72" y="76" width="16" height="20" rx="2" fill="#7C3AED"/><rect x="74" y="79" width="12" height="3" fill="#F5C542"/>`;
      case 'balanza': return `<g stroke="#C9971A" stroke-width="1.8" fill="none"><path d="M80 74 L80 96 M70 78 L90 78"/><path d="M70 78 L66 86 L74 86 Z M90 78 L86 86 L94 86 Z" fill="#F5C542"/></g>`;
      case 'maletin': return `<rect x="70" y="80" width="20" height="14" rx="2" fill="#5B3A1A"/><path d="M76 80 L76 77 L84 77 L84 80" stroke="#5B3A1A" stroke-width="2" fill="none"/>`;
      default: return '';
    }
  }
  function avatarSVG(look, size = 80) {
    const hatUnder = look.hat === 'peluca';
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="50" cy="50" r="49" fill="${look.bg}"/>
      <path d="M18 100 Q20 76 50 74 Q80 76 82 100 Z" fill="#1F1235"/>
      <path d="M42 75 L50 90 L58 75 Z" fill="#fff"/><path d="M47 77 L50 92 L53 77 Z" fill="#8B5CF6"/>
      ${hatUnder ? hatSVG('peluca') : ''}
      <ellipse cx="50" cy="52" rx="20" ry="23" fill="${look.skin}"/>
      <ellipse cx="29.5" cy="53" rx="3.5" ry="5" fill="${look.skin}"/><ellipse cx="70.5" cy="53" rx="3.5" ry="5" fill="${look.skin}"/>
      ${faceSVG(look.face)}${accSVG(look.acc)}
      ${hatUnder ? '' : hatSVG(look.hat)}
      ${propSVG(look.prop)}
    </svg>`;
  }

  /* ---------- audio ---------- */
  let actx = null;
  function ctx() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, start, dur, type = 'triangle', vol = 0.18, slideTo) {
    const c = ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + start + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    o.connect(g); g.connect(c.destination); o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
  }
  const sfx = {
    tick() { tone(880 + Math.random() * 200, 0, 0.05, 'sine', 0.05); },
    success() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.25, 'triangle', 0.2)); tone(1568, 0.34, 0.35, 'sine', 0.08); },
    error() { tone(220, 0, 0.18, 'sawtooth', 0.12, 150); tone(160, 0.16, 0.28, 'sawtooth', 0.12, 90); },
    join() { tone(660, 0, 0.12, 'sine', 0.15); tone(990, 0.1, 0.18, 'sine', 0.15); },
    win() { [523, 659, 784, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.3, 'square', 0.09)); }
  };

  /* ---------- música chiptune (melodías de dominio público usadas en videojuegos) ---------- */
  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function nf(n) { if (n === 'r') return 0; const m = n.match(/^([A-G]#?)(\d)$/); return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12); }
  const P = s => s.trim().split(/\s+/).map(t => { const [n, d] = t.split(':'); return [n, +d]; });
  const up = (seq, oct) => seq.map(([n, d]) => [n === 'r' ? n : n.replace(/\d$/, x => +x + oct), d]);
  function bassBars(roots, pat) { // pat: 'oct' = raíz/octava en corcheas, 'gallop' = raíz/quinta, 'march' = negras
    const out = [];
    roots.forEach(r => {
      const lo = r + '2', hi = r + '3';
      if (pat === 'march') for (let i = 0; i < 4; i++) out.push([i % 2 ? hi : lo, 1]);
      else for (let i = 0; i < 8; i++) out.push([i % 2 ? hi : lo, .5]);
    });
    return out;
  }
  const korA = P('E5:1 B4:.5 C5:.5 D5:1 C5:.5 B4:.5 A4:1 A4:.5 C5:.5 E5:1 D5:.5 C5:.5 B4:1.5 C5:.5 D5:1 E5:1 C5:1 A4:1 A4:2');
  const korB = P('r:.5 D5:1 F5:.5 A5:1 G5:.5 F5:.5 E5:1.5 C5:.5 E5:1 D5:.5 C5:.5 B4:1 B4:.5 C5:.5 D5:1 E5:1 C5:1 A4:1 A4:2');
  const mk1 = P('B3:.5 C#4:.5 D4:.5 E4:.5 F#4:.5 D4:.5 F#4:1 F4:.5 C#4:.5 F4:1 E4:.5 C4:.5 E4:1 B3:.5 C#4:.5 D4:.5 E4:.5 F#4:.5 D4:.5 F#4:.5 B4:.5 A4:.5 F#4:.5 D4:.5 F#4:.5 A4:2');
  const gal = 'G4:.25 G4:.25 G4:.5 G4:.25 G4:.25 G4:.5 G4:.25 G4:.25 C5:.5';
  const wt = P(`${gal} D5:.5 E5:.5 ${gal} E5:.5 D5:.5 ${gal} D5:.5 E5:.5 C5:.5 E5:.5 G5:1 E5:.5 C5:.5 G4:1`);
  const TRACKS = {
    korobeiniki: { name: 'Korobeiniki (duelo)', bpm: 150, lead: [...korA, ...korA, ...korB, ...korB], bass: bassBars(['E', 'A', 'E', 'A', 'E', 'A', 'E', 'A', 'D', 'C', 'E', 'A', 'D', 'C', 'E', 'A'], 'oct') },
    montana: { name: 'Rey de la Montaña (tensión)', bpm: 120, accel: true, lead: [...mk1, ...up(mk1, 1)], bass: bassBars(['B', 'F#', 'B', 'D', 'B', 'F#', 'B', 'D'], 'march') },
    galope: { name: 'Galope final (carrera)', bpm: 152, lead: [...wt, ...up(wt, 0)], bass: bassBars(['C', 'G', 'C', 'C', 'C', 'G', 'C', 'C'], 'gallop') }
  };
  const music = { on: false, track: null, mul: 1, loopMul: 1, timer: null, master: null, duck: 1 };
  function noiseBuf(c) { if (music.nb) return music.nb; const b = c.createBuffer(1, c.sampleRate * .2, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (music.nb = b); }
  function mnote(c, f, t, dur, type, vol) {
    if (!f) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * .92);
    o.connect(g); g.connect(music.master); o.start(t); o.stop(t + dur);
  }
  function hat(c, t, vol) { const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); s.buffer = noiseBuf(c); f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .05); s.connect(f); f.connect(g); g.connect(music.master); s.start(t); s.stop(t + .06); }
  function kick(c, t) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .12); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .15); o.connect(g); g.connect(music.master); o.start(t); o.stop(t + .16); }
  function schedule() {
    const c = ctx(); if (!c || !music.track) return;
    const T = music.track, spb = () => 60 / (T.bpm * music.mul * music.loopMul);
    const st = music.st;
    while (st.lt < c.currentTime + .15) {
      if (st.li >= T.lead.length) { st.li = 0; if (T.accel) music.loopMul = music.loopMul > 1.5 ? 1 : music.loopMul * 1.1; }
      const [n, d] = T.lead[st.li++]; const dur = d * spb();
      mnote(c, nf(n), st.lt, dur, 'square', .07); st.lt += dur;
    }
    while (st.bt < c.currentTime + .15) {
      if (st.bi >= T.bass.length) st.bi = 0;
      const [n, d] = T.bass[st.bi++]; const dur = d * spb();
      mnote(c, nf(n), st.bt, dur, 'triangle', .16); st.bt += dur;
    }
    while (st.dt < c.currentTime + .15) {
      const half = spb() / 2;
      hat(c, st.dt, st.di % 2 ? .05 : .08); if (st.di % 2 === 0) kick(c, st.dt);
      st.dt += half; st.di++;
    }
  }
  function musicPlay(id) {
    const c = ctx(); if (!c) return;
    musicStop();
    if (!music.master) { music.master = c.createGain(); music.master.connect(c.destination); }
    music.master.gain.value = .55 * music.duck;
    music.track = TRACKS[id] || TRACKS.korobeiniki; music.id = id; music.loopMul = 1; music.on = true;
    const t = c.currentTime + .05; music.st = { li: 0, bi: 0, lt: t, bt: t, dt: t, di: 0 };
    music.timer = setInterval(schedule, 25);
  }
  function musicStop() { clearInterval(music.timer); music.timer = null; music.on = false; }
  function setDuck(v) { music.duck = v; if (music.master) try { music.master.gain.setTargetAtTime(.55 * v, ctx().currentTime, .08); } catch (e) {} }

  let voice = null;
  function pickVoice() {
    try {
      const vs = speechSynthesis.getVoices();
      voice = vs.find(v => /es[-_]MX/i.test(v.lang)) || vs.find(v => /es[-_]US/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)) || null;
    } catch (e) {}
  }
  try { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } catch (e) {}
  let gen = 0;
  function say(text, mood = 'happy', fromQ) {
    try {
      if (!fromQ) sq.length = 0;
      const my = ++gen;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang : 'es-MX';
      const m = { happy: [1.45, 1.15], hype: [1.7, 1.25], sad: [0.7, 0.85], calm: [1.1, 1] }[mood] || [1.2, 1.05];
      u.pitch = m[0]; u.rate = m[1]; u.volume = 1;
      u.onstart = () => setDuck(.35);
      u.onend = u.onerror = () => { if (my !== gen) return; setDuck(1); speaking = false; setTimeout(nextSay, 250); };
      speaking = true;
      speechSynthesis.speak(u);
      setTimeout(() => { if (my === gen && speaking) { speaking = false; setDuck(1); nextSay(); } }, 1500 + text.length * 110);
    } catch (e) { speaking = false; }
  }
  /* cola de voz: prioridad alta interrumpe, baja se descarta si hay fila */
  let speaking = false; const sq = [];
  function sayQ(text, mood, prio = 1) {
    if (prio >= 3) { say(text, mood); return; }
    if (sq.length >= 2 && prio < 2) return;
    sq.push([text, mood]);
    if (!speaking) nextSay();
  }
  function nextSay() { if (speaking) return; const n = sq.shift(); if (n) say(n[0], n[1], true); }

  /* ---------- ranking ---------- */
  function rank(list) {
    return [...list].sort((a, b) =>
      (!!b.done - !!a.done) || (a.done && b.done ? a.time - b.time : 0) ||
      (b.found - a.found) || ((a.lf || a.ts) - (b.lf || b.ts)));
  }

  /* ---------- tiempo real (MQTT) ---------- */
  function connect(onMsg, onStatus) {
    const id = 'sj_' + Math.random().toString(16).slice(2, 10);
    const client = mqtt.connect(BROKER, { clientId: id, clean: true, keepalive: 30, reconnectPeriod: 2000, connectTimeout: 8000 });
    client.on('connect', () => onStatus && onStatus('online'));
    client.on('reconnect', () => onStatus && onStatus('reconnect'));
    client.on('offline', () => onStatus && onStatus('offline'));
    client.on('error', () => onStatus && onStatus('error'));
    client.on('message', (topic, payload) => {
      let data = null;
      const s = payload.toString();
      if (s) { try { data = JSON.parse(s); } catch (e) { return; } }
      onMsg(topic.slice(BASE.length + 1), data);
    });
    return client;
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function gameURL() {
    const u = new URL('index.html', location.href);
    u.search = '';
    if (SALA !== 'clase') u.searchParams.set('sala', SALA);
    if (params.get('b')) u.searchParams.set('b', params.get('b'));
    return u.href.replace(/index\.html(?=$|\?)/, '');
  }

  return { BASE, SALA, DEFAULT_WORDS, store, rng, normWord, buildPuzzle, HATS, SKINS, BGS, FACES, ACCS, PROPS, randomLook, avatarSVG, sfx, say, sayQ, rank, TRACKS, music, musicPlay, musicStop, connect, esc, gameURL, params };
})();
