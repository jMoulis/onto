/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  ONTO OBSERVER — v0.1                                             ║
 * ║  Reasoning tracer for AI agent pipelines                         ║
 * ║                                                                   ║
 * ║  Drop this into any Vercel AI SDK agentic loop.                  ║
 * ║  It watches the model's tool calls and reasoning,                ║
 * ║  and produces a structured Onto field at the end of each run.    ║
 * ║                                                                   ║
 * ║  You don't change your agent. You add three lines.               ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Usage in your Komposia agent:
 *
 *   import { OntoObserver } from './onto-observer'
 *
 *   const observer = new OntoObserver({ agentId: 'komposia-page-gen' })
 *
 *   // In your onStepFinish callback:
 *   observer.recordStep(step)
 *
 *   // At the end of the run:
 *   const journal = observer.finalize()
 *   console.log(renderJournal(journal))
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — What a run looks like
// ═══════════════════════════════════════════════════════════════════

export interface AgentStep {
  stepType: 'tool-call' | 'text' | 'reasoning' | 'finish'
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: unknown
  text?: string
  reasoning?: string          // from extended thinking / model reasoning
  usage?: { promptTokens: number; completionTokens: number }
  finishReason?: string
  timestamp: number
}

export interface ObservedTension {
  id: string          // e.g. "step_3_apply_patch"
  toolName?: string
  wants: string          // what the step was trying to do
  knew: KnewEntry[]     // what knowledge it had going in
  doubts: DoubtEntry[]    // uncertainties extracted from reasoning
  decided: DecidedEntry[]  // what it actually chose
  confidence: number          // estimated from reasoning language
  state: 'resolved' | 'resisting' | 'partial' | 'uncertain'
  rawReasoning?: string        // the original text
  tokens: number
}

export interface KnewEntry {
  fact: string
  confidence: number
  source: 'tool_result' | 'context' | 'inferred'
}

export interface DoubtEntry {
  about: string
  severity: 'low' | 'medium' | 'blocking'
}

export interface DecidedEntry {
  choice: string
  confidence: number
  risk: 'low' | 'medium' | 'high'
  alternatives?: string[]
}

export interface RunJournal {
  agentId: string
  runId: string
  startTime: number
  endTime: number
  tensions: ObservedTension[]
  summary: RunSummary
  fieldConf: number
  flags: JournalFlag[]
}

export interface RunSummary {
  totalSteps: number
  toolCallCount: number
  totalTokens: number
  resolved: number
  resisting: number
  uncertain: number
  avgConfidence: number
  lowestConfStep: string | null
  highestRisk: string | null
}

export interface JournalFlag {
  kind: 'confidence_drop' | 'repeated_doubt' | 'low_confidence_decision' | 'blocking_doubt_ignored' | 'high_token_step'
  step: string
  detail: string
  severity: 'info' | 'warning' | 'error'
}

// ═══════════════════════════════════════════════════════════════════
// REASONING EXTRACTOR — Turns model text into structured observations
// ═══════════════════════════════════════════════════════════════════

/**
 * This is the core of the observer.
 * It looks for patterns in the model's reasoning text
 * and extracts structured Onto-compatible observations.
 *
 * It works even without extended thinking — it parses
 * the model's regular text output for epistemic signals.
 */
class ReasoningExtractor {

  extractConfidence(text: string): number {
    if (!text) return 0.5

    const t = text.toLowerCase()

    // Strong certainty
    if (/\b(certain|definitely|clearly|obviously|without doubt)\b/.test(t)) return 0.92
    if (/\b(confident|sure|correct|accurate|precise)\b/.test(t)) return 0.85

    // Moderate confidence
    if (/\b(likely|probably|should|expect|appear)\b/.test(t)) return 0.72
    if (/\b(seems|looks like|appears to|suggests)\b/.test(t)) return 0.65

    // Uncertainty
    if (/\b(might|could|possibly|perhaps|maybe|uncertain)\b/.test(t)) return 0.50
    if (/\b(unclear|unsure|not sure|hard to tell|ambiguous)\b/.test(t)) return 0.38

    // Explicit doubt
    if (/\b(unlikely|doubt|skeptical|questionable|risky)\b/.test(t)) return 0.28
    if (/\b(cannot|can't|unable|impossible|wrong|error)\b/.test(t)) return 0.15

    // Explicit confidence markers like "90%" "high confidence"
    const pctMatch = text.match(/(\d+)%\s*(confidence|certain|sure)/i)
    if (pctMatch) return parseInt(pctMatch[1]) / 100

    return 0.6 // neutral default
  }

  extractDoubts(text: string): DoubtEntry[] {
    if (!text) return []
    const doubts: DoubtEntry[] = []
    const t = text.toLowerCase()

    // Blocking doubt patterns
    const blockingPatterns = [
      /\b(cannot proceed|blocked|missing required|need to know first|depends on)\b/,
      /\b(without knowing|before i can|i need)\b/,
    ]
    for (const p of blockingPatterns) {
      const m = t.match(p)
      if (m) {
        const context = this.extractContext(text, text.toLowerCase().indexOf(m[0]), 60)
        doubts.push({ about: context, severity: 'blocking' })
      }
    }

    // Medium doubt patterns
    const mediumPatterns = [
      /\b(not sure (if|whether|about)|unclear (if|whether|how)|uncertain about)\b/,
      /\b(might (not|be wrong)|could be (wrong|incorrect|mistaken))\b/,
      /\b(hard to (tell|know|determine))\b/,
    ]
    for (const p of mediumPatterns) {
      const m = t.match(p)
      if (m && !doubts.some(d => d.severity === 'blocking')) {
        const context = this.extractContext(text, text.toLowerCase().indexOf(m[0]), 50)
        doubts.push({ about: context, severity: 'medium' })
      }
    }

    // Low doubt patterns
    const lowPatterns = [
      /\b(probably fine|should work|assume|assuming)\b/,
    ]
    for (const p of lowPatterns) {
      const m = t.match(p)
      if (m) {
        const context = this.extractContext(text, text.toLowerCase().indexOf(m[0]), 40)
        if (!doubts.some(d => d.about.includes(context.slice(0, 10)))) {
          doubts.push({ about: context, severity: 'low' })
        }
      }
    }

    return doubts.slice(0, 4) // max 4 doubts per step
  }

  extractDecision(text: string, toolName?: string, toolInput?: Record<string, unknown>): DecidedEntry[] {
    const decisions: DecidedEntry[] = []
    const conf = this.extractConfidence(text)

    // If there's a tool call, that IS the decision
    if (toolName && toolName !== 'read_page') {
      let choice = toolName
      if (toolInput) {
        // Extract the most meaningful field from input
        const meaningful = ['operator', 'component', 'type', 'action', 'target', 'path']
        for (const key of meaningful) {
          if (toolInput[key]) { choice = `${toolName}(${key}=${JSON.stringify(toolInput[key])})`; break }
        }
      }

      const risk = conf > 0.75 ? 'low' : conf > 0.50 ? 'medium' : 'high'
      decisions.push({ choice, confidence: conf, risk })
    }

    // Look for explicit choice language
    const choicePatterns = [
      /\bI('ll| will| should| am going to) use\s+([A-Za-z_]+)/i,
      /\bchoosing\s+([A-Za-z_]+)/i,
      /\bselecting\s+([A-Za-z_]+)/i,
      /\bapplying\s+([A-Za-z_]+)/i,
    ]
    for (const p of choicePatterns) {
      const m = text.match(p)
      if (m) {
        const choice = m[2] || m[1]
        if (!decisions.some(d => d.choice.includes(choice))) {
          decisions.push({ choice, confidence: conf, risk: conf > 0.7 ? 'low' : 'medium' })
        }
      }
    }

    return decisions.slice(0, 3)
  }

  extractKnowledge(toolResult: unknown, toolName?: string): KnewEntry[] {
    const entries: KnewEntry[] = []
    if (!toolResult) return entries

    // Tool result gives us high-confidence knowledge
    if (toolName === 'read_page' || toolName === 'get_page') {
      entries.push({
        fact: 'current_page_state(obtained)',
        confidence: 0.99,
        source: 'tool_result'
      })
    }

    if (toolName === 'validate' || toolName === 'check') {
      const resultStr = JSON.stringify(toolResult).toLowerCase()
      entries.push({
        fact: resultStr.includes('error') || resultStr.includes('invalid')
          ? 'validation_failed'
          : 'validation_passed',
        confidence: 0.97,
        source: 'tool_result'
      })
    }

    return entries
  }

  extractWants(text: string, toolName?: string): string {
    if (toolName) {
      const toolWants: Record<string, string> = {
        'read_page': 'read_current_page_state',
        'apply_patch': 'apply_structural_modification',
        'validate': 'verify_output_correctness',
        'get_operators': 'retrieve_available_operators',
        'set_property': 'modify_component_property',
        'add_component': 'add_new_component_to_page',
        'remove_component': 'remove_component_from_page',
        'create_pipeline': 'define_data_pipeline',
      }
      if (toolWants[toolName]) return toolWants[toolName]
    }

    // Extract from text
    const wantsPatterns = [
      /I(?:'m| am| will) (trying to|going to|need to|want to)\s+(.{10,60}?)(?:\.|,|$)/i,
      /(?:The goal is to|I need to|Let me)\s+(.{10,60}?)(?:\.|,|$)/i,
    ]
    for (const p of wantsPatterns) {
      const m = text.match(p)
      if (m) return (m[2] || m[1]).trim().replace(/\s+/g, '_').toLowerCase().slice(0, 50)
    }

    return toolName ? `execute_${toolName}` : 'process_step'
  }

  private extractContext(text: string, pos: number, chars: number): string {
    const start = Math.max(0, pos - 10)
    const end = Math.min(text.length, pos + chars)
    return text.slice(start, end).trim().replace(/\s+/g, ' ')
  }

  inferState(decisions: DecidedEntry[], doubts: DoubtEntry[], conf: number): ObservedTension['state'] {
    if (doubts.some(d => d.severity === 'blocking')) return 'resisting'
    if (conf < 0.35) return 'uncertain'
    if (conf < 0.55 || doubts.length > 2) return 'partial'
    if (decisions.length > 0 && conf >= 0.55) return 'resolved'
    return 'uncertain'
  }
}

// ═══════════════════════════════════════════════════════════════════
// THE OBSERVER — Wraps your agent loop
// ═══════════════════════════════════════════════════════════════════

export class OntoObserver {

  private agentId: string
  private runId: string
  private startTime: number
  private steps: AgentStep[] = []
  private extractor: ReasoningExtractor

  constructor(opts: { agentId: string; runId?: string }) {
    this.agentId = opts.agentId
    this.runId = opts.runId ?? `run_${Date.now()}`
    this.startTime = Date.now()
    this.extractor = new ReasoningExtractor()
  }

  /**
   * Call this in your onStepFinish callback.
   * Compatible with Vercel AI SDK StepResult shape.
   */
  recordStep(step: {
    stepType?: string
    toolCalls?: Array<{ toolName: string; args: Record<string, unknown> }>
    toolResults?: Array<{ result: unknown }>
    text?: string
    reasoning?: string
    usage?: { promptTokens: number; completionTokens: number }
    finishReason?: string
  }): void {
    const normalized: AgentStep = {
      stepType: (step.stepType as any) ?? 'tool-call',
      toolName: step.toolCalls?.[0]?.toolName,
      toolInput: step.toolCalls?.[0]?.args,
      toolResult: step.toolResults?.[0]?.result,
      text: step.text,
      reasoning: step.reasoning,
      usage: step.usage,
      finishReason: step.finishReason,
      timestamp: Date.now(),
    }
    this.steps.push(normalized)
  }

  /**
   * Simpler alternative — record individual fields directly.
   * Useful if you want to instrument specific points.
   */
  record(opts: {
    toolName?: string
    toolInput?: Record<string, unknown>
    toolResult?: unknown
    reasoning?: string
    text?: string
    tokens?: number
  }): void {
    this.steps.push({
      stepType: opts.toolName ? 'tool-call' : 'text',
      toolName: opts.toolName,
      toolInput: opts.toolInput,
      toolResult: opts.toolResult,
      text: opts.text,
      reasoning: opts.reasoning,
      usage: opts.tokens ? { promptTokens: opts.tokens, completionTokens: 0 } : undefined,
      timestamp: Date.now(),
    })
  }

  /**
   * Call this at the end of your run to get the full journal.
   */
  finalize(): RunJournal {
    const tensions = this.buildTensions()
    const summary = this.buildSummary(tensions)
    const flags = this.detectFlags(tensions)
    const fieldConf = this.computeFieldConf(tensions)

    return {
      agentId: this.agentId,
      runId: this.runId,
      startTime: this.startTime,
      endTime: Date.now(),
      tensions,
      summary,
      fieldConf,
      flags,
    }
  }

  // ─── Build tensions from steps ───────────────────────────────────

  private buildTensions(): ObservedTension[] {
    const tensions: ObservedTension[] = []
    let stepIdx = 0

    for (const step of this.steps) {
      if (step.stepType === 'finish') continue

      const reasoningText = [step.reasoning, step.text].filter(Boolean).join('\n')
      const conf = this.extractor.extractConfidence(reasoningText)
      const doubts = this.extractor.extractDoubts(reasoningText)
      const decisions = this.extractor.extractDecision(reasoningText, step.toolName, step.toolInput)
      const knew = this.extractor.extractKnowledge(step.toolResult, step.toolName)
      const wants = this.extractor.extractWants(reasoningText, step.toolName)
      const state = this.extractor.inferState(decisions, doubts, conf)

      const id = step.toolName
        ? `step_${stepIdx}_${step.toolName}`
        : `step_${stepIdx}_text`

      tensions.push({
        id,
        toolName: step.toolName,
        wants,
        knew,
        doubts,
        decided: decisions,
        confidence: conf,
        state,
        rawReasoning: reasoningText.slice(0, 500),
        tokens: (step.usage?.promptTokens ?? 0) + (step.usage?.completionTokens ?? 0),
      })

      stepIdx++
    }

    return tensions
  }

  // ─── Flags — anomaly detection ────────────────────────────────────

  private detectFlags(tensions: ObservedTension[]): JournalFlag[] {
    const flags: JournalFlag[] = []

    // Confidence drop between consecutive steps
    for (let i = 1; i < tensions.length; i++) {
      const drop = tensions[i - 1].confidence - tensions[i].confidence
      if (drop > 0.25) {
        flags.push({
          kind: 'confidence_drop',
          step: tensions[i].id,
          detail: `Confidence dropped ${(drop * 100).toFixed(0)}% from "${tensions[i - 1].id}" (${(tensions[i - 1].confidence * 100).toFixed(0)}%) to "${tensions[i].id}" (${(tensions[i].confidence * 100).toFixed(0)}%)`,
          severity: drop > 0.40 ? 'error' : 'warning',
        })
      }
    }

    // Blocking doubt not followed by resolution
    for (let i = 0; i < tensions.length - 1; i++) {
      const t = tensions[i]
      const blockingDoubt = t.doubts.find(d => d.severity === 'blocking')
      if (blockingDoubt && tensions[i + 1].state !== 'resisting') {
        flags.push({
          kind: 'blocking_doubt_ignored',
          step: t.id,
          detail: `Step "${t.id}" had a blocking doubt on "${blockingDoubt.about}" but the run continued without resolving it`,
          severity: 'error',
        })
      }
    }

    // Low confidence decision
    for (const t of tensions) {
      if (t.state === 'resolved' && t.confidence < 0.45) {
        flags.push({
          kind: 'low_confidence_decision',
          step: t.id,
          detail: `"${t.id}" decided with only ${(t.confidence * 100).toFixed(0)}% confidence — output quality may be unreliable`,
          severity: 'warning',
        })
      }
    }

    // High token step
    const avgTokens = tensions.reduce((s, t) => s + t.tokens, 0) / (tensions.length || 1)
    for (const t of tensions) {
      if (t.tokens > avgTokens * 2.5 && t.tokens > 1000) {
        flags.push({
          kind: 'high_token_step',
          step: t.id,
          detail: `"${t.id}" used ${t.tokens} tokens — ${(t.tokens / avgTokens).toFixed(1)}x the average. Consider if this step can be simplified.`,
          severity: 'info',
        })
      }
    }

    // Repeated doubt across steps (the agent doesn't resolve its uncertainties)
    const doubtCounts: Record<string, number> = {}
    for (const t of tensions) {
      for (const d of t.doubts) {
        const key = d.about.slice(0, 30)
        doubtCounts[key] = (doubtCounts[key] ?? 0) + 1
      }
    }
    for (const [doubt, count] of Object.entries(doubtCounts)) {
      if (count >= 3) {
        flags.push({
          kind: 'repeated_doubt',
          step: 'multiple',
          detail: `Doubt "${doubt}" appeared ${count} times across steps — the agent never resolved this uncertainty`,
          severity: 'warning',
        })
      }
    }

    return flags
  }

  private buildSummary(tensions: ObservedTension[]): RunSummary {
    const toolCalls = tensions.filter(t => t.toolName).length
    const resolved = tensions.filter(t => t.state === 'resolved').length
    const resisting = tensions.filter(t => t.state === 'resisting').length
    const uncertain = tensions.filter(t => t.state === 'uncertain' || t.state === 'partial').length
    const totalTokens = tensions.reduce((s, t) => s + t.tokens, 0)
    const avgConf = tensions.length > 0
      ? tensions.reduce((s, t) => s + t.confidence, 0) / tensions.length
      : 0

    const lowestConfStep = tensions.length > 0
      ? tensions.reduce((a, b) => a.confidence < b.confidence ? a : b).id
      : null

    const highestRiskStep = tensions
      .filter(t => t.decided.some(d => d.risk === 'high'))
      .map(t => t.id)[0] ?? null

    return {
      totalSteps: tensions.length,
      toolCallCount: toolCalls,
      totalTokens,
      resolved,
      resisting,
      uncertain,
      avgConfidence: avgConf,
      lowestConfStep,
      highestRisk: highestRiskStep,
    }
  }

  private computeFieldConf(tensions: ObservedTension[]): number {
    if (tensions.length === 0) return 0
    const resolved = tensions.filter(t => t.state === 'resolved')
    if (resolved.length === 0) return 0
    return resolved.reduce((s, t) => s + t.confidence, 0) / tensions.length
  }
}

// ═══════════════════════════════════════════════════════════════════
// RENDERER — Human-readable journal output
// ═══════════════════════════════════════════════════════════════════

export function renderJournal(journal: RunJournal): string {
  const lines: string[] = []
  const { summary, flags } = journal
  const duration = journal.endTime - journal.startTime

  lines.push('╔══════════════════════════════════════════════════════════╗')
  lines.push(`║  ONTO RUN JOURNAL  ·  ${journal.agentId.padEnd(34)}║`)
  lines.push('╚══════════════════════════════════════════════════════════╝')
  lines.push('')
  lines.push(`  Run ID         : ${journal.runId}`)
  lines.push(`  Duration        : ${duration}ms`)
  lines.push(`  Steps           : ${summary.totalSteps} (${summary.toolCallCount} tool calls)`)
  lines.push(`  Total tokens    : ${summary.totalTokens.toLocaleString()}`)
  lines.push(`  Field confidence: ${(journal.fieldConf * 100).toFixed(1)}%`)
  lines.push(`  Resolved        : ${summary.resolved} / ${summary.totalSteps}`)
  lines.push('')

  // Flags
  if (flags.length > 0) {
    const errors = flags.filter(f => f.severity === 'error')
    const warnings = flags.filter(f => f.severity === 'warning')
    const infos = flags.filter(f => f.severity === 'info')

    if (errors.length > 0) {
      lines.push('  ✕ ANOMALIES DETECTED')
      for (const f of errors) lines.push(`    [${f.kind}] ${f.detail}`)
      lines.push('')
    }
    if (warnings.length > 0) {
      lines.push('  ⚠ WARNINGS')
      for (const f of warnings) lines.push(`    [${f.kind}] ${f.detail}`)
      lines.push('')
    }
    if (infos.length > 0) {
      lines.push('  ∷ INFO')
      for (const f of infos) lines.push(`    [${f.kind}] ${f.detail}`)
      lines.push('')
    }
  } else {
    lines.push('  ✓ No anomalies detected\n')
  }

  // Per-step tensions
  lines.push('  ── STEP REASONING TRACE ──')
  for (const t of journal.tensions) {
    const stateIcon = t.state === 'resolved' ? '✓'
      : t.state === 'resisting' ? '✕'
        : t.state === 'partial' ? '◑'
          : '?'
    const bar = '█'.repeat(Math.round(t.confidence * 10)) + '░'.repeat(10 - Math.round(t.confidence * 10))

    lines.push('')
    lines.push(`  ${stateIcon} ${t.id}`)
    lines.push(`    wants    : ${t.wants}`)
    lines.push(`    conf     : [${bar}] ${(t.confidence * 100).toFixed(0)}%`)

    if (t.knew.length > 0) {
      lines.push(`    knew     : ${t.knew.map(k => k.fact).join(', ')}`)
    }
    if (t.doubts.length > 0) {
      lines.push(`    doubts   : ${t.doubts.map(d => `${d.about.slice(0, 40)} (${d.severity})`).join(' | ')}`)
    }
    if (t.decided.length > 0) {
      lines.push(`    decided  : ${t.decided.map(d => `${d.choice} ~risk(${d.risk})`).join(' | ')}`)
    }
    if (t.tokens > 0) {
      lines.push(`    tokens   : ${t.tokens}`)
    }
  }

  lines.push('')
  lines.push('  ── ONTO FIELD SUMMARY ──')
  lines.push(`  The agent's reasoning across ${summary.totalSteps} steps`)
  lines.push(`  is now a structured, auditable field.`)

  if (summary.lowestConfStep) {
    lines.push(`  Weakest step    : ${summary.lowestConfStep}`)
  }
  if (summary.highestRisk) {
    lines.push(`  Highest risk    : ${summary.highestRisk}`)
  }

  return lines.join('\n')
}
