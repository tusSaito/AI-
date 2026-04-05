(function () {
    "use strict";

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

    const form = document.getElementById("diary-form");
    const textarea = document.getElementById("entry-text");
    const charCount = document.getElementById("char-count");
    const submitBtn = document.getElementById("submit-btn");
    const statusCard = document.getElementById("status");
    const statusText = document.getElementById("status-text");
    const resultCard = document.getElementById("result");
    const aiDiaryEl = document.getElementById("ai-diary");
    const barsEl = document.getElementById("emotion-bars");
    const debugEl = document.getElementById("debug-json");

    textarea.addEventListener("input", function () {
        charCount.textContent = String(textarea.value.length);
    });

    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        const payload = {
            date: document.getElementById("entry-date").value,
            diary: textarea.value.trim(),
        };
        if (!payload.diary) {
            return;
        }

        submitBtn.disabled = true;
        statusCard.hidden = false;
        statusText.textContent = "カイが読んでいます…（初回はモデル読み込みで数分かかります）";
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
            renderResult(data);
        } catch (err) {
            statusText.textContent = "エラー: " + err.message;
            submitBtn.disabled = false;
            return;
        }

        statusCard.hidden = true;
        submitBtn.disabled = false;
    });

    function renderResult(data) {
        aiDiaryEl.textContent = data.ai_diary || "";

        barsEl.innerHTML = "";
        const axes = ["confidence", "curiosity", "calm"];
        axes.forEach(function (axis) {
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
            null,
            2
        );

        resultCard.hidden = false;
        resultCard.scrollIntoView({ behavior: "smooth" });
    }
})();
