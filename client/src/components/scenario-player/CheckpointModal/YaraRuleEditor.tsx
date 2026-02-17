'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { CheckCircle, XCircle, AlertTriangle, Play, FileText } from 'lucide-react';

interface SampleMeta {
  name: string;
  description: string;
  shouldMatch: boolean;
  previewStrings?: string[];
  previewHex?: string;
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

interface YaraRuleEditorProps {
  checkpointId: string;
  samples: SampleMeta[];
  value: string;
  onChange: (value: string) => void;
}

const YARA_TEMPLATE = `rule detect_suspicious {
    meta:
        author = "trainee"
        description = "Detect suspicious pattern"

    strings:
        $s1 = "example"

    condition:
        any of them
}`;

export function YaraRuleEditor({ checkpointId, samples, value, onChange }: YaraRuleEditorProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    if (!value.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/yara/test', { checkpointId, ruleText: value });
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        compiled: false,
        compileError: err.response?.data?.message || 'Failed to test rule',
        sampleResults: [],
        accuracy: 0,
      });
    } finally {
      setTesting(false);
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.8) return 'text-green-400';
    if (accuracy >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-4">
      {/* Sample Files Display */}
      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          Sample Files
        </h4>
        <div className="grid gap-2">
          {samples.map((sample, i) => (
            <div key={i} className="border rounded-md p-3 bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono font-medium">{sample.name}</span>
                <Badge variant={sample.shouldMatch ? 'destructive' : 'secondary'} className="text-xs">
                  {sample.shouldMatch ? 'Should Match' : 'Benign'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-1">{sample.description}</p>
              {sample.previewStrings && sample.previewStrings.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs text-muted-foreground">Strings: </span>
                  <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
                    {sample.previewStrings.map(s => `"${s}"`).join(', ')}
                  </span>
                </div>
              )}
              {sample.previewHex && (
                <div className="mt-1">
                  <span className="text-xs text-muted-foreground">Hex: </span>
                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                    {sample.previewHex}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* YARA Rule Editor */}
      <div>
        <h4 className="text-sm font-medium mb-2">YARA Rule</h4>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={YARA_TEMPLATE}
          rows={14}
          className="w-full rounded-md border bg-zinc-900 text-green-400 font-mono text-sm p-3 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-zinc-600"
          spellCheck={false}
        />
      </div>

      {/* Test Button */}
      <Button
        variant="outline"
        onClick={handleTest}
        disabled={testing || !value?.trim()}
        className="w-full"
      >
        <Play className="h-4 w-4 mr-2" />
        {testing ? 'Testing Rule...' : 'Test Rule'}
      </Button>

      {/* Test Results */}
      {testResult && (
        <div className="space-y-3">
          {/* Compile Error */}
          {!testResult.compiled && testResult.compileError && (
            <div className="rounded-md bg-red-950/50 border border-red-800 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-red-400">Compilation Error</span>
              </div>
              <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono mt-1">
                {testResult.compileError}
              </pre>
            </div>
          )}

          {/* Per-sample results */}
          {testResult.compiled && testResult.sampleResults.length > 0 && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Test Results</span>
                <span className={`text-sm font-bold ${getAccuracyColor(testResult.accuracy)}`}>
                  {Math.round(testResult.accuracy * 100)}% Accuracy
                </span>
              </div>
              {testResult.sampleResults.map((sr, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {sr.correct ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                  <span className="font-mono text-xs">{sr.name}</span>
                  <span className="text-muted-foreground text-xs">—</span>
                  <span className="text-xs">
                    {sr.didMatch ? 'Matched' : 'No match'}
                    {sr.shouldMatch ? ' (expected match)' : ' (expected no match)'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
