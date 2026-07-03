"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERSONAS } from "@/lib/personas";

interface PersonaSwitcherProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function PersonaSwitcher({ value, onChange, disabled }: PersonaSwitcherProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-9 w-44 rounded-xl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.values(PERSONAS).map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.shortName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}