import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pluginPath = path.join(here, '..', 'desktop', 'plugin.js')
const source = fs.readFileSync(pluginPath, 'utf8')
assert.ok(!source.includes('function HistorySection'), 'HistorySection must remain removed from the tracker UI source')
const executable = source
  .replace(/^import .*\n/gm, '')
  .replace(/\nexport default[\s\S]*$/, '\n')
  .concat('\nthis.__helpers = { emptyRun: typeof emptyRun === \'undefined\' ? undefined : emptyRun, runWasMoA: typeof runWasMoA === \'undefined\' ? undefined : runWasMoA, snapshotRun: typeof snapshotRun === \'undefined\' ? undefined : snapshotRun, padWaiting, metricsCurrentPath, metricsHistoryPath, metricsBackendLabel: typeof metricsBackendLabel === \'undefined\' ? undefined : metricsBackendLabel, formatTokenCount: typeof formatTokenCount === \'undefined\' ? undefined : formatTokenCount, formatCost: typeof formatCost === \'undefined\' ? undefined : formatCost, sumRunUsage: typeof sumRunUsage === \'undefined\' ? undefined : sumRunUsage, formatRunTotals: typeof formatRunTotals === \'undefined\' ? undefined : formatRunTotals, formatRefRow: typeof formatRefRow === \'undefined\' ? undefined : formatRefRow, refHasActivity: typeof refHasActivity === \'undefined\' ? undefined : refHasActivity, runHasActivity: typeof runHasActivity === \'undefined\' ? undefined : runHasActivity, latestRun: typeof latestRun === \'undefined\' ? undefined : latestRun, latestRunWithTokenUsage: typeof latestRunWithTokenUsage === \'undefined\' ? undefined : latestRunWithTokenUsage, liveMetricsForBoard: typeof liveMetricsForBoard === \'undefined\' ? undefined : liveMetricsForBoard, latestHistoryRunWithTokenUsage: typeof latestHistoryRunWithTokenUsage === \'undefined\' ? undefined : latestHistoryRunWithTokenUsage, historyRuns: typeof historyRuns === \'undefined\' ? undefined : historyRuns, historySectionRuns: typeof historySectionRuns === \'undefined\' ? undefined : historySectionRuns, metricsActivityLines: typeof metricsActivityLines === \'undefined\' ? undefined : metricsActivityLines, fetchMetrics: typeof fetchMetrics === \'undefined\' ? undefined : fetchMetrics, displayModelLabel: typeof displayModelLabel === \'undefined\' ? undefined : displayModelLabel, displayMoaName: typeof displayMoaName === \'undefined\' ? undefined : displayMoaName, previousRunUsage: typeof previousRunUsage === \'undefined\' ? undefined : previousRunUsage, previousRingUsage: typeof previousRingUsage === \'undefined\' ? undefined : previousRingUsage, previousRows: typeof previousRows === \'undefined\' ? undefined : previousRows, pushPreviousRing: typeof pushPreviousRing === \'undefined\' ? undefined : pushPreviousRing, AdvisorRow: typeof AdvisorRow === \'undefined\' ? undefined : AdvisorRow, AggregatorRow: typeof AggregatorRow === \'undefined\' ? undefined : AggregatorRow, PreviousRuns: typeof PreviousRuns === \'undefined\' ? undefined : PreviousRuns, TrackerPane: typeof TrackerPane === \'undefined\' ? undefined : TrackerPane, promoteFirstWaiting, setAdvisorStatus, applyProgress: typeof applyProgress === \'undefined\' ? undefined : applyProgress, applyTurnBoundary: typeof applyTurnBoundary === \'undefined\' ? undefined : applyTurnBoundary, applyComplete: typeof applyComplete === \'undefined\' ? undefined : applyComplete, selectedRun: typeof selectedRun === \'undefined\' ? undefined : selectedRun, liveBoardRun: typeof liveBoardRun === \'undefined\' ? undefined : liveBoardRun, statusClassName: typeof statusClassName === \'undefined\' ? undefined : statusClassName, onReference, onPhase, onAggregating, onMessageStart, trackerState, tooltipLabel, chipCaption, chipTip };\n')
const sandbox = {
  atom: (initial) => {
    let value = initial
    return { get: () => value, set: (next) => { value = next } }
  },
  host: {
    state: {
      focusedSessionId: { get: () => sandbox.focusedSessionId || 'focused-s1' },
      activeSessionId: { get: () => 'active-s1' }
    }
  },
  useValue: (source) => source.get(),
  useQuery: (config) => {
    sandbox.lastQuery = config
    return sandbox.queryResult
  },
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props })
}
vm.runInNewContext(executable, sandbox, { filename: pluginPath })
const { emptyRun, runWasMoA, snapshotRun, padWaiting, promoteFirstWaiting, setAdvisorStatus, applyProgress, applyTurnBoundary, applyComplete, selectedRun, liveBoardRun, statusClassName, onReference, onPhase, onAggregating, onMessageStart, trackerState, tooltipLabel, chipCaption, chipTip, metricsCurrentPath, metricsHistoryPath, metricsBackendLabel, formatTokenCount, formatCost, sumRunUsage, formatRunTotals, formatRefRow, refHasActivity, runHasActivity, latestRun, latestRunWithTokenUsage, latestHistoryRunWithTokenUsage, liveMetricsForBoard, historyRuns, historySectionRuns, metricsActivityLines, fetchMetrics, displayModelLabel, displayMoaName, previousRunUsage, previousRingUsage, previousRows, pushPreviousRing, AdvisorRow, AggregatorRow, PreviousRuns, TrackerPane } = sandbox.__helpers
const plain = (value) => JSON.parse(JSON.stringify(value))
const textContent = (node) => {
  if (typeof node === 'string') return [node]
  if (Array.isArray(node)) return node.flatMap(textContent)
  return node && typeof node === 'object' ? textContent(node.props && node.props.children) : []
}

{
  assert.equal(metricsCurrentPath('session /?'), '/current?session_id=session%20%2F%3F')
  assert.equal(metricsCurrentPath(), '/current?session_id=')
  assert.equal(metricsHistoryPath(), '/history?limit=10')
  assert.equal(metricsHistoryPath(4.8), '/history?limit=4')
  assert.equal(metricsBackendLabel('off'), 'metrics backend off')
  assert.equal(metricsBackendLabel('on'), '')
}

{
  assert.equal(typeof displayModelLabel, 'function')
  assert.equal(displayModelLabel('xai:grok-4[reasoning=high]'), 'grok-4[reasoning=high]')
  assert.equal(displayModelLabel('openai:gpt-5'), 'gpt-5')
  assert.equal(displayModelLabel('model-without-provider'), 'model-without-provider')
  assert.equal(displayModelLabel(''), '')
  assert.equal(statusClassName('done'), 'text-emerald-500/80')
  assert.equal(statusClassName('waiting'), undefined)

  const previous = [{ id: 'newest' }, { id: 'middle' }, { id: 'unmatched' }]
  const current = {
    runs: [
      { references: [{ usage: { input_tokens: 100, output_tokens: 0 } }] },
      { references: [{ usage: { input_tokens: 0, output_tokens: 0 } }] },
      { references: [{ usage: { input_tokens: 2000, output_tokens: 500 } }] },
      { references: [{ usage: { input_tokens: 3000, output_tokens: 700 } }] }
    ]
  }
  const usage = previousRunUsage(previous, current, { open: true })
  assert.equal(usage.length, 3)
  assert.equal(formatRunTotals(usage[0].usage), '2k in / 500 out')
  assert.equal(formatRunTotals(usage[1].usage), '100 in / 0 out')
  assert.equal(usage[2].usage, null)
}

{
  const run = {
    session_id: 'private-session',
    turn_id: 'private-turn',
    references: [
      { label: 'Alpha', usage: { input_tokens: 4200, output_tokens: 1100 }, cost_usd: 0.04 },
      { label: 'Beta', usage: { input_tokens: 8200, output_tokens: 2000 }, cost_usd: 0.08 },
      { usage: { input_tokens: Number.NaN, output_tokens: Infinity }, cost_usd: 'bad' }
    ]
  }
  assert.equal(formatTokenCount(12400), '12.4k')
  assert.equal(formatTokenCount(1000), '1k')
  assert.equal(formatTokenCount(3100), '3.1k')
  assert.equal(formatTokenCount(999), '999')
  assert.equal(formatTokenCount(Number.NaN), '0')
  assert.equal(formatCost(0.12), '$0.12')
  assert.equal(formatCost(1), '$1.00')
  assert.equal(formatCost(0), '')
  assert.equal(formatCost(Infinity), '')
  assert.deepEqual(plain(sumRunUsage(run)), { input_tokens: 12400, output_tokens: 3100, cost_usd: 0.12 })
  assert.equal(formatRunTotals(run), '12.4k in / 3.1k out · $0.12')
  assert.equal(formatRefRow(run.references[0]), 'Alpha  4.2k→1.1k  $0.04')
  assert.equal(formatRefRow({ usage: {} }), 'agent  0→0')
  assert.equal(formatRunTotals({ references: [] }), '0 in / 0 out')
  assert.equal(latestRun({ runs: [null, run] }), run)
  assert.equal(latestRun({ runs: [] }), null)
  assert.equal(latestRun({}), null)

  const history = [run, { session_id: 'private-session', turn_id: 'private-turn', references: [] }, ...Array.from({ length: 10 }, (_, index) => ({ session_id: `history-${index}`, turn_id: `turn-${index}`, references: [] }))]
  const visibleHistory = historyRuns(history, run)
  assert.equal(visibleHistory.length, 10)
  assert.equal(visibleHistory[0], history[2])
  assert.deepEqual(plain(historyRuns({}, run)), [])

  const activeHistory = { session_id: 'history-active', turn_id: 'active', references: [{ usage: { input_tokens: 1000, output_tokens: 2000 } }] }
  const inactiveHistory = { session_id: 'history-empty', turn_id: 'empty', references: [] }
  const costOnlyHistory = { session_id: 'history-cost', turn_id: 'cost', references: [{ usage: {}, cost_usd: 0.01 }] }
  assert.equal(typeof historySectionRuns, 'function')
  assert.deepEqual(plain(historySectionRuns([run, inactiveHistory, costOnlyHistory, activeHistory], run)), [activeHistory])
}

{
  const zeroRef = { label: 'Zero', usage: { input_tokens: 0, output_tokens: 0 }, cost_usd: 0 }
  const activeRef = { label: 'Alpha', usage: { input_tokens: 4200, output_tokens: 1100 }, cost_usd: 0.04 }
  const activeRun = { session_id: 'current', turn_id: 'turn', references: [zeroRef, activeRef] }
  assert.equal(typeof refHasActivity, 'function')
  assert.equal(typeof runHasActivity, 'function')
  assert.equal(typeof metricsActivityLines, 'function')
  assert.equal(refHasActivity(zeroRef), false)
  assert.equal(refHasActivity({ usage: { input_tokens: Infinity, output_tokens: Number.NaN }, cost_usd: 'bad' }), false)
  assert.equal(refHasActivity({ usage: { input_tokens: 1 }, cost_usd: 0 }), true)
  assert.equal(refHasActivity({ usage: { output_tokens: 1 }, cost_usd: 0 }), true)
  assert.equal(refHasActivity({ usage: {}, cost_usd: 0.01 }), true)
  assert.equal(runHasActivity({ references: [zeroRef] }), false)
  assert.equal(runHasActivity(activeRun), true)
  assert.deepEqual(plain(metricsActivityLines(null, null)), [])

  const lines = metricsActivityLines(
    { session_id: 'current', runs: [{ references: [zeroRef] }, activeRun] },
    [
      { session_id: 'current', turn_id: 'turn', references: [activeRef] },
      { session_id: 'empty-history', turn_id: 'zero', references: [zeroRef] },
      { session_id: 'history', turn_id: 'active', references: [{ label: 'History', usage: { input_tokens: 1000, output_tokens: 2000 }, cost_usd: 0.01 }] }
    ]
  )
  assert.deepEqual(plain(lines), [
    { kind: 'current', text: 'Alpha  4.2k→1.1k  $0.04' }
  ])
  assert.ok(!lines.some((line) => line.text.startsWith('current ')))

  const budgetLines = metricsActivityLines(
    { session_id: 'current', runs: [{ session_id: 'current', turn_id: 'budget', references: [{ label: 'Current', usage: { input_tokens: 1, output_tokens: 0 }, cost_usd: 0 }] }] },
    Array.from({ length: 11 }, (_, index) => ({
      session_id: `history-${index}`,
      turn_id: `turn-${index}`,
      references: [{ label: `History ${index}`, usage: { input_tokens: 1, output_tokens: 0 }, cost_usd: 0 }]
    }))
  )
  assert.equal(budgetLines.length, 1)
  assert.equal(budgetLines.filter((line) => line.kind === 'current').length, 1)
  assert.equal(budgetLines.filter((line) => line.kind === 'previous').length, 0)
}

{
  const run = (sessionId, inputTokens) => ({
    open: true,
    sessionId,
    refsDone: 1,
    refsTotal: 1,
    advisors: [{ label: `${sessionId}:advisor`, status: 'done' }],
    aggregator: `${sessionId}:aggregator`,
    aggregatorState: 'done',
    references: [{ usage: { input_tokens: inputTokens, output_tokens: 0 } }]
  })
  assert.equal(typeof pushPreviousRing, 'function')
  assert.equal(typeof previousRingUsage, 'function')
  const ring = pushPreviousRing([], run('session-a', 1))
  assert.equal(ring[0].sessionId, 'session-a')
  assert.equal(ring[0].aggregator, 'session-a:aggregator')
  assert.equal(pushPreviousRing(ring, emptyRun('session-empty')).length, 1)
  assert.equal(Array.from({ length: 11 }, (_, index) => run(`session-${index}`, index + 1)).reduce(pushPreviousRing, []).length, 10)

  const usage = previousRingUsage([
    { ...snapshotRun(run('session-a', 1)), sessionId: 'session-a' },
    { ...snapshotRun(run('session-b', 1)), sessionId: 'session-b' },
    { ...snapshotRun(run('session-a', 1)), sessionId: 'session-a' }
  ], {
    current: {
      session_id: 'session-b',
      runs: [
        { references: [{ usage: { input_tokens: 10, output_tokens: 0 } }] },
        { references: [{ usage: { input_tokens: 999, output_tokens: 0 } }] }
      ]
    },
    history: [
      { session_id: 'session-a', references: [{ usage: { input_tokens: 300, output_tokens: 0 } }] },
      { session_id: 'other-session', references: [{ usage: { input_tokens: 700, output_tokens: 0 } }] },
      { session_id: 'session-a', references: [{ usage: { input_tokens: 100, output_tokens: 0 } }] }
    ]
  }, { open: true, sessionId: 'session-b' })
  assert.deepEqual(plain(usage.map((entry) => entry.usage && sumRunUsage(entry.usage).input_tokens)), [300, null, 100], 'Previous cards use only matching History rows, never current or other-session rows')

  sandbox.focusedSessionId = 'session-a'
  trackerState.set({
    focusedId: 'session-a',
    previousRing: [],
    runsBySession: {
      'session-a': run('session-a', 1),
      'session-b': run('session-b', 1)
    }
  })
  onMessageStart({ session_id: 'session-a' })
  sandbox.focusedSessionId = 'session-b'
  onMessageStart({ session_id: 'session-b' })
  assert.deepEqual(plain(trackerState.get().previousRing.map((entry) => entry.sessionId)), ['session-b', 'session-a'])
  sandbox.focusedSessionId = ''
}

const offMetrics = { status: 'off', current: null, history: [] }

{
  assert.equal(typeof fetchMetrics, 'function')
  assert.deepEqual(plain(await fetchMetrics()), offMetrics)
  assert.deepEqual(plain(await fetchMetrics('not a function', 's1')), offMetrics)
}

{
  assert.deepEqual(plain(await fetchMetrics(() => { throw new Error('offline') }, 's1')), offMetrics)
  assert.deepEqual(plain(await fetchMetrics(async () => Promise.reject(new Error('offline')), 's1')), offMetrics)
}

{
  assert.deepEqual(plain(await fetchMetrics(async (requestPath) => (
    requestPath === metricsCurrentPath('s1') ? { session_id: 's1', runs: {} } : []
  ), 's1')), offMetrics)
  assert.deepEqual(plain(await fetchMetrics(async (requestPath) => (
    requestPath === metricsCurrentPath('s1') ? { runs: [] } : []
  ), 's1')), offMetrics)
  assert.deepEqual(plain(await fetchMetrics(async (requestPath) => (
    requestPath === metricsCurrentPath('s1') ? { session_id: 's1', runs: [] } : {}
  ), 's1')), offMetrics)
}

{
  const current = { session_id: 's1', runs: [{ model: 'alpha', references: [] }] }
  const history = [{ session_id: 's0', turn_id: 't0', model: 'beta', references: ['r1'] }]
  const requests = []
  const result = await fetchMetrics(async (requestPath) => {
    requests.push(requestPath)
    return requestPath === metricsCurrentPath('s1') ? current : history
  }, 's1')
  assert.deepEqual(plain(result), { status: 'on', current, history })
  assert.deepEqual(requests, [metricsCurrentPath('s1'), metricsHistoryPath(10)], 'fetchMetrics requests ten history rows')
}

{
  const advisors = [
    { label: 'Alpha', status: 'done' },
    { label: '', status: 'waiting' },
    { label: 'Gamma', status: 'waiting' }
  ]
  const next = promoteFirstWaiting(advisors, 1, 3)
  assert.deepEqual(plain(next), [
    { label: 'Alpha', status: 'done' },
    { label: '', status: 'running' },
    { label: 'Gamma', status: 'waiting' }
  ])
  assert.deepEqual(advisors, [
    { label: 'Alpha', status: 'done' },
    { label: '', status: 'waiting' },
    { label: 'Gamma', status: 'waiting' }
  ])
}

{
  const advisors = [{ label: 'Alpha', status: 'done' }, { label: '', status: 'waiting' }]
  assert.deepEqual(plain(promoteFirstWaiting(advisors, 2, 2)), advisors)
}

{
  const advisors = [
    { label: 'Alpha', status: 'done' },
    { label: '', status: 'running' }
  ]
  assert.deepEqual(plain(setAdvisorStatus(advisors, 'Beta', 'done')), [
    { label: 'Alpha', status: 'done' },
    { label: 'Beta', status: 'done' }
  ])
  assert.equal(setAdvisorStatus(advisors, 'Beta', 'done').length, 2)
}

{
  const advisors = [
    { label: 'Alpha', status: 'done' },
    { label: 'Beta', status: 'done' }
  ]
  assert.deepEqual(plain(setAdvisorStatus(advisors, 'Gamma', 'done')), advisors)
}

{
  trackerState.set({
    focusedId: 'session-1',
    runsBySession: {
      'session-1': {
        open: true,
        sessionId: 'session-1',
        refsDone: 1,
        refsTotal: 2,
        advisors: [
          { label: 'Alpha', status: 'done' },
          { label: '', status: 'waiting' }
        ],
        aggregator: '',
        aggregatorState: 'waiting'
      }
    }
  })
  onReference({
    session_id: 'session-1',
    payload: { text: '[failed: unavailable]', count: 2, index: 2 }
  })
  assert.equal(trackerState.get().runsBySession['session-1'].advisors.length, 2)
}

{
  assert.equal(typeof applyProgress, 'function')
  const initial = {
    open: false,
    refsDone: 0,
    refsTotal: 0,
    advisors: [],
    aggregator: '',
    aggregatorState: 'waiting'
  }
  const afterAlpha = applyProgress(initial, { refs_total: 2, refs_done: 1, label: 'Alpha' })
  const afterBeta = applyProgress(afterAlpha, { refs_total: 2, refs_done: 2, label: 'Beta' })
  assert.deepEqual(plain(afterBeta.advisors), [
    { label: 'Alpha', status: 'done' },
    { label: 'Beta', status: 'done' }
  ])
  assert.equal(afterBeta.advisors.length, 2)
}

{
  const initial = {
    open: false,
    sessionId: 'session-1',
    refsDone: 0,
    refsTotal: 0,
    advisors: [],
    aggregator: '',
    aggregatorState: 'waiting'
  }
  const capped = applyProgress(initial, { refs_total: 33, refs_done: 33, label: 'Alpha' })
  assert.equal(capped.refsTotal, 32)
  assert.equal(capped.refsDone, 32)
  assert.equal(capped.advisors.length, 32)
  assert.equal(padWaiting(Array.from({ length: 40 }, () => ({ label: '', status: 'waiting' })), 40).length, 32)
}

{
  const initial = {
    open: false,
    sessionId: 'session-1',
    refsDone: 0,
    refsTotal: 0,
    advisors: [],
    aggregator: '',
    aggregatorState: 'waiting'
  }
  const invalid = applyProgress(initial, { refs_total: -1, refs_done: Number.NaN, label: 'Alpha' })
  assert.equal(invalid.refsTotal, 0)
  assert.equal(invalid.refsDone, 0)
  assert.equal(invalid.advisors.length, 0)
}

{
  assert.equal(typeof applyTurnBoundary, 'function')
  const previous = {
    open: true,
    sessionId: 'session-1',
    refsDone: 2,
    refsTotal: 2,
    advisors: [
      { label: 'Old Alpha', status: 'done' },
      { label: 'Old Beta', status: 'done' }
    ],
    aggregator: 'Old Synthesizer',
    aggregatorState: 'done'
  }
  const newRun = applyTurnBoundary(previous)
  const afterNewFirst = applyProgress(newRun, { refs_total: 2, refs_done: 1, label: 'New Alpha' })
  const afterNewSecond = applyProgress(afterNewFirst, { refs_total: 2, refs_done: 2, label: 'New Beta' })
  assert.deepEqual(plain(afterNewSecond.advisors), [
    { label: 'New Alpha', status: 'done' },
    { label: 'New Beta', status: 'done' }
  ])
  assert.equal(afterNewSecond.aggregator, '')
}

{
  const liveRun = {
    open: true,
    sessionId: 'session-archive',
    refsDone: 2,
    refsTotal: 2,
    advisors: [{ label: 'Alpha', status: 'done' }, { label: 'Beta', status: 'done' }],
    aggregator: 'Synthesizer',
    aggregatorState: 'done'
  }
  const next = applyTurnBoundary(liveRun)
  assert.deepEqual(plain(next.previous), [{
    advisors: liveRun.advisors,
    aggregator: 'Synthesizer',
    aggregatorState: 'done',
    refsDone: 2,
    refsTotal: 2
  }])
  assert.equal(next.open, false)
}

{
  const archived = [{ advisors: [], aggregator: 'earlier', aggregatorState: 'done', refsDone: 1, refsTotal: 1 }]
  assert.equal(emptyRun('session-empty', archived).previous, archived)
  assert.equal(runWasMoA({ open: true, advisors: [], refsDone: 0, refsTotal: 0, aggregator: '' }), false)
  assert.equal(runWasMoA({ open: true, advisors: [], refsDone: 0, refsTotal: 1, aggregator: '' }), true)
  assert.deepEqual(plain(applyTurnBoundary(emptyRun('session-empty', archived)).previous), archived)

  const priorTen = Array.from({ length: 10 }, (_, index) => ({ advisors: [], aggregator: `old-${index}`, aggregatorState: 'done', refsDone: index, refsTotal: index }))
  const bounded = applyTurnBoundary({
    open: true,
    sessionId: 'session-cap',
    refsDone: 1,
    refsTotal: 1,
    advisors: [{ label: 'Newest', status: 'done' }],
    aggregator: 'newest',
    aggregatorState: 'done',
    previous: priorTen
  })
  assert.equal(bounded.previous.length, 10)
  assert.equal(bounded.previous[0].aggregator, 'newest')
  assert.equal(bounded.previous[9].aggregator, 'old-8')

  const fanout = applyProgress({
    open: true,
    sessionId: 'session-fanout',
    refsDone: 1,
    refsTotal: 1,
    advisors: [{ label: 'Old', status: 'done' }],
    aggregator: '',
    aggregatorState: 'waiting',
    previous: archived
  }, { refs_total: 2, refs_done: 1, label: 'New' })
  assert.equal(fanout.previous, archived)
}

{
  const oldRun = {
    open: true,
    sessionId: 'session-1',
    refsDone: 2,
    refsTotal: 2,
    advisors: [
      { label: 'Old Alpha', status: 'done' },
      { label: 'Old Beta', status: 'done' }
    ],
    aggregator: 'Old Synthesizer',
    aggregatorState: 'done'
  }
  const replacement = applyProgress(oldRun, { refs_total: 2, refs_done: 1, label: 'New Alpha' })
  assert.deepEqual(plain(replacement.advisors), [
    { label: 'New Alpha', status: 'done' },
    { label: '', status: 'running' }
  ])
  assert.equal(replacement.aggregator, '')
  assert.equal(replacement.aggregatorState, 'waiting')
}

{
  assert.equal(typeof applyComplete, 'function')
  const partial = {
    open: true,
    refsDone: 1,
    refsTotal: 2,
    advisors: [
      { label: 'Alpha', status: 'done' },
      { label: 'Beta', status: 'running' }
    ],
    aggregator: 'Synthesizer',
    aggregatorState: 'aggregating'
  }
  const interrupted = applyComplete(partial, { status: 'error' })
  assert.equal(interrupted.open, true)
  assert.deepEqual(plain(interrupted.advisors), [
    { label: 'Alpha', status: 'done' },
    { label: 'Beta', status: 'interrupted' }
  ])
  assert.equal(interrupted.aggregatorState, 'interrupted')
  assert.equal(chipCaption(interrupted), 'MoA 1/2')
}

{
  const complete = applyComplete({
    open: true,
    refsDone: 2,
    refsTotal: 2,
    advisors: [
      { label: 'Alpha', status: 'done' },
      { label: 'Beta', status: 'done' }
    ],
    aggregator: 'Synthesizer',
    aggregatorState: 'aggregating'
  }, {})
  assert.equal(complete.open, true)
  assert.deepEqual(plain(complete.advisors), [
    { label: 'Alpha', status: 'done' },
    { label: 'Beta', status: 'done' }
  ])
  assert.equal(complete.aggregatorState, 'done')
}

{
  const noMoA = applyComplete({
    open: false,
    sessionId: 'session-1',
    refsDone: 0,
    refsTotal: 0,
    advisors: [],
    aggregator: '',
    aggregatorState: 'waiting'
  }, {})
  assert.equal(noMoA.open, false)
}

{
  const stickyMoA = { open: true, refsDone: 2, refsTotal: 2, advisors: [], aggregator: 'Synthesizer', aggregatorState: 'done' }
  const focusedMoA = { open: true, refsDone: 1, refsTotal: 2, advisors: [], aggregator: '', aggregatorState: 'waiting' }
  const state = {
    focusedId: 'last-moa',
    runsBySession: { 'last-moa': stickyMoA, 'focused-moa': focusedMoA }
  }
  assert.equal(typeof liveBoardRun, 'function')
  assert.equal(liveBoardRun(state, 'grok-tab', 'active-tab'), stickyMoA)
  assert.equal(chipCaption(selectedRun(state, 'grok-tab', 'active-tab')), 'MoA 0/0')
  assert.equal(liveBoardRun(state, 'focused-moa', 'active-tab'), focusedMoA)

  const openHostRun = { open: true, refsDone: 0, refsTotal: 0, advisors: [], aggregator: '', aggregatorState: 'waiting' }
  const stickyHostState = {
    focusedId: 'last-moa',
    runsBySession: { 'last-moa': stickyMoA, 'host-grok': openHostRun }
  }
  assert.equal(liveBoardRun(stickyHostState, 'host-grok', 'active-tab'), stickyMoA, 'RED sticky board ignores an open non-MoA host run')
  const openHostMoARun = { ...openHostRun, refsTotal: 1 }
  assert.equal(liveBoardRun({ ...stickyHostState, runsBySession: { ...stickyHostState.runsBySession, 'host-moa': openHostMoARun } }, 'host-moa', 'active-tab'), openHostMoARun, 'RED host MoA run remains the live board')
}

{
  assert.equal(tooltipLabel({
    refsDone: 1,
    refsTotal: 2,
    advisors: [{ label: 'Alpha', status: 'done' }, { label: '', status: 'running' }],
    aggregator: 'Synthesizer',
    aggregatorState: 'aggregating'
  }), 'Alpha: done\nAgent 2: running\nSynthesizer: aggregating')
  assert.equal(tooltipLabel({ refsDone: 0, refsTotal: 2, advisors: [], aggregator: '', aggregatorState: 'waiting' }), 'MoA 0/2')
}

{
  const openRun = {
    open: true,
    refsDone: 1,
    refsTotal: 2,
    advisors: [{ label: 'Alpha', status: 'done' }, { label: '', status: 'running' }],
    aggregator: 'Synthesizer',
    aggregatorState: 'aggregating'
  }
  assert.equal(chipCaption(null), 'MoA 0/0')
  assert.equal(chipTip(null), 'MoA 0/0')
  assert.equal(chipCaption({ ...openRun, open: false }), 'MoA 0/0')
  assert.equal(chipTip({ ...openRun, open: false }), 'MoA 0/0')
  assert.equal(chipCaption(openRun), 'MoA 1/2')
  assert.equal(chipTip(openRun), 'Alpha: done\nAgent 2: running\nSynthesizer: aggregating')
}

{
  assert.equal(typeof latestRunWithTokenUsage, 'function')
  assert.equal(typeof liveMetricsForBoard, 'function')
  const currentTurn = { session_id: 'live-session', turn_id: 'current-turn', references: [{ usage: { input_tokens: 0, output_tokens: 0 } }] }
  const priorCurrent = { session_id: 'live-session', turn_id: 'prior-current', references: [{ usage: { input_tokens: 2400, output_tokens: 800 } }] }
  const exactHistory = { session_id: 'live-session', turn_id: 'current-turn', references: [{ usage: { input_tokens: 1800, output_tokens: 600 } }] }
  const otherSession = { session_id: 'other-session', turn_id: 'other-turn', references: [{ usage: { input_tokens: 9000, output_tokens: 1 } }] }
  const metrics = {
    current: { session_id: 'live-session', runs: [priorCurrent, currentTurn] },
    history: [otherSession, exactHistory]
  }
  const doneRun = { open: true, sessionId: 'live-session', turnId: 'current-turn', aggregatorState: 'done' }
  const exact = liveMetricsForBoard(metrics, doneRun, 'live-session')
  assert.equal(exact.run, exactHistory, 'exact session and turn History usage wins before fallback')
  assert.equal(exact.priorTurn, false)

  const fallbackMetrics = {
    current: { session_id: 'live-session', runs: [priorCurrent, currentTurn] },
    history: [otherSession, { session_id: 'live-session', turn_id: 'prior-history', references: [{ usage: { input_tokens: 1600, output_tokens: 400 } }] }]
  }
  const fallbackRun = { ...doneRun, turnId: '' }
  const fallback = liveMetricsForBoard(fallbackMetrics, fallbackRun, 'live-session')
  assert.equal(fallback.run, priorCurrent, 'idle or done board falls back to the latest token-bearing current row in the same session')
  assert.equal(fallback.priorTurn, true)

  const historyFallback = liveMetricsForBoard({
    current: { session_id: 'live-session', runs: [currentTurn] },
    history: [otherSession, { session_id: 'live-session', turn_id: 'prior-history', references: [{ usage: { input_tokens: 1600, output_tokens: 400 } }] }]
  }, fallbackRun, 'live-session')
  assert.equal(sumRunUsage(historyFallback.run).input_tokens, 1600, 'idle or done board uses same-session History only when current has no prior tokens')
  assert.equal(historyFallback.priorTurn, true)

  const midFlight = liveMetricsForBoard(fallbackMetrics, { ...doneRun, aggregatorState: 'aggregating' }, 'live-session')
  assert.equal(midFlight, null, 'open mid-flight board does not borrow prior-turn totals')
}

{
  const jsonlHistoryTurn = {
    session_id: 'jsonl-stored-session',
    turn_id: 'shared-turn',
    references: [{ usage: { input_tokens: 1800, output_tokens: 600 } }]
  }
  const otherGatewayHistoryTurn = {
    session_id: 'gateway-session',
    turn_id: 'other-turn',
    references: [{ usage: { input_tokens: 9000, output_tokens: 1 } }]
  }
  const leftoverMetrics = {
    current: {
      session_id: 'gateway-session',
      runs: [{
        session_id: 'gateway-session',
        turn_id: 'shared-turn',
        references: [{ usage: { input_tokens: 0, output_tokens: 0 } }]
      }]
    },
    history: [otherGatewayHistoryTurn, jsonlHistoryTurn]
  }
  const leftoverRun = { open: true, sessionId: 'gateway-session', turnId: 'shared-turn', aggregatorState: 'done' }
  const exactHistory = liveMetricsForBoard(leftoverMetrics, leftoverRun, 'gateway-session')
  assert.equal(exactHistory.run, jsonlHistoryTurn, 'turn-id-only History match attaches JSONL usage despite gateway session mismatch')
  assert.equal(exactHistory.priorTurn, false)

  const missingTurn = liveMetricsForBoard(leftoverMetrics, { ...leftoverRun, turnId: 'missing-turn' }, 'gateway-session')
  assert.equal(missingTurn, null, 'missing turn_id does not borrow another History row')
}

{
  const textContent = (node) => {
    if (typeof node === 'string') return [node]
    if (Array.isArray(node)) return node.flatMap(textContent)
    return node && typeof node === 'object' ? textContent(node.props && node.props.children) : []
  }
  assert.equal(typeof TrackerPane, 'function')

  sandbox.focusedSessionId = 'host-focused'
  trackerState.set({
    focusedId: 'sticky-dead-id',
    previousRing: [],
    runsBySession: {
      'sticky-dead-id': {
        ...emptyRun(''),
        open: true,
        refsDone: 1,
        refsTotal: 1,
        advisors: [{ label: 'Advisor', status: 'done' }],
        aggregator: 'Aggregator',
        aggregatorState: 'done'
      }
    }
  })
  sandbox.queryResult = {}
  TrackerPane({ rest: () => [] })
  assert.deepEqual(plain(sandbox.lastQuery.queryKey), ['moa-tracker', 'metrics', 'host-focused'], 'sticky live chrome without sessionId queries the host-focused session')
  sandbox.focusedSessionId = 'focused-s1'

  trackerState.set({ runsBySession: {}, focusedId: null })
  sandbox.queryResult = {}
  const requests = []
  const queryRest = async (requestPath) => {
    requests.push(requestPath)
    return requestPath === metricsCurrentPath('focused-s1')
      ? { session_id: 'focused-s1', runs: [] }
      : []
  }
  const idlePane = TrackerPane({ rest: queryRest })
  assert.deepEqual(plain(sandbox.lastQuery.queryKey), ['moa-tracker', 'metrics', 'focused-s1'])
  assert.equal(sandbox.lastQuery.retry, false)
  assert.equal(sandbox.lastQuery.refetchInterval, 15000)
  assert.ok(textContent(idlePane).includes('metrics backend off'))
  assert.ok(textContent(idlePane).includes('Waiting for MoA activity in this session.'))

  trackerState.set({
    focusedId: 'empty-live',
    previousRing: [],
    runsBySession: {
      'empty-live': {
        ...emptyRun('empty-live'),
        open: true,
        refsDone: 0,
        refsTotal: 1,
        advisors: [],
        aggregator: '',
        aggregatorState: 'waiting'
      }
    }
  })
  const emptyLivePaneText = textContent(TrackerPane({ rest: queryRest }))
  assert.ok(emptyLivePaneText.includes('No agent references yet.'), 'Live empty board labels pending agent references')

  trackerState.set({
    focusedId: 'sticky-moa',
    previousRing: [{
      sessionId: 'sticky-moa',
      presetName: 'Previous Preset',
      advisors: [{ label: 'openai:gpt-advisor', status: 'done' }],
      aggregator: 'xai:grok-aggregator[reasoning=high]',
      aggregatorState: 'done',
      refsDone: 1,
      refsTotal: 1
    }],
    runsBySession: {
      'sticky-moa': {
        ...emptyRun('sticky-moa'),
        open: true,
        presetName: 'Live Preset',
        refsDone: 1,
        refsTotal: 1,
        advisors: [{ label: 'Alpha', status: 'done' }],
        aggregator: 'Synthesizer',
        aggregatorState: 'done',
        previous: []
      }
    }
  })
  const stickyPaneText = textContent(TrackerPane({ rest: queryRest }))
  assert.deepEqual(plain(sandbox.lastQuery.queryKey), ['moa-tracker', 'metrics', 'sticky-moa'])
  assert.ok(stickyPaneText.includes('Mixture of Agents · Live Preset'))
  assert.ok(stickyPaneText.includes('refs completed 1/1'))
  assert.ok(!stickyPaneText.includes('Waiting for MoA activity in this session.'))
  const stickyRequests = []
  TrackerPane({ rest: async (requestPath) => {
    stickyRequests.push(requestPath)
    return requestPath === metricsCurrentPath('sticky-moa')
      ? { session_id: 'sticky-moa', runs: [] }
      : []
  } })
  await sandbox.lastQuery.queryFn()
  assert.deepEqual(stickyRequests, [metricsCurrentPath('sticky-moa'), metricsHistoryPath(10)])
  sandbox.queryResult = {
    data: {
      status: 'on',
      current: {
        session_id: 'sticky-moa',
        runs: [
          { references: [{ usage: { input_tokens: 2000, output_tokens: 500 } }] },
          { references: [{ usage: { input_tokens: 3000, output_tokens: 700 } }] }
        ]
      },
      history: [{ session_id: 'sticky-moa', references: [{ usage: { input_tokens: 2000, output_tokens: 500 } }] }]
    }
  }
  const grokStickyText = textContent(TrackerPane({ rest: () => [] }))
  assert.ok(grokStickyText.includes('Previous MoA boards'))
  assert.ok(grokStickyText.includes('2k in / 500 out'))
  assert.equal(chipCaption(selectedRun(trackerState.get(), 'grok-tab', 'active-tab')), 'MoA 0/0')
  assert.deepEqual(plain(textContent(AdvisorRow({ advisor: { label: 'xai:grok-advisor[reasoning=high]', status: 'done' }, index: 0 }))), ['Agent: grok-advisor[reasoning=high]', 'done'])
  assert.deepEqual(plain(textContent(AggregatorRow({ run: { aggregator: 'xai:grok-aggregator', aggregatorState: 'done' } }))), ['Aggregator: grok-aggregator', 'done'])
  assert.deepEqual(plain(textContent(AggregatorRow({ run: { aggregator: '', aggregatorState: 'waiting' } }))), ['Aggregator: Aggregator', 'waiting'])
  sandbox.queryResult = {}
  const previousPane = PreviousRuns({
    previousRing: Array.from({ length: 6 }, (_, index) => ({
      sessionId: 'previous-session',
      presetName: index === 0 ? 'Previous Preset' : '',
      advisors: [{ label: index === 0 ? 'openai:gpt-advisor' : '', status: 'done' }],
      aggregator: 'xai:grok-aggregator[reasoning=high]',
      aggregatorState: 'done',
      refsDone: 1,
      refsTotal: 1
    })),
    metrics: {
      current: {
        session_id: 'previous-session',
        runs: [
          { references: [{ usage: { input_tokens: 100, output_tokens: 0 } }] },
          { references: [{ usage: { input_tokens: 0, output_tokens: 0 } }] },
          { references: [{ usage: { input_tokens: 2000, output_tokens: 500 } }] },
          { references: [{ usage: { input_tokens: 3000, output_tokens: 700 } }] }
        ]
      },
      history: [
        { session_id: 'previous-session', references: [{ usage: { input_tokens: 2000, output_tokens: 500 } }] },
        { session_id: 'previous-session', references: [{ usage: { input_tokens: 100, output_tokens: 0 } }] }
      ]
    },
    liveRun: { open: true, sessionId: 'previous-session' }
  })
  const previousText = textContent(previousPane)
  assert.ok(previousText.includes('Previous MoA boards'))
  assert.equal(previousText.filter((text) => text === 'MoA').length, 2, 'JSONL cards render before and instead of unmatched ring cards')
  assert.ok(!previousText.includes('MoA: Previous Preset 1/1'))
  assert.ok(!previousText.includes('Agent: gpt-advisor'))
  assert.ok(previousText.includes('Agent: Agent 1'))
  assert.ok(!previousText.includes('Aggregator: grok-aggregator[reasoning=high]: done'))
  assert.ok(previousText.includes('2k in / 500 out'))
  assert.ok(previousText.includes('100 in / 0 out'))
  assert.ok(!previousText.includes('0 in / 0 out'))

  const historyFallbackPane = PreviousRuns({
    previousRing: [{
      sessionId: 'history-fallback',
      turnId: 'not-a-unique-match',
      presetName: 'History fallback',
      advisors: [],
      aggregator: 'Synthesizer',
      aggregatorState: 'done',
      refsDone: 1,
      refsTotal: 1
    }],
    metrics: {
      current: {
        session_id: 'history-fallback',
        runs: [{ session_id: 'history-fallback', turn_id: 'zero-current', references: [{ usage: { input_tokens: 0, output_tokens: 0 } }] }]
      },
      history: [{ session_id: 'history-fallback', turn_id: 'history-turn', references: [{ usage: { input_tokens: 1800, output_tokens: 600 } }] }]
    },
    liveRun: { open: false, sessionId: 'history-fallback' }
  })
  const historyFallbackText = textContent(historyFallbackPane)
  assert.ok(historyFallbackText.includes('1.8k in / 600 out'), 'Previous fills spare capacity with a distinct History row')
  assert.ok(!historyFallbackText.includes('0 in / 0 out'), 'Previous card hides zero token totals')

  assert.deepEqual(plain(previousPane.props.children[1].props.children[1].props.style), {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    whiteSpace: 'normal',
    textOverflow: 'clip',
    fontSize: '12px',
    color: 'var(--ui-text-tertiary)'
  })

  trackerState.set({
    focusedId: 'focused-s1',
    previousRing: [{
      sessionId: 'focused-s1',
      advisors: [{ label: 'Alpha', status: 'done' }, { label: 'Beta', status: 'done' }],
      aggregator: 'Synthesizer',
      aggregatorState: 'done',
      refsDone: 2,
      refsTotal: 2
    }],
    runsBySession: {
      'focused-s1': {
        ...emptyRun('focused-s1'),
        previous: []
      }
    }
  })
  const archivedPaneText = textContent(TrackerPane({ rest: queryRest }))
  assert.ok(archivedPaneText.includes('Waiting for MoA activity in this session.'))
  assert.ok(!archivedPaneText.includes('MoA 2/2'), 'unmatched ring card without JSONL usage does not occupy Previous')
  assert.ok(!archivedPaneText.includes('Aggregator: Synthesizer: done'))

  await sandbox.lastQuery.queryFn()
  assert.deepEqual(requests, [metricsCurrentPath('focused-s1'), metricsHistoryPath(10)])

  trackerState.set({ runsBySession: {}, focusedId: null })
  sandbox.queryResult = {
    data: {
      status: 'on',
      current: { session_id: 'focused-s1', runs: [{ references: [] }] },
      history: [{ session_id: 'history-zero', turn_id: 'zero', references: [{ usage: { input_tokens: 0, output_tokens: 0 }, cost_usd: 0 }] }]
    }
  }
  const zeroMetricsText = textContent(TrackerPane({ rest: () => [] }))
  assert.ok(zeroMetricsText.includes('Waiting for MoA activity in this session.'))
  assert.ok(!zeroMetricsText.includes('metrics backend on'))
  assert.ok(!zeroMetricsText.includes('0 in / 0 out'), 'zero token totals remain hidden')

  trackerState.set({
    focusedId: 'waiting-usage',
    previousRing: [],
    runsBySession: { 'waiting-usage': emptyRun('waiting-usage') }
  })
  sandbox.queryResult = {
    data: {
      status: 'on',
      current: {
        session_id: 'waiting-usage',
        runs: [
          { references: [{ usage: { input_tokens: 2400, output_tokens: 800 } }] },
          { references: [{ usage: { input_tokens: 0, output_tokens: 0 } }] }
        ]
      },
      history: []
    }
  }
  const waitingUsageText = textContent(TrackerPane({ rest: () => [] }))
  assert.ok(waitingUsageText.includes('2.4k in / 800 out · prior turn'), 'idle pane labels last non-zero same-session current totals as a prior turn')
  assert.ok(!waitingUsageText.includes('0 in / 0 out'), 'waiting pane hides zero token totals')

  trackerState.set({
    focusedId: 'history-live-totals',
    previousRing: [],
    runsBySession: { 'history-live-totals': emptyRun('history-live-totals') }
  })
  sandbox.queryResult = {
    data: {
      status: 'on',
      current: {
        session_id: 'history-live-totals',
        runs: [{ references: [{ usage: { input_tokens: 0, output_tokens: 0 } }] }]
      },
      history: [{
        session_id: 'history-live-totals',
        turn_id: 'history-live-turn',
        references: [{ usage: { input_tokens: 1800, output_tokens: 600 } }]
      }]
    }
  }
  const historyLiveTotalsPane = TrackerPane({ rest: () => [] })
  const historyLiveTotalsText = textContent(historyLiveTotalsPane)
  assert.equal(historyLiveTotalsPane.props.children[1]?.props?.children, '1.8k in / 600 out · prior turn', 'RED idle live totals label the same-session History fallback as a prior turn')
  assert.ok(historyLiveTotalsText.includes('1.8k in / 600 out'))
  assert.ok(!historyLiveTotalsText.includes('0 in / 0 out'), 'RED live totals keep zero totals hidden after history fallback')

  sandbox.focusedSessionId = 'chrome-fallback'
  trackerState.set({
    focusedId: 'chrome-fallback',
    previousRing: [],
    runsBySession: {
      'chrome-fallback': {
        ...emptyRun('chrome-fallback'),
        open: true,
        refsDone: 1,
        refsTotal: 1,
        advisors: [{ label: 'Advisor', status: 'done' }],
        aggregator: 'Aggregator',
        aggregatorState: 'done'
      }
    }
  })
  sandbox.queryResult = {
    data: {
      status: 'on',
      current: { session_id: 'chrome-fallback', runs: [{ references: [{ usage: { input_tokens: 0, output_tokens: 0 } }] }] },
      history: [{ session_id: 'chrome-fallback', model: 'Borrowed model', references: [{ usage: { input_tokens: 1800, output_tokens: 600 } }] }]
    }
  }
  const chromeFallbackText = textContent(TrackerPane({ rest: () => [] }))
  assert.ok(chromeFallbackText.some((text) => text.includes('Mixture of Agents')))
  assert.ok(!chromeFallbackText.includes('Mixture of Agents · Borrowed model'), 'RED prior-turn usage never retitles Live chrome from the fallback model')
  assert.ok(chromeFallbackText.includes('1.8k in / 600 out · prior turn'))

  trackerState.set({
    ...trackerState.get(),
    runsBySession: {
      'chrome-fallback': { ...trackerState.get().runsBySession['chrome-fallback'], presetName: 'Chrome Preset' }
    }
  })
  const namedChromeFallbackText = textContent(TrackerPane({ rest: () => [] }))
  assert.ok(namedChromeFallbackText.includes('Mixture of Agents · Chrome Preset'), 'RED prior-turn usage preserves the Live board preset')

  trackerState.set({
    focusedId: 'partial-live',
    previousRing: [],
    runsBySession: {
      'partial-live': {
        ...emptyRun('partial-live'),
        open: true,
        refsDone: 1,
        refsTotal: 2,
        advisors: [{ label: 'Alpha', status: 'done' }, { label: 'Beta', status: 'running' }],
        aggregator: 'Synthesizer',
        aggregatorState: 'aggregating'
      }
    }
  })
  sandbox.queryResult = {
    data: {
      status: 'on',
      current: {
        session_id: 'partial-live',
        runs: [{
          session_id: 'partial-live',
          turn_id: 'partial-turn',
          references: [
            { usage: { input_tokens: 12400, output_tokens: 3100 } }
          ]
        }]
      },
      history: []
    }
  }
  const partialLiveText = textContent(TrackerPane({ rest: () => [] }))
  assert.ok(partialLiveText.includes('12.4k in / 3.1k out'), 'live totals render before all references complete')
  assert.ok(!partialLiveText.includes('0 in / 0 out'), 'zero token totals remain hidden')

  sandbox.queryResult = {
    data: {
      status: 'on',
      current: {
        session_id: 'sticky-moa',
        runs: [{
          session_id: 'sticky-moa',
          turn_id: 'current-turn',
          references: [
            { label: 'Alpha', usage: { input_tokens: 4200, output_tokens: 1100 }, cost_usd: 0.04 },
            { label: 'Beta', usage: { input_tokens: 8200, output_tokens: 2000 }, cost_usd: 0.08 }
          ]
        }]
      },
      history: Array.from({ length: 11 }, (_, index) => ({
        session_id: `s${index}`,
        turn_id: `t${index}`,
        model: `m${index}`,
        references: [{ model: `openai:m${index}-advisor`, label: `History ${index}`, usage: { input_tokens: 1000, output_tokens: 2000 }, cost_usd: 0.01 }]
      }))
    }
  }
  trackerState.set({
    focusedId: 'sticky-moa',
    previousRing: [],
    runsBySession: {
      'sticky-moa': {
        ...emptyRun('sticky-moa'),
        open: true,
        refsDone: 1,
        refsTotal: 1,
        advisors: [{ label: 'xai:grok-advisor', status: 'done' }],
        aggregator: 'xai:grok-aggregator[reasoning=high]',
        aggregatorState: 'done',
        previous: Array.from({ length: 6 }, (_, index) => ({
          advisors: [{ label: index === 0 ? 'openai:gpt-advisor' : '', status: 'done' }],
          aggregator: 'openai:gpt-aggregator',
          aggregatorState: 'done',
          refsDone: 1,
          refsTotal: 1
        }))
      }
    }
  })
  const metricsPane = TrackerPane({ rest: () => [] })
  const metricsText = textContent(metricsPane)
  assert.ok(!metricsText.includes('metrics backend on'))
  assert.ok(metricsText.includes('12.4k in / 3.1k out · $0.12'))
  assert.ok(!metricsText.includes('current 12.4k in / 3.1k out · $0.12'))
  assert.ok(metricsText.includes('Alpha  4.2k→1.1k  $0.04'))
  assert.ok(metricsText.includes('MoA: m0'))
  assert.ok(metricsText.includes('Agent: m0-advisor'))
  assert.equal(metricsText.filter((text) => text.endsWith('1k in / 2k out · $0.01')).length, 10, 'Previous caps JSONL-seeded rows at ten')
  assert.ok(!metricsText.includes('previous 1k in / 2k out · $0.01'))
  assert.ok(metricsText.some((text) => text.startsWith('MoA: m9')), 'Previous includes the tenth JSONL row')
  assert.ok(!metricsText.includes('MoA: m10'), 'Previous omits the eleventh JSONL row')
  assert.ok(!metricsText.includes('History'), 'History heading and list are hidden')
  const trackerPaneSource = source.slice(source.indexOf('function TrackerPane'), source.indexOf('function StatusChip'))
  assert.ok(!trackerPaneSource.includes('HistorySection'), 'TrackerPane does not render HistorySection')
  assert.ok(!trackerPaneSource.includes('historyPanel'), 'TrackerPane does not create historyPanel')
  assert.ok(!metricsText.includes('focused-s1'))
  assert.ok(!metricsText.includes('current-turn'))
  assert.ok(!metricsText.includes('s9'))
  assert.ok(!metricsText.includes('t9'))
  assert.ok(!source.includes('input_messages'))
  assert.ok(!source.includes('prompts'))
  assert.ok(source.includes("return status === 'done' ? 'text-emerald-500/80' : undefined"))
  assert.ok(source.includes("WebkitLineClamp: 3"))
  assert.ok(source.includes("textOverflow: 'clip'"))
}

{
  const exactUsage = previousRingUsage([
    { sessionId: 'session-one', turnId: 'turn-a' },
    { sessionId: 'session-one', turnId: 'turn-b' },
    { sessionId: 'history-session', turnId: 'shared-turn' },
    { sessionId: 'session-one', turnId: 'live-turn' }
  ], {
    current: {
      session_id: 'session-one',
      runs: [
        { session_id: 'session-one', turn_id: 'turn-a', references: [{ usage: { input_tokens: 111, output_tokens: 11 } }] },
        { session_id: 'session-one', turn_id: 'turn-b', references: [{ usage: { input_tokens: 222, output_tokens: 22 } }] },
        { session_id: 'session-one', turn_id: 'live-turn', references: [{ usage: { input_tokens: 999, output_tokens: 99 } }] }
      ]
    },
    history: [
      { session_id: 'other-session', turn_id: 'shared-turn', references: [{ usage: { input_tokens: 999, output_tokens: 99 } }] },
      { session_id: 'history-session', turn_id: 'wrong-turn', references: [{ usage: { input_tokens: 500, output_tokens: 50 } }] },
      { session_id: 'history-session', turn_id: 'shared-turn', references: [{ usage: { input_tokens: 333, output_tokens: 33 } }] }
    ]
  }, { open: true, sessionId: 'session-one', turnId: 'live-turn' })
  assert.deepEqual(plain(exactUsage.map((entry) => entry.usage && sumRunUsage(entry.usage).input_tokens)), [null, null, 333, null], 'Previous turn-scoped cards require an exact session and turn History match')
}

{
  const fallbackUsage = previousRingUsage([
    { sessionId: 'fallback-session', turnId: 'missing-turn-one' },
    { sessionId: 'fallback-session', turnId: 'missing-turn-two' }
  ], {
    current: {
      session_id: 'fallback-session',
      runs: [
        { session_id: 'fallback-session', turn_id: 'archived-one', references: [{ usage: { input_tokens: 111, output_tokens: 11 } }] },
        { session_id: 'fallback-session', turn_id: 'archived-two', references: [{ usage: { input_tokens: 222, output_tokens: 22 } }] },
        { session_id: 'fallback-session', turn_id: 'live-turn', references: [{ usage: { input_tokens: 999, output_tokens: 99 } }] }
      ]
    },
    history: []
  }, { open: true, sessionId: 'fallback-session', turnId: 'live-turn' })
  assert.deepEqual(
    plain(fallbackUsage.map((entry) => entry.usage && sumRunUsage(entry.usage).input_tokens)),
    [null, null],
    'unmatched turns stay blank instead of borrowing another History row'
  )
}

{
  assert.equal(typeof displayMoaName, 'function')
  assert.equal(displayMoaName({ presetName: 'Named board', model: 'fallback' }), 'Named board')
  assert.equal(displayMoaName({ presetName: '', model: 'fallback' }), 'fallback')
  assert.equal(displayMoaName({}), '')

  const initial = emptyRun('identity-session')
  assert.equal(initial.presetName, '')
  assert.equal(initial.turnId, '')
  const progressed = applyProgress(initial, {
    refs_total: 1,
    refs_done: 1,
    label: 'Advisor',
    preset: 'Identity preset',
    turn_id: 'turn-one'
  })
  assert.equal(progressed.presetName, 'Identity preset')
  assert.equal(progressed.turnId, 'turn-one')
  const replacement = applyProgress({ ...progressed, refsTotal: 1, refsDone: 1 }, {
    refs_total: 2,
    refs_done: 1,
    label: 'New advisor',
    preset: '',
    turn_id: ''
  })
  assert.equal(replacement.presetName, 'Identity preset')
  assert.equal(replacement.turnId, 'turn-one')
  assert.deepEqual(plain(snapshotRun(progressed)), {
    advisors: plain(progressed.advisors),
    aggregator: '',
    aggregatorState: 'waiting',
    refsDone: 1,
    refsTotal: 1,
    presetName: 'Identity preset',
    turnId: 'turn-one'
  })
  const ring = pushPreviousRing([], progressed)
  assert.equal(ring[0].presetName, 'Identity preset')
  assert.equal(ring[0].turnId, 'turn-one')

  trackerState.set({ focusedId: 'identity-session', previousRing: [], runsBySession: { 'identity-session': progressed } })
  onPhase({ session_id: 'identity-session', payload: { phase: 'aggregator', preset: 'Phase preset', turn_id: 'turn-two' } })
  onAggregating({ session_id: 'identity-session', payload: { preset: 'Aggregating preset', turn_id: 'turn-three' } })
  onAggregating({ session_id: 'identity-session', payload: { preset: '', turn_id: '' } })
  const phaseRun = trackerState.get().runsBySession['identity-session']
  assert.equal(phaseRun.presetName, 'Aggregating preset')
  assert.equal(phaseRun.turnId, 'turn-three')
}

{
  const moaRun = {
    open: true,
    sessionId: 'moa-s',
    refsDone: 1,
    refsTotal: 1,
    advisors: [{ label: 'Advisor', status: 'done' }],
    aggregator: 'Aggregator',
    aggregatorState: 'done'
  }
  trackerState.set({ focusedId: 'moa-s', previousRing: [], runsBySession: { 'moa-s': moaRun } })
  onMessageStart({ session_id: 'grok-s' })
  assert.equal(trackerState.get().focusedId, 'moa-s', 'non-MoA message.start preserves the sticky MoA board')
  assert.equal(chipCaption(selectedRun(trackerState.get(), 'grok-s', 'active-s1')), 'MoA 0/0', 'chip remains host-focused on the non-MoA session')
}

{
  const moaRun = {
    open: true,
    sessionId: 'moa-s',
    refsDone: 1,
    refsTotal: 1,
    advisors: [{ label: 'Advisor', status: 'done' }],
    aggregator: 'Aggregator',
    aggregatorState: 'done'
  }
  assert.equal(typeof sandbox.onMessageComplete, 'function')
  assert.equal(typeof sandbox.onSessionInfo, 'function')
  sandbox.focusedSessionId = 'grok-s'
  trackerState.set({ focusedId: 'moa-s', previousRing: [], runsBySession: { 'moa-s': moaRun } })
  sandbox.onMessageComplete({ session_id: 'grok-s', payload: {} })
  assert.equal(trackerState.get().focusedId, 'moa-s', 'non-MoA message.complete preserves the sticky MoA board')
  assert.equal(liveBoardRun(trackerState.get(), 'grok-s', 'active-s1'), moaRun, 'Live falls back to the sticky MoA board after non-MoA message.complete')
  sandbox.onSessionInfo({ session_id: 'grok-s', payload: { running: false } })
  assert.equal(trackerState.get().focusedId, 'moa-s', 'idle non-MoA session.info preserves the sticky MoA board')
  sandbox.focusedSessionId = ''
}

{
  const moaRun = {
    open: true,
    sessionId: 'moa-next',
    refsDone: 1,
    refsTotal: 1,
    advisors: [{ label: 'Advisor', status: 'done' }],
    aggregator: 'Aggregator',
    aggregatorState: 'done'
  }
  sandbox.focusedSessionId = 'moa-next'
  trackerState.set({ focusedId: 'moa-s', previousRing: [], runsBySession: { 'moa-next': moaRun } })
  onMessageStart({ session_id: 'moa-next' })
  assert.equal(trackerState.get().focusedId, 'moa-next', 'MoA message.start makes that board sticky')
  sandbox.focusedSessionId = ''
}

{
  const historyRuns = Array.from({ length: 11 }, (_, index) => ({
    session_id: `history-s-${index}`,
    turn_id: `history-t-${index}`,
    model: 'History preset',
    references: [{ usage: { input_tokens: 1000 * (index + 1), output_tokens: 800 } }]
  }))
  const historyRun = historyRuns[0]
  const pane = PreviousRuns({
    previousRing: [],
    metrics: { current: { session_id: 'current-s', runs: [] }, history: historyRuns },
    liveRun: null
  })
  const text = textContent(pane)
  assert.ok(text.includes('Previous MoA boards'), 'empty ring seeds Previous from token-bearing history')
  assert.ok(text.includes(formatRunTotals(historyRun)), 'history-seeded Previous card shows input/output totals')
  assert.ok(text.includes(formatRunTotals(historyRuns[9])), 'history-seeded Previous cards include the tenth row')
  assert.ok(!text.includes(formatRunTotals(historyRuns[10])), 'history-seeded Previous cards cap at ten rows')
}

{
  const ring = [
    { sessionId: 'ring-s-1', turnId: 'ring-t-1', refsDone: 1, refsTotal: 1, advisors: [], aggregator: '' },
    { sessionId: 'ring-s-2', turnId: 'ring-t-2', refsDone: 1, refsTotal: 1, advisors: [], aggregator: '' }
  ]
  const history = [
    { session_id: 'ring-s-1', turn_id: 'ring-t-1', model: 'Duplicate ring row', references: [{ usage: { input_tokens: 100, output_tokens: 10 } }] },
    ...Array.from({ length: 10 }, (_, index) => ({
      session_id: `jsonl-s-${index}`,
      turn_id: `jsonl-t-${index}`,
      model: `JSONL ${index}`,
      references: [{ usage: { input_tokens: 100 + index, output_tokens: 10 } }]
    }))
  ]
  assert.equal(typeof previousRows, 'function')
  const rows = previousRows(ring, { current: { session_id: 'current-s', runs: [] }, history }, null)
  assert.equal(rows.length, 10, 'Previous caps JSONL-seeded rows at ten before considering ring cards')
  assert.deepEqual(
    plain(rows.map(({ run }) => run.model)),
    ['Duplicate ring row', ...Array.from({ length: 9 }, (_, index) => `JSONL ${index}`)],
    'Previous preserves token-filtered JSONL order and excludes ring cards when JSONL reaches the cap'
  )
  assert.ok(rows.every(({ usage }) => usage), 'unmatched ring cards do not consume Previous slots')
}

{
  const pane = PreviousRuns({
    previousRing: [],
    metrics: {
      current: { session_id: 'current-s', runs: [] },
      history: [
        {
          session_id: 'history-aggregator',
          turn_id: 'explicit-aggregator',
          aggregator: 'xai:grok-4.5',
          aggregatorState: 'done',
          references: [{ model: 'openai:gpt-advisor', usage: { input_tokens: 100, output_tokens: 10 } }]
        },
        {
          session_id: 'history-reference-model',
          turn_id: 'reference-model',
          references: [{ model: 'openai:gpt-5', usage: { input_tokens: 200, output_tokens: 20 } }]
        }
      ]
    },
    liveRun: null
  })
  const text = textContent(pane)
  assert.ok(text.includes('Aggregator: grok-4.5: done'), 'RED history Previous card renders explicit Aggregator label and state')
  assert.ok(text.includes('Aggregator: gpt-5'), 'RED history Previous card derives Aggregator label from its last reference model')
}

{
  const zeroHistoryRun = {
    session_id: 'history-zero',
    turn_id: 'zero',
    references: [{ usage: { input_tokens: 0, output_tokens: 0 } }]
  }
  const pane = PreviousRuns({
    previousRing: [],
    metrics: { current: { session_id: 'current-s', runs: [] }, history: [zeroHistoryRun] },
    liveRun: null
  })
  assert.equal(pane, null, 'empty ring and zero-token history omit Previous')
}

{
  const ring = [{ sessionId: 'history-session', turnId: 'history-turn', refsDone: 1, refsTotal: 1, advisors: [], aggregator: '' }]
  const pane = PreviousRuns({
    previousRing: ring,
    metrics: {
      current: { session_id: 'history-session', runs: [{ session_id: 'history-session', turn_id: 'history-turn', references: [{ usage: { input_tokens: 0, output_tokens: 0 } }] }] },
      history: [{ session_id: 'history-session', turn_id: 'history-turn', references: [{ usage: { input_tokens: 1800, output_tokens: 600 } }] }]
    },
    liveRun: null
  })
  assert.ok(textContent(pane).includes('1.8k in / 600 out'), 'RED Previous card attaches the exact History session and turn row when its usage is null')
  assert.equal(sumRunUsage(latestHistoryRunWithTokenUsage([{ session_id: 'other-session', references: [{ usage: { input_tokens: 9000, output_tokens: 1 } }] }], 'history-session')).input_tokens, 0, 'RED History lookup never falls back across sessions')
}

{
  trackerState.set({
    focusedId: 'live-session',
    previousRing: [],
    runsBySession: { 'live-session': emptyRun('live-session') }
  })
  sandbox.queryResult = {
    data: {
      status: 'on',
      current: { session_id: 'other-session', runs: [{ references: [{ usage: { input_tokens: 9000, output_tokens: 1 } }] }] },
      history: [{ session_id: 'other-session', references: [{ usage: { input_tokens: 8000, output_tokens: 1 } }] }]
    }
  }
  const pane = TrackerPane({ rest: () => [] })
  const text = textContent(pane)
  assert.ok(!text.includes('9k in / 1 out'), 'RED Live totals ignore token usage from a different current session')
  assert.equal(pane.props.children[1], null, 'RED Live totals ignore unmatched other-session History')
  assert.ok(!text.includes('0 in / 0 out'), 'RED Live totals keep 0/0 hidden')
}

{
  const stickyMoA = {
    open: true,
    sessionId: 'moa-other-session',
    refsDone: 1,
    refsTotal: 1,
    advisors: [{ label: 'Advisor', status: 'done' }],
    aggregator: 'Aggregator',
    aggregatorState: 'done'
  }
  trackerState.set({ focusedId: 'moa-other-session', previousRing: [], runsBySession: { 'moa-other-session': stickyMoA } })
  onMessageStart({ session_id: 'moa-other-session' })
  assert.equal(trackerState.get().runsBySession['moa-other-session'].open, true, 'RED a non-host Grok-tab message.start does not apply a turn boundary to sticky MoA')
}

{
  sandbox.focusedSessionId = 'grok-tab'
  const stickyMoA = {
    ...emptyRun('moa-s'),
    sessionId: '',
    open: true,
    refsDone: 1,
    refsTotal: 1,
    advisors: [{ label: 'Advisor', status: 'done' }],
    aggregator: 'Aggregator',
    aggregatorState: 'done',
    presetName: 'Sticky MoA'
  }
  trackerState.set({ focusedId: 'moa-s', previousRing: [], runsBySession: { 'moa-s': stickyMoA } })
  sandbox.queryResult = {
    data: {
      status: 'on',
      current: {
        session_id: 'moa-s',
        runs: [{
          session_id: 'moa-s',
          references: [{ usage: { input_tokens: 7100, output_tokens: 234 } }]
        }]
      },
      history: [{
        session_id: 'moa-s',
        references: [{ usage: { input_tokens: 7100, output_tokens: 234 } }]
      }]
    }
  }
  const pane = TrackerPane({ rest: () => [] })
  const text = textContent(pane)
  assert.equal(sandbox.lastQuery.queryKey[2], 'grok-tab', 'Live /current stays attached to the host-focused ID when sticky chrome has no stored sessionId')
  assert.ok(!text.includes('7.1k in / 234 out'), 'Live board does not attach totals through trackerState.focusedId')
  assert.ok(text.includes('Mixture of Agents · Sticky MoA'), 'Live board remains the sticky MoA board, not only Previous')
  assert.equal(chipCaption(selectedRun(trackerState.get(), 'grok-tab', 'active-s1')), 'MoA 0/0', 'Grok-tab chip stays host-focused')
  sandbox.focusedSessionId = ''
}

{
  const fanoutRun = {
    session_id: 'history-fanout',
    turn_id: 'fanout-turn',
    model: 'Fanout preset',
    fanouts: 3,
    references: [{ usage: { input_tokens: 100, output_tokens: 10 } }]
  }
  trackerState.set({ focusedId: 'history-fanout', previousRing: [], runsBySession: { 'history-fanout': emptyRun('history-fanout') } })
  sandbox.queryResult = { data: { status: 'on', current: { session_id: 'history-fanout', runs: [] }, history: [fanoutRun] } }
  const text = textContent(TrackerPane({ rest: () => [] }))
  assert.equal(text.filter((value) => value.includes('3 fan-outs')).length, 1, 'Previous card discloses coalesced fan-outs without History')
}

console.log('tracker UI helper tests passed')
