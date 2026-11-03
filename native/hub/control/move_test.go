package control

import (
	"strings"
	"testing"
)

const valid = `{"protocol":1,"requestId":"req-1","roomId":"room-a","type":"item.move","itemId":"card-a","expectedVersion":3,"x":0.2,"y":0.4}`

func TestStrictWireEnvelope(t *testing.T) {
	if _, err := DecodeMove([]byte(valid)); err != nil {
		t.Fatal(err)
	}
	cases := []string{
		strings.Replace(valid, `"protocol":1`, `"protocol":1,"Protocol":2`, 1),
		strings.Replace(valid, `"protocol":1`, `"protocol":2`, 1),
		strings.Replace(valid, `"x":0.2`, `"x":null`, 1),
		strings.Replace(valid, `"x":0.2`, `"x":2`, 1),
		strings.Replace(valid, `"x":0.2`, `"x":0.2,"x":0.5`, 1),
		strings.Replace(valid, `"x":0.2,`, ``, 1),
		strings.Replace(valid, `"x":0.2`, `"x":1e999`, 1),
		strings.Replace(valid, `"x":0.2`, `"role":"admin","x":0.2`, 1),
		valid + `{}`, `[]`, strings.Repeat(" ", MaxCommandBytes+1),
	}
	for _, data := range cases {
		if _, err := DecodeMove([]byte(data)); err == nil {
			t.Fatalf("accepted invalid envelope %.150s", data)
		}
	}
}

func TestAuthorityComesFromCurrentServerState(t *testing.T) {
	m, _ := DecodeMove([]byte(valid))
	owner := Actor{"room-a", "owner", "participant", true}
	surface := Surface{"room-a", "card-a", "owner", 3}
	if err := AuthoriseMove(m, owner, surface, false); err != nil {
		t.Fatal(err)
	}
	for _, actor := range []Actor{
		{"room-b", "owner", "admin", true}, {"room-a", "stranger", "participant", true},
		{"room-a", "owner", "wall", true}, {"room-a", "owner", "participant", false},
		{"room-a", "owner", "unknown", true},
	} {
		if AuthoriseMove(m, actor, surface, false) == nil {
			t.Fatalf("authorised %+v", actor)
		}
	}
	if AuthoriseMove(m, owner, surface, true) == nil {
		t.Fatal("paused participant moved")
	}
	surface.Version++
	if AuthoriseMove(m, owner, surface, false) == nil {
		t.Fatal("stale move accepted")
	}
}
