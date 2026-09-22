# 💣 Crazy Arcade (크레이지 아케이드 클론)

TypeScript + HTML Canvas로 만드는 크레이지 아케이드(BNBD) 클론 프로젝트.

https://github.com/jangerine/crazy-arcade

## 현재 상태 (v0.4 - 풀버전)

- [x] 시작 메뉴: 🙋 1P 스테이지 / ⚔️ 2P 대전
- [x] 1P 스테이지: 추적형 적 AI + 무한 스테이지 (적·속도·블록 증가) + ❤️3 목숨 + 부활 무적
- [x] 2P 대전: 동시 이동, 폭탄 소유권, 연쇄 폭발, 승패 판정
- [x] 물풍선 + 십자 폭발 + 블록 파괴 (+10점) + 적 처치 (+500점)
- [x] 아이템 전부: 🎈 물풍선+1 / 💧 물줄기+1 / ⚡ 스피드업 (35% 드롭, +50점)
- [x] 스테이지 클리어 배너 + 보너스, SCORE/BEST (localStorage)
- [x] 스프라이트: 타일 질감, 방향 눈, 물풍선 심지, 유령 몬스터, 아이템 둥실 효과
- [x] 사운드: WebAudio 합성 효과음 8종 (설치/폭발/획득/사망/승리/패배/클릭/클리어) + 음소거 (M)
- [x] 일시정지 (P/Esc/버튼), R/버튼 재시작, 메뉴 복귀
- [x] 모바일: 반응형 캔버스 + 1P/2P 터치 패드 멀티터치 (솔로에선 2P 패드 자동 숨김)
- [ ] 온라인 대전 — 정적 페이지라 서버가 없어서 미지원 (버튼 준비중 표시)

## 실행 방법

Node.js 22 LTS 권장:

```bash
npm install
npm run dev
# http://localhost:5173
```

## 조작법

- 1P 파랑: WASD 이동 + Space/F 물풍선 / 모바일 왼쪽 패드 + 💣
- 2P 빨강 (대전): 방향키 이동 + Enter 물풍선 / 모바일 오른쪽 패드 + 💣
- P/Esc: 일시정지 · R: 재시작 · M: 음소거 · 메뉴: Enter(솔로 시작)

## 아이템

- 🎈 물풍선+1: 동시 설치 가능 개수 (최대 6)
- 💧 물줄기+1: 폭발 범위 (최대 8)
- ⚡ 스피드업: 이동 속도 +0.8 (최대 8.5)
- 블록 파괴 시 35% 확률 드롭, 밟으면 즉시 획득(+50점), 폭발에 닿으면 소멸
- 스테이지 넘어가도 파워업 유지

## 구조

```
src/
  main.ts          # 부트스트랩 + 게임 루프 + 메뉴/HUD/터치 배선
  style.css        # 반응형 + 메뉴 + 터치 패드
  game/
    constants.ts   # TILE, COLS, ROWS, 밸런스 값
    map.ts         # 맵 생성 (밀도 조절)
    stage.ts       # 스테이지별 적 수·속도·밀도
    player.ts      # maxBombs / range / speed / lives / facing
    enemy.ts       # 적 스폰 (플레이어와 거리 유지)
    bomb.ts
    item.ts        # 🎈/💧/⚡ 드롭·적용·상한
    sound.ts       # WebAudio 합성 효과음 + 음소거 저장
    sprites.ts     # 캔버스 스프라이트
    engine.ts      # 모드/상태머신 + update + render
```
