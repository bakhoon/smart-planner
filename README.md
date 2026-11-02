# Planner (오프라인 주간 플래너)

Windows에서 더블클릭하면 열리는 플래너 앱이에요. 위쪽 버튼으로 **한국어 / English**를 바꿀 수 있어요. 데이터는 **이 컴퓨터 안에만** 저장되고 인터넷이 없어도 동작해요.

- 화면: React (Vite)
- 데스크톱 창: Electron
- 데이터베이스: IndexedDB (Dexie.js 사용)
- 저장 위치: `%APPDATA%\Planner` 폴더 (앱을 업데이트해도 유지돼요)

## 1. 처음 한 번만 준비

1. [Node.js LTS](https://nodejs.org) 설치 (설치할 때 기본 옵션 그대로)
2. 이 폴더에서 터미널(PowerShell)을 열고:

```powershell
npm install
```

## 2. 개발하면서 보기

```powershell
npm run dev
```

코드를 고치면 창이 바로 새로고침돼요.

## 3. 더블클릭용 exe 만들기

```powershell
npm run dist
```

끝나면 `release` 폴더에 두 가지가 생겨요.

- `Planner Setup 0.1.0.exe`: 설치 파일. 설치하면 바탕화면 아이콘이 생겨요.
- `Planner-버전-win.zip`: 설치 없이 쓰는 버전. 압축을 풀고 안의 `Planner.exe`를 실행

> Windows가 "알 수 없는 게시자" 경고를 띄우면 **추가 정보 → 실행**을 누르면 돼요. 직접 만든 앱이라 서명이 없어서 그래요.

## 4. 백업

- 왼쪽 아래 **내보내기**: `planner-backup-날짜.json` 파일로 전체 데이터를 저장해요.
- **가져오기**: 백업 파일로 데이터를 통째로 되돌려요. 지금 데이터는 덮어써져요.

가끔 내보내기 해서 OneDrive나 USB에 넣어 두면 안전해요.

## 폴더 구조

```
electron/main.cjs     창 열기 (1400 x 1000)
src/db.js             데이터베이스: 카테고리, 티켓, 반복 생성, 백업
src/dates.js          날짜 도우미
src/App.jsx           주간 보드 (날짜별 / 상태별), 사이드바
src/MeetingCalendar.jsx 미팅 캘린더
src/TodayPlan.jsx     오늘의 플랜 (하루 체크리스트)
src/TicketDetail.jsx  티켓 상세 창
src/i18n.js           한국어 / English 문구
src/TicketModal.jsx   할 일 / 미팅 만들기 창
src/CategoryModal.jsx 카테고리 설정 (이름, 키, 색)
src/styles.css        다크 테마
```

## 데이터 구조

- **plans** (오늘의 플랜): `date`, `text`, `done`, `time` (선택)
- **categories**: `name`, `key` (예: MAP, 중복 불가), `colorIndex`, `lastNumber`
- **tickets**: `kind` (task / meeting), `categoryId`, `number` (MAP-00001의 숫자), `title`, `desc`, `date` (보드에 놓이는 날), `start` / `end` / `allDay` (미팅만), `deadline` / `deadlineTime` (할 일, 선택), `priority`, `status` (todo / doing / done), `seriesId` / `seriesIndex` / `seriesTotal` (반복 묶음)

나중에 데이터 구조를 바꿀 때는 `src/db.js`에서 `db.version(2).stores(...)`를 추가하면 기존 데이터를 그대로 두고 업그레이드할 수 있어요.
