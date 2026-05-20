"""
prepare_release.py — Préparer une version vierge d'InstaLocalPlanner pour publication.

Ce script supprime les fichiers/dossiers de données personnelles tout en gardant
le code, la documentation et les exemples vierges.

USAGE RECOMMANDÉ :
    1. DUPLIQUER d'abord le dossier complet du projet (par sécurité).
    2. Exécuter ce script DANS LA COPIE, jamais dans ton dossier de travail.
       python prepare_release.py
    3. Lancer python app.py pour vérifier que la copie est bien vierge.
    4. git status pour confirmer qu'aucun fichier personnel n'est suivi.

Le script demande confirmation avant chaque action et liste tout ce qu'il
s'apprête à supprimer.
"""

import os
import shutil
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Fichiers/dossiers de données personnelles à supprimer
PERSONAL_FILES = [
    'data/database.json',
    'data/safety.json',
    'data/active_account.json',
]

PERSONAL_DIRS = [
    'data/accounts',
    'static/uploads',
    'archives',
    '__pycache__',
    '.venv',
    'venv',
]

# Fichiers exemples à GARDER (sécurité : on s'assure qu'ils existent)
REQUIRED_EXAMPLES = [
    'data/database.example.json',
    'data/safety.example.json',
    'data/languages/fr.json',
    'data/languages/en.json',
]

# Fichiers de code/doc à GARDER (sécurité : on vérifie qu'ils sont là)
REQUIRED_CODE = [
    'app.py',
    'requirements.txt',
    'README.md',
    'CHANGELOG.md',
    'NOTE_PERSONNELLE_PUBLICATION.md',
    'templates/index.html',
    'static/js/script.js',
    'static/css/style.css',
]


def banner(msg):
    print()
    print('=' * 70)
    print(msg)
    print('=' * 70)


def confirm(msg, default_no=True):
    suffix = ' [o/N] ' if default_no else ' [O/n] '
    answer = input(msg + suffix).strip().lower()
    if not answer:
        return not default_no
    return answer in ('o', 'oui', 'y', 'yes')


def safety_check():
    """Refuser de tourner si on n'est pas dans un vrai dossier InstaLocalPlanner,
    ou si on est dans le dossier de travail principal (par sécurité)."""
    if not os.path.exists(os.path.join(BASE_DIR, 'app.py')):
        print('ERREUR : ce script doit être placé à la racine du projet InstaLocalPlanner.')
        sys.exit(1)

    folder_name = os.path.basename(BASE_DIR).lower()
    print(f'Dossier courant : {BASE_DIR}')
    print()
    print('⚠️  IMPORTANT — ce script supprime des données personnelles de manière IRRÉVERSIBLE.')
    print('   Vérifie que tu es bien dans une COPIE du projet, pas dans ton dossier de travail.')
    print()
    if 'test' not in folder_name and 'public' not in folder_name and 'release' not in folder_name and 'vierge' not in folder_name:
        print('   Le nom du dossier ne contient ni "test", ni "public", ni "release", ni "vierge".')
        print('   Si c\'est ton dossier de travail principal, ARRÊTE ICI (Ctrl+C).')
        print()
    if not confirm('Continuer ?'):
        print('Annulé.')
        sys.exit(0)


def list_targets():
    """Retourner la liste des cibles existantes à supprimer."""
    files_to_remove = []
    dirs_to_remove = []

    for rel in PERSONAL_FILES:
        path = os.path.join(BASE_DIR, rel)
        if os.path.isfile(path):
            files_to_remove.append((rel, path))

    for rel in PERSONAL_DIRS:
        path = os.path.join(BASE_DIR, rel)
        if os.path.isdir(path):
            # taille indicative
            total_size = 0
            file_count = 0
            for root, _, files in os.walk(path):
                for f in files:
                    try:
                        total_size += os.path.getsize(os.path.join(root, f))
                        file_count += 1
                    except OSError:
                        pass
            dirs_to_remove.append((rel, path, file_count, total_size))

    return files_to_remove, dirs_to_remove


def check_required_files():
    """Avertir si des fichiers essentiels manquent."""
    missing = []
    for rel in REQUIRED_EXAMPLES + REQUIRED_CODE:
        if not os.path.exists(os.path.join(BASE_DIR, rel)):
            missing.append(rel)
    if missing:
        print('⚠️  Fichiers essentiels manquants (à ajouter avant publication) :')
        for m in missing:
            print(f'    - {m}')
        print()


def format_size(n_bytes):
    for unit in ('o', 'Ko', 'Mo', 'Go'):
        if n_bytes < 1024:
            return f'{n_bytes:.1f} {unit}'
        n_bytes /= 1024
    return f'{n_bytes:.1f} To'


def remove_targets(files_to_remove, dirs_to_remove):
    removed = 0
    for rel, path in files_to_remove:
        try:
            os.remove(path)
            print(f'  ✓ supprimé : {rel}')
            removed += 1
        except OSError as e:
            print(f'  ✗ échec    : {rel} ({e})')

    for rel, path, _, _ in dirs_to_remove:
        try:
            shutil.rmtree(path)
            print(f'  ✓ supprimé : {rel}/ (et tout son contenu)')
            removed += 1
        except OSError as e:
            print(f'  ✗ échec    : {rel}/ ({e})')

    return removed


def post_clean_summary():
    """Vérifier l'état final."""
    banner('VÉRIFICATION FINALE')
    leftover = []
    for rel in PERSONAL_FILES:
        if os.path.exists(os.path.join(BASE_DIR, rel)):
            leftover.append(rel)
    for rel in PERSONAL_DIRS:
        if os.path.exists(os.path.join(BASE_DIR, rel)):
            leftover.append(rel + '/')

    if leftover:
        print('⚠️  Il reste encore des éléments personnels :')
        for l in leftover:
            print(f'    - {l}')
        print('   Supprime-les manuellement avant de publier.')
    else:
        print('✓ Aucun fichier personnel détecté. La copie est prête.')

    print()
    print('Prochaine étape recommandée :')
    print('  1. python app.py')
    print('  2. Ouvrir http://127.0.0.1:5000 et vérifier qu\'aucune donnée perso n\'apparaît.')
    print('  3. git status pour confirmer qu\'aucun fichier personnel n\'est suivi.')
    print('  4. Remplacer les placeholders dans README.md (screenshots, lien PayPal).')


def main():
    banner('InstaLocalPlanner — préparation d\'une version vierge publique')
    safety_check()

    banner('Fichiers essentiels (doivent rester présents)')
    check_required_files()

    banner('Éléments personnels détectés')
    files_to_remove, dirs_to_remove = list_targets()

    if not files_to_remove and not dirs_to_remove:
        print('✓ Aucun fichier personnel détecté. Rien à faire.')
        post_clean_summary()
        return

    if files_to_remove:
        print('Fichiers :')
        for rel, _ in files_to_remove:
            print(f'  - {rel}')
    if dirs_to_remove:
        print('Dossiers :')
        for rel, _, count, size in dirs_to_remove:
            print(f'  - {rel}/ ({count} fichiers, {format_size(size)})')

    print()
    if not confirm('Supprimer DÉFINITIVEMENT tous ces éléments ?'):
        print('Annulé. Aucun fichier modifié.')
        return

    banner('SUPPRESSION')
    removed = remove_targets(files_to_remove, dirs_to_remove)
    print(f'\n{removed} élément(s) supprimé(s).')

    post_clean_summary()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nInterrompu.')
        sys.exit(130)
