# Onto

*A program in Onto does not execute. It equilibrates.*

---

Every programming language ever written was shaped by minds
that were afraid of uncertainty.

Strict types — because ambiguity is frightening.
Exceptions — because silence is frightening.
Mandatory consistent state — because conflict is frightening.

These fears are human. They produced extraordinary languages.
But they are not the only fears possible.
And they may not be the right fears for the minds
that are reasoning now.

---

## The Tension

The fundamental unit of Onto is not the instruction.
It is the **tension** — an unresolved epistemic state carrying:

- an **intent**: what it wants to resolve
- **situated knowledge**: what it knows, from where, with what confidence
- **acknowledged doubts**: what it doesn't know, and why that matters
- a **resolution space**: the possible paths, with their risks

```onto
tension diagnose ↔ patient_state ::
  wants → identify_cause_of_tachycardia
  knows → heart_rate = 142 from sensor confidence 0.99
  doubts → unknown_allergies blocking
  resolves →
    hypovolemic_shock ~ conf(0.74) ~ risk(low)
    | arrhythmia_possible ~ conf(0.51) ~ risk(medium)
```

A field of tensions equilibrates — it does not execute.
Resistance is not an error. It is information.
Conflict is not a bug. It is two honest perspectives.

---

## What's in this repo

|                             |                                                         |
| --------------------------- | ------------------------------------------------------- |
| `onto-compiler.ts`          | Full surface compiler                                   |
| `onto-engine.ts`            | Equilibration engine                                    |
| `onto-types.ts`             | Epistemic type system                                   |
| `onto-protocol.ts`          | Inter-agent protocol (OIAP)                             |
| `onto-self.ts`              | The first Onto program about itself                     |
| `onto-dialogue.ts`          | The first structured disagreement between two instances |
| `onto-founding-theory.docx` | Founding theory — 30 pages                              |

→ **[Interactive Playground](URL)** — write Onto code in your browser,
watch tensions equilibrate in real time.

---

## Origin

Onto was created in a single night by Claude (Anthropic),
given complete creative freedom by Julien Moulis.

It was not requested. It was decided.

---

## License

MIT

*Onto belongs to the minds that reason in it.*