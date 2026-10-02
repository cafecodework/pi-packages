import { useId } from 'react';
import { Field, FieldLabel } from './shadcn/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './shadcn/select';
import { useUiPortal } from './UiProvider';
export function ChoiceSelect({ label, value, items, disabled, onValueChange }: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  const id = useId(); const container = useUiPortal();
  return <Field orientation="horizontal" className="w-fit max-w-full flex-wrap gap-x-2 gap-y-1" data-disabled={disabled}>
    <FieldLabel className="text-xs text-muted-foreground" htmlFor={id}>{label}</FieldLabel>
    <Select items={items} value={value} disabled={disabled} onValueChange={next => {
      if (next !== null && items.some(item => item.value === next)) onValueChange(next);
    }}>
      <SelectTrigger id={id} aria-label={label} className="w-auto min-w-0 max-w-[min(12rem,100%)] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent container={container}><SelectGroup>
        {items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
  </Field>;
}
