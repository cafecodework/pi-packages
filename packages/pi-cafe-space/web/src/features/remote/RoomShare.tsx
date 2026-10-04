import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import type { AppOwner } from '../../app/owner';
import { Button, Input, Label } from '../../components/ui/Controls';
import { Drawer } from '../../components/ui/Drawer';
import { roomShareRequest, type RoomShareInfo, type ShareAction } from '../../services/http/roomShare';
import { roomPasswordValid } from '../../services/remote/roomCrypto';
import styles from './RoomShare.module.scss';

export function RoomShare({ owner, trigger, onClose }: { owner: AppOwner; trigger: HTMLElement; onClose: () => void }) {
  const { i18n } = useTranslation(); const zh = i18n.language.startsWith('zh');
  const [info, setInfo] = useState<RoomShareInfo | null>(null); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [reset, setReset] = useState(false); const [editing, setEditing] = useState(false);
  const epoch = useRef(0);
  const alive = useRef(false), pending = useRef(false), cancel = useRef<AbortController | null>(null);
  const operate = async (action: ShareAction) => {
    if (pending.current) return; const ticket = epoch.current; pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const value = await roomShareRequest(owner.storage.get('token') ?? '', action, cancel.current?.signal);
      if (!alive.current || ticket !== epoch.current) return;
      setInfo(value); setReset(false); setEditing(false); setPassword(''); setConfirm('');
      if (action.operation === 'password') setNotice(zh ? '密码已更新，房间链接不变。已连接访客需要重新输入密码。' : 'Password updated. The link is unchanged; connected visitors must sign in again.');
      if (action.operation === 'reset-link') setNotice(zh ? '已生成新房间链接，旧链接和旧二维码失效。' : 'A new room link is ready. Old links and QR codes no longer work.');
    } catch (e) { if (alive.current && ticket === epoch.current) setError(e instanceof Error ? e.message : 'ROOM_SHARE_FAILED'); }
    finally { if (ticket === epoch.current) { pending.current = false; if (alive.current) setBusy(false); } }
  };
  useEffect(() => {
    const controller = new AbortController(); epoch.current++; pending.current = false; cancel.current = controller; alive.current = true;
    void operate({ operation: 'status' });
    return () => { alive.current = false; epoch.current++; controller.abort(); };
  }, [owner]);
  const messages: Record<string, string> = zh ? {
    RESULT_UNKNOWN: '未收到修改结果，请先刷新房间信息，不要重复操作。', ROOM_CHANGED: '房间设置已变化，请刷新后再操作。',
    UNAUTHORIZED: '本机登录已失效，请重新登录。', INVALID_PASSWORD: '请输入两次一致的 6–20 位密码，不含首尾空白或控制字符。',
  } : {
    RESULT_UNKNOWN: 'Change result unknown. Refresh room information before another operation.', ROOM_CHANGED: 'Room settings changed. Refresh before editing.',
    UNAUTHORIZED: 'Local sign-in has expired. Sign in again.', INVALID_PASSWORD: 'Enter the same 6–20 character password twice, without surrounding whitespace or control characters.',
  };
  return <Drawer label={zh ? '分享房间' : 'Share room'} closeLabel={zh ? '关闭' : 'Close'} restoreFocusTo={trigger} onClose={onClose}>
    <div className={styles.content}>
      {!info && <p role="status">{zh ? '正在读取房间信息…' : 'Loading room information…'}</p>}
      {info && <>
        <div className={styles.identity}><strong>{info.name}</strong><span data-online={info.online}>{info.online ? (zh ? '在线' : 'Online') : (zh ? '正在连接信令服务' : 'Connecting to signaling')}</span></div>
        <div className={styles.qr}><QRCodeSVG value={info.url} size={240} level="M" marginSize={4} title={zh ? '房间二维码' : 'Room QR code'} /></div>
        <p className={styles.help}>{zh ? '手机相机扫码，或复制链接到其他设备。打开后仍需输入房间密码。' : 'Scan with your phone camera or copy the link to another device. The room password is still required.'}</p>
        <div className={styles.field}><Label htmlFor="share-room-url">{zh ? '房间链接' : 'Room link'}</Label><Input id="share-room-url" value={info.url} readOnly onFocus={event => event.currentTarget.select()} /></div>
        <Button variant="primary" disabled={busy} onClick={async () => {
          try { if (!navigator.clipboard?.writeText) throw Error('clipboard unavailable'); await navigator.clipboard.writeText(info.url); if (alive.current) setNotice(zh ? '房间链接已复制。' : 'Room link copied.'); }
          catch { if (alive.current) setNotice(zh ? '无法访问剪贴板，请选中上方链接手动复制。' : 'Clipboard unavailable. Select and copy the link above.'); }
        }}>{zh ? '复制链接' : 'Copy link'}</Button>
        <p className={styles.help}>{zh ? '链接和二维码不包含密码。房间内的 Pi 实例变化不会改变链接。' : 'Neither the link nor the QR code contains the password. Changing Pi instances does not change the link.'}</p>
        <p className={styles.help}>{zh ? '房间首次创建时沿用当时的本机令牌；之后可在下方单独修改。这里不会显示或复制密码。' : 'The first room password uses your local token at creation. Change it independently below; it is never displayed or copied here.'}</p>
        <p className={styles.help}>{zh ? '知道链接和密码的访客可以查看房间内容，并申请控制 Pi。请只分享给你信任的人。' : 'People with the link and password can view room content and request Pi control. Share only with people you trust.'}</p>
        <div className={styles.management}>
          <Button variant="quiet" disabled={busy || !!error} onClick={() => { setEditing(value => !value); setReset(false); }}>{zh ? '修改房间密码' : 'Change room password'}</Button>
          {editing && <form className={styles.form} onSubmit={event => {
            event.preventDefault(); if (!roomPasswordValid(password) || password !== confirm) { setError('INVALID_PASSWORD'); return; }
            void operate({ operation: 'password', password, confirmPassword: confirm, revision: info.revision });
          }}>
            <div className={styles.field}><Label htmlFor="new-room-password">{zh ? '新房间密码' : 'New room password'}</Label><Input id="new-room-password" type="password" autoComplete="new-password" value={password} required minLength={6} maxLength={20} disabled={busy} onChange={event => { setPassword(event.target.value); if (error === 'INVALID_PASSWORD') setError(''); }} /></div>
            <div className={styles.field}><Label htmlFor="confirm-room-password">{zh ? '确认新密码' : 'Confirm new password'}</Label><Input id="confirm-room-password" type="password" autoComplete="new-password" value={confirm} required minLength={6} maxLength={20} disabled={busy} onChange={event => { setConfirm(event.target.value); if (error === 'INVALID_PASSWORD') setError(''); }} /></div>
            <p className={styles.help}>{zh ? '修改后链接不变，现有访客连接会断开。本机登录密码不变。' : 'The link stays the same. Existing visitors disconnect; local sign-in is unchanged.'}</p>
            <Button type="submit" variant="primary" disabled={busy || error === 'RESULT_UNKNOWN'}>{zh ? '确认修改密码' : 'Confirm password change'}</Button>
          </form>}
          <Button variant="quiet" disabled={busy || !!error} onClick={() => { setReset(value => !value); setEditing(false); }}>{zh ? '重置房间链接' : 'Reset room link'}</Button>
          {reset && <div className={styles.confirm}><p>{zh ? '旧链接和二维码将立即失效，并断开现有访客。房间密码保持不变。' : 'Old links and QR codes stop working, and current visitors disconnect. The room password stays the same.'}</p><Button variant="primary" disabled={busy} onClick={() => void operate({ operation: 'reset-link', revision: info.revision })}>{zh ? '确认重置链接' : 'Confirm link reset'}</Button><Button variant="quiet" disabled={busy} onClick={() => setReset(false)}>{zh ? '取消' : 'Cancel'}</Button></div>}
        </div>
      </>}
      {error && <p role="alert" className={styles.error}>{messages[error] ?? (zh ? '无法读取或修改房间，请确认本机服务在线。' : 'Room operation failed. Check the local service.')}</p>}
      {notice && <p role="status" className={styles.help}>{notice}</p>}
      <Button variant="quiet" loading={busy} disabled={busy} onClick={() => void operate({ operation: 'status' })}>{zh ? '刷新房间信息' : 'Refresh room information'}</Button>
    </div>
  </Drawer>;
}
