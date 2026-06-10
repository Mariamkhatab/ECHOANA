// Flow: landing -> emoji quiz -> model recommendation -> light up the room + result card.

import { CareHome } from "./scene.js?v=6";
import { QUESTIONS, assembleFeatures } from "./quiz.js";
import { recommend } from "./assign.js";
import { FEATURE_ORDER } from "./model.js";

const home = new CareHome(document.getElementById("scene"));
window.__home = home; // debug hook

const els = {
  start: document.getElementById("start-btn"),
  landing: document.getElementById("landing"),
  quiz: document.getElementById("quiz"),
  qTitle: document.getElementById("q-title"),
  qHint: document.getElementById("q-hint"),
  qOptions: document.getElementById("q-options"),
  progress: document.getElementById("progress"),
  back: document.getElementById("back-btn"),
  result: document.getElementById("result"),
  retake: document.getElementById("retake-btn"),
};

let step = 0;
let answers = {};

function show(el, on) { el.classList.toggle("hidden", !on); }

function renderProgress() {
  els.progress.innerHTML = "";
  QUESTIONS.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.className = "dot" + (i < step ? " done" : i === step ? " active" : "");
    els.progress.appendChild(dot);
  });
}

function renderQuestion() {
  const q = QUESTIONS[step];
  els.qTitle.textContent = q.title;
  els.qHint.textContent = q.hint || "";
  show(els.qHint, !!q.hint);
  els.back.classList.toggle("hidden", step === 0);
  els.qOptions.innerHTML = "";
  q.options.forEach((opt) => {
    const b = document.createElement("button");
    b.className = "option";
    b.innerHTML = `<i data-lucide="${opt.icon}" class="opt-icon"></i><span class="opt-label">${opt.label}</span>`;
    b.onclick = () => {
      Object.assign(answers, opt.set);
      b.classList.add("picked");
      setTimeout(next, 180);
    };
    els.qOptions.appendChild(b);
  });
  if (window.lucide) {
    window.lucide.createIcons();
  }
  renderProgress();
}

function next() {
  step++;
  if (step >= QUESTIONS.length) return finish();
  renderQuestion();
}

function back() {
  if (step > 0) { step--; renderQuestion(); }
}

function startQuiz() {
  step = 0; answers = {};
  home.reset();
  show(els.landing, false);
  show(els.result, false);
  show(els.quiz, true);
  renderQuestion();
}

function finish() {
  const features = assembleFeatures(answers, FEATURE_ORDER);
  const rec = recommend(features);
  home.highlightGroup(rec.rooms);
  showResult(rec);
}

function showResult(rec) {
  show(els.quiz, false);
  const pct = Math.round(rec.confidence * 100);
  els.result.querySelector("#r-badge").textContent = rec.group;
  els.result.querySelector("#r-badge").style.background = rec.meta.color;
  els.result.querySelector("#r-name").textContent = rec.meta.name;
  els.result.querySelector("#r-orient").textContent = rec.meta.orient;
  els.result.querySelector("#r-room").textContent = rec.exampleRoom;
  els.result.querySelector("#r-desc").innerHTML = rec.meta.desc;
  els.result.querySelector("#r-conf-fill").style.width = pct + "%";
  els.result.querySelector("#r-conf-fill").style.background = rec.meta.color;
  els.result.querySelector("#r-conf-val").textContent = pct + "%";
  show(els.result, true);
}

els.start.onclick = startQuiz;
els.retake.onclick = startQuiz;
els.back.onclick = back;
