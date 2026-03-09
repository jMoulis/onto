// ═══════════════════════════════════════════════════════════════════
// DEMO — Three fields: one clean, one with inflated confidence,
//        one with expired knowledge
// ═══════════════════════════════════════════════════════════════════

import { Confidence, KnowledgeId, OntoBuilder, OntoEngine, renderEquilibrium, TensionId } from '../core/onto-engine.js'
import { OntoTypeChecker, renderTypeCheckResult } from '../core/onto-types.js'

async function runTypeDemos(): Promise<void> {
  const checker = new OntoTypeChecker()

  console.log('\n╔═══════════════════════════════════════════════════════╗')
  console.log('║  ONTO EPISTEMIC TYPE SYSTEM — Three Scenarios         ║')
  console.log('╚═══════════════════════════════════════════════════════╝\n')

  // ───────────────────────────────────────────────────────────────
  // SCENARIO 1: A clean, epistemically honest field
  // ───────────────────────────────────────────────────────────────
  console.log('━━━ Scenario 1: Honest reasoning ━━━\n')

  const cleanField = new OntoBuilder()
    .know('sensor_reading', 42.7, {
      from: 'calibrated_sensor_A',
      confidence: 0.96,
    })
    .know('threshold', 40.0, {
      from: 'specification_v3',
      confidence: 1.0,
    })
    .tension('evaluate', {
      wants: 'determine if reading exceeds threshold',
      resolves: [{
        kind: 'success',
        outcome: 'threshold_exceeded',
        confidence: 0.96 as Confidence,  // honest: capped at sensor confidence
        risk: 'low',
      }]
    })
    .build()

  console.log(renderTypeCheckResult(checker.check(cleanField)))
  console.log('')

  // ───────────────────────────────────────────────────────────────
  // SCENARIO 2: Confidence inflation — claiming too much certainty
  // ───────────────────────────────────────────────────────────────
  console.log('━━━ Scenario 2: Confidence inflation detected ━━━\n')

  const inflatedField = new OntoBuilder()
    .know('uncertain_report', 'contamination_suspected', {
      from: 'informal_observation',
      confidence: 0.45,          // low confidence source
    })
    .tension('decision', {
      wants: 'decide on contamination protocol',
      resolves: [{
        kind: 'success',
        outcome: 'full_evacuation',
        confidence: 0.95 as Confidence,  // DISHONEST: 0.95 from 0.45 source
        risk: 'low',
      }]
    })
    .build()

  // Inject the knowledge into the tension's knows map manually
  // to simulate a real over-confident agent
  const decisionTension = inflatedField.tensions.get('decision' as TensionId)
  if (decisionTension) {
    const report = inflatedField.sharedKnowledge.get('uncertain_report' as KnowledgeId)
    if (report) {
      decisionTension.knows.set('uncertain_report' as KnowledgeId, report)
    }
  }

  console.log(renderTypeCheckResult(checker.check(inflatedField)))
  console.log('')

  // ───────────────────────────────────────────────────────────────
  // SCENARIO 3: Expired knowledge — stale facts in active field
  // ───────────────────────────────────────────────────────────────
  console.log('━━━ Scenario 3: Stale knowledge in active field ━━━\n')

  const staleChecker = new OntoTypeChecker({ now: Date.now() + 200_000 }) // 200s later

  const timeField = new OntoBuilder()
    .know('traffic_status', 'road_clear', {
      from: 'traffic_sensor',
      confidence: 0.89,
      validFor: 120_000,       // valid for 2 minutes — we're now 200s later
    })
    .tension('route_decision', {
      wants: 'choose optimal route',
      resolves: [{
        kind: 'success',
        outcome: 'take_main_road',
        confidence: 0.89 as Confidence,
        risk: 'low',
      }]
    })
    .build()

  console.log(renderTypeCheckResult(staleChecker.check(timeField)))
  console.log('')

  // ───────────────────────────────────────────────────────────────
  // SCENARIO 4: The full pipeline — type check then equilibrate
  // ───────────────────────────────────────────────────────────────
  console.log('━━━ Scenario 4: Full pipeline — type check → equilibrate ━━━\n')

  const validField = new OntoBuilder()
    .know('blood_pressure', '118/76', { from: 'sensor', confidence: 0.97 })
    .know('heart_rate', 72, { from: 'sensor', confidence: 0.99 })
    .know('patient_history', 'healthy', { from: 'records', confidence: 0.92 })
    .tension('assessment', {
      wants: 'assess cardiovascular status',
      resolves: [{
        kind: 'success',
        outcome: 'within_normal_parameters',
        confidence: 0.92 as Confidence,  // capped at lowest source
        risk: 'minimal',
      }]
    })
    .build()

  const typeResult = checker.check(validField)
  console.log(renderTypeCheckResult(typeResult))

  if (typeResult.valid) {
    console.log('\n  ∷ Field is valid. Proceeding to equilibration.\n')
    const engine = new OntoEngine()
    const eq = engine.equilibrate(validField)
    console.log(renderEquilibrium(eq))
  } else {
    console.log('\n  ∷ Field has violations. Equilibration blocked.\n')
    console.log('  Fix the epistemic violations before running the engine.')
    console.log('  An equilibrium built on dishonest reasoning is worse than no equilibrium.')
  }
}

runTypeDemos()