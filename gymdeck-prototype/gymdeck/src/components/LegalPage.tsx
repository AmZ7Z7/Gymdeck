import Link from "next/link";
import { IconBack } from "@/components/Icons";
import { LEGAL } from "@/lib/legal";

/** Mise en page commune des pages légales : même fond et mêmes polices que le jeu, bouton retour vers l'accueil. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="app">
      <div className="screen full legal">
        <div className="topbar">
          <Link className="backbtn" href="/" aria-label="Retour à l’accueil"><IconBack width={22} height={22} /></Link>
          <span className="wordmark"><img src="/assets/ui/wordmark.webp" alt="GymDeck" /></span>
          <span style={{ width: 44 }} />
        </div>
        <h1 className="title" style={{ marginTop: 14, marginBottom: 4 }}>{title}</h1>
        <p className="fine"><em>Dernière mise à jour : {LEGAL.updated}</em></p>
        <div className="legal-body">{children}</div>
        <Link className="btn ghost small" href="/" style={{ marginTop: 24 }}>Retour à l’accueil</Link>
      </div>
    </div>
  );
}

/** Liens discrets vers les pages légales (accueil, inscription, profil). */
export function LegalLinks() {
  return (
    <p className="legal-links">
      <Link href="/mentions-legales">Mentions légales</Link>
      <span aria-hidden> · </span>
      <Link href="/confidentialite">Confidentialité</Link>
    </p>
  );
}
