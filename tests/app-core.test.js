import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrack,
  formatTime,
  getActiveAnnotationIndex,
  normalizeAudioUrl,
  normalizeRows,
  normalizeSheetUrl,
  parseCsv,
} from "../assets/app-core.js";

test("formatTime supports minute and hour timestamps", () => {
  assert.equal(formatTime(65), "1:05");
  assert.equal(formatTime(3665), "1:01:05");
});

test("normalizeSheetUrl converts sheet ids and Google URLs to csv export urls", () => {
  assert.equal(
    normalizeSheetUrl("sheet-file-id", "12"),
    "https://docs.google.com/spreadsheets/d/sheet-file-id/export?format=csv&gid=12",
  );

  assert.equal(
    normalizeSheetUrl("https://docs.google.com/spreadsheets/d/abc123/edit#gid=5"),
    "https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=5",
  );

  assert.equal(
    normalizeSheetUrl("https://docs.google.com/spreadsheets/d/abc123/pubhtml"),
    "https://docs.google.com/spreadsheets/d/abc123/pub?output=csv",
  );
});

test("normalizeAudioUrl resolves relative paths and Google Drive links", () => {
  assert.equal(
    normalizeAudioUrl("./audio/example.wav", "https://example.com/data/annotations.json"),
    "https://example.com/data/audio/example.wav",
  );

  assert.equal(
    normalizeAudioUrl("https://drive.google.com/file/d/file123/view", "https://example.com/data.json"),
    "https://drive.google.com/uc?export=download&id=file123",
  );
});

test("parseCsv reads quoted rows and embedded commas", () => {
  const rows = parseCsv([
    "track_id,title,audio_url,start_seconds,label,comment",
    'piece1,"String, Quartet",./audio.wav,12,Opening,"Listen ""closely"" here"',
  ].join("\n"));

  assert.deepEqual(rows, [
    {
      track_id: "piece1",
      title: "String, Quartet",
      audio_url: "./audio.wav",
      start_seconds: "12",
      label: "Opening",
      comment: 'Listen "closely" here',
    },
  ]);
});

test("normalizeRows validates required fields and coerces start time", () => {
  const rows = normalizeRows(
    [
      {
        track_id: "piece1",
        title: "Example",
        audio_url: "./audio.wav",
        start_seconds: "12.5",
        label: "Start",
        comment: "First cue",
      },
    ],
    "https://example.com/sample-data/annotations.json",
  );

  assert.deepEqual(rows, [
    {
      track_id: "piece1",
      title: "Example",
      audio_url: "https://example.com/sample-data/audio.wav",
      start_seconds: 12.5,
      label: "Start",
      comment: "First cue",
    },
  ]);
});

test("buildTrack sorts annotations and checks consistency", () => {
  const track = buildTrack(
    [
      {
        track_id: "piece1",
        title: "Example",
        audio_url: "https://example.com/audio.wav",
        start_seconds: 42,
        label: "Later",
        comment: "Second",
      },
      {
        track_id: "piece1",
        title: "Example",
        audio_url: "https://example.com/audio.wav",
        start_seconds: 12,
        label: "Earlier",
        comment: "First",
      },
    ],
    "piece1",
  );

  assert.deepEqual(track.annotations.map((annotation) => annotation.label), ["Earlier", "Later"]);
});

test("getActiveAnnotationIndex returns the most recent annotation at or before playback time", () => {
  const annotations = [
    { startSeconds: 5 },
    { startSeconds: 12 },
    { startSeconds: 20 },
  ];

  assert.equal(getActiveAnnotationIndex(annotations, 0), -1);
  assert.equal(getActiveAnnotationIndex(annotations, 5), 0);
  assert.equal(getActiveAnnotationIndex(annotations, 19.5), 1);
});
