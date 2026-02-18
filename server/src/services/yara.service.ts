import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

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
    // Remove include and import directives to prevent filesystem access
    let sanitized = ruleText.replace(/^\s*include\s+"[^"]*"\s*$/gm, '// include removed for security');
    sanitized = sanitized.replace(/^\s*import\s+"[^"]*"\s*$/gm, '// import removed for security');
    return sanitized;
  }

  /**
   * Test a YARA rule against a set of samples.
   */
  static async testRule(ruleText: string, samples: SampleInput[]): Promise<TestResult> {
    const id = crypto.randomUUID();
    const tmpDir = path.join('/tmp', `yara-${id}`);

    logger.debug(`[YARA testRule] id=${id}, rule length=${ruleText.length}, samples=${samples.length}`);
    logger.debug(`[YARA testRule] Rule preview: ${ruleText.substring(0, 200)}`);

    try {
      await fs.mkdir(tmpDir, { recursive: true });

      // Write rule file (caller is responsible for sanitizing)
      const rulePath = path.join(tmpDir, 'rule.yar');
      await fs.writeFile(rulePath, ruleText, 'utf-8');

      // Compile check — run against an empty file to validate syntax
      const emptyPath = path.join(tmpDir, '__empty');
      await fs.writeFile(emptyPath, '');
      try {
        await execFileAsync('yara', [rulePath, emptyPath], { timeout: 10000 });
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
        const samplePath = path.join(tmpDir, safeName);
        const content = Buffer.from(sample.content, 'base64');
        await fs.writeFile(samplePath, content);

        let matchedRules: string[] = [];
        try {
          const { stdout } = await execFileAsync('yara', [rulePath, samplePath], { timeout: 10000 });
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
      // Cleanup temp directory
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
