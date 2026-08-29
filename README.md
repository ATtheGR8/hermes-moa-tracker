# MoA Tracker

MoA Tracker is a **Hermes Agent** Desktop plugin that shows a live, in-memory board for Mixture-of-Agents (MoA) runs: labelled advisor and aggregator rows, status (waiting / running / aggregating / done / failed / interrupted), a focused-session status chip, leftover sticky chrome with in/out when `/history` has a matching `turn_id`, and Previous MoA boards fed from sanitized metrics. The live board is driven by session events and does not require a backend; an optional Python metrics hook adds `/current` and `/history` (until that hook is loaded, the UI shows **metrics backend off**). The plugin does not persist advisor content or request snapshots, does not change gateway or core configuration, and is not an official Nous Research product.

## Install

This plugin has no extra Settings knobs. Copy this repository into your Hermes plugins directory as `moa-tracker` (typically `~/.hermes/plugins/moa-tracker`, or the plugins directory for a named profile). Then use the two independent switches below. Desktop on/off does not load Python; the metrics hook does not replace the Desktop toggle.

**Live board (Desktop UI)**

1. **On/off:** Settings → Plugins → MoA Tracker (same toggle).
2. That switch only controls the in-memory board from session events. It does not load Python.

**Metrics hook (`/current` and `/history`)** — Hermes plugin allow-list, not the Desktop toggle.

1. **On:**

   ```bash
   hermes plugins enable moa-tracker
   ```

2. **Off:**

   ```bash
   hermes plugins disable moa-tracker
   ```

3. Same list: `plugins.enabled` in `config.yaml`.
4. Reload the gateway after changing it.
5. Until the hook is loaded, the UI shows **metrics backend off**. The live board still works.

**MoA traces** — Hermes core, not this plugin.

1. Opt-in in `config.yaml` (default off):

   ```yaml
   moa:
     save_traces: true
   ```

2. Do not turn traces on merely to use this tracker.

## Behavior

**Live board.** The title is **Mixture of Advisors**, with the MoA preset name when known. Advisor and aggregator rows are labelled. Status uses waiting / running / aggregating / done / failed / interrupted.

**Sticky board vs chip.** The live board sticks to the last in-memory MoA run when you switch tabs. The status chip follows the **focused** session (`MoA 0/0` on a non-MoA tab).

**Leftover in/out.** Leftover sticky chrome can show in/out when `/history` has a token-active row for that run's `turn_id`. Totals do not persist across a plugin reload. The last run is not restored after reload; the board is in-memory.

**Previous MoA boards.** Lists up to 10 token-active runs from `/history` (coalesced by session + turn). Unmatched in-memory ring cards do not take slots. `0 in / 0 out` is omitted. Coalesced turns may show **N fan-outs**.

**No History list.** There is no History list in the pane. `/history` is still fetched to feed Previous and leftover in/out.

**Mid-turn.** Opened mid-turn, the live board sees later events only; it does not backfill.

**Privacy.** Reference bodies are not shown or stored. A leading `[failed:` marker is used only to mark a reference failed, then the text is discarded. Public metrics JSON uses `references`, not `advisors`. When the hook is on, sanitized metrics persist only as `{home}/moa-tracker/runs.jsonl` under a supplied Hermes home — not advisor text or request snapshots. Plugin HTTP routes do not listen on their own; see [SECURITY.md](SECURITY.md).
