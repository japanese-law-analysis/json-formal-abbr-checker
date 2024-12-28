# json-formal-abbr-checker

本プロジェクトは、**法令テキストの略称定義が正しく抽出・表記されているかをブラウザ上でチェック**するためのツールです。  
ユーザーが OK / NG ボタンで確認し、必要に応じて修正を入力すると、その結果がサーバー側の JSON ファイルに保存されます。  
複数回出現する正式名称・略称もすべて色分けハイライトして表示し、不足分は `【未ヒット】` として可視化されます。

## 特徴

- **JSONファイル**(`json/choise_rand.json`)に含まれる法令テキストをサーバーから読み込み、ブラウザ上に一覧表示
- **OK / NG ボタン**で略称が正しいかをチェック
    - 押したボタン → **濃い灰色**
    - 押されなかったボタン → **薄い灰色**
- **NG の場合**、修正欄から正式名称・略称を再入力し保存可能
- **「未チェック」「チェック済み」「全て」** をワンクリックで切り替え表示
- **トースト風通知**により、OKや修正の保存を画面右下に数秒間表示
- **ユーザーごとの回答**は `json/answer/<ユーザー名>.json` に保存され、再読み込みすると続きから確認できる

## 動作環境

- Node.js (推奨バージョン: 14 以上)
- npm または yarn などのパッケージマネージャ

## セットアップ

1. リポジトリをクローンまたはダウンロードします。

   ````bash
   git clone https://github.com/your-username/json-formal-abbr-checker.git
   cd json-formal-abbr-checker
   ````

2. 必要な依存ライブラリをインストールします。

   ````bash
   npm install
   ````
   または
   ````bash
   yarn
   ````

3. `node app.js` を実行し、アプリを起動します。

   ````bash
   node app.js
   ````
   デフォルトでは **ポート3000** を使用します。

4. ブラウザで [http://localhost:3000/](http://localhost:3000/) にアクセスして動作を確認してください。

## 使い方

1. ブラウザで表示された画面の **ユーザー名** 欄に任意の名前を入力し、「読み込み」ボタンを押します。
2. サーバーから法令テキストがロードされ、一覧で表示されます。
3. **OK / NG** ボタンでチェックを行い、必要に応じて修正を入力してください。入力内容はサーバーにリアルタイムで保存されます。
4. 上部のボタンで「未チェック」「チェック済み」「全て」の表示を切り替え可能です。
5. 再度同じユーザー名を読み込むと、前回のチェック結果がそのまま反映されます。

## ディレクトリ構成

```
json-formal-abbr-checker/
├─ app.js                   // Node.js + Expressサーバー
├─ package.json
├─ public/                  // フロントエンド
│   ├─ index.html
│   ├─ stylesheets/
│   │   └─ style.css
│   └─ javascripts/
│       └─ main.js
└─ json/
    ├─ choise_rand.json     // サンプル法令データ
    └─ answer/              // ユーザー毎の回答をJSONファイルに保存
        └─ (ユーザーごとの .json が生成)
```

## カスタマイズ

- **JSON データ**を更新したい場合
    - `json/choise_rand.json` に法令テキストなどを含む JSON を上書きします。
- **ポート番号**を変えたい場合
    - `app.js` 内の `process.env.PORT || 3000` の部分を変更、または以下のように起動します:
      ````bash
      PORT=8080 node app.js
      ````

---

- (c) Daiki Nishiyama / 西山 大輝
- GitHub: [Daiki Nishiyama](https://github.com/pfunami)
-  [MIT License](./LICENSE)