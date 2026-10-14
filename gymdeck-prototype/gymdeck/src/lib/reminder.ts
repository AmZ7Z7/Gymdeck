/** Rappel de séance : fichier calendrier (.ics) récurrent, importable dans Apple Calendar, Google Agenda, Outlook… */

export const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"]; // index 0 = lundi
const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Prochaine date (à partir d'aujourd'hui) tombant un des jours choisis. */
function firstDate(days: number[], from: Date): Date {
  for (let i = 0; i < 8; i++) {
    const d = new Date(from.getTime() + i * 86_400_000);
    if (days.includes((d.getDay() + 6) % 7)) return d;
  }
  return from;
}

export function buildIcs(days: number[], time: string, now = new Date()): string {
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const d = firstDate(days, now);
  const start = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hh)}${pad(mm)}00`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GymDeck//Rappel de seance//FR", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", "UID:gymdeck-rappel-seance@gymdeck", `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Paris:${start}`, "DURATION:PT1H",
    `RRULE:FREQ=WEEKLY;BYDAY=${days.map((x) => BYDAY[x]).join(",")}`,
    "SUMMARY:Séance GymDeck", "DESCRIPTION:Fais ta séance puis valide-la dans GymDeck pour gagner ton booster !",
    "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", "DESCRIPTION:Séance GymDeck", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(days: number[], time: string) {
  const blob = new Blob([buildIcs(days, time)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "rappel-gymdeck.ics";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Vrai si c'est l'heure (ou plus tard) d'un jour de rappel — pour la bannière dans l'appli. */
export function reminderDue(rem: { days: number[]; time: string } | null, now = new Date()): boolean {
  if (!rem) return false;
  if (!rem.days.includes((now.getDay() + 6) % 7)) return false;
  const [hh, mm] = rem.time.split(":").map(Number) as [number, number];
  return now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm;
}
