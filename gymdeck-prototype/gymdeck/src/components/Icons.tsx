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
