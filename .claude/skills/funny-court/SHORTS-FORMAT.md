# 내레이션 숏폼 문법 (2026-11-15 조사, 사용자 지적 반영)

**핵심: 이런 숏폼은 TTS 내레이션이 처음부터 끝까지 이야기를 끌고 가는 게 주(主)이고, 화면은 그 말을 뒷받침하며 흥미를 북돋는 보조다.**
대본이 곧 영상이다. 기획은 "장면"이 아니라 "대본"부터 쓴다. (이전 「똥 작전」 v1·v2는 무음·자막 콩트로 기획해서 이 문법을 놓쳤다.)

## 1. 구조 (30초 기준)
| 블록 | 시간 | 하는 일 |
|---|---|---|
| 훅 | 0~3초 | 첫 문장 하나로 "뭐?"를 만든다. 첫 화면과 첫 대사가 같은 것을 가리킨다. 5~10단어 수준의 짧은 문장 |
| 약속·맥락 | 3~8초 | 왜 끝까지 봐야 하는지 질문(오픈 루프)을 연다 |
| 전개 | 8~22초 | 정보 전달 순서로 쓴다(연대순 X). 한 루프를 닫으면서 바로 다음 루프를 연다(리훅) |
| 페이오프 | 22~27초 | 가장 센 사실/반전 |
| 마무리·루프 | 27~30초 | 첫 문장으로 되돌아가는 말로 끝내 다시 보게 만든다(반복 재생도 시청 시간에 들어감) |

- 영상 하나에 아이디어 하나, 루프 하나, 마무리 하나.
- 아무 말도 새로 안 나오는 "빈 구간"에서 이탈한다. 모든 문장은 내용을 진전시키거나 새 질문을 연다.
- "끝까지 보세요" 같은 똑같은 장치를 매번 쓰지 말고 루프 종류(예고, 호기심 공백, 목록 예고)를 바꾼다.

## 2. 대본 분량과 말투
- 영어 기준 약 2.5단어/초(분당 130~150단어). 30초 ≈ 70~80단어. 160단어/분을 넘으면 알아듣기 어렵다.
- 한국어 음절 기준 수치는 출처를 찾지 못했다 → **제작 세션이 TTS로 실제 생성해 길이를 재고 맞춘다.** 대본은 소리 내 읽어 보고 늘어지는 곳을 줄인다.
- 문장 사이 쉼이 0.5초를 넘으면 줄인다.
- 귀로 듣는 글: 짧은 문장, 쉼표=숨, 물음표=기대. 문장부호를 과하게 쓰지 않는다. 숫자는 TTS용으로 읽는 대로 적고 자막에는 숫자로.
- 목소리(제작 세션 확인): ko-KR-SunHiNeural(여), ko-KR-InJoonNeural(남), ko-KR-HyunsuMultilingualNeural(남).

## 3. 화면은 내레이션의 보조
- 2~4초마다 화면이 바뀐다(30초에 8~12컷). 컷은 내레이션의 핵심 단어가 나오는 순간에 맞춘다.
- 말하는 명사·동사를 그대로 보여 준다(말: "땅까지 기어 내려옵니다" → 화면: 내려오는 늘보). 말과 다른 걸 보여 주면 혼란.
- 웃음은 화면이 말에 "한 술 더 뜨는" 시각 개그로 얹는다(과장된 연출, 표정, 소품). 말은 사실, 화면은 과장.
- 자막: 내레이션 전체를 큰 자막으로(음소거 시청자), 핵심 단어는 색으로 강조. 가려지지 않는 위치.
- 훅은 "첫 화면 + 첫 대사" 두 부분이 같이 작동해야 한다.

## 4. 웃김 기준표와의 관계
기준표 v2(SKILL.md)는 유지하되 다음처럼 읽는다: 과장 테스트 → **화면** 과장 + 대사의 놀라운 사실. 무음 테스트 → 자막만으로도 이해·웃김. 설명 상한(자막 1줄) → **폐기**: 내레이션 숏폼은 설명이 주다. 대신 "설명이 지루하지 않은가(루프·리훅이 있는가)"로 본다.

## 출처 (대부분 블로그·업체 글이라 수치는 참고용)
- 훅·컨텍스트·페이오프·루프 구조: https://kineclip.com/blog/how-to-write-viral-short-form-scripts-2026/ · https://syllaby.io/blog/faceless-video-script-structure-hook-formulas/
- 2.5단어/초, 35초 이하 4블록: https://outlierkit.com/resources/youtube-script-template/
- 2~4초 화면 전환, 훅=화면+첫 대사, 루프 재생: https://fluxnote.io/guides/faceless-shorts-retention-tips-2026 · https://fluxnote.io/guides/faceless-shorts-viral-hooks-guide-2026
- 오픈 루프·리훅·정보 전달 순서: https://tokcount.com/blog/scripting-for-retentive-attention-using-the-narrative-open-loop-strategy · https://www.overseeros.com/blog/addictive-storytelling-youtube · https://www.socialync.io/blog/open-loops-in-content-2026
- 분당 단어 수: https://lettercounter.org/blog/video-script-word-count/ · https://kineclip.com/blog/how-many-words-in-a-60-second-video-script-2026/
- TTS 대본은 듣는 글, 문장부호 호흡, 의미 단위 생성: https://tilnote.io/pages/69e618aca67a7484f0a6a982 · https://typecast.ai/kr/learn/?p=2204
- 첫 3초 즉시 이해: https://miso.kr/blog/thread/%EC%87%BC%EC%B8%A0-%EC%B2%AB-3%EC%B4%88-%EA%BF%80%ED%8C%81 · 3초 훅 통념 비판: https://eopla.net/magazines/36615
