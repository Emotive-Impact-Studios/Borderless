// Package control is the first Go migration unit. It is not a second running hub.
// Authentication/storage must supply Actor and Surface from trusted state.
package control

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
)

const MaxCommandBytes = 65536

type Actor struct {
	RoomID, DeviceID, Role string
	Active                 bool
}
type Surface struct {
	RoomID, ID, OwnerID string
	Version             uint64
}
type Move struct {
	Protocol        int     `json:"protocol"`
	RequestID       string  `json:"requestId"`
	RoomID          string  `json:"roomId"`
	Type            string  `json:"type"`
	ItemID          string  `json:"itemId"`
	ExpectedVersion uint64  `json:"expectedVersion"`
	X               float64 `json:"x"`
	Y               float64 `json:"y"`
}

// DecodeMove rejects ambiguous duplicate keys as well as unknown fields. A peer
// cannot smuggle authority into this envelope. Network reads must also be bounded.
func DecodeMove(data []byte) (Move, error) {
	var m Move
	if len(data) == 0 || len(data) > MaxCommandBytes {
		return m, errors.New("invalid command size")
	}
	d := json.NewDecoder(bytes.NewReader(data))
	token, err := d.Token()
	if err != nil || token != json.Delim('{') {
		return m, errors.New("command must be an object")
	}
	seen := map[string]bool{}
	allowed := map[string]bool{"protocol": true, "requestId": true, "roomId": true, "type": true, "itemId": true, "expectedVersion": true, "x": true, "y": true}
	for d.More() {
		key, err := d.Token()
		if err != nil {
			return m, err
		}
		name, ok := key.(string)
		if !ok || seen[name] || !allowed[name] {
			return m, errors.New("duplicate or invalid field")
		}
		seen[name] = true
		var value json.RawMessage
		if err := d.Decode(&value); err != nil {
			return m, err
		}
		if bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return m, errors.New("null field")
		}
	}
	if _, err := d.Token(); err != nil {
		return m, err
	}
	for _, key := range []string{"protocol", "requestId", "roomId", "type", "itemId", "expectedVersion", "x", "y"} {
		if !seen[key] {
			return m, fmt.Errorf("missing %s", key)
		}
	}
	d = json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if err := d.Decode(&m); err != nil {
		return m, err
	}
	var extra any
	if err := d.Decode(&extra); err != io.EOF {
		return m, errors.New("trailing JSON")
	}
	if m.Protocol != 1 || m.Type != "item.move" || !validID(m.RequestID) || !validID(m.RoomID) || !validID(m.ItemID) {
		return m, errors.New("unsupported command or identifier")
	}
	if math.IsNaN(m.X) || math.IsNaN(m.Y) || math.IsInf(m.X, 0) || math.IsInf(m.Y, 0) || m.X < 0 || m.X > 1 || m.Y < 0 || m.Y > 1 {
		return m, errors.New("invalid normalised position")
	}
	return m, nil
}

func validID(s string) bool {
	if len(s) < 1 || len(s) > 64 {
		return false
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_') {
			return false
		}
	}
	return true
}

// AuthoriseMove must run again inside the eventual storage transaction before
// committing. This function does not implement receipts, persistence or HTTP auth.
func AuthoriseMove(m Move, actor Actor, surface Surface, paused bool) error {
	if !actor.Active || actor.DeviceID == "" || actor.RoomID != m.RoomID || surface.RoomID != m.RoomID || surface.ID != m.ItemID {
		return errors.New("room or session mismatch")
	}
	if actor.Role != "admin" && actor.Role != "participant" {
		return errors.New("read-only actor")
	}
	if actor.Role != "admin" && (paused || surface.OwnerID != actor.DeviceID) {
		return errors.New("not authorised")
	}
	if surface.Version != m.ExpectedVersion {
		return errors.New("stale surface")
	}
	return nil
}
