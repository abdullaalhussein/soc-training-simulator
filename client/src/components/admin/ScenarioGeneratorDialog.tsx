'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MitreAttackPicker } from './MitreAttackPicker';
import { useGenerateScenario } from '@/hooks/useGenerateScenario';
import { useImportScenario } from '@/hooks/useScenarios';
import { toast } from '@/components/ui/toaster';
import { Sparkles, Loader2, Download, Upload, Copy, ChevronDown, Zap } from 'lucide-react';

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

const TEMPLATES = [
  { label: 'Phishing Campaign', description: 'A spear-phishing email campaign targeting employees with a malicious attachment that drops a reverse shell and establishes C2 communication.' },
  { label: 'Ransomware Incident', description: 'A ransomware attack that begins with an exposed RDP service, escalates privileges via credential dumping, moves laterally, and encrypts file shares.' },
  { label: 'Insider Threat', description: 'A disgruntled employee exfiltrates sensitive data by accessing unauthorized file shares, using USB devices, and uploading to external cloud storage.' },
  { label: 'Web App Attack', description: 'An attacker exploits a SQL injection vulnerability in a web application to extract database credentials, then pivots to internal systems.' },
];

export function ScenarioGeneratorDialog({ open, onOpenChange }: ScenarioGeneratorDialogProps) {
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [mitreIds, setMitreIds] = useState<string[]>([]);
  const [numStages, setNumStages] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [showExpert, setShowExpert] = useState(false);
  const [generatedJson, setGeneratedJson] = useState<any>(null);
  const [jsonText, setJsonText] = useState('');

  const generateMutation = useGenerateScenario();
  const importMutation = useImportScenario();

  const handleGenerate = async () => {
    try {
      const params: any = { description };
      if (difficulty) params.difficulty = difficulty;
      if (mitreIds.length > 0) params.mitreAttackIds = mitreIds;
      if (numStages) params.numStages = Number(numStages);
      if (category) params.category = category;

      const result = await generateMutation.mutateAsync(params);
      setGeneratedJson(result);
      setJsonText(JSON.stringify(result, null, 2));
    } catch {
      toast({ title: 'Failed to generate scenario', variant: 'destructive' });
    }
  };

  const handleTemplate = (template: typeof TEMPLATES[0]) => {
    setDescription(template.description);
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

      // Validate every checkpoint has an explanation (required for trainer Scenario Guide)
      const missing = (data.checkpoints || []).filter(
        (cp: any, i: number) => !cp.explanation || !cp.explanation.trim()
      );
      if (missing.length > 0) {
        toast({
          title: `${missing.length} checkpoint${missing.length > 1 ? 's' : ''} missing an explanation. Add an "explanation" field to every checkpoint before importing.`,
          variant: 'destructive',
        });
        return;
      }

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
    setDifficulty('');
    setMitreIds([]);
    setNumStages('');
    setCategory('');
    setShowExpert(false);
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
              {/* Description — the only required field */}
              <div>
                <Label>Describe the attack scenario</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="E.g., A phishing campaign targeting finance employees that delivers a macro-enabled document, downloads a second-stage payload, and establishes persistence via scheduled tasks."
                  rows={4}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Just describe the attack — AI will determine difficulty, MITRE techniques, stages, and all scenario content.
                </p>
              </div>

              {/* Quick templates */}
              <div>
                <Label className="text-xs text-muted-foreground">Quick templates</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {TEMPLATES.map((t) => (
                    <Button
                      key={t.label}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleTemplate(t)}
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Expert controls — collapsible */}
              <div className="border rounded-lg">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => setShowExpert(!showExpert)}
                >
                  <span>Expert controls (optional)</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showExpert ? 'rotate-180' : ''}`} />
                </button>
                {showExpert && (
                  <div className="px-3 pb-3 space-y-3 border-t">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                      <div>
                        <Label className="text-xs">Difficulty</Label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="AI decides" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BEGINNER">Beginner</SelectItem>
                            <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                            <SelectItem value="ADVANCED">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="AI decides" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Number of Stages</Label>
                        <Select value={numStages} onValueChange={setNumStages}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="AI decides" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <SelectItem key={n} value={String(n)}>{n} stage{n !== 1 ? 's' : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">MITRE ATT&CK Techniques</Label>
                      <div className="mt-1">
                        <MitreAttackPicker value={mitreIds} onChange={setMitreIds} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Leave empty and AI will select the appropriate techniques from the description.
                      </p>
                    </div>
                  </div>
                )}
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
