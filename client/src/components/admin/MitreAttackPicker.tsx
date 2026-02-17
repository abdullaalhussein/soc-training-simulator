'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MITRE_TECHNIQUES, MITRE_TACTICS, getMitreUrl } from '@/lib/mitre-attack';
import { Check, ChevronsUpDown, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MitreAttackPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function MitreAttackPicker({ value, onChange }: MitreAttackPickerProps) {
  const [open, setOpen] = useState(false);

  const toggleTechnique = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const removeTechnique = (id: string) => {
    onChange(value.filter(v => v !== id));
  };

  // Group techniques by tactic for display
  const groupedTechniques = MITRE_TACTICS.map(tactic => ({
    tactic,
    techniques: MITRE_TECHNIQUES.filter(t => t.tactic === tactic),
  }));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {value.length === 0
              ? 'Select MITRE ATT&CK techniques...'
              : `${value.length} technique${value.length > 1 ? 's' : ''} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search techniques (e.g. T1566, Phishing, Initial Access)..." />
            <CommandList>
              <CommandEmpty>No technique found.</CommandEmpty>
              {groupedTechniques.map(({ tactic, techniques }) => (
                <CommandGroup key={tactic} heading={tactic}>
                  {techniques.map(technique => {
                    const isSelected = value.includes(technique.id);
                    return (
                      <CommandItem
                        key={technique.id}
                        value={`${technique.id} ${technique.name} ${technique.tactic}`}
                        onSelect={() => toggleTechnique(technique.id)}
                      >
                        <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                        <span className="font-mono text-xs mr-2 shrink-0">{technique.id}</span>
                        <span className="truncate">{technique.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected techniques as badges */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(id => {
            const technique = MITRE_TECHNIQUES.find(t => t.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                <a
                  href={getMitreUrl(id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {id}
                  <ExternalLink className="h-3 w-3" />
                </a>
                {technique && (
                  <span className="text-muted-foreground ml-1 text-xs hidden sm:inline">
                    {technique.name.split(':')[0]}
                  </span>
                )}
                <button
                  type="button"
                  className="ml-1 rounded-full hover:bg-muted p-0.5"
                  onClick={(e) => { e.stopPropagation(); removeTechnique(id); }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
