# 💣 Crazy Arcade (크레이지 아케이드 클론)

TypeScript + HTML Canvas로 만드는 크레이지 아케이드(BNBD) 클론 프로젝트.

https://github.com/jangerine/crazy-arcade

## 현재 상태 (v0.2 - 2P 로컬 대전)

- [x] 15x13 타일맵 (파괴불가 / 파괴가능 블록)
- [x] 2인 로컬 대전 (동시 이동, 폭탄 소유권, 연쇄 폭발)
- [x] 물풍선 + 십자 폭발 + 블록 파괴
- [x] 피격 사망 → 승패 판정 + R로 재시작
- [ ] 아이템 (스피드, 범위, 개수)
- [ ] 적 AI / 스테이지
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

## 조작법 (2P 로컬)

- 1P 파랑: WASD 이동 + Space/F 물풍선
- 2P 빨강: 방향키 이동 + Enter 물풍선
- R: 게임오버 시 재시작

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
