# video-creator — Claude 작업 메모

코드로 영상을 만드는 저장소. 스타일과 도구는 Lemo-Opuscar 라이브러리를 쓴다.

## 기본
- 항상 한국어로 답한다.
- 클라우드 환경 "실험실"의 setup script가 미리 설치해 둔다: MarkItDown(`markitdown`), 포니테일·그래피파이 스킬, FreeLLMAPI(`~/freellmapi`).
- **ffmpeg 7과 Lemo-Opuscar는 미리 설치하지 않는다. 사용자가 요청할 때만 설치한다.** 영상 제작을 요청받았는데 없으면 먼저 설치할지 묻지 말고 아래대로 설치한 뒤 진행한다.

### 요청 시 설치
- Lemo-Opuscar (`$HOME/lemo-opuscar`: npm 패키지, headless 브라우저, `.venv`):
  ```bash
  export LEMO_OPUSCAR_HOME="$HOME/lemo-opuscar"
  rm -rf /tmp/lemo-src && git clone -q --depth 1 https://github.com/lemomo-ai/lemo-opuscar.git /tmp/lemo-src
  sh /tmp/lemo-src/plugin/skills/lemo-opuscar/scripts/setup.sh
  sh /tmp/lemo-src/plugin/skills/lemo-opuscar/scripts/setup.sh deps
  rm -rf /tmp/lemo-src
  ```
- ffmpeg 7 (`/usr/local/bin/ffmpeg`; 이미지 기본은 6.x라서 Lemo-Opuscar의 mux 단계에 7 이상이 필요):
  ```bash
  curl -fsSL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | tar xJ -C /opt
  ln -sf /opt/ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ffmpeg
  ln -sf /opt/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ffprobe
  ```
- 이미 있으면(`ffmpeg -version`이 7 이상, `~/lemo-opuscar` 존재) 다시 설치하지 않는다.

## 시험지 풀이 앱
- `exam-app/`: 시험지 PDF를 올려 45분 타이머로 푸는 PWA (펜슬 필기·마킹·자동 채점). 설명·실행법은 `exam-app/README.md`. 파서 규칙은 `exam-app/src/parse.js`.

## 국어 모의고사·n제 제작 (exam-n/core/)
- 문항 제작은 `exam-n/core/핵심-틀.md`만 보고 한다(지침 원문 전체는 읽지 않는다). 순서는 `exam-n/core/작업-흐름.md`, 난이도는 `exam-n/core/난이도-상향-프로토콜.md`.
- 만든 뒤에는 오류(정답 오류·복수 정답·근거 없음·계산·뜻풀이)만 검수하고, "지침서 기준 검수도 할까요?"라고 묻는다. 하라고 하면 그때 지침 원문 전체(`exam-n/docs/`, 현재 `claude/vibrant-einstein-iskm3i` 브랜치)로 검수·선지 다듬기·형식 맞추기를 한다.
- 새 세션에서는 세트 1개만 먼저 만들어 보여주고, 허락받은 뒤 나머지를 만든다.

## 영상 만들기
- 지침 순서: `$HOME/lemo-opuscar/AGENTS.md` → `styles/<slug>/STYLE.md` → `DIRECTOR.md` / `TECHNIQUE.md`. 스타일 목록: `styles/README.md`.
- 프로젝트 폴더는 **이 저장소의 `films/<이름>/`**. 라이브러리 도구는 `cd $HOME/lemo-opuscar && node core/render/… <프로젝트 절대경로>`로 실행.
- `build.sh` 맨 위: `LIB=${LIB:-$HOME/lemo-opuscar}` (예: `films/dry-gulch/build.sh`).
- 완성되면 mp4·srt·poster.jpg·TREATMENT.md·CREDITS·소스·build.sh를 `films/<이름>/`에 두고 커밋·푸시 (`out/`, `mix.wav`, `events.json`은 `.gitignore`).
- 재사용: 픽셀 RPG 스타일은 `films/dry-gulch/`의 엔진(px.js, font.js, ui.js, cowboy.js, scenes.js, mix.py)을 복사해 시작하면 토큰이 크게 준다.

### 영상 취향 (기본값 — 요청에 따로 없으면 이대로, 질문 최소화)
- 길이 30초, 1920×1080, 24fps.
- 언어: 한국어. 화면 글자는 한국어가 기본; 스타일의 폰트가 한글을 못 쓰면(픽셀 폰트 등) 한글 폰트(OFL)를 서브셋해 쓰고, 어려우면 영어로 하고 한 줄로 알린다.
- 내레이션: 없음(대화창·자막·효과음 위주). 요청 시에만 TTS.
- 스토리보드 승인 단계 없음. 질문은 한 번에 몰아서, 꼭 필요한 것만.
- 실존 작품·브랜드·인물 이름은 쓰지 않는다(제목 포함).

## 원고 투입 (MarkItDown)
- PDF·DOCX·PPTX·XLSX → 마크다운: `markitdown <파일> -o <파일>.md`.
- 2단 편집 PDF(시험지 등)는 좌우 단 줄이 섞이므로, 가능하면 HTML·DOCX 원본을 쓰거나 변환 결과를 확인한다.
- 사실·인용은 원문 그대로 쓴다.

## 라이선스 메모
- Lemo-Opuscar로 만든 영상은 상업 이용 가능. 엔진 코드는 MIT(소스 배포 시 저작권·라이선스 문구 포함).
- 스타일 문서 자체를 판매하거나 상업 서비스에 넣는 것은 불가(CC BY-NC + 별도 상업 라이선스).
- 외부 효과음·이미지는 CC0/CC BY만, CREDITS에 출처 기록.
