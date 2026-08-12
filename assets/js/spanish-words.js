(() => {
  const root = document.getElementById("vocab-app");
  if (!root) return;

  const PAGE_SIZE = 50;
  const storageKey = "noland-spanish-learned-v1";
  let words = [], filtered = [], page = 1, learned = new Set();
  let round = [], question = 0, score = 0, answered = false;

  const $ = id => document.getElementById(id);
  const shuffle = items => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  try { learned = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]")); } catch (_) {}

  function saveProgress() {
    localStorage.setItem(storageKey, JSON.stringify([...learned]));
    $("vocab-learned").textContent = learned.size.toLocaleString();
    $("vocab-progress").textContent = `${Math.round(learned.size / words.length * 100) || 0}%`;
  }

  function applyFilters(reset = true) {
    if (reset) page = 1;
    const query = $("vocab-search").value.trim().toLocaleLowerCase();
    const range = $("vocab-range").value;
    const pos = $("vocab-pos").value;
    const status = $("vocab-status").value;
    filtered = words.filter(word => {
      const matchesText = !query || `${word.spanish} ${word.english}`.toLocaleLowerCase().includes(query);
      const matchesRange = range === "all" || word.rank <= Number(range);
      const matchesPos = pos === "all" || word.partOfSpeech === pos;
      const isLearned = learned.has(word.rank);
      const matchesStatus = status === "all" || (status === "learned" ? isLearned : !isLearned);
      return matchesText && matchesRange && matchesPos && matchesStatus;
    });
    renderList();
  }

  function renderList() {
    const start = (page - 1) * PAGE_SIZE;
    $("vocab-result-count").textContent = `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "word" : "words"}`;
    $("vocab-rows").innerHTML = filtered.slice(start, start + PAGE_SIZE).map(word => `
      <tr class="${learned.has(word.rank) ? "is-learned" : ""}">
        <td>${word.rank}</td><td lang="es"><strong>${escapeHtml(word.spanish)}</strong></td>
        <td>${escapeHtml(word.english)}</td><td><span class="vocab-pos">${escapeHtml(word.partOfSpeech)}</span></td>
        <td><button class="learn-button" type="button" data-rank="${word.rank}" aria-pressed="${learned.has(word.rank)}" aria-label="${learned.has(word.rank) ? "Mark as learning" : "Mark as learned"}: ${escapeHtml(word.spanish)}">${learned.has(word.rank) ? "✓" : "+"}</button></td>
      </tr>`).join("") || '<tr><td colspan="5" class="vocab-empty">No words match those filters.</td></tr>';
    renderPagination();
  }

  function renderPagination() {
    const total = Math.ceil(filtered.length / PAGE_SIZE);
    const nav = $("vocab-pagination");
    if (total <= 1) { nav.innerHTML = ""; return; }
    nav.innerHTML = `<button type="button" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>Previous</button><span>Page ${page} of ${total}</span><button type="button" data-page="${page + 1}" ${page === total ? "disabled" : ""}>Next</button>`;
  }

  function escapeHtml(value) {
    const el = document.createElement("span"); el.textContent = value; return el.innerHTML;
  }

  function startQuiz() {
    const value = $("quiz-range").value;
    let pool = value === "learning" ? words.filter(w => !learned.has(w.rank)) : words.slice(0, Number(value));
    if (pool.length < 4) pool = words.slice(0, 100);
    round = shuffle(pool).slice(0, Math.min(10, pool.length));
    question = 0; score = 0;
    $("quiz-setup").hidden = true; $("quiz-results").hidden = true; $("quiz-card").hidden = false;
    showQuestion();
  }

  function showQuestion() {
    answered = false;
    const current = round[question];
    const setting = $("quiz-direction").value;
    const direction = setting === "mixed" ? (Math.random() < .5 ? "es-en" : "en-es") : setting;
    const target = direction === "es-en" ? "english" : "spanish";
    const prompt = direction === "es-en" ? "spanish" : "english";
    const distractors = shuffle(words.filter(w => w.rank !== current.rank && w[target] !== current[target])).slice(0, 3);
    const answers = shuffle([current, ...distractors]);
    $("quiz-counter").textContent = `Question ${question + 1} of ${round.length}`;
    $("quiz-score").textContent = score;
    $("quiz-bar-fill").style.width = `${question / round.length * 100}%`;
    $("quiz-prompt-label").textContent = direction === "es-en" ? "Choose the English meaning" : "Choose the Spanish word";
    $("quiz-prompt").textContent = current[prompt];
    $("quiz-prompt").lang = prompt === "spanish" ? "es" : "en";
    $("quiz-feedback").textContent = ""; $("quiz-next").hidden = true;
    $("quiz-answers").innerHTML = answers.map((word, i) => `<button type="button" data-answer="${word.rank}"><span>${i + 1}</span>${escapeHtml(word[target])}</button>`).join("");
    $("quiz-answers").dataset.correct = current.rank;
    $("quiz-answers").dataset.correctLabel = current[target];
  }

  function answerQuiz(button) {
    if (answered) return;
    answered = true;
    const correctRank = Number($("quiz-answers").dataset.correct);
    const correct = Number(button.dataset.answer) === correctRank;
    if (correct) { score += 1; learned.add(correctRank); saveProgress(); }
    [...$("quiz-answers").querySelectorAll("button")].forEach(item => {
      item.disabled = true;
      if (Number(item.dataset.answer) === correctRank) item.classList.add("is-correct");
      else if (item === button) item.classList.add("is-wrong");
    });
    $("quiz-feedback").textContent = correct ? "Correct — nice work." : `Not quite. The correct answer is ${$("quiz-answers").dataset.correctLabel}.`;
    $("quiz-score").textContent = score;
    $("quiz-bar-fill").style.width = `${(question + 1) / round.length * 100}%`;
    $("quiz-next").textContent = question + 1 === round.length ? "See results" : "Next question";
    $("quiz-next").hidden = false; $("quiz-next").focus();
  }

  function nextQuestion() {
    question += 1;
    if (question < round.length) { showQuestion(); return; }
    $("quiz-card").hidden = true; $("quiz-results").hidden = false;
    $("quiz-result-score").textContent = `${score} out of ${round.length}`;
    $("quiz-result-copy").textContent = score === round.length ? "Perfect round. Those words are sticking." : score >= 7 ? "Strong round. Keep building on it." : "Every round is practice. Give the words another pass and try again.";
  }

  root.addEventListener("click", event => {
    const tab = event.target.closest("[data-vocab-tab]");
    if (tab) {
      root.querySelectorAll("[data-vocab-tab]").forEach(b => b.classList.toggle("is-active", b === tab));
      $("vocab-list-panel").hidden = tab.dataset.vocabTab !== "list";
      $("vocab-quiz-panel").hidden = tab.dataset.vocabTab !== "quiz";
    }
    const learn = event.target.closest("[data-rank]");
    if (learn && learn.classList.contains("learn-button")) {
      const rank = Number(learn.dataset.rank); learned.has(rank) ? learned.delete(rank) : learned.add(rank);
      saveProgress(); applyFilters(false);
    }
    const paging = event.target.closest("[data-page]");
    if (paging && !paging.disabled) { page = Number(paging.dataset.page); renderList(); root.querySelector(".vocab-table").scrollIntoView({behavior:"smooth", block:"start"}); }
    const answer = event.target.closest("[data-answer]"); if (answer) answerQuiz(answer);
  });

  ["vocab-range", "vocab-pos", "vocab-status"].forEach(id => $(id).addEventListener("change", () => applyFilters()));
  $("vocab-search").addEventListener("input", () => applyFilters());
  $("quiz-start").addEventListener("click", startQuiz);
  $("quiz-next").addEventListener("click", nextQuestion);
  $("quiz-again").addEventListener("click", () => { $("quiz-results").hidden = true; $("quiz-setup").hidden = false; });
  document.addEventListener("keydown", event => {
    if ($("quiz-card").hidden || answered || !["1","2","3","4"].includes(event.key)) return;
    const button = $("quiz-answers").children[Number(event.key) - 1]; if (button) answerQuiz(button);
  });

  fetch(root.dataset.source).then(response => {
    if (!response.ok) throw new Error("Could not load vocabulary"); return response.json();
  }).then(data => {
    words = data.words; filtered = words;
    $("vocab-total").textContent = words.length.toLocaleString();
    const types = [...new Set(words.map(w => w.partOfSpeech))].sort();
    $("vocab-pos").insertAdjacentHTML("beforeend", types.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type[0].toUpperCase() + type.slice(1))}</option>`).join(""));
    saveProgress(); applyFilters();
  }).catch(() => { $("vocab-result-count").textContent = "The word list could not be loaded. Please refresh and try again."; });
})();
