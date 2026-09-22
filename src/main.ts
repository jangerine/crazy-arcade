import './style.css';
import { COLS, ROWS, TILE } from './game/constants';
import { Engine, type TouchDir } from './game/engine';
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
const pad2 = document.querySelector<HTMLDivElement>('.pad[data-player="2"]');

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
  if (engine.state === 'menu') engine.startBattle();
  else engine.restart();
});
pauseBtn.addEventListener('click', () => engine.togglePause());
menuBtn.addEventListener('click', () => engine.toMenu());

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
  const solo = engine.mode === 'solo';
  if (pad2) pad2.style.display = solo && !inMenu ? 'none' : '';
  pauseBtn.disabled = inMenu;
  restartBtn.textContent =
    engine.mode === 'solo' ? '↻ 솔로 재시작 (R)' : '↻ 대전 재시작 (R)';
}

engine.onStateChange = syncChrome;
syncChrome();

function updateHud(): void {
  if (engine.state === 'menu') {
    hud.innerHTML = `<div class="card">모드를 선택하세요 · 최고 SCORE ${engine.best}</div>`;
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

let last = performance.now();

function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  engine.update(dt);
  engine.render(ctx);
  updateHud();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
