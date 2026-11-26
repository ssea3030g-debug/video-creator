// 앱의 PDF 분석기(exam-app/src/parse.js)로 시험지 PDF를 읽어 문항 수·정답·단답형·총점·경고를 확인한다.
// 사용: (exam-app에서 npm ci 한 뒤) node exam-n/tools/app_parse_check.mjs <PDF>
import * as pdfjs from '../../exam-app/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import { parsePdf } from '../../exam-app/src/parse.js';
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(process.argv[2])) }).promise;
const r = await parsePdf(doc);
const qs = r.questions || [];
console.log('문항', qs.length, '정답 있는 문항', qs.filter(q => q.answer).length, '단답형', (r.shorts || []).length, '총점', r.total, '경고', JSON.stringify(r.warnings), '정답표', r.hasKey);
