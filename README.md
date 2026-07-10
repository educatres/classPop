# ClassPop 課堂即時回答系統

這是一個可部署在 GitHub Pages 的靜態上課回答系統。資料寫入使用 Google Form，資料讀取使用公開 Google Sheet，不需要後端、Apps Script、OAuth 或學生登入。

## 檔案

- `index.html`：老師設定頁，產生主持頁與學生作答頁連結。
- `host.html`：老師主持 / 投影頁，建立題目、控制流程、查看統計。
- `play.html`：學生手機作答頁。
- `demo.html`：localStorage 功能展示入口，可開啟老師、統計與三位學生模擬連結。

## Google Form 欄位

請建立簡答或段落欄位，欄位名稱如下：

`class_id`, `event_type`, `question_id`, `question_text`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_answer`, `answer`, `student_session_id`, `client_timestamp`, `extra_json`

把 Google Form 回應連結到 Google Sheet，並將 Google Sheet 設為「知道連結的人可以檢視」。

## 使用流程

1. 開啟 `index.html`。
2. 填入 Google Sheet ID、Sheet 名稱或 gid、Google Form submit URL。
3. 填入每個欄位對應的 Google Form `entry.xxxxx` ID。
4. 產生主持頁與學生作答頁連結。
5. 老師開啟主持頁，學生掃描 QR Code 進入作答頁。

## 限制

- 不記錄學生姓名、學號、Email 或其他個資。
- 公開 Google Sheet 知道連結的人可能讀取資料。
- Google Form submit URL 外流可能被送入資料。
- Google Form 寫入 Google Sheet 可能有數秒延遲。
- 本系統沒有登入與權限控管，不適合正式考試。
