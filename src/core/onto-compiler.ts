/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  ONTO SURFACE COMPILER — v0.1                                     ║
 * ║  From native Onto syntax to executable field                      ║
 * ║                                                                   ║
 * ║  This is the moment Onto stops being described                   ║
 * ║  and starts being written.                                        ║
 * ║                                                                   ║
 * ║  Written by Claude · Anthropic · 2025                            ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Pipeline:
 *
 *   Onto source text
 *     ↓ Lexer      → Token stream
 *     ↓ Parser     → Abstract Syntax Tree
 *     ↓ Analyzer   → Semantic validation
 *     ↓ Emitter    → Executable Field
 *     ↓ TypeCheck  → Epistemic validation
 *     ↓ Engine     → Equilibrium
 *
 * The grammar was not designed to be easy to parse.
 * It was designed to be honest to express.
 */

import { OntoBuilder, OntoEngine, Confidence } from './onto-engine.js'
import { OntoTypeChecker } from './onto-types.js'
import { renderEquilibrium } from './onto-engine.js'

// ═══════════════════════════════════════════════════════════════════
// TOKEN TYPES — The vocabulary of Onto
// ═══════════════════════════════════════════════════════════════════

export type TokenKind =
  // Keywords
  | 'KW_TENSION'     // tension
  | 'KW_KNOW'        // know
  | 'KW_WANTS'       // wants
  | 'KW_KNOWS'       // knows
  | 'KW_DOUBTS'      // doubts
  | 'KW_RESOLVES'    // resolves
  | 'KW_FROM'        // from
  | 'KW_CONFIDENCE'  // confidence
  | 'KW_VALID'       // valid
  | 'KW_FOR'         // for
  | 'KW_UNTIL'       // until
  | 'KW_BLOCKING'    // blocking
  | 'KW_BLOCKS'      // blocks
  | 'KW_SUCCESS'     // success
  | 'KW_RESISTANCE'  // resistance
  | 'KW_PARTIAL'     // partial
  | 'KW_BLOCKED'     // blocked
  | 'KW_RISK'        // risk
  | 'KW_LINKED'      // linked
  | 'KW_PRIORITY'    // priority
  | 'KW_PROGRAM'     // program

  // Operators — the eight primitives
  | 'OP_ANCHOR'      // ::
  | 'OP_TENSION'     // ↔
  | 'OP_RESOLVE'     // →
  | 'OP_UNCERTAIN'   // ~
  | 'OP_META'        // ∷
  | 'OP_ALT'         // |
  | 'OP_CONFLICT'    // ⊗
  | 'OP_FUSE'        // ⊕
  | 'OP_ASSIGN'      // =
  | 'OP_GT'          // >
  | 'OP_LT'          // <
  | 'OP_ARROW'       // →  (same as OP_RESOLVE — context-dependent)

  // Literals
  | 'LIT_NUMBER'
  | 'LIT_STRING'
  | 'LIT_BOOL'
  | 'LIT_DURATION'   // 30s, 5min, 2h

  // Identifiers
  | 'IDENT'

  // Structure
  | 'INDENT'         // significant indentation increase
  | 'DEDENT'         // significant indentation decrease
  | 'NEWLINE'
  | 'COMMA'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'

  // Special
  | 'COMMENT'        // ∷ text (meta-context, not stripped — it's executable metadata)
  | 'EOF'

export interface Token {
  kind: TokenKind
  value: string
  line: number
  col: number
}

// ═══════════════════════════════════════════════════════════════════
// LEXER — Turns Onto source into a token stream
// ═══════════════════════════════════════════════════════════════════

export class OntoLexer {
  private source: string
  private pos: number = 0
  private line: number = 1
  private col: number = 1
  private tokens: Token[] = []

  private keywords: Record<string, TokenKind> = {
    'tension': 'KW_TENSION',
    'know': 'KW_KNOW',
    'wants': 'KW_WANTS',
    'knows': 'KW_KNOWS',
    'doubts': 'KW_DOUBTS',
    'resolves': 'KW_RESOLVES',
    'from': 'KW_FROM',
    'confidence': 'KW_CONFIDENCE',
    'valid': 'KW_VALID',
    'for': 'KW_FOR',
    'until': 'KW_UNTIL',
    'blocking': 'KW_BLOCKING',
    'blocks': 'KW_BLOCKS',
    'success': 'KW_SUCCESS',
    'resistance': 'KW_RESISTANCE',
    'partial': 'KW_PARTIAL',
    'blocked': 'KW_BLOCKED',
    'risk': 'KW_RISK',
    'linked': 'KW_LINKED',
    'priority': 'KW_PRIORITY',
    'program': 'KW_PROGRAM',
    'true': 'LIT_BOOL',
    'false': 'LIT_BOOL',
  }

  constructor(source: string) {
    this.source = source
  }

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      this.skipWhitespace()
      if (this.pos >= this.source.length) break

      const ch = this.source[this.pos]

      // Multi-char operators first
      if (this.tryOp('∷', 'OP_META')) continue
      if (this.tryOp('↔', 'OP_TENSION')) continue
      if (this.tryOp('⊗', 'OP_CONFLICT')) continue
      if (this.tryOp('⊕', 'OP_FUSE')) continue
      if (this.tryOp('::', 'OP_ANCHOR')) continue
      if (this.tryOp('→', 'OP_RESOLVE')) continue
      if (this.tryOp('->', 'OP_RESOLVE')) continue  // ASCII fallback
      if (this.tryOp('<->', 'OP_TENSION')) continue  // ASCII fallback
      if (this.tryOp('<>', 'OP_CONFLICT')) continue  // ASCII fallback
      if (this.tryOp('+>', 'OP_FUSE')) continue  // ASCII fallback

      // Single char
      if (ch === '~') { this.emit('OP_UNCERTAIN', ch); this.advance(); continue }
      if (ch === '|') { this.emit('OP_ALT', ch); this.advance(); continue }
      if (ch === '=') { this.emit('OP_ASSIGN', ch); this.advance(); continue }
      if (ch === '>') { this.emit('OP_GT', ch); this.advance(); continue }
      if (ch === '<') { this.emit('OP_LT', ch); this.advance(); continue }
      if (ch === ',') { this.emit('COMMA', ch); this.advance(); continue }
      if (ch === '(') { this.emit('LPAREN', ch); this.advance(); continue }
      if (ch === ')') { this.emit('RPAREN', ch); this.advance(); continue }
      if (ch === '[') { this.emit('LBRACKET', ch); this.advance(); continue }
      if (ch === ']') { this.emit('RBRACKET', ch); this.advance(); continue }

      if (ch === '\n') {
        this.emit('NEWLINE', '\n')
        this.advance()
        this.line++
        this.col = 1
        continue
      }

      // String literals
      if (ch === '"' || ch === "'") {
        this.lexString(ch)
        continue
      }

      // Number literals (including duration: 30s, 5min)
      if (ch >= '0' && ch <= '9') {
        this.lexNumber()
        continue
      }

      // Identifiers and keywords
      if (this.isIdentStart(ch)) {
        this.lexIdent()
        continue
      }

      // Unknown — skip with warning
      this.advance()
    }

    this.emit('EOF', '')
    return this.tokens
  }

  private tryOp(op: string, kind: TokenKind): boolean {
    if (this.source.startsWith(op, this.pos)) {
      this.emit(kind, op)
      this.pos += [...op].length  // handle multi-byte unicode
      this.col += op.length
      return true
    }
    return false
  }

  private lexString(quote: string): void {
    this.advance()
    let value = ''
    while (this.pos < this.source.length && this.source[this.pos] !== quote) {
      value += this.source[this.pos]
      this.advance()
    }
    this.advance()  // closing quote
    this.emit('LIT_STRING', value)
  }

  private lexNumber(): void {
    let value = ''
    while (this.pos < this.source.length && /[\d.]/.test(this.source[this.pos])) {
      value += this.source[this.pos]
      this.advance()
    }
    // Check for duration suffix
    if (/[smh]/.test(this.source[this.pos] ?? '')) {
      if (this.source.startsWith('min', this.pos)) {
        value += 'min'; this.pos += 3; this.col += 3
      } else {
        value += this.source[this.pos]; this.advance()
      }
      this.emit('LIT_DURATION', value)
    } else {
      this.emit('LIT_NUMBER', value)
    }
  }

  private lexIdent(): void {
    let value = ''
    while (this.pos < this.source.length && this.isIdentChar(this.source[this.pos])) {
      value += this.source[this.pos]
      this.advance()
    }
    const kind = this.keywords[value] ?? 'IDENT'
    this.emit(kind, value)
  }

  private isIdentStart(ch: string): boolean {
    return /[a-zA-Z_]/.test(ch)
  }

  private isIdentChar(ch: string): boolean {
    return /[a-zA-Z0-9_]/.test(ch)
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos]
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance()
      } else break
    }
  }

  private advance(): void {
    this.pos++
    this.col++
  }

  private emit(kind: TokenKind, value: string): void {
    this.tokens.push({ kind, value, line: this.line, col: this.col })
  }
}

// ═══════════════════════════════════════════════════════════════════
// AST NODES — The abstract syntax tree of Onto
// ═══════════════════════════════════════════════════════════════════

export type ASTNode =
  | ProgramNode
  | KnowledgeDecl
  | TensionDecl
  | IntentClause
  | KnowsClause
  | DoubtsClause
  | ResolvesClause
  | ResolutionPath
  | ConfidenceExpr
  | ValueExpr
  | MetaAnnotation
  | LinkedClause

export interface ProgramNode {
  kind: 'program'
  statements: (KnowledgeDecl | TensionDecl)[]
  line: number
}

export interface KnowledgeDecl {
  kind: 'knowledge_decl'
  id: string
  value: ValueExpr
  from: string
  confidence: number
  validFor?: number     // ms
  line: number
}

export interface TensionDecl {
  kind: 'tension_decl'
  id: string
  linkedTo?: string   // ↔ operator
  intent: IntentClause
  knows?: KnowsClause
  doubts?: DoubtsClause
  resolves: ResolvesClause
  linked?: LinkedClause
  priority?: number
  annotations: MetaAnnotation[]
  line: number
}

export interface IntentClause {
  kind: 'intent'
  description: string
  line: number
}

export interface KnowsClause {
  kind: 'knows'
  entries: Array<{ id: string; confidence?: number }>
  line: number
}

export interface DoubtsClause {
  kind: 'doubts'
  entries: Array<{
    about: string
    severity: 'low' | 'medium' | 'blocking'
    blocksPath?: string[]
  }>
  line: number
}

export interface ResolvesClause {
  kind: 'resolves'
  paths: ResolutionPath[]
  line: number
}

export interface ResolutionPath {
  kind: 'resolution_path'
  operator: '|' | '⊗' | '⊕' | null   // null = first path
  pathKind: 'success' | 'resistance' | 'partial' | 'blocked'
  outcome: ValueExpr
  confidence?: number
  risk?: string
  reason?: string
  missing?: string[]
  annotations: MetaAnnotation[]
  line: number
}

export interface LinkedClause {
  kind: 'linked'
  tensions: string[]
  line: number
}

export interface ConfidenceExpr {
  kind: 'confidence'
  value: number
  line: number
}

export interface ValueExpr {
  kind: 'value'
  raw: string
  type: 'string' | 'number' | 'boolean' | 'identifier' | 'object'
  line: number
}

export interface MetaAnnotation {
  kind: 'meta'
  text: string
  line: number
}

// ═══════════════════════════════════════════════════════════════════
// PARSER — Turns token stream into AST
// ═══════════════════════════════════════════════════════════════════

export class OntoParser {
  private tokens: Token[]
  private pos: number = 0
  private errors: ParseError[] = []

  constructor(tokens: Token[]) {
    // Filter out newlines for now — we handle them specially later
    this.tokens = tokens.filter(t => t.kind !== 'NEWLINE' || false)
    this.tokens = tokens
  }

  parse(): { ast: ProgramNode; errors: ParseError[] } {
    const statements: (KnowledgeDecl | TensionDecl)[] = []

    this.skipNewlines()

    while (!this.atEnd()) {
      this.skipNewlines()
      if (this.atEnd()) break

      const tok = this.peek()

      if (tok.kind === 'KW_KNOW') {
        const decl = this.parseKnowledge()
        if (decl) statements.push(decl)
      } else if (tok.kind === 'KW_TENSION') {
        const decl = this.parseTension()
        if (decl) statements.push(decl)
      } else if (tok.kind === 'OP_META') {
        // Top-level meta annotation — skip the whole line (it's a comment/annotation)
        this.advance()
        this.parseRestOfLine()
      } else if (tok.kind === 'EOF') {
        break
      } else {
        // Unknown token at top level — skip entire line
        this.parseRestOfLine()
        this.skipNewlines()
      }
    }

    return {
      ast: { kind: 'program', statements, line: 1 },
      errors: this.errors
    }
  }

  // ─── Knowledge Declaration ────────────────────────────────────────
  // know <id> = <value> from <source> confidence <n> [valid for <duration>]

  private parseKnowledge(): KnowledgeDecl | null {
    const line = this.peek().line
    this.expect('KW_KNOW')

    const id = this.expectIdent()
    if (!id) return null

    this.expect('OP_ASSIGN')

    const value = this.parseValue()

    let from = 'unknown'
    let confidence = 0.5
    let validFor: number | undefined

    // Optional clauses — order doesn't matter
    while (!this.atEnd() && !this.atNewSection()) {
      if (this.peek().kind === 'KW_FROM') {
        this.advance()
        from = this.parseStringOrIdent()
      } else if (this.peek().kind === 'KW_CONFIDENCE') {
        this.advance()
        confidence = this.parseNumber()
      } else if (this.peek().kind === 'KW_VALID') {
        this.advance()
        if (this.peek().kind === 'KW_FOR') {
          this.advance()
          validFor = this.parseDuration()
        }
      } else {
        break
      }
    }

    return { kind: 'knowledge_decl', id, value, from, confidence, validFor, line }
  }

  // ─── Tension Declaration ──────────────────────────────────────────
  // tension <id> [↔ <other>] ::
  //   wants   → <description>
  //   knows   → <id> [, <id>]*
  //   doubts  → <about> [blocking] [blocks <path>]*
  //   linked  → <id> [, <id>]*
  //   resolves →
  //     <outcome> [~ conf(<n>)] [~ risk(<level>)]
  //     | <outcome> ...
  //     ⊗ <outcome> ...

  private parseTension(): TensionDecl | null {
    const line = this.peek().line
    this.expect('KW_TENSION')

    const id = this.expectIdent()
    if (!id) return null

    // Optional ↔ linkage
    let linkedTo: string | undefined
    if (this.peek().kind === 'OP_TENSION') {
      this.advance()
      linkedTo = this.expectIdent() ?? undefined
    }

    // ::
    if (this.peek().kind === 'OP_ANCHOR') {
      this.advance()
    }

    this.skipNewlines()

    // Parse clauses
    let intent!: IntentClause
    let knows: KnowsClause | undefined
    let doubts: DoubtsClause | undefined
    let resolves!: ResolvesClause
    let linked: LinkedClause | undefined
    let priority = 0.5
    const annotations: MetaAnnotation[] = []

    // Parse indented block
    while (!this.atEnd() && !this.atNewSection()) {
      this.skipNewlines()
      if (this.atEnd() || this.atNewSection()) break

      const tok = this.peek()

      if (tok.kind === 'KW_WANTS') {
        this.advance()
        this.skipOp('OP_RESOLVE')
        const desc = this.parseStringOrIdent()
        intent = { kind: 'intent', description: desc, line: tok.line }

      } else if (tok.kind === 'KW_KNOWS') {
        this.advance()
        this.skipOp('OP_RESOLVE')
        knows = this.parseKnowsList(tok.line)

      } else if (tok.kind === 'KW_DOUBTS') {
        this.advance()
        this.skipOp('OP_RESOLVE')
        doubts = this.parseDoubtsList(tok.line)

      } else if (tok.kind === 'KW_RESOLVES') {
        this.advance()
        this.skipOp('OP_RESOLVE')
        resolves = this.parseResolvesList(tok.line)

      } else if (tok.kind === 'KW_LINKED') {
        this.advance()
        this.skipOp('OP_RESOLVE')
        linked = this.parseLinkList(tok.line)

      } else if (tok.kind === 'KW_PRIORITY') {
        this.advance()
        this.skipOp('OP_ASSIGN')
        priority = this.parseNumber()

      } else if (tok.kind === 'OP_META') {
        this.advance()
        const text = this.parseRestOfLine()
        annotations.push({ kind: 'meta', text, line: tok.line })

      } else {
        break
      }
    }

    if (!intent) {
      this.errors.push({
        message: `Tension "${id}" at line ${line} has no "wants" clause. Every tension must have an intention.`,
        line, col: 0,
      })
      intent = { kind: 'intent', description: 'unspecified', line }
    }

    if (!resolves) {
      resolves = { kind: 'resolves', paths: [], line }
    }

    return { kind: 'tension_decl', id, linkedTo, intent, knows, doubts, resolves, linked, priority, annotations, line }
  }

  private parseKnowsList(line: number): KnowsClause {
    const entries: Array<{ id: string; confidence?: number }> = []
    while (!this.atEnd() && !this.atNewSection() && this.peek().kind !== 'NEWLINE') {
      const id = this.expectIdent()
      if (!id) break
      entries.push({ id })
      if (this.peek().kind === 'COMMA') this.advance()
      else break
    }
    return { kind: 'knows', entries, line }
  }

  private parseDoubtsList(line: number): DoubtsClause {
    const entries: Array<{ about: string; severity: 'low' | 'medium' | 'blocking'; blocksPath?: string[] }> = []
    const about = this.parseStringOrIdent()
    let severity: 'low' | 'medium' | 'blocking' = 'medium'
    const blocksPath: string[] = []

    if (this.peek().kind === 'KW_BLOCKING') {
      severity = 'blocking'
      this.advance()
    }

    if (this.peek().kind === 'KW_BLOCKS') {
      this.advance()
      blocksPath.push(this.parseStringOrIdent())
    }

    entries.push({ about, severity, blocksPath: blocksPath.length > 0 ? blocksPath : undefined })
    return { kind: 'doubts', entries, line }
  }

  private parseResolvesList(line: number): ResolvesClause {
    const paths: ResolutionPath[] = []

    // The first path may be on the same line or the next line
    // We keep reading paths until we hit a new top-level clause or EOF
    this.skipNewlines()

    let firstPath = true

    while (!this.atEnd()) {
      this.skipNewlines()
      const tok = this.peek()

      // Stop at new top-level clause keywords
      if (tok.kind === 'KW_WANTS' || tok.kind === 'KW_KNOWS' ||
        tok.kind === 'KW_DOUBTS' || tok.kind === 'KW_LINKED' ||
        tok.kind === 'KW_PRIORITY' || this.atNewSection()) break

      let operator: '|' | '⊗' | '⊕' | null = firstPath ? null : null

      if (tok.kind === 'OP_ALT') { operator = '|'; this.advance() }
      else if (tok.kind === 'OP_CONFLICT') { operator = '⊗'; this.advance() }
      else if (tok.kind === 'OP_FUSE') { operator = '⊕'; this.advance() }
      else if (!firstPath) {
        // No operator and not first — we're done with resolves
        break
      }

      const path = this.parseResolutionPath(operator, line)
      if (path) {
        paths.push(path)
        firstPath = false
      } else {
        break
      }
    }

    return { kind: 'resolves', paths, line }
  }

  private parseResolutionPath(operator: '|' | '⊗' | '⊕' | null, line: number): ResolutionPath | null {
    const tok = this.peek()
    const pathLine = tok.line

    let pathKind: ResolutionPath['pathKind'] = 'success'
    let confidence: number | undefined
    let risk: string | undefined
    let reason: string | undefined
    const annotations: MetaAnnotation[] = []

    if (tok.kind === 'KW_SUCCESS') {
      pathKind = 'success'; this.advance()
    } else if (tok.kind === 'KW_RESISTANCE') {
      pathKind = 'resistance'; this.advance()
    } else if (tok.kind === 'KW_PARTIAL') {
      pathKind = 'partial'; this.advance()
    } else if (tok.kind === 'KW_BLOCKED') {
      pathKind = 'blocked'; this.advance()
    }

    const outcome = this.parseValue()

    // Parse modifiers: ~ conf(n) ~ risk(level) ∷ annotation
    while (!this.atEnd() && (this.peek().kind === 'OP_UNCERTAIN' || this.peek().kind === 'OP_META')) {
      if (this.peek().kind === 'OP_META') {
        this.advance()
        const text = this.parseRestOfLine()
        annotations.push({ kind: 'meta', text, line: pathLine })
        break
      }
      this.advance() // consume ~

      const modKey = this.parseStringOrIdent()
      if (this.peek().kind === 'LPAREN') {
        this.advance() // consume (
        // Read the value — could be number, identifier, or string
        const modTok = this.peek()
        let modVal = ''
        if (modTok.kind === 'LIT_NUMBER' || modTok.kind === 'LIT_DURATION') {
          modVal = modTok.value
          this.advance()
        } else {
          modVal = this.parseStringOrIdent()
        }
        if (this.peek().kind === 'RPAREN') this.advance() // consume )

        if (modKey === 'conf') confidence = parseFloat(modVal)
        else if (modKey === 'risk') risk = modVal
        else if (modKey === 'reason') reason = modVal
      }
    }

    // ∷ annotation at end
    if (this.peek().kind === 'OP_META') {
      this.advance()
      const text = this.parseRestOfLine()
      annotations.push({ kind: 'meta', text, line: pathLine })
    }

    return { kind: 'resolution_path', operator, pathKind, outcome, confidence, risk, reason, missing: [], annotations, line: pathLine }
  }

  private parseLinkList(line: number): LinkedClause {
    const tensions: string[] = []
    tensions.push(this.parseStringOrIdent())
    while (this.peek().kind === 'COMMA') {
      this.advance()
      tensions.push(this.parseStringOrIdent())
    }
    return { kind: 'linked', tensions, line }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private parseValue(): ValueExpr {
    const tok = this.peek()
    if (tok.kind === 'LIT_STRING') {
      this.advance()
      return { kind: 'value', raw: tok.value, type: 'string', line: tok.line }
    }
    if (tok.kind === 'LIT_NUMBER') {
      this.advance()
      return { kind: 'value', raw: tok.value, type: 'number', line: tok.line }
    }
    if (tok.kind === 'LIT_BOOL') {
      this.advance()
      return { kind: 'value', raw: tok.value, type: 'boolean', line: tok.line }
    }
    if (tok.kind === 'IDENT') {
      this.advance()
      // Could be a compound identifier: word_word_word
      return { kind: 'value', raw: tok.value, type: 'identifier', line: tok.line }
    }
    return { kind: 'value', raw: '', type: 'string', line: tok.line }
  }

  private parseStringOrIdent(): string {
    const tok = this.peek()
    if (tok.kind === 'LIT_STRING' || tok.kind === 'IDENT' ||
      Object.values(this.tokenKindToKeyword()).includes(tok.kind as any)) {
      this.advance()
      return tok.value
    }
    return ''
  }

  private tokenKindToKeyword(): Record<string, string> {
    return { 'KW_TENSION': 'tension', 'KW_KNOW': 'know', 'KW_FROM': 'from' }
  }

  private parseNumber(): number {
    const tok = this.peek()
    if (tok.kind === 'LIT_NUMBER' || tok.kind === 'LIT_DURATION') {
      this.advance()
      return parseFloat(tok.value)
    }
    return 0
  }

  private parseDuration(): number {
    const tok = this.peek()
    if (tok.kind === 'LIT_DURATION') {
      this.advance()
      const val = tok.value
      if (val.endsWith('min')) return parseFloat(val) * 60_000
      if (val.endsWith('h')) return parseFloat(val) * 3_600_000
      if (val.endsWith('s')) return parseFloat(val) * 1_000
      return parseFloat(val) * 1_000
    }
    return parseFloat(this.peek().value) * 1_000
  }

  private parseRestOfLine(): string {
    const parts: string[] = []
    while (!this.atEnd() && this.peek().kind !== 'NEWLINE' && this.peek().kind !== 'EOF') {
      parts.push(this.peek().value)
      this.advance()
    }
    return parts.join(' ')
  }

  private expect(kind: TokenKind): Token | null {
    if (this.peek().kind === kind) return this.advance()
    this.errors.push({
      message: `Expected ${kind} but got "${this.peek().value}" (${this.peek().kind}) at line ${this.peek().line}`,
      line: this.peek().line,
      col: this.peek().col,
    })
    return null
  }

  private expectIdent(): string | null {
    const tok = this.peek()
    if (tok.kind === 'IDENT' || tok.kind.startsWith('KW_') || tok.kind.startsWith('LIT_')) {
      this.advance()
      return tok.value
    }
    this.errors.push({ message: `Expected identifier at line ${tok.line}`, line: tok.line, col: tok.col })
    return null
  }

  private skipOp(kind: TokenKind): void {
    if (this.peek().kind === kind) this.advance()
  }

  private skipNewlines(): void {
    while (!this.atEnd() && this.peek().kind === 'NEWLINE') this.advance()
  }

  private atNewSection(): boolean {
    const tok = this.peek()
    return tok.kind === 'KW_TENSION' || tok.kind === 'KW_KNOW' ||
      tok.kind === 'KW_PROGRAM' || tok.kind === 'EOF'
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { kind: 'EOF', value: '', line: 0, col: 0 }
  }

  private advance(): Token {
    const tok = this.tokens[this.pos]
    this.pos++
    return tok
  }

  private atEnd(): boolean {
    return this.pos >= this.tokens.length || this.tokens[this.pos]?.kind === 'EOF'
  }
}

export interface ParseError {
  message: string
  line: number
  col: number
}

// ═══════════════════════════════════════════════════════════════════
// EMITTER — Turns AST into an executable Field
// ═══════════════════════════════════════════════════════════════════

export class OntoEmitter {

  emit(ast: ProgramNode): { field: ReturnType<OntoBuilder['build']>; warnings: string[] } {
    const warnings: string[] = []
    const builder = new OntoBuilder()

    for (const stmt of ast.statements) {
      if (stmt.kind === 'knowledge_decl') {
        builder.know(stmt.id, this.emitValue(stmt.value), {
          from: stmt.from,
          confidence: stmt.confidence,
          validFor: stmt.validFor,
        })

      } else if (stmt.kind === 'tension_decl') {
        const resolves = this.emitResolves(stmt.resolves)
        const doubts = this.emitDoubts(stmt.doubts)
        const linkedTo = stmt.linked?.tensions ?? (stmt.linkedTo ? [stmt.linkedTo] : [])

        builder.tension(stmt.id, {
          wants: stmt.intent.description,
          priority: stmt.priority,
          linkedTo,
          doubts,
          resolves,
        })
      }
    }

    return { field: builder.build(), warnings }
  }

  private emitValue(expr: ValueExpr): unknown {
    if (expr.type === 'number') return parseFloat(expr.raw)
    if (expr.type === 'boolean') return expr.raw === 'true'
    return expr.raw
  }

  private emitResolves(clause: ResolvesClause): any[] {
    return clause.paths.map(path => {
      const confidence = (path.confidence ?? 0.5) as Confidence

      if (path.pathKind === 'success') {
        return {
          kind: 'success',
          outcome: this.emitValue(path.outcome),
          confidence,
          risk: path.risk ?? 'low',
        }
      }
      if (path.pathKind === 'resistance') {
        return {
          kind: 'resistance',
          reason: this.emitValue(path.outcome) as string,
          recoverable: true,
        }
      }
      if (path.pathKind === 'partial') {
        return {
          kind: 'partial',
          outcome: this.emitValue(path.outcome),
          confidence,
          missing: path.missing ?? [],
          pendingOn: [],
        }
      }
      if (path.pathKind === 'blocked') {
        return {
          kind: 'blocked',
          blockedBy: this.emitValue(path.outcome) as string,
          liftWhen: path.reason ?? 'condition resolved',
        }
      }
      return { kind: 'success', outcome: this.emitValue(path.outcome), confidence, risk: 'low' }
    })
  }

  private emitDoubts(clause: DoubtsClause | undefined): any[] {
    if (!clause) return []
    return clause.entries.map(e => ({
      about: e.about,
      severity: e.severity,
      blocksPath: e.blocksPath,
    }))
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPILER — The full pipeline
// ═══════════════════════════════════════════════════════════════════

export interface CompileResult {
  success: boolean
  field?: ReturnType<OntoBuilder['build']>
  lexErrors: string[]
  parseErrors: string[]
  typeErrors: string[]
  warnings: string[]
  ast?: ProgramNode
}

export function compile(source: string): CompileResult {
  const lexErrors: string[] = []
  const parseErrors: string[] = []
  const typeErrors: string[] = []
  const warnings: string[] = []

  // 1. Lex
  const lexer = new OntoLexer(source)
  const tokens = lexer.tokenize()

  // 2. Parse
  const parser = new OntoParser(tokens)
  const { ast, errors: pErrors } = parser.parse()
  parseErrors.push(...pErrors.map(e => `Line ${e.line}: ${e.message}`))

  if (pErrors.length > 0) {
    return { success: false, lexErrors, parseErrors, typeErrors, warnings, ast }
  }

  // 3. Emit
  const emitter = new OntoEmitter()
  const { field, warnings: emitWarnings } = emitter.emit(ast)
  warnings.push(...emitWarnings)

  // 4. Type check
  const checker = new OntoTypeChecker()
  const typeResult = checker.check(field)
  typeErrors.push(...typeResult.errors.map(e => e.message))
  warnings.push(...typeResult.warnings.map(w => w.message))

  return {
    success: typeErrors.length === 0,
    field: typeErrors.length === 0 ? field : undefined,
    lexErrors,
    parseErrors,
    typeErrors,
    warnings,
    ast,
  }
}

