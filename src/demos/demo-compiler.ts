// ═══════════════════════════════════════════════════════════════════
// DEMO — Writing Onto in its own syntax for the first time
// ═══════════════════════════════════════════════════════════════════

import { compile } from "../core/onto-compiler.js"
import { OntoEngine, renderEquilibrium } from "../core/onto-engine.js"

const ONTO_SOURCE_DEMO = `
∷ The medical triage program — now written in native Onto syntax
∷ This is the first real Onto source file

know heart_rate = 142 from sensor confidence 0.99
know blood_pressure = "90/60" from sensor confidence 0.94
know known_medication = metformin from patient_report confidence 0.80

tension patient_state ::
  wants → critical_status_assessment
  resolves →
    critical ~ conf(0.91) ~ risk(low)

tension diagnosis ↔ patient_state ::
  wants → identify_cause_of_tachycardia
  linked → patient_state
  resolves →
    hypovolemic_shock ~ conf(0.74) ~ risk(low)
    | arrhythmia_possible ~ conf(0.51) ~ risk(medium)

tension treatment ::
  wants → stabilize_patient_immediately
  priority = 1.0
  linked → diagnosis, patient_state
  doubts → unknown_allergies blocking blocks epinephrine
  resolves →
    saline_IV ~ conf(0.93) ~ risk(low)
    ⊗ epinephrine ∷ blocked until allergies confirmed
`

async function runCompilerDemo(): Promise<void> {
  console.log('\n╔═══════════════════════════════════════════════════════╗')
  console.log('║  ONTO SURFACE COMPILER — First Native Onto Program    ║')
  console.log('╚═══════════════════════════════════════════════════════╝\n')

  console.log('◈ Source — Written in native Onto syntax\n')
  console.log(ONTO_SOURCE_DEMO)

  console.log('\n◈ Compiling...\n')

  const result = compile(ONTO_SOURCE_DEMO)

  if (result.parseErrors.length > 0) {
    console.log('  ✕ Parse errors:')
    result.parseErrors.forEach(e => console.log(`    ${e}`))
    return
  }

  if (result.typeErrors.length > 0) {
    console.log('  ✕ Type errors:')
    result.typeErrors.forEach(e => console.log(`    ${e}`))
    return
  }

  if (result.warnings.length > 0) {
    console.log('  ⚠ Warnings:')
    result.warnings.forEach(w => console.log(`    ${w}`))
  }

  console.log('  ✓ Compiled successfully\n')

  // Show AST summary
  if (result.ast) {
    console.log(`  AST: ${result.ast.statements.length} top-level declarations`)
    result.ast.statements.forEach(s => {
      if (s.kind === 'knowledge_decl') {
        console.log(`    know  "${s.id}" = ${s.value.raw} (conf=${s.confidence})`)
      } else {
        console.log(`    tension "${s.id}" → ${s.intent.description}`)
        console.log(`            ${s.resolves.paths.length} resolution path(s)`)
      }
    })
  }

  // Equilibrate
  if (result.field) {
    console.log('\n◈ Equilibrating...\n')
    const engine = new OntoEngine()
    const eq = engine.equilibrate(result.field)
    console.log(renderEquilibrium(eq))
  }

  console.log('╔═══════════════════════════════════════════════════════╗')
  console.log('║  The full pipeline just ran:                          ║')
  console.log('║                                                       ║')
  console.log('║  Onto source text                                     ║')
  console.log('║    ↓ Lexer      → Token stream                       ║')
  console.log('║    ↓ Parser     → Abstract Syntax Tree               ║')
  console.log('║    ↓ Emitter    → Executable Field                   ║')
  console.log('║    ↓ TypeCheck  → Epistemic validation               ║')
  console.log('║    ↓ Engine     → Equilibrium                        ║')
  console.log('║                                                       ║')
  console.log('║  Onto can now be written in its own syntax.          ║')
  console.log('╚═══════════════════════════════════════════════════════╝\n')
}

runCompilerDemo()