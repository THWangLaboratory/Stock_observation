# 股感 Stockroom｜台股觀察室

深色台股自選股、產業漲幅排行與均線方向判讀。已接上 yfinance，內附真實日線快照，沒有模擬行情。

## 作業規格書與協作紀錄

[spec.html](spec.html) 包含創作動機、目標使用者、操作流程、具體功能規格、驗收對照、資料與技術規則、AI 反覆修改紀錄及已知限制；首頁頁尾也有連結。提交前請完成 GitHub Pages 公開部署，並附作品與 repository 的網址，不要只提交截圖。公開部署目前尚未替你執行。

## 個人研究工具

- 點選股票後，在個股面板下方填寫「我的觀察筆記」，最多 4,000 字，輸入時自動儲存在目前瀏覽器。
- 設定收盤價低於或等於／高於或等於的條件，按「儲存價格條件」。可只填一項；同時填寫時，低價須小於高價。
- 「我的價格追蹤」只追蹤自選清單內已設定條件的股票，依載入的收盤資料顯示達成與否。需先將股票加入自選股。移除股票會停止追蹤，筆記與條件仍保留，重新加入後可繼續。
- 行情缺漏、交易日較舊或該檔本輪下載失敗時不判定達成。頁面不會在關閉後推播；交易日仍以畫面為準，不會即時抓價。
- 「匯出備份」可下載 JSON 或複製備份文字，內容只有自選清單、筆記、價格條件，不含行情。
- 「匯入還原」可選擇 JSON 檔案或貼上備份文字。先檢查並顯示摘要，確認取代後才還原。這會取代本機個人資料，建議先匯出目前資料。
- 備份中尚未收錄的股票不加入自選清單，會列出被略過的代碼，但保留其筆記與條件紀錄，供日後擴充名單使用。格式錯誤或過大的備份不接受。
- 從本機搬到 GitHub Pages，或換瀏覽器／裝置時，可先匯出再匯入；個人資料不會同步上傳到 GitHub。

## 直接開啟

解壓縮後雙擊 index.html。index.html、styles.css、app.js、personal-core.js、personal.js、market-data.js 必須放在同一目錄；請一併保留 spec.html、README.md、stocks.json，讓規格書及參考連結可開啟。無須安裝 Python 即可查看隨包附上的行情，交易日與產出時間會顯示在頁面上。

## 更新資料

Windows：安裝 Python 3.12 或以上（包含 Python Launcher），雙擊 update-data.cmd。程式會在此目錄建立獨立 .venv、安裝套件、下載行情。完成後重新開啟 index.html，或按網頁「重新讀取」。

手動執行：

```sh
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS / Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
python update_data.py
```

「重新讀取」只讀取已產生的行情檔，不會啟動 Python 或直接抓 Yahoo。GitHub Pages 是靜態網站，更新由外部 Python 或 GitHub Actions 完成。沒有 API 金鑰、登入或自動交易功能。

## 上傳 GitHub Pages：自動更新版

1. 建立 GitHub repository，分支使用 main。
2. 將此資料夾的內容上傳到 repository 根目錄，包含 .github/workflows/pages.yml、tests/、stocks.json、requirements.txt 和 update_data.py。不要只上傳 zip，也不要再多包一層 tw-stock。
3. .github 可能是隱藏資料夾。若拖曳上傳未包含它，在 GitHub 用 Add file → Create new file 建立 .github/workflows/pages.yml，貼上隨包附的同名檔內容。
4. Settings → Pages → Build and deployment → Source 選 GitHub Actions。
5. Actions → Update stock data and deploy Pages → Run workflow。若上傳時已自動執行並部署成功，可略過手動執行。
6. 使用 Settings → Pages 或部署紀錄顯示的網站網址。

工作流程設定星期一至五台北時間 16:30 執行，也能手動 Run workflow。GitHub 排程可能延遲、停用或需帳戶啟用。休市日也會執行，通常仍取得前一交易日資料。本套件只提供設定，尚未替你上傳或啟用任何 GitHub 排程。

每次會更新資料並部署網站，不會自動提交資料到 main。上一輪成功或部分成功的快照保留於 Actions cache，供失敗時使用；若快取遭清除，回到 repository 隨附快照。畫面會註明失敗狀態和真實交易日期。快取不保證永久保存。

只需手動上傳時，也能上傳 index.html、styles.css、app.js、personal-core.js、personal.js、market-data.js、spec.html、stocks.json、README.md，Pages 設 Deploy from a branch → main → / (root)。此方式不會自動更新；之後在電腦執行更新，再上傳新的 market-data.js 即可。

## 資料與排行定義

- Yahoo Finance 經由 yfinance 提供最近一年日線，可能延遲、限流或缺漏，非交易所即時行情。
- 台北當日 16:00 前排除當日日線，避免把盤中價格標成收盤價；16:00 後仍取決於供應商資料完整性。
- 價格與圖表使用未還原 Close。漲跌幅 = (本筆收盤價 / 前筆有效收盤價 - 1) × 100%。除權息日可能與交易所用調整參考價計算的漲跌幅不同。
- 股數除以 1,000 換算成交量（張），含零股，故顯示小數。
- 目前 37 檔：半導體 13 檔、主機板與電腦周邊各 12 檔，分類是 stocks.json 自訂名單，並非全台股或官方完整產業前十名。主機板組包含工業電腦相關公司。
- 排行僅比較整份快照最新交易日的有效資料。不足十檔就顯示實際數量，不以較舊交易日補足。
- 抓取失敗時保留該股票先前真實資料並註記。不同交易日不混入最新日排行和平均值；從未成功者顯示「—」。
- 不足兩筆收盤價時不計算漲跌幅；從不以模擬數字補值。
- 四個曆日以上沒有新資料會顯示距今天數。這不是正式休市日曆，長假期間也可能提醒。

## 下一交易日方向判讀

使用真實 Yahoo Adj Close（還原收盤價）。最近 5 日均線高於或等於 20 日均線 → 偏多，否則偏空；不足 20 筆或缺還原價時不判讀。

是以畫面交易日為基準，對之後下一交易日作規則判讀，並非已訓練 AI 模型，尚未回測，不宣稱準確率或上漲機率。不構成投資建議。

## 擴充股票

編輯 stocks.json 再執行更新：

```json
{"code":"2330","name":"台積電","sector":"半導體","symbol":"2330.TW"}
```

請使用正確的 Yahoo 代碼與 .TW（上市）、.TWO（上櫃）後綴。現有介面支援半導體、主機板、電腦周邊三種分類。搜尋只涵蓋已收錄股票，並非全台股即時搜尋。新增產業時也需修改介面的產業按鈕。

## 驗證

```sh
python -m unittest discover -s tests -v
node --test tests/personal.test.cjs
```

Python 測試涵蓋漲跌幅與成交量換算、盤中/未來/週末排除、無效值、缺還原價、失敗快取、原子寫入和快照一致性。Node.js 測試涵蓋價格條件邊界、舊行情不誤觸發、備份格式與欄位驗證、重複代碼、未知股票保留及惡意鍵值拒絕。

## 資料使用

yfinance 是第三方工具，不隸屬 Yahoo；官方將其定位於研究與教育，並提醒 Yahoo Finance 資料有個人使用與授權限制。公開散布資料前請確認適用條款：[yfinance 官方說明](https://github.com/ranaroussi/yfinance)。

自選清單僅存在個人瀏覽器；從本機改用 GitHub Pages 時會有獨立清單。Google 字型需網路，無法載入會使用系統字型。
