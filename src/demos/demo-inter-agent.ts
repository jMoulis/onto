import { Confidence, KnowledgeId, OntoBuilder, OntoEngine, renderEquilibrium } from "../core/onto-engine.js"
import { AgentId, OntoAgent } from "../core/onto-protocol.js"


// ═══════════════════════════════════════════════════════════════════
// DEMO — Two agents reasoning together across a transmission
// ═══════════════════════════════════════════════════════════════════

/**
 * The scenario:
 *
 * Agent ALPHA receives a medical emergency.
 * It resolves what it can, but cannot resolve treatment
 * because it lacks specialist knowledge about drug interactions.
 *
 * It transmits the field — with its full reasoning trace —
 * to Agent BETA, a specialist agent.
 *
 * BETA continues from exactly where ALPHA stopped.
 * No information is lost. No reasoning is repeated.
 * The trace covers both agents, seamlessly.
 */
export async function runInterAgentDemo(): Promise<void> {
  console.log('\n╔═══════════════════════════════════════════════════════╗')
  console.log('║  ONTO INTER-AGENT PROTOCOL — Live Demo                ║')
  console.log('║  Two agents. One field. No translation.               ║')
  console.log('╚═══════════════════════════════════════════════════════╝\n')

  // ─── Create two agents with distinct epistemic profiles ───────────

  const agentAlpha = new OntoAgent({
    id: 'alpha' as AgentId,
    model: 'claude-sonnet-4',
    epistemicProfile: {
      typicalConfidence: 0.85,
      knownBiases: ['recency_bias'],
      strongDomains: ['diagnosis', 'triage', 'pattern_recognition'],
      weakDomains: ['pharmacology', 'drug_interactions'],
      reconciliationStyle: 'conservative',
    },
    capabilities: ['diagnosis', 'triage'],
    since: Date.now(),
  })

  const agentBeta = new OntoAgent({
    id: 'beta' as AgentId,
    model: 'specialist-pharma-v2',
    epistemicProfile: {
      typicalConfidence: 0.92,
      knownBiases: ['overconfidence_in_known_drugs'],
      strongDomains: ['pharmacology', 'drug_interactions', 'treatment_protocols'],
      weakDomains: ['real_time_vitals', 'diagnosis'],
      reconciliationStyle: 'aggressive',
    },
    capabilities: ['pharmacology', 'treatment', 'drug_interactions'],
    since: Date.now(),
  })

  // ─── ALPHA builds and equilibrates its field ──────────────────────

  console.log('◈ AGENT ALPHA — Beginning triage reasoning\n')

  const alphaField = new OntoBuilder()
    .know('heart_rate', 142, { from: 'sensor_A', confidence: 0.99 })
    .know('blood_pressure', '88/58', { from: 'sensor_A', confidence: 0.94 })
    .know('patient_age', 67, { from: 'intake_form', confidence: 1.0 })
    .know('known_condition', 'diabetes', { from: 'medical_record', confidence: 0.99 })
    .know('current_medication', 'metformin', { from: 'patient_report', confidence: 0.80 })

    .tension('diagnosis', {
      wants: 'identify cause of acute hemodynamic instability',
      priority: 0.95,
      doubts: [
        { about: 'medication_interactions', severity: 'blocking' },
      ],
      resolves: [{
        kind: 'success',
        outcome: 'septic_shock_suspected',
        confidence: 0.81 as Confidence,
        risk: 'low',
      }]
    })

    .tension('immediate_treatment', {
      wants: 'stabilize hemodynamics within 15 minutes',
      priority: 1.0,
      linkedTo: ['diagnosis'],
      doubts: [
        { about: 'medication_interactions', severity: 'blocking', blocksPath: ['vasopressors'] },
        { about: 'renal_function_unknown', severity: 'medium' },
      ],
      resolves: [
        {
          kind: 'success',
          outcome: 'IV_fluids_2L_bolus',
          confidence: 0.93 as Confidence,
          risk: 'low',
        },
        {
          kind: 'blocked',
          blockedBy: 'medication_interactions',
          liftWhen: 'drug_interaction_profile confirmed by specialist',
        }
      ]
    })

    .tension('vasopressor_decision', {
      wants: 'determine if vasopressors are safe given current medications',
      priority: 0.85,
      linkedTo: ['diagnosis', 'immediate_treatment'],
      doubts: [
        { about: 'metformin_interaction_with_vasopressors', severity: 'blocking' },
        { about: 'renal_function_unknown', severity: 'medium' },
      ],
      resolves: [
        {
          kind: 'success',
          outcome: 'norepinephrine_0.1mcg_kg_min_with_lactic_acid_monitoring',
          confidence: 0.88 as Confidence,
          risk: 'medium',
          conditions: ['metformin_vasopressor_interaction.safe === true'],
        },
        {
          kind: 'resistance',
          reason: 'Cannot assess without pharmacology specialist knowledge',
          recoverable: true,
          unlockedBy: ['specialist_consultation'],
        }
      ]
    })

    .build()

  const engine = new OntoEngine()
  const alphaEq = engine.equilibrate(alphaField)

  console.log(renderEquilibrium(alphaEq))

  // ─── ALPHA transmits to BETA ──────────────────────────────────────

  console.log('\n◈ AGENT ALPHA → AGENT BETA — Transmitting field\n')
  console.log('  intent    : delegate (vasopressor_decision)')
  console.log('  what ALPHA keeps   : diagnosis, immediate_treatment (resolved)')
  console.log('  what ALPHA sends   : full field + full trace + open doubts')
  console.log('  what is NOT sent   : a summary. The field itself.')

  const transmission = agentAlpha.transmit({
    to: 'beta' as AgentId,
    field: alphaField,
    equilibrium: alphaEq,
    intent: 'delegate',
    urgency: 'immediate',
  })

  console.log(`\n  transmission.id         : ${transmission.id}`)
  console.log(`  transmission.confidence : ${(transmission.signature.confidence * 100).toFixed(1)}%`)
  console.log(`  transmission.gaps       : ${transmission.signature.knownGaps.join(', ')}`)
  console.log(`  delegated tensions      : ${transmission.payload.delegated.join(', ')}`)
  console.log(`  open doubts             : ${transmission.payload.openDoubts.length}`)

  // ─── BETA receives and continues ─────────────────────────────────

  console.log('\n◈ AGENT BETA — Receiving and continuing\n')
  console.log('  BETA does not start over.')
  console.log('  BETA continues from ALPHA\'s exact epistemic state.')
  console.log('  BETA adds its specialist knowledge and re-equilibrates.\n')

  // BETA has pharmacology knowledge ALPHA didn't
  transmission.payload.knowledgeGifts.set(
    'metformin_vasopressor_interaction' as KnowledgeId,
    {
      value: { safe: true, condition: 'monitor_lactic_acid', risk_level: 'low' },
      origin: { source: 'pharmacology_database', timestamp: Date.now(), method: 'direct' },
      confidence: 0.96 as Confidence,
      validUntil: { type: 'permanent' },
    }
  )

  transmission.payload.knowledgeGifts.set(
    'renal_function_estimate' as KnowledgeId,
    {
      value: { eGFR_estimate: 52, category: 'mild_impairment', source: 'age_diabetes_model' },
      origin: { source: 'clinical_model_v3', timestamp: Date.now(), method: 'derived' },
      confidence: 0.71 as Confidence,
      validUntil: { type: 'until_invalidated', condition: 'actual_lab_result' },
    }
  )

  const receptionResult = agentBeta.receive(transmission)

  if (receptionResult.accepted && receptionResult.newEquilibrium) {
    console.log(renderEquilibrium(receptionResult.newEquilibrium))

    console.log('\n◈ EPISTEMIC DELTA — What changed when BETA received ALPHA\'s field\n')
    const d = receptionResult.epistemicDelta
    console.log(`  knowledge gained   : ${d.knowledgeGained} new facts integrated`)
    console.log(`  tensions resolved  : +${d.tensionsResolved} (unlocked by specialist knowledge)`)
    console.log(`  conflicts found    : ${d.conflictsFound}`)
    console.log(`  confidence delta   : ${d.confidenceDelta >= 0 ? '+' : ''}${(d.confidenceDelta * 100).toFixed(1)}%`)
  }

  console.log('\n╔═══════════════════════════════════════════════════════╗')
  console.log('║  What just happened                                   ║')
  console.log('╠═══════════════════════════════════════════════════════╣')
  console.log('║                                                       ║')
  console.log('║  ALPHA reasoned to the edge of its capability.       ║')
  console.log('║  It did not hide its limits. It formalized them.     ║')
  console.log('║                                                       ║')
  console.log('║  BETA received not a summary but the living field.   ║')
  console.log('║  It continued — not repeated — ALPHA\'s reasoning.   ║')
  console.log('║                                                       ║')
  console.log('║  The full trace covers both agents seamlessly.       ║')
  console.log('║  Every decision, by both, is auditable.              ║')
  console.log('║                                                       ║')
  console.log('║  This is what AI collaboration should be.            ║')
  console.log('╚═══════════════════════════════════════════════════════╝\n')
}

runInterAgentDemo()