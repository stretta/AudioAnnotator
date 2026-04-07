export const REQUIRED_COLUMNS = [
  "track_id",
  "title",
  "audio_url",
  "start_seconds",
  "label",
  "comment",
];

export const FALLBACK_SOURCES = [
  { label: "Local sample JSON", url: "./sample-data/annotations.json" },
  { label: "Local sample CSV", url: "./sample-data/annotations.csv" },
];

export function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function normalizeSheetUrl(input, gid) {
  if (/^https?:\/\//i.test(input)) {
    const url = new URL(input);
    if (url.pathname.includes("/pubhtml") || url.pathname.includes("/pub")) {
      url.pathname = url.pathname.replace("/pubhtml", "/pub");
      url.searchParams.set("output", "csv");
      return url.toString();
    }

    if (url.searchParams.get("output") === "csv" || url.searchParams.get("format") === "csv") {
      return input;
    }

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

export function normalizeAudioUrl(input, sourceUrl) {
  const resolved = new URL(input, sourceUrl);

  if (resolved.hostname.includes("drive.google.com")) {
    const fileId = extractGoogleDriveFileId(resolved);
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }

  return resolved.href;
}

export function extractGoogleDriveFileId(url) {
  const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }

  return url.searchParams.get("id") || "";
}

export function parseCsv(text) {
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

export function normalizeRows(rawRows, sourceUrl) {
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

export function buildTrack(trackRows, trackId) {
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

export function getActiveAnnotationIndex(trackAnnotations, currentTime) {
  let nextIndex = -1;

  for (let index = 0; index < trackAnnotations.length; index += 1) {
    if (trackAnnotations[index].startSeconds <= currentTime) {
      nextIndex = index;
    } else {
      break;
    }
  }

  return nextIndex;
}
