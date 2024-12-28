/************************************************************
 * app.js
 * Node.js + Express を使って
 *  - /api/data で json/choise_rand.json を返す
 *  - /api/answers でユーザーごとの回答ファイル(json/answer/<ユーザー名>.json)をGET/POST
 ************************************************************/
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// (publicディレクトリを静的ファイルとして配信)
app.use(express.static(path.join(__dirname, 'public')));

/**
 * 1) GET /api/data
 *    -> json/choise_rand.json を返す (法令データ)
 */
app.get('/api/data', (req, res) => {
    const dataFilePath = path.join(__dirname, 'json', 'choise_rand.json');

    if (!fs.existsSync(dataFilePath)) {
        return res.status(500).json({error: 'json/choise_rand.json not found.'});
    }
    const dataStr = fs.readFileSync(dataFilePath, 'utf-8');
    const dataJson = JSON.parse(dataStr);
    res.json(dataJson);
});

/**
 * 2) GET /api/answers?userName=xxx
 *    -> json/answer/<ユーザー名>.json を読み込み、回答データを返す
 */
app.get('/api/answers', (req, res) => {
    const userName = req.query.userName;
    if (!userName) {
        return res.status(400).json({error: 'userName is required.'});
    }
    const answerFilePath = path.join(__dirname, 'json', 'answer', `${userName}.json`);

    // ファイルが無ければ空オブジェクトを返す
    if (!fs.existsSync(answerFilePath)) {
        return res.json({});
    }
    // ファイルがあれば読み込み返す
    const answerStr = fs.readFileSync(answerFilePath, 'utf-8');
    const answerJson = JSON.parse(answerStr);
    res.json(answerJson);
});

/**
 * 3) POST /api/answers?userName=xxx
 *    -> リクエストボディの回答データをjson/answer/<ユーザー名>.jsonに上書き保存
 */
app.post('/api/answers', (req, res) => {
    const userName = req.query.userName;
    if (!userName) {
        return res.status(400).json({error: 'userName is required.'});
    }
    const answerDir = path.join(__dirname, 'json', 'answer');
    // answerディレクトリが無い場合は作成 (無い場合に備えて)
    if (!fs.existsSync(answerDir)) {
        fs.mkdirSync(answerDir, {recursive: true});
    }

    const answerFilePath = path.join(answerDir, `${userName}.json`);

    // 現在の回答ファイルを読み込み(無ければ{}で初期化)
    let currentData = {};
    if (fs.existsSync(answerFilePath)) {
        const currentStr = fs.readFileSync(answerFilePath, 'utf-8');
        currentData = JSON.parse(currentStr);
    }

    // リクエストボディ(新データ)をマージ
    const newData = req.body; // { itemKey: {...}, itemKey2: {...}, ... }
    Object.assign(currentData, newData);

    // ファイルに書き込み
    fs.writeFileSync(answerFilePath, JSON.stringify(currentData, null, 2), 'utf-8');
    res.json({success: true});
});

/**
 * サーバー起動
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});

module.exports = app;