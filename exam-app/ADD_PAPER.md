# 시험지 추가 절차 (다른 Claude 세션용)

이 문서대로 하면 새 시험지를 앱 목록에 올릴 수 있습니다. 앱은 정적 페이지라서, 시험지는 저장소에 넣고 배포해야 아이패드에 보입니다.

## 1. 준비물

- **문제지 PDF**: 글자(텍스트)가 들어 있는 PDF가 가장 좋습니다. 문항은 `1.` `2.` … 순서, 선지는 `①`~`⑤`로 적혀 있어야 자동 분석됩니다.
- **정답 정보** (둘 중 하나)
  - 문제지 PDF 안에 정답표(`번호` 행과 `정답` 행) 또는 `정답·해설` 쪽이 있으면 자동으로 읽힙니다.
  - 자동으로 안 읽히면 정답을 직접 적습니다. `answers`에 문항 순서대로 1~5를 넣습니다. (2번 항목 참고)
- **글자가 없는 PDF(스캔, 그림 글자)**: 자동 분석이 안 됩니다. 정답을 `answers`로 주고, 선지 위치가 없어 답안지(OMR) 패널로 마킹합니다. 이 방법은 문항 번호와 정답만 쓰고 배점은 문항당 1점입니다.

## 2. 파일 넣기

1. PDF를 `exam-app/public/papers/` 폴더에 넣습니다. 파일 이름은 `paper-숫자.pdf`처럼 기존과 겹치지 않게 짓습니다.
   - 현재 쓰는 이름: `paper-1.pdf`~`paper-7.pdf`, `paper-5-1.pdf`~`paper-5-5.pdf`
2. `exam-app/public/papers/index.json`에 항목을 추가합니다. 배열 순서가 목록 순서입니다.

```json
{ "file": "papers/paper-8.pdf", "name": "시험지 이름" }
```

옵션:
- `"noTimer": true` : 타이머 없이 풀이 (N제처럼 시간 제한이 없을 때)
- `"answers": [5, 5, 3, …]` : 정답을 직접 줄 때. 길이는 문항 수와 같아야 합니다. 선지 위치가 없는 시험지가 되어 답안지 패널로 마킹합니다.

이름을 바꾸면 기기에 이미 있는 시험지도 새 이름으로 바뀝니다. 목록에서 빼려면 `index.json`에서 항목을 지우고, 그 PDF 파일도 지웁니다. 예전 시험지를 빼야 한다면 `src/library.js`의 `RETIRED`에 경로를 적어야 기기에서도 지워집니다.

## 3. 확인

- 로컬에서 확인: `cd exam-app && npm install && npm run build` 가 오류 없이 끝나야 합니다.
- PDF 분석 결과 확인이 필요하면 `exam-app/src/parse.js`의 `parsePdf`로 문항 수와 정답 수를 셉니다. 문항 번호가 1부터 이어지고 정답이 모두 있어야 합니다.

## 4. 저장소에 올리기 (main 배포)

```bash
git checkout -b add-paper-<이름>   # 새 브랜치에서 작업
git add exam-app/public/papers exam-app/src
git commit -m "exam-app: 시험지 추가 (이름)"
git push -u origin add-paper-<이름>
```

그다음 PR을 만들고 병합합니다. 병합하면 `.github/workflows/exam-app-pages.yml`이 자동으로 배포합니다.

```bash
gh api -X POST repos/ssea3030g-debug/video-creator/pulls -f title='exam-app: 시험지 추가' -f head='add-paper-<이름>' -f base='main' -f body='시험지 추가'
gh api -X PUT repos/ssea3030g-debug/video-creator/pulls/<번호>/merge -f merge_method=merge
```

배포 상태는 아래로 확인합니다. `success`가 되면 반영된 것입니다.

```bash
gh api "repos/ssea3030g-debug/video-creator/actions/workflows/exam-app-pages.yml/runs?per_page=1" --jq '.workflow_runs[0] | "\(.run_number) \(.status) \(.conclusion)"'
```

배포가 `Deployment failed, try again later`로 실패하면 GitHub 쪽 일시 오류일 수 있습니다. 같은 워크플로를 다시 실행합니다.

```bash
gh api -X POST repos/ssea3030g-debug/video-creator/actions/workflows/exam-app-pages.yml/dispatches -f ref=main
```

## 5. 주의

- 저작권: 본인이 만든 시험지만 올립니다. 학교나 출판사의 자료라면 허락이 있어야 합니다.
- 파일 크기: 전체 배포 파일이 커질수록 실패 확률이 올라갑니다. 한 파일은 10MB 이하로 줄이는 것을 권합니다.
- 개인 정보: 학번, 이름 칸은 비우거나 지웁니다.
- 아이패드 확인: 배포 후 홈 화면 앱을 완전히 종료했다가 다시 열어 목록에 보이는지 확인합니다.
