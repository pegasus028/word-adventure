
/* ============================================================
   Word Adventure — Dumbledore's Army   (app logic)
   Depends on data.js: WORDS[], SCENES[]
   ============================================================ */
(function () {
  "use strict";

  /* ---------- State ---------- */
  const state = {
    sceneIndex: 0,
    stamped: new Set(),      // words the user has opened
    visited: new Set([0]),   // scenes viewed
    quiz: null,
  };
  const TOTAL = WORDS.length;               // 28
  const wordByKey = new Map(WORDS.map(w => [w.word, w]));

  /* ---------- Element refs ---------- */
  const $ = id => document.getElementById(id);
  const els = {
    tabStory: $("tab-story"), tabWB: $("tab-wordbank"), tabQuiz: $("tab-quiz"),
    storyView: $("story-view"), wbView: $("wordbank-view"), quizView: $("quiz-view"),
    passCount: $("passport-count"), passFill: $("passport-fill"),
    stops: $("scene-stops"),
    img: $("scene-image"), badge: $("scene-badge"),
    title: $("scene-title"), caption: $("caption-text"),
    prev: $("prev-btn"), next: $("next-btn"), counter: $("scene-counter"),
    wbList: $("wordbank-list"),
    // modal
    backdrop: $("modal-backdrop"), mClose: $("modal-close"),
    mKeyword: $("modal-keyword"), mStamp: $("modal-stamp"),
    mPos: $("modal-pos"), mDef: $("modal-definition"),
    mEx: $("modal-example"), mSyn: $("modal-synonyms"), mAnt: $("modal-antonyms"),
    // quiz
    splash: $("quiz-splash"), active: $("quiz-active"), results: $("quiz-results"),
    startQuiz: $("start-quiz"),
    qLabel: $("quiz-progress-label"), qFill: $("quiz-progress-fill"),
    qType: $("question-type"), qPrompt: $("question-prompt"),
    answerGrid: $("answer-grid"), qFeedback: $("quiz-feedback"),
    nextQ: $("next-question"),
    rHeading: $("results-heading"), rScore: $("results-score"),
    rMsg: $("results-message"), retry: $("retry-quiz"), restart: $("restart-story"),
    rEmblem: $("results-emblem"),
  };

  /* ---------- Helpers ---------- */
  const esc = s => s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sample = (arr, n) => shuffle(arr).slice(0, n);

  /* ---------- Passport ---------- */
  function updatePassport() {
    els.passCount.textContent = state.stamped.size;
    els.passFill.style.width = (state.stamped.size / TOTAL * 100) + "%";
  }
  function stamp(key) {
    if (!state.stamped.has(key)) {
      state.stamped.add(key);
      updatePassport();
      // reflect in story spans + word bank
      document.querySelectorAll(`.vocab-word[data-word="${cssq(key)}"]`)
        .forEach(el => el.classList.add("stamped"));
      const wb = document.querySelector(`.wb-item[data-word="${cssq(key)}"]`);
      if (wb) wb.classList.add("stamped");
    }
  }
  // escape for attribute selector
  const cssq = s => s.replace(/["\\]/g, "\\$&");

  /* ---------- Story rendering ---------- */
  // caption uses [[display|key]] markers -> clickable spans
  function renderCaption(text) {
    let html = "";
    let last = 0;
    const re = /\[\[(.+?)\|(.+?)\]\]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      html += esc(text.slice(last, m.index));
      const disp = m[1], key = m[2];
      const cls = "vocab-word" + (state.stamped.has(key) ? " stamped" : "");
      html += `<span class="${cls}" role="button" tabindex="0" data-word="${esc(key)}">${esc(disp)}</span>`;
      last = re.lastIndex;
    }
    html += esc(text.slice(last));
    return html.replace(/\n/g, "\n");
  }

  function renderScene(i) {
    const s = SCENES[i];
    state.sceneIndex = i;
    state.visited.add(i);
    els.img.src = `images/S${s.n}.png`;
    els.img.alt = `Scene ${s.n}: ${s.title}`;
    // restart reveal animation
    els.img.style.animation = "none";
    void els.img.offsetWidth;
    els.img.style.animation = "";
    els.badge.textContent = `Scene ${s.n}`;
    els.title.textContent = s.title;
    els.caption.innerHTML = renderCaption(s.caption);
    els.counter.textContent = `Scene ${s.n} of ${SCENES.length}`;
    els.prev.disabled = i === 0;
    els.next.textContent = i === SCENES.length - 1 ? "Finish \u2192" : "Next \u2192";
    renderStops();
  }

  function renderStops() {
    els.stops.innerHTML = "";
    SCENES.forEach((s, i) => {
      const li = document.createElement("li");
      li.textContent = s.n;
      li.title = `Scene ${s.n}: ${s.title}`;
      if (state.visited.has(i)) li.classList.add("visited");
      if (i === state.sceneIndex) li.classList.add("current");
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.addEventListener("click", () => renderScene(i));
      li.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); renderScene(i); } });
      els.stops.appendChild(li);
    });
  }

  // delegate vocab clicks in story
  els.caption.addEventListener("click", e => {
    const t = e.target.closest(".vocab-word");
    if (t) openModal(t.dataset.word, true);
  });
  els.caption.addEventListener("keydown", e => {
    const t = e.target.closest(".vocab-word");
    if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openModal(t.dataset.word, true); }
  });

  els.prev.addEventListener("click", () => { if (state.sceneIndex > 0) renderScene(state.sceneIndex - 1); });
  els.next.addEventListener("click", () => {
    if (state.sceneIndex < SCENES.length - 1) renderScene(state.sceneIndex + 1);
    else switchTab("quiz");
  });

  /* ---------- Word Bank ---------- */
  function renderWordBank() {
    els.wbList.innerHTML = "";
    SCENES.forEach(s => {
      const words = WORDS.filter(w => w.scene === s.n);
      const stampedN = words.filter(w => state.stamped.has(w.word)).length;
      const wrap = document.createElement("div");
      wrap.className = "wb-scene";
      const h = document.createElement("h3");
      h.className = "wb-scene-title";
      h.innerHTML = `Scene ${s.n} &middot; ${esc(s.title)} <span>${stampedN}/${words.length} stamped</span>`;
      wrap.appendChild(h);
      const grid = document.createElement("div");
      grid.className = "wb-grid";
      words.forEach(w => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "wb-item" + (state.stamped.has(w.word) ? " stamped" : "");
        b.dataset.word = w.word;
        b.innerHTML =
          `<span class="wb-word">${esc(w.word)}<span class="wb-cefr">${esc(w.cefr)}</span></span>` +
          `<span class="wb-pos">${esc(w.pos)}</span>`;
        b.addEventListener("click", () => openModal(w.word, true));
        grid.appendChild(b);
      });
      wrap.appendChild(grid);
      els.wbList.appendChild(wrap);
    });
  }

  /* ---------- Dictionary modal ---------- */
  let lastFocus = null;
  function chip(o, kind) {
    const lvl = o.level ? ` <span class="lvl">${esc(o.level)}</span>` : "";
    return `<span class="chip ${kind}">${esc(o.word)}${lvl}</span>`;
  }
  function openModal(key, doStamp) {
    const w = wordByKey.get(key);
    if (!w) return;
    lastFocus = document.activeElement;
    els.mKeyword.textContent = w.word;

    // header meta (CEFR badge + part of speech), created once, reused after
    const header = els.mKeyword.parentElement;
    let cefr = header.querySelector(".modal-cefr");
    let pos = header.querySelector(".modal-pos");
    if (!cefr) {
      cefr = document.createElement("span");
      cefr.className = "modal-cefr";
      pos = document.createElement("span");
      pos.className = "modal-pos";
      els.mKeyword.after(cefr, pos);
    }
    cefr.textContent = w.cefr;
    pos.textContent = w.pos;

    els.mDef.textContent = w.definition;
    els.mEx.innerHTML = w.examples.map(e => `<li>${esc(e)}</li>`).join("");
    els.mSyn.innerHTML = w.synonyms.map(o => chip(o, "syn")).join("");
    els.mAnt.innerHTML = w.antonyms.map(o => chip(o, "ant")).join("");

    if (doStamp) stamp(key);
    els.mStamp.classList.toggle("show", state.stamped.has(key));

    els.backdrop.hidden = false;
    els.mClose.focus();
    document.addEventListener("keydown", onModalKey);
  }
  function closeModal() {
    els.backdrop.hidden = true;
    document.removeEventListener("keydown", onModalKey);
    if (lastFocus) lastFocus.focus();
  }
  function onModalKey(e) {
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab") { // simple focus trap
      const f = els.backdrop.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  els.mClose.addEventListener("click", closeModal);
  els.backdrop.addEventListener("click", e => { if (e.target === els.backdrop) closeModal(); });

  /* ---------- Tabs ---------- */
  function switchTab(name) {
    const map = {
      story: [els.tabStory, els.storyView],
      wordbank: [els.tabWB, els.wbView],
      quiz: [els.tabQuiz, els.quizView],
    };
    [els.tabStory, els.tabWB, els.tabQuiz].forEach(b => b.classList.remove("is-active"));
    [els.storyView, els.wbView, els.quizView].forEach(v => v.classList.remove("is-visible"));
    map[name][0].classList.add("is-active");
    map[name][1].classList.add("is-visible");
    if (name === "wordbank") renderWordBank();
    if (name === "quiz") resetQuizToSplash();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  els.tabStory.addEventListener("click", () => switchTab("story"));
  els.tabWB.addEventListener("click", () => switchTab("wordbank"));
  els.tabQuiz.addEventListener("click", () => switchTab("quiz"));

  /* ---------- Quiz ---------- */
  const QTYPES = ["definition", "reverse", "synonym", "antonym"];
  const primary = arr => arr[0].word;           // B1-level primary syn/antonym

  function buildQuestion(word, type) {
    let prompt, promptHtml, correct, poolField;
    switch (type) {
      case "definition": // What is the definition of [word]?
        promptHtml = `What is the definition of <span class="q-word">${esc(word.word)}</span>?`;
        correct = word.definition;
        poolField = "definition";
        break;
      case "reverse": // Which word means: [definition]?
        promptHtml = `Which word means: <span class="q-word">${esc(word.definition)}</span>?`;
        correct = word.word;
        poolField = "word";
        break;
      case "synonym": // What is a synonym for [word]?
        promptHtml = `What is a synonym for <span class="q-word">${esc(word.word)}</span>?`;
        correct = primary(word.synonyms);
        poolField = "synonym";
        break;
      case "antonym": // What is an antonym for [word]?
        promptHtml = `What is an antonym for <span class="q-word">${esc(word.word)}</span>?`;
        correct = primary(word.antonyms);
        poolField = "antonym";
        break;
    }
    // distractors — 3 wrong options drawn from OTHER words' matching field
    const others = WORDS.filter(w => w.word !== word.word);
    let distractPool;
    if (poolField === "definition") distractPool = others.map(w => w.definition);
    else if (poolField === "word") distractPool = others.map(w => w.word);
    else if (poolField === "synonym") distractPool = others.map(w => primary(w.synonyms));
    else distractPool = others.map(w => primary(w.antonyms));
    // dedupe + remove accidental matches with correct
    distractPool = [...new Set(distractPool)].filter(x => x && x.toLowerCase() !== correct.toLowerCase());
    const distractors = sample(distractPool, 3);
    const options = shuffle([correct, ...distractors]);
    return { type, promptHtml, correct, options };
  }

  function generateQuiz() {
    // 10 questions: pick 10 distinct words, assign a rotating mix of types
    const words = sample(WORDS, 10);
    const typeCycle = shuffle(QTYPES);
    const questions = words.map((w, i) =>
      buildQuestion(w, typeCycle[i % QTYPES.length]));
    return { questions, idx: 0, score: 0, answered: false };
  }

  const TYPE_LABEL = {
    definition: "Definition", reverse: "Match the word",
    synonym: "Synonym", antonym: "Antonym",
  };

  function resetQuizToSplash() {
    els.splash.hidden = false;
    els.active.hidden = true;
    els.results.hidden = true;
  }
  function startQuiz() {
    state.quiz = generateQuiz();
    els.splash.hidden = true;
    els.results.hidden = true;
    els.active.hidden = false;
    showQuestion();
  }
  function showQuestion() {
    const q = state.quiz;
    const cur = q.questions[q.idx];
    q.answered = false;
    els.qLabel.textContent = `Question ${q.idx + 1} of ${q.questions.length}`;
    els.qFill.style.width = ((q.idx) / q.questions.length * 100) + "%";
    els.qType.textContent = TYPE_LABEL[cur.type];
    els.qPrompt.innerHTML = cur.promptHtml;
    els.qFeedback.textContent = "";
    els.qFeedback.className = "quiz-feedback";
    els.nextQ.hidden = true;
    els.answerGrid.innerHTML = "";
    cur.options.forEach(opt => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "answer-btn";
      b.textContent = opt;
      b.addEventListener("click", () => answer(b, opt, cur));
      els.answerGrid.appendChild(b);
    });
  }
  function answer(btn, opt, cur) {
    const q = state.quiz;
    if (q.answered) return;
    q.answered = true;
    const correct = opt === cur.correct;
    if (correct) q.score++;
    [...els.answerGrid.children].forEach(b => {
      b.disabled = true;
      if (b.textContent === cur.correct) b.classList.add("correct");
      else if (b === btn) b.classList.add("wrong");
    });
    els.qFeedback.textContent = correct
      ? "Correct! \u26a1"
      : `Not quite — the answer is “${cur.correct}”.`;
    els.qFeedback.classList.add(correct ? "ok" : "no");
    els.nextQ.hidden = false;
    els.nextQ.textContent = q.idx === q.questions.length - 1 ? "See results \u2192" : "Next question \u2192";
    els.nextQ.focus();
  }
  els.nextQ.addEventListener("click", () => {
    const q = state.quiz;
    if (q.idx < q.questions.length - 1) { q.idx++; showQuestion(); }
    else showResults();
  });
  function showResults() {
    const q = state.quiz;
    els.active.hidden = true;
    els.results.hidden = false;
    const pass = q.score >= 7;
    els.qFill.style.width = "100%";
    els.rEmblem.textContent = pass ? "\uD83C\uDFC6" : "\uD83D\uDCDA";
    els.rHeading.textContent = pass ? "Spell mastered!" : "Keep practising";
    els.rScore.textContent = `${q.score} / ${q.questions.length}`;
    els.rScore.className = "results-score " + (pass ? "pass" : "fail");
    els.rMsg.textContent = pass
      ? "You passed! Dumbledore's Army would be proud. Try another round to keep the streak going."
      : "You need 7 to pass. Review the Word Bank, then try another ten questions.";
  }
  els.startQuiz.addEventListener("click", startQuiz);
  els.retry.addEventListener("click", startQuiz);
  els.restart.addEventListener("click", () => { renderScene(0); switchTab("story"); });

  /* ---------- Init ---------- */
  updatePassport();
  renderScene(0);
})();
