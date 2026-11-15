# video-creator — Claude 작업 메모

코드로 영상을 만드는 저장소. 스타일과 도구는 Lemo-Opuscar 라이브러리를 쓴다.

## 기본
- 항상 한국어로 답한다.
- 클라우드 환경 "Video creator"의 setup script가 미리 설치해 둔다:
  - Lemo-Opuscar 라이브러리 `$HOME/lemo-opuscar` (npm 패키지, headless 브라우저, `.venv`)
  - ffmpeg 7 (`/usr/local/bin/ffmpeg`)
  - MarkItDown (`markitdown`)
- 없거나 오래됐으면: `LEMO_OPUSCAR_HOME=$HOME/lemo-opuscar sh $HOME/lemo-opuscar/plugin/skills/lemo-opuscar/scripts/setup.sh` 후 `… setup.sh deps`.

## 영상 만들기
- **영상 제작(렌더·믹스·인코딩)은 클라우드 환경 "Video creator"에서 도는 세션에서만 한다.** 다른 환경(Default 등) 세션에서는 기획·주제 고르기·웃김 검증까지만 하고, 제작은 "Video creator" 환경에서 새 세션을 열어 진행하라고 안내한다. 확인: `ls $HOME/lemo-opuscar/core` 와 `ffmpeg -version`(7+)이 없으면 이 환경이 아니다.
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

## 주제 고르기 (웃김 검증)
- 영상 만들기 전에 `funny-court` 스킬로 주제를 거른다: 오피스(`funny-office`) → 패널(`funny-panel`, 페르소나는 `.claude/skills/funny-court/personas.md`) → 법정(`funny-court`). 결과는 `films/_ideas/`.
- 역할 분담: 기획 세션은 주제 기획과 웃김 검증까지, 제작·수정은 "Video creator" 환경의 제작 세션이 맡는다. 확정된 기획은 한 페이지(제목, 훅, 비트, 엔딩, 스타일, 내레이션·목소리, 비율, 사실·출처)로 제작 세션에 보낸다.
- 교훈: `gravity-tunnel`처럼 교과서·숫자 위주, 캐릭터 없음, 첫 3초 훅 약함은 피한다.
