# Changelog

## 1.0.0

First public release of MoA Tracker.

- Live Desktop board for Mixture-of-Agents runs (waiting, running, aggregating, done, failed, interrupted).
- Status chip shows `MoA k/n` for the focused session. The board does not backfill events from earlier in the turn.
- Optional sanitized metrics hook for `/current` and `/history`. The board works without it.
- Reference bodies are not shown or stored. A leading `[failed:` marker marks a failed reference, then the text is discarded.
- Public metrics JSON uses `references`, not `advisors`.
- Metrics persist only as `{home}/moa-tracker/runs.jsonl` under a supplied home. Agent content and request snapshots are not written.
- The last run is not restored across a plugin reload; the board is in-memory.
- Leftover sticky Live chrome can show in/out from a token-active `/history` row for that run's `turn_id`. Totals do not persist across a plugin reload.
- Install: Settings → Plugins → MoA Tracker.
