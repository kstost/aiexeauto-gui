# aiexeauto-gui

**aiexeauto-gui**는 스스로 생각하고 행동하는 자율 AI 에이전트입니다. 이 혁신적인 애플리케이션은 자연어 입력을 이해하고 최적의 방법으로 컴퓨터 작업을 수행하여 복잡한 작업도 자동으로 처리합니다.  

## 주요 특징

- **안전한 수행**: Docker를 기반으로 작동하여 안전하게 작업을 수행합니다.
- **로컬 LLM 지원**: 로컬에서 실행되는 LLM을 사용하여 비용 절감과 데이터 보안을 확보합니다.
- **자연어 입력**: "파일들을 정리해줘" 또는 "비디오를 편집해줘"와 같이 간단한 입력으로 작업을 수행합니다.
- **자동화 기능**: 파일 관리, 이미지 편집, 문서 작업 등 다양한 반복 작업을 자동으로 처리합니다.
- **크로스 플랫폼 지원**: Windows와 macOS 모두 지원합니다.
- **실시간 진행 상황 표시**: 작업 진행 상태를 깔끔한 인터페이스로 확인할 수 있습니다.

## 시스템 요구 사항

- **운영체제**: Windows, macOS

## 설치 방법

### 1. NodeJS 설치

1. Download and install Node.js from [nodejs.org](https://nodejs.org).

### 2. AIEXEAUTO-GUI 설치

일반 사용자를 위한 간편한 AIEXEAUTO-GUI 설치 방법은 아래와 같습니다.

#### Windows AIEXEAUTO-GUI 설치
1. **PowerShell(관리자 권한) 실행 후 아래 명령어 실행**:
   ```powershell
   if (Get-Command npm -ErrorAction SilentlyContinue) { $timestamp = Get-Date -Format "yyyyMMddHHmmss"; $folderName = "_aiexeauto-gui_project_$timestamp"; $desktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), $folderName); New-Item -ItemType Directory -Path $desktopPath -Force; if (Test-Path $desktopPath) { Set-Location -Path $desktopPath; Invoke-WebRequest -Uri "https://github.com/kstost/aiexeauto-gui/archive/refs/heads/main.zip" -OutFile "__aiexeauto-gui_project__.zip" -ErrorAction Stop; if (Test-Path "__aiexeauto-gui_project__.zip") { Expand-Archive -Path "__aiexeauto-gui_project__.zip" -DestinationPath "."; Set-Location -Path "aiexeauto-gui-main"; npm i; if ($?) { npm run build; if ($?) { ii "dist"; ii "dist\\aiexeauto Setup*.exe" } } } } } else { Write-Output "npm is not installed. Please download and install it from https://nodejs.org." }
   ```

#### macOS AIEXEAUTO-GUI 설치
1. **Terminal 실행 후 아래 명령어 실행**:
   ```bash
   sudo chown -R 501:20 ~/.npm 2>/dev/null; command -v npm >/dev/null 2>&1 && { timestamp=$(date +%Y%m%d%H%M%S) && cd ~/Downloads && mkdir "_aiexeauto-gui_project_$timestamp" && cd "_aiexeauto-gui_project_$timestamp" && git clone https://github.com/kstost/aiexeauto-gui && cd aiexeauto-gui && npm i && npm run build && open dist/aiexeauto-*.dmg; } || { echo "npm is not installed. Please download and install it from https://nodejs.org."; }
   ```

### 3. Docker 설치

AIEXEAUTO-GUI 설치 외 Docker의 설치가 필요합니다. 아래 단계를 참고하여 설치를 진행해주세요.  

1. **Docker 설치**
   - 최신 버전의 [Docker Desktop](https://www.docker.com/)을 다운로드하여 설치합니다.

2. **Docker 이미지 빌드**

   **macOS의 경우:**
   ```bash
   git clone https://github.com/kstost/aiexeauto-gui.git && cd aiexeauto-gui/my-docker-app && docker build --platform linux/x86_64 -t my-node-ubuntu .
   ```

   **Windows의 경우:**
   1) 시작 메뉴에서 "PowerShell"을 관리자 권한으로 실행합니다.  
   2) 아래 명령어들을 순차적으로 실행합니다:
   ```powershell
   # 실행 정책 변경
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

   # 디렉터리 생성
   New-Item -ItemType Directory -Path "my-docker-app" -Force

   # 작업 디렉터리로 이동
   cd my-docker-app

   # Dockerfile 다운로드
   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/kstost/aiexeauto-gui/refs/heads/main/my-docker-app/Dockerfile" -OutFile "Dockerfile"

   # Docker 이미지 빌드
   docker build --platform linux/x86_64 -t my-node-ubuntu .
   ```

### 4. Ollama 설치 (선택사항)

Ollama는 로컬에서 실행되는 LLM입니다. Ollama를 사용하고자 하는 경우 아래 단계를 참고하여 설치를 진행해주세요.

1. **Ollama 설치**
   - 최신 버전의 [Ollama](https://ollama.com/)을 다운로드하여 설치합니다.

2. **Ollama 모델 다운로드**
   ```bash
   ollama run qwen2.5
   ```

모델의 탐색은 https://ollama.com/search?c=tools 에서 확인할 수 있습니다.
AIEXEAUTO-GUI는 Tools기반으로 모델을 사용하기 때문에 모델을 선택할 때 Tools 카테고리를 선택해주세요.

## 간단한 사용 방법

설정이 완료되었다면, 처리하고자 하는 파일이 담긴 폴더를 선택한 후, 원하는 작업 내용을 자연어로 입력하여 요청하면 AI가 자동으로 작업을 수행합니다.  

작업 과정에서 AI는 여러 단계를 거쳐 필요한 코드를 생성하고 실행합니다. 이때, 사용자는 AI가 생성한 코드를 검토한 후 실행 여부를 결정할 수 있습니다.  

모든 작업이 완료되면, 결과물이 담긴 폴더가 자동으로 열립니다. 동시에, 열린 폴더가 다음 작업을 위한 기본 폴더로 자동 선택되므로, 사용자는 별도의 폴더 선택 없이 즉시 다음 작업을 이어갈 수 있습니다.  

단, **이전 작업의 맥락의 내용은 다음 작업에 공유되지 않습니다**

## 예방 조치 및 주의사항

- **데이터 백업**: 중요한 데이터는 작업 전 반드시 백업하세요.
- **보안**: 애플리케이션이 실제 작업을 수행할 때 보안에 유의하세요.
- **API 요금**: 작업에 따라 Claude, DeepSeek, OpenAI 등의 API 요금이 발생할 수 있습니다.

## 문제 해결

- **일반 오류**: API 키, 경로, 권한 문제를 확인하세요.
- **지원 요청**: 추가 지원이 필요하면 [COKAC 사이트](https://cokac.com) 또는 "코드깎는노인" 커뮤니티를 이용하세요.

## 라이선스

이 소프트웨어는 MIT 라이선스로 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 확인하세요.

## 기여

- 버그 신고, 기능 요청 및 풀 리퀘스트를 환영합니다.
- 기여 시 테스트 코드를 포함해 주세요.

## 면책 조항

이 소프트웨어는 프로토타입 단계입니다. 사용에 따른 모든 책임은 사용자에게 있으며, 중요한 데이터나 시스템에 사용할 때는 주의가 필요합니다.

