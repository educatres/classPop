# ClassPop 課堂即時回答系統 — Firebase 版

ClassPop 是可部署於 GitHub Pages 的課堂即時回答工具。老師建立課程後，可以建立四選一題目、設定作答秒數、開放/關閉作答、公布答案並即時查看全班統計；學生掃 QR Code 後即可匿名作答。

本版本已把原本的 Google Form / Google Sheet 儲存機制改為 **Firebase Realtime Database**，並使用 **Firebase Anonymous Authentication**。

## 主要功能

- Firebase Realtime Database 即時同步。
- Firebase Anonymous Authentication；學生不用註冊帳號。
- 每個課程自動產生 **6 位數教師密鑰**；主持頁需驗證後才可操作教師事件。
- 教師登入後可立即刪除本課程與所有匿名作答資料。
- 老師主持頁、學生作答頁、統計頁與 QR Code。
- 每題可選 10–120 秒作答時間；預設 30 秒。
- 作答倒數、最後 5 秒視覺強化、最後 3 秒加速閃爍、節拍音與時間到提示。
- 主持頁倒數歸零後會自動送出「關閉作答」。
- 學生端可自行開啟/關閉節拍音；因瀏覽器自動播放限制，學生需先按一次「開啟節拍」。
- 答案送出鎖定動畫，以及公布後的答對/答錯回饋動畫與原創 Web Audio 提示音。
- 每個課程建立後有效 3 天；到期後 Firebase Rules 立即拒絕讀寫。
- 首頁會清理偵測到的過期課程。
- 首頁右下角有低調的 `🔑` 除錯入口，可查看目前所有課程的 Firebase ID。

## 教師密鑰與 Firebase 權限

建立課程時，首頁會產生：

- `class_id`
- 6 位數 `teacher_pin`

主持頁網址只包含 `class_id`，**不會把教師密鑰放進 URL**。

Firebase 內部結構：

```text
classes/{class_id}/meta
classes/{class_id}/private/teacher_pin
classes/{class_id}/teacherSessions/{firebase_anonymous_uid}
classes/{class_id}/events/{firebase_event_id}
classCatalog/{class_id}
```

`private/teacher_pin` 不開放讀取。老師在主持頁輸入 PIN 時，前端會嘗試建立自己的 `teacherSessions/{uid}`；Firebase Security Rules 直接比對輸入的 PIN 與私有 PIN。只有驗證成功的匿名 UID 才能寫入：

- `question_create`
- `question_open`
- `question_close`
- `answer_reveal`
- `question_reset`

一般匿名學生仍只能寫入 `answer_submit`。

> 六位數 PIN 適合一般課堂控制，不是高強度身分驗證，不建議拿來保護高風險或正式考試資料。

## Firebase 設定

目前網站連接到 Firebase 專案 `classpop`：

- Web App：`classPop`
- Realtime Database：`classpop-default-rtdb`
- 資料庫區域：`asia-southeast1`
- 驗證方式：Anonymous Authentication

Firebase Web App 的公開設定存放在 `js/firebase-config.js`；真正的資料存取限制由 Anonymous Authentication 與 `database.rules.json` 控制。

### 1. 啟用匿名登入

Firebase Console → Authentication → Sign-in method → Anonymous → Enable。

### 2. 建立 Realtime Database

建立 Realtime Database，並確認 database URL 與 `js/firebase-config.js` 一致。

### 3. 重新部署資料庫規則

這一版新增教師 session 權限，因此 **一定要重新部署 `database.rules.json`**：

```bash
firebase deploy --only database
```

若只更新 GitHub Pages 而沒有更新 Database Rules，教師密鑰登入會失敗。

## 3 天保存機制

Realtime Database 沒有原生文件 TTL。本專案採用：

1. 資料庫規則在課程建立 72 小時後立即拒絕讀寫。
2. 首頁讀取 `classCatalog` 時，自動刪除過期課程。
3. 開啟過期網址時，也會嘗試執行過期清理。
4. 教師驗證後可在 3 天內隨時手動刪除自己的課程。

若 3 天後完全沒有人再開網站，資料實體可能暫時留在 RTDB，直到下一次網站被開啟才刪除。若需要沒有訪客也能由伺服器主動刪除，需加 Scheduled Cloud Function 或改採具 TTL policy 的 Cloud Firestore。

## 倒數與音效

倒數開始時間使用 `question_open` 事件的 Firebase `serverTimestamp()`，學生與主持頁依同一個伺服器時間點計算剩餘秒數，並使用 Firebase `.info/serverTimeOffset` 校正裝置時鐘差異。

音效使用瀏覽器 Web Audio API 即時合成，不使用 Kahoot 或其他服務的音效檔。設計僅參考課堂遊戲常見的「節拍逐漸緊張」互動節奏。

## GitHub Pages

網站仍是純靜態 HTML / CSS / JavaScript，由 GitHub Pages 發布：

https://educatres.github.io/classPop/

Firebase SDK 由 CDN 載入。

## 安全提醒

本工具定位為課堂即時互動，不適合正式考試。學生匿名 ID 僅用來避免同一瀏覽器重複計入同一題；不要要求學生輸入姓名、學號、Email 或其他個資。

右下角 Firebase ID 清單仍是除錯用途，依需求讓匿名使用者可讀 `classCatalog`；正式環境若不希望一般使用者看到所有課程 ID，應再加管理者驗證或移除此入口。

## License

MIT
