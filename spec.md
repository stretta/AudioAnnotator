`SPEC.md`

```md
# Specification

## Product summary

This is an educational audio annotation player intended for use inside Canvas LMS through an iframe. The player renders a single audio track and a list of time-based listening prompts sourced from a published Google Sheet.

## User story

An instructor embeds the player on a Canvas page. The instructor maintains a public Google Sheet containing timestamped comments. A student opens the page, plays the audio, and clicks comments such as “Listen to the strings here” to jump directly to relevant moments.

## Functional requirements

### 1. Track selection

The player selects a single track by query parameter:

- `track=piece1`

All annotation rows matching that `track_id` are grouped together.

### 2. Data loading

The app must support:

- published Google Sheet as primary source
- local CSV or JSON fallback for development

### 3. Track metadata

For the selected track, the app derives:

- `title`
- `audio_url`

These may be repeated across rows. The implementation should validate consistency where practical.

### 4. Annotation rendering

Each annotation row contains:

- `start_seconds`
- `label`
- `comment`

The UI should display:

- formatted timestamp
- label
- comment

### 5. Playback interaction

When a user clicks an annotation:

- the audio seeks to `start_seconds`
- playback may continue naturally from that point

During playback:

- the current annotation should auto-highlight
- “current” means the most recent annotation whose `start_seconds` is less than or equal to current playback time

### 6. Error handling

The app must provide clear user-facing messages for:

- track not found
- no rows for track
- missing required columns
- invalid timestamp values
- missing audio URL
- audio load failure
- sheet fetch failure

### 7. Embedding context

The app is expected to run inside an iframe in Canvas LMS. It should therefore:

- avoid popups and auth flows
- avoid backend requirements
- avoid dependencies on private APIs
- keep layout compact and robust in embedded contexts

## Non-functional requirements

- static-site deployable
- minimal dependencies
- simple maintenance workflow
- readable code with comments around parsing and data normalization
- responsive layout that works in a narrow iframe

## Data schema

Required fields:

| field | type | description |
|---|---|---|
| `track_id` | string | unique logical ID for a single track |
| `title` | string | human-readable title |
| `audio_url` | string | public URL to audio file |
| `start_seconds` | number | cue start time in seconds |
| `label` | string | short cue title |
| `comment` | string | longer listening instruction |

## Example rows

| track_id | title | audio_url | start_seconds | label | comment |
|---|---|---|---:|---|---|
| piece1 | String Quartet Excerpt | https://example.com/audio/piece1.mp3 | 12 | Opening texture | Listen to the initial registral spacing |
| piece1 | String Quartet Excerpt | https://example.com/audio/piece1.mp3 | 92 | Strings enter | Listen to the cello and viola voicing here |
| piece1 | String Quartet Excerpt | https://example.com/audio/piece1.mp3 | 131 | Texture shift | Notice the divisi writing |

## Query parameters

Required:

- `track`

Optional candidates for later versions:

- `sheet`
- `data`
- `autoplay`
- `t`

## Version 1 scope

In scope:

- one selected track
- one audio player
- one list of cues
- click-to-seek
- auto-highlight
- published sheet support
- local fallback data

Out of scope for v1:

- authentication
- waveform display
- inline editing
- grading integration
- user comments
- multiple simultaneous tracks
- playlist mode
- database or backend services

## Recommended development sequence

1. Parse query parameter.
2. Load local fallback data.
3. Render player and cues from local data.
4. Add Google Sheet ingestion.
5. Add validation and error states.
6. Refine iframe-safe UI.
7. Document deployment.

## Done definition

The project is done for v1 when a GitHub Pages deployment can be loaded in Canvas via iframe and successfully renders a public audio example with clickable timestamped annotations sourced from a published Google Sheet.