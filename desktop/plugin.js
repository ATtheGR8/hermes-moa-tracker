import { atom, cn, host, Tip, useQuery, useValue } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'

const trackerState = atom({ runsBySession: {}, focusedId: null, previousRing: [] })
const MAX_REFS = 32
const MAX_PREVIOUS = 10

function currentSessionId() {
  return host.state.focusedSessionId.get() || host.state.activeSessionId.get()
}

function emptyRun(sessionId, previous = []) {
  return {
    open: false,
    sessionId,
    presetName: '',
    turnId: '',
    refsDone: 0,
    refsTotal: 0,
    advisors: [],
    aggregator: '',
    aggregatorState: 'waiting',
    previous
  }
}

function eventSessionId(event) {
  return event && event.session_id ? event.session_id : currentSessionId()
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampRefs(value, fallback = 0) {
  const numeric = numberOr(value, fallback)
  return Math.max(0, Math.min(MAX_REFS, Math.trunc(numeric)))
}

function padWaiting(advisors, total) {
  const next = advisors.slice(0, MAX_REFS)
  const cappedTotal = clampRefs(total)
  while (next.length < cappedTotal) next.push({ label: '', status: 'waiting' })
  return next
}

function metricsCurrentPath(sessionId) {
  return `/current?session_id=${encodeURIComponent(sessionId || '')}`
}

function metricsHistoryPath(limit = 10) {
  const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 10
  return `/history?limit=${normalizedLimit}`
}

function metricsBackendLabel(status) {
  return status === 'on' ? '' : 'metrics backend off'
}

function displayModelLabel(label) {
  if (typeof label !== 'string') return ''
  const separator = label.indexOf(':')
  return separator >= 0 ? label.slice(separator + 1) : label
}

function displayMoaName(runOrUsage) {
  if (!runOrUsage || typeof runOrUsage !== 'object') return ''
  if (typeof runOrUsage.presetName === 'string' && runOrUsage.presetName) return runOrUsage.presetName
  return typeof runOrUsage.model === 'string' && runOrUsage.model ? runOrUsage.model : ''
}

function copyRunIdentity(run, payload) {
  return {
    presetName: typeof payload?.preset === 'string' && payload.preset ? payload.preset : run.presetName,
    turnId: typeof payload?.turn_id === 'string' && payload.turn_id ? payload.turn_id : run.turnId
  }
}

function formatTokenCount(value) {
  const tokens = Math.max(0, numberOr(value, 0))
  if (tokens < 1000) return `${Math.trunc(tokens)}`
  return `${(tokens / 1000).toFixed(1).replace(/\.0$/, '')}k`
}

function formatCost(value) {
  const cost = numberOr(value, 0)
  return cost > 0 ? `$${cost.toFixed(2)}` : ''
}

function sumRunUsage(run) {
  return (Array.isArray(run?.references) ? run.references : []).reduce((total, reference) => {
    const usage = reference && typeof reference === 'object' ? reference.usage : null
    return {
      input_tokens: total.input_tokens + Math.max(0, numberOr(usage?.input_tokens, 0)),
      output_tokens: total.output_tokens + Math.max(0, numberOr(usage?.output_tokens, 0)),
      cost_usd: total.cost_usd + Math.max(0, numberOr(reference?.cost_usd, 0))
    }
  }, { input_tokens: 0, output_tokens: 0, cost_usd: 0 })
}

function formatRunTotals(run) {
  const usage = sumRunUsage(run)
  const totals = `${formatTokenCount(usage.input_tokens)} in / ${formatTokenCount(usage.output_tokens)} out`
  const cost = formatCost(usage.cost_usd)
  return cost ? `${totals} · ${cost}` : totals
}

function fanoutLabel(run) {
  return Number.isInteger(run?.fanouts) && run.fanouts > 1 ? `${run.fanouts} fan-outs` : ''
}

function previousRunUsage(previous, current, liveRun) {
  const runs = Array.isArray(current?.runs) ? current.runs.slice() : []
  if (liveRun?.open) runs.pop()
  const completed = runs
    .filter((entry) => {
      const usage = sumRunUsage(entry)
      return usage.input_tokens > 0 || usage.output_tokens > 0
    })
    .reverse()
  return (Array.isArray(previous) ? previous : []).map((run, index) => ({
    run,
    usage: completed[index] || null
  }))
}

function previousRingUsage(previousRing, metrics, liveRun) {
  const history = Array.isArray(metrics?.history) ? metrics.history : []
  const usedRows = new Set()
  return (Array.isArray(previousRing) ? previousRing : []).map((run) => {
    const sessionId = typeof run?.sessionId === 'string' ? run.sessionId : ''
    const turnId = typeof run?.turnId === 'string' && run.turnId ? run.turnId : ''
    if (!sessionId || (liveRun?.open && liveRun.sessionId === sessionId && liveRun.turnId === turnId)) {
      return { run, usage: null }
    }
    const usage = history.find((entry) => (
      !usedRows.has(entry) &&
      entry?.session_id === sessionId &&
      (!turnId || entry?.turn_id === turnId) &&
      runHasTokenUsage(entry)
    )) || null
    if (usage) usedRows.add(usage)
    return { run, usage }
  })
}

function formatRefRow(reference) {
  const usage = reference && typeof reference === 'object' ? reference.usage : null
  const label = typeof reference?.label === 'string' && reference.label ? reference.label : 'agent'
  const totals = `${formatTokenCount(usage?.input_tokens)}→${formatTokenCount(usage?.output_tokens)}`
  const cost = formatCost(reference?.cost_usd)
  return cost ? `${label}  ${totals}  ${cost}` : `${label}  ${totals}`
}

function refHasActivity(reference) {
  const usage = reference && typeof reference === 'object' ? reference.usage : null
  return numberOr(usage?.input_tokens, 0) > 0 ||
    numberOr(usage?.output_tokens, 0) > 0 ||
    numberOr(reference?.cost_usd, 0) > 0
}

function runHasActivity(run) {
  return (Array.isArray(run?.references) ? run.references : []).some(refHasActivity)
}

function runHasTokenUsage(run) {
  const usage = sumRunUsage(run)
  return usage.input_tokens > 0 || usage.output_tokens > 0
}

function metricsActivityLines(current, history, limit = 10) {
  const maxLines = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 10
  const lines = []
  const currentRun = latestRun(current)
  const currentReferences = Array.isArray(currentRun?.references) ? currentRun.references : []
  if (runHasActivity(currentRun)) {
    for (const reference of currentReferences) {
      if (lines.length >= maxLines) break
      if (refHasActivity(reference)) lines.push({ kind: 'current', text: formatRefRow(reference) })
    }
  }
  return lines.slice(0, maxLines)
}

function latestRun(current) {
  if (!Array.isArray(current?.runs)) return null
  for (let index = current.runs.length - 1; index >= 0; index -= 1) {
    const run = current.runs[index]
    if (run && typeof run === 'object') return run
  }
  return null
}

function latestRunWithTokenUsage(current, sessionId, turnId = '') {
  if (!sessionId || current?.session_id !== sessionId || !Array.isArray(current?.runs)) return null
  for (let index = current.runs.length - 1; index >= 0; index -= 1) {
    const run = current.runs[index]
    if ((!turnId || run?.turn_id === turnId) && runHasTokenUsage(run)) return run
  }
  return null
}

function latestHistoryRunWithTokenUsage(history, sessionId, turnId = '') {
  if (!Array.isArray(history) || !sessionId) return null
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const run = history[index]
    if (run?.session_id === sessionId && (!turnId || run?.turn_id === turnId) && runHasTokenUsage(run)) return run
  }
  return null
}

// Leftover Live in/out uses turn_id-only `/history` join in liveMetricsForBoard.
// Do not add session-id fallbacks. Totals do not persist across plugin reload.
function liveBoardIdle(run) {
  return !run || !run.open || run.aggregatorState === 'done'
}

function liveMetricsForBoard(metrics, run, sessionId) {
  const turnId = typeof run?.turnId === 'string' && run.turnId ? run.turnId : ''
  let exactUsage = null
  if (turnId) {
    const exactHistory = Array.isArray(metrics?.history)
      ? [...metrics.history].reverse().find((hist) => hist?.turn_id === turnId && runHasTokenUsage(hist)) || null
      : null
    exactUsage = latestRunWithTokenUsage(metrics?.current, sessionId, turnId) || exactHistory
  } else {
    const latestCurrent = latestRun(metrics?.current)
    if (metrics?.current?.session_id === sessionId && runHasTokenUsage(latestCurrent)) exactUsage = latestCurrent
  }
  if (exactUsage) return { run: exactUsage, priorTurn: false }
  if (turnId || !liveBoardIdle(run)) return null
  const priorUsage = latestRunWithTokenUsage(metrics?.current, sessionId, '') ||
    latestHistoryRunWithTokenUsage(metrics?.history, sessionId, '')
  return priorUsage ? { run: priorUsage, priorTurn: true } : null
}

function historyRuns(history, current) {
  if (!Array.isArray(history)) return []
  return history
    .filter((run) => run && typeof run === 'object' && (
      !current || run.session_id !== current.session_id || run.turn_id !== current.turn_id
    ))
}

function historySectionRuns(history, current) {
  return historyRuns(history, current)
    .filter((run) => {
      const usage = sumRunUsage(run)
      return usage.input_tokens > 0 || usage.output_tokens > 0
    })
    .slice(0, 10)
}

function previousRows(previousRing, metrics, liveRun) {
  const identity = (run) => {
    const sessionId = typeof run?.sessionId === 'string' ? run.sessionId : run?.session_id
    const turnId = typeof run?.turnId === 'string' ? run.turnId : run?.turn_id
    return typeof sessionId === 'string' && typeof turnId === 'string' ? `${sessionId}\u0000${turnId}` : ''
  }
  const rows = historySectionRuns(metrics?.history, latestRun(metrics?.current))
    .slice(0, MAX_PREVIOUS)
    .map((run) => ({ run, usage: run }))
  const shown = new Set(rows.map(({ run }) => identity(run)).filter(Boolean))
  for (const { run, usage } of previousRingUsage(previousRing, metrics, liveRun)) {
    if (rows.length >= MAX_PREVIOUS) break
    const key = identity(run)
    if (!usage || !key || shown.has(key)) continue
    rows.push({ run, usage })
    shown.add(key)
  }
  return rows
}

function metricsBackendOff() {
  return { status: 'off', current: null, history: [] }
}

function validMetricsCurrent(current) {
  return Boolean(current) && typeof current === 'object' && typeof current.session_id === 'string' && Array.isArray(current.runs)
}

async function fetchMetrics(rest, sessionId) {
  if (typeof rest !== 'function') return metricsBackendOff()
  try {
    const [current, history] = await Promise.all([
      rest(metricsCurrentPath(sessionId)),
      rest(metricsHistoryPath(10))
    ])
    if (!validMetricsCurrent(current) || !Array.isArray(history)) return metricsBackendOff()
    return { status: 'on', current, history }
  } catch (_) {
    return metricsBackendOff()
  }
}

function promoteFirstWaiting(advisors, refsDone, refsTotal) {
  if (refsDone >= refsTotal) return advisors
  const index = advisors.findIndex((advisor) => advisor.status === 'waiting')
  if (index < 0) return advisors
  const next = advisors.slice()
  next[index] = { ...next[index], status: 'running' }
  return next
}

function tooltipLabel(run) {
  if (!run.advisors.length) return `MoA ${run.refsDone}/${run.refsTotal}`
  const advisors = run.advisors.map((advisor, index) => `${displayModelLabel(advisor.label) || `Agent ${index + 1}`}: ${advisor.status}`)
  return [...advisors, `${displayModelLabel(run.aggregator) || 'Aggregator'}: ${run.aggregatorState}`].join('\n')
}

function chipCaption(run) {
  if (!run || !run.open) return 'MoA 0/0'
  return `MoA ${run.refsDone}/${run.refsTotal}`
}

function chipTip(run) {
  if (!run || !run.open) return 'MoA 0/0'
  return tooltipLabel(run)
}

function replaceRun(sessionId, update) {
  if (!sessionId) return
  const state = trackerState.get()
  const previous = state.runsBySession[sessionId] || emptyRun(sessionId)
  const run = update(previous)
  trackerState.set({
    runsBySession: { ...state.runsBySession, [sessionId]: run },
    focusedId: runWasMoA(run) ? sessionId : state.focusedId,
    previousRing: state.previousRing || []
  })
}

function setAdvisorStatus(advisors, label, status) {
  const next = advisors.slice()
  const namedIndex = label ? next.findIndex((advisor) => advisor.label === label) : -1
  const runningIndex = next.findIndex((advisor) => !advisor.label && advisor.status === 'running')
  const waitingIndex = next.findIndex((advisor) => advisor.status === 'waiting')
  const index = namedIndex >= 0 ? namedIndex : runningIndex >= 0 ? runningIndex : waitingIndex
  if (index >= 0) {
    next[index] = { label: label || next[index].label, status }
  }
  return next
}

function applyProgress(run, payload) {
  const refsTotal = clampRefs(payload.refs_total, run.refsTotal)
  const refsDone = clampRefs(payload.refs_done, run.refsDone)
  const isNewFanout = payload.refs_done === 1 || refsTotal !== run.refsTotal
  const current = isNewFanout
    ? { ...emptyRun(run.sessionId, run.previous || []), presetName: run.presetName, turnId: run.turnId }
    : run
  let advisors = current.advisors
  advisors = padWaiting(advisors, refsTotal)
  advisors = setAdvisorStatus(advisors, typeof payload.label === 'string' ? payload.label : '', 'done')
  advisors = promoteFirstWaiting(advisors, refsDone, refsTotal)
  return { ...current, ...copyRunIdentity(current, payload), open: true, refsDone, refsTotal, advisors }
}

function onProgress(event) {
  const sessionId = eventSessionId(event)
  const payload = (event && event.payload) || {}
  replaceRun(sessionId, (run) => applyProgress(run, payload))
}

function onReference(event) {
  const sessionId = eventSessionId(event)
  const payload = (event && event.payload) || {}
  if (typeof payload.text !== 'string' || !payload.text.startsWith('[failed:')) return
  replaceRun(sessionId, (run) => {
    const refsTotal = clampRefs(run.refsTotal || payload.count, run.refsTotal)
    let advisors = padWaiting(run.advisors, refsTotal)
    const label = typeof payload.label === 'string' ? payload.label : ''
    if (label) {
      advisors = setAdvisorStatus(advisors, label, 'failed')
    } else if (typeof payload.index === 'number' && payload.index >= 0 && payload.index < advisors.length) {
      advisors[payload.index] = { ...advisors[payload.index], status: 'failed' }
    } else {
      advisors = setAdvisorStatus(advisors, '', 'failed')
    }
    return { ...run, open: true, refsTotal, advisors }
  })
}

function onPhase(event) {
  const sessionId = eventSessionId(event)
  const payload = (event && event.payload) || {}
  if (payload.phase !== 'aggregator') return
  replaceRun(sessionId, (run) => ({
    ...run,
    ...copyRunIdentity(run, payload),
    open: true,
    aggregator: typeof payload.aggregator === 'string' ? payload.aggregator : run.aggregator,
    aggregatorState: 'aggregating'
  }))
}

function onAggregating(event) {
  const sessionId = eventSessionId(event)
  const payload = (event && event.payload) || {}
  replaceRun(sessionId, (run) => ({
    ...run,
    ...copyRunIdentity(run, payload),
    open: true,
    aggregator: typeof payload.aggregator === 'string' ? payload.aggregator : run.aggregator,
    aggregatorState: 'aggregating'
  }))
}

function runWasMoA(run) {
  return Boolean(run?.open) && (
    run.advisors.length > 0 || run.refsTotal > 0 || Boolean(run.aggregator)
  )
}

function snapshotRun(run) {
  return {
    advisors: run.advisors,
    aggregator: run.aggregator,
    aggregatorState: run.aggregatorState,
    refsDone: run.refsDone,
    refsTotal: run.refsTotal,
    presetName: run.presetName,
    turnId: run.turnId
  }
}

function pushPreviousRing(previousRing, run) {
  const ring = Array.isArray(previousRing) ? previousRing : []
  if (!runWasMoA(run)) return ring
  return [{ ...snapshotRun(run), sessionId: run.sessionId }, ...ring].slice(0, MAX_PREVIOUS)
}

function applyTurnBoundary(run) {
  const previous = runWasMoA(run)
    ? [snapshotRun(run), ...(run.previous || [])].slice(0, MAX_PREVIOUS)
    : (run.previous || [])
  return emptyRun(run.sessionId, previous)
}

function onMessageStart(event) {
  const sessionId = eventSessionId(event)
  if (!sessionId || sessionId !== currentSessionId()) return
  const state = trackerState.get()
  const run = state.runsBySession[sessionId] || emptyRun(sessionId)
  trackerState.set({
    runsBySession: { ...state.runsBySession, [sessionId]: applyTurnBoundary(run) },
    focusedId: runWasMoA(run) ? sessionId : state.focusedId,
    previousRing: pushPreviousRing(state.previousRing, run)
  })
}

function applyComplete(run, payload) {
  if (!run.open && run.refsTotal === 0 && run.advisors.length === 0 && !run.aggregator) return run
  const refsIncomplete = run.refsDone < run.refsTotal
  const interrupted = payload.status === 'error' || refsIncomplete
  if (interrupted) {
    return {
      ...run,
      open: true,
      advisors: run.advisors.map((advisor) => (
        advisor.status === 'waiting' || advisor.status === 'running'
          ? { ...advisor, status: 'interrupted' }
          : advisor
      )),
      aggregatorState: run.aggregatorState === 'waiting' || run.aggregatorState === 'aggregating'
        ? 'interrupted'
        : run.aggregatorState
    }
  }
  return {
    ...run,
    open: true,
    aggregatorState: run.aggregatorState === 'aggregating' ? 'done' : run.aggregatorState
  }
}

function onMessageComplete(event) {
  const sessionId = eventSessionId(event)
  const payload = (event && event.payload) || {}
  replaceRun(sessionId, (run) => applyComplete(run, payload))
}

function onSessionInfo(event) {
  const sessionId = eventSessionId(event)
  const payload = (event && event.payload) || {}
  if (payload.running !== false) return
  replaceRun(sessionId, (run) => {
    const hasPendingAdvisor = run.advisors.some((advisor) => advisor.status === 'waiting' || advisor.status === 'running')
    const aggregatorPending = run.aggregatorState === 'waiting' || run.aggregatorState === 'aggregating'
    if (!run.open || (!hasPendingAdvisor && !aggregatorPending)) return run
    return applyComplete(run, { status: 'error' })
  })
}

function selectedRun(state, focusedId, activeId) {
  const sessionId = focusedId || activeId
  return sessionId ? state.runsBySession[sessionId] : null
}

function liveBoardRun(state, focusedId, activeId) {
  if (!state || typeof state !== 'object') return null
  const focusedRun = selectedRun(state, focusedId, activeId)
  const stickyRun = state.focusedId ? state.runsBySession[state.focusedId] : null
  if (focusedRun?.open && runWasMoA(focusedRun)) return focusedRun
  return stickyRun || focusedRun
}

function statusStyle(status) {
  if (status === 'done') return { fontSize: '12px' }
  return {
    color: status === 'aggregating' || status === 'running'
      ? 'var(--ui-cyan)'
      : status === 'failed'
        ? 'var(--ui-red)'
        : status === 'interrupted'
          ? 'var(--ui-orange)'
          : 'var(--ui-text-tertiary)',
    fontSize: '12px'
  }
}

function statusClassName(status) {
  return status === 'done' ? 'text-emerald-500/80' : undefined
}

const advisorLineStyle = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  whiteSpace: 'normal',
  textOverflow: 'clip',
  fontSize: '12px',
  color: 'var(--ui-text-tertiary)'
}

function AdvisorRow({ advisor, index }) {
  const label = displayModelLabel(advisor.label) || `Agent ${index + 1}`
  return jsxs('div', {
    style: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', borderBottom: '1px solid var(--ui-stroke-secondary)' },
    children: [
      jsx('span', { style: { color: 'var(--ui-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: `Agent: ${label}` }),
      jsx('span', { className: statusClassName(advisor.status), style: statusStyle(advisor.status), children: advisor.status })
    ]
  })
}

function AggregatorRow({ run }) {
  const label = displayModelLabel(run.aggregator) || 'Aggregator'
  return jsxs('div', {
    style: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderBottom: '1px solid var(--ui-stroke-secondary)' },
    children: [
      jsx('span', { style: { color: 'var(--ui-text-secondary)' }, children: `Aggregator: ${label}` }),
      jsx('span', { className: statusClassName(run.aggregatorState), style: statusStyle(run.aggregatorState), children: run.aggregatorState })
    ]
  })
}

function PreviousRuns({ previousRing, metrics, liveRun }) {
  const rows = previousRows(previousRing, metrics, liveRun)
  if (!rows.length) return null
  return jsxs('div', {
    style: { marginTop: '14px' },
    children: [
      jsx('div', { style: { color: 'var(--ui-text-tertiary)', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }, children: 'Previous MoA boards' }),
      ...rows.map(({ run: previousRun, usage }, index) => {
        const fromHistory = Array.isArray(previousRun?.references)
        const name = fromHistory
          ? displayMoaName(previousRun)
          : displayMoaName({ presetName: previousRun?.presetName, model: usage?.model })
        const advisors = (fromHistory
          ? previousRun.references
          : (Array.isArray(previousRun?.advisors) ? previousRun.advisors : [])
        )
          .map((advisor, advisorIndex) => displayModelLabel(advisor?.model || advisor?.label) || `Agent ${advisorIndex + 1}`)
          .join(' · ')
        const lastReference = fromHistory && Array.isArray(previousRun?.references)
          ? previousRun.references[previousRun.references.length - 1]
          : null
        const aggregator = displayModelLabel(previousRun?.aggregator || lastReference?.model || usage?.model) || (!fromHistory ? 'Aggregator' : '')
        const aggregatorState = typeof previousRun?.aggregatorState === 'string' && previousRun.aggregatorState
          ? previousRun.aggregatorState
          : ''
        const fanouts = fromHistory ? fanoutLabel(previousRun) : ''
        return jsxs('div', {
          style: { borderTop: '1px solid var(--ui-stroke-secondary)', padding: '7px 0' },
          children: [
            jsx('div', { style: { color: 'var(--ui-text-secondary)', fontSize: '12px' }, children: fromHistory ? `${name ? `MoA: ${name}` : 'MoA'}${fanouts ? ` · ${fanouts}` : ''}` : (name ? `MoA: ${name} ${previousRun.refsDone}/${previousRun.refsTotal}` : `MoA ${previousRun.refsDone}/${previousRun.refsTotal}`) }),
            advisors ? jsx('div', { style: advisorLineStyle, children: `Agent: ${advisors}` }) : null,
            aggregator ? jsx('div', { className: statusClassName(aggregatorState), style: statusStyle(aggregatorState), children: `Aggregator: ${aggregator}${aggregatorState ? `: ${aggregatorState}` : ''}` }) : null,
            usage ? jsx('div', { style: { color: 'var(--ui-text-quaternary)', fontSize: '12px' }, children: formatRunTotals(usage) }) : null
          ]
        }, `previous:${index}`)
      })
    ]
  })
}

function TrackerPane({ rest }) {
  const state = useValue(trackerState)
  const focusedId = useValue(host.state.focusedSessionId)
  const activeId = useValue(host.state.activeSessionId)
  const focusedSessionId = focusedId || activeId || ''
  const run = liveBoardRun(state, focusedId, activeId)
  const metricsSessionId = run?.sessionId || focusedSessionId
  const metricsQuery = useQuery({
    queryKey: ['moa-tracker', 'metrics', metricsSessionId],
    queryFn: () => fetchMetrics(rest, metricsSessionId),
    retry: false,
    refetchInterval: 15000
  }) || {}
  const metrics = metricsQuery.data
  const status = metrics?.status || 'off'
  const liveMetrics = liveMetricsForBoard(metrics, run, metricsSessionId)
  const liveMetricsRun = liveMetrics?.run || null
  const liveName = liveMetrics?.priorTurn
    ? (typeof run?.presetName === 'string' ? run.presetName : '')
    : displayMoaName({ presetName: run?.presetName, model: liveMetricsRun?.model })
  const liveTotals = runHasTokenUsage(liveMetricsRun)
    ? `${formatRunTotals(liveMetricsRun)}${liveMetrics?.priorTurn ? ' · prior turn' : ''}`
    : ''
  const backendLabel = metricsBackendLabel(status)
  const metricsChildren = backendLabel
    ? [jsx('div', {
      style: { color: 'var(--ui-text-tertiary)', fontSize: '12px', marginBottom: '5px' },
      children: backendLabel
    })]
    : []
  if (status === 'on') {
    metricsChildren.push(...metricsActivityLines(metrics.current, metrics.history).map((line, index) => jsx('div', {
      style: {
        color: 'var(--ui-text-quaternary)',
        fontSize: '12px',
        padding: '3px 0'
      },
      children: line.text
    }, `metrics-activity:${index}`)))
  }
  const metricsPanel = jsxs('div', { children: metricsChildren })
  const previousPanel = PreviousRuns({ previousRing: state.previousRing, metrics, liveRun: run })
  if (!run || !run.open) {
    return jsxs('div', {
      style: { padding: '14px', color: 'var(--ui-text-tertiary)' },
      children: [
        jsx('div', { children: 'Waiting for MoA activity in this session.' }),
        liveTotals ? jsx('div', { style: { color: 'var(--ui-text-quaternary)', fontSize: '12px', padding: '3px 0' }, children: liveTotals }) : null,
        previousPanel,
        metricsPanel
      ]
    })
  }
  const rows = run.advisors.map((advisor, index) => jsx(AdvisorRow, { advisor, index }, `${advisor.label}:${index}`))
  return jsxs('div', {
    style: { padding: '14px', color: 'var(--ui-text-secondary)' },
    children: [
      jsx('div', { style: { color: 'var(--ui-text-secondary)', fontWeight: '600', marginBottom: '5px' }, children: liveName ? `Mixture of Agents · ${liveName}` : 'Mixture of Agents' }),
      jsx('div', { style: { color: 'var(--ui-text-tertiary)', fontSize: '12px', marginBottom: '10px' }, children: `refs completed ${run.refsDone}/${run.refsTotal}` }),
      rows.length ? jsx('div', { children: rows }) : jsx('div', { style: { color: 'var(--ui-text-quaternary)', padding: '7px 0' }, children: 'No agent references yet.' }),
      jsx(AggregatorRow, { run }),
      liveTotals ? jsx('div', { style: { color: 'var(--ui-text-quaternary)', fontSize: '12px', padding: '3px 0' }, children: liveTotals }) : null,
      metricsPanel,
      previousPanel
    ]
  })
}

function StatusChip() {
  const state = useValue(trackerState)
  const focusedId = useValue(host.state.focusedSessionId)
  const activeId = useValue(host.state.activeSessionId)
  const run = selectedRun(state, focusedId, activeId)
  return jsx(Tip, {
    label: chipTip(run),
    children: jsx('button', {
      type: 'button',
      onClick: () => host.navigate('/moa-tracker'),
      className: cn('inline-flex h-full items-center gap-1 px-1.5 text-[0.6875rem] text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'),
      children: chipCaption(run)
    })
  })
}

export default {
  id: 'moa-tracker',
  name: 'MoA Tracker',
  defaultEnabled: false,
  register(ctx) {
    ctx.i18n.register({ en: { /* ... */ } })
    ctx.onDispose(host.onEvent('moa.progress', onProgress))
    ctx.onDispose(host.onEvent('moa.phase', onPhase))
    ctx.onDispose(host.onEvent('moa.reference', onReference))
    ctx.onDispose(host.onEvent('moa.aggregating', onAggregating))
    ctx.onDispose(host.onEvent('message.start', onMessageStart))
    ctx.onDispose(host.onEvent('message.complete', onMessageComplete))
    ctx.onDispose(host.onEvent('session.info', onSessionInfo))

    ctx.register({
      id: 'pane',
      area: 'panes',
      title: 'MoA Tracker',
      data: { placement: 'right', width: '280px' },
      render: () => jsx(TrackerPane, { rest: ctx.rest })
    })
    ctx.register({
      id: 'chip',
      area: 'statusBar.right',
      order: 80,
      data: {
        id: 'moa-tracker',
        toggleLabel: 'MoA',
        render: () => jsx(StatusChip, {})
      }
    })
    ctx.register({
      id: 'page',
      area: 'routes',
      data: { path: '/moa-tracker' },
      render: () => jsx(TrackerPane, { rest: ctx.rest })
    })
    ctx.register({
      id: 'nav',
      area: 'sidebar.nav',
      order: 50,
      data: { codicon: 'graph', label: 'MoA', path: '/moa-tracker' }
    })
    ctx.register({
      id: 'open',
      area: 'palette',
      data: {
        id: 'moa-tracker.open',
        label: 'MoA: Open tracker',
        keywords: ['moa', 'mixture', 'agents'],
        run: () => host.navigate('/moa-tracker')
      }
    })
  }
}
