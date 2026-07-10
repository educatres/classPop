# GitHub Pages + Google Form / Google Sheet 上課回答系統｜開發規格書

版本：v1.0  
用途：交由 Codex / 開發者實作  
目標平台：GitHub Pages 靜態網站  
資料儲存：Google Form 寫入 + Google Sheet 公開讀取  
題型範圍：單選題，固定四個選項 A / B / C / D  
身份機制：匿名，不要求學生登入

---

## 1. 專案目標

本專案要開發一個「上課即時回答系統」，功能類似 Kahoot 的課堂單選題互動流程。

老師開啟 GitHub Pages 網站後，輸入 Google Form / Google Sheet 設定，產生學生作答連結與 QR Code。學生掃描 QR Code 後進入作答頁。老師在主持頁建立並開放問題，學生用手機選擇 A / B / C / D 作答。老師公布答案後，學生手機顯示自己答對或答錯，老師端顯示全班各選項作答人數、答對人數、答錯人數與答對率。

本系統不建立後端伺服器、不使用資料庫、不使用 Apps Script、不使用 Google OAuth。所有資料寫入透過 Google Form 完成，資料讀取透過公開 Google Sheet 完成。

---

## 2. 核心設計原則

1. 只能使用 GitHub Pages 靜態網頁。
2. 不建立後端伺服器。
3. 不使用 Apps Script。
4. 不使用 Google OAuth。
5. 不要求學生登入。
6. 不記錄學生姓名、學號、Email 或個資。
7. 老師提供 Google Form 作為寫入入口。
8. Google Form 回應連結到 Google Sheet。
9. Google Sheet 設定為「知道連結的人可以檢視」。
10. 前端定期讀取 Google Sheet，還原目前課堂與題目狀態。
11. 資料採用 Event Log 模式，不直接修改既有資料列。
12. 每一個老師動作或學生作答，都新增一筆事件資料。
13. 第一版只支援固定四個選項：A、B、C、D。
14. 第一版不做正式排行榜與速度計分。
15. 系統定位為課堂互動工具，不作為正式考試系統。

---

## 3. 使用角色

### 3.1 老師

老師負責：

- 建立 Google Form。
- 將 Google Form 回應連結到 Google Sheet。
- 將 Google Sheet 設為知道連結的人可以檢視。
- 在系統設定頁輸入 Google Form / Google Sheet 相關資料。
- 產生學生 QR Code。
- 建立題目。
- 開放作答。
- 關閉作答。
- 公布答案。
- 查看作答統計。

### 3.2 學生

學生負責：

- 掃描 QR Code。
- 進入學生作答頁。
- 等待老師開放題目。
- 選擇 A / B / C / D 其中一個答案。
- 送出答案。
- 等待老師公布答案。
- 查看自己答對或答錯。

---

## 4. 系統頁面

系統包含三個主要頁面。

```text
/index.html
/host.html
/play.html
```

### 4.1 index.html：老師設定頁

用途：讓老師輸入 Google Form / Google Sheet 設定，產生主持頁連結、學生作答連結與 QR Code。

主要功能：

1. 輸入 Google Sheet ID。
2. 輸入 Sheet 名稱或 gid。
3. 輸入 Google Form submit URL。
4. 輸入各欄位對應的 Google Form entry ID。
5. 自動產生 class_id。
6. 產生老師主持頁連結。
7. 產生學生作答頁連結。
8. 產生 QR Code。
9. 複製連結。
10. 儲存設定到 localStorage，方便老師下次使用。

### 4.2 host.html：老師主持 / 投影頁

用途：老師建立題目、控制作答流程、投影題目與查看統計。

主要功能：

1. 顯示本次課堂 QR Code。
2. 顯示學生作答連結。
3. 建立單選題。
4. 固定四個選項 A / B / C / D。
5. 設定正確答案。
6. 開放作答。
7. 關閉作答。
8. 公布答案。
9. 顯示目前作答人數。
10. 顯示 A / B / C / D 各選項人數。
11. 公布後顯示答對人數、答錯人數與答對率。
12. 提供「下一題」功能。
13. 提供「重設本題」功能。

### 4.3 play.html：學生作答頁

用途：學生用手機作答。

主要功能：

1. 顯示等待老師開放題目。
2. 顯示目前題目。
3. 顯示 A / B / C / D 四個大型按鈕。
4. 學生點選答案後送出。
5. 送出後鎖定答案。
6. 老師尚未公布時，顯示「已送出，等待老師公布答案」。
7. 老師公布後，顯示：
   - 我的答案。
   - 正確答案。
   - 答對或答錯。
8. 若老師進入下一題，學生頁自動更新。

---

## 5. Google Form 欄位設計

請老師建立一份 Google Form，所有欄位皆使用「簡答」或「段落」。Google Form 送出後會自動寫入 Google Sheet。

| 欄位名稱 | 建議型態 | 說明 |
|---|---|---|
| class_id | 簡答 | 課堂 ID |
| event_type | 簡答 | 事件類型 |
| question_id | 簡答 | 題目 ID |
| question_text | 段落 | 題目文字 |
| option_a | 簡答 | A 選項文字 |
| option_b | 簡答 | B 選項文字 |
| option_c | 簡答 | C 選項文字 |
| option_d | 簡答 | D 選項文字 |
| correct_answer | 簡答 | 正確答案，A / B / C / D |
| answer | 簡答 | 學生作答，A / B / C / D |
| student_session_id | 簡答 | 學生瀏覽器匿名 ID |
| client_timestamp | 簡答 | 前端產生的時間戳記 |
| extra_json | 段落 | 保留欄位，可留空 |

Google Sheet 會自動多出第一欄 `Timestamp`，由 Google Form 產生。

---

## 6. Google Sheet 欄位設計

Google Form 回應表應包含以下欄位。

| 欄位 | 說明 | 範例 |
|---|---|---|
| Timestamp | Google Form 自動時間 | 2026/07/10 上午8:00:00 |
| class_id | 課堂 ID | class_abcd1234 |
| event_type | 事件類型 | question_open |
| question_id | 題目 ID | q_001 |
| question_text | 題目文字 | 下列何者正確？ |
| option_a | A 選項 | 選項 A |
| option_b | B 選項 | 選項 B |
| option_c | C 選項 | 選項 C |
| option_d | D 選項 | 選項 D |
| correct_answer | 正確答案 | C |
| answer | 學生答案 | B |
| student_session_id | 匿名學生 ID | stu_x7f9k2 |
| client_timestamp | 前端時間 | 2026-07-10T00:00:00.000Z |
| extra_json | 保留資料 | {} |

---

## 7. 事件類型

所有老師操作與學生作答都寫成事件。

### 7.1 老師事件

| event_type | 說明 |
|---|---|
| question_create | 建立題目，但尚未開放作答 |
| question_open | 開放作答 |
| question_close | 關閉作答 |
| answer_reveal | 公布答案 |
| question_reset | 重設本題 |
| class_reset | 重設本次課堂 |

### 7.2 學生事件

| event_type | 說明 |
|---|---|
| answer_submit | 學生送出答案 |

---

## 8. 題目流程

### 8.1 老師建立題目

老師在 host.html 輸入：

- 題目文字。
- A 選項。
- B 選項。
- C 選項。
- D 選項。
- 正確答案。

按下「建立題目」後，送出 `question_create` 事件。

### 8.2 老師開放作答

老師按下「開放作答」後，送出 `question_open` 事件。

學生端偵測到目前題目狀態為 open 後，顯示 A / B / C / D 四個按鈕。

### 8.3 學生送出答案

學生點選答案後，送出 `answer_submit` 事件。

送出後學生端應立即鎖定答案，避免同一題反覆送出。

### 8.4 老師關閉作答

老師按下「關閉作答」後，送出 `question_close` 事件。

學生端偵測到狀態為 closed 後，不允許再作答。

### 8.5 老師公布答案

老師按下「公布答案」後，送出 `answer_reveal` 事件。

學生端偵測到狀態為 revealed 後，比對自己的答案與正確答案，顯示答對或答錯。

---

## 9. 狀態還原規則

前端讀取 Google Sheet 後，依照以下規則還原目前課堂狀態。

### 9.1 過濾課堂

只處理 `class_id` 等於目前 URL 參數中的資料列。

### 9.2 找出目前題目

以老師事件為主，找出最新的題目事件。

老師事件包含：

```text
question_create
question_open
question_close
answer_reveal
question_reset
```

依照時間排序，最新一筆老師題目事件決定目前題目狀態。

### 9.3 時間排序優先順序

排序時依序使用：

1. `client_timestamp`
2. Google Form 自動產生的 `Timestamp`
3. Google Sheet 列順序，越後面的列視為越新

### 9.4 題目狀態判斷

| 最新老師事件 | 題目狀態 | 說明 |
|---|---|---|
| 無 | waiting | 尚未有題目 |
| question_create | created | 題目已建立但未開放 |
| question_open | open | 學生可作答 |
| question_close | closed | 已截止作答 |
| answer_reveal | revealed | 已公布答案 |
| question_reset | created | 回到題目建立狀態 |

### 9.5 學生答案還原

對目前 `question_id`，只處理 `event_type = answer_submit` 的資料列。

同一位學生同一題如果送出多筆答案，第一版規則為：

```text
只採用最早一筆有效答案
```

理由：符合測驗情境，學生送出後不能改答案。

### 9.6 老師端統計

老師端統計項目：

- total_answers：有效作答總人數。
- count_a：選 A 人數。
- count_b：選 B 人數。
- count_c：選 C 人數。
- count_d：選 D 人數。
- correct_count：答對人數。
- wrong_count：答錯人數。
- correct_rate：答對率。

答對率計算：

```text
correct_rate = correct_count / total_answers * 100
```

若 `total_answers = 0`，答對率顯示為 0%。

---

## 10. URL 參數設計

### 10.1 老師主持頁

```text
/host.html?class_id=class_abcd1234&sheet_id=xxxx&sheet_name=Form%20Responses%201&form_url=xxxx&field_class_id=entry.xxxx&...
```

### 10.2 學生作答頁

```text
/play.html?class_id=class_abcd1234&sheet_id=xxxx&sheet_name=Form%20Responses%201&form_url=xxxx&field_class_id=entry.xxxx&...
```

### 10.3 必要參數

| 參數 | 必填 | 說明 |
|---|---|---|
| class_id | 是 | 課堂 ID |
| sheet_id | 是 | Google Sheet ID |
| sheet_name | 否 | Sheet 名稱 |
| gid | 否 | Sheet gid |
| form_url | 是 | Google Form submit URL |
| field_class_id | 是 | class_id 對應 entry ID |
| field_event_type | 是 | event_type 對應 entry ID |
| field_question_id | 是 | question_id 對應 entry ID |
| field_question_text | 是 | question_text 對應 entry ID |
| field_option_a | 是 | option_a 對應 entry ID |
| field_option_b | 是 | option_b 對應 entry ID |
| field_option_c | 是 | option_c 對應 entry ID |
| field_option_d | 是 | option_d 對應 entry ID |
| field_correct_answer | 是 | correct_answer 對應 entry ID |
| field_answer | 是 | answer 對應 entry ID |
| field_student_session_id | 是 | student_session_id 對應 entry ID |
| field_client_timestamp | 是 | client_timestamp 對應 entry ID |
| field_extra_json | 否 | extra_json 對應 entry ID |

---

## 11. 前端資料結構

### 11.1 QuizConfig

```typescript
type QuizConfig = {
  classId: string;
  sheetId: string;
  sheetName?: string;
  gid?: string;
  formUrl: string;
  fields: {
    class_id: string;
    event_type: string;
    question_id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: string;
    answer: string;
    student_session_id: string;
    client_timestamp: string;
    extra_json?: string;
  };
};
```

### 11.2 QuizEvent

```typescript
type QuizEventType =
  | 'question_create'
  | 'question_open'
  | 'question_close'
  | 'answer_reveal'
  | 'question_reset'
  | 'class_reset'
  | 'answer_submit';

type AnswerChoice = 'A' | 'B' | 'C' | 'D' | '';

type QuizEvent = {
  timestamp_server?: string;
  class_id: string;
  event_type: QuizEventType;
  question_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: AnswerChoice;
  answer: AnswerChoice;
  student_session_id: string;
  client_timestamp: string;
  extra_json?: string;
  row_index?: number;
};
```

### 11.3 QuestionState

```typescript
type QuestionStatus = 'waiting' | 'created' | 'open' | 'closed' | 'revealed';

type QuestionState = {
  class_id: string;
  question_id: string;
  status: QuestionStatus;
  question_text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer: AnswerChoice;
  updated_at: string;
};
```

### 11.4 AnswerState

```typescript
type AnswerState = {
  question_id: string;
  student_session_id: string;
  answer: 'A' | 'B' | 'C' | 'D';
  submitted_at: string;
};
```

### 11.5 QuizStats

```typescript
type QuizStats = {
  question_id: string;
  total_answers: number;
  counts: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
  correct_answer: AnswerChoice;
  correct_count: number;
  wrong_count: number;
  correct_rate: number;
};
```

---

## 12. Google Form 寫入

### 12.1 寫入方式

因為 Google Form 可能有 CORS 限制，第一版使用：

```text
fetch + mode: 'no-cors'
```

或 hidden iframe。

建議優先使用 `fetch`。

### 12.2 submitEvent 範例

```javascript
async function submitEvent(config, event) {
  const formData = new FormData();

  formData.append(config.fields.class_id, event.class_id || '');
  formData.append(config.fields.event_type, event.event_type || '');
  formData.append(config.fields.question_id, event.question_id || '');
  formData.append(config.fields.question_text, event.question_text || '');
  formData.append(config.fields.option_a, event.option_a || '');
  formData.append(config.fields.option_b, event.option_b || '');
  formData.append(config.fields.option_c, event.option_c || '');
  formData.append(config.fields.option_d, event.option_d || '');
  formData.append(config.fields.correct_answer, event.correct_answer || '');
  formData.append(config.fields.answer, event.answer || '');
  formData.append(config.fields.student_session_id, event.student_session_id || '');
  formData.append(config.fields.client_timestamp, new Date().toISOString());

  if (config.fields.extra_json) {
    formData.append(config.fields.extra_json, event.extra_json || '{}');
  }

  await fetch(config.formUrl, {
    method: 'POST',
    mode: 'no-cors',
    body: formData,
  });
}
```

注意：`no-cors` 模式下無法確認送出是否成功。UI 只能顯示「已送出，資料同步可能需要幾秒鐘」。

---

## 13. Google Sheet 讀取

### 13.1 優先使用 GViz JSON

```javascript
async function fetchSheetRows(sheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  const text = await res.text();

  const jsonText = text.substring(
    text.indexOf('{'),
    text.lastIndexOf('}') + 1
  );

  const data = JSON.parse(jsonText);
  return parseGvizRows(data);
}
```

### 13.2 替代使用 CSV

```javascript
async function fetchCsvRows(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  const csv = await res.text();
  return parseCsv(csv);
}
```

---

## 14. 同步策略

### 14.1 預設同步頻率

```text
SYNC_INTERVAL_MS = 3000
```

老師端與學生端每 3 秒讀取一次 Google Sheet。

### 14.2 手動同步

老師端與學生端皆提供「重新整理」按鈕。

### 14.3 樂觀更新

學生送出答案後，前端立即顯示已作答，不等待 Google Sheet 同步成功。

### 14.4 防止重複送出

學生端應使用 localStorage 記錄每個 question_id 是否已作答。

localStorage key 建議：

```text
classquiz:{class_id}:answers
```

value 範例：

```json
{
  "q_001": "B",
  "q_002": "D"
}
```

若本機已記錄某題已作答，不允許再次送出。

---

## 15. 學生匿名 ID

學生第一次進入 play.html 時，前端產生一個匿名 ID，存在 localStorage。

格式：

```text
stu_ + random string
```

範例：

```text
stu_x7f9k2p1
```

localStorage key：

```text
classquiz:student_session_id
```

此 ID 不代表真實身份，只用於同一裝置辨識與避免同一題重複作答。

---

## 16. 老師端 UI 規格

### 16.1 頁首區

顯示：

- 系統名稱。
- 課堂 ID。
- 學生 QR Code。
- 學生作答連結。
- 複製連結按鈕。

### 16.2 題目編輯區

欄位：

- 題目文字 textarea。
- A 選項 input。
- B 選項 input。
- C 選項 input。
- D 選項 input。
- 正確答案 radio：A / B / C / D。

按鈕：

- 建立題目。
- 開放作答。
- 關閉作答。
- 公布答案。
- 下一題。
- 重設本題。

### 16.3 投影題目區

顯示：

- 題目文字。
- A / B / C / D 四個選項卡片。
- 目前狀態：未開放 / 作答中 / 已截止 / 已公布。
- 已作答人數。

公布答案後，正確選項需高亮顯示。

### 16.4 統計區

顯示：

| 選項 | 人數 |
|---|---:|
| A | 0 |
| B | 0 |
| C | 0 |
| D | 0 |

另顯示：

- 總作答人數。
- 答對人數。
- 答錯人數。
- 答對率。

建議使用簡單長條圖，不需外部圖表套件也可用 CSS 實作。

---

## 17. 學生端 UI 規格

### 17.1 等待狀態

文案：

```text
等待老師開放題目
請看投影畫面或稍候
```

### 17.2 作答狀態

顯示：

- 題目文字。
- A / B / C / D 四個大型按鈕。

按鈕需適合手機觸控：

- 高度至少 64px。
- 字體至少 20px。
- 選項之間有足夠間距。

### 17.3 已作答狀態

文案：

```text
已送出答案
你的答案：B
等待老師公布答案
```

### 17.4 已截止狀態

若學生尚未作答但老師已關閉作答：

```text
作答已截止
請等待老師公布答案
```

### 17.5 公布答案狀態

若答對：

```text
答對了！
你的答案：C
正確答案：C
```

若答錯：

```text
答錯了
你的答案：B
正確答案：C
```

---

## 18. 視覺設計建議

### 18.1 整體風格

- 清楚、明亮、適合投影。
- 老師端適合大螢幕。
- 學生端適合手機直向操作。

### 18.2 四個選項顏色

可參考 Kahoot 的視覺記憶，但不要使用品牌素材。

建議：

| 選項 | 顏色概念 |
|---|---|
| A | 紅色系 |
| B | 藍色系 |
| C | 黃色系 |
| D | 綠色系 |

### 18.3 選項符號

可加入簡單符號增加辨識：

| 選項 | 符號 |
|---|---|
| A | ▲ |
| B | ◆ |
| C | ● |
| D | ■ |

---

## 19. 錯誤處理

### 19.1 設定不完整

顯示：

```text
系統設定不完整，請回到老師設定頁重新產生連結。
```

### 19.2 Google Sheet 無法讀取

顯示：

```text
無法讀取 Google Sheet，請確認試算表已設定為「知道連結的人可以檢視」。
```

### 19.3 Google Form 無法確認送出

顯示：

```text
已嘗試送出，資料同步可能需要幾秒鐘。
```

### 19.4 尚未建立題目

學生端顯示：

```text
目前尚未有題目，請等待老師開始。
```

### 19.5 作答已截止

學生端顯示：

```text
這一題已截止作答。
```

---

## 20. 安全性與限制

本系統定位為低門檻課堂互動工具，需在 README 與設定頁提醒：

1. 請勿要求學生輸入姓名、學號、Email、電話或其他個資。
2. Google Sheet 若設為公開檢視，知道連結的人可能讀取資料。
3. Google Form submit URL 若外流，可能被惡意送出資料。
4. 本系統沒有登入與權限控管。
5. 本系統不適合正式考試。
6. 本系統不保證毫秒級同步。
7. Google Form 寫入 Google Sheet 可能有數秒延遲。
8. 第一版不做速度計分與正式排行榜。
9. 同一位學生可用不同裝置重複作答，系統無法完全防止。

---

## 21. 建議檔案結構

若使用純 HTML / CSS / JavaScript：

```text
class-quiz/
├── index.html
├── host.html
├── play.html
├── css/
│   └── styles.css
├── js/
│   ├── config.js
│   ├── google-form.js
│   ├── google-sheet.js
│   ├── quiz-store.js
│   ├── host.js
│   ├── play.js
│   ├── qr.js
│   └── utils.js
└── README.md
```

若使用 Vite + TypeScript：

```text
class-quiz/
├── index.html
├── host.html
├── play.html
├── package.json
├── vite.config.ts
├── src/
│   ├── config.ts
│   ├── googleForm.ts
│   ├── googleSheet.ts
│   ├── quizStore.ts
│   ├── host.ts
│   ├── play.ts
│   ├── qr.ts
│   ├── types.ts
│   └── styles.css
└── README.md
```

第一版建議使用：

```text
純 HTML + CSS + JavaScript
```

理由：最容易部署到 GitHub Pages，也最符合老師低門檻使用情境。

---

## 22. 開發任務切分

### Task 1：建立專案骨架

- 建立 GitHub Pages 可部署的靜態網站。
- 建立 `index.html`、`host.html`、`play.html`。
- 建立 CSS 與 JS 檔案。
- 確認可直接用瀏覽器開啟與部署。

### Task 2：老師設定頁

- 建立設定表單。
- 支援 Sheet ID、sheet name/gid、Form URL、entry IDs。
- 自動產生 class_id。
- 產生 host.html 連結。
- 產生 play.html 連結。
- 產生 QR Code。
- 支援複製連結。
- 設定保存到 localStorage。

### Task 3：Google Form 寫入模組

- 實作 `submitEvent(config, event)`。
- 使用 `fetch` + `no-cors`。
- 支援所有 event_type。
- 補齊空白欄位。
- 加入基本錯誤處理。

### Task 4：Google Sheet 讀取模組

- 實作 GViz 讀取。
- 支援 sheetName。
- 支援 gid + CSV 作為替代方案。
- 解析 Google Sheet 欄位。
- 轉換為 QuizEvent 陣列。

### Task 5：Quiz Store 狀態還原

- 根據 class_id 過濾資料。
- 找出目前題目。
- 判斷題目狀態。
- 還原學生答案。
- 同一學生同一題只取最早答案。
- 計算選項統計。
- 計算答對率。

### Task 6：老師主持頁

- 題目建立表單。
- A / B / C / D 固定四選項。
- 正確答案 radio。
- 開放作答。
- 關閉作答。
- 公布答案。
- 下一題。
- 重設本題。
- 顯示 QR Code。
- 顯示統計長條圖。

### Task 7：學生作答頁

- 產生或讀取 student_session_id。
- 顯示等待狀態。
- 顯示題目與四個選項。
- 點選後送出 answer_submit。
- 送出後鎖定答案。
- 公布後顯示答對 / 答錯。
- 老師下一題時自動切換。

### Task 8：同步機制

- 每 3 秒讀取 Google Sheet。
- 提供手動重新整理。
- 顯示同步狀態。
- 處理讀取失敗。

### Task 9：README 與教學

README 需包含：

- 專案介紹。
- 如何部署到 GitHub Pages。
- 如何建立 Google Form。
- 如何將 Google Form 回應連到 Google Sheet。
- 如何公開 Google Sheet。
- 如何取得 formResponse URL。
- 如何取得 entry ID。
- 欄位名稱範本。
- 使用限制與安全提醒。

---

## 23. 驗收標準

### 23.1 設定頁

- 可以輸入 Google Sheet / Google Form 設定。
- 可以產生 class_id。
- 可以產生老師主持頁連結。
- 可以產生學生作答頁連結。
- 可以產生 QR Code。
- 可以複製連結。

### 23.2 老師主持頁

- 可以建立單選題。
- 題目固定四個選項 A / B / C / D。
- 可以設定正確答案。
- 可以開放作答。
- 可以關閉作答。
- 可以公布答案。
- 可以看到各選項作答人數。
- 可以看到答對人數、答錯人數、答對率。
- 可以切換下一題。

### 23.3 學生作答頁

- 學生可以掃 QR Code 進入。
- 不需要登入。
- 可以看到老師開放的題目。
- 可以點選 A / B / C / D。
- 作答後不能重複送出。
- 老師公布後可以看到自己答對或答錯。
- 老師進入下一題後，學生頁會自動更新。

### 23.4 資料同步

- 老師建立題目後，Google Sheet 有新增資料列。
- 學生作答後，Google Sheet 有新增資料列。
- 老師端能在數秒內看到統計更新。
- 學生端能在數秒內看到公布答案狀態。

### 23.5 資料模型

- 不同 class_id 的資料不混在一起。
- 同一 student_session_id 同一 question_id 只採用最早答案。
- 公布答案後，正確答案判斷正確。
- 答對率計算正確。

---

## 24. Codex 開發提示詞

可將以下提示詞交給 Codex：

```text
請根據本規格書，開發一個可部署在 GitHub Pages 的上課即時回答系統。

需求重點：
1. 只能使用前端靜態網頁，不建立後端伺服器。
2. 不使用 Apps Script，不使用 Google OAuth。
3. 使用 Google Form 寫入資料，使用公開 Google Sheet 讀取資料。
4. 採用 Event Log 模式，每個老師動作與學生作答都新增一筆資料列。
5. 題型只需要支援單選題，固定四個選項 A / B / C / D。
6. 學生不登入、不記名，進入 play.html 後自動產生 student_session_id 並存在 localStorage。
7. 老師設定頁 index.html 需能輸入 Google Sheet、Google Form 與 entry IDs，產生老師主持頁連結、學生作答連結與 QR Code。
8. 老師主持頁 host.html 需能建立題目、設定四個選項、設定正確答案、開放作答、關閉作答、公布答案、顯示各選項人數與答對率。
9. 學生作答頁 play.html 需能顯示題目與 A/B/C/D 四個大按鈕，送出答案後鎖定，公布答案後顯示答對或答錯。
10. 每 3 秒從 Google Sheet 同步一次資料。
11. 同一 student_session_id 對同一 question_id 若有多筆 answer_submit，只採用最早一筆。
12. 請產生完整可執行專案，包含 README、部署說明、Google Form 欄位設定教學與範例設定。
13. 第一版不要做排行榜與速度計分。
14. UI 需適合老師投影與學生手機操作。
```

---

## 25. 第一版結論

第一版請聚焦在：

```text
GitHub Pages 靜態前端
+ Google Form 匿名寫入
+ Google Sheet 公開讀取
+ Event Log 狀態還原
+ QR Code 分享
+ 固定四選項單選題
+ 老師端統計
+ 學生端答對 / 答錯回饋
```

這樣可以在不架設後端、不使用 Apps Script、不要求登入的限制下，完成一個適合課堂使用的輕量版 Kahoot 類型回答系統。
