import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { HOST, LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales · GymDeck" };

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales">
      <p>Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN).</p>

      <h2>Éditeur du site</h2>
      <p>Le site GymDeck, accessible à l’adresse {LEGAL.site}, est un projet personnel et non commercial édité par :</p>
      <ul>
        <li>Adrien {LEGAL.lastName}, particulier</li>
        <li>Contact : {LEGAL.email}</li>
      </ul>
      <p>Directeur de la publication : Adrien {LEGAL.lastName}.</p>

      <h2>Hébergeur</h2>
      <p>Le site est hébergé par :</p>
      <p>{HOST.name}<br />{HOST.address}<br />Site web : <a href={HOST.url} target="_blank" rel="noopener noreferrer">{HOST.url}</a></p>

      <h2>Objet du site</h2>
      <p>GymDeck est un jeu gratuit de cartes à collectionner sur le thème de la musculation. Il n’y a ni achat ni paiement sur le site.</p>

      <h2>Propriété intellectuelle</h2>
      <p>Le nom GymDeck, la conception du jeu, les textes, les illustrations des cartes et l’interface sont la propriété de l’éditeur, sauf mention contraire. Toute reproduction ou réutilisation sans autorisation est interdite.</p>
      <p>Les illustrations des cartes sont générées à l’aide d’outils d’intelligence artificielle. Les personnages représentés sont fictifs : toute ressemblance avec une personne réelle serait fortuite.</p>
      <p>GymDeck n’est affilié à aucune marque, salle de sport ou fédération sportive.</p>

      <h2>Avertissement santé</h2>
      <p>GymDeck est un jeu. Les exercices présentés sur les cartes ne constituent ni un programme d’entraînement ni un conseil médical. Avant de commencer une activité physique, demandez l’avis d’un professionnel de santé ou d’un coach qualifié.</p>

      <h2>Responsabilité</h2>
      <p>L’éditeur s’efforce de maintenir le site accessible et à jour, mais ne peut garantir l’absence d’erreurs ni une disponibilité permanente. Le jeu peut évoluer, être modifié ou interrompu à tout moment.</p>

      <h2>Données personnelles</h2>
      <p>Le traitement des données personnelles est décrit dans la <Link href="/confidentialite">Politique de confidentialité</Link>.</p>

      <h2>Contact</h2>
      <p>Pour toute question ou réclamation : {LEGAL.email}.</p>

      <h2>Droit applicable</h2>
      <p>Les présentes mentions légales sont régies par le droit français.</p>
    </LegalPage>
  );
}
