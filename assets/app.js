import {
  FALLBACK_SOURCES,
  buildTrack,
  formatTime,
  getActiveAnnotationIndex,
  normalizeRows,
  normalizeSheetUrl,
  parseCsv,
} from "./app-core.js";
import WaveSurfer from "./vendor/wavesurfer.esm.js";

const elements = {
  title: document.querySelector("#track-title"),
  meta: document.querySelector("#track-meta"),
  sourceBadge: document.querySelector("#source-badge"),
  messagePanel: document.querySelector("#message-panel"),
  playerPanel: document.querySelector("#player-panel"),
  audio: document.querySelector("#audio-player"),
  waveform: document.querySelector("#waveform-overview"),
  waveformMarkers: document.querySelector("#waveform-markers"),
  annotationCurrent: document.querySelector("#annotation-current"),
};

let annotations = [];
let activeIndex = -1;
let timeListenerAttached = false;
let waveform = null;

init().catch((error) => {
  showError("Unexpected error", error.message || "Something went wrong while loading the player.");
});

async function init() {
  const params = new URLSearchParams(window.location.search);
  const trackId = (params.get("track") || "").trim();

  if (!trackId) {
    showError("Missing track", "Add a track query parameter such as ?track=piece1 to load annotations.");
    return;
  }

  showMessage("Loading track", "Fetching annotation data and preparing the audio player.", "loading");

  let rows;

  try {
    ({ rows } = await loadRows(params));
  } catch (error) {
    showError("Data source error", error.message || "The requested annotation source could not be loaded.");
    return;
  }

  if (rows.length === 0) {
    showError("Missing data", "The selected data source did not contain any rows.");
    return;
  }

  const trackRows = rows.filter((row) => row.track_id === trackId);
  if (trackRows.length === 0) {
    showError("Track not found", `No rows were found for track "${trackId}".`);
    return;
  }

  try {
    const track = buildTrack(trackRows, trackId);
    renderTrack(track);
  } catch (error) {
    showError("Invalid track data", error.message || "The selected track could not be parsed.");
  }
}

async function loadRows(params) {
  const sources = [];
  const sheetParam = (params.get("sheet") || "").trim();
  const dataParam = (params.get("data") || "").trim();
  const gid = (params.get("gid") || "").trim();
  const explicitSourceRequested = Boolean(sheetParam || dataParam);

  if (sheetParam) {
    sources.push({
      label: "Sheet source",
      url: normalizeSheetUrl(sheetParam, gid),
    });
  } else if (dataParam) {
    sources.push({
      label: "Custom data source",
      url: dataParam,
    });
  }

  if (!explicitSourceRequested) {
    sources.push(...FALLBACK_SOURCES);
  }

  const failures = [];

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}.`);
      }

      const resolvedUrl = response.url || new URL(source.url, window.location.href).href;
      const rows = await parseRowsFromResponse(response, resolvedUrl);
      return { rows: normalizeRows(rows, resolvedUrl) };
    } catch (error) {
      failures.push(`${source.label}: ${error.message}`);
    }
  }

  if (explicitSourceRequested) {
    throw new Error(`Unable to load the requested data source. ${failures.join(" ")}`);
  }

  throw new Error(`Unable to load annotation data. ${failures.join(" ")}`);
}

async function parseRowsFromResponse(response, sourceUrl) {
  const contentType = response.headers.get("content-type") || "";
  const isCsv = sourceUrl.toLowerCase().includes(".csv") || contentType.includes("text/csv");

  if (isCsv) {
    const text = await response.text();
    return parseCsv(text);
  }

  return response.json();
}

function renderTrack(track) {
  annotations = track.annotations;
  activeIndex = -1;

  elements.title.textContent = track.title;
  elements.meta.textContent = `${track.id} • ${annotations.length} annotation${annotations.length === 1 ? "" : "s"}`;
  elements.sourceBadge.hidden = true;
  elements.sourceBadge.textContent = "";
  elements.playerPanel.hidden = false;
  elements.messagePanel.hidden = true;
  elements.annotationCurrent.innerHTML = "";
  elements.waveformMarkers.innerHTML = "";
  teardownWaveform();
  elements.waveform.classList.remove("is-hidden");
  renderCurrentAnnotation(-1);

  elements.audio.onerror = () => {
    elements.playerPanel.hidden = true;
    showError("Audio failed to load", "The audio file could not be loaded. Check that the URL is public and browser-readable.");
  };

  if (!timeListenerAttached) {
    elements.audio.addEventListener("timeupdate", handleTimeUpdate);
    elements.audio.addEventListener("loadedmetadata", handleTimeUpdate);
    timeListenerAttached = true;
  }

  setupWaveform(track.audioUrl);
}

function handleTimeUpdate() {
  updateActiveAnnotation(elements.audio.currentTime);
}

function updateActiveAnnotation(currentTime) {
  const nextIndex = getActiveAnnotationIndex(annotations, currentTime);

  if (nextIndex === activeIndex) {
    return;
  }
  renderCurrentAnnotation(nextIndex);

  const markers = elements.waveformMarkers.querySelectorAll(".waveform-marker");
  markers.forEach((marker, index) => {
    marker.classList.toggle("active", index === nextIndex);
    marker.setAttribute("aria-current", index === nextIndex ? "true" : "false");
  });
  activeIndex = nextIndex;
}

function renderCurrentAnnotation(index) {
  elements.annotationCurrent.innerHTML = "";

  if (index < 0 || index >= annotations.length) {
    const empty = document.createElement("p");
    empty.className = "annotation-empty";
    empty.textContent = "Playback has not reached an annotation yet.";
    elements.annotationCurrent.append(empty);
    return;
  }

  const annotation = annotations[index];
  const card = document.createElement("article");
  card.className = "annotation-card active";
  card.setAttribute("aria-current", "true");

  const line = document.createElement("div");
  line.className = "annotation-line";

  const timestamp = document.createElement("span");
  timestamp.className = "timestamp";
  timestamp.textContent = formatTime(annotation.startSeconds);

  const label = document.createElement("span");
  label.className = "annotation-label";
  label.textContent = annotation.label;

  const comment = document.createElement("p");
  comment.className = "annotation-comment";
  comment.textContent = annotation.comment;

  line.append(timestamp, label);
  card.append(line, comment);
  elements.annotationCurrent.append(card);
}

function showMessage(title, body, kind = "") {
  elements.messagePanel.hidden = false;
  elements.messagePanel.className = `message-panel ${kind}`.trim();
  elements.messagePanel.innerHTML = "";

  const heading = document.createElement("h2");
  heading.className = "message-title";
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.className = "message-body";
  paragraph.textContent = body;

  elements.messagePanel.append(heading, paragraph);
}

function showError(title, body) {
  teardownWaveform();
  elements.title.textContent = "Audio Annotator";
  elements.meta.textContent = "Unable to display the requested track.";
  elements.sourceBadge.hidden = true;
  elements.playerPanel.hidden = true;
  showMessage(title, body, "error");
}

function setupWaveform(audioUrl) {
  try {
    waveform = WaveSurfer.create({
      container: elements.waveform,
      media: elements.audio,
      height: 96,
      waveColor: "#b8c4cb",
      progressColor: "#ee243c",
      cursorColor: "#d81118",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      hideScrollbar: true,
    });

    waveform.on("error", () => {
      teardownWaveform({ hideContainer: true });
    });

    waveform.on("ready", renderWaveformMarkers);
    waveform.on("resize", renderWaveformMarkers);

    waveform.load(audioUrl).catch(() => {
      teardownWaveform({ hideContainer: true });
    });
  } catch {
    teardownWaveform({ hideContainer: true });
  }
}

function teardownWaveform(options = {}) {
  const { hideContainer = false } = options;

  if (waveform) {
    waveform.destroy();
    waveform = null;
  }

  if (hideContainer) {
    elements.waveform.classList.add("is-hidden");
  } else {
    elements.waveform.innerHTML = "";
  }

  elements.waveformMarkers.innerHTML = "";
}

function renderWaveformMarkers() {
  const duration = waveform?.getDuration() || elements.audio.duration || 0;
  elements.waveformMarkers.innerHTML = "";

  if (!duration || !Number.isFinite(duration)) {
    return;
  }

  for (const annotation of annotations) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "waveform-marker";
    marker.style.left = `${Math.min((annotation.startSeconds / duration) * 100, 100)}%`;
    marker.setAttribute("aria-label", `${formatTime(annotation.startSeconds)} ${annotation.label}`);
    marker.setAttribute("aria-current", "false");
    marker.addEventListener("click", () => {
      elements.audio.currentTime = annotation.startSeconds;
      updateActiveAnnotation(annotation.startSeconds);
      if (elements.audio.paused) {
        elements.audio.play().catch(() => {
          updateActiveAnnotation(annotation.startSeconds);
        });
      }
    });
    elements.waveformMarkers.append(marker);
  }

  updateActiveAnnotation(elements.audio.currentTime);
}
