/************************************************************
 * main.js (フロントエンド)
 * - サーバーから /api/data (json/choise_rand.json) を取得
 * - ユーザー名を指定して /api/answers をGET/POSTして回答を読み書き
 * - 未チェック / チェック済み / 全て / NG / 備考付き 表示切り替え
 * - 各項目に「メモ欄」を追加し、その内容もJSONに保存
 *   (古いバージョンのJSONで memoキーが無い場合は新たに追加)
 ************************************************************/
/************************************************************
 * main.js (フロントエンド) - アップデート版
 * - 新しいキー形式 "{file}_{i}" (i は choise_rand.json のトップレベル配列インデックス)
 * - 旧キー "{file}_{listIndex}" で保存されたデータとの整合を取る(マイグレーション)
 *   ただし最初に見つかった旧キーのみコピーし、それ以降の同キー上書きはしない
 * - 未チェック / チェック済み / 全て / NG / 備考付き 表示切り替え
 * - 各項目に「メモ欄」を追加し、その内容もJSONに保存
 ************************************************************/

let originalData = [];          // /api/data の生データ(choise_rand.json)
let currentUserAnswers = {};    // /api/answers?userName=xxx で取得した回答 (旧キー→新キーへ変換後)
let currentUserName = "";       // 現在表示中のユーザー名

/**
 * /api/data (json/choise_rand.json) をサーバーから取得
 */
async function fetchOriginalData() {
    try {
        const res = await fetch('/api/data');
        if (!res.ok) {
            console.error('Failed to fetch /api/data');
            return [];
        }
        return await res.json();
    } catch (err) {
        console.error(err);
        return [];
    }
}

/**
 * /api/answers?userName=xxx を取得 (チェック結果読み込み)
 * 古いキー "{file}_{listIndex}" を 新しいキー "{file}_{topIndex}" へマイグレーション
 */
async function fetchUserAnswers(userName) {
    try {
        const res = await fetch(`/api/answers?userName=${encodeURIComponent(userName)}`);
        if (!res.ok) {
            console.error('Failed to fetch /api/answers');
            return {};
        }
        const Answers = await res.json();

        // 旧キーを新キーへ変換
        return Answers;
    } catch (err) {
        console.error(err);
        return {};
    }
}

/**
 * /api/answers?userName=xxx に回答をPOSTしてサーバー側を上書き
 * param answersObj = {
 *   "file_i": { judgement: "OK" or "NG", correctFormal: ..., correctAbbr: ..., memo: ..., timestamp: ... },
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
            console.error('Failed to POST /api/answers');
            return {success: false};
        }
        return await res.json();
    } catch (err) {
        console.error(err);
        return {success: false};
    }
}


/**
 * originalData から "list" をまとめる際、
 *  - トップレベルのインデックス i を保持 (topIndex)
 *  - ここでは list の先頭要素のみを参照 (必要に応じて拡張)
 * return:
 * [
 *   {
 *     file: "xxxx",
 *     text: "...",
 *     formal: "...",
 *     abbr: "...",
 *     lawName: "...",
 *     topIndex: i
 *   },
 *   ...
 * ]
 */
function gatherAllListItems(data) {
    const result = [];
    data.forEach((item, i) => {
        const firstList = (item.list && item.list[0]) ? item.list[0] : null;
        result.push({
            file: item.file,
            text: item.text,
            formal: firstList ? firstList.formal : '',
            abbr: firstList ? firstList.abbr : '',
            lawName: item.article_index?.law_name || '',
            topIndex: i // 新キーで使う
        });
    });
    return result;
}

/**
 * 指定した substring が出現する箇所を全てハイライトするヘルパー関数。
 */
function highlightAllOccurrences(text, needle, startTag, endTag) {
    let result = '';
    let fromIndex = 0;
    let foundAny = false;

    while (true) {
        const foundIndex = text.indexOf(needle, fromIndex);
        if (foundIndex === -1) {
            result += text.slice(fromIndex);
            break;
        }
        result += text.slice(fromIndex, foundIndex);
        result += startTag + needle + endTag;
        foundAny = true;
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

    // 正式名称
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

    // 略称
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
 */
function showToast(message, duration = 3000) {
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

    const toast = document.createElement('div');
    toast.innerHTML = message.replace(/\n/g, '<br/>');

    toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    toast.style.color = 'white';
    toast.style.padding = '8px 16px';
    toast.style.marginTop = '8px';
    toast.style.borderRadius = '4px';
    toast.style.fontSize = '14px';
    toast.style.transition = 'opacity 0.3s';

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

/**
 * 1件のリスト項目を HTML要素化する (新キー形式)
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

    const okButton = document.createElement('button');
    okButton.className = 'check-button';  // CSS で緑色
    okButton.textContent = 'OK';

    const ngButton = document.createElement('button');
    ngButton.className = 'check-button check-button-ng'; // CSS で赤色
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

    // 備考メモ欄
    const memoDiv = document.createElement('div');
    memoDiv.className = 'memo-field';
    memoDiv.style.marginTop = '6px';
    memoDiv.innerHTML = `
    <label style="display:block; margin-bottom:2px; font-weight:bold;">備考メモ:</label>
    <textarea class="memo-input" rows="2" style="width:98%;"></textarea>
  `;
    container.appendChild(memoDiv);

    const memoInput = memoDiv.querySelector('.memo-input');

    // 新しいキー "{file}_{topIndex}" で回答を参照
    const itemKey = `${itemData.file}_${itemData.topIndex}`;
    const existing = currentUserAnswers[itemKey];
    if (existing) {
        // judgement
        if (existing.judgement === 'OK') {
            okButton.style.backgroundColor = '#555';
            ngButton.style.backgroundColor = '#ccc';
        } else if (existing.judgement === 'NG') {
            ngButton.style.backgroundColor = '#555';
            okButton.style.backgroundColor = '#ccc';

            correctionDiv.classList.remove('hidden');
            correctionDiv.querySelector('.correct-formal').value = existing.correctFormal || '';
            correctionDiv.querySelector('.correct-abbr').value = existing.correctAbbr || '';
        }
        // memo
        memoInput.value = existing.memo || '';
    }

    // ----------------- OKボタン押下 -----------------
    okButton.addEventListener('click', async () => {
        const timestamp = new Date().toISOString();
        // 既存の回答を取得 or 初期化
        const baseData = currentUserAnswers[itemKey] || {};
        baseData.judgement = 'OK';
        baseData.correctFormal = '';
        baseData.correctAbbr = '';
        baseData.timestamp = timestamp;
        if (!('memo' in baseData)) {
            baseData.memo = '';
        }

        const newData = {[itemKey]: baseData};
        const result = await postUserAnswers(currentUserName, newData);
        if (result.success) {
            // ボタン色
            okButton.style.backgroundColor = '#555';
            ngButton.style.backgroundColor = '#ccc';
            correctionDiv.classList.add('hidden');

            // ローカル更新
            currentUserAnswers[itemKey] = newData[itemKey];

            // トースト
            showToast(`OKを保存しました: \n${itemData.lawName}`, 3000);
        }
    });

    // ----------------- NGボタン押下 -----------------
    ngButton.addEventListener('click', () => {
        ngButton.style.backgroundColor = '#555';
        okButton.style.backgroundColor = '#ccc';

        correctionDiv.classList.remove('hidden');
    });

    // ----------------- 修正フィールド change -----------------
    const formalInput = correctionDiv.querySelector('.correct-formal');
    const abbrInput = correctionDiv.querySelector('.correct-abbr');
    [formalInput, abbrInput].forEach(el => {
        el.addEventListener('change', async () => {
            const timestamp = new Date().toISOString();
            const baseData = currentUserAnswers[itemKey] || {};
            baseData.judgement = 'NG';
            baseData.correctFormal = formalInput.value;
            baseData.correctAbbr = abbrInput.value;
            baseData.timestamp = timestamp;
            if (!('memo' in baseData)) {
                baseData.memo = '';
            }

            const newData = {[itemKey]: baseData};
            const result = await postUserAnswers(currentUserName, newData);
            if (result.success) {
                currentUserAnswers[itemKey] = newData[itemKey];
                showToast(
                    `修正を保存しました: ${itemData.lawName}\n正式名称: ${formalInput.value}\n略称: ${abbrInput.value}`,
                    3000
                );
            }
        });
    });

    // ----------------- メモ欄 change -----------------
    memoInput.addEventListener('change', async () => {
        const baseData = currentUserAnswers[itemKey] || {};
        if (!('memo' in baseData)) {
            baseData.memo = '';
        }
        baseData.memo = memoInput.value;
        baseData.timestamp = new Date().toISOString();

        const newData = {[itemKey]: baseData};
        const result = await postUserAnswers(currentUserName, newData);
        if (result.success) {
            currentUserAnswers[itemKey] = newData[itemKey];
            showToast('メモを保存しました', 2000);
        }
    });

    return container;
}

/**
 * 指定したフィルタで表示
 * filterType = "unchecked" | "checked" | "all" | "ng" | "memo"
 */
function renderAllItems(filterType) {
    const container = document.getElementById('itemsContainer');
    container.innerHTML = '';

    // 新しく gatherAllListItems で topIndex を取得
    const allListItems = gatherAllListItems(originalData);

    // フィルタ
    const filtered = allListItems.filter(item => {
        const key = `${item.file}_${item.topIndex}`;
        const ans = currentUserAnswers[key];

        if (filterType === 'all') {
            return true;
        } else if (filterType === 'unchecked') {
            return !ans || !ans.judgement;
        } else if (filterType === 'checked') {
            return ans && (ans.judgement === 'OK' || ans.judgement === 'NG');
        } else if (filterType === 'ng') {
            return ans && ans.judgement === 'NG';
        } else if (filterType === 'memo') {
            return ans && ans.memo && ans.memo.trim() !== '';
        }
        return false;
    });

    // DOM
    filtered.forEach(item => {
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
    } else if (filterType === 'ng') {
        label = 'NG';
    } else if (filterType === 'memo') {
        label = '備考付き';
    }
    filterCount.textContent = `${label}：${filtered.length} 件`;
}

// イベントリスナ
window.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username');
    const loadBtn = document.getElementById('loadUserData');
    const btnShowUnchecked = document.getElementById('btnShowUnchecked');
    const btnShowChecked = document.getElementById('btnShowChecked');
    const btnShowAll = document.getElementById('btnShowAll');
    const btnShowNg = document.getElementById('btnShowNg');
    const btnShowMemo = document.getElementById('btnShowMemo');

    // 1) 最初に choise_rand.json を取得
    fetchOriginalData().then(data => {
        originalData = data;
    });

    // 2) 「読み込み」ボタン押下
    loadBtn.addEventListener('click', async () => {
        const userName = usernameInput.value.trim();
        if (!userName) {
            alert('ユーザー名を入力してください');
            return;
        }
        currentUserName = userName;

        // サーバーから回答をGET (旧→新キーへマイグレ済み)
        currentUserAnswers = await fetchUserAnswers(userName);

        // デフォルトは「全て」
        renderAllItems('all');
    });

    // 未チェック
    btnShowUnchecked.addEventListener('click', () => {
        if (!currentUserName) {
            alert('先にユーザー名を入力して読み込んでください。');
            return;
        }
        renderAllItems('unchecked');
    });

    // チェック済み
    btnShowChecked.addEventListener('click', () => {
        if (!currentUserName) {
            alert('先にユーザー名を入力して読み込んでください。');
            return;
        }
        renderAllItems('checked');
    });

    // 全て
    btnShowAll.addEventListener('click', () => {
        if (!currentUserName) {
            alert('先にユーザー名を入力して読み込んでください。');
            return;
        }
        renderAllItems('all');
    });

    // NGを表示
    btnShowNg.addEventListener('click', () => {
        if (!currentUserName) {
            alert('先にユーザー名を入力して読み込んでください。');
            return;
        }
        renderAllItems('ng');
    });

    // 備考付きを表示
    btnShowMemo.addEventListener('click', () => {
        if (!currentUserName) {
            alert('先にユーザー名を入力して読み込んでください。');
            return;
        }
        renderAllItems('memo');
    });
});