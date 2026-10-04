import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../../i18n';
import type { SessionSnapshot, TranscriptMessage } from '../../../../../src/protocol/index';
import { AgentActivity, agentActivity } from './AgentActivity';
const base:SessionSnapshot={protocolVersion:1,streamId:'stream',sessionId:'session',sessionName:null,cwd:'/test',activeLeafId:null,model:null,thinkingLevel:'high',phase:'running',hasPendingMessages:false,messages:[],tools:[],lastEventSeq:0,historyTruncated:false};
const message:TranscriptMessage={id:'a',role:'assistant',text:'',thinking:'',timestamp:1,status:'streaming',toolCallId:null,toolName:null};
afterEach(()=>vi.useRealTimers());
it('uses real latest activity, not configuration or old thinking content',()=>{
 expect(agentActivity(base).kind).toBe('working');
 expect(agentActivity({...base,messages:[{...message,thinking:'reasoning text'}]}).kind).toBe('thinking');
 expect(agentActivity({...base,messages:[{...message,parts:[{index:0,type:'thinking',text:'thought'},{index:1,type:'text',text:'reply'}]}]}).kind).toBe('responding');
 expect(agentActivity({...base,tools:[{toolCallId:'x',toolName:'read',status:'running',argsText:'{}',output:''}]})).toEqual({kind:'tool',tool:'read'});
 expect(agentActivity({...base,phase:'idle',messages:[{...message,thinking:'old'}]}).kind).toBeNull();
 expect(agentActivity({...base,phase:'waiting_local_ui'}).kind).toBe('waiting');expect(agentActivity(base,false).kind).toBe('offline');
});
it('activity clock stops while offline and is cleaned on unmount',async()=>{
 vi.useFakeTimers();const i18n=createI18n();await i18n.changeLanguage('en');
 const {rerender,unmount}=render(<I18nextProvider i18n={i18n}><AgentActivity snapshot={base}/></I18nextProvider>);
 expect(screen.getByRole('status')).toHaveTextContent('Working');act(()=>vi.advanceTimersByTime(3000));expect(screen.getByText('3s')).toBeInTheDocument();
 rerender(<I18nextProvider i18n={i18n}><AgentActivity snapshot={base} connected={false}/></I18nextProvider>);expect(screen.getByRole('status')).toHaveTextContent('status is not live');expect(screen.queryByText('3s')).toBeNull();unmount();expect(vi.getTimerCount()).toBe(0);
});
