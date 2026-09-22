// 온라인 대전 클라이언트 넷코드 (호스트-권위 방식)
// - host: 로컬에서 시뮬레이션(P1) + guest 입력으로 P2 조종, 15Hz 스냅샷 방송
// - guest: 시뮬레이션 없이 스냅샷 렌더, P2 입력만 전송
// 서버(server/index.mjs)는 방 관리 + 메시지 중계만 담당.

export type NetRole = 'host' | 'guest';

export interface SnapPlayer {
  id: 1 | 2;
  name: string;
  x: number;
  y: number;
  speed: number;
  maxBombs: number;
  range: number;
  color: string;
  alive: boolean;
  lives: number;
  facing: 'up' | 'down' | 'left' | 'right';
  invincibleIn: number; // ms 남음
}

export interface SnapBomb {
  x: number;
  y: number;
  range: number;
  ownerId: 1 | 2;
  fuseIn: number; // 폭발까지 ms 남음
}

export interface SnapExplosion {
  id: number;
  cells: { x: number; y: number }[];
  age: number; // 발생 후 ms
}

export interface Snapshot {
  v: 1;
  state: 'playing' | 'over';
  winner: 1 | 2 | 0 | null;
  score: number;
  stage: number;
  map: number[][];
  players: SnapPlayer[];
  bombs: SnapBomb[];
  items: { x: number; y: number; kind: 'bomb' | 'range' | 'speed' }[];
  explosions: SnapExplosion[];
}

export type NetEvent =
  | { t: 'created'; code: string }
  | { t: 'joined'; code: string; role: NetRole }
  | { t: 'peer-joined' }
  | { t: 'peer-left' }
  | { t: 'left' }
  | { t: 'error'; msg: string };

export function defaultServerUrl(): string {
  const host = window.location.hostname || 'localhost';
  return `ws://${host}:8081`;
}

export class NetClient {
  private ws: WebSocket | null = null;
  onEvent: ((e: NetEvent) => void) | null = null;
  onSnap: ((s: Snapshot) => void) | null = null;
  onGuestInput: ((dx: number, dy: number) => void) | null = null;
  onGuestBomb: (() => void) | null = null;
  onRestartReq: (() => void) | null = null;
  private pingTimer: number | null = null;
  lastPingMs: number | null = null;

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url: string): Promise<void> {
    this.disconnect();
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        reject(err);
        return;
      }
      const timeout = window.setTimeout(() => {
        try {
          ws.close();
        } catch {
          // 무시
        }
        reject(new Error('서버 접속 시간 초과'));
      }, 6000);
      ws.onopen = () => {
        window.clearTimeout(timeout);
        this.ws = ws;
        this.startPing();
        resolve();
      };
      ws.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('서버에 접속할 수 없어요. npm run server 실행 여부를 확인하세요.'));
      };
      ws.onmessage = (ev) => this.handle(String(ev.data));
      ws.onclose = () => {
        this.stopPing();
        if (this.ws === ws) this.ws = null;
      };
    });
  }

  disconnect(): void {
    this.stopPing();
    try {
      this.ws?.close();
    } catch {
      // 무시
    }
    this.ws = null;
  }

  private send(obj: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  create(): void {
    this.send({ t: 'create' });
  }

  join(code: string): void {
    this.send({ t: 'join', code });
  }

  leave(): void {
    this.send({ t: 'leave' });
  }

  sendSnap(snap: Snapshot): void {
    this.send({ t: 'snap', snap });
  }

  sendInput(dx: number, dy: number): void {
    this.send({ t: 'input', dx, dy });
  }

  sendBomb(): void {
    this.send({ t: 'bomb' });
  }

  requestRestart(): void {
    this.send({ t: 'restart-req' });
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      this.send({ t: 'ping', ts: Date.now() });
    }, 5000);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handle(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    switch (msg.t) {
      case 'pong':
        this.lastPingMs = Date.now() - Number(msg.ts ?? Date.now());
        break;
      case 'created':
      case 'joined':
      case 'peer-joined':
      case 'peer-left':
      case 'left':
      case 'error':
        this.onEvent?.(msg as unknown as NetEvent);
        break;
      case 'snap':
        this.onSnap?.(msg.snap as Snapshot);
        break;
      case 'input':
        this.onGuestInput?.(Number(msg.dx) || 0, Number(msg.dy) || 0);
        break;
      case 'bomb':
        this.onGuestBomb?.();
        break;
      case 'restart-req':
        this.onRestartReq?.();
        break;
      default:
        break;
    }
  }
}
