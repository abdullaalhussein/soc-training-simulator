'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { BookOpen, ArrowRight } from 'lucide-react';

interface LessonViewProps {
  scenarioName: string;
  lessonContent: string;
  onContinue: () => void;
}

export function LessonView({ scenarioName, lessonContent, onContinue }: LessonViewProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-lg">{scenarioName}</h1>
          </div>
          <Button onClick={onContinue}>
            Continue to Investigation <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Card>
            <CardContent className="p-8">
              <MarkdownRenderer content={lessonContent} />
            </CardContent>
          </Card>

          <div className="flex justify-center py-8">
            <Button size="lg" onClick={onContinue}>
              Continue to Investigation <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
