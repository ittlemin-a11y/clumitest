# CLUMI UNIVERSE : MY WEATHER ISLAND

> “Every heart has its own weather.”

마음의 감정을 7가지 날씨로 골라, 떠 있는 구름 섬과 클루미를 꾸미는 3D 웹게임.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

## 구성

- **Three.js + OrbitControls** — 실제 3D 구름 섬, 조명, 그림자(PCFSoftShadowMap), 파티클
- **PC / 모바일** — 마우스 드래그·휠, 원터치 드래그·핀치 줌
- **감정 7종** — 기쁨(Clumi) · 슬픔(Droppy) · 분노(Flamy) · 두려움(Windy) · 새로움(Stella) · 피로(Mist) · 희망(Rooty)
  - 컬러·하늘·조명·파티클 설정: `src/config/emotions.js`
- **소품 8종** — 나무 · 꽃 · 구름 · 버섯 · 작은 집 · 별 · 돌 · 무지개 (`src/objects/propFactory.js`)
- **자동 저장** — 감정 날씨와 소품 위치를 localStorage 에 저장/복원 (`src/systems/storage.js`)
- **이미지 저장** — 현재 섬을 로고·감정 라벨이 들어간 PNG 카드로 다운로드 (`src/systems/capture.js`)

## 3D 모델 교체 (GLB)

지금 보이는 클루미는 **임시 3D 모델**(Three.js 지오메트리로 제작)입니다.
`public/models/clumi.glb` 를 넣고 `public/models/manifest.json` 의 `model` 값을 파일명으로 바꾸면
`GLTFLoader` 가 모델을 불러와 그대로 교체합니다. 자세한 내용은 `public/models/README.md`.

## 감정 컬러 커스텀

- 기본값: `src/config/emotions.js` 의 `color` / `deep` / `skyTop` / `skyBottom`
- 플레이 중: 우측 상단 (i) → “지금 감정 색”에서 바로 조정 (브라우저에 저장됨)

## 조작

| 동작 | PC | 모바일 |
| --- | --- | --- |
| 섬 회전 | 드래그 | 원터치 드래그 |
| 확대/축소 | 휠 | 핀치 |
| 소품 놓기 | 꾸미기 → 소품 선택 → 섬 클릭 | 동일 (터치) |
| 소품 옮기기 | 소품 드래그 | 소품 드래그 |
| 소품 삭제 | 소품 선택 → 삭제 | 동일 |
| 클루미 반응 | 클릭 | 터치 |

## 실작동 검증 (QA)

`qa/` 폴더에 Playwright 검증 스크립트와 검증 스크린샷이 있습니다.

```bash
npm run build
npx vite preview --host 127.0.0.1 --port 4173 &
node qa/pc.mjs     # PC 1280×800: 첫 화면 → 감정 7종 → 소품 배치/이동/삭제 → 새로고침 복원 → 이미지 저장
node qa/mobile.mjs # 모바일 390×844 (터치): 시작 → 감정 전환 → 소품 배치 → 핀치 줌 → 회전 → 새로고침 복원
```

- 결과 스크린샷: `qa/last-*.png` (PC), `qa/mfinal-*.png` (모바일)
- 콘솔 로그: `qa/last-console-pc.txt`, `qa/mfinal-console-mobile.txt`
- 두 스크립트 모두 **JS 콘솔 에러 0건**으로 통과합니다.
- QA 스크립트는 `playwright` 패키지가 필요합니다 (`npm i -D playwright`).
