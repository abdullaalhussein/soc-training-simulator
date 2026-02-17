'use client';

import { useState, useRef, useEffect } from 'react';
import { useSessionMessages, SessionMessage } from '@/hooks/useSessionMessages';
import { useAuthStore } from '@/store/authStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface DiscussionPanelProps {
  sessionId: string;
}

export function DiscussionPanel({ sessionId }: DiscussionPanelProps) {
  const { messages, isLoading, sendMessage } = useSessionMessages(sessionId);
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No messages yet. Start the discussion!</p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg: SessionMessage, i: number) => {
              const isOwn = msg.user.id === user?.id;
              const showHeader =
                i === 0 || messages[i - 1].user.id !== msg.user.id;

              return (
                <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  {showHeader && (
                    <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-medium">{isOwn ? 'You' : msg.user.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 leading-4 ${
                          msg.user.role === 'TRAINER' || msg.user.role === 'ADMIN'
                            ? 'border-purple-400 text-purple-600'
                            : 'border-slate-300 text-slate-500'
                        }`}
                      >
                        {msg.user.role}
                      </Badge>
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`text-[10px] mt-0.5 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
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
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
