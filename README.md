# ClassPop 課堂即時回答系統

![ClassPop 課堂即時回答系統 UI 簡介圖](UI簡介圖.png)

這是一個可部署在 GitHub Pages 的靜態上課回答系統。資料寫入使用 Google Form，資料讀取使用公開 Google Sheet，不需要後端、Apps Script、OAuth 或學生登入。

## 檔案

- `index.html`：老師設定頁，產生主持頁與學生作答頁連結。
- `host.html`：老師主持 / 投影頁，建立題目、控制流程、查看統計。
- `play.html`：學生手機作答頁。
- `demo.html`：localStorage 功能展示入口，可開啟老師、統計與三位學生模擬連結。
- `操作手冊.pdf`：完整圖文操作手冊，說明 Google Form、Google Sheet、共用權限與預填連結設定。

## Google Form 欄位

請建立簡答或段落欄位，欄位名稱如下：

`class_id`, `event_type`, `question_id`, `question_text`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_answer`, `answer`, `student_session_id`, `client_timestamp`, `extra_json`

把 Google Form 回應連結到 Google Sheet，並將 Google Sheet 設為「知道連結的人可以檢視」。

## 使用流程

1. 開啟 GitHub Pages 網頁或本機 `index.html`，先建立一份 Google Form。
2. 在 Google Form 依序建立 13 個非必填欄位，欄位型態使用簡答或段落，欄位名稱需符合「Google Form 欄位」段落。
3. 發布 Google Form，複製作答者連結或表單網址，貼到 `Google Form submit URL`。系統會把 `/viewform` 或 `/edit` 自動轉成 `/formResponse`。
4. 到 Google Form 的「回覆」頁籤建立並連結 Google Sheet。
5. 將 Google Sheet 共用權限設為「知道連結的任何人」且角色為「檢視者」，讓系統可以讀取回應資料。
6. 從 Google Sheet 網址複製 `/d/` 和 `/edit` 之間的 Sheet ID，貼到 `Google Sheet ID`。Sheet 名稱預設為 `表單回應 1`，需要時可改填 Sheet 名稱或 gid。
7. 在 Google Form 選「預先填寫表單」，把 13 個欄位各自填入對應欄位名稱，取得預填連結。
8. 將預填連結貼到 Step 2「從 Google Form 預填連結解析 entry ID」，按「解析 entry ID」自動帶入欄位對應。
9. 按「產生連結」，取得老師主持頁、學生作答頁與作答統計頁。
10. 老師開啟主持頁，學生掃描 QR Code 進入匿名作答頁；下次使用時可清除 Google Sheet 舊資料後重複使用同一組連結。

詳細圖文步驟請參考 [`操作手冊.pdf`](操作手冊.pdf)。

## 限制

- 不記錄學生姓名、學號、Email 或其他個資。
- 公開 Google Sheet 知道連結的人可能讀取資料。
- Google Form submit URL 外流可能被送入資料。
- Google Form 寫入 Google Sheet 可能有數秒延遲。
- 本系統沒有登入與權限控管，不適合正式考試。

## License

MIT
