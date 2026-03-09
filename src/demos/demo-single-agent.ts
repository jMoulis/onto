// ═══════════════════════════════════════════════════════════════════
// DEMO — The medical triage program from the manifesto, running live
// ═══════════════════════════════════════════════════════════════════

import { Confidence, OntoBuilder, OntoEngine, renderEquilibrium } from "../core/onto-engine.js"

export function runMedicalTriageDemo(): void {
  console.log('\n∷ Running: Emergency Medical Triage — Onto v0.1\n')

  const field = new OntoBuilder()

    // Shared situational knowledge
    .know('heart_rate', 142, { from: 'sensor', confidence: 0.99 })
    .know('pressure', '90/60', { from: 'manual_reading', confidence: 0.85, validFor: 120_000 })

    // patient_state — what we know about the patient
    .tension('patient_state', {
      wants: 'establish current patient condition',
      priority: 0.9,
      doubts: [
        { about: 'unknown_allergies', severity: 'blocking', blocksPath: ['epinephrine'] },
        { about: 'pressure_freshness', severity: 'medium' },
      ],
      resolves: [{
        kind: 'success',
        outcome: { status: 'critical', indicators: ['tachycardia', 'hypotension'] },
        confidence: 0.91 as Confidence,
        risk: 'low',
      }]
    })

    // diagnosis — depends on patient_state
    .tension('diagnosis', {
      wants: 'identify cause of tachycardia',
      priority: 0.8,
      linkedTo: ['patient_state'],
      resolves: [
        {
          kind: 'success',
          outcome: 'hypovolemic_shock',
          confidence: 0.74 as Confidence,
          risk: 'low',
        },
        {
          kind: 'partial',
          outcome: 'arrhythmia_possible',
          confidence: 0.51 as Confidence,
          missing: ['ECG', 'blood_panel'],
          pendingOn: ['lab_results'],
        }
      ]
    })

    // treatment — depends on diagnosis, blocked by unknown allergies
    .tension('treatment', {
      wants: 'stabilize patient immediately',
      priority: 1.0,
      linkedTo: ['diagnosis', 'patient_state'],
      doubts: [
        { about: 'unknown_allergies', severity: 'blocking', blocksPath: ['epinephrine'] },
      ],
      resolves: [
        {
          kind: 'success',
          outcome: 'saline_IV + oxygen',
          confidence: 0.91 as Confidence,
          risk: 'low',
        },
        {
          kind: 'blocked',
          blockedBy: 'unknown_allergies',
          liftWhen: 'allergies confirmed absent',
        }
      ]
    })

    .build()

  const engine = new OntoEngine()
  const equilibrium = engine.equilibrate(field)

  console.log(renderEquilibrium(equilibrium))
}

// Run if executed directly
runMedicalTriageDemo()