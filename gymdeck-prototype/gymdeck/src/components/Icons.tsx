import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Swords = (p: P) => (
  <svg {...base} {...p}><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-4 4M3 19l2 2" /></svg>
);
export const Shield = (p: P) => (
  <svg {...base} {...p}><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" /></svg>
);
export const IconHome = (p: P) => (<svg {...base} {...p}><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z" fill="currentColor" /></svg>);
export const IconCards = (p: P) => (<svg {...base} {...p}><rect x="7" y="3" width="13" height="17" rx="2" /><path d="M4 7v13a1 1 0 0 0 1 1h11" /></svg>);
export const IconDumbbell = (p: P) => (<svg {...base} strokeWidth={2.6} {...p}><path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12" /></svg>);
export const IconCart = (p: P) => (<svg {...base} {...p}><path d="M3 4h2.5l2 11h10l2-8H7" /><circle cx="9" cy="19.5" r="1.6" fill="currentColor" /><circle cx="17" cy="19.5" r="1.6" fill="currentColor" /></svg>);
export const IconUser = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="8" r="4" fill="currentColor" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" /></svg>);
export const IconSearch = (p: P) => (<svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconBack = (p: P) => (<svg {...base} strokeWidth={2.4} {...p}><path d="m15 5-7 7 7 7" /></svg>);
export const IconNext = (p: P) => (<svg {...base} strokeWidth={2.4} {...p}><path d="m9 5 7 7-7 7" /></svg>);
export const IconChevron = (p: P) => (<svg {...base} strokeWidth={3} {...p}><path d="m9 5 7 7-7 7" /></svg>);
export const IconMarket = (p: P) => (<svg {...base} {...p}><path d="m14 4 6 6-3 3-6-6 3-3Z" fill="currentColor" /><path d="m11 7-7 7 3 3 7-7M3 21h9" /></svg>);
export const IconCombat = (p: P) => <Swords {...p} />;
export const IconCalendar = (p: P) => (<svg {...base} {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>);

// ───────── Icônes de l'app (même trait que la barre d'onglets, à la place des emojis) ─────────
export const IconFlame = (p: P) => (<svg {...base} {...p}><path d="M12 3c.8 3.2 5.5 5.2 5.5 10.2a5.5 5.5 0 0 1-11 0c0-2.3 1.1-3.9 2.3-5 .1 2 1 3.2 2.2 3.4-.4-3.1-.3-5.6 1-8.6Z" /></svg>);
export const IconGift = (p: P) => (<svg {...base} {...p}><rect x="4" y="10.5" width="16" height="9.5" rx="1.5" /><path d="M3 7.5h18v3H3zM12 7.5V20M12 7.5c-1.2-2.9-5-3.6-5-1.3 0 1.1 2.5 1.3 5 1.3Zm0 0c1.2-2.9 5-3.6 5-1.3 0 1.1-2.5 1.3-5 1.3Z" /></svg>);
export const IconClock = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>);
export const IconHourglass = (p: P) => (<svg {...base} {...p}><path d="M7 3h10M7 21h10M8 3v2.5c0 3 4 4.5 4 6.5s-4 3.5-4 6.5V21M16 3v2.5c0 3-4 4.5-4 6.5s4 3.5 4 6.5V21" /></svg>);
export const IconCheck = (p: P) => (<svg {...base} strokeWidth={2.6} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IconPencil = (p: P) => (<svg {...base} {...p}><path d="m4 20 4.2-1L19 8.2 15.8 5 5 15.8 4 20ZM13.8 7l3.2 3.2" /></svg>);
export const IconFlask = (p: P) => (<svg {...base} {...p}><path d="M9 3h6M10 3v6.2l-5.2 8.9A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.9L14 9.2V3M7.4 15h9.2" /></svg>);
export const IconBook = (p: P) => (<svg {...base} {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></svg>);

// groupes musculaires
export const IconPecs = (p: P) => (<svg {...base} {...p}><path d="M3.5 7.5c2.6-2 5.8-2 8.5 0 2.7-2 5.9-2 8.5 0v4.8c-2.1 3.2-5.6 3.6-8.5 1.5-2.9 2.1-6.4 1.7-8.5-1.5V7.5ZM12 7.5v6.3M6.5 17.5c1.6.8 3.6.9 5.5.4 1.9.5 3.9.4 5.5-.4" /></svg>);
export const IconShoulders = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="6" r="2.6" /><path d="M3.5 20v-3.2c0-2.6 1.6-4.6 4-5.4 1.3-.4 2.8-.6 4.5-.6s3.2.2 4.5.6c2.4.8 4 2.8 4 5.4V20M7.5 11.4c-.6 1.6-.6 3.3 0 5M16.5 11.4c.6 1.6.6 3.3 0 5" /></svg>);
export const IconBack2 = (p: P) => (<svg {...base} {...p}><path d="M5 4.5h14l-3.2 7.5 1.7 8H6.5l1.7-8L5 4.5ZM12 5.5v13.5M8.6 9.5c1.1.9 2.2 1.3 3.4 1.3s2.3-.4 3.4-1.3" /></svg>);
export const IconArm = (p: P) => (<svg {...base} {...p}><path d="M4.5 19.5c0-5.2 1.2-8.5 3.4-10.6L10 4.5h3.2l-.9 4.2c3.1-1.2 6.4.1 7.4 3.1 1.2 3.9-1.6 7.7-6.2 7.7H4.5ZM9.5 14c1.5-.6 3.4-.4 4.6.8" /></svg>);
export const IconLeg = (p: P) => (<svg {...base} {...p}><path d="M8.5 3v6.5c0 2 .6 3.4 1.1 4.6l1.4 3.4-1 3.5h7.5l-.9-2.2-2.8-1.4-.9-4.2c-.4-1.9-.3-3.6.1-5.4L14.5 3" /></svg>);
export const IconAbs = (p: P) => (<svg {...base} {...p}><rect x="6.5" y="3" width="11" height="18" rx="4.5" /><path d="M12 3.5v17M6.8 9h10.4M6.8 14.5h10.4" /></svg>);
export const IconHeart = (p: P) => (<svg {...base} {...p}><path d="M12 20.5s-8-4.7-8-10.6a4.3 4.3 0 0 1 8-2.2 4.3 4.3 0 0 1 8 2.2c0 5.9-8 10.6-8 10.6Z" /><path d="M6.5 12h2.8l1.4-2.4 2 4.6 1.4-2.2h3.4" /></svg>);

const GROUP_ICON: Record<string, (p: P) => React.JSX.Element> = {
  pecs: IconPecs, epaules: IconShoulders, dos: IconBack2, bras: IconArm, jambes: IconLeg, abdos: IconAbs, cardio: IconHeart,
};
/** Icône d'un groupe musculaire (Extensions, combats…). */
export function GroupIcon({ id, ...p }: P & { id: string }) {
  const I = GROUP_ICON[id] ?? IconDumbbell;
  return <I {...p} />;
}
