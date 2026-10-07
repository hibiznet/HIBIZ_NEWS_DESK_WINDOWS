# HIBIZ News Desk V3

Windows Electron desktop app.

## 핵심 흐름
뉴스 검색 → 검색 결과에서 저장 → 내 뉴스 DB → 검색/조회 → 기사 읽기 → Google Translate / 원문 사이트

## 실행
```powershell
npm install
npm run rebuild
npm start
```

이 버전은 Vite/Vue 빌드에 의존하지 않습니다. Electron이 `frontend/index.html`을 직접 로드하므로 `npm start`만 실행하면 화면이 열립니다.

## API
API 관리에서 GNews 또는 NewsAPI Key를 등록한 후 검색합니다.

## 데이터 위치
Electron userData 아래 `data/settings.json`, `data/news.db`에 저장됩니다.

## V4 번역 기능 변경
- `구글번역 팝업열기`: Google Translate를 별도 Electron 창으로 엽니다. URL 기반 기사 자동 번역은 사용하지 않습니다.
- `구글(API)번역`: Google Cloud Translation API Key가 API 관리에 등록되고 활성화된 경우에만 활성화됩니다.
- API 관리에서 `Google Cloud Translation API`를 선택하여 키를 저장하고 `번역 테스트`로 연결을 확인할 수 있습니다.
