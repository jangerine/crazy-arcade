# 💣 Crazy Arcade (크레이지 아케이드 클론)

TypeScript + HTML Canvas로 만드는 크레이지 아케이드(BNBD) 클론 프로젝트.

https://github.com/jangerine/crazy-arcade

## 현재 상태 (v0.1 프로토타입)

- [x] 15x13 타일맵 (파괴불가 / 파괴가능 블록)
- [x] 플레이어 이동 (방향키 / WASD, 대각선 방지)
- [x] 물풍선 설치 (Space, 최대 1개) + 십자 폭발
- [x] 블록 파괴 + 피격 시 리스폰
- [ ] 적 / 2P / 아이템 (스피드, 범위, 개수)
- [ ] 스프라이트, 사운드, 모바일 조작
- [ ] 멀티플레이 (WebSocket)

## 실행 방법

Node.js 20+ 필요:

```bash
npm install
npm run dev
# http://localhost:5173
```

Node가 없으면 https://nodejs.org 에서 LTS 설치.

## 조작법

- 이동: 방향키 또는 WASD
- 물풍선: Space

## 구조

```
src/
  main.ts          # 부트스트랩 + 게임 루프
  style.css
  game/
    constants.ts   # TILE, COLS, ROWS, 밸런스 값
    map.ts         # 맵 생성
    player.ts
    bomb.ts
    engine.ts      # update + render
```

## 로드맵

1. 아이템 시스템 (밸룬/물줄기/스피드)
2. 적 AI + 스테이지 클리어
3. 2인 로컬 플레이
4. 온라인 멀티플레이
