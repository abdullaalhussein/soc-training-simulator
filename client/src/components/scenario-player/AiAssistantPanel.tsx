'use client';

import { useState, useRef, useEffect } from 'react';
import { useAiAssistant, AiMessage } from '@/hooks/useAiAssistant';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Shield, Loader2, Eye } from 'lucide-react';

const MAX_MESSAGES = 20;

interface AiAssistantPanelProps {
  attemptId: string;
}

export function AiAssistantPanel({ attemptId }: AiAssistantPanelProps) {
  const { messages, isLoading, isSending, remaining, sendMessage } = useAiAssistant(attemptId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const used = remaining !== null ? MAX_MESSAGES - remaining : 0;
  const usagePercent = remaining !== null ? (used / MAX_MESSAGES) * 100 : 0;
  const showUsageBar = remaining !== null && usagePercent >= 50;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">SOC Mentor</span>
          </div>
          <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal gap-1">
            <Eye className="h-3 w-3" />
            Trainer visible
          </Badge>
        </div>
        {showUsageBar && (
          <div className="mt-1.5">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePercent >= 80 ? 'bg-red-500' : 'bg-purple-500'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 text-right">
              {remaining} message{remaining !== 1 ? 's' : ''} remaining
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <Shield className="h-8 w-8 text-purple-400 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium">SOC Mentor</p>
              <p className="text-xs text-muted-foreground">
                I will guide your investigation using questions and methodology — I will not give you answers.
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground/60 italic">
              Conversations may be reviewed by your trainer.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg: AiMessage) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-100'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  ) : (
                    <MarkdownRenderer
                      content={msg.content}
                      className="text-sm [&_p]:my-0.5 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0"
                    />
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex items-start">
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-1.5">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-2 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for guidance..."
          className="flex-1"
          disabled={isSending || (remaining !== null && remaining <= 0)}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isSending || (remaining !== null && remaining <= 0)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
