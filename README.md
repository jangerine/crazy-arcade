# 💣 Crazy Arcade (크레이지 아케이드 클론)

TypeScript + HTML Canvas로 만드는 크레이지 아케이드(BNBD) 클론 프로젝트.

https://github.com/jangerine/crazy-arcade

## 현재 상태 (v0.3 - 아이템 + 모바일)

- [x] 15x13 타일맵 (파괴불가 / 파괴가능 블록)
- [x] 2인 로컬 대전 (동시 이동, 폭탄 소유권, 연쇄 폭발)
- [x] 물풍선 + 십자 폭발 + 블록 파괴
- [x] 피격 사망 → 승패 판정 + R/버튼 재시작
- [x] 아이템 전부: 🎈 물풍선+1 / 💧 물줄기+1 / ⚡ 스피드업 (블록 파괴 시 35% 드롭, HUD 표시)
- [x] 모바일: 반응형 캔버스 + 1P/2P 터치 패드 (D-pad + 💣) 멀티터치 지원
- [ ] 적 AI / 스테이지
- [ ] 스프라이트, 사운드
- [ ] 온라인 멀티플레이 (WebSocket)

## 실행 방법

Node.js 20+ 필요:

```bash
npm install
npm run dev
# http://localhost:5173
```

Node가 없으면 https://nodejs.org 에서 LTS 설치.

## 조작법 (2P 로컬 + 모바일)

- 1P 파랑: WASD 이동 + Space/F 물풍선 / 모바일 왼쪽 패드 + 💣
- 2P 빨강: 방향키 이동 + Enter 물풍선 / 모바일 오른쪽 패드 + 💣
- R 또는 다시 시작 버튼: 재시작

## 아이템

- 🎈 물풍선+1: 동시 설치 가능 개수 (최대 6)
- 💧 물줄기+1: 폭발 범위 (최대 8)
- ⚡ 스피드업: 이동 속도 +0.8 (최대 8.5)
- 블록 파괴 시 35% 확률 드롭, 밟으면 즉시 획득, 폭발에 닿으면 소멸

## 구조

```
src/
  main.ts          # 부트스트랩 + 게임 루프 + 터치/HUD 배선
  style.css        # 반응형 + 터치 패드 스타일
  game/
    constants.ts   # TILE, COLS, ROWS, 밸런스 값
    map.ts         # 맵 생성
    player.ts      # maxBombs / range / speed
    bomb.ts
    item.ts        # 🎈/💧/⚡ 드롭·적용
    engine.ts      # update + render + 터치 입력
```

## 로드맵

1. ~~아이템 시스템 (밸룬/물줄기/스피드)~~ 완료
2. ~~2인 로컬 플레이~~ 완료 / ~~모바일 터치~~ 완료
3. 적 AI + 스테이지 클리어
4. 온라인 멀티플레이
