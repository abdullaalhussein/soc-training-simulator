import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

// D-05: Production timeout reduction (5s prod, 10s dev)
const YARA_TIMEOUT_MS = process.env.NODE_ENV === 'production' ? 5000 : 10000;

// H-7: Concurrency limiter — max 3 simultaneous YARA executions
const MAX_CONCURRENT_YARA = 3;
let activeYaraExecutions = 0;
const yaraQueue: Array<{ resolve: () => void }> = [];

async function acquireYaraSlot(): Promise<void> {
  if (activeYaraExecutions < MAX_CONCURRENT_YARA) {
    activeYaraExecutions++;
    return;
  }
  return new Promise((resolve) => {
    yaraQueue.push({ resolve });
  });
}

function releaseYaraSlot(): void {
  activeYaraExecutions--;
  const next = yaraQueue.shift();
  if (next) {
    activeYaraExecutions++;
    next.resolve();
  }
}

interface SampleInput {
  name: string;
  content: string; // base64-encoded
  shouldMatch: boolean;
}

interface SampleResult {
  name: string;
  shouldMatch: boolean;
  didMatch: boolean;
  correct: boolean;
  matchedRules: string[];
}

interface TestResult {
  compiled: boolean;
  compileError?: string;
  sampleResults: SampleResult[];
  accuracy: number;
}

export class YaraService {
  /**
   * Sanitize user-provided YARA rule text by stripping dangerous directives.
   */
  static sanitizeRule(ruleText: string): string {
    // Remove include and import directives to prevent filesystem access (both double and single quoted)
    let sanitized = ruleText.replace(/^\s*include\s+["'][^"']*["']\s*$/gm, '// include removed for security');
    sanitized = sanitized.replace(/^\s*import\s+["'][^"']*["']\s*$/gm, '// import removed for security');
    return sanitized;
  }

  /**
   * D-05: Static analysis of YARA rule for ReDoS and complexity issues.
   * Returns an error message string if dangerous, or null if safe.
   */
  static analyzeRuleComplexity(ruleText: string): string | null {
    // Check for nested quantifiers that can cause catastrophic backtracking
    // Pattern like (a+)+, (a*)+, (a+)*, etc.
    if (/\([^)]*[+*]\)[+*]/.test(ruleText)) {
      return 'Rule rejected: nested quantifiers detected (potential ReDoS). Simplify the regex pattern.';
    }

    // Check for excessive repetition counts {N,} where N > 10000
    const repetitionMatch = ruleText.match(/\{(\d+),\}/g);
    if (repetitionMatch) {
      for (const match of repetitionMatch) {
        const n = parseInt(match.replace(/[{}]/g, '').replace(',', ''), 10);
        if (n > 10000) {
          return `Rule rejected: excessive repetition count ({${n},}). Maximum allowed is {10000,}.`;
        }
      }
    }

    // Check for too many string definitions (>100)
    const stringDefCount = (ruleText.match(/^\s*\$\w+\s*=/gm) || []).length;
    if (stringDefCount > 100) {
      return `Rule rejected: too many string definitions (${stringDefCount}). Maximum allowed is 100.`;
    }

    // Check for extreme alternation (>50 | in a single regex)
    const regexBlocks = ruleText.match(/\/[^/]+\//g) || [];
    for (const block of regexBlocks) {
      const pipeCount = (block.match(/\|/g) || []).length;
      if (pipeCount > 50) {
        return `Rule rejected: excessive alternation in regex (${pipeCount} alternatives). Maximum allowed is 50.`;
      }
    }

    return null;
  }

  /**
   * Test a YARA rule against a set of samples.
   */
  static async testRule(ruleText: string, samples: SampleInput[]): Promise<TestResult> {
    // Validate rule text size
    if (ruleText.length > 50000) {
      return {
        compiled: false,
        compileError: 'Rule text exceeds maximum allowed size of 50000 characters',
        sampleResults: [],
        accuracy: 0,
      };
    }

    // D-05: Static complexity analysis before execution
    const complexityError = this.analyzeRuleComplexity(ruleText);
    if (complexityError) {
      return {
        compiled: false,
        compileError: complexityError,
        sampleResults: [],
        accuracy: 0,
      };
    }

    const id = crypto.randomUUID();
    const tmpDir = path.join('/tmp', `yara-${id}`);

    logger.debug(`[YARA testRule] id=${id}, rule length=${ruleText.length}, samples=${samples.length}`);
    logger.debug(`[YARA testRule] Rule preview: ${ruleText.substring(0, 200)}`);

    // H-7: Acquire concurrency slot before execution
    await acquireYaraSlot();

    try {
      await fs.mkdir(tmpDir, { recursive: true });

      // Write rule file (caller is responsible for sanitizing)
      const rulePath = path.join(tmpDir, 'rule.yar');
      await fs.writeFile(rulePath, ruleText, 'utf-8');

      // Compile check — run against an empty file to validate syntax
      const emptyPath = path.join(tmpDir, '__empty');
      await fs.writeFile(emptyPath, '');
      try {
        await execFileAsync('yara', [rulePath, emptyPath], { timeout: YARA_TIMEOUT_MS });
      } catch (compileErr: any) {
        // YARA exits non-zero on both compile errors and no-match.
        // Compile errors go to stderr; a clean no-match has empty stderr.
        const stderr = (compileErr.stderr || '').trim();
        if (stderr) {
          logger.debug(`[YARA testRule] Compile error: ${stderr}`);
          return {
            compiled: false,
            compileError: stderr,
            sampleResults: [],
            accuracy: 0,
          };
        }
        // Empty stderr means rule compiled fine but didn't match the empty file — that's expected
      }

      // Write sample files and test each
      const sampleResults: SampleResult[] = [];

      for (const sample of samples) {
        const safeName = path.basename(sample.name);
        if (!safeName || safeName === '.' || safeName === '..' || !/^[a-zA-Z0-9._-]+$/.test(safeName)) {
          throw new Error(`Invalid sample filename: "${sample.name}"`);
        }
        const samplePath = path.join(tmpDir, safeName);
        const content = Buffer.from(sample.content, 'base64');
        await fs.writeFile(samplePath, content);

        let matchedRules: string[] = [];
        try {
          const { stdout } = await execFileAsync('yara', [rulePath, samplePath], { timeout: YARA_TIMEOUT_MS });
          // YARA outputs "RuleName filepath" per match, one per line
          matchedRules = stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.split(' ')[0]);
        } catch {
          // No matches or error — treat as no match
        }

        const didMatch = matchedRules.length > 0;
        const correct = didMatch === sample.shouldMatch;
        logger.debug(`[YARA testRule] Sample "${sample.name}": shouldMatch=${sample.shouldMatch}, didMatch=${didMatch}, correct=${correct}`);
        sampleResults.push({
          name: sample.name,
          shouldMatch: sample.shouldMatch,
          didMatch,
          correct,
          matchedRules,
        });
      }

      const correctCount = sampleResults.filter(r => r.correct).length;
      const accuracy = samples.length > 0 ? correctCount / samples.length : 0;

      logger.debug(`[YARA testRule] Final: correctCount=${correctCount}/${samples.length}, accuracy=${accuracy}`);

      return {
        compiled: true,
        sampleResults,
        accuracy,
      };
    } finally {
      // H-7: Release concurrency slot
      releaseYaraSlot();

      // Cleanup temp directory
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
