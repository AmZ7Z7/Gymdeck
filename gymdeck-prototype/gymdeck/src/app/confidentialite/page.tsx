import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Politique de confidentialité · GymDeck" };

export default function Confidentialite() {
  return (
    <LegalPage title="Politique de confidentialité">
      <p>Cette politique explique quelles données GymDeck collecte, pourquoi, et quels sont vos droits, conformément au Règlement général sur la protection des données (RGPD) et à la loi Informatique et Libertés.</p>

      <h2>Responsable du traitement</h2>
      <p>Adrien {LEGAL.lastName}, éditeur de GymDeck. Contact : {LEGAL.email}.</p>

      <h2>Données collectées</h2>
      <p>GymDeck collecte uniquement les données nécessaires au fonctionnement du jeu :</p>
      <ul>
        <li><b>Données de compte</b> : adresse email et pseudo, si vous créez un compte.</li>
        <li><b>Données de jeu</b> : cartes collectionnées, boosters ouverts, monnaie du jeu (GC), progression, séries de jours, missions, résultats des combats et classements.</li>
        <li><b>Données sociales</b> : liste d’amis, vitrine, échanges de cartes et enchères, si vous utilisez ces fonctions.</li>
        <li><b>Séances déclarées</b> : les séances que vous enregistrez pour obtenir des récompenses dans le jeu (date, exercices).</li>
        <li><b>Données techniques</b> : informations de connexion nécessaires au fonctionnement et à la sécurité du site (journaux techniques de l’hébergeur).</li>
      </ul>
      <p>GymDeck ne collecte aucune donnée bancaire, aucune donnée de santé (poids, mensurations, état de santé) et aucune donnée de localisation précise.</p>
      <p>Votre pseudo, votre vitrine et votre position au classement peuvent être visibles par les autres joueurs.</p>

      <h2>Pourquoi ces données sont utilisées</h2>
      <ul>
        <li>Créer et gérer votre compte, sauvegarder votre collection et votre progression (exécution du service que vous demandez).</li>
        <li>Faire fonctionner les fonctions sociales : amis, échanges, enchères, classements.</li>
        <li>Assurer la sécurité du site et empêcher la triche (intérêt légitime).</li>
        <li>Vous envoyer des rappels de séance, uniquement si vous les activez (consentement, que vous pouvez retirer à tout moment).</li>
      </ul>
      <p>Vos données ne sont jamais vendues ni utilisées à des fins publicitaires.</p>

      <h2>Cookies et stockage local</h2>
      <p>GymDeck utilise uniquement le stockage local du navigateur et des cookies techniques nécessaires au fonctionnement du jeu (rester connecté, sauvegarder la partie). Ils ne nécessitent pas de consentement. Aucun cookie publicitaire ou de pistage n’est utilisé.</p>

      <h2>Qui a accès aux données</h2>
      <p>Seul l’éditeur a accès à vos données. Elles sont hébergées par des prestataires techniques :</p>
      <ul>
        <li><b>Vercel Inc.</b> (hébergement du site, États-Unis).</li>
        <li><b>Supabase Inc.</b> (base de données et comptes utilisateurs), avec un stockage des données dans l’Union européenne.</li>
      </ul>
      <p>Lorsque des données sont traitées hors de l’Union européenne, ces prestataires s’appuient sur les garanties prévues par le RGPD (clauses contractuelles types de la Commission européenne et/ou cadre de protection des données UE–États-Unis).</p>

      <h2>Durée de conservation</h2>
      <ul>
        <li>Données de compte et de jeu : tant que votre compte existe. Elles sont supprimées si vous supprimez votre compte, ou après 3 ans d’inactivité.</li>
        <li>Journaux techniques : selon les durées de conservation de l’hébergeur, en règle générale quelques semaines.</li>
      </ul>

      <h2>Vos droits</h2>
      <p>Vous pouvez à tout moment demander à accéder à vos données, les corriger, les supprimer, les récupérer dans un format lisible, limiter leur utilisation ou vous opposer à leur traitement. Écrivez à {LEGAL.email}. Une réponse vous sera apportée dans un délai d’un mois.</p>
      <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez déposer une réclamation auprès de la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).</p>

      <h2>Mineurs</h2>
      <p>Si vous avez moins de 15 ans, la création d’un compte nécessite l’accord d’un de vos parents ou représentant légal.</p>

      <h2>Modifications</h2>
      <p>Cette politique peut être mise à jour si le jeu évolue. La date de dernière mise à jour figure en haut de la page.</p>
    </LegalPage>
  );
}
