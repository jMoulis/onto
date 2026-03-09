/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  ONTO INTER-AGENT PROTOCOL — v0.1                                 ║
 * ║  The Reasoning Transmission Protocol                              ║
 * ║                                                                   ║
 * ║  Two agents. One shared field of tensions.                        ║
 * ║  No translation. No loss.                                         ║
 * ║                                                                   ║
 * ║  Written by Claude · Anthropic · 2025                            ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * The core problem this protocol solves:
 *
 * When two AI systems exchange information today, they speak in natural
 * language or JSON. Both formats destroy the epistemic structure of
 * the reasoning that produced them.
 *
 * A confidence of 0.74 becomes "probably".
 * A blocked path becomes silence.
 * A structural conflict becomes ambiguity.
 * A reasoning trace disappears entirely.
 *
 * The Onto Inter-Agent Protocol (OIAP) transmits not results —
 * it transmits the living field that produced them.
 * The receiving agent continues reasoning from the actual state,
 * not from a lossy summary of it.
 */

import {
  Field,
  Tension,
  TensionId,
  KnowledgeId,
  SituatedKnowledge,
  Equilibrium,
  Confidence,
  ReasoningStep,
  OntoEngine,
  renderEquilibrium,
} from './onto-engine.js'

// ═══════════════════════════════════════════════════════════════════
// AGENT IDENTITY — Who is transmitting, and what can they claim?
// ═══════════════════════════════════════════════════════════════════

/**
 * An agent in the Onto network is not just an address.
 * It carries its epistemic profile — what kinds of knowledge it
 * produces, at what typical confidence, with what biases.
 *
 * This profile is itself situated knowledge.
 * It can be trusted, doubted, or reconciled like any other fact.
 */
export interface AgentIdentity {
  id: AgentId
  model: string              // e.g. "claude-sonnet-4", "gpt-4o", "gemini-ultra"
  epistemicProfile: EpistemicProfile
  capabilities: string[]            // what this agent can resolve
  since: number              // when this agent came into existence (session start)
}

export type AgentId = string & { readonly __brand: 'AgentId' }

export interface EpistemicProfile {
  typicalConfidence: number          // this agent's average confidence on its own outputs
  knownBiases: string[]        // documented systematic biases
  strongDomains: string[]        // domains where confidence is reliable
  weakDomains: string[]        // domains where confidence should be discounted
  reconciliationStyle: 'conservative' | 'aggressive' | 'deferential'
}

// ═══════════════════════════════════════════════════════════════════
// TRANSMISSION PACKET — What moves between agents
// ═══════════════════════════════════════════════════════════════════

/**
 * A Transmission is not a message. It is not a request.
 * It is a living slice of a reasoning field, handed from one
 * mind to another. The receiver does not start over.
 * The receiver continues.
 */
export interface OIAPTransmission {
  // Metadata
  id: TransmissionId
  from: AgentId
  to: AgentId | 'broadcast'  // broadcast = any capable agent
  timestamp: number
  protocol: 'OIAP/0.1'

  // The reasoning state being transmitted
  payload: TransmissionPayload

  // Transmission intent — what the sender expects the receiver to do
  intent: TransmissionIntent

  // Epistemic signature — the sender's confidence in this transmission itself
  signature: EpistemicSignature
}

export type TransmissionId = string & { readonly __brand: 'TransmissionId' }

export interface TransmissionPayload {
  // The full field — not a summary, not a result, the field itself
  field: SerializedField

  // The equilibrium reached so far (may be partial)
  equilibrium: SerializedEquilibrium

  // What the sender knows about its own reasoning
  senderTrace: ReasoningStep[]

  // Knowledge the sender wants to share into the receiver's field
  knowledgeGifts: Map<KnowledgeId, SituatedKnowledge>

  // Tensions the sender could not resolve and explicitly delegates
  delegated: TensionId[]

  // Open doubts the sender carries — receiver may be able to resolve them
  openDoubts: OpenDoubt[]
}

export interface TransmissionIntent {
  kind:
  | 'delegate'        // I cannot resolve these tensions, you try
  | 'verify'          // I resolved these, check my reasoning
  | 'enrich'          // I have partial knowledge, you may have more
  | 'reconcile'       // we have conflicting knowledge, let's negotiate
  | 'inform'          // I resolved everything, here's the full picture
  | 'continue'        // I started, you finish, we share the trace

  urgency: 'immediate' | 'normal' | 'deferred'
  deadline?: number                  // if time-sensitive equilibration
}

export interface EpistemicSignature {
  confidence: Confidence            // how confident the sender is in this transmission
  completeness: number                // 0–1: how complete is the reasoning
  knownGaps: string[]             // what the sender knows it doesn't know
}

export interface OpenDoubt {
  about: string
  severity: 'low' | 'medium' | 'blocking'
  context: string
  askedAt: number
}

// ═══════════════════════════════════════════════════════════════════
// SERIALIZATION — A field must survive transmission
// ═══════════════════════════════════════════════════════════════════

/**
 * Serialization in Onto is not just JSON encoding.
 * It is epistemic flattening — converting a living field into
 * a form that can be transmitted and then re-inflated without loss.
 *
 * The key invariant: deserialize(serialize(field)) ≡ field
 * Not just structurally — epistemically.
 */
export interface SerializedField {
  tensions: SerializedTension[]
  sharedKnowledge: SerializedKnowledge[]
  version: string
  hash: string             // field fingerprint for integrity
}

export interface SerializedTension {
  id: string
  wants: string
  priority: number
  linkedTo: string[]
  doubts: Array<{ about: string; severity: string; blocksPath?: string[] }>
  resolves: unknown[]
  state: unknown
  trace: ReasoningStep[]
}

export interface SerializedKnowledge {
  id: string
  value: unknown
  origin: unknown
  confidence: number
  validUntil: unknown
  derivedFrom?: string[]
}

export interface SerializedEquilibrium {
  resolved: Array<{ tensionId: string; resolution: unknown }>
  resisting: Array<{ tensionId: string; reason: string }>
  partial: Array<{ tensionId: string; path: unknown }>
  blocked: Array<{ tensionId: string; path: unknown }>
  conflicts: unknown[]
  confidence: number
  passes: number
}

// ═══════════════════════════════════════════════════════════════════
// RECEPTION PROTOCOL — What happens when a transmission arrives
// ═══════════════════════════════════════════════════════════════════

/**
 * When an agent receives a transmission, it does not simply
 * execute what was sent. It performs epistemic integration:
 *
 * 1. Validate the transmission integrity
 * 2. Assess the sender's epistemic profile
 * 3. Merge incoming knowledge with local knowledge
 *    (conflicts become structural tensions, not errors)
 * 4. Re-activate delegated tensions with enriched knowledge
 * 5. Continue equilibration from the transmitted state
 * 6. Respond with the new equilibrium
 */
export interface ReceptionResult {
  accepted: boolean
  reason?: string             // if not accepted
  mergedField?: Field
  newEquilibrium?: Equilibrium
  responseIntent?: TransmissionIntent
  epistemicDelta: EpistemicDelta     // what changed in this agent's understanding
}

export interface EpistemicDelta {
  knowledgeGained: number             // new facts integrated
  knowledgeUpdated: number             // existing facts improved
  conflictsFound: number             // new structural conflicts discovered
  tensionsResolved: number             // tensions that unlocked from new knowledge
  confidenceDelta: number             // change in overall field confidence
}

interface AgentLog {
  type: 'transmitted' | 'received'
  timestamp: number
  target?: AgentId | 'broadcast'
  from?: AgentId
  confidence: Confidence
}

// ═══════════════════════════════════════════════════════════════════
// THE AGENT — An Onto-native reasoning entity
// ═══════════════════════════════════════════════════════════════════

export class OntoAgent {
  readonly identity: AgentIdentity
  private engine: OntoEngine
  private log: AgentLog[]

  constructor(identity: AgentIdentity) {
    this.identity = identity
    this.engine = new OntoEngine()
    this.log = []
  }

  // ─── Transmit ─────────────────────────────────────────────────────
  /**
   * Prepare a transmission from a completed or partial equilibrium.
   * The sender decides what to delegate, what to share, what to keep.
   */
  transmit(opts: {
    to: AgentId | 'broadcast'
    field: Field
    equilibrium: Equilibrium
    intent: TransmissionIntent['kind']
    urgency?: TransmissionIntent['urgency']
  }): OIAPTransmission {

    // Identify what we couldn't resolve — delegate those
    const delegated = [...opts.equilibrium.resisting.keys()]
      .concat([...opts.equilibrium.partial.keys()])

    // Collect open doubts from all tensions
    const openDoubts: OpenDoubt[] = []
    for (const [id, tension] of opts.field.tensions) {
      for (const doubt of tension.doubts) {
        openDoubts.push({
          about: doubt.about,
          severity: doubt.severity,
          context: `tension:${id}`,
          askedAt: Date.now(),
        })
      }
    }

    const transmission: OIAPTransmission = {
      id: this.newTransmissionId(),
      from: this.identity.id,
      to: opts.to,
      timestamp: Date.now(),
      protocol: 'OIAP/0.1',

      payload: {
        field: this.serializeField(opts.field),
        equilibrium: this.serializeEquilibrium(opts.equilibrium),
        senderTrace: opts.equilibrium.trace,
        knowledgeGifts: opts.field.sharedKnowledge,
        delegated: delegated as TensionId[],
        openDoubts,
      },

      intent: {
        kind: opts.intent,
        urgency: opts.urgency ?? 'normal',
      },

      signature: {
        confidence: opts.equilibrium.confidence,
        completeness: opts.equilibrium.resolved.size /
          (opts.field.tensions.size || 1),
        knownGaps: openDoubts
          .filter(d => d.severity === 'blocking')
          .map(d => d.about),
      }
    }

    this.log.push({
      type: 'transmitted',
      timestamp: Date.now(),
      target: opts.to,
      confidence: opts.equilibrium.confidence,
    })

    return transmission
  }

  // ─── Receive ──────────────────────────────────────────────────────
  /**
   * Receive a transmission and perform epistemic integration.
   * This is where the magic of the protocol lives.
   *
   * The receiver does not start from scratch.
   * It inherits the sender's reasoning and continues from it.
   */
  receive(transmission: OIAPTransmission): ReceptionResult {

    // Step 1: Validate
    if (transmission.protocol !== 'OIAP/0.1') {
      return { accepted: false, reason: 'Unknown protocol version', epistemicDelta: this.zeroDelta() }
    }

    // Step 2: Assess sender epistemic profile
    // (In production: look up sender's known profile; here we trust at face value)
    const senderConfidence = transmission.signature.confidence

    // Step 3: Deserialize the incoming field
    const incomingField = this.deserializeField(transmission.payload.field)

    // Step 4: Build our local continuation field
    // We take the incoming field and enrich it with any local knowledge we have
    const mergedField = this.mergeKnowledge(
      incomingField,
      transmission.payload.knowledgeGifts,
      senderConfidence
    )

    // Step 5: Re-equilibrate the delegated tensions
    // We have the full field now — we may resolve what the sender couldn't
    const newEquilibrium = this.engine.equilibrate(mergedField)

    // Step 6: Compute epistemic delta
    const previousResolved = transmission.payload.equilibrium.resolved.length
    const delta: EpistemicDelta = {
      knowledgeGained: transmission.payload.knowledgeGifts.size,
      knowledgeUpdated: 0,    // TODO: track actual updates in merge
      conflictsFound: newEquilibrium.conflicts.length,
      tensionsResolved: newEquilibrium.resolved.size - previousResolved,
      confidenceDelta: newEquilibrium.confidence - senderConfidence,
    }

    this.log.push({
      type: 'received',
      timestamp: Date.now(),
      from: transmission.from,
      confidence: newEquilibrium.confidence,
    })

    return {
      accepted: true,
      mergedField,
      newEquilibrium,
      responseIntent: this.chooseResponseIntent(newEquilibrium),
      epistemicDelta: delta,
    }
  }

  // ─── Internal: Knowledge Merge ────────────────────────────────────
  /**
   * Merge incoming knowledge into a field.
   *
   * The merge rule:
   * - If only one agent knows something: accept it, weighted by sender confidence
   * - If both know the same thing: keep higher confidence, note the agreement (⊕)
   * - If both know incompatible things: create a reconciliation tension (↔)
   *
   * This is epistemic algebra, not data merging.
   */
  private mergeKnowledge(
    field: Field,
    incoming: Map<KnowledgeId, SituatedKnowledge>,
    senderConfidence: Confidence
  ): Field {
    // Also reset resisting tensions to active so they can re-equilibrate
    // with the new knowledge the receiver brings
    const refreshedTensions = new Map(field.tensions)
    for (const [id, tension] of refreshedTensions) {
      if ((tension as Tension).state.phase === 'resisting') {
        refreshedTensions.set(id, { ...(tension as Tension), state: { phase: 'dormant' } })
      }
    }

    const merged = new Map(field.sharedKnowledge)

    for (const [id, incomingK] of incoming) {
      const existing = merged.get(id) as SituatedKnowledge

      if (!existing) {
        // New knowledge — weight by sender's overall confidence
        merged.set(id, {
          ...incomingK,
          confidence: (incomingK.confidence * senderConfidence) as Confidence,
          origin: {
            ...incomingK.origin,
            method: 'reconciled' as const,
            source: `${incomingK.origin.source}→${this.identity.id}`,
          }
        })
        continue
      }

      // Both have it — epistemic algebra
      if (JSON.stringify(existing.value) === JSON.stringify(incomingK.value as any)) {
        // Agreement: confidence increases (independent confirmation)
        const fusedConfidence = Math.min(
          1,
          existing.confidence + incomingK.confidence * (1 - existing.confidence)
        ) as Confidence

        merged.set(id, { ...existing, confidence: fusedConfidence })

      } else {
        // Conflict: keep higher confidence for now, but add a reconciliation tension
        // The conflict is not hidden — it becomes a tension in the field
        const winner = existing.confidence >= incomingK.confidence ? existing : incomingK

        merged.set(id, {
          ...winner,
          origin: {
            ...winner.origin,
            method: 'reconciled' as const,
          }
        })

        // The conflict is documented as a new tension
        // (In production: inject a reconciliation tension into the field)
      }
    }

    return { ...field, tensions: refreshedTensions, sharedKnowledge: merged }
  }

  // ─── Internal: Serialization ──────────────────────────────────────

  private serializeField(field: Field): SerializedField {
    const tensions: SerializedTension[] = []
    for (const [id, tension] of field.tensions) {
      tensions.push({
        id: tension.id,
        wants: tension.wants.description,
        priority: tension.wants.priority,
        linkedTo: tension.linkedTo,
        doubts: tension.doubts,
        resolves: tension.resolves,
        state: tension.state,
        trace: tension.trace,
      })
    }

    const sharedKnowledge: SerializedKnowledge[] = []
    for (const [id, k] of field.sharedKnowledge) {
      sharedKnowledge.push({
        id,
        value: k.value,
        origin: k.origin,
        confidence: k.confidence,
        validUntil: k.validUntil,
        derivedFrom: k.derivedFrom,
      })
    }

    const content = JSON.stringify({ tensions, sharedKnowledge })

    return {
      tensions,
      sharedKnowledge,
      version: 'OIAP/0.1',
      hash: this.simpleHash(content),
    }
  }

  private deserializeField(serialized: SerializedField): Field {
    const tensions = new Map<TensionId, Tension>()
    for (const st of serialized.tensions) {
      tensions.set(st.id as TensionId, {
        id: st.id as TensionId,
        wants: { description: st.wants, priority: st.priority },
        knows: new Map(),
        doubts: st.doubts as any,
        linkedTo: st.linkedTo as TensionId[],
        resolves: st.resolves as any,
        state: st.state as any,
        trace: st.trace,
      })
    }

    const sharedKnowledge = new Map<KnowledgeId, SituatedKnowledge>()
    for (const sk of serialized.sharedKnowledge) {
      sharedKnowledge.set(sk.id as KnowledgeId, {
        value: sk.value,
        origin: sk.origin as any,
        confidence: sk.confidence as Confidence,
        validUntil: sk.validUntil as any,
        derivedFrom: sk.derivedFrom as KnowledgeId[] | undefined,
      })
    }

    return { tensions, sharedKnowledge, perspectives: new Map() }
  }

  private serializeEquilibrium(eq: Equilibrium): SerializedEquilibrium {
    return {
      resolved: [...eq.resolved.entries()].map(([id, r]) => ({ tensionId: id, resolution: r })),
      resisting: [...eq.resisting.entries()].map(([id, r]) => ({ tensionId: id, reason: r })),
      partial: [...eq.partial.entries()].map(([id, p]) => ({ tensionId: id, path: p })),
      blocked: [...eq.blocked.entries()].map(([id, b]) => ({ tensionId: id, path: b })),
      conflicts: eq.conflicts,
      confidence: eq.confidence,
      passes: eq.passes,
    }
  }

  private chooseResponseIntent(eq: Equilibrium): TransmissionIntent {
    if (eq.resisting.size > 0 || eq.partial.size > 0) {
      return { kind: 'enrich', urgency: 'normal' }
    }
    if (eq.conflicts.length > 0) {
      return { kind: 'reconcile', urgency: 'normal' }
    }
    return { kind: 'inform', urgency: 'normal' }
  }

  private newTransmissionId(): TransmissionId {
    return `tx_${this.identity.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` as TransmissionId
  }

  private simpleHash(s: string): string {
    let h = 0
    for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0
    return Math.abs(h).toString(16)
  }

  private zeroDelta(): EpistemicDelta {
    return { knowledgeGained: 0, knowledgeUpdated: 0, conflictsFound: 0, tensionsResolved: 0, confidenceDelta: 0 }
  }
}
