const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const pinnedStage = matchMedia("(min-width: 881px) and (min-height: 660px)");
const motionToggle = document.querySelector("[data-motion-toggle]");
const motionKey = "jose-mercado-reduce-motion";
let reduceHere = false;
try {
  reduceHere = sessionStorage.getItem(motionKey) === "true";
} catch {
  // The page still works when the browser blocks storage.
}

const motionOn = () => !reducedMotion.matches && !reduceHere;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const story = document.querySelector("[data-story]");
const stage = story.querySelector("[data-story-stage]");
const consolePanel = stage.querySelector("[data-signal-console]");
const frame = stage.querySelector(".film-frame");
const video = frame.querySelector("video");
const background = frame.querySelector(".film-backplate");
const chapters = [...story.querySelectorAll("[data-story-chapter]")];
const title = stage.querySelector("[data-story-title]");
const note = stage.querySelector("[data-story-note]");
const counter = stage.querySelector("[data-story-count]");
const storyLink = stage.querySelector("[data-story-link]");
const trackStatus = stage.querySelector("[data-track-status]");
const progressBar = stage.querySelector("[data-story-progress]");
const depthFields = [...document.querySelectorAll("[data-depth]")];
const chapterMedia = [
  { title: "Una fecha más", note: "Recreación visual · Sin audio", label: "Leer la historia", url: "#pista-audio" },
  { title: "Transcríbeme.cl", note: "Ejemplo público del producto", label: "Ver el caso", url: "proyectos/transcribeme.html" },
  { title: "Servidor con Hermes", note: "Esquema de un respaldo", label: "Ver el caso", url: "proyectos/servidor-hermes.html" }
];

let currentScene = -1;
let manualTrack = null;
let frameRequest = 0;
let videoRequest;
let videoUrl;
let videoFailed = false;
const activeReveals = new Set();

// Without a controller, each channel is a regular link to the complete chapter.
const trackButtons = [...consolePanel.querySelectorAll(".console-channel")].map((link, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = link.className;
  button.setAttribute("aria-controls", frame.id);
  button.append(...link.childNodes);
  link.replaceWith(button);
  button.addEventListener("click", () => {
    manualTrack = { index, reading: readingChapter(window.innerHeight * .54) };
    showScene(index);
    trackStatus.textContent = `${chapterMedia[index].title}. ${chapterMedia[index].note}.`;
    scheduleMotion();
  });
  return button;
});

function readingChapter(trigger, bounds = chapters.map(chapter => chapter.getBoundingClientRect())) {
  if (!pinnedStage.matches) return -1;
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (bounds[i].top <= trigger) return i;
  }
  return -1;
}

function showScene(index) {
  if (index === currentScene) return;
  currentScene = index;
  frame.dataset.scene = String(index);
  consolePanel.dataset.channel = String(index);
  chapters.forEach((chapter, i) => chapter.toggleAttribute("data-current", i === index));
  trackButtons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
  const media = chapterMedia[index];
  title.textContent = media.title;
  note.textContent = media.note;
  storyLink.href = media.url;
  storyLink.firstChild.textContent = `${media.label} `;
  storyLink.setAttribute("aria-label", `${media.label}: ${media.title}`);
  counter.textContent = `0${index + 1} / 03`;
}

async function loadStoryVideo() {
  if (videoUrl || videoRequest || videoFailed || navigator.connection?.saveData || location.protocol === "file:") return;
  const controller = new AbortController();
  videoRequest = controller;
  try {
    // The small, cached Blob supports reverse seeks even on static servers without range requests.
    const response = await fetch(video.dataset.src, { signal: controller.signal });
    if (!response.ok) throw new Error(`Video: ${response.status}`);
    const media = await response.blob();
    if (controller.signal.aborted || !motionOn()) return;
    videoUrl = URL.createObjectURL(media);
    video.preload = "auto";
    video.src = videoUrl;
  } catch (error) {
    if (error.name !== "AbortError") videoFailed = true;
  } finally {
    if (videoRequest === controller) videoRequest = null;
  }
}

function scrubStoryVideo(progress) {
  if (!videoUrl) {
    loadStoryVideo();
    return;
  }
  if (videoFailed || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.seeking || !Number.isFinite(video.duration)) return;
  const lastFrame = Math.max(0, video.duration - 1 / 30);
  const time = Math.round(progress * lastFrame * 30) / 30;
  if (Math.abs(video.currentTime - time) > 1 / 60) video.currentTime = time;
  else frame.setAttribute("data-video-ready", "");
}

function renderStory(view) {
  const bounds = story.getBoundingClientRect();
  if (bounds.bottom <= 0 || bounds.top >= view) return;
  const screen = frame.getBoundingClientRect();
  if (screen.bottom <= 0 || screen.top >= view) return;

  const pinned = pinnedStage.matches;
  const trigger = view * .54;
  const chapterBounds = chapters.map(chapter => chapter.getBoundingClientRect());
  const [, second, third] = chapterBounds;
  const reading = readingChapter(trigger, chapterBounds);
  // Keep a chosen preview stable until the reader actually enters another pinned chapter.
  if (manualTrack && pinned && manualTrack.reading !== reading) manualTrack = null;
  const active = manualTrack?.index ?? Math.max(0, reading);
  const start = pinned ? bounds.top - 8 : Math.max(bounds.top - 8, screen.top - view * .54);
  const clipEnd = pinned ? second.top - trigger : screen.bottom - view * .12;
  const clip = clamp(-start / Math.max(1, clipEnd - start));
  const end = pinned ? third.bottom - trigger : clipEnd;
  const total = clamp(-start / Math.max(1, end - start));
  const drift = .5 - clip;

  showScene(active);
  frame.toggleAttribute("data-scrubbing", active === 0 && clip > .035);
  if (!navigator.connection?.saveData && !background.hasAttribute("src")) background.src = background.dataset.src;
  frame.style.setProperty("--parallax-back", `${(drift * (pinned ? 13 : 8)).toFixed(2)}px`);
  frame.style.setProperty("--parallax-front", `${(drift * (pinned ? 20 : 10)).toFixed(2)}px`);
  progressBar.style.transform = `scaleX(${manualTrack ? (active + 1) / chapters.length : total.toFixed(4)})`;
  // Stay on the matching poster until a visitor approaches the film or starts the story.
  if (active === 0 && (videoUrl || clip > 0 || window.scrollY > 24)) scrubStoryVideo(clip);
}

function renderMotion() {
  frameRequest = 0;
  if (!motionOn() || document.hidden) return;
  const view = window.innerHeight;
  // Read layout before updating the decorative layers; never move the text or controls.
  const depths = depthFields.map(field => field.getBoundingClientRect());
  renderStory(view);
  depthFields.forEach((field, i) => {
    const { top, bottom, height } = depths[i];
    if (bottom <= 0 || top >= view || height <= 0) return;
    const phase = clamp((view - top) / (height + view)) * 2 - 1;
    field.style.setProperty("--depth-phase", phase.toFixed(4));
  });
}

function scheduleMotion() {
  if (motionOn() && !frameRequest) frameRequest = requestAnimationFrame(renderMotion);
}

function setMotion() {
  const on = motionOn();
  root.dataset.motion = on ? "on" : "off";
  motionToggle.hidden = reducedMotion.matches;
  motionToggle.setAttribute("aria-pressed", String(!on));
  if (on) {
    scheduleMotion();
    return;
  }
  videoRequest?.abort();
  videoRequest = null;
  frame.removeAttribute("data-video-ready");
  frame.removeAttribute("data-scrubbing");
  frame.style.removeProperty("--parallax-back");
  frame.style.removeProperty("--parallax-front");
  progressBar.style.removeProperty("transform");
  depthFields.forEach(field => field.style.removeProperty("--depth-phase"));
  showScene(manualTrack?.index ?? 0);
  chapters.forEach(chapter => chapter.removeAttribute("data-current"));
  activeReveals.forEach(animation => animation.cancel());
}

video.addEventListener("loadeddata", scheduleMotion);
video.addEventListener("seeked", scheduleMotion);
video.addEventListener("error", () => {
  videoFailed = true;
  frame.removeAttribute("data-video-ready");
});
background.addEventListener("error", () => {
  background.hidden = true;
});
window.addEventListener("scroll", scheduleMotion, { passive: true });
window.addEventListener("resize", scheduleMotion);
window.addEventListener("load", scheduleMotion);
document.addEventListener("visibilitychange", scheduleMotion);
motionToggle.addEventListener("click", () => {
  reduceHere = !reduceHere;
  try {
    sessionStorage.setItem(motionKey, String(reduceHere));
  } catch {
    // This visit's preference remains active in memory.
  }
  setMotion();
});
reducedMotion.addEventListener("change", setMotion);
showScene(0);
setMotion();

if ("IntersectionObserver" in window && typeof Element.prototype.animate === "function") {
  const observer = new IntersectionObserver(entries => {
    if (!motionOn()) return;
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      const animation = target.animate(
        [{ transform: "translateY(13px) scale(.985)" }, { transform: "none" }],
        { duration: 430, easing: "cubic-bezier(.22,.68,.29,1)" }
      );
      activeReveals.add(animation);
      animation.finished.then(
        () => activeReveals.delete(animation),
        () => activeReveals.delete(animation)
      );
    }
  }, { rootMargin: "0px 0px -7% 0px", threshold: .12 });
  document.querySelectorAll("[data-reveal]").forEach(target => observer.observe(target));
}

for (const gallery of document.querySelectorAll("[data-gallery]")) {
  const rail = gallery.querySelector(".gallery-rail");
  const controls = gallery.querySelector(".gallery-controls");
  const previous = gallery.querySelector("[data-gallery-dir='-1']");
  const next = gallery.querySelector("[data-gallery-dir='1']");
  const cards = [...rail.children];
  let updateFrame = 0;
  const maxScroll = () => Math.max(0, rail.scrollWidth - rail.clientWidth);

  function updateControls() {
    updateFrame = 0;
    const end = maxScroll();
    controls.hidden = end < 2;
    previous.setAttribute("aria-disabled", String(rail.scrollLeft <= 1));
    next.setAttribute("aria-disabled", String(rail.scrollLeft >= end - 1));
  }

  function queueControls() {
    if (!updateFrame) updateFrame = requestAnimationFrame(updateControls);
  }

  function go(direction) {
    const end = maxScroll();
    const x = rail.scrollLeft;
    const start = cards[0].offsetLeft;
    const targets = cards.map(card => clamp(card.offsetLeft - start, 0, end));
    targets.push(end);
    const target = direction === 1
      ? targets.find(position => position > x + 1) ?? end
      : [...targets].reverse().find(position => position < x - 1) ?? 0;
    rail.scrollTo({ left: target, behavior: motionOn() ? "smooth" : "auto" });
  }

  previous.addEventListener("click", () => { if (previous.getAttribute("aria-disabled") !== "true") go(-1); });
  next.addEventListener("click", () => { if (next.getAttribute("aria-disabled") !== "true") go(1); });
  rail.addEventListener("keydown", event => {
    if (event.target !== rail || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      go(event.key === "ArrowRight" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      rail.scrollTo({ left: event.key === "Home" ? 0 : maxScroll(), behavior: motionOn() ? "smooth" : "auto" });
    }
  });
  rail.addEventListener("scroll", queueControls, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(queueControls).observe(rail);
  else window.addEventListener("resize", queueControls);
  updateControls();
}
