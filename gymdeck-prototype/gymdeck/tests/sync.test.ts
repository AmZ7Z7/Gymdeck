import { describe, expect, it } from "vitest";
import { changedElsewhere, startupChoice, type SyncInfo } from "../src/lib/sync";

const T1 = "2026-10-21T10:00:00.000+00:00";
const T2 = "2026-10-21T12:00:00.000+00:00";
const info = (o: Partial<SyncInfo> = {}): SyncInfo => ({ userId: "u1", base: T1, dirty: false, savedAt: Date.parse(T1), ...o });

describe("sauvegarde en ligne : choix au démarrage", () => {
  it("aucune copie en ligne : on garde celle du téléphone", () => {
    expect(startupChoice(null, "u1", null)).toBe("local");
    expect(startupChoice(info(), "u1", null)).toBe("local");
  });

  it("copie du téléphone inconnue ou d'un autre compte : la copie en ligne fait foi", () => {
    expect(startupChoice(null, "u1", T1)).toBe("cloud");
    expect(startupChoice(info({ userId: "u2", dirty: true, savedAt: Date.parse(T2) + 1 }), "u1", T1)).toBe("cloud");
  });

  it("personne n'a enregistré depuis : la copie du téléphone (avec ses changements) est gardée", () => {
    expect(startupChoice(info(), "u1", T1)).toBe("local");
    expect(startupChoice(info({ dirty: true }), "u1", T1)).toBe("local");
  });

  it("un autre appareil a enregistré et ce téléphone n'a rien de neuf : on reprend la copie en ligne", () => {
    // le cas de la LR perdue : la tablette a enregistré à T2, le téléphone est resté à T1
    expect(startupChoice(info({ dirty: false }), "u1", T2)).toBe("cloud");
  });

  it("les deux ont changé : la plus récente gagne", () => {
    expect(startupChoice(info({ dirty: true, savedAt: Date.parse(T2) - 1000 }), "u1", T2)).toBe("cloud");
    expect(startupChoice(info({ dirty: true, savedAt: Date.parse(T2) + 1000 }), "u1", T2)).toBe("local");
  });

  it("détecte un enregistrement fait ailleurs", () => {
    expect(changedElsewhere(info(), T1)).toBe(false);
    expect(changedElsewhere(info(), T2)).toBe(true);
    expect(changedElsewhere(info(), null)).toBe(false);
    expect(changedElsewhere(info(), undefined)).toBe(false);
  });
});

/**
 * Deux appareils et un serveur imités, avec la même règle que src/lib/cloud.ts :
 * un enregistrement n'est accepté que si la copie en ligne est toujours celle que l'appareil a vue en dernier.
 */
describe("deux appareils sur le même compte", () => {
  type Save = { cards: string[] };
  function server() {
    let row: { state: Save; updatedAt: string } | null = null;
    let clock = 0;
    return {
      stamp: () => row?.updatedAt ?? null,
      load: () => row,
      save(state: Save, base: string | null): { ok: true; updatedAt: string } | { ok: false } {
        if ((row?.updatedAt ?? null) !== base) return { ok: false };
        row = { state, updatedAt: new Date(Date.parse(T1) + ++clock * 60_000).toISOString() };
        return { ok: true, updatedAt: row.updatedAt };
      },
    };
  }
  function device(srv: ReturnType<typeof server>) {
    const d = { state: { cards: [] as string[] }, sync: null as SyncInfo | null, messages: 0 };
    const adopt = () => { const r = srv.load()!; d.state = r.state; d.sync = { userId: "u1", base: r.updatedAt, dirty: false, savedAt: 0 }; };
    return {
      get cards() { return d.state.cards; },
      get messages() { return d.messages; },
      start() {
        const stamp = srv.stamp();
        if (startupChoice(d.sync, "u1", stamp) === "cloud") return adopt();
        const prev = d.sync;
        d.sync = { userId: "u1", base: stamp, dirty: prev ? prev.dirty || prev.base !== stamp : true, savedAt: prev?.savedAt ?? 0 };
        this.push();
      },
      play(card: string) { d.state = { cards: [...d.state.cards, card] }; d.sync = { ...d.sync!, dirty: true, savedAt: Date.now() }; },
      push() {
        if (!d.sync?.dirty) return;
        const r = srv.save(d.state, d.sync.base);
        if (r.ok) d.sync = { ...d.sync, base: r.updatedAt, dirty: false };
        else { adopt(); d.messages++; }
      },
      check() { if (d.sync && !d.sync.dirty && changedElsewhere(d.sync, srv.stamp())) { adopt(); d.messages++; } },
    };
  }

  it("la LR tirée sur la tablette n'est jamais écrasée par la vieille copie du téléphone", () => {
    const srv = server();
    const phone = device(srv);
    const tablet = device(srv);
    phone.start();
    phone.play("Squat C");
    phone.push();
    tablet.start();
    expect(tablet.cards).toEqual(["Squat C"]);

    tablet.play("Rameur LR");
    tablet.push();

    // le téléphone, resté ouvert, vérifie la copie en ligne : il récupère la LR
    phone.check();
    expect(phone.cards).toEqual(["Squat C", "Rameur LR"]);
    expect(phone.messages).toBe(1);
    phone.play("Gainage R");
    phone.push();
    expect(srv.load()!.state.cards).toEqual(["Squat C", "Rameur LR", "Gainage R"]);
  });

  it("un téléphone éteint récupère la partie au redémarrage au lieu de l'écraser", () => {
    const srv = server();
    const phone = device(srv);
    const tablet = device(srv);
    phone.start();
    phone.play("Squat C");
    phone.push();
    tablet.start();
    tablet.play("Rameur LR");
    tablet.push();
    phone.start();
    expect(phone.cards).toEqual(["Squat C", "Rameur LR"]);
    expect(srv.load()!.state.cards).toEqual(["Squat C", "Rameur LR"]);
  });

  it("un envoi périmé est refusé : la copie en ligne reste intacte", () => {
    const srv = server();
    const phone = device(srv);
    const tablet = device(srv);
    phone.start();
    phone.play("Squat C");
    phone.push();
    tablet.start();
    tablet.play("Rameur LR");
    tablet.push();
    // le téléphone joue sans avoir vérifié : son envoi est refusé, il reprend la copie en ligne
    phone.play("Gainage R");
    phone.push();
    expect(srv.load()!.state.cards).toEqual(["Squat C", "Rameur LR"]);
    expect(phone.cards).toEqual(["Squat C", "Rameur LR"]);
  });
});
