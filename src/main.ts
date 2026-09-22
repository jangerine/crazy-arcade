import './style.css';
import { COLS, ROWS, TILE } from './game/constants';
import { Engine, type TouchDir } from './game/engine';
import { defaultServerUrl, NetClient, type Snapshot } from './game/net';
import type { PlayerId } from './game/player';
import { sound } from './game/sound';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;
const ctx = canvas.getContext('2d')!;

const engine = new Engine();
const hud = document.getElementById('hud') as HTMLDivElement;
const menu = document.getElementById('menu') as HTMLDivElement;
const restartBtn = document.getElementById('restartBtn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
const menuBtn = document.getElementById('menuBtn') as HTMLButtonElement;
const muteBtn = document.getElementById('muteBtn') as HTMLButtonElement;
const soloBtn = document.getElementById('soloBtn') as HTMLButtonElement;
const battleBtn = document.getElementById('battleBtn') as HTMLButtonElement;
const pad1 = document.querySelector<HTMLDivElement>('.pad[data-player="1"]');
const pad2 = document.querySelector<HTMLDivElement>('.pad[data-player="2"]');

// --- 온라인 UI ---
const serverUrlInput = document.getElementById('serverUrl') as HTMLInputElement;
const createBtn = document.getElementById('createBtn') as HTMLButtonElement;
const joinCodeInput = document.getElementById('joinCode') as HTMLInputElement;
const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;
const onlineStatus = document.getElementById('onlineStatus') as HTMLDivElement;
serverUrlInput.value = defaultServerUrl();

const net = new NetClient();
let roomCode: string | null = null;

function setStatus(msg: string): void {
  onlineStatus.textContent = msg;
}

// guest 스냅샷 감시 (효과음용)
let seenFx = new Set<number>();
let prevGuestAlive = true;
let prevSnapState: Snapshot['state'] | null = null;

function watchGuestSnap(snap: Snapshot): void {
  for (const e of snap.explosions) {
    if (!seenFx.has(e.id)) {
      seenFx.add(e.id);
      sound.play('explode');
    }
  }
  const me = snap.players.find((p) => p.id === 2);
  if (me && prevGuestAlive && !me.alive) sound.play('death');
  prevGuestAlive = me?.alive ?? true;
  if (prevSnapState !== 'over' && snap.state === 'over') {
    sound.play(snap.winner === 2 ? 'win' : 'lose');
  }
  prevSnapState = snap.state;
}

net.onEvent = (e) => {
  switch (e.t) {
    case 'created':
      roomCode = e.code;
      setStatus(`방 생성됨! 코드: ${e.code} — 상대를 기다리는 중… (상대가 들어오면 자동 시작)`);
      break;
    case 'joined':
      roomCode = e.code;
      seenFx = new Set();
      prevGuestAlive = true;
      prevSnapState = null;
      engine.prepareOnlineGuest();
      setStatus('');
      break;
    case 'peer-joined':
      setStatus('상대 접속! 대전을 시작합니다…');
      engine.startOnlineHost();
      break;
    case 'peer-left':
      roomCode = null;
      net.leave();
      engine.toMenu();
      setStatus('상대가 나갔어요. 다시 방을 만들거나 참가하세요.');
      break;
    case 'error':
      setStatus(`⚠️ ${e.msg}`);
      break;
    case 'left':
      break;
  }
};

net.onSnap = (snap) => {
  if (engine.mode !== 'online' || engine.onlineRole !== 'guest') return;
  watchGuestSnap(snap);
  engine.applySnapshot(snap);
};

net.onGuestInput = (dx, dy) => {
  engine.guestInput = { dx, dy };
};

net.onGuestBomb = () => {
  const p2 = engine.players[1];
  if (p2) engine.placeBomb(p2);
};

net.onRestartReq = () => {
  if (engine.mode === 'online' && engine.onlineRole === 'host') {
    engine.startOnlineHost();
  }
};

// 엔진 → net 브리지
engine.onSnapshot = (snap) => net.sendSnap(snap);
engine.onGuestBombLocal = () => net.sendBomb();
engine.onRestartReqLocal = () => net.requestRestart();

async function ensureConnected(): Promise<boolean> {
  if (net.connected) return true;
  setStatus('서버 접속 중…');
  try {
    await net.connect(serverUrlInput.value.trim() || defaultServerUrl());
    return true;
  } catch (err) {
    setStatus(`⚠️ ${err instanceof Error ? err.message : '접속 실패'}`);
    return false;
  }
}

createBtn.addEventListener('click', async () => {
  sound.unlock();
  sound.play('click');
  if (!(await ensureConnected())) return;
  setStatus('방 만드는 중…');
  net.create();
});

joinBtn.addEventListener('click', async () => {
  sound.unlock();
  sound.play('click');
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!code) {
    setStatus('참가 코드를 입력하세요.');
    return;
  }
  if (!(await ensureConnected())) return;
  setStatus('방 참가 중…');
  net.join(code);
});

function refreshMute(): void {
  muteBtn.textContent = sound.muted ? '🔇 음소거 해제' : '🔊 소리 끄기';
}

muteBtn.addEventListener('click', () => {
  sound.unlock();
  sound.toggleMute();
  refreshMute();
});
refreshMute();

soloBtn.addEventListener('click', () => engine.startSolo());
battleBtn.addEventListener('click', () => engine.startBattle());
restartBtn.addEventListener('click', () => {
  sound.unlock();
  if (engine.state === 'menu') {
    engine.startBattle();
    return;
  }
  if (engine.mode === 'online' && engine.onlineRole === 'guest') {
    net.requestRestart();
    return;
  }
  engine.restart();
});
pauseBtn.addEventListener('click', () => engine.togglePause());
menuBtn.addEventListener('click', () => {
  if (engine.mode === 'online') {
    net.leave();
    net.disconnect();
    roomCode = null;
  }
  engine.toMenu();
});

window.addEventListener('keydown', (e) => {
  if (engine.state === 'menu' && e.key === 'Enter') {
    engine.startSolo();
    return;
  }
  if (e.key.toLowerCase() === 'm') {
    sound.toggleMute();
    refreshMute();
  }
});
window.addEventListener('pointerdown', () => sound.unlock(), { once: true });

// --- 터치 디바이스 감지 ---
const isTouch =
  window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

function syncChrome(): void {
  const inMenu = engine.state === 'menu';
  menu.style.display = inMenu ? 'flex' : 'none';
  const online = engine.mode === 'online';
  const guest = online && engine.onlineRole === 'guest';
  const host = online && engine.onlineRole === 'host';
  const solo = engine.mode === 'solo';
  // 패드 표시: 각자 자기 것만 (로컬 대전만 둘 다)
  if (pad1) pad1.style.display = guest || inMenu ? 'none' : '';
  if (pad2) pad2.style.display = solo || host || inMenu ? 'none' : '';
  pauseBtn.disabled = inMenu || online;
  restartBtn.textContent =
    engine.mode === 'solo'
      ? '↻ 솔로 재시작 (R)'
      : online
        ? '↻ 온라인 재시작 (R)'
        : '↻ 대전 재시작 (R)';
}

engine.onStateChange = syncChrome;
syncChrome();

function updateHud(): void {
  if (engine.state === 'menu') {
    hud.innerHTML = `<div class="card">모드를 선택하세요 · 최고 SCORE ${engine.best}</div>`;
    return;
  }
  if (engine.mode === 'online') {
    const role = engine.onlineRole === 'host' ? 'HOST(1P)' : 'GUEST(2P)';
    const ping = net.lastPingMs !== null ? `${net.lastPingMs}ms` : '…';
    const cards = engine.players
      .map((p) => {
        const status = p.alive ? '🟢' : '💀';
        return `<div class="card"><span style="color:${p.color}">●</span> ${p.name} ${status} · 🎈${p.maxBombs} · 💧${p.range} · ⚡${p.speed.toFixed(1)}</div>`;
      })
      .join('');
    hud.innerHTML =
      `<div class="card">🌐 온라인 ${role} · 방 ${roomCode ?? '?'} · ${ping}</div>` +
      cards;
    return;
  }
  if (engine.mode === 'solo') {
    const p = engine.players[0];
    const alive = engine.enemies.filter((e) => e.alive).length;
    hud.innerHTML =
      `<div class="card">🏁 STAGE ${engine.stage} · 👾 남은 적 ${alive}/${engine.enemies.length}</div>` +
      `<div class="card">⭐ SCORE ${engine.score} · BEST ${engine.best}</div>` +
      (p
        ? `<div class="card"><span style="color:${p.color}">●</span> ❤️${p.lives} · 🎈${p.maxBombs} · 💧${p.range} · ⚡${p.speed.toFixed(1)}</div>`
        : '');
    return;
  }
  hud.innerHTML = engine.players
    .map((p) => {
      const status = p.alive ? '🟢' : '💀';
      return `<div class="card"><span style="color:${p.color}">●</span> ${p.name} ${status} · 🎈${p.maxBombs} · 💧${p.range} · ⚡${p.speed.toFixed(1)}</div>`;
    })
    .join('');
}

// --- 터치 컨트롤 배선 (멀티터치 대응: pointer 이벤트) ---
function bindTouch(): void {
  document.querySelectorAll<HTMLDivElement>('.pad').forEach((pad) => {
    const pid = Number(pad.dataset.player) as PlayerId;
    pad.querySelectorAll<HTMLButtonElement>('button[data-dir]').forEach((btn) => {
      const dir = btn.dataset.dir as TouchDir;
      const down = (e: PointerEvent): void => {
        e.preventDefault();
        sound.unlock();
        btn.setPointerCapture?.(e.pointerId);
        btn.classList.add('active');
        engine.touchDown(pid, dir);
      };
      const up = (e: PointerEvent): void => {
        e.preventDefault();
        btn.classList.remove('active');
        engine.touchUp(pid, dir);
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', () => {
        btn.classList.remove('active');
        engine.touchUp(pid, dir);
      });
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    const bomb = pad.querySelector<HTMLButtonElement>('button[data-bomb]');
    bomb?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sound.unlock();
      // 온라인 guest의 💣는 서버로 전송 (엔진이 라우팅)
      if (engine.mode === 'online' && engine.onlineRole === 'guest' && pid === 2) {
        net.sendBomb();
        return;
      }
      engine.pressBomb(pid);
    });
  });

  canvas.addEventListener('touchstart', (e) => e.preventDefault(), {
    passive: false,
  });
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), {
    passive: false,
  });
}

bindTouch();

// guest 입력 전송 (변경 시 + 500ms 하트비트)
let lastSentInput = '';
let lastInputSentAt = 0;

let last = performance.now();

function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  engine.update(dt);

  if (engine.mode === 'online' && engine.onlineRole === 'host') {
    if (engine.state === 'playing' || engine.state === 'over') {
      engine.emitSnapshot();
    }
  }
  if (
    engine.mode === 'online' &&
    engine.onlineRole === 'guest' &&
    engine.state === 'playing'
  ) {
    const { dx, dy } = engine.localP2Input();
    const key = `${dx},${dy}`;
    if (key !== lastSentInput || now - lastInputSentAt > 500) {
      lastSentInput = key;
      lastInputSentAt = now;
      net.sendInput(dx, dy);
    }
  }

  engine.render(ctx);
  updateHud();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
