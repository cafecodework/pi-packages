import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createI18n } from '../i18n';
import { I18nextProvider } from 'react-i18next';
import styles from './App.module.scss';

describe('isolated Web shell', () => {
  it('renders HashRouter and translated, styled UI without opening a socket', async () => {
    const websocket = vi.spyOn(globalThis, 'WebSocket');
    const i18n = createI18n();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    expect(screen.getByRole('heading', { name: 'Pi Cafe Space' })).toBeInTheDocument();
    expect(screen.getByText('尚未连接到 Relay')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass(styles.shell!);
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByText('Not connected to Relay')).toBeInTheDocument();
    expect(websocket).not.toHaveBeenCalled();
    websocket.mockRestore();
  });
});
