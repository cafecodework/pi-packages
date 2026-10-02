import clsx from 'clsx';
import type { ToolView } from '../runtime/convertMessages';
import { useDisclosure } from './CollapseState';
import { useChatLabels } from './labels';
import styles from './Conversation.module.scss';
import { Icon } from '../../../components/ui/Icon';
export function isToolView(value: unknown): value is ToolView {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.key === 'string' && typeof v.callId === 'string' && typeof v.name === 'string' && typeof v.argsText === 'string' && typeof v.output === 'string' && typeof v.argsValid === 'boolean' && typeof v.hasOutput === 'boolean' && typeof v.conflict === 'boolean' && ['pending', 'running', 'complete', 'error'].includes(String(v.status)) && ['attached', 'missing-parent', 'ambiguous'].includes(String(v.association));
}
export function ToolPart({ view }: { view: ToolView }) {
  const labels = useChatLabels();
  const disclosure = useDisclosure(view.key, view.status === 'running' || view.status === 'error');
  return <details className={clsx(styles.tool, view.status === 'error' && styles.failure)} data-tool-id={view.callId} data-tool-status={view.status} open={disclosure.open}>
    <summary onClick={event => { event.preventDefault(); disclosure.setOpen(!disclosure.open); }}><Icon name="hosts" /><strong>{view.name}</strong> <span>{labels[view.status]}</span>{view.conflict && <span className={styles.warning}>{labels.conflict}</span>}</summary>
    {view.association !== 'attached' && <p className={styles.warning}>{view.association === 'ambiguous' ? labels.ambiguous : labels.parentMissing}</p>}
    {!view.argsValid && <p className={styles.warning}>{labels.invalidArgs}</p>}
    <div className={styles.toolBody}>
      <h4>{labels.args}</h4><pre>{view.argsText}</pre>
      <h4>{labels.output}</h4>
      {view.hasOutput ? view.output === '' ? <p>{labels.empty}</p> : <pre>{view.output}</pre> : <p>{labels.noOutput}</p>}
    </div>
  </details>;
}
