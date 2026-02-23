'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGenerateScenario } from '@/hooks/useGenerateScenario';
import { useImportScenario } from '@/hooks/useScenarios';
import { toast } from '@/components/ui/toaster';
import { Sparkles, Loader2, Download, Upload, Copy } from 'lucide-react';

interface ScenarioGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  'Email Threats',
  'Malware',
  'Network Intrusion',
  'Insider Threat',
  'Ransomware',
  'Cloud Security',
  'Web Application Attack',
  'Credential Theft',
  'Data Exfiltration',
  'Supply Chain Attack',
];

export function ScenarioGeneratorDialog({ open, onOpenChange }: ScenarioGeneratorDialogProps) {
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('INTERMEDIATE');
  const [mitreInput, setMitreInput] = useState('');
  const [numStages, setNumStages] = useState(3);
  const [category, setCategory] = useState('Malware');
  const [generatedJson, setGeneratedJson] = useState<any>(null);
  const [jsonText, setJsonText] = useState('');

  const generateMutation = useGenerateScenario();
  const importMutation = useImportScenario();

  const handleGenerate = async () => {
    const mitreAttackIds = mitreInput
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (mitreAttackIds.length === 0) {
      toast({ title: 'Enter at least one MITRE ATT&CK ID (e.g., T1566.001)', variant: 'destructive' });
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        description,
        difficulty,
        mitreAttackIds,
        numStages,
        category,
      });
      setGeneratedJson(result);
      setJsonText(JSON.stringify(result, null, 2));
    } catch {
      toast({ title: 'Failed to generate scenario', variant: 'destructive' });
    }
  };

  const handleDownload = () => {
    try {
      const data = JSON.parse(jsonText);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(data.name || 'ai-scenario').replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Scenario downloaded' });
    } catch {
      toast({ title: 'Invalid JSON', variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(jsonText);
      await importMutation.mutateAsync(data);
      toast({ title: 'Scenario imported successfully' });
      onOpenChange(false);
      resetForm();
    } catch {
      toast({ title: 'Failed to import scenario. Check the JSON.', variant: 'destructive' });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    toast({ title: 'Copied to clipboard' });
  };

  const resetForm = () => {
    setGeneratedJson(null);
    setJsonText('');
    setDescription('');
    setMitreInput('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Generate Scenario with AI
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {!generatedJson ? (
            <>
              <div>
                <Label>Attack Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the attack scenario you want to create. E.g., 'A phishing campaign targeting finance employees that delivers a macro-enabled document, which downloads a second-stage payload and establishes persistence via scheduled tasks.'"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BEGINNER">Beginner</SelectItem>
                      <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                      <SelectItem value="ADVANCED">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>MITRE ATT&CK IDs</Label>
                  <Input
                    value={mitreInput}
                    onChange={(e) => setMitreInput(e.target.value)}
                    placeholder="T1566.001, T1059.001, T1053.005"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Comma-separated technique IDs</p>
                </div>

                <div>
                  <Label>Number of Stages</Label>
                  <Select value={String(numStages)} onValueChange={(v) => setNumStages(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} stage{n !== 1 ? 's' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Generated Scenario JSON</Label>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={handleCopy}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setGeneratedJson(null); setJsonText(''); }}>
                    Back
                  </Button>
                </div>
              </div>
              <Textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={20}
                className="font-mono text-xs"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          {!generatedJson ? (
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || description.length < 10}
            >
              {generateMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Generate</>
              )}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
              <Button onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" /> Import to Platform</>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
