# InstaLocalPlanner

> Local-first Instagram editorial planner — French & English / Français & Anglais

InstaLocalPlanner is a free, local planner to organize, write, schedule and prepare Instagram posts before publishing them manually. Your content, media, captions and profile photos stay on your machine.

InstaLocalPlanner est un planificateur local libre pour organiser, rédiger, programmer et préparer ses publications Instagram avant de les publier à la main. Vos contenus, médias, légendes et photos de profil restent sur votre machine.

---

## Screenshots / Captures d'écran

> Replace the placeholders below with your own image links / Remplacer les liens ci-dessous par vos propres images.

| | |
|---|---|
| ![Grid preview / Aperçu grille](SCREENSHOT_URL_GRILLE) | ![Editorial planning / Planning éditorial](SCREENSHOT_URL_PLANNING) |
| ![Post editor / Éditeur de publication](SCREENSHOT_URL_EDITEUR) | ![Profile photo gallery / Galerie photos de profil](SCREENSHOT_URL_GALERIE) |

---

## 🇫🇷 Français

### Pourquoi ce logiciel ?

InstaLocalPlanner est conçu pour préparer ses publications Instagram dans un espace de travail propre, hors-ligne et entièrement sous votre contrôle. Le logiciel **ne publie pas** sur Instagram : il vous donne une grille visuelle, un calendrier éditorial, un éditeur de posts, une galerie de photos de profil et un assistant IA, afin que vous puissiez ensuite publier manuellement depuis votre téléphone avec un contenu prêt à l'emploi.

Tout est stocké en local dans des fichiers JSON et des dossiers de médias lisibles, sans base de données et sans compte cloud obligatoire.

### Fonctionnalités principales

- **Grille Instagram locale** avec posts, vidéos, carrousels, notes (Ghost Posts) et espaces vides.
- **Planning éditorial** : vues Mois, Semaine, File d'attente, Objectifs de fréquence.
- **Repères calendrier** multi-jours, barres colorées étirables, séparateurs, commentaires.
- **Menu clic droit Planning** : ajouter un événement, filtrer une date, programmer une sélection, déprogrammer, copier une date.
- **Multi-comptes** avec données isolées par profil, renommage et suppression avec archivage local.
- **Galerie de photos de profil** : avatars programmés et non programmés, profils durables et éphémères.
- **Organisation Drive-friendly** des médias rangés par compte et par statut.
- **Dossiers de hashtags**.
- **Assistant IA** compatible Ollama, LM Studio, OpenAI, Claude, Gemini, DeepSeek, avec bibliothèque de consignes personnalisées.
- **Prévisualisation mobile** d'un post Instagram dans l'éditeur.
- **Analyse de grille** : voisins similaires, clair/sombre, types de contenus.
- **Export de post** en `infos.txt` + QR code pour transférer rapidement la légende sur le téléphone.
- **Mode sombre** par défaut.
- **Import/export JSON** du planning et sauvegarde complète du compte.

### Interface traductible

Le logiciel est entièrement traductible via des fichiers JSON.

```text
data/languages/fr.json
data/languages/en.json
```

Vous pouvez aussi importer un fichier de langue personnalisé depuis **Réglages > Langue**. Les textes de l'interface passent par des clés `data-i18n` côté HTML.

### Assistant IA en local (LM Studio / Ollama)

L'assistant IA fonctionne **100 % en local** avec LM Studio ou Ollama, et garde vos brouillons sur votre machine.

**LM Studio :**

1. Lancer LM Studio et charger un modèle local.
2. Activer le serveur local OpenAI-compatible.
3. Dans InstaLocalPlanner, choisir `LM Studio local`.
4. URL : `http://127.0.0.1:1234/v1`.
5. Laisser le champ modèle vide pour utiliser automatiquement le premier modèle chargé.

**Ollama :** même principe avec votre URL Ollama habituelle et le nom du modèle local.

Les fournisseurs cloud (OpenAI, Claude, Gemini, DeepSeek) restent disponibles si vous souhaitez les utiliser avec vos propres clés.

### 📱 Synchronisation Google Drive (préparer ses posts sur ordinateur, publier depuis son téléphone)

Une manière très pratique d'utiliser InstaLocalPlanner est de placer le dossier du logiciel **dans un dossier synchronisé avec Google Drive pour ordinateur**. Tous vos médias, vos légendes et vos photos de profil deviennent alors accessibles depuis votre smartphone via l'application Google Drive, prêts à être publiés sur Instagram.

**Tutoriel rapide (Windows) :**

1. Installer **Google Drive pour ordinateur** (Google Drive Desktop).
2. Placer le dossier `InstaLocalPlanner` à l'intérieur d'un dossier synchronisé Google Drive, ou ajouter ce dossier à la liste des dossiers synchronisés.
3. Lancer InstaLocalPlanner normalement depuis ce dossier synchronisé (`python app.py` ou `launch.bat`).
4. Vos fichiers JSON et vos médias sont automatiquement copiés dans le cloud Google Drive.
5. Sur votre **smartphone**, installer l'application Google Drive et se connecter au même compte.
6. Vous retrouvez alors, depuis votre téléphone :
   - les médias des posts (rangés par date et par statut),
   - les photos de profil programmées,
   - les fichiers `infos.txt` (légende + hashtags + commentaire + identifications + date),
   - les QR codes exportés.
7. Vous pouvez alors créer la publication Instagram officielle depuis votre téléphone, en copiant simplement la légende et en important les médias depuis Drive.

Les médias sont rangés dans une arborescence lisible directement utilisable sur mobile :

```text
static/uploads/<compte>/Posts - programmes/
static/uploads/<compte>/Posts - non programmes/
static/uploads/<compte>/Photo profils - programmees/
static/uploads/<compte>/Photo profils - non programmees/
```

> Astuce : pour économiser l'espace sur votre téléphone, marquez les dossiers comme "disponibles en ligne uniquement" dans l'app Google Drive mobile.

### Installation

Prérequis : **Python 3** (Flask est la seule dépendance Python).

```bash
pip install -r requirements.txt
python app.py
```

Puis ouvrir dans le navigateur :

```text
http://127.0.0.1:5000
```

**Windows** : double-cliquer sur `install.bat` puis `launch.bat`.

**Optionnel** : installer FFmpeg pour la conversion automatique des GIF en MP4.

### Données locales

Le projet n'utilise aucune base SQL, uniquement des fichiers JSON :

```text
data/database.json              # profil + grille du compte par défaut
data/safety.json                # hashtags, repères calendrier, photos de profil
data/active_account.json        # compte actuellement affiché
data/accounts/<compte>/         # comptes additionnels
static/uploads/<compte>/        # médias organisés par compte
```

Les fichiers exemples sont fournis :

```text
data/database.example.json
data/safety.example.json
```

### 💛 Soutenir le projet

InstaLocalPlanner est un projet libre développé sur mon temps personnel. Si le logiciel vous aide à organiser votre contenu Instagram, vous pouvez soutenir son développement par un don.

**Lien de soutien (PayPal) :** `PAYPAL_LINK_A_REMPLACER`

Les dons servent à financer le temps de développement, les tests, la documentation et les évolutions futures (nouvelles fonctionnalités, traductions, support).

Merci infiniment à toute personne qui contribue 🙏

### Avertissement

InstaLocalPlanner n'est pas affilié à Instagram, Meta, Google Drive, LM Studio, Ollama, OpenAI, Anthropic, Google ou DeepSeek. Le logiciel prépare des contenus localement et ne remplace en aucun cas les outils officiels de publication.

---

## 🇬🇧 English

### What is InstaLocalPlanner?

InstaLocalPlanner is a local-first Instagram planner. It helps you prepare posts, captions, hashtags, profile photos, editorial notes and a visual grid layout before publishing manually on Instagram. The app **does not publish** to Instagram — it gives you a clean local workspace where your content, media and planning data stay under your control.

Everything is stored locally as plain JSON files and readable media folders. No SQL database, no mandatory cloud account.

### Main features

- **Local Instagram-style grid** with posts, videos, carousels, notes (Ghost Posts) and spacers.
- **Editorial planner** with Month, Week, Queue and Goal views.
- **Multi-day calendar markers** with draggable colored bars, separators and comments.
- **Right-click planning menu** for events, filters, scheduling, unscheduling, copying dates.
- **Multi-account support** with isolated profile data, account rename and deletion with local archive backup.
- **Profile photo gallery** with scheduled and unscheduled avatars, durable and ephemeral profiles.
- **Drive-friendly media folders** per account and per status.
- **Hashtag folders**.
- **AI assistant** compatible with Ollama, LM Studio, OpenAI, Claude, Gemini, DeepSeek, with a personal prompt library.
- **Mobile preview** of an Instagram post inside the editor.
- **Grid analysis**: neighbor similarity, light/dark detection, content type counts.
- **Post export** as `infos.txt` + QR code to quickly transfer captions to your phone.
- **Dark mode** by default.
- **Planning JSON import/export** and full account backup.

### Translatable interface

The app is fully translatable via JSON files:

```text
data/languages/fr.json
data/languages/en.json
```

You can also import a custom language file from **Settings > Language**. UI strings use `data-i18n` keys in HTML.

### Local AI (LM Studio / Ollama)

The AI assistant works **100% locally** with LM Studio or Ollama, keeping your drafts on your machine.

**LM Studio:**

1. Launch LM Studio and load a local model.
2. Enable the OpenAI-compatible local server.
3. In InstaLocalPlanner, select `LM Studio local`.
4. URL: `http://127.0.0.1:1234/v1`.
5. Leave the model field empty to auto-use the first loaded model.

**Ollama:** same idea with your usual Ollama URL and local model name.

Cloud providers (OpenAI, Claude, Gemini, DeepSeek) are also available with your own API keys.

### 📱 Google Drive sync (prepare on desktop, publish from phone)

A very convenient way to use InstaLocalPlanner is to place the project folder **inside a Google Drive for desktop synced folder**. All your media, captions and profile photos then become available on your smartphone through the Google Drive mobile app, ready to be published to Instagram.

**Quick tutorial (Windows):**

1. Install **Google Drive for desktop**.
2. Put the `InstaLocalPlanner` folder inside a synced Drive folder, or add it to Drive sync.
3. Run InstaLocalPlanner from that synced folder (`python app.py` or `launch.bat`).
4. JSON files and media folders are automatically uploaded to Google Drive.
5. On your **smartphone**, install the Google Drive app and sign in with the same account.
6. From your phone you can access:
   - post media (sorted by date and status),
   - scheduled profile photos,
   - exported `infos.txt` files (caption + hashtags + first comment + tagged accounts + date),
   - exported QR codes.
7. Create the official Instagram post from your phone by copying the caption and importing media from Drive.

Folder layout is mobile-friendly:

```text
static/uploads/<account>/Posts - programmes/
static/uploads/<account>/Posts - non programmes/
static/uploads/<account>/Photo profils - programmees/
static/uploads/<account>/Photo profils - non programmees/
```

> Tip: mark these folders as "available online only" in the Drive mobile app to save phone storage.

### Install

Requirements: **Python 3** (Flask is the only Python dependency).

```bash
pip install -r requirements.txt
python app.py
```

Then open in your browser:

```text
http://127.0.0.1:5000
```

**Windows:** double-click `install.bat`, then `launch.bat`.

**Optional:** install FFmpeg for automatic GIF → MP4 conversion.

### Local data

No SQL database, only JSON files:

```text
data/database.json              # default account profile + grid
data/safety.json                # hashtags, calendar markers, profile photos
data/active_account.json        # currently selected account
data/accounts/<account>/        # additional accounts
static/uploads/<account>/       # media organized per account
```

Example files are provided:

```text
data/database.example.json
data/safety.example.json
```

### 💛 Support the project

InstaLocalPlanner is a free, open project developed on personal time. If it helps your Instagram workflow, you can support its development with a donation.

**Donation link (PayPal):** `PAYPAL_LINK_TO_REPLACE`

Donations help fund development time, testing, documentation and future improvements.

Huge thanks to anyone who contributes 🙏

### Disclaimer

InstaLocalPlanner is not affiliated with Instagram, Meta, Google Drive, LM Studio, Ollama, OpenAI, Anthropic, Google or DeepSeek. The app prepares content locally and does not replace official publishing tools.

---

## License

This project is released as free, open software. Feel free to use it, fork it, translate it and improve it for your own Instagram workflow.
