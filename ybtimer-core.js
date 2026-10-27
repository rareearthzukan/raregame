/* ybtimer-core.js : イッテルビウム集中タイマーの共通エンジン
 * ybtimer.html / home.html / map.html など、ゲームの全ページで読み込んでください。
 *   <script src="ybtimer-core.js"></script>
 * 状態は localStorage に保存され、どのページでも終了時刻を監視して音と通知を出します。 */
(function () {
  'use strict';
  if (window.YbTimer) return;

  const KEY = 'yb_timer_state_final_pref', ALARM_KEY = 'yb_timer_last_alarm';
  const DEF = { mode: 'pomo', pomoPhase: 'work', pomoDone: 0, isRunning: false, targetEndTime: null,
    pomoWorkSec: 1500, pomoBreakSec: 300, pomoLongBreakSec: 900, totalDurationSec: 1500, remainingSec: 1500 };
  let S = Object.assign({}, DEF);
  let ctx = null, nodes = [], pendingAlarm = false;

  function load() {
    try { S = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = Object.assign({}, DEF); }
    if (!S.remainingSec || S.remainingSec < 0) S.remainingSec = S.totalDurationSec;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }
  function remaining() {
    return S.isRunning && S.targetEndTime ? Math.max(0, Math.ceil((S.targetEndTime - Date.now()) / 1000)) : S.remainingSec;
  }

  /* ---------- 音 ---------- */
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(t0, freq, dur, vol, type) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    return o;
  }
  function alarmNotes(t0) { return [0, 0.2, 0.4, 0.9, 1.1, 1.3].map(d => tone(t0 + d, 783.99, 0.15, 0.3)); }
  function playStartPop() {
    if (!audio()) return;
    [440, 554.37, 659.25, 880].forEach((f, i) => tone(ctx.currentTime + i * 0.08, f, 0.1, 0.25, 'sine'));
  }
  function cancelAlarm() { nodes.forEach(o => { try { o.stop(); } catch (e) {} }); nodes = []; }
  // 終了音を AudioContext の時計に予約する（JSタイマーが間引かれても鳴る）
  function scheduleAlarm() {
    cancelAlarm();
    if (!S.isRunning || !audio() || ctx.state !== 'running') return;
    nodes = alarmNotes(ctx.currentTime + remaining());
  }
  function unlock() {
    if (!audio()) return;
    if (pendingAlarm && ctx.state === 'running') { pendingAlarm = false; alarmNotes(ctx.currentTime); }
    scheduleAlarm();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { if (!ctx || ctx.state !== 'running') setTimeout(unlock, 50); }, { passive: true }));

  /* ---------- 通知 ---------- */
  function askPermission() { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }
  function notify(msg) {
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification('イッテルビウムの集中タイマー', { body: msg }); } catch (e) {}
  }
  function toast(msg) {
    if (window.YB_TIMER_UI) return;                 // タイマー画面では吹き出しで表示する
    const d = document.createElement('div');
    d.textContent = '⏰ ' + msg;
    d.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);max-width:92vw;z-index:99999;background:#131c31;color:#e2e8f0;border:1px solid #00ffcc;border-radius:12px;padding:10px 14px;font:14px/1.4 sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);cursor:pointer';
    d.onclick = () => d.remove();
    document.body.appendChild(d); setTimeout(() => d.remove(), 20000);
  }

  /* ---------- 状態遷移 ---------- */
  function setupPhase(p) {
    S.pomoPhase = p;
    S.totalDurationSec = p === 'work' ? S.pomoWorkSec : p === 'shortBreak' ? S.pomoBreakSec : S.pomoLongBreakSec;
    S.remainingSec = S.totalDurationSec; S.isRunning = false; S.targetEndTime = null;
  }
  function check() {
    if (!S.isRunning || !S.targetEndTime || S.targetEndTime > Date.now()) return;
    load();                                          // 他ページが先に処理していないか確認
    if (!S.isRunning || !S.targetEndTime || S.targetEndTime > Date.now()) return;
    const id = String(S.targetEndTime);
    if (localStorage.getItem(ALARM_KEY) === id) return;
    try { localStorage.setItem(ALARM_KEY, id); } catch (e) {}
    let msg;
    if (S.mode === 'pomo') {
      if (S.pomoPhase === 'work') {
        S.pomoDone++;
        if (S.pomoDone % 4 === 0) { setupPhase('longBreak'); msg = '4セッションを達成しました。しっかり長休憩をとりましょう。'; }
        else { setupPhase('shortBreak'); msg = '作業お疲れ様でした。準備ができたらスタートをして小休憩に入ってください。'; }
      } else { setupPhase('work'); msg = '休憩時間が終了しました。次の集中セッションに入りましょう。'; }
    } else {
      S.remainingSec = 0; S.isRunning = false; S.targetEndTime = null; msg = '設定したお時間になりました。お疲れ様でした。';
    }
    save();
    if (nodes.length === 0) {                        // 予約音が無ければ今鳴らす
      if (audio() && ctx.state === 'running') alarmNotes(ctx.currentTime); else pendingAlarm = true;
    }
    nodes = [];
    notify(msg); toast(msg);
    emit('yb:complete', { message: msg }); emit('yb:change');
  }

  /* ---------- 操作API ---------- */
  const API = {
    get state() { return S; },
    remaining,
    start() {
      if (remaining() <= 0) return;
      askPermission(); playStartPop();
      S.isRunning = true; S.targetEndTime = Date.now() + remaining() * 1000;
      save(); scheduleAlarm(); emit('yb:change');
    },
    pause() { S.remainingSec = remaining(); S.isRunning = false; S.targetEndTime = null; cancelAlarm(); save(); emit('yb:change'); },
    reset() { cancelAlarm(); S.isRunning = false; S.targetEndTime = null; S.remainingSec = S.totalDurationSec; save(); emit('yb:change'); },
    setMode(m) {
      if (S.mode === m) return;
      cancelAlarm(); S.mode = m; S.isRunning = false; S.targetEndTime = null;
      if (m === 'pomo') setupPhase('work'); else { S.totalDurationSec = 300; S.remainingSec = 300; }
      save(); emit('yb:change');
    },
    setPomoTimes(w, b, l) {
      S.pomoWorkSec = w; S.pomoBreakSec = b; S.pomoLongBreakSec = l;
      if (!S.isRunning && S.mode === 'pomo') setupPhase(S.pomoPhase);
      save(); emit('yb:change');
    },
    setStandard(min) {
      cancelAlarm(); S.mode = 'normal'; S.totalDurationSec = min * 60; S.remainingSec = min * 60;
      S.isRunning = false; S.targetEndTime = null; save(); emit('yb:change');
    }
  };
  window.YbTimer = API;

  /* ---------- 起動 ---------- */
  load();
  window.addEventListener('storage', e => { if (e.key === KEY) { load(); scheduleAlarm(); emit('yb:change'); } });
  let tick;
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(1)},500)'], { type: 'text/javascript' })));
    tick = w; w.onmessage = () => { check(); emit('yb:tick'); };
  } catch (e) { setInterval(() => { check(); emit('yb:tick'); }, 500); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { check(); emit('yb:tick'); } });
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { if (S.isRunning) { audio(); scheduleAlarm(); } check(); emit('yb:change'); }, 0);
  });
})();
