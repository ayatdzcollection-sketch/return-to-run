// ============================================================
// INVARIANT 13, ENFORCED BY CONSTRUCTION.
//
// "Never test, estimate, or prescribe against a maximum heart rate. No
//  formula-derived zone model anywhere in the codebase."
//
// A rule that lives only in a design document gets violated the first time
// somebody needs a percentage. So this test reads the actual source and fails
// if the concept appears at all, in any file, in any form, including a
// helper someone adds in six months without reading the brief.
//
// It also enforces the engine's purity boundary, which is what makes every
// other test in this suite meaningful: if the engine could read a clock or a
// database, "same log + same today => same prescription" would stop being
// true, and none of the invariant tests would prove anything about what the
// athlete actually sees.
//
// Comments are stripped before scanning, so this file and every other one can
// discuss the banned concepts in prose (as this comment just did) without
// tripping the check. Only executable code is examined.
// ============================================================

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

interface SourceFile { path: string; code: string }

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Reduce a file to executable code: comments removed, string contents emptied.
 *
 * Both bans below are about what the code DOES. A comment explaining why max
 * heart rate is forbidden, or an evidence citation quoting a study that
 * measured one, is documentation, this file's own header does exactly that.
 * Emptying string bodies (while keeping their delimiters, so the surrounding
 * syntax still parses) lets the tunables register cite real sources without
 * tripping its own guard.
 *
 * The gap this leaves is bracket access built from a string literal, e.g.
 * `state['max_hr']`. That is not a realistic way to write the offending code
 * every plausible form (`const maxHr =`, `hrMax()`, `220 - age`) is an
 * identifier or arithmetic and is still caught.
 *
 * Regex literals are not tracked. A regex containing a comment marker would
 * confuse the scanner, but the failure mode is a loud test failure rather than
 * a silent pass, which is the right direction for this to break in.
 */
function stripComments(src: string): string {
  type State = 'code' | 'line' | 'block' | 'single' | 'double' | 'template'
  let state: State = 'code'
  let out = ''
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    const next = src[i + 1]
    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; i++; continue }
      if (c === '/' && next === '*') { state = 'block'; i++; continue }
      if (c === "'") state = 'single'
      else if (c === '"') state = 'double'
      else if (c === '`') state = 'template'
      out += c
      continue
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c }
      continue
    }
    if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; i++ }
      else if (c === '\n') out += c
      continue
    }
    // Inside a string literal: keep the closing delimiter, drop the contents.
    if (c === '\\') { i++; continue }
    if ((state === 'single' && c === "'") || (state === 'double' && c === '"') || (state === 'template' && c === '`')) {
      state = 'code'
      out += c
    }
  }
  return out
}

/**
 * Load the SHIPPED source of a subtree, test files are excluded.
 *
 * Scope is deliberate. What must not contain a max-HR concept is the code that
 * reaches the athlete's phone; a test naming the banned idea in an assertion
 * message (as several in this suite do) is describing the rule, not breaking
 * it. Tests are also allowed the filesystem and the browser globals that the
 * purity check forbids the engine.
 */
function load(subdir = ''): SourceFile[] {
  return walk(join(SRC, subdir))
    .map((path) => relative(SRC, path).replaceAll('\\', '/'))
    .filter((path) => !path.includes('__tests__'))
    .map((path) => ({ path, code: stripComments(readFileSync(join(SRC, path), 'utf8')) }))
}

/** Every offending `file:line`, with the matched text, for a readable failure. */
function findViolations(files: SourceFile[], pattern: RegExp): string[] {
  const hits: string[] = []
  for (const f of files) {
    f.code.split('\n').forEach((line, i) => {
      const m = new RegExp(pattern.source, pattern.flags.replace('g', '')).exec(line)
      if (m) hits.push(`${f.path}:${i + 1}  ${m[0].trim()}  |  ${line.trim().slice(0, 90)}`)
    })
  }
  return hits
}

describe('I13: no maximum-heart-rate concept exists anywhere in the codebase', () => {
  const all = load()

  // A scan that silently finds nothing passes every ban trivially, so assert on
  // known files rather than on a count: a broken walk, a renamed directory, or a
  // too-eager filter all fail here instead of quietly disarming the check.
  it('actually reaches the engine source (guards against a vacuous pass)', () => {
    const paths = all.map((f) => f.path)
    expect(paths).toContain('engine/types.ts')
    expect(paths).toContain('engine/dates.ts')
    expect(all.every((f) => f.code.length > 0)).toBe(true)
  })

  // Each pattern is a different way the concept sneaks in: a named variable, a
  // formula, or a derived zone model. The empirical easy-HR ceiling this engine
  // does use is measured at the talk-test speed and truncated by a constant
  // it is never a percentage of anything.
  const BANNED: { name: string; pattern: RegExp }[] = [
    { name: 'max heart rate / maxHr identifier', pattern: /\bmax[_\s-]*(heart|hr)\b/i },
    { name: 'hrMax / hr_max identifier', pattern: /\bhr[_\s-]*max\b/i },
    { name: 'the 220-age formula', pattern: /220\s*[-−]\s*age/i },
    { name: 'the Tanaka 208-0.7*age formula', pattern: /208\s*[-−]\s*0?\.7/ },
    { name: 'Karvonen / heart rate reserve', pattern: /\bkarvonen\b|heart\s*rate\s*reserve|\bhrr\b/i },
    { name: 'percent-of-max zone model', pattern: /\bpct[_\s]*(hr|max)\b|\bhr[_\s]*zone\b|\bzone[_\s]*model\b/i },
  ]

  for (const { name, pattern } of BANNED) {
    it(`contains no ${name}`, () => {
      expect(findViolations(all, pattern)).toEqual([])
    })
  }
})

describe('engine purity: the fold is replayable, so it may not read the world', () => {
  // src/config is included: tunables are compiled into the engine's answers, so
  // a clock read there would be just as corrupting as one in fold.ts.
  const pure = [...load('engine'), ...load('config')]

  it('has engine files to scan', () => {
    expect(pure.length).toBeGreaterThan(2)
  })

  const IMPURE: { name: string; pattern: RegExp }[] = [
    // `LocalDate`, `compareDates`, `maxDate` etc. all survive: \bDate\b needs a
    // word boundary on both sides, which only a bare `Date` has.
    { name: 'Date (the engine receives `today`, it never asks)', pattern: /\bDate\b/ },
    { name: 'Math.random (non-deterministic)', pattern: /Math\s*\.\s*random\b/ },
    { name: 'performance.now (a clock by another name)', pattern: /performance\s*\.\s*now\b/ },
    { name: 'browser storage', pattern: /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/i },
    { name: 'browser globals', pattern: /\bwindow\b|\bdocument\b|\bnavigator\b|\bfetch\s*\(/ },
    { name: 'node APIs', pattern: /require\s*\(|from\s+['"]node:/ },
  ]

  for (const { name, pattern } of IMPURE) {
    it(`src/engine and src/config contain no ${name}`, () => {
      expect(findViolations(pure, pattern)).toEqual([])
    })
  }

  it('the engine never imports from src/lib or src/components', () => {
    // The dependency runs one way: lib may call the engine, never the reverse.
    // An engine that could reach into storage would be an engine that could be
    // handed different state than the log implies.
    expect(findViolations(load('engine'), /from\s+['"][^'"]*(\.\.\/lib|\.\.\/components|src\/lib|src\/components)/))
      .toEqual([])
  })
})
