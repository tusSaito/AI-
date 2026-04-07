(function () {
    "use strict";

    var STORAGE_KEY = "quantum_diary_entries_v1";
    var SUMMARIES_KEY = "quantum_diary_weekly_v1";
    var EMOTION_LABELS = { confidence: "自信", curiosity: "好奇心", calm: "冷静" };
    var EMOTION_COLORS = { confidence: "#4A90D9", curiosity: "#50C878", calm: "#FF8C42" };
    var AXES = ["confidence", "curiosity", "calm"];

    var chat = document.getElementById("chat");
    var dateInput = document.getElementById("entry-date");
    var textarea = document.getElementById("entry-text");
    var charCount = document.getElementById("char-count");
    var submitBtn = document.getElementById("submit-btn");
    var emotionPanel = document.getElementById("emotion-panel");
    var barsEl = document.getElementById("emotion-bars");
    var historyList = document.getElementById("history-list");
    var exportBtn = document.getElementById("export-btn");
    var importBtn = document.getElementById("import-btn");
    var importFile = document.getElementById("import-file");
    var clearBtn = document.getElementById("clear-btn");

    function loadEntries() {
        try { var r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {}; }
        catch (e) { return {}; }
    }
    function saveEntries(o) { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); }

    function loadSummaries() {
        try { var r = localStorage.getItem(SUMMARIES_KEY); return r ? JSON.parse(r) : {}; }
        catch (e) { return {}; }
    }
    function saveSummaries(o) { localStorage.setItem(SUMMARIES_KEY, JSON.stringify(o)); }

    function getWeekKey(dateStr) {
        var d = new Date(dateStr);
        var jan1 = new Date(d.getFullYear(), 0, 1);
        var days = Math.floor((d - jan1) / 86400000);
        var week = Math.ceil((days + jan1.getDay() + 1) / 7);
        return d.getFullYear() + "-W" + String(week).padStart(2, "0");
    }

    function getRecentDays(dateStr, max) {
        var all = loadEntries();
        var dates = Object.keys(all).filter(function (d) { return d < dateStr; }).sort().reverse();
        var result = [];
        for (var i = 0; i < Math.min(dates.length, max || 3); i++) {
            result.push(all[dates[i]]);
        }
        return result.reverse();
    }

    function getPreviousWeekSummary(dateStr) {
        var currentWeek = getWeekKey(dateStr);
        var sums = loadSummaries();
        var keys = Object.keys(sums).filter(function (k) { return k < currentWeek; }).sort().reverse();
        return keys.length > 0 ? sums[keys[0]] : null;
    }

    function getPreviousState(dateStr) {
        var recent = getRecentDays(dateStr, 1);
        return recent.length > 0 ? recent[0].state_vec : null;
    }

    function addBubble(type, text, dateStr) {
        var div = document.createElement("div");
        div.className = "bubble " + type;
        if (dateStr) {
            var tag = document.createElement("span");
            tag.className = "date-tag";
            tag.textContent = dateStr;
            div.appendChild(tag);
        }
        div.appendChild(document.createTextNode(text));
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
        return div;
    }

    textarea.addEventListener("input", function () {
        charCount.textContent = String(textarea.value.length);
    });

    submitBtn.addEventListener("click", async function () {
        var entryDate = dateInput.value;
        var diary = textarea.value.trim();
        if (!entryDate || !diary) return;

        addBubble("user", diary, entryDate);
        textarea.value = "";
        charCount.textContent = "0";

        var loadingBubble = addBubble("loading", "...");
        submitBtn.disabled = true;

        var weekSummary = getPreviousWeekSummary(entryDate);
        var recentDays = getRecentDays(entryDate, 3);

        var payload = {
            date: entryDate,
            diary: diary,
            previous_state: getPreviousState(entryDate),
            week_summary: weekSummary || "",
            recent_days: recentDays.map(function (e) {
                return { date: e.date, ai_diary: e.ai_diary || "" };
            }),
        };

        try {
            var res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            var data = await res.json();
            if (!res.ok) throw new Error(data.error || "生成に失敗しました");

            chat.removeChild(loadingBubble);
            addBubble("ai", data.ai_diary, entryDate);
            renderEmotion(data);

            var all = loadEntries();
            all[entryDate] = {
                date: entryDate,
                user_diary: diary,
                ai_diary: data.ai_diary,
                emotion: data.emotion_after,
                state_vec: data.state_vec,
                created_at: new Date().toISOString(),
            };
            saveEntries(all);
            renderHistory();

            checkWeekCompression(entryDate);

        } catch (err) {
            chat.removeChild(loadingBubble);
            addBubble("system", "エラー: " + err.message);
        }

        submitBtn.disabled = false;
    });

    function renderEmotion(data) {
        emotionPanel.hidden = false;
        barsEl.innerHTML = "";
        AXES.forEach(function (axis) {
            var before = data.emotion_before[axis];
            var after = data.emotion_after[axis];
            var delta = after - before;

            var row = document.createElement("div"); row.className = "bar-row";
            var label = document.createElement("span"); label.className = "bar-label";
            label.textContent = EMOTION_LABELS[axis];
            var track = document.createElement("div"); track.className = "bar-track";
            var fill = document.createElement("div"); fill.className = "bar-fill";
            fill.style.width = (after * 100).toFixed(0) + "%";
            fill.style.backgroundColor = EMOTION_COLORS[axis];
            track.appendChild(fill);
            var value = document.createElement("span"); value.className = "bar-value";
            value.textContent = (after * 100).toFixed(0) + "%";
            var deltaEl = document.createElement("span");
            deltaEl.className = "bar-delta " + (delta > 0.001 ? "up" : delta < -0.001 ? "down" : "");
            deltaEl.textContent = (delta >= 0 ? "+" : "") + (delta * 100).toFixed(1);

            row.appendChild(label);
            row.appendChild(track);
            row.appendChild(value);
            row.appendChild(deltaEl);
            barsEl.appendChild(row);
        });
    }

    async function checkWeekCompression(dateStr) {
        var weekKey = getWeekKey(dateStr);
        var all = loadEntries();
        var sums = loadSummaries();

        if (sums[weekKey]) return;

        var weekEntries = Object.keys(all).filter(function (d) {
            return getWeekKey(d) === weekKey;
        }).sort();

        if (weekEntries.length < 7) return;

        var entries = weekEntries.map(function (d) { return all[d]; });
        try {
            var res = await fetch("/api/compress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries: entries }),
            });
            var data = await res.json();
            if (res.ok && data.summary) {
                sums[weekKey] = data.summary;
                saveSummaries(sums);
            }
        } catch (e) {}
    }

    function renderHistory() {
        var all = loadEntries();
        var dates = Object.keys(all).sort().reverse();
        historyList.innerHTML = "";
        if (dates.length === 0) {
            var li = document.createElement("li");
            li.className = "empty";
            li.textContent = "まだ記録がありません。";
            historyList.appendChild(li);
            return;
        }
        dates.forEach(function (d) {
            var entry = all[d];
            var li = document.createElement("li");
            li.className = "history-item";
            var dateSpan = document.createElement("span");
            dateSpan.className = "history-date";
            dateSpan.textContent = d;

            var details = document.createElement("details");
            var summary = document.createElement("summary");
            summary.appendChild(dateSpan);
            details.appendChild(summary);

            var userP = document.createElement("p");
            userP.textContent = entry.user_diary;
            var aiP = document.createElement("p");
            aiP.textContent = entry.ai_diary;
            details.appendChild(userP);
            details.appendChild(aiP);

            li.appendChild(details);
            historyList.appendChild(li);
        });
    }

    exportBtn.addEventListener("click", function () {
        var data = { entries: loadEntries(), summaries: loadSummaries() };
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "quantum_diary_" + new Date().toISOString().slice(0, 10) + ".json";
        a.click();
        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener("click", function () { importFile.click(); });

    importFile.addEventListener("change", function () {
        var file = importFile.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert("5MB上限"); return; }
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var parsed = JSON.parse(String(reader.result));
                var entries = parsed.entries || parsed;
                var summaries = parsed.summaries || {};
                if (typeof entries !== "object") throw new Error("不正な形式");

                var cur = loadEntries();
                var count = 0;
                Object.keys(entries).forEach(function (k) {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) { cur[k] = entries[k]; count++; }
                });
                saveEntries(cur);

                var curSum = loadSummaries();
                Object.keys(summaries).forEach(function (k) { curSum[k] = summaries[k]; });
                saveSummaries(curSum);

                renderHistory();
                alert(count + "件インポートしました。");
            } catch (e) {
                alert("インポート失敗: " + e.message);
            }
            importFile.value = "";
        };
        reader.readAsText(file);
    });

    clearBtn.addEventListener("click", function () {
        if (!confirm("すべての記録を削除します。よろしいですか？")) return;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SUMMARIES_KEY);
        renderHistory();
    });

    renderHistory();
})();
