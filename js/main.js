// Flow: landing -> emoji quiz -> model recommendation -> light up the room + result card.

import { CareHome } from "./scene.js?v=7";
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

// ==========================================================================
// Upgraded Presentation Tab Switching & Layout Controls
// ==========================================================================
const navItems = document.querySelectorAll(".nav-item");
const tabPanes = document.querySelectorAll(".tab-pane");

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetTab = btn.getAttribute("data-tab");
    
    // Toggle nav active state
    navItems.forEach((item) => item.classList.remove("active"));
    btn.classList.add("active");
    
    // Toggle tab visibility
    tabPanes.forEach((pane) => {
      pane.classList.remove("active");
      if (pane.id === `${targetTab}-tab`) {
        pane.classList.add("active");
      }
    });

    // Pause/Resume rendering optimization based on active view
    if (targetTab === "room-matcher") {
      home.resume();
    } else {
      home.pause();
    }
  });
});

// ==========================================================================
// Table of Contents ScrollSpy and smooth navigation
// ==========================================================================
const exhibitionContent = document.querySelector(".exhibition-content");
const tocLinks = document.querySelectorAll(".toc-item");
const docSections = document.querySelectorAll(".doc-section");

if (exhibitionContent) {
  // Clicking TOC items scrolls content
  tocLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute("href");
      const targetSection = document.querySelector(targetId);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: "smooth" });
        tocLinks.forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
      }
    });
  });

  // ScrollSpy to highlight TOC items as user scrolls
  exhibitionContent.addEventListener("scroll", () => {
    let currentId = "";
    const containerTop = exhibitionContent.getBoundingClientRect().top;
    
    docSections.forEach((section) => {
      const sectionTop = section.getBoundingClientRect().top - containerTop;
      // If the section is near the top of the scrolling viewport
      if (sectionTop <= 100) {
        currentId = "#" + section.id;
      }
    });

    if (currentId) {
      tocLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === currentId);
      });
    }
  });
}

// ==========================================================================
// High-Resolution Image Modal Overlay
// ==========================================================================
const modal = document.getElementById("image-modal");
const modalImg = document.getElementById("modal-img");
const captionText = document.getElementById("modal-caption");
const closeBtn = document.querySelector(".modal-close");

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("zoomable")) {
    modal.style.display = "flex";
    modalImg.src = e.target.src;
    captionText.innerHTML = e.target.alt || "";
  }
});

if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target === closeBtn) {
      modal.style.display = "none";
    }
  });
}

// ==========================================================================
// Render all static decorative icons on initial load.
// (Previously createIcons() only ran while rendering the quiz, so sidebar,
//  EDA, and download icons stayed blank until the quiz was reached.)
// ==========================================================================
function renderIcons() {
  if (window.lucide) window.lucide.createIcons();
}
renderIcons();
// Safety net in case the lucide CDN script hasn't finished loading yet.
window.addEventListener("load", renderIcons);

