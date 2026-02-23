'use client';

import { useState, useRef, useEffect } from 'react';
import { useAiAssistant, AiMessage } from '@/hooks/useAiAssistant';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Loader2 } from 'lucide-react';

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium">AI Assistant</span>
        </div>
        {remaining !== null && (
          <Badge variant="outline" className="text-xs">
            {remaining} left
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <Sparkles className="h-8 w-8 text-purple-400 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Ask me anything about the investigation. I&apos;ll guide you without giving away the answers.
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
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
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
