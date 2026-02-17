'use client';

import { Badge } from '@/components/ui/badge';
import { getMitreUrl, getMitreTechnique } from '@/lib/mitre-attack';
import { ExternalLink } from 'lucide-react';

interface MitreAttackBadgeProps {
  id: string;
  showName?: boolean;
  className?: string;
}

export function MitreAttackBadge({ id, showName = false, className }: MitreAttackBadgeProps) {
  const technique = getMitreTechnique(id);
  const name = technique?.name;

  return (
    <a
      href={getMitreUrl(id)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block"
      title={name ? `${id} — ${name}` : id}
    >
      <Badge
        variant="secondary"
        className={`cursor-pointer hover:bg-secondary/80 gap-1 ${className || ''}`}
      >
        {id}
        {showName && name && (
          <span className="text-muted-foreground font-normal">
            {name.includes(':') ? name.split(':')[1].trim() : name}
          </span>
        )}
        <ExternalLink className="h-3 w-3 opacity-60" />
      </Badge>
    </a>
  );
}
