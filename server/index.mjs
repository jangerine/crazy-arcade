// 크레이지 아케이드 온라인 릴레이 서버
// 실행: npm run server (기본 포트 8081, PORT 환경변수로 변경)
// 역할: 방(4자리 코드) 생성/참가 관리 + host<->guest 메시지 중계.
// 게임 시뮬레이션은 host 클라이언트가 담당하고, 서버는 상태를 저장하지 않음.

import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8081);
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_ROOM_AGE_MS = 60 * 60 * 1000;

function makeCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/** code -> { host, guest, createdAt } */
const rooms = new Map();

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function otherOf(room, ws) {
  if (room.host === ws) return room.guest;
  if (room.guest === ws) return room.host;
  return null;
}

function leaveRoom(ws) {
  const code = ws._room;
  if (!code) return;
  const room = rooms.get(code);
  ws._room = null;
  ws._role = null;
  if (!room) return;
  if (room.host === ws) room.host = null;
  if (room.guest === ws) room.guest = null;
  const other = room.host ?? room.guest;
  if (other) send(other, { t: 'peer-left' });
  if (!room.host && !room.guest) rooms.delete(code);
}

// 만료된 빈 방 정리
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (!room.host && !room.guest && now - room.createdAt > MAX_ROOM_AGE_MS) {
      rooms.delete(code);
    }
  }
}, 60_000).unref();

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  ws._room = null;
  ws._role = null;
  ws._alive = true;
  ws.on('pong', () => {
    ws._alive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, { t: 'error', msg: '잘못된 메시지 형식' });
      return;
    }

    switch (msg.t) {
      case 'ping': {
        send(ws, { t: 'pong', ts: msg.ts ?? Date.now() });
        break;
      }
      case 'create': {
        leaveRoom(ws);
        let code = makeCode();
        while (rooms.has(code)) code = makeCode();
        rooms.set(code, { host: ws, guest: null, createdAt: Date.now() });
        ws._room = code;
        ws._role = 'host';
        send(ws, { t: 'created', code });
        break;
      }
      case 'join': {
        const code = String(msg.code ?? '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room || !room.host) {
          send(ws, { t: 'error', msg: '방을 찾을 수 없어요. 코드를 확인하세요.' });
          break;
        }
        if (room.guest) {
          send(ws, { t: 'error', msg: '방이 가득 찼어요.' });
          break;
        }
        leaveRoom(ws);
        room.guest = ws;
        ws._room = code;
        ws._role = 'guest';
        send(ws, { t: 'joined', code, role: 'guest' });
        send(room.host, { t: 'peer-joined' });
        break;
      }
      case 'leave': {
        leaveRoom(ws);
        send(ws, { t: 'left' });
        break;
      }
      default: {
        // 나머지(snap/input/bomb/restart-req)는 상대에게 그대로 중계
        const code = ws._room;
        const room = code ? rooms.get(code) : null;
        const other = room ? otherOf(room, ws) : null;
        if (!other) {
          send(ws, { t: 'error', msg: '상대가 아직 없어요.' });
          break;
        }
        const relayable = new Set(['snap', 'input', 'bomb', 'restart-req']);
        if (!relayable.has(msg.t)) {
          send(ws, { t: 'error', msg: `알 수 없는 메시지: ${msg.t}` });
          break;
        }
        send(other, msg);
      }
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => {});
});

// ws 수준 heartbeat (죽은 연결 정리)
const hb = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws._alive === false) {
      ws.terminate();
      return;
    }
    ws._alive = false;
    ws.ping();
  });
}, 30_000);
hb.unref();
wss.on('close', () => clearInterval(hb));

console.log(`💣 crazy-arcade relay server listening on ws://localhost:${PORT}`);
