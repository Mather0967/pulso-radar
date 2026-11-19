import { GRANT_OPTIONS } from './helpers';
import type { GrantFormValue } from './types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Radix no admite value="" en SelectItem: «Sin acceso» usa un valor interno y se traduce a ''.
const NONE = '__none__';

interface GrantSelectProps {
  id: string;
  label: string;
  value: GrantFormValue;
  onChange: (value: GrantFormValue) => void;
  disabled?: boolean;
}

export function GrantSelect({ id, label, value, onChange, disabled }: GrantSelectProps) {
  return (
    <Select
      value={value || NONE}
      onValueChange={(next) => onChange(next === NONE ? '' : (next as GrantFormValue))}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={label} data-testid={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {GRANT_OPTIONS.map((option) => (
          <SelectItem key={option.value || NONE} value={option.value || NONE}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
