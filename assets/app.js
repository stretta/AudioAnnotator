const REQUIRED_COLUMNS = [
  "track_id",
  "title",
  "audio_url",
  "start_seconds",
  "label",
  "comment",
];

const FALLBACK_SOURCES = [
  { label: "Local sample JSON", url: "./sample-data/annotations.json" },
  { label: "Local sample CSV", url: "./sample-data/annotations.csv" },
];

const elements = {
  title: document.querySelector("#track-title"),
  meta: document.querySelector("#track-meta"),
  sourceBadge: document.querySelector("#source-badge"),
  messagePanel: document.querySelector("#message-panel"),
  playerPanel: document.querySelector("#player-panel"),
  audio: document.querySelector("#audio-player"),
  annotationList: document.querySelector("#annotation-list"),
  annotationCount: document.querySelector("#annotation-count"),
};

let annotations = [];
let activeIndex = -1;
let timeListenerAttached = false;

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

  const { rows, sourceLabel } = await loadRows(params);
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
    renderTrack(track, sourceLabel);
  } catch (error) {
    showError("Invalid track data", error.message || "The selected track could not be parsed.");
  }
}

async function loadRows(params) {
  const sources = [];
  const sheetParam = (params.get("sheet") || "").trim();
  const dataParam = (params.get("data") || "").trim();
  const gid = (params.get("gid") || "").trim();

  if (sheetParam) {
    sources.push({
      label: "Published Google Sheet",
      url: normalizeSheetUrl(sheetParam, gid),
      sticky: true,
    });
  } else if (dataParam) {
    sources.push({
      label: "Custom data source",
      url: dataParam,
      sticky: true,
    });
  }

  sources.push(...FALLBACK_SOURCES);

  const failures = [];

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}.`);
      }

      const resolvedUrl = response.url || new URL(source.url, window.location.href).href;
      const rows = await parseRowsFromResponse(response, resolvedUrl);
      return { rows: normalizeRows(rows, resolvedUrl), sourceLabel: source.label };
    } catch (error) {
      failures.push(`${source.label}: ${error.message}`);
    }
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

function normalizeRows(rawRows, sourceUrl) {
  if (!Array.isArray(rawRows)) {
    throw new Error("Data source must return an array of rows.");
  }

  return rawRows.map((row, index) => {
    if (!row || typeof row !== "object") {
      throw new Error(`Row ${index + 1} is not a valid object.`);
    }

    const normalized = {};
    for (const column of REQUIRED_COLUMNS) {
      if (!(column in row)) {
        throw new Error(`Missing required column "${column}".`);
      }
      normalized[column] = String(row[column] ?? "").trim();
    }

    const startSeconds = Number(normalized.start_seconds);
    if (!Number.isFinite(startSeconds) || startSeconds < 0) {
      throw new Error(`Invalid timestamp in row ${index + 1}.`);
    }

    if (!normalized.track_id || !normalized.title || !normalized.label || !normalized.comment) {
      throw new Error(`Row ${index + 1} is missing required text fields.`);
    }

    if (!normalized.audio_url) {
      throw new Error(`Missing audio URL in row ${index + 1}.`);
    }

    normalized.start_seconds = startSeconds;
    normalized.audio_url = normalizeAudioUrl(normalized.audio_url, sourceUrl);
    return normalized;
  });
}

function buildTrack(trackRows, trackId) {
  const sortedRows = [...trackRows].sort((a, b) => a.start_seconds - b.start_seconds);
  const title = sortedRows[0].title;
  const audioUrl = sortedRows[0].audio_url;

  for (const row of sortedRows) {
    if (row.title !== title) {
      throw new Error(`Track "${trackId}" has inconsistent title values.`);
    }

    if (row.audio_url !== audioUrl) {
      throw new Error(`Track "${trackId}" has inconsistent audio URLs.`);
    }
  }

  return {
    id: trackId,
    title,
    audioUrl,
    annotations: sortedRows.map((row) => ({
      startSeconds: row.start_seconds,
      label: row.label,
      comment: row.comment,
    })),
  };
}

function renderTrack(track, sourceLabel) {
  annotations = track.annotations;
  activeIndex = -1;

  elements.title.textContent = track.title;
  elements.meta.textContent = `${track.id} • ${annotations.length} annotation${annotations.length === 1 ? "" : "s"}`;
  elements.annotationCount.textContent = `${annotations.length} cues`;
  elements.sourceBadge.hidden = false;
  elements.sourceBadge.textContent = sourceLabel;
  elements.playerPanel.hidden = false;
  elements.messagePanel.hidden = true;
  elements.annotationList.innerHTML = "";

  for (const [index, annotation] of annotations.entries()) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "annotation-button";
    button.dataset.index = String(index);

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
    button.append(line, comment);
    button.addEventListener("click", () => {
      elements.audio.currentTime = annotation.startSeconds;
      if (elements.audio.paused) {
        elements.audio.play().catch(() => {
          updateActiveAnnotation(annotation.startSeconds);
        });
      }
      updateActiveAnnotation(annotation.startSeconds);
    });

    item.append(button);
    elements.annotationList.append(item);
  }

  elements.audio.src = track.audioUrl;
  elements.audio.onerror = () => {
    elements.playerPanel.hidden = true;
    showError("Audio failed to load", "The audio file could not be loaded. Check that the URL is public and browser-readable.");
  };

  if (!timeListenerAttached) {
    elements.audio.addEventListener("timeupdate", handleTimeUpdate);
    elements.audio.addEventListener("loadedmetadata", handleTimeUpdate);
    timeListenerAttached = true;
  }

  elements.audio.load();
}

function handleTimeUpdate() {
  updateActiveAnnotation(elements.audio.currentTime);
}

function updateActiveAnnotation(currentTime) {
  let nextIndex = -1;

  for (let index = 0; index < annotations.length; index += 1) {
    if (annotations[index].startSeconds <= currentTime) {
      nextIndex = index;
    } else {
      break;
    }
  }

  if (nextIndex === activeIndex) {
    return;
  }

  const buttons = elements.annotationList.querySelectorAll(".annotation-button");
  buttons.forEach((button, index) => {
    button.classList.toggle("active", index === nextIndex);
  });
  activeIndex = nextIndex;
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
  elements.title.textContent = "Canvas Audio Annotator";
  elements.meta.textContent = "Unable to display the requested track.";
  elements.playerPanel.hidden = true;
  showMessage(title, body, "error");
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normalizeSheetUrl(input, gid) {
  if (/^https?:\/\//i.test(input)) {
    if (input.includes("/pubhtml")) {
      return input.replace("/pubhtml", "/pub?output=csv");
    }

    if (input.includes("output=csv") || input.includes("format=csv")) {
      return input;
    }

    const url = new URL(input);
    const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return input;
    }

    const hashMatch = url.hash.match(/gid=(\d+)/);
    const resolvedGid = gid || url.searchParams.get("gid") || (hashMatch ? hashMatch[1] : "") || "0";
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${resolvedGid}`;
  }

  const resolvedGid = gid || "0";
  return `https://docs.google.com/spreadsheets/d/${input}/export?format=csv&gid=${resolvedGid}`;
}

function normalizeAudioUrl(input, sourceUrl) {
  const resolved = new URL(input, sourceUrl);

  if (resolved.hostname.includes("drive.google.com")) {
    const fileId = extractGoogleDriveFileId(resolved);
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }

  return resolved.href;
}

function extractGoogleDriveFileId(url) {
  const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }

  return url.searchParams.get("id") || "";
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  if (rows.length < 2) {
    return [];
  }

  const [header, ...dataRows] = rows;
  return dataRows.map((cells) => {
    const record = {};
    header.forEach((column, index) => {
      record[column.trim()] = (cells[index] || "").trim();
    });
    return record;
  });
}
