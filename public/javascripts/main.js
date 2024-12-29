/************************************************************
 * main.js (フロントエンド)
 * - サーバーから /api/data (json/choise_rand.json) を取得
 * - ユーザー名を指定して /api/answers をGET/POSTして回答を読み書き
 * - 未チェック / チェック済み / 全て 表示切り替え
 * - 各項目に「メモ欄」を追加し、その内容もJSONに保存
 *   (古いバージョンのJSONで memoキーが無い場合は新たに追加)
 ************************************************************/

let originalData = [];          // /api/data の生データ(choise_rand.json)
let currentUserAnswers = {};    // /api/answers?userName=xxx で取得した回答
let currentUserName = "";       // 現在表示中のユーザー名

/**
 * /api/data (json/choise_rand.json) をサーバーから取得
 */
async function fetchOriginalData() {
    try {
        const res = await fetch('/api/data');
        if (!res.ok) {
            // throw new Error('Failed to fetch /api/data');
            console.error('Failed to fetch /api/data');
        }
        return await res.json();
    } catch (err) {
        console.error(err);
        return [];
    }
}

/**
 * /api/answers?userName=xxx を取得 (チェック結果読み込み)
 */
async function fetchUserAnswers(userName) {
    try {
        const res = await fetch(`/api/answers?userName=${encodeURIComponent(userName)}`);
        if (!res.ok) {
            // throw new Error('Failed to fetch /api/answers');
            console.error('Failed to fetch /api/answers');
        }
        const answers = await res.json();

        // 古いバージョンの JSON では memo キーが存在しない場合があるため、
        // ここで必要なら全 itemKey について memo キーを付与しておく。
        // (※ ただし動的に項目数が多いときは createListItemElement 内で都度補完でもOK)
        for (const key of Object.keys(answers)) {
            // judgement, correctFormal, correctAbbr, timestamp等は存在するが
            // memo キーが無い場合、空文字で初期化
            if (!('memo' in answers[key])) {
                answers[key].memo = '';
            }
        }
        return answers;
    } catch (err) {
        console.error(err);
        return {};
    }
}

/**
 * /api/answers?userName=xxx に回答をPOSTしてサーバー側を上書き
 * param answersObj = {
 *   "file_listIndex": { judgement: "OK" or "NG", correctFormal: ..., correctAbbr: ..., memo: ..., timestamp: ... },
 *   ...
 * }
 */
async function postUserAnswers(userName, answersObj) {
    try {
        const res = await fetch(`/api/answers?userName=${encodeURIComponent(userName)}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(answersObj)
        });
        if (!res.ok) {
            // throw new Error('Failed to POST /api/answers');
            console.error('Failed to POST /api/answers');
        }
        return await res.json();
    } catch (err) {
        console.error(err);
        return {success: false};
    }
}

/**
 * originalData から "list" を1つの配列に統合しやすい形で抜き出す
 * return:
 * [
 *   {
 *     file: "...",
 *     text: "...",
 *     formal: "...",
 *     abbr: "...",
 *     listIndex: 0,
 *     lawName: "..."
 *   },
 *   ...
 * ]
 */
function gatherAllListItems(data) {
    const result = [];
    data.forEach((item) => {
        if (Array.isArray(item.list) && item.list.length > 0) {
            item.list.forEach((listObj, idx) => {
                result.push({
                    file: item.file,
                    text: item.text,
                    formal: listObj.formal,
                    abbr: listObj.abbr,
                    listIndex: idx,
                    lawName: item.article_index?.law_name || ''
                });
            });
        }
    });
    return result;
}

/**
 * 指定した substring が出現する箇所を全てハイライトするヘルパー関数。
 * @param {string} text - 変更対象のテキスト
 * @param {string} needle - 検索文字列
 * @param {string} startTag - ハイライト開始タグ (例: '<span class="abbr-found">')
 * @param {string} endTag - ハイライト終了タグ (例: '</span>')
 * @returns {object} { text: string, found: boolean }
 *   - text: ハイライト済み文字列
 *   - found: 1回以上見つかった場合は true、見つからなかった場合は false
 */
function highlightAllOccurrences(text, needle, startTag, endTag) {
    let result = '';
    let fromIndex = 0;
    let foundAny = false;

    while (true) {
        const foundIndex = text.indexOf(needle, fromIndex);
        if (foundIndex === -1) {
            // 見つからなかった → 残りをまとめて result に入れてループ終了
            result += text.slice(fromIndex);
            break;
        }
        // needle が見つかった箇所までをコピー
        result += text.slice(fromIndex, foundIndex);
        // needle 部分をハイライト
        result += startTag + needle + endTag;
        foundAny = true;
        // 次の検索開始位置を更新
        fromIndex = foundIndex + needle.length;
    }

    return {text: result, found: foundAny};
}

/**
 * 文字列ハイライト処理：
 *   formal/abbr が文中に複数回存在すればすべて色付けし、
 *   一度も存在しなければ末尾に【未ヒット: ...】を表示する
 */
function highlightText(baseText, formal, abbr) {
    let highlighted = baseText;

    // 1) 正式名称の全 occurrences をハイライト
    const formalResult = highlightAllOccurrences(
        highlighted,
        formal,
        '<span class="formal-found">',
        '</span>'
    );
    highlighted = formalResult.text;
    if (!formalResult.found) {
        highlighted += `<br/><span class="formal-missing">【未ヒット：${formal}】</span>`;
    }

    // 2) 略称の全 occurrences をハイライト
    const abbrResult = highlightAllOccurrences(
        highlighted,
        abbr,
        '<span class="abbr-found">',
        '</span>'
    );
    highlighted = abbrResult.text;
    if (!abbrResult.found) {
        highlighted += `<br/><span class="abbr-missing">【未ヒット：${abbr}】</span>`;
    }

    return highlighted;
}

/**
 * 「トースト風」通知を表示するヘルパー関数
 * @param {string} message - 表示するメッセージ(改行は \n で指定可能)
 * @param {number} duration - 表示時間ミリ秒 (デフォルト3秒)
 */
function showToast(message, duration = 3000) {
    // 1. トースト用のコンテナ要素が無ければ作る
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = 9999;
        document.body.appendChild(toastContainer);
    }

    // 2. トースト要素を作って追加
    const toast = document.createElement('div');
    // \n を <br> に置き換えて innerHTML に設定する
    toast.innerHTML = message.replace(/\n/g, '<br/>');

    toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    toast.style.color = 'white';
    toast.style.padding = '8px 16px';
    toast.style.marginTop = '8px';
    toast.style.borderRadius = '4px';
    toast.style.fontSize = '14px';
    toast.style.transition = 'opacity 0.3s';

    toastContainer.appendChild(toast);

    // 3. 一定時間経過後に削除
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300); // フェードアウト完了後に削除
    }, duration);
}

/**
 * 1件のリスト項目を HTML要素化する
 */
function createListItemElement(itemData) {
    const container = document.createElement('div');
    container.className = 'item-container';

    // 上部情報
    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `
    <div><strong>ファイル名:</strong> ${itemData.file}</div>
    <div style="margin-top:4px; color:#666;">
      <strong>条文タイトル:</strong> ${itemData.lawName}
    </div>
  `;
    container.appendChild(infoDiv);

    // 本文(ハイライト表示)
    const textDiv = document.createElement('div');
    textDiv.className = 'text-area';
    const textHighlighted = highlightText(itemData.text, itemData.formal, itemData.abbr);
    textDiv.innerHTML = `
    <div>
      <strong>正式名称:</strong> ${itemData.formal}
    </div>
    <div>
      <strong>略称:</strong> ${itemData.abbr}
    </div>
    <div style="margin-top:4px;">
      <strong>本文(ハイライト済み):</strong><br/>
      ${textHighlighted}
    </div>
  `;
    container.appendChild(textDiv);

    // ボタン
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    // OKボタン (緑)
    const okButton = document.createElement('button');
    okButton.className = 'check-button';  // もともと CSS で緑色 (例: #4CAF50)
    okButton.textContent = 'OK';

    // NGボタン (赤)
    const ngButton = document.createElement('button');
    ngButton.className = 'check-button check-button-ng'; // もともと CSS で赤色 (例: #f44336)
    ngButton.textContent = 'NG';

    buttonContainer.appendChild(okButton);
    buttonContainer.appendChild(ngButton);
    container.appendChild(buttonContainer);

    // NG修正フィールド
    const correctionDiv = document.createElement('div');
    correctionDiv.className = 'correction-field hidden';
    correctionDiv.innerHTML = `
    <div>
      <label>正式名称</label>
      <input type="text" class="correct-formal" placeholder="修正後の正式名称" />
    </div>
    <div>
      <label>略称</label>
      <input type="text" class="correct-abbr" placeholder="修正後の略称" />
    </div>
  `;
    container.appendChild(correctionDiv);

    // ----- 備考メモ欄を追加 -----
    const memoDiv = document.createElement('div');
    memoDiv.className = 'memo-field';
    memoDiv.style.marginTop = '6px';
    memoDiv.innerHTML = `
    <label style="display:block; margin-bottom:2px; font-weight:bold;">備考メモ:</label>
    <textarea class="memo-input" rows="2" style="width:98%;"></textarea>
  `;
    container.appendChild(memoDiv);
    const memoInput = memoDiv.querySelector('.memo-input');

    // 既存回答があれば反映 (古いJSONには 'memo' キーが無い可能性あるので空文字で対処)
    const itemKey = `${itemData.file}_${itemData.listIndex}`;
    const existing = currentUserAnswers[itemKey];
    if (existing) {
        // judgement
        if (existing.judgement === 'OK') {
            // OK: OKボタンを濃灰, NGを薄灰
            okButton.style.backgroundColor = '#555';
            ngButton.style.backgroundColor = '#ccc';
        } else if (existing.judgement === 'NG') {
            // NG: NGボタンを濃灰, OKを薄灰
            ngButton.style.backgroundColor = '#555';
            okButton.style.backgroundColor = '#ccc';

            correctionDiv.classList.remove('hidden');
            correctionDiv.querySelector('.correct-formal').value = existing.correctFormal || '';
            correctionDiv.querySelector('.correct-abbr').value = existing.correctAbbr || '';
        }
        // memo (無い場合は空文字)
        if (!('memo' in existing)) {
            existing.memo = ''; // 古いJSONならここで空文字をセット
        }
        memoInput.value = existing.memo;
    }

    // --------- OKボタン押下 ---------
    okButton.addEventListener('click', async () => {
        const timestamp = new Date().toISOString();

        // サーバーへPOST(OKデータ)
        // memo は既に currentUserAnswers にある値をそのまま詰める
        const baseData = currentUserAnswers[itemKey] || {};
        // judgementやcorrectFormalなどを上書き
        baseData.judgement = 'OK';
        baseData.correctFormal = '';
        baseData.correctAbbr = '';
        baseData.timestamp = timestamp;
        // memo は baseData.memo があれば維持、無ければ空文字

        const newData = {
            [itemKey]: baseData
        };
        const result = await postUserAnswers(currentUserName, newData);
        if (result.success) {
            // ボタン色の変更
            okButton.style.backgroundColor = '#555';  // pressed: 濃灰
            ngButton.style.backgroundColor = '#ccc';  // not pressed: 薄灰
            correctionDiv.classList.add('hidden');

            // ローカルの状態更新
            currentUserAnswers[itemKey] = newData[itemKey];

            //トーストメッセージには，条文タイトルも表示
            showToast(`OKを保存しました: \n${itemData.lawName}`, 3000);
        }
    });

    // --------- NGボタン押下 ---------
    ngButton.addEventListener('click', () => {
        // ボタン色の変更 (NGを濃灰, OKを薄灰)
        ngButton.style.backgroundColor = '#555';
        okButton.style.backgroundColor = '#ccc';

        // 修正フォームを表示
        correctionDiv.classList.remove('hidden');
    });

    // --------- 修正フィールド変更 → サーバー保存 ---------
    const formalInput = correctionDiv.querySelector('.correct-formal');
    const abbrInput = correctionDiv.querySelector('.correct-abbr');
    [formalInput, abbrInput].forEach(el => {
        el.addEventListener('change', async () => {
            const timestamp = new Date().toISOString();
            // 既存データを取得し、NGとして上書き
            const baseData = currentUserAnswers[itemKey] || {};
            baseData.judgement = 'NG';
            baseData.correctFormal = formalInput.value;
            baseData.correctAbbr = abbrInput.value;
            baseData.timestamp = timestamp;
            // memo も維持
            if (!('memo' in baseData)) {
                baseData.memo = '';
            }

            const newData = {
                [itemKey]: baseData
            };
            const result = await postUserAnswers(currentUserName, newData);
            if (result.success) {
                // ローカル側の状態更新
                currentUserAnswers[itemKey] = newData[itemKey];

                // 右下に「修正がサーバーに保存されました」通知
                showToast(
                    `修正を保存しました: ${itemData.lawName}\n正式名称: ${formalInput.value}\n略称: ${abbrInput.value}`,
                    3000
                );
            }
        });
    });

    // --------- メモ欄の更新 → サーバー保存 ---------
    memoInput.addEventListener('change', async () => {
        const baseData = currentUserAnswers[itemKey] || {};
        // まだ存在しない場合は空オブジェクトから始める
        if (!('memo' in baseData)) {
            baseData.memo = '';
        }
        baseData.memo = memoInput.value;
        // judgement 等は既存の状態を保持したまま
        // timestamp も更新しておく
        baseData.timestamp = new Date().toISOString();

        const newData = {
            [itemKey]: baseData
        };
        const result = await postUserAnswers(currentUserName, newData);
        if (result.success) {
            currentUserAnswers[itemKey] = newData[itemKey];
            // メモ保存のトースト表示
            showToast('メモを保存しました', 2000);
        }
    });

    return container;
}

/**
 * 指定したフィルタ(未チェック/チェック済み/全て)で表示
 * filterType = "unchecked" | "checked" | "all"
 */
function renderAllItems(filterType) {
    const container = document.getElementById('itemsContainer');
    container.innerHTML = '';

    // 全 listItem をまとめる
    const allListItems = gatherAllListItems(originalData);

    // フィルタリング
    const filtered = allListItems.filter(item => {
        const key = `${item.file}_${item.listIndex}`;
        const ans = currentUserAnswers[key];
        if (filterType === 'all') {
            return true;
        } else if (filterType === 'unchecked') {
            // judgement 未定義 → 未チェック
            return !ans || !ans.judgement;
        } else if (filterType === 'checked') {
            // judgement==='OK' or 'NG'
            return ans && (ans.judgement === 'OK' || ans.judgement === 'NG');
        }
    });

    // DOM 生成
    filtered.forEach((item) => {
        const el = createListItemElement(item);
        container.appendChild(el);
    });

    // 件数表示
    const filterCount = document.getElementById('filterCount');
    let label = '';
    if (filterType === 'all') {
        label = '全件';
    } else if (filterType === 'unchecked') {
        label = '未チェック';
    } else if (filterType === 'checked') {
        label = 'チェック済み';
    }
    filterCount.textContent = `${label}：${filtered.length} 件`;
}

// ------------------- イベントリスナ -------------------
window.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username');
    const loadBtn = document.getElementById('loadUserData');
    const btnShowUnchecked = document.getElementById('btnShowUnchecked');
    const btnShowChecked = document.getElementById('btnShowChecked');
    const btnShowAll = document.getElementById('btnShowAll');

    // まずサーバーから choise_rand.json を取得しておく
    fetchOriginalData().then(data => {
        originalData = data; // グローバル変数に保持
    });

    // 「読み込み」ボタン
    loadBtn.addEventListener('click', async () => {
        const userName = usernameInput.value.trim();
        if (!userName) {
            alert('ユーザー名を入力してください');
            return;
        }
        currentUserName = userName;

        // サーバーから回答をGET (古いバージョンならここでmemoキーを補完)
        currentUserAnswers = await fetchUserAnswers(userName);

        // 最初は「全て」表示
        renderAllItems('all');
    });

    // 未チェックを表示
    btnShowUnchecked.addEventListener('click', () => {
        if (!currentUserName) {
            alert('先にユーザー名を入力して読み込んでください。');
            return;
        }
        renderAllItems('unchecked');
    });

    // チェック済みを表示
    btnShowChecked.addEventListener('click', () => {
        if (!currentUserName) {
            alert('先にユーザー名を入力して読み込んでください。');
            return;
        }
        renderAllItems('checked');
    });

    // 全てを表示
    btnShowAll.addEventListener('click', () => {
        if (!currentUserName) {
            alert('先にユーザー名を入力して読み込んでください。');
            return;
        }
        renderAllItems('all');
    });
});