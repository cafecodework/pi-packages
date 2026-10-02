import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import styles from './App.module.scss';
import { AppOwner } from './owner';
import { parseRoomRoute, roomHref } from './roomRoute';
import { useCollabStore } from '../state/useCollabStore';
import { scopeKey } from '../state/CollabStore';
import { isThinkingLevel, type CommandPayload } from '../../../src/protocol/index';
import type { GatewayResult } from '../services/relay/CommandGateway';
import { LoginForm } from '../features/auth/LoginForm';
import { Conversation } from '../features/chat/components/Conversation';
import { Composer } from '../features/chat/components/Composer';
import { referencedFiles } from '../features/chat/components/useInputAssist';
import { FilesPane } from '../features/files/FilesPane';
import { HistoryList, HistoryDetail } from '../features/history/History';
import { useManagedSessions, ManagedSessionList, ManagedSessionDialog } from '../features/history/ManagedSessions';
import { SessionActions, type SessionActionRequest } from '../features/history/SessionActions';
import { ModelControls } from '../features/hosts/ModelControls';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { useFollowScroll } from '../components/ui/useFollowScroll';
import { Icon } from '../components/ui/Icon';
import { Button, IconButton, Input } from '../components/ui/Controls';
import { Drawer } from '../components/ui/Drawer';
import { UiProvider } from '../components/ui/UiProvider';
const defaultFactory = () => new AppOwner();
function Workspace({ owner, roomBase, onNewSession }: { owner: AppOwner; roomBase: string; onNewSession: (trigger: HTMLElement) => void }) {
  const { t } = useTranslation();
  const state = useCollabStore(owner.store, value => value);
  const root = useRef<HTMLElement>(null);
  const scope = owner.store.scope();
  const { following, scrollToBottom } = useFollowScroll(root, scope ? scopeKey(scope) : '');
  const [settingsTrigger, setSettingsTrigger] = useState<HTMLElement | null>(null);
  const [sessionAction, setSessionAction] = useState<SessionActionRequest | null>(null);
  const [historyTrigger, setHistoryTrigger] = useState<HTMLElement | null>(null);
  const contextKey = scope ? scopeKey(scope) : '';
  useEffect(() => { setSettingsTrigger(null); setSessionAction(null); setHistoryTrigger(null); }, [contextKey]);
  const host = state.selectedHostId ? state.hosts.get(state.selectedHostId) : undefined;
  const snapshot = host?.snapshot;
  const enabled = state.connection.status === 'authenticated' && !!scope && !!host && !host.stale && host.info.connected && host.info.ready !== false;
  const execute = (payload: CommandPayload): Promise<GatewayResult> => scope ? owner.gateway.execute(payload, scope).then(result => { if (result.status === 'unknown') owner.store.notice('RESULT_UNKNOWN'); return result; }) : Promise.resolve({ status: 'rejected', code: 'HOST_REQUIRED', message: null });
  const localCommands = ['new', 'name', 'resume', 'model', 'thinking'].map((value, i) => ({ value, label: '/' + value, description: t(['newSession', 'renameSession', 'history', 'modelSettings', 'thinking'][i]!) }));
  const send = (text: string, delivery?: 'steer' | 'followUp', files?: string[]): Promise<GatewayResult> => {
    const command = text.trim();
    if (!command.startsWith('/')) {
      const references = files ?? referencedFiles(text);
      return execute({ name: 'prompt', content: text, ...(delivery ? { delivery } : {}), ...(references.length ? { files: references } : {}) });
    }
    const reject = (code: string) => Promise.resolve<GatewayResult>({ status: 'rejected', code, message: null });
    if (command === '/new') {
      const trigger = root.current?.querySelector('textarea');
      if (!trigger) return reject('HOST_REQUIRED');
      onNewSession(trigger);
      return Promise.resolve({ status: 'applied', code: null, message: null, data: { kind: 'local_action' } });
    }
    if (!enabled || snapshot?.inputAssist !== true) return reject('INPUT_ASSIST_UNAVAILABLE');
    if (snapshot.phase !== 'idle' || snapshot.hasPendingMessages) return reject('SESSION_BUSY');
    const [, name, args = ''] = /^\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(command) ?? [];
    const trigger = root.current?.querySelector('textarea');
    if (!trigger) return reject('HOST_REQUIRED');
    if (name === 'thinking' && args) return isThinkingLevel(args) ? execute({ name: 'set_thinking', level: args }) : reject('INVALID_COMMAND');
    if (['new', 'resume', 'model', 'thinking'].includes(name ?? '') && args) return reject('INVALID_COMMAND');
    if (name === 'name') setSessionAction({ mode: 'rename_session', trigger, ...(args ? { title: args } : {}) });
    else if (name === 'model' || name === 'thinking') setSettingsTrigger(trigger);
    else if (name === 'resume') setHistoryTrigger(trigger);
    else return execute({ name: 'run_command', command });
    return Promise.resolve({ status: 'applied', code: null, message: null, data: { kind: 'local_action' } });
  };
  return <section ref={root} className={styles.center} aria-label={t('conversation')}>
    {!scope || !snapshot ? <div className={styles.placeholder}><Icon name="message" /><h2>{t(state.selectedHostId ? 'hostSynchronizing' : 'selectHost')}</h2><p>{t('hostHelp')}</p></div> : <>
      <header className={styles.conversationHeader} aria-label={t('currentSession')}><div className={styles.conversationIdentity}><h2 title={host?.info.sessionName ?? undefined}>{host?.info.sessionName || t('conversation')}</h2><div className={styles.conversationMeta}><span title={scope.cwd}>{scope.cwd || scope.hostId}</span><span className={styles.contextState} data-offline={!enabled} data-running={snapshot.phase === 'running'}>{t(!host?.info.connected ? 'offline' : host.stale ? 'hostSynchronizing' : snapshot.phase === 'running' ? 'working' : snapshot.phase === 'waiting_local_ui' ? 'localInput' : 'ready')}</span></div></div></header>
      <Conversation snapshot={snapshot} scope={scope} disabled={!enabled} onSend={async text => { const result = await send(text); if (result.status === 'rejected' || result.status === 'unknown') owner.store.notice(result.code ?? 'COMMAND_ERROR'); }} onAbort={async () => { const result = await execute({ name: 'abort' }); if (result.code) owner.store.notice(result.code); }} />
      <Composer navigation={!following && <Button className={styles.latest} onClick={scrollToBottom}><Icon name="down" />{t('jumpLatest')}</Button>} scopeId={JSON.stringify([scopeKey(scope), state.connection.generation, state.viewGeneration])} enabled={enabled} phase={snapshot.phase} inputAssist={snapshot.inputAssist === true} localCommands={localCommands} readCompletions={(payload, signal) => scope ? owner.gateway.execute(payload, scope, { signal, transient: true }) : Promise.resolve({ status: 'rejected', code: 'HOST_REQUIRED', message: null })} send={send} abort={() => execute({ name: 'abort' })} context={<Button variant="quiet" className={styles.modelTrigger} aria-label={t('modelSettings')} onClick={event => setSettingsTrigger(event.currentTarget)}><Icon name="settings" /><span>{snapshot.model?.id ?? t('modelSettings')}</span><small>{snapshot.thinkingLevel ?? 'off'}</small></Button>} />
      {sessionAction && <SessionActions owner={owner} roomBase={roomBase} request={sessionAction} />}
      {historyTrigger && <Drawer label={t('history')} closeLabel={t('close')} onClose={() => setHistoryTrigger(null)} restoreFocusTo={historyTrigger}><HistoryList owner={owner} roomBase={roomBase} /></Drawer>}
      {settingsTrigger && <Drawer label={t('modelSettings')} closeLabel={t('close')} onClose={() => setSettingsTrigger(null)} restoreFocusTo={settingsTrigger}><ModelControls key={contextKey} owner={owner} readOnly={!enabled} expanded /></Drawer>}
    </>}
  </section>;
}
function Shell({ owner, defaultRoom, managedSessions }: { owner: AppOwner; defaultRoom: string; managedSessions: boolean }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate(); const location = useLocation();
  // Appearance is local UI state, never part of the Relay scope or credential store.
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [search, setSearch] = useState('');
  const state = useCollabStore(owner.store, value => value);
  const route = parseRoomRoute(location.pathname);
  const roomId = route.valid ? route.roomId : null;
  const base = route.valid ? route.base : '';
  const pagePath = route.valid ? route.pagePath : '';
  const liveHref = base || '/';
  const managed = useManagedSessions(owner, roomId ?? state.connection.roomId ?? defaultRoom, base, managedSessions);
  const authenticated = state.connection.status === 'authenticated';
  const login = state.connection.status === 'stopped' || state.connection.status === 'auth-failed';
  const switchingRoom = roomId !== null && state.connection.roomId !== roomId && !login;
  useLayoutEffect(() => {
    if (!route.valid) owner.client.stop();
    else owner.openRoom(roomId ?? owner.storage.get('room') ?? 'main');
  }, [owner, route.valid, roomId]);
  useLayoutEffect(() => { owner.store.changeView(); }, [owner, location.pathname]);
  const header = <>
      <div className={styles.brand}><h1>{t('appName')}</h1><span>{t('workspaceLabel')}</span></div>
      {!login && <span className={styles.room} title={t('room')}>{roomId ?? state.connection.roomId}</span>}
      <div className={styles.utilities}>
        <nav className={styles.language} aria-label={t('language')}><Button variant="quiet" aria-pressed={i18n.language.startsWith('zh')} onClick={() => void i18n.changeLanguage('zh-CN')}>中文</Button><Button variant="quiet" aria-pressed={!i18n.language.startsWith('zh')} onClick={() => void i18n.changeLanguage('en')}>English</Button></nav>
        <IconButton label={t(theme === 'dark' ? 'switchToLight' : 'switchToDark')} onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></IconButton>
        <span className={styles.connection} role="status" data-status={state.connection.status}><i aria-hidden="true" />{t(`connection.${state.connection.status}`)}</span>
        {!login && <Button className={styles.logout} variant="quiet" onClick={() => { owner.logout(); navigate(liveHref); }}><Icon name="logout" />{t('logout')}</Button>}
      </div>
    </>;
  return <main className={styles.shell} lang={i18n.resolvedLanguage ?? 'zh-CN'} data-theme={theme} data-surface="workspace"><UiProvider>
    {(login || !route.valid || switchingRoom) && <header className={styles.header}>{header}</header>}
    {!route.valid ? <p className={styles.routeError} role="alert">{t('invalidRoute')}</p> : login ? <div className={styles.loginStage}><section className={styles.empty}><p className={styles.eyebrow}>{t('loginEyebrow')}</p><h2>{t('loginTitle')}</h2><p className={styles.loginHelp}>{t('loginHelp')}</p><LoginForm key={base} owner={owner} defaultRoom={defaultRoom} {...(roomId ? { roomId } : {})} onLogin={room => navigate(roomHref(room) + (pagePath === '/' ? '' : pagePath), { replace: true })} /><p className={styles.loginFootnote}><Icon name="lock" />{t('description')}</p></section></div> : switchingRoom ? <p role="status">{t('connection.connecting')}</p> : <WorkspaceLayout header={header} sidebar={<div className={styles.sidebar}><div className={styles.sessionHeading}><h2>{t('sessions')}</h2><SessionActions owner={owner} roomBase={base} /><Button variant="quiet" aria-label={t('newSession')} onClick={event=>managed.openNew(event.currentTarget)} disabled={!authenticated}><Icon name="plus" />{t('newSessionShort')}</Button></div>
        <div className={styles.search}><Icon name="search" /><Input type="search" aria-label={t('searchSessions')} placeholder={t('searchSessions')} value={search} maxLength={256} onChange={event => setSearch(event.target.value)} />{search && <IconButton label={t('clearSearch')} onClick={() => setSearch('')}><Icon name="close" /></IconButton>}</div>
        <div className={styles.sectionHeading}><h2>{t('activeSessions')}</h2><span>{state.hosts.size}</span></div>
        <div className={styles.hostList}>{[...state.hosts.values()].filter(host => [host.info.sessionName, host.info.hostId, host.info.cwd].some(value => value?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))).map(host => <Button variant="quiet" data-close-drawer className={styles.host} type="button" key={host.info.hostId} aria-pressed={state.selectedHostId === host.info.hostId} onClick={() => { owner.selectHost(host.info.hostId); if (location.pathname !== liveHref) navigate(liveHref); }}>
          <span className={styles.hostIdentity}><Icon name="hosts" /><strong>{host.info.sessionName ?? host.info.hostId}</strong></span><small title={host.info.cwd ?? host.info.hostId}>{host.info.cwd || host.info.hostId}</small><span className={styles.hostState} data-ready={host.info.connected && !host.stale}><i aria-hidden="true" />{t(!host.info.connected ? 'offline' : host.stale ? 'hostSynchronizing' : 'online')}</span>
        </Button>)}</div>
        {state.hosts.size === 0 && <p className={styles.sidebarHint}>{t('noHosts')}<br />{t('noHostsHelp')}</p>}
        <ManagedSessionList control={managed} query={search} />
        <HistoryList key={state.viewGeneration} owner={owner} roomBase={base} query={search} />
        <p className={styles.sidebarFootnote}><Icon name="lock" />{t('sessionOwnership')}</p>
      </div>} files={<FilesPane key={state.viewGeneration} owner={owner} />}>
      <Routes location={{ ...location, pathname: pagePath }}><Route path="/" element={<Workspace owner={owner} roomBase={base} onNewSession={managed.openNew} />}  /><Route path="/history/:sessionId" element={<section className={styles.center}><HistoryDetail owner={owner} roomBase={base} /></section>} /><Route path="*" element={<p>{t('invalidRoute')}</p>} /></Routes>
    </WorkspaceLayout>}
    <ManagedSessionDialog control={managed} />
    {!authenticated && !login && <p className={styles.overlay} role="status">{t('reconnectingHint')}</p>}
    {state.notices.length > 0 && <details className={styles.notices}><summary>{t('notices')} ({state.notices.length})</summary><ol>{state.notices.map(notice => <li key={notice.id}><code>{notice.code}</code> {notice.text !== notice.code ? notice.text : t(`errors.${notice.code}`, { defaultValue: t('commandRejected') })}</li>)}</ol></details>}
  </UiProvider></main>;
}
function OwnedApp({ createOwner }: { createOwner: () => AppOwner }) {
  const location = useLocation();
  const currentPath = useRef(location.pathname); currentPath.current = location.pathname;
  const [owner, setOwner] = useState<AppOwner | null>(null);
  const [defaultRoom, setDefaultRoom] = useState('main');
  const [managedSessions, setManagedSessions] = useState(false);
  useEffect(() => {
    const next = createOwner(); let active = true; setOwner(next);
    const initialRoute = parseRoomRoute(currentPath.current);
    void next.initialize(initialRoute.valid ? initialRoute.roomId ?? undefined : null).then(config => { if (active && config) { setDefaultRoom(config.defaultRoom); setManagedSessions(config.managedSessions === true); } });
    return () => { active = false; next.dispose(); };
  }, [createOwner]);
  return owner && <Shell owner={owner} defaultRoom={defaultRoom} managedSessions={managedSessions} />;
}
export function App({ createOwner = defaultFactory }: { createOwner?: () => AppOwner }) {
  return <HashRouter><OwnedApp createOwner={createOwner} /></HashRouter>;
}
