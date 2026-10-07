# HIBIZ News Desk - Windows EXE 만들기

## 권장 환경

- Windows 10/11 64-bit
- Node.js 20 LTS 또는 22 LTS
- npm 10 이상
- 인터넷 연결 필요 (최초 `npm install` 및 Electron 패키지 다운로드)

## 가장 쉬운 방법

1. 이 폴더를 Windows PC에 복사합니다.
2. `BUILD_WINDOWS.bat`을 더블클릭합니다.
3. 빌드가 완료되면 `release` 폴더에 설치 파일이 생성됩니다.

예상 파일명:

`HIBIZ-News-Desk-Setup-4.0.0.exe`

## PowerShell 사용

PowerShell에서:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\BUILD_WINDOWS.ps1
```

## 직접 실행

```powershell
npm install
npx electron-rebuild -f -w better-sqlite3
npm run dist
```

## 중요

`better-sqlite3`는 Electron용 네이티브 모듈이므로 반드시 `electron-rebuild` 단계를 거친 후 패키징해야 합니다.

빌드 후에는 `release` 폴더의 `HIBIZ-News-Desk-Setup-4.0.0.exe`를 실행해서 설치합니다.
