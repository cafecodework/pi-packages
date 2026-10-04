import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionSnapshot } from '../../../../../src/protocol/index';
import styles from './Conversation.module.scss';

export type AgentActivityKind = 'thinking' | 'responding' | 'tool' | 'working' | 'waiting' | 'offline' | null;
function lastMatch<T>(items: T[], match: (item: T) => boolean): T | undefined { for (let i = items.length - 1; i >= 0; i--) if (match(items[i]!)) return items[i]; return undefined; }
export function agentActivity(snapshot: SessionSnapshot, connected = true): { kind: AgentActivityKind; tool?: string } {
  if (!connected) return { kind: snapshot.phase === 'running' || snapshot.phase === 'waiting_local_ui' ? 'offline' : null };
  if (snapshot.phase === 'waiting_local_ui') return { kind: 'waiting' };
  if (snapshot.phase !== 'running') return { kind: null };
  const tool = lastMatch(snapshot.tools, item => item.status === 'running');
  if (tool) return { kind: 'tool', tool: tool.toolName.slice(0, 64) };
  const message = lastMatch(snapshot.messages, item => item.role === 'assistant' && item.status === 'streaming');
  const last = message?.parts?.at(-1);
  if (last?.type === 'thinking' || !message?.parts && message?.thinking && !message.text) return { kind: 'thinking' };
  if (last?.type === 'text' && last.text || message?.text) return { kind: 'responding' };
  return { kind: 'working' };
}
export function AgentActivity({ snapshot, connected = true }: { snapshot: SessionSnapshot; connected?: boolean }) {
  const { i18n } = useTranslation(), zh = i18n.language.startsWith('zh');
  const activity = agentActivity(snapshot, connected);
  const active = !!activity.kind && activity.kind !== 'offline';
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0); if (!active) return;
    const started = Date.now(); const timer = setInterval(() => setSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [active, snapshot.streamId, snapshot.sessionId]);
  if (!activity.kind) return null;
  const text = zh ? { thinking: '正在思考', responding: '正在回复', tool: '正在执行', working: '正在处理', waiting: '等待办公电脑上的确认', offline: '连接已中断，状态暂未更新' } : { thinking: 'Thinking', responding: 'Responding', tool: 'Running', working: 'Working', waiting: 'Waiting for confirmation on the office computer', offline: 'Disconnected · status is not live' };
  const elapsed = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return <div className={styles.activity} data-activity={activity.kind}>
    <span aria-hidden="true" className={styles.activityGlyph}>{active && activity.kind !== 'waiting' ? '✳' : '·'}</span>
    <span role="status" aria-live="polite" className={styles.activityLabel}>{text[activity.kind]}{activity.tool && <code>{activity.tool}</code>}</span>
    {active && seconds > 0 && <small aria-hidden="true" title={zh ? '从本次观察开始计时，不是计费时间' : 'Time since this activity was observed, not billing duration'}>{elapsed}</small>}
  </div>;
}
