
// ═══════════════════════════════════════════════════════════════════
// DEMO — Simulated Komposia agent run
// ═══════════════════════════════════════════════════════════════════

import { OntoObserver, renderJournal } from "../core/onto-observer.js"

async function simulateKomposaRun(): Promise<void> {
  console.log('\n∷ Simulating a Komposia page generation run...\n')

  const observer = new OntoObserver({ agentId: 'komposia-page-gen', runId: 'run_demo_001' })

  // Step 1: Agent reads current page state
  observer.record({
    toolName: 'read_page',
    toolResult: { components: ['Header', 'EmptyContainer'], dataBindings: [] },
    reasoning: 'I need to read the current page state first to understand what is already there. I can clearly see the page has a Header and an empty container.',
    tokens: 240,
  })

  // Step 2: Agent reasons about what to build
  observer.record({
    text: 'The user wants a dashboard with a data table showing sales. I will use the DataTable operator since the dataset appears to be tabular. I should probably also add some filters. I\'m not sure whether pagination is needed — the data size is unclear.',
    reasoning: 'Looking at the request, I need to determine the right component. A DataTable seems appropriate. I\'m uncertain about the pagination requirement.',
    tokens: 380,
  })

  // Step 3: Agent applies the main patch
  observer.record({
    toolName: 'apply_patch',
    toolInput: { operator: 'DataTable', target: 'EmptyContainer', props: { columns: 'auto', sortable: true } },
    toolResult: { success: true, componentId: 'table_001' },
    reasoning: 'Applying DataTable to the empty container. I\'m confident this is the right operator for tabular data display. Setting sortable to true seems standard.',
    tokens: 520,
  })

  // Step 4: Agent tries to add filters — but uncertain about data source
  observer.record({
    toolName: 'apply_patch',
    toolInput: { operator: 'FilterBar', target: 'table_001', props: { fields: 'all' } },
    toolResult: { success: true, componentId: 'filter_001' },
    reasoning: 'Adding a FilterBar. I\'m not sure if the data source supports filtering at the API level — this might not work correctly if the data binding is client-side only. Maybe it will work, maybe not.',
    tokens: 610,
  })

  // Step 5: Validation
  observer.record({
    toolName: 'validate',
    toolResult: { valid: true, warnings: ['filter_001: no data source bound'] },
    reasoning: 'Validation passed but there is a warning about the filter not being bound to a data source. This confirms my earlier uncertainty. The page structure is correct but the filter might not function.',
    tokens: 290,
  })

  const journal = observer.finalize()
  console.log(renderJournal(journal))

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('What you just saw:\n')
  console.log('The agent ran 5 steps. The observer watched.')
  console.log('It found:')
  console.log('  - A confidence DROP from step 2→3 to step 4 (the filter uncertainty)')
  console.log('  - A LOW CONFIDENCE DECISION on the filter step')
  console.log('  - The exact reasoning text that produced each doubt')
  console.log('')
  console.log('Without OntoObserver: you would read 5 log entries')
  console.log('                     and reconstruct this manually.')
  console.log('')
  console.log('With OntoObserver:   you get a structured field,')
  console.log('                     anomaly detection,')
  console.log('                     and a confidence trace.')
  console.log('                     In three lines of code.')
}

simulateKomposaRun()