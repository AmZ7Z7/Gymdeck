export const DEMO_NAME = "Adrien";

export function Wordmark() {
  return <div className="wordmark">GYM<b>DECK</b></div>;
}

export function GcPill({ gc }: { gc: number }) {
  return (
    <div className="gc"><span className="coin" />{gc} GC</div>
  );
}
