import { RelayClient } from '../services/relay/RelayClient';
import { CommandGateway } from '../services/relay/CommandGateway';
import { createRelayStorage, type RelayStorage } from '../services/relay/storage';
import { createHttpClient, type RelayConfig } from '../services/http/client';
import { CollabStore } from '../state/CollabStore';
interface OwnerOptions {
  client?: RelayClient;
  storage?: RelayStorage;
  http?: { config: (signal?: AbortSignal) => Promise<RelayConfig> };
}
export class AppOwner {
  readonly client: RelayClient;
  readonly storage: RelayStorage;
  readonly store: CollabStore;
  readonly gateway: CommandGateway;
  readonly #http: NonNullable<OwnerOptions['http']>;
  readonly #cancel = new AbortController();
  readonly #unsubscribe: () => void;
  #desiredHost: string | null;
  #disposed = false;
  constructor(options: OwnerOptions = {}) {
    this.client = options.client ?? new RelayClient();
    this.storage = options.storage ?? createRelayStorage();
    this.#http = options.http ?? createHttpClient();
    this.#desiredHost = this.storage.get('host');
    this.store = new CollabStore(() => this.client.resync());
    // Store ingestion precedes Gateway callbacks; a result sees the newest
    // authoritative context, even before React's coalesced notification.
    this.#unsubscribe = this.client.subscribe(event => {
      this.store.ingest(event);
      if (event.kind === 'state' && event.state.status === 'auth-failed') {
        this.storage.logout(); this.#desiredHost = null; this.store.notice('AUTH_FAILED');
      }
      if (event.kind === 'message' && event.message.type === 'host_status') {
        const hosts = this.store.getSnapshot().hosts;
        if (this.#desiredHost && hosts.has(this.#desiredHost)) this.store.selectHost(this.#desiredHost);
        else if (hosts.size === 1) this.selectHost(hosts.keys().next().value!);
        else this.store.selectHost(null);
      }
    });
    this.gateway = new CommandGateway(this.client, this.store);
  }
  async initialize(roomId?: string | null): Promise<RelayConfig | null> {
    // null denotes an invalid room URL: never fall back to a saved room.
    if (roomId !== null) this.openRoom(roomId ?? this.storage.get('room') ?? 'main');
    try { const config = await this.#http.config(this.#cancel.signal); return this.#disposed ? null : config; }
    catch { if (!this.#disposed) this.store.notice('CONFIG_UNAVAILABLE'); return null; }
  }
  openRoom(roomId: string): void {
    if (this.#disposed) return;
    const token = this.storage.get('token');
    if (token) this.login(token, roomId);
  }
  login(token: string, roomId: string): void {
    if (this.#disposed) return;
    const roomChanged = this.storage.get('room') !== roomId;
    // Validate/start before touching storage. start fences pending operations
    // synchronously; no inventory arrives until after this call returns.
    this.client.start({ token, roomId, peerId: this.storage.peerId() });
    if (roomChanged) { this.#desiredHost = null; this.storage.remove('host'); }
    this.storage.set('token', token); this.storage.set('room', roomId);
  }
  selectHost(id: string): void {
    if (!this.store.getSnapshot().hosts.has(id)) return;
    this.#desiredHost = id; this.storage.set('host', id); this.store.selectHost(id);
  }
  logout(): void { this.storage.logout(); this.#desiredHost = null; this.client.stop(); }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true; this.#cancel.abort(); this.client.stop(); this.gateway.dispose(); this.#unsubscribe(); this.store.dispose();
  }
}
