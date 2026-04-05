(function () {
    "use strict";

    const STORAGE_KEY = "quantum_diary_entries_v1";
    const EMOTION_LABELS = {
        confidence: "自信",
        curiosity: "好奇心",
        calm: "冷静",
    };
    const EMOTION_COLORS = {
        confidence: "#4A90D9",
        curiosity: "#50C878",
        calm: "#FF8C42",
    };
    const AXES = ["confidence", "curiosity", "calm"];

    const form = document.getElementById("diary-form");
    const dateInput = document.getElementById("entry-date");
    const textarea = document.getElementById("entry-text");
    const charCount = document.getElementById("char-count");
    const submitBtn = document.getElementById("submit-btn");
    const statusCard = document.getElementById("status");
    const statusText = document.getElementById("status-text");
    const resultCard = document.getElementById("result");
    const resultDate = document.getElementById("result-date");
    const saveBtn = document.getElementById("save-btn");
    const aiDiaryEl = document.getElementById("ai-diary");
    const barsEl = document.getElementById("emotion-bars");
    const debugEl = document.getElementById("debug-json");
    const historyList = document.getElementById("history-list");
    const exportBtn = document.getElementById("export-btn");
    const importBtn = document.getElementById("import-btn");
    const importFile = document.getElementById("import-file");
    const clearBtn = document.getElementById("clear-btn");

    let currentResult = null;

    function loadAll() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === "object") ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function saveAll(entries) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }

    function getLatestBefore(dateStr) {
        const all = loadAll();
        const dates = Object.keys(all).filter(function (d) { return d < dateStr; }).sort();
        if (dates.length === 0) return null;
        return all[dates[dates.length - 1]];
    }

    textarea.addEventListener("input", function () {
        charCount.textContent = String(textarea.value.length);
    });

    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        const date = dateInput.value;
        const diary = textarea.value.trim();
        if (!date || !diary) return;

        const previous = getLatestBefore(date);
        const payload = {
            date: date,
            diary: diary,
            previous_state: previous ? previous.state_vec : null,
            previous_summary: previous
                ? ("前回(" + previous.date + "): " + previous.user_diary.slice(0, 200))
                : "",
        };

        submitBtn.disabled = true;
        statusCard.hidden = false;
        statusText.textContent = "生成中（初回はモデル読み込みで数分かかります）";
        resultCard.hidden = true;

        try {
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "生成に失敗しました");
            }
            currentResult = {
                date: data.date,
                user_diary: diary,
                ai_diary: data.ai_diary,
                emotion: data.emotion_after,
                state_vec: data.state_vec,
                created_at: new Date().toISOString(),
            };
            renderResult(data);
        } catch (err) {
            statusText.textContent = "エラー: " + err.message;
            submitBtn.disabled = false;
            return;
        }

        statusCard.hidden = true;
        submitBtn.disabled = false;
    });

    saveBtn.addEventListener("click", function () {
        if (!currentResult) return;
        const all = loadAll();
        if (all[currentResult.date]) {
            if (!confirm(currentResult.date + " の日記は既に存在します。上書きしますか？")) {
                return;
            }
        }
        all[currentResult.date] = currentResult;
        saveAll(all);
        saveBtn.textContent = "保存しました";
        saveBtn.disabled = true;
        renderHistory();
    });

    function renderResult(data) {
        resultDate.textContent = data.date;
        aiDiaryEl.textContent = data.ai_diary || "";
        saveBtn.disabled = false;
        saveBtn.textContent = "ブラウザに保存";

        barsEl.innerHTML = "";
        AXES.forEach(function (axis) {
            const before = data.emotion_before[axis];
            const after = data.emotion_after[axis];
            const delta = after - before;
            const row = document.createElement("div");
            row.className = "bar-row";

            const label = document.createElement("span");
            label.className = "bar-label";
            label.textContent = EMOTION_LABELS[axis];

            const track = document.createElement("div");
            track.className = "bar-track";
            const fill = document.createElement("div");
            fill.className = "bar-fill";
            fill.style.width = (after * 100).toFixed(0) + "%";
            fill.style.backgroundColor = EMOTION_COLORS[axis];
            track.appendChild(fill);

            const value = document.createElement("span");
            value.className = "bar-value";
            value.textContent = (after * 100).toFixed(0) + "%";

            const deltaEl = document.createElement("span");
            const sign = delta >= 0 ? "+" : "";
            deltaEl.className = "bar-delta " + (delta > 0.001 ? "up" : delta < -0.001 ? "down" : "");
            deltaEl.textContent = sign + (delta * 100).toFixed(1) + "pt";

            row.appendChild(label);
            row.appendChild(track);
            row.appendChild(value);
            row.appendChild(deltaEl);
            barsEl.appendChild(row);
        });

        debugEl.textContent = JSON.stringify(
            { impacts: data.impacts, emotion_before: data.emotion_before, emotion_after: data.emotion_after },
            null, 2
        );

        resultCard.hidden = false;
        resultCard.scrollIntoView({ behavior: "smooth" });
    }

    function renderHistory() {
        const all = loadAll();
        const dates = Object.keys(all).sort().reverse();
        historyList.innerHTML = "";
        if (dates.length === 0) {
            const li = document.createElement("li");
            li.className = "empty";
            li.textContent = "まだ保存された日記はありません。";
            historyList.appendChild(li);
            return;
        }
        dates.forEach(function (d) {
            const entry = all[d];
            const li = document.createElement("li");
            li.className = "history-item";

            const header = document.createElement("div");
            header.className = "history-header";

            const dateSpan = document.createElement("span");
            dateSpan.className = "history-date";
            dateSpan.textContent = d;

            const emoSpan = document.createElement("span");
            emoSpan.className = "history-emotion";
            if (entry.emotion) {
                emoSpan.textContent =
                    "自信" + Math.round(entry.emotion.confidence * 100) + "% / " +
                    "好奇心" + Math.round(entry.emotion.curiosity * 100) + "% / " +
                    "冷静" + Math.round(entry.emotion.calm * 100) + "%";
            }

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "mini danger";
            delBtn.textContent = "削除";
            delBtn.addEventListener("click", function () {
                if (!confirm(d + " の日記を削除しますか？")) return;
                const cur = loadAll();
                delete cur[d];
                saveAll(cur);
                renderHistory();
            });

            header.appendChild(dateSpan);
            header.appendChild(emoSpan);
            header.appendChild(delBtn);

            const userP = document.createElement("p");
            userP.className = "history-user";
            const userLabel = document.createElement("span");
            userLabel.className = "entry-label";
            userLabel.textContent = "自分: ";
            userP.appendChild(userLabel);
            userP.appendChild(document.createTextNode(entry.user_diary));

            const aiP = document.createElement("p");
            aiP.className = "history-ai";
            const aiLabel = document.createElement("span");
            aiLabel.className = "entry-label";
            aiLabel.textContent = "カイ: ";
            aiP.appendChild(aiLabel);
            aiP.appendChild(document.createTextNode(entry.ai_diary));

            const details = document.createElement("details");
            const summary = document.createElement("summary");
            summary.textContent = "本文を読む";
            details.appendChild(summary);
            details.appendChild(userP);
            details.appendChild(aiP);

            li.appendChild(header);
            li.appendChild(details);
            historyList.appendChild(li);
        });
    }

    exportBtn.addEventListener("click", function () {
        const data = loadAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "quantum_diary_export_" + new Date().toISOString().slice(0, 10) + ".json";
        a.click();
        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener("click", function () {
        importFile.click();
    });

    importFile.addEventListener("change", function () {
        const file = importFile.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert("ファイルサイズが大きすぎます（5MB上限）");
            return;
        }
        const reader = new FileReader();
        reader.onload = function () {
            try {
                const parsed = JSON.parse(String(reader.result));
                if (!parsed || typeof parsed !== "object") throw new Error("不正な形式");
                const current = loadAll();
                let count = 0;
                Object.keys(parsed).forEach(function (k) {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && parsed[k] && typeof parsed[k] === "object") {
                        current[k] = parsed[k];
                        count += 1;
                    }
                });
                saveAll(current);
                renderHistory();
                alert(count + " 件の日記をインポートしました。");
            } catch (e) {
                alert("インポートに失敗しました: " + e.message);
            }
            importFile.value = "";
        };
        reader.readAsText(file);
    });

    clearBtn.addEventListener("click", function () {
        if (!confirm("保存された日記をすべて削除します。よろしいですか？\n（エクスポートでバックアップを取ってからの実行を推奨）")) {
            return;
        }
        localStorage.removeItem(STORAGE_KEY);
        renderHistory();
    });

    renderHistory();
})();
