import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { AppOwner } from '../../app/owner';
import { useCollabStore } from '../../state/useCollabStore';
import { managedRequest, parseManagedInventory, parseManagedSession, type ManagedInventory, type ManagedRequest, type ManagedSession } from '../../services/http/workspace';
import { Button, Input } from '../../components/ui/Controls';
import { ChoiceSelect } from '../../components/ui/ChoiceSelect';
import { Drawer } from '../../components/ui/Drawer';
import { Field, FieldGroup, FieldLabel } from '../../components/ui/shadcn/field';
import { Icon } from '../../components/ui/Icon';
import styles from './History.module.scss';

export function useManagedSessions(owner: AppOwner, room: string, roomBase: string, supported: boolean) {
  const state = useCollabStore(owner.store, s=>s); const navigate = useNavigate();
  const liveKey = () => { const s=owner.store.getSnapshot(); return JSON.stringify([room,s.connection.roomId,s.connection.generation,s.connection.status,s.viewGeneration]); };
  const key = liveKey();
  const current = useRef(key); current.current = key;
  const enabled = supported && state.connection.status === 'authenticated';
  const [inventory,setInventory] = useState<ManagedInventory>({projects:[],sessions:[],maxActive:8});
  const [error,setError] = useState<string|null>(null);
  const [busy,setBusy] = useState(false); const latch = useRef(false);
  const [dialog,setDialog] = useState<{mode:'create'|'close';trigger:HTMLElement;key:string;id:string}|null>(null);
  const [name,setName] = useState(''); const [project,setProject] = useState('');
  const [pending,setPending] = useState<{hostId:string;id:string;key:string;selected:string|null}|null>(null);
  const [revision,setRevision] = useState(0);
  const refresh = useCallback(()=>setRevision(n=>n+1),[]);
  useEffect(()=>{setDialog(null);setError(null);setPending(null);},[key]);
  useEffect(()=>{setInventory({projects:[],sessions:[],maxActive:8});},[room]);
  useEffect(()=>{
    if(!enabled)return;
    const controller=new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll=async()=>{
      try {const data=parseManagedInventory(await managedRequest(owner.storage.get('token')??'',{room,operation:'list'},controller.signal),room);if(!controller.signal.aborted&&current.current===key&&liveKey()===key)setInventory(data);}
      catch(e){if(!controller.signal.aborted&&current.current===key&&liveKey()===key)setError(e instanceof Error?e.message:'MANAGER_UNAVAILABLE');}
      if(!controller.signal.aborted)timer=setTimeout(poll,3000);
    };
    void poll();return()=>{controller.abort();clearTimeout(timer);};
  },[owner,enabled,room,key,revision]);
  useEffect(()=>{
    if(!pending||pending.key!==key)return;
    const host=state.hosts.get(pending.hostId);
    const record=inventory.sessions.find(s=>s.id===pending.id);
    if(record?.status==='failed'){setError(record.error??'MANAGED_START_FAILED');setPending(null);return;}
    if(record?.status==='ready'&&host?.info.connected&&host.info.ready!==false&&!host.stale&&host.snapshot){
      if(state.selectedHostId===pending.selected||state.selectedHostId===null||state.selectedHostId===pending.hostId){owner.selectHost(pending.hostId);navigate(roomBase||'/');}
      setPending(null);
    }
  },[pending,key,state.hosts,state.selectedHostId,inventory,owner,navigate,roomBase]);
  useEffect(()=>{if(dialog?.mode==='create'&&!project&&inventory.projects[0])setProject(inventory.projects[0].id);},[dialog,project,inventory.projects]);
  const openNew=(trigger:HTMLElement)=>{
    setError(null);setName('');
    const cwd=owner.store.scope()?.cwd;
    setProject(inventory.projects.find(p=>p.cwd===cwd)?.id??inventory.projects[0]?.id??'');
    setDialog({mode:'create',trigger,key,id:crypto.randomUUID()});refresh();
  };
  const closeSession=(id:string,trigger:HTMLElement)=>{setError(null);setDialog({mode:'close',id,trigger,key});};
  const operate=async(request:ManagedRequest)=>{
    if(!enabled||latch.current||request.room!==room||liveKey()!==key)return;
    const fence=key, selected=state.selectedHostId;
    latch.current=true;setBusy(true);setError(null);
    try {
      const record=parseManagedSession(await managedRequest(owner.storage.get('token')??'',request),room);
      if(current.current!==fence||liveKey()!==fence)return;
      if(record.status==='failed'){setError(record.error??'MANAGED_START_FAILED');refresh();return;}
      setDialog(null);refresh();
      if(request.operation!=='close')setPending({hostId:record.hostId,id:record.id,key:fence,selected});
    }catch(e){if(current.current===fence&&liveKey()===fence){setError(e instanceof Error?e.message:'RESULT_UNKNOWN');refresh();}}
    finally{latch.current=false;setBusy(false);}
  };
  return { owner,room,enabled,supported,inventory,error,busy,dialog,name,project,pending,setName,setProject,setDialog,openNew,closeSession,operate,refresh,key };
}
export type ManagedController = ReturnType<typeof useManagedSessions>;
export function ManagedSessionList({control:c,query=''}:{control:ManagedController;query?:string}) {
  const {t}=useTranslation();
  if(!c.supported)return null;
  return <section className={styles.managed} aria-label={t('managedSessions')}>
    <div className={styles.heading}><h2>{t('managedSessions')}</h2><Button variant="quiet" aria-label={t('loadManaged')} onClick={c.refresh}><Icon name="refresh"/></Button></div>
    {c.pending&&<p role="status" className={styles.hint}>{t('managedStarting')}</p>}
    {c.error&&!c.dialog&&<p role="alert" className={styles.hint}>{t(`errors.${c.error}`,{defaultValue:t('managedFailed')})}</p>}
    <ul>{c.inventory.sessions.filter(s=>[s.name,s.title,c.inventory.projects.find(p=>p.id===s.projectId)?.cwd,c.owner.store.getSnapshot().hosts.get(s.hostId)?.snapshot?.sessionName].some(value=>value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))).map(s=>{
      const host=c.owner.store.getSnapshot().hosts.get(s.hostId);
      const active=['starting','ready','stopping'].includes(s.status);
      return <li key={s.id}><div className={styles.managedIdentity}><strong>{host?.snapshot?.sessionName||s.title||s.name}</strong><small>{t(`managedStatus.${s.status}`)}</small></div>
        <div className={styles.managedActions}>
          <Button variant="quiet" disabled={!c.enabled||c.busy||s.status==='stopping'||!!c.pending} onClick={()=>void c.operate({room:c.room,operation:'open',id:s.id})}>{t(active?'viewSession':'openSession')}</Button>
          {active&&<Button variant="quiet" disabled={!c.enabled||c.busy||s.status==='stopping'} onClick={e=>c.closeSession(s.id,e.currentTarget)}>{t('closeManaged')}</Button>}
        </div>
        {s.error&&<small role="status">{t(`errors.${s.error}`,{defaultValue:t('managedFailed')})}</small>}
      </li>;
    })}</ul>
  </section>;
}
export function ManagedSessionDialog({control:c}:{control:ManagedController}) {
  const {t}=useTranslation();
  const dialog=c.dialog;
  if(!dialog||dialog.key!==c.key)return null;
  const creating=dialog.mode==='create';const id='managed-session-name';
  const valid=c.name.trim().length>0&&c.name.length<=256&&!/[\u0000-\u001f\u007f]/.test(c.name);
  return <Drawer compact label={t(creating?'newSession':'closeManaged')} closeLabel={t('close')} restoreFocusTo={dialog.trigger} onClose={()=>c.setDialog(null)}>
    <form className={styles.actionForm} onSubmit={e=>{e.preventDefault();if(creating&&valid)void c.operate({room:c.room,operation:'create',id:dialog.id,projectId:c.project,name:c.name.trim()});else if(!creating)void c.operate({room:c.room,operation:'close',id:dialog.id});}}><FieldGroup>
      {creating?<>
        <p>{t('independentSessionHint')}</p>
        {!c.supported?<p role="alert">{t('managedUnavailable')}</p>:<>
          <ChoiceSelect label={t('project')} value={c.project} disabled={c.busy} items={c.inventory.projects.map(p=>({value:p.id,label:p.name}))} onValueChange={c.setProject}/>
          <p className={styles.hint}>{c.inventory.projects.find(p=>p.id===c.project)?.cwd||t('managedNoProject')}</p>
          <Field><FieldLabel htmlFor={id}>{t('sessionTitle')}</FieldLabel><Input id={id} maxLength={256} required value={c.name} disabled={c.busy} onChange={e=>c.setName(e.target.value)}/></Field>
        </>}
      </>:<><p>{c.inventory.sessions.find(s=>s.id===dialog.id)?.name}</p><p>{t('closeManagedHint')}</p></>}
      {c.error&&<p role="alert">{c.error==='RESULT_UNKNOWN'?t('managedUnknown'):t(`errors.${c.error}`,{defaultValue:t('managedFailed')})}</p>}
      <div className={styles.formActions}><Button variant="quiet" onClick={()=>c.setDialog(null)}>{t('cancel')}</Button><Button type="submit" variant="primary" loading={c.busy} disabled={!c.enabled||c.busy||c.error==='RESULT_UNKNOWN'||(creating&&(!valid||!c.inventory.projects.some(p=>p.id===c.project)))}>{t(creating?'createSession':'closeManaged')}</Button></div>
    </FieldGroup></form>
  </Drawer>;
}
