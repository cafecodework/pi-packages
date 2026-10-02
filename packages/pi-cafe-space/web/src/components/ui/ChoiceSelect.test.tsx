import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ChoiceSelect } from './ChoiceSelect';
import { UiProvider } from './UiProvider';

// Floating UI needs browser geometry. Open/select/keyboard/CSP and real Gateway
// payload checks live in cafe-ui-browser.mjs --shadcn, not a JSDOM layout mock.
it('renders an accessible shadcn trigger with empty selection and a disabled state', () => {
  const change = vi.fn();
  const props = { label: 'Delivery', value: '', items: [{ value: '', label: 'Choose delivery' }, { value: 'steer', label: 'Steer' }], onValueChange: change };
  const { rerender } = render(<UiProvider><ChoiceSelect {...props} /></UiProvider>);
  const trigger = screen.getByRole('combobox', { name: 'Delivery' });
  expect(trigger.tagName).toBe('BUTTON'); expect(trigger).toHaveTextContent('Choose delivery');
  expect(trigger).toHaveAttribute('data-slot', 'select-trigger');
  expect(trigger.closest('[data-slot="field"]')).toHaveAttribute('data-orientation', 'horizontal');
  expect(screen.getByLabelText('Delivery')).toBe(trigger);
  rerender(<UiProvider><ChoiceSelect {...props} disabled /></UiProvider>);
  expect(trigger).toBeDisabled(); expect(change).not.toHaveBeenCalled();
  expect(document.querySelectorAll('style')).toHaveLength(0);
});
