# ClassPop Firebase 版開發規格摘要

## 目標

將原本「Google Form 寫入 + Google Sheet 輪詢讀取」改為 Firebase Realtime Database 即時同步，並加入教師控制權限與遊戲化倒數回饋。

- 學生：Firebase Anonymous Authentication，不要求註冊帳號。
- 教師：同樣使用匿名 Firebase UID，但需再輸入課程建立時產生的 6 位數教師密鑰。
- 前端：純靜態 HTML/CSS/JavaScript，可部署 GitHub Pages。
- 資料庫：Firebase Realtime Database。
- 課程生命週期：建立後 72 小時。
- 除錯入口：首頁右下角低調的鑰匙圖示，可列出 `classCatalog` 中所有課程 Firebase ID。

## 資料結構

```text
classes/
  {class_id}/
    meta/
      class_id
      created_at
    private/
      teacher_pin
    teacherSessions/
      {firebase_anonymous_uid}/
        pin
        authorized_at
    events/
      {firebase_event_id}/
        event_id
        class_id
        event_type
        question_id
        question_text
        option_a
        option_b
        option_c
        option_d
        correct_answer
        answer
        student_session_id
        client_timestamp
        extra_json
        timer_seconds
        created_at

classCatalog/
  {class_id}/
    class_id
    created_at
```

## 教師登入

1. 首頁建立課程時，以 Web Crypto 產生 6 位數 PIN。
2. PIN 寫入 `classes/{class_id}/private/teacher_pin`。
3. `private` 節點在 Database Rules 中禁止讀取。
4. 主持頁輸入 PIN 後，嘗試寫入 `teacherSessions/{auth.uid}`。
5. Security Rules 比對新 session 的 `pin` 是否等於私有 PIN。
6. 驗證成功後，該 UID 才可寫入教師事件或刪除課程。

教師事件：

- `question_create`
- `question_open`
- `question_close`
- `answer_reveal`
- `question_reset`

學生匿名 UID 不需教師 session，但只允許新增 `answer_submit`。

## 倒數作答

每個事件加入 `timer_seconds`，目前介面提供：10、15、20、30、45、60、90、120 秒。

`question_open` 的 Firebase `created_at`（server timestamp）視為正式開始時間：

```text
remaining = opened_at + timer_seconds * 1000 - Date.now()
```

主持頁與學生頁會使用 Firebase `.info/serverTimeOffset` 校正裝置時鐘，並每 100ms 更新一次視覺進度，但只在整數秒變更時播放節拍音。

互動效果：

- 一般倒數：輕節拍。
- 最後 5 秒：倒數卡片放大脈動。
- 最後 3 秒：紅色急迫閃爍、雙節拍。
- 0 秒：時間到動畫與結束音。
- 主持頁自動寫入 `question_close`。
- 學生端 0 秒後立即停用答案按鈕。
- 答案送出後顯示鎖定動畫。
- 公布答案後顯示答對彈跳或答錯震動動畫。

音效由 Web Audio API 原創合成，不引用第三方遊戲音檔。

## 3 天到期

`database.rules.json` 會在 `created_at + 259200000 ms` 後拒絕課程讀寫。首頁監聽 `classCatalog`，發現過期課程後刪除：

- `classes/{class_id}`
- `classCatalog/{class_id}`

教師在有效期限內登入後，也可手動刪除相同兩個節點。

## Firebase 必要設定

1. Authentication → Sign-in method → 啟用 Anonymous。
2. 建立 Realtime Database。
3. 修改 `js/firebase-config.js` 為實際專案設定。
4. **重新部署新版 Rules**：

```bash
firebase deploy --only database
```

## 除錯清單

首頁右下角 `🔑` 顯示：

- 課程 ID
- Firebase path：`classes/{class_id}`
- 剩餘保存時間

教師 PIN 不顯示在除錯清單中，也不允許透過一般前端讀取。
