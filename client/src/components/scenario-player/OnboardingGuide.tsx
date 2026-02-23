'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Search, Package, Clock, Shield, CheckCircle, ArrowRight } from 'lucide-react';

const ONBOARDING_KEY = 'soc-trainee-onboarded';

const steps = [
  {
    icon: Search,
    title: 'Analyze Logs',
    description: 'Review simulated security logs in the log viewer. Use search, filters, and click any log for details. Look for patterns and anomalies that indicate malicious activity.',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Package,
    title: 'Collect Evidence',
    description: 'Click the + button on suspicious logs to add them to your Evidence basket. Build your case by collecting the most relevant artifacts. You can remove items if you change your mind.',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
  {
    icon: Clock,
    title: 'Build Timeline',
    description: 'Click the clock icon on logs to add them to your Timeline. Reconstruct the sequence of events to understand how the attack progressed.',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Shield,
    title: 'SOC Mentor',
    description: 'Stuck? Open the SOC Mentor for guidance. It will ask you questions to help you think critically — it will never give you the answer directly. Use it wisely (limited messages per day).',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    icon: CheckCircle,
    title: 'Answer Checkpoints',
    description: 'At the end of each stage, you will answer checkpoint questions to test your understanding. Your responses are scored across accuracy, investigation quality, evidence, response, and reporting.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
];

export function OnboardingGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      setOpen(true);
    }
  }, []);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setOpen(false);
  };

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <div className="text-center space-y-4 py-2">
          {/* Step indicator */}
          <div className="flex justify-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${current.bg}`}>
            <Icon className={`h-8 w-8 ${current.color}`} />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{current.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Skip tour
          </Button>
          <Button size="sm" onClick={handleNext}>
            {isLast ? 'Start Investigation' : 'Next'}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
