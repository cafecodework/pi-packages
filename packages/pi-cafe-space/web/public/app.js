(() => {
  const PROTOCOL_VERSION = 1;
  const $ = (id) => document.getElementById(id);
  const loginView = $("login-view");
  const appView = $("app-view");
  const loginForm = $("login-form");
  const loginError = $("login-error");
  const roomInput = $("room-input");
  const tokenInput = $("token-input");
  const connectionLabel = $("connection-label");
  const hostStatus = $("host-status");
  const modelStatus = $("model-status");
  const thinkingSelect = $("thinking-select");
  const phaseStatus = $("phase-status");
  const transcript = $("transcript");
  const tools = $("tools");
  const toolList = $("tool-list");
  const noticeArea = $("notice-area");
  const promptForm = $("prompt-form");
  const promptInput = $("prompt-input");
  const deliverySelect = $("delivery-select");
  const abortButton = $("abort-button");
  const filesButton = $("files-button");
  const filesPanel = $("files-panel");
  const filesClose = $("files-close");
  const filesBack = $("files-back");
  const filesPath = $("files-path");
  const fileList = $("file-list");
  const fileViewer = $("file-viewer");
  const historyRefresh = $("history-refresh");
  const historyList = $("history-list");
  const historyDetail = $("history-detail");
  const historyDetailTitle = $("history-detail-title");
  const historyDetailClose = $("history-detail-close");
  const historyDetailMessages = $("history-detail-messages");
  const logoutButton = $("logout-button");

  let socket = null;
  let reconnectTimer = null;
  let reconnectDelay = 500;
  let snapshot = null;
  let manuallyDisconnected = false;
  let pendingRequests = new Map();
  let historyNoticeShown = false;
  let currentDirectory = ".";
  let peerId = sessionStorage.getItem("pi-collab-peer-id");
  function randomId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
    return "web-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
  if (!peerId) {
    peerId = randomId();
    sessionStorage.setItem("pi-collab-peer-id", peerId);
  }

  function setConnection(text, kind = "") {
    connectionLabel.textContent = text;
    connectionLabel.className = "status-line " + kind;
  }

  function showNotice(message, level = "info") {
    const item = document.createElement("div");
    item.className = "notice " + level;
    item.textContent = message;
    noticeArea.appendChild(item);
    while (noticeArea.children.length > 4) noticeArea.firstElementChild.remove();
    if (level !== "error") setTimeout(() => item.remove(), 5000);
  }

  function wsUrl() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return protocol + "//" + location.host + "/ws";
  }

  function send(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      showNotice("当前未连接到 relay", "error");
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  }

  function command(payload) {
    if (!snapshot) {
      showNotice("尚未收到 Pi 会话状态", "error");
      return;
    }
    const requestId = randomId();
    pendingRequests.set(requestId, Date.now());
    if (send({ type: "command", requestId, expectedStreamId: snapshot.streamId, payload })) {
      return requestId;
    }
    pendingRequests.delete(requestId);
    return null;
  }

  function textNode(text, className) {
    const node = document.createElement("div");
    node.className = className || "";
    node.textContent = text || "";
    return node;
  }

  function render() {
    if (!snapshot) return;
    const wasNearBottom = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 80;
    hostStatus.textContent = snapshot.phase === "waiting_local_ui" ? "等待本机 UI" : "在线";
    modelStatus.textContent = snapshot.model ? snapshot.model.provider + "/" + snapshot.model.id : "—";
    thinkingSelect.value = snapshot.thinkingLevel;
    const phaseText = snapshot.phase === "idle" ? "空闲" : snapshot.phase === "running" ? "运行中" : "等待本机批准";
    phaseStatus.textContent = phaseText + (snapshot.hasPendingMessages ? " · 有排队" : "");

    transcript.replaceChildren();
    if (snapshot.messages.length === 0) {
      transcript.appendChild(textNode("等待 Pi 会话事件…", "empty-state"));
    } else {
      for (const message of snapshot.messages) {
        const article = document.createElement("article");
        article.className = "message " + message.role;
        const header = document.createElement("div");
        header.className = "message-header";
        header.appendChild(textNode(message.role === "user" ? "你" : message.role === "assistant" ? "Pi" : "工具", "message-role"));
        header.appendChild(textNode(message.status === "streaming" ? "流式中" : message.status === "error" ? "错误" : "", "message-status"));
        article.appendChild(header);
        if (message.thinking) {
          const details = document.createElement("details");
          const summary = document.createElement("summary");
          summary.textContent = "思考过程";
          details.appendChild(summary);
          details.appendChild(textNode(message.thinking, "thinking"));
          article.appendChild(details);
        }
        if (message.text) article.appendChild(textNode(message.text, "message-text"));
        transcript.appendChild(article);
      }
    }
    if (wasNearBottom) transcript.scrollTop = transcript.scrollHeight;

    toolList.replaceChildren();
    if (!snapshot.tools.length) {
      tools.hidden = true;
    } else {
      tools.hidden = false;
      for (const tool of snapshot.tools) {
        const row = document.createElement("article");
        row.className = "tool-row " + tool.status;
        row.appendChild(textNode(tool.toolName, "tool-name"));
        row.appendChild(textNode(tool.status === "running" ? "执行中" : tool.status === "error" ? "失败" : "完成", "tool-status"));
        if (tool.output) row.appendChild(textNode(tool.output, "tool-output"));
        toolList.appendChild(row);
      }
    }
  }

  function renderDirectory(data) {
    currentDirectory = typeof data.path === "string" && data.path ? data.path : ".";
    filesPath.textContent = currentDirectory;
    fileViewer.hidden = true;
    fileList.replaceChildren();
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (!entries.length) {
      fileList.appendChild(textNode("目录为空", "empty-state small"));
    }
    for (const entry of entries) {
      if (!entry || typeof entry.name !== "string") continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "file-entry " + (entry.kind || "file");
      button.appendChild(textNode(entry.kind === "directory" ? "▸" : entry.kind === "link" ? "↗" : "·", "file-icon"));
      button.appendChild(textNode(entry.name, "file-name"));
      if (entry.kind === "link") button.title = "符号链接不会被远程打开";
      button.addEventListener("click", () => {
        const nextPath = currentDirectory === "." ? entry.name : currentDirectory.replace(/[\\\\/]$/, "") + "/" + entry.name;
        if (entry.kind === "directory") listDirectory(nextPath);
        else if (entry.kind === "file") readProjectFile(nextPath);
        else showNotice("为安全起见，不能通过符号链接打开文件", "warning");
      });
      fileList.appendChild(button);
    }
    if (data.truncated) showNotice("目录内容过多，只显示前 300 项", "warning");
  }

  function renderFile(data) {
    currentDirectory = typeof data.path === "string" ? data.path : currentDirectory;
    filesPath.textContent = currentDirectory;
    fileList.replaceChildren();
    fileViewer.hidden = false;
    fileViewer.textContent = typeof data.content === "string" ? data.content : "";
    if (data.truncated) showNotice("文件内容已截断，可在后续版本加入分页读取", "warning");
  }

  function listDirectory(path) {
    currentDirectory = path || ".";
    return command({ name: "list_dir", path: currentDirectory });
  }

  function readProjectFile(path) {
    return command({ name: "read_file", path, offset: 0, limit: 128 * 1024 });
  }

  function openFiles() {
    filesPanel.classList.add("open");
    if (snapshot && !fileList.children.length) listDirectory(currentDirectory);
  }

  function closeFiles() {
    filesPanel.classList.remove("open");
  }

  function listSessions() {
    return command({ name: "list_sessions" });
  }

  function renderSessions(data) {
    historyList.replaceChildren();
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    if (!sessions.length) {
      historyList.appendChild(textNode("没有历史会话", "empty-state small"));
      return;
    }
    for (const session of sessions) {
      if (!session || typeof session.sessionId !== "string") continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-entry" + (session.sessionId === data.currentSessionId ? " current" : "");
      const title = session.name || session.firstMessage || session.sessionId;
      button.appendChild(textNode(title, "history-title"));
      const date = typeof session.modified === "string" ? new Date(session.modified).toLocaleString() : "";
      button.appendChild(textNode(`${date} · ${session.messageCount || 0} 条消息`, "history-meta"));
      button.addEventListener("click", () => command({ name: "get_session", sessionId: session.sessionId }));
      historyList.appendChild(button);
    }
  }

  function renderHistoricalSession(data) {
    historyDetail.hidden = false;
    historyDetailTitle.textContent = data.name || data.sessionId || "历史会话";
    historyDetailMessages.replaceChildren();
    const messages = Array.isArray(data.messages) ? data.messages : [];
    for (const message of messages) {
      if (!message) continue;
      const article = document.createElement("article");
      article.className = "history-message " + (message.role || "system");
      article.appendChild(textNode(message.role === "user" ? "你" : message.role === "assistant" ? "Pi" : "工具", "history-message-role"));
      if (message.thinking) article.appendChild(textNode(message.thinking, "history-thinking"));
      if (message.text) article.appendChild(textNode(message.text, "history-message-text"));
      historyDetailMessages.appendChild(article);
    }
    if (!messages.length) historyDetailMessages.appendChild(textNode("该会话没有可显示的消息", "empty-state small"));
    if (data.historyTruncated) showNotice("历史会话较长，只显示最近 100 条消息", "warning");
  }

  function applyEvent(event) {
    if (!snapshot || event.streamId !== snapshot.streamId || event.sessionId !== snapshot.sessionId) {
      reconnectForSync();
      return;
    }
    if (event.seq <= snapshot.lastEventSeq) return;
    if (event.seq !== snapshot.lastEventSeq + 1) {
      showNotice("事件序号出现缺口，正在重新同步", "warning");
      reconnectForSync();
      return;
    }
    snapshot.lastEventSeq = event.seq;
    const value = event.event;
    switch (value.kind) {
      case "session_state":
        snapshot.phase = value.phase;
        snapshot.hasPendingMessages = value.hasPendingMessages;
        break;
      case "message_started":
      case "message_finished": {
        const index = snapshot.messages.findIndex((item) => item.id === value.message.id);
        if (index < 0) snapshot.messages.push(value.message);
        else snapshot.messages[index] = value.message;
        break;
      }
      case "message_delta": {
        const message = snapshot.messages.find((item) => item.id === value.messageId);
        if (message) message[value.channel] += value.delta;
        break;
      }
      case "tool_started":
      case "tool_finished": {
        const index = snapshot.tools.findIndex((item) => item.toolCallId === value.tool.toolCallId);
        if (index < 0) snapshot.tools.push(value.tool);
        else snapshot.tools[index] = value.tool;
        break;
      }
      case "tool_updated": {
        const tool = snapshot.tools.find((item) => item.toolCallId === value.toolCallId);
        if (tool) tool.output = value.output;
        break;
      }
      case "model_changed": snapshot.model = value.model; break;
      case "thinking_changed": snapshot.thinkingLevel = value.level; break;
      case "ui_wait": snapshot.phase = value.waiting ? "waiting_local_ui" : "running"; break;
      case "notice": showNotice(value.message, value.level); break;
    }
    render();
  }

  function reconnectForSync() {
    if (socket) socket.close();
  }

  function handleMessage(message) {
    switch (message.type) {
      case "welcome":
        setConnection("已连接 relay，等待 Pi", "connected");
        return;
      case "host_status":
        hostStatus.textContent = message.connected ? "在线" : "离线";
        if (!message.connected) setConnection("relay 已连接，Pi 离线", "warning");
        return;
      case "snapshot":
        snapshot = message.snapshot;
        setConnection("实时同步中", "connected");
        if (snapshot.historyTruncated && !historyNoticeShown) {
          showNotice("当前会话较长，页面显示的是最近 100 条消息", "warning");
          historyNoticeShown = true;
        }
        render();
        listDirectory(currentDirectory);
        listSessions();
        return;
      case "event":
        applyEvent(message);
        return;
      case "command_result":
        pendingRequests.delete(message.requestId);
        if (message.data && message.data.kind === "directory") renderDirectory(message.data);
        else if (message.data && message.data.kind === "file") renderFile(message.data);
        else if (message.data && message.data.kind === "sessions") renderSessions(message.data);
        else if (message.data && message.data.kind === "session") renderHistoricalSession(message.data);
        if (message.status === "rejected") showNotice(message.message || "命令被拒绝", "error");
        else if (message.status === "dispatched") showNotice(message.message || "已发送", "info");
        return;
      case "error":
        showNotice(message.message || message.code || "relay 错误", "error");
        return;
    }
  }

  function scheduleReconnect() {
    if (manuallyDisconnected || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(10000, reconnectDelay * 2);
  }

  function connect() {
    const token = sessionStorage.getItem("pi-collab-token");
    const room = sessionStorage.getItem("pi-collab-room") || "main";
    if (!token) return;
    manuallyDisconnected = false;
    if (socket) socket.close();
    setConnection("连接中…");
    socket = new WebSocket(wsUrl());
    socket.addEventListener("open", () => {
      reconnectDelay = 500;
      send({ type: "hello", protocolVersion: PROTOCOL_VERSION, peerRole: "client", peerId, roomId: room, token });
    });
    socket.addEventListener("message", (event) => {
      try { handleMessage(JSON.parse(event.data)); }
      catch { showNotice("收到无法解析的 relay 消息", "error"); }
    });
    socket.addEventListener("error", () => setConnection("连接错误", "error"));
    socket.addEventListener("close", () => {
      socket = null;
      if (!manuallyDisconnected) {
        setConnection("连接断开，重连中…", "warning");
        scheduleReconnect();
      }
    });
  }

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const token = tokenInput.value.trim();
    const room = roomInput.value.trim();
    if (!token || !room) return;
    sessionStorage.setItem("pi-collab-token", token);
    sessionStorage.setItem("pi-collab-room", room);
    loginError.hidden = true;
    loginView.hidden = true;
    appView.hidden = false;
    connect();
  });

  promptForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const content = promptInput.value.trim();
    if (!content || !snapshot) return;
    let delivery;
    const selected = deliverySelect.value;
    if (selected === "steer" || selected === "followUp") delivery = selected;
    else if (snapshot.phase !== "idle") delivery = "followUp";
    const payload = { name: "prompt", content };
    if (delivery) payload.delivery = delivery;
    if (command(payload)) {
      promptInput.value = "";
      promptInput.focus();
    }
  });

  abortButton.addEventListener("click", () => { command({ name: "abort" }); });
  filesButton.addEventListener("click", openFiles);
  filesClose.addEventListener("click", closeFiles);
  filesBack.addEventListener("click", () => {
    if (currentDirectory === ".") return;
    const normalized = currentDirectory.replace(/[\\\\/]$/, "");
    const separator = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\\\"));
    listDirectory(separator < 0 ? "." : normalized.slice(0, separator) || ".");
  });
  historyRefresh.addEventListener("click", listSessions);
  historyDetailClose.addEventListener("click", () => { historyDetail.hidden = true; });
  thinkingSelect.addEventListener("change", () => { command({ name: "set_thinking", level: thinkingSelect.value }); });
  logoutButton.addEventListener("click", () => {
    manuallyDisconnected = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (socket) socket.close(1000, "user disconnected");
    sessionStorage.removeItem("pi-collab-token");
    snapshot = null;
    fileList.replaceChildren();
    fileViewer.hidden = true;
    historyList.replaceChildren();
    historyDetail.hidden = true;
    appView.hidden = true;
    loginView.hidden = false;
    tokenInput.value = "";
    setConnection("未连接");
  });

  const savedToken = sessionStorage.getItem("pi-collab-token");
  const savedRoom = sessionStorage.getItem("pi-collab-room");
  const isLoopback = location.hostname === "127.0.0.1" || location.hostname === "localhost" || location.hostname === "::1" || location.hostname === "[::1]";
  if (savedToken || isLoopback) {
    if (!savedToken) sessionStorage.setItem("pi-collab-token", "local-dev-client-token");
    sessionStorage.setItem("pi-collab-room", savedRoom || "main");
    roomInput.value = savedRoom || "main";
    loginView.hidden = true;
    appView.hidden = false;
    connect();
  }
})();
