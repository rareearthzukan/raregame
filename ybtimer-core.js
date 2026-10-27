/* ybtimer-core.js : イッテルビウム集中タイマーの共通エンジン (v2)
 * ポモドーロと通常タイマーは別々に動き、タブの切り替えでは止まりません。
 * ybtimer.html / home.html / map.html など、ゲームの全ページで読み込んでください。
 *   <script src="ybtimer-core.js"></script> */
(function () {
  'use strict';
  if (window.YbTimer) return;

  const KEY = 'yb_timer_state_v2', ALARM_KEY = 'yb_timer_last_alarm_';
  const DEF = () => ({
    mode: 'pomo',
    pomo: { phase: 'work', done: 0, workSec: 1500, breakSec: 300, longSec: 900, total: 1500, rem: 1500, run: false, end: null },
    normal: { total: 300, rem: 300, run: false, end: null }
  });
  const KINDS = ['pomo', 'normal'], LABEL = { pomo: 'ポモドーロ', normal: '通常タイマー' };
  let S = DEF(), ctx = null, nodes = { pomo: [], normal: [] }, pending = [];

  function load() {
    try {
      const j = JSON.parse(localStorage.getItem(KEY) || 'null'), d = DEF();
      S = j ? { mode: j.mode === 'normal' ? 'normal' : 'pomo', pomo: Object.assign(d.pomo, j.pomo), normal: Object.assign(d.normal, j.normal) } : d;
    } catch (e) { S = DEF(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function emit(n, d) { window.dispatchEvent(new CustomEvent(n, { detail: d })); }
  function rem(t) { return t.run && t.end ? Math.max(0, Math.ceil((t.end - Date.now()) / 1000)) : t.rem; }

  /* ---------- 音 ---------- */
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(t0, f, dur, vol, type) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    return o;
  }
  // 種類ごとに音を変えて、どちらが終わったか分かるようにする
  function alarmNotes(t0, k) {
    const f = k === 'pomo' ? 783.99 : 987.77;
    return [0, 0.2, 0.4, 0.9, 1.1, 1.3].map(d => tone(t0 + d, f, 0.15, 0.3));
  }
  function playStartPop() {
    if (!audio()) return;
    [440, 554.37, 659.25, 880].forEach((f, i) => tone(ctx.currentTime + i * 0.08, f, 0.1, 0.25, 'sine'));
  }
  function cancelAlarm(k) { nodes[k].forEach(o => { try { o.stop(); } catch (e) {} }); nodes[k] = []; }
  function scheduleAlarm(k) {
    cancelAlarm(k);
    if (!S[k].run || !audio() || ctx.state !== 'running') return;
    nodes[k] = alarmNotes(ctx.currentTime + rem(S[k]), k);
  }
  function scheduleAll() { KINDS.forEach(scheduleAlarm); }
  function unlock() {
    if (!audio() || ctx.state !== 'running') return;
    pending.forEach(k => alarmNotes(ctx.currentTime, k)); pending = [];
    scheduleAll();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => {
    if (!ctx || ctx.state !== 'running') { audio(); setTimeout(unlock, 80); }
  }, { passive: true }));

  /* ---------- 通知 ---------- */
  function askPermission() { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }
  function notify(msg) {
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification('イッテルビウムの集中タイマー', { body: msg }); } catch (e) {}
  }
  function toast(msg) {
    if (window.YB_TIMER_UI) return;
    const d = document.createElement('div');
    d.textContent = '⏰ ' + msg;
    d.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);max-width:92vw;z-index:99999;background:#131c31;color:#e2e8f0;border:1px solid #00ffcc;border-radius:12px;padding:10px 14px;font:14px/1.4 sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);cursor:pointer';
    d.onclick = () => d.remove();
    document.body.appendChild(d); setTimeout(() => d.remove(), 20000);
  }

  /* ---------- 状態遷移 ---------- */
  function setupPhase(p) {
    const t = S.pomo; t.phase = p;
    t.total = p === 'work' ? t.workSec : p === 'shortBreak' ? t.breakSec : t.longSec;
    t.rem = t.total; t.run = false; t.end = null;
  }
  function complete(k) {
    load();
    const t = S[k];
    if (!t.run || !t.end || t.end > Date.now()) return;
    const id = String(t.end);
    if (localStorage.getItem(ALARM_KEY + k) === id) return;
    try { localStorage.setItem(ALARM_KEY + k, id); } catch (e) {}
    let msg;
    if (k === 'pomo') {
      if (t.phase === 'work') {
        t.done++;
        if (t.done % 4 === 0) { setupPhase('longBreak'); msg = '4セッションを達成しました。しっかり長休憩をとりましょう。'; }
        else { setupPhase('shortBreak'); msg = '作業お疲れ様でした。準備ができたらスタートをして小休憩に入ってください。'; }
      } else { setupPhase('work'); msg = '休憩時間が終了しました。次の集中セッションに入りましょう。'; }
    } else {
      t.rem = 0; t.run = false; t.end = null; msg = '設定したお時間になりました。お疲れ様でした。';
    }
    msg = `【${LABEL[k]}】` + msg;
    save();
    if (!nodes[k].length) {
      if (audio() && ctx.state === 'running') alarmNotes(ctx.currentTime, k); else pending.push(k);
    }
    nodes[k] = [];
    notify(msg); toast(msg);
    emit('yb:complete', { message: msg, mode: k }); emit('yb:change');
  }
  function check() { KINDS.forEach(k => { const t = S[k]; if (t.run && t.end && t.end <= Date.now()) complete(k); }); }

  /* ---------- 操作API（k を省略すると、いま表示中のタイマー） ---------- */
  const API = {
    get state() { return S; },
    cur() { const m = S.mode, t = S[m]; return Object.assign({}, t, { mode: m, remaining: rem(t), isRunning: !!t.run }); },
    info(k) { const t = S[k]; return { isRunning: !!t.run, remaining: rem(t) }; },
    anyRunning() { return KINDS.some(k => S[k].run); },
    start(k) {
      k = k || S.mode; const t = S[k];
      if (rem(t) <= 0) return;
      askPermission(); playStartPop();
      t.run = true; t.end = Date.now() + rem(t) * 1000;
      save(); scheduleAlarm(k); emit('yb:change');
    },
    pause(k) { k = k || S.mode; const t = S[k]; t.rem = rem(t); t.run = false; t.end = null; cancelAlarm(k); save(); emit('yb:change'); },
    reset(k) { k = k || S.mode; const t = S[k]; cancelAlarm(k); t.run = false; t.end = null; t.rem = t.total; save(); emit('yb:change'); },
    setView(m) { if (S.mode === m) return; S.mode = m; save(); emit('yb:change'); },   // タブ切替：タイマーには触れない
    setPomoTimes(w, b, l) {
      const t = S.pomo; t.workSec = w; t.breakSec = b; t.longSec = l;
      if (!t.run) setupPhase(t.phase);
      save(); emit('yb:change');
    },
    setStandard(min) {
      const t = S.normal; cancelAlarm('normal');
      t.total = min * 60; t.rem = t.total; t.run = false; t.end = null;
      save(); emit('yb:change');
    }
  };
  window.YbTimer = API;

  /* ---------- 起動 ---------- */
  load();
  window.addEventListener('storage', e => { if (e.key === KEY) { load(); scheduleAll(); emit('yb:change'); } });
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(1)},500)'], { type: 'text/javascript' })));
    w.onmessage = () => { check(); emit('yb:tick'); };
  } catch (e) { setInterval(() => { check(); emit('yb:tick'); }, 500); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { check(); emit('yb:tick'); } });
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { if (API.anyRunning()) { audio(); scheduleAll(); } check(); emit('yb:change'); }, 0);
  });
})();
