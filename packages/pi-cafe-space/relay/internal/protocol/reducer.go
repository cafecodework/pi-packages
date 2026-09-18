package protocol

import "fmt"

func upsert(items []any, item Object, key string, max int) ([]any, bool) {
	for i, v := range items {
		if v.(Object)[key] == item[key] {
			out := append([]any{}, items...)
			out[i] = item
			return out, false
		}
	}
	evicted := len(items) >= max
	if evicted {
		items = items[len(items)-(max-1):]
	}
	out := append([]any{}, items...)
	return append(out, item), evicted
}

// ApplyEvent takes canonical snapshot/event data, retains no mutable input map or
// slice, and rejects divergent context/sequence. Validation is a separate ingress step.
func ApplyEvent(snapshot, envelope Object) (Object, error) {
	if snapshot["streamId"] != envelope["streamId"] || snapshot["sessionId"] != envelope["sessionId"] {
		return nil, fmt.Errorf("Event does not belong to this snapshot")
	}
	seq := snapshot["lastEventSeq"].(float64) + 1
	if envelope["seq"] != seq {
		return nil, fmt.Errorf("Event sequence gap: expected %.0f, received %v", seq, envelope["seq"])
	}
	next := canonicalSnapshot(snapshot)
	next["lastEventSeq"] = seq
	e := canonicalEvent(envelope["event"].(Object))
	switch e["kind"] {
	case "session_state":
		next["phase"] = e["phase"]
		next["hasPendingMessages"] = e["hasPendingMessages"]
	case "message_started", "message_finished":
		m := canonicalMessage(e["message"].(Object))
		truncated := false
		for _, k := range []string{"text", "thinking"} {
			s := m[k].(string)
			m[k] = prefix(s, maxText)
			truncated = truncated || m[k] != s
		}
		a, evicted := upsert(next["messages"].([]any), m, "id", 1000)
		next["messages"] = a
		next["historyTruncated"] = next["historyTruncated"] == true || truncated || evicted
	case "message_delta":
		found := false
		a := next["messages"].([]any)
		delta := e["delta"].(string)
		channel := e["channel"].(string)
		for i, v := range a {
			m := v.(Object)
			if m["id"] != e["messageId"] {
				continue
			}
			found = true
			s := m[channel].(string)
			m[channel] = prefix(s+delta, maxText)
			if stringLen(s)+stringLen(delta) > maxText {
				next["historyTruncated"] = true
			}
			a[i] = m
			break
		}
		if !found && len(delta) > 0 {
			next["historyTruncated"] = true
		}
	case "tool_started", "tool_finished":
		m := canonicalTool(e["tool"].(Object))
		truncated := false
		for _, k := range []string{"argsText", "output"} {
			s := m[k].(string)
			m[k] = prefix(s, maxText)
			truncated = truncated || m[k] != s
		}
		a, evicted := upsert(next["tools"].([]any), m, "toolCallId", 500)
		next["tools"] = a
		next["historyTruncated"] = next["historyTruncated"] == true || truncated || evicted
	case "tool_updated":
		found := false
		for _, v := range next["tools"].([]any) {
			m := v.(Object)
			if m["toolCallId"] != e["toolCallId"] {
				continue
			}
			found = true
			s := e["output"].(string)
			m["output"] = prefix(s, maxText)
			if m["output"] != s {
				next["historyTruncated"] = true
			}
			break
		}
		if !found {
			next["historyTruncated"] = true
		}
	case "model_changed":
		next["model"] = canonicalModel(e["model"])
	case "thinking_changed":
		next["thinkingLevel"] = e["level"]
	case "ui_wait":
		next["phase"] = "running"
		if e["waiting"] == true {
			next["phase"] = "waiting_local_ui"
		}
	case "notice":
	}
	return next, nil
}
