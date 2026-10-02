import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isThinkingLevel, type CommandPayload } from '../../../../src/protocol/index';
import type { AppOwner } from '../../app/owner';
import { useCollabStore } from '../../state/useCollabStore';
import styles from './ModelControls.module.scss';
import { Icon } from '../../components/ui/Icon';
import { Button, Input } from '../../components/ui/Controls';
import { ChoiceSelect } from '../../components/ui/ChoiceSelect';
import { Field, FieldGroup, FieldLabel } from '../../components/ui/shadcn/field';
export function ModelControls({ owner, readOnly, expanded = false }: { owner: AppOwner; readOnly: boolean; expanded?: boolean }) {
  const id = useId();
  const { t } = useTranslation(); const state = useCollabStore(owner.store, s => s);
  const scope = owner.store.scope(); const host = state.selectedHostId ? state.hosts.get(state.selectedHostId) : undefined;
  const snapshot = host?.snapshot;
  const enabled = !readOnly && state.connection.status === 'authenticated' && !!scope && !!host && !host.stale && host.info.connected && host.info.ready !== false;
  const [provider, setProvider] = useState(snapshot?.model?.provider ?? ''); const [model, setModel] = useState(snapshot?.model?.id ?? '');
  const [busy, setBusy] = useState(false); const latch = useRef(false); const active = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const run = async (payload: CommandPayload) => {
    if (!enabled || !scope || latch.current) return;
    latch.current = true; setBusy(true);
    try { const result = await owner.gateway.execute(payload, scope); if (result.status === 'unknown' || result.status === 'rejected') owner.store.notice(result.code ?? 'COMMAND_ERROR'); }
    finally { latch.current = false; if (active.current) setBusy(false); }
  };
  return <details className={styles.controls} open={expanded || undefined}><summary><Icon name="settings" />{t('modelSettings')}</summary>
    <p>{t('currentModel')}: {snapshot?.model ? `${snapshot.model.provider}/${snapshot.model.id}` : '—'}</p>
    <ChoiceSelect label={t('thinking')} value={snapshot?.thinkingLevel ?? 'off'} disabled={!enabled || busy}
      items={['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].map(level => ({ value: level, label: level }))}
      onValueChange={level => { if (isThinkingLevel(level)) void run({ name: 'set_thinking', level }); }} />
    <form onSubmit={event => { event.preventDefault(); void run({ name: 'set_model', provider, modelId: model }); }}><FieldGroup>
      <Field data-disabled={!enabled || busy}><FieldLabel htmlFor={`${id}-provider`}>{t('provider')}</FieldLabel><Input id={`${id}-provider`} value={provider} maxLength={128} disabled={!enabled || busy} onChange={event => setProvider(event.target.value.slice(0, 128))} /></Field>
      <Field data-disabled={!enabled || busy}><FieldLabel htmlFor={`${id}-model`}>{t('modelId')}</FieldLabel><Input id={`${id}-model`} value={model} maxLength={256} disabled={!enabled || busy} onChange={event => setModel(event.target.value.slice(0, 256))} /></Field>
      <Button type="submit" aria-label={t('applyModel')} loading={busy} disabled={!enabled || busy || !provider || !model}>{t('applyModel')}</Button>
    </FieldGroup></form>
  </details>;
}
