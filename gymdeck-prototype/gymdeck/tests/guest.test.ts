import { describe, expect, it } from "vitest";
import { createAccount, openPendingBooster } from "../src/lib/game";
import { addGuestCards } from "../src/lib/guest";
import { seededRng } from "../src/lib/rng";

describe("booster invité", () => {
  it("un booster de 5 cartes, tiré comme un booster de séance", () => {
    const s = createAccount();
    const withBooster = { ...s, boosters: [...s.boosters, { id: "invite", kind: "session" as const }] };
    const r = openPendingBooster(withBooster, "invite", seededRng(7));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cards).toHaveLength(5);
    // les 2 boosters de bienvenue sont toujours là
    expect(r.state.boosters.map((b) => b.kind)).toEqual(["welcome1", "welcome2"]);
  });

  it("à la création du compte : les cartes s'ajoutent, rien ne disparaît, les boosters de bienvenue restent", () => {
    const guest = openPendingBooster({ ...createAccount(), boosters: [{ id: "invite", kind: "session" }] }, "invite", seededRng(3));
    if (!guest.ok) throw new Error(guest.error);
    const fresh = createAccount();
    const s = addGuestCards(fresh, guest.cards);
    expect(s.cards).toHaveLength(5);
    expect(s.cards.map((c) => [c.exerciseSlug, c.rarity, c.atq, c.def])).toEqual(guest.cards.map((c) => [c.exerciseSlug, c.rarity, c.atq, c.def]));
    expect(new Set(s.cards.map((c) => c.id)).size).toBe(5);
    expect(s.seq).toBe(fresh.seq + 5);
    expect(s.boosters).toHaveLength(2);
  });

  it("sans cartes invitées, la partie reste identique", () => {
    const s = createAccount();
    expect(addGuestCards(s, [])).toBe(s);
  });
});
