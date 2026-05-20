import os
import base64
import json
import uuid
import time
import shutil
import platform
import subprocess
import binascii
import copy
import tempfile
import urllib.error
import urllib.request
import zipfile
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# CONFIG
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'database.json')
SAFETY_FILE = os.path.join(BASE_DIR, 'data', 'safety.json')
ACCOUNTS_FOLDER = os.path.join(BASE_DIR, 'data', 'accounts')
ACTIVE_ACCOUNT_FILE = os.path.join(BASE_DIR, 'data', 'active_account.json')
LANG_FOLDER = os.path.join(BASE_DIR, 'data', 'languages')
LEGACY_LANG_FOLDER = os.path.join(BASE_DIR, 'data', 'lang')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
ARCHIVE_FOLDER = os.path.join(BASE_DIR, 'archives')

for f in [os.path.dirname(DATA_FILE), ACCOUNTS_FOLDER, LANG_FOLDER, UPLOAD_FOLDER, ARCHIVE_FOLDER]:
    os.makedirs(f, exist_ok=True)

# INIT DATA
def init_files():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({"profile": {"name": "user"}, "grid": []}, f)
    if not os.path.exists(SAFETY_FILE):
        with open(SAFETY_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                "banned_hashtags": [],
                "sensitive_words": [],
                "snippets": {},
                "ai_prompts": []
            }, f)
    if not os.path.exists(ACTIVE_ACCOUNT_FILE):
        with open(ACTIVE_ACCOUNT_FILE, 'w', encoding='utf-8') as f:
            json.dump({"active": "default"}, f)

init_files()

def load_json(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if data else {}
    except:
        return {}

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f: json.dump(data, f, indent=4, ensure_ascii=False)

def post_json(url, payload, headers=None, timeout=90):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Content-Type': 'application/json',
            **(headers or {})
        },
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode('utf-8'))

def get_json(url, headers=None, timeout=20):
    req = urllib.request.Request(
        url,
        headers=headers or {},
        method='GET'
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode('utf-8'))

def slugify_account(value):
    cleaned = ''.join(c.lower() if c.isalnum() else '-' for c in value.strip())
    cleaned = '-'.join(part for part in cleaned.split('-') if part)
    return cleaned[:48] or 'account'

def get_active_account():
    state = load_json(ACTIVE_ACCOUNT_FILE)
    active = state.get('active', 'default')
    return active if active == 'default' or is_safe_account(active) else 'default'

def is_safe_account(slug):
    return slug == slugify_account(slug)

def account_dir(slug):
    return os.path.join(ACCOUNTS_FOLDER, slug)

def account_data_file(slug=None):
    slug = slug or get_active_account()
    return DATA_FILE if slug == 'default' else os.path.join(account_dir(slug), 'database.json')

def account_safety_file(slug=None):
    slug = slug or get_active_account()
    return SAFETY_FILE if slug == 'default' else os.path.join(account_dir(slug), 'safety.json')

def account_upload_folder(slug=None):
    """Nouveau : chaque compte a SON sous-dossier dans static/uploads,
    y compris 'default', pour faciliter le tri Google Drive par compte.
    Les anciens médias placés directement dans static/uploads/Posts - programmes/
    continuent à fonctionner via leur URL d'origine."""
    slug = slug or get_active_account()
    return os.path.join(UPLOAD_FOLDER, slug)

def account_upload_url_prefix(slug=None):
    slug = slug or get_active_account()
    return f'/static/uploads/{slug}'

# Anciens chemins (avant la mise en place du sous-dossier par compte).
# Utilisés pour la rétro-compatibilité quand on cherche un fichier déjà uploadé
# avant cette migration. Garde 'default' à plat à static/uploads/.
def legacy_upload_folder(slug=None):
    slug = slug or get_active_account()
    return UPLOAD_FOLDER if slug == 'default' else os.path.join(UPLOAD_FOLDER, slug)

def legacy_upload_url_prefix(slug=None):
    slug = slug or get_active_account()
    return '/static/uploads' if slug == 'default' else f'/static/uploads/{slug}'

# Nouveaux dossiers (sémantique clarifiée) :
#   Photo profils - programmees       : photos avec date sur le planning
#                                       (normal ET éphémère, préfixées par date)
#   Photo profils - non programmees   : photos en attente, pas encore datées
#   Photo profils - ephemeres         : conservé pour usage futur (archives applicatives)
FOLDER_POSTS_SCHEDULED = 'Posts - programmes'
FOLDER_POSTS_UNSCHEDULED = 'Posts - non programmes'
FOLDER_PROFILE_SCHEDULED = 'Photo profils - programmees'
FOLDER_PROFILE_UNSCHEDULED = 'Photo profils - non programmees'
FOLDER_PROFILE_EPHEMERAL = 'Photo profils - ephemeres'
# Compat : ancien nom (avant la séparation programmees/non programmees pour les photos)
FOLDER_PROFILE_LEGACY_UNSCHEDULED = 'Photo profils - nouvelles non programmees'

def upload_category_folder(kind, post=None):
    if kind == 'profile_avatar':
        return FOLDER_PROFILE_UNSCHEDULED
    if kind == 'profile_avatar_scheduled':
        return FOLDER_PROFILE_SCHEDULED
    if kind == 'profile_avatar_ephemeral':
        return FOLDER_PROFILE_EPHEMERAL
    if kind == 'post':
        return FOLDER_POSTS_SCHEDULED if (post or {}).get('publish_date') else FOLDER_POSTS_UNSCHEDULED
    return ''

def slugify_filename_piece(text, max_len=32):
    """Slug doux pour préfixer/suffixer un nom de fichier : alpha-num + '-' '_'."""
    if not text:
        return ''
    cleaned = []
    for ch in str(text).strip():
        if ch.isalnum():
            cleaned.append(ch)
        elif ch in (' ', '-', '_'):
            cleaned.append('-')
    out = ''.join(cleaned).strip('-_')
    while '--' in out:
        out = out.replace('--', '-')
    return out[:max_len]

def account_upload_folders_all(slug=None):
    """Retourne TOUTES les racines d'upload connues pour ce compte :
    le nouveau (ex. static/uploads/default) ET, pour rétro-compatibilité,
    l'ancien chemin pour les médias déjà uploadés avant la migration.
    Pour 'default' c'est [static/uploads/default, static/uploads].
    Pour les comptes additionnels, c'est [static/uploads/<slug>] seul.
    L'ordre est : nouveau d'abord, legacy ensuite."""
    slug = slug or get_active_account()
    new_folder = os.path.abspath(account_upload_folder(slug))
    if slug == 'default':
        return [new_folder, os.path.abspath(UPLOAD_FOLDER)]
    return [new_folder]

def is_safe_child_any(allowed_folders, child):
    """Variante de is_safe_child qui accepte plusieurs racines autorisées."""
    return any(is_safe_child(folder, child) for folder in allowed_folders if folder)

def resolve_media_src_to_path(src, slug=None):
    """Résout une URL '/static/uploads/...' vers un chemin disque réel,
    en cherchant successivement dans le nouveau dossier compte puis le legacy.
    Retourne (path, folder_root) ou (None, None) si introuvable/non sûr."""
    if not isinstance(src, str) or not src.startswith('/static/uploads/'):
        return None, None
    rel = src.replace('/static/uploads/', '', 1).replace('/', os.sep)
    # Le rel inclut potentiellement le sous-dossier compte (ex. "default/Posts - ...")
    # ou pas (ex. "Posts - programmes/...") — on essaie les deux.
    candidates = []
    candidates.append((os.path.join(UPLOAD_FOLDER, rel), UPLOAD_FOLDER))
    # Pour comptes additionnels, l'URL inclut le slug. Pour default, l'URL peut
    # inclure 'default/' (nouveau) ou non (legacy).
    slug = slug or get_active_account()
    if slug == 'default' and not rel.startswith('default' + os.sep):
        # Possible chemin nouveau implicite
        candidates.append((os.path.join(UPLOAD_FOLDER, 'default', rel), os.path.join(UPLOAD_FOLDER, 'default')))
    allowed = account_upload_folders_all(slug)
    for path, root in candidates:
        if os.path.exists(path) and is_safe_child_any(allowed, path):
            return os.path.abspath(path), os.path.abspath(root)
    return None, None

def ensure_account_files(slug, profile_name=None):
    if slug == 'default':
        init_files()
        return

    folder = account_dir(slug)
    os.makedirs(folder, exist_ok=True)
    os.makedirs(account_upload_folder(slug), exist_ok=True)

    db_path = account_data_file(slug)
    safety_path = account_safety_file(slug)
    if not os.path.exists(db_path):
        save_json(db_path, {"profile": {"name": profile_name or slug}, "grid": []})
    if not os.path.exists(safety_path):
        save_json(safety_path, {
            "banned_hashtags": [],
            "hashtag_folders": {"Général": []},
            "sensitive_words": [],
            "snippets": {},
            "ai_prompts": []
        })

def replace_upload_slug_refs(value, old_slug, new_slug):
    """Met à jour récursivement les URLs d'upload après renommage de compte."""
    if isinstance(value, str):
        if old_slug == 'default':
            for folder_name in [
                FOLDER_POSTS_SCHEDULED,
                FOLDER_POSTS_UNSCHEDULED,
                FOLDER_PROFILE_SCHEDULED,
                FOLDER_PROFILE_UNSCHEDULED,
                FOLDER_PROFILE_EPHEMERAL,
                FOLDER_PROFILE_LEGACY_UNSCHEDULED
            ]:
                value = value.replace(f'/static/uploads/{folder_name}/', f'/static/uploads/{new_slug}/{folder_name}/')
        return value.replace(f'/static/uploads/{old_slug}/', f'/static/uploads/{new_slug}/')
    if isinstance(value, list):
        return [replace_upload_slug_refs(item, old_slug, new_slug) for item in value]
    if isinstance(value, dict):
        return {key: replace_upload_slug_refs(item, old_slug, new_slug) for key, item in value.items()}
    return value

def unique_account_slug(base_slug, current_slug=None):
    base_slug = slugify_account(base_slug)
    if base_slug == 'default' and current_slug != 'default':
        base_slug = 'default-2'
    slug = base_slug
    counter = 2
    while True:
        account_conflict = slug != current_slug and slug != 'default' and os.path.exists(account_dir(slug))
        upload_conflict = slug != current_slug and os.path.exists(account_upload_folder(slug))
        if not account_conflict and not upload_conflict:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1

def move_children(src, dst):
    if not os.path.isdir(src):
        return
    os.makedirs(dst, exist_ok=True)
    for name in os.listdir(src):
        source = os.path.join(src, name)
        target = os.path.join(dst, name)
        if os.path.exists(target):
            if os.path.isdir(source) and os.path.isdir(target):
                move_children(source, target)
                try:
                    os.rmdir(source)
                except OSError:
                    pass
            else:
                stem, ext = os.path.splitext(name)
                counter = 2
                while os.path.exists(target):
                    target = os.path.join(dst, f"{stem}-{counter}{ext}")
                    counter += 1
                shutil.move(source, target)
        else:
            shutil.move(source, target)

def migrate_account_slug(current_slug, target_slug, db, safety):
    if not target_slug or target_slug == current_slug:
        return current_slug, db, safety
    if not is_safe_account(target_slug):
        return current_slug, db, safety

    db = replace_upload_slug_refs(db, current_slug, target_slug)
    safety = replace_upload_slug_refs(safety, current_slug, target_slug)

    if current_slug == 'default':
        os.makedirs(account_dir(target_slug), exist_ok=True)
        save_json(os.path.join(account_dir(target_slug), 'database.json'), db)
        save_json(os.path.join(account_dir(target_slug), 'safety.json'), safety)

        target_upload = account_upload_folder(target_slug)
        os.makedirs(target_upload, exist_ok=True)
        default_upload = account_upload_folder('default')
        move_children(default_upload, target_upload)
        for folder_name in [
            FOLDER_POSTS_SCHEDULED,
            FOLDER_POSTS_UNSCHEDULED,
            FOLDER_PROFILE_SCHEDULED,
            FOLDER_PROFILE_UNSCHEDULED,
            FOLDER_PROFILE_EPHEMERAL,
            FOLDER_PROFILE_LEGACY_UNSCHEDULED
        ]:
            move_children(os.path.join(UPLOAD_FOLDER, folder_name), os.path.join(target_upload, folder_name))
    else:
        old_dir = account_dir(current_slug)
        new_dir = account_dir(target_slug)
        if os.path.isdir(old_dir):
            shutil.move(old_dir, new_dir)
        else:
            os.makedirs(new_dir, exist_ok=True)
        save_json(os.path.join(new_dir, 'database.json'), db)
        save_json(os.path.join(new_dir, 'safety.json'), safety)

        old_upload = account_upload_folder(current_slug)
        new_upload = account_upload_folder(target_slug)
        if os.path.isdir(old_upload):
            shutil.move(old_upload, new_upload)
        else:
            os.makedirs(new_upload, exist_ok=True)

    save_json(ACTIVE_ACCOUNT_FILE, {"active": target_slug})
    return target_slug, db, safety

def list_accounts():
    accounts = []
    default_db = load_json(DATA_FILE)
    accounts.append({
        "id": "default",
        "name": default_db.get("profile", {}).get("name", "Default"),
        "active": get_active_account() == "default"
    })

    for name in sorted(os.listdir(ACCOUNTS_FOLDER)):
        folder = account_dir(name)
        if not os.path.isdir(folder) or not is_safe_account(name):
            continue
        db = load_json(os.path.join(folder, 'database.json'))
        accounts.append({
            "id": name,
            "name": db.get("profile", {}).get("name", name),
            "active": get_active_account() == name
        })
    return accounts

def account_count():
    return len(list_accounts())

def archive_account_payload(slug):
    os.makedirs(ARCHIVE_FOLDER, exist_ok=True)
    archive_path = os.path.join(ARCHIVE_FOLDER, f"deleted_account_{slug}_{int(time.time())}.zip")
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as z:
        db_path = account_data_file(slug)
        safety_path = account_safety_file(slug)
        if os.path.exists(db_path):
            z.write(db_path, f'{slug}/database.json')
        if os.path.exists(safety_path):
            z.write(safety_path, f'{slug}/safety.json')
        upload_folder = account_upload_folder(slug)
        if os.path.isdir(upload_folder):
            for root, _, files in os.walk(upload_folder):
                for file in files:
                    path = os.path.join(root, file)
                    arcname = os.path.join(slug, 'uploads', os.path.relpath(path, upload_folder))
                    z.write(path, arcname)
    return archive_path

def empty_safety_payload():
    return {
        "banned_hashtags": [],
        "hashtag_folders": {"Général": []},
        "sensitive_words": [],
        "snippets": {},
        "ai_prompts": []
    }

def is_safe_child(parent, child):
    parent = os.path.abspath(parent)
    child = os.path.abspath(child)
    try:
        return os.path.commonpath([parent, child]) == parent
    except ValueError:
        return False

def save_data_url(src, folder_path):
    if not isinstance(src, str) or not src.startswith('data:image/'):
        return None

    header, sep, payload = src.partition(',')
    if sep != ',' or ';base64' not in header:
        return None

    image_type = header.split(';', 1)[0].split('/', 1)[-1].lower()
    extensions = {'jpeg': '.jpg', 'jpg': '.jpg', 'png': '.png', 'webp': '.webp'}
    ext = extensions.get(image_type)
    if not ext:
        return None

    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        return None

    filename = f"crop_{uuid.uuid4()}{ext}"
    file_path = os.path.join(folder_path, filename)
    with open(file_path, 'wb') as f:
        f.write(raw)

    return filename

def persist_data_url_field(item, field, folder_path, url_prefix, prefix):
    saved = save_data_url(item.get(field, ''), folder_path)
    if saved:
        filename = f"{prefix}_{saved}"
        original = os.path.join(folder_path, saved)
        renamed = os.path.join(folder_path, filename)
        os.replace(original, renamed)
        item[field] = f"{url_prefix}/{filename}"
    return item

def convert_gif_to_mp4(gif_path, mp4_path):
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        return False, 'ffmpeg not found'

    cmd = [
        ffmpeg,
        '-y',
        '-i', gif_path,
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=ceil(iw/2)*2:ceil(ih/2)*2',
        mp4_path
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        return False, e.stderr.decode('utf-8', errors='ignore')[-500:]

    return os.path.exists(mp4_path), ''

def media_item_from_saved_file(item, file_path, url_prefix):
    filename = os.path.basename(file_path)
    ext = os.path.splitext(filename)[1].lower()
    src = f"{url_prefix}/{filename}"

    if ext == '.gif':
        mp4_filename = f"{os.path.splitext(filename)[0]}.mp4"
        mp4_path = os.path.join(os.path.dirname(file_path), mp4_filename)
        converted, error = convert_gif_to_mp4(file_path, mp4_path)
        if converted:
            return {
                **item,
                "src": f"{url_prefix}/{mp4_filename}",
                "filename": mp4_filename,
                "type": "video",
                "original_gif": src,
                "gif_mp4_generated": True
            }

        return {
            **item,
            "src": src,
            "filename": filename,
            "type": "image",
            "gif_mp4_generated": False,
            "gif_mp4_error": error
        }

    media_type = 'video' if ext in ['.mp4', '.mov'] else 'image'
    return {**item, "src": src, "filename": filename, "type": media_type}

def find_existing_post_folder(upload_folder, post_id, existing_post=None):
    """Cherche un dossier de post déjà existant sur disque.
    Tolère les médias dans l'ancien chemin (avant la migration sous-dossier compte)
    via account_upload_folders_all(active_account)."""
    active_account = get_active_account()
    allowed_roots = account_upload_folders_all(active_account)
    candidates = []
    for media in (existing_post or {}).get('media', []):
        src = media.get('src', '')
        if isinstance(src, str) and src.startswith('/static/uploads/'):
            resolved, _ = resolve_media_src_to_path(src, active_account)
            if resolved:
                media_dir = os.path.dirname(resolved)
                if is_safe_child_any(allowed_roots, media_dir):
                    candidates.append(media_dir)

    id_prefix = str(post_id or '')[:8]
    if id_prefix:
        for root_folder in allowed_roots:
            if not os.path.isdir(root_folder):
                continue
            for root, dirs, _ in os.walk(root_folder):
                for name in dirs:
                    if name.startswith('Post_') and name.endswith(f"_{id_prefix}"):
                        folder = os.path.join(root, name)
                        if is_safe_child_any(allowed_roots, folder):
                            candidates.append(folder)

    for folder in candidates:
        if os.path.isdir(folder):
            return os.path.abspath(folder)
    return None

def move_or_merge_folder(source, target):
    source = os.path.abspath(source)
    target = os.path.abspath(target)
    if source == target or not os.path.isdir(source):
        return
    os.makedirs(os.path.dirname(target), exist_ok=True)
    if not os.path.exists(target):
        shutil.move(source, target)
        return
    for name in os.listdir(source):
        src = os.path.join(source, name)
        dst = os.path.join(target, name)
        if os.path.exists(dst):
            base, ext = os.path.splitext(name)
            dst = os.path.join(target, f"{base}_{uuid.uuid4().hex[:6]}{ext}")
        shutil.move(src, dst)
    shutil.rmtree(source, ignore_errors=True)

def prefix_post_media_order(media_list, post_folder_path, url_prefix):
    updated = []
    for index, media in enumerate(media_list, start=1):
        src = media.get('src', '')
        filename = os.path.basename(src)
        path = os.path.join(post_folder_path, filename)
        if not filename or not os.path.exists(path) or not is_safe_child(post_folder_path, path):
            updated.append(media)
            continue
        clean_name = filename
        if len(clean_name) > 3 and clean_name[:2].isdigit() and clean_name[2] == '-':
            clean_name = clean_name[3:]
        ordered_name = f"{index:02d}-{clean_name}"
        ordered_path = os.path.join(post_folder_path, ordered_name)
        if os.path.abspath(path) != os.path.abspath(ordered_path):
            if os.path.exists(ordered_path):
                base, ext = os.path.splitext(ordered_name)
                ordered_name = f"{base}_{uuid.uuid4().hex[:6]}{ext}"
                ordered_path = os.path.join(post_folder_path, ordered_name)
            os.replace(path, ordered_path)
        updated.append({
            **media,
            "src": f"{url_prefix}/{ordered_name}",
            "filename": ordered_name
        })
    return updated

@app.route('/')
def index(): return render_template('index.html', v=time.time())

@app.route('/api/data', methods=['GET'])
def get_data():
    # SÉCURITÉ ANTI-CRASH : On garantit la structure minimale
    active_account = get_active_account()
    ensure_account_files(active_account)
    db = load_json(account_data_file(active_account))
    safety = load_json(account_safety_file(active_account))
    
    if 'grid' not in db: db['grid'] = []
    if 'profile' not in db: db['profile'] = {"name": "user"}
    if 'sensitive_words' not in safety: safety['sensitive_words'] = []
    if 'snippets' not in safety: safety['snippets'] = {}
    
    return jsonify({"db": db, "safety": safety, "active_account": active_account, "accounts": list_accounts()})

@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    return jsonify({"active": get_active_account(), "accounts": list_accounts()})

@app.route('/api/accounts', methods=['POST'])
def create_account():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'missing name'}), 400

    base_slug = slugify_account(name)
    slug = base_slug
    counter = 2
    while slug != 'default' and os.path.exists(account_dir(slug)):
        slug = f"{base_slug}-{counter}"
        counter += 1

    if slug == 'default':
        return jsonify({'error': 'reserved account name'}), 400

    ensure_account_files(slug, name)
    save_json(ACTIVE_ACCOUNT_FILE, {"active": slug})
    return jsonify({"status": "created", "active": slug, "accounts": list_accounts()})

@app.route('/api/accounts/active', methods=['POST'])
def switch_account():
    data = request.json or {}
    slug = data.get('id', 'default')
    if slug != 'default' and (not is_safe_account(slug) or not os.path.exists(account_dir(slug))):
        return jsonify({'error': 'account not found'}), 404

    ensure_account_files(slug)
    save_json(ACTIVE_ACCOUNT_FILE, {"active": slug})
    return jsonify({"status": "switched", "active": slug, "accounts": list_accounts()})

@app.route('/api/accounts/<slug>', methods=['DELETE'])
def delete_account(slug):
    if not is_safe_account(slug):
        return jsonify({"error": "invalid account"}), 400
    if slug != 'default' and not os.path.isdir(account_dir(slug)):
        return jsonify({"error": "account not found"}), 404

    active = get_active_account()
    archive_path = archive_account_payload(slug)

    if slug == 'default':
        save_json(DATA_FILE, {"profile": {"name": "default"}, "grid": []})
        save_json(SAFETY_FILE, empty_safety_payload())
        default_upload = account_upload_folder('default')
        if os.path.isdir(default_upload):
            shutil.rmtree(default_upload)
    else:
        folder = account_dir(slug)
        uploads = account_upload_folder(slug)
        if os.path.isdir(folder):
            shutil.rmtree(folder)
        if os.path.isdir(uploads):
            shutil.rmtree(uploads)

    remaining = [account for account in list_accounts() if account["id"] != slug]
    next_active = remaining[0]["id"] if remaining else "default"
    if active == slug:
        save_json(ACTIVE_ACCOUNT_FILE, {"active": next_active})

    return jsonify({
        "status": "deleted",
        "active": get_active_account(),
        "accounts": list_accounts(),
        "archive": os.path.basename(archive_path)
    })

@app.route('/api/languages', methods=['GET'])
def get_languages():
    languages = []
    folders = [LANG_FOLDER]
    if os.path.isdir(LEGACY_LANG_FOLDER):
        folders.append(LEGACY_LANG_FOLDER)

    seen = set()
    for folder in folders:
      for filename in sorted(os.listdir(folder)):
        if not filename.endswith('.json'):
            continue

        code = os.path.splitext(filename)[0]
        if code in seen:
            continue
        seen.add(code)
        payload = load_json(os.path.join(folder, filename))
        languages.append({
            "code": code,
            "name": payload.get("_meta", {}).get("name", code.upper())
        })

    return jsonify(languages)

@app.route('/api/language/<code>', methods=['GET'])
def get_language(code):
    safe_code = os.path.basename(code).replace('.json', '')
    paths = [os.path.join(LANG_FOLDER, f"{safe_code}.json")]
    if os.path.isdir(LEGACY_LANG_FOLDER):
        paths.append(os.path.join(LEGACY_LANG_FOLDER, f"{safe_code}.json"))

    path = next((p for p in paths if os.path.exists(p) and (is_safe_child(LANG_FOLDER, p) or is_safe_child(LEGACY_LANG_FOLDER, p))), None)
    if not path:
        return jsonify({'error': 'language not found'}), 404

    return jsonify(load_json(path))

@app.route('/api/import_language', methods=['POST'])
def import_language():
    if 'file' not in request.files:
        return jsonify({'error': 'missing file'}), 400

    file = request.files['file']
    if not file.filename.lower().endswith('.json'):
        return jsonify({'error': 'json only'}), 400

    try:
        payload = json.load(file.stream)
    except Exception:
        return jsonify({'error': 'invalid json'}), 400

    raw_code = request.form.get('code') or os.path.splitext(file.filename)[0]
    code = slugify_account(raw_code)
    if not code:
        return jsonify({'error': 'invalid code'}), 400

    path = os.path.join(LANG_FOLDER, f"{code}.json")
    if not is_safe_child(LANG_FOLDER, path):
        return jsonify({'error': 'invalid path'}), 400

    if '_meta' not in payload:
        payload['_meta'] = {"name": code.upper()}

    save_json(path, payload)
    return jsonify({"status": "imported", "code": code, "name": payload.get("_meta", {}).get("name", code.upper())})

def build_ai_prompt(text, instruction):
    base = (
        "Tu es un assistant de rédaction Instagram. "
        "Réponds uniquement avec le texte final proposé, sans markdown, sans explication. "
        "Respecte la langue du texte utilisateur, son intention, et garde un ton naturel."
    )
    if instruction:
        base += f"\nInstruction utilisateur: {instruction}"
    base += f"\n\nTexte à travailler:\n{text or ''}"
    return base

def build_ai_task_prompt(task, payload):
    if task == 'variants':
        count = int(payload.get('count') or 3)
        return (
            "Tu es un assistant de rédaction Instagram. "
            f"Propose {count} variantes de légende différentes pour le même post. "
            "Réponds uniquement en JSON valide sous la forme {\"variants\":[\"...\"]}. "
            "Chaque variante doit être directement publiable, sans explication.\n\n"
            f"Légende actuelle:\n{payload.get('caption', '')}\n\n"
            f"Instruction optionnelle:\n{payload.get('instruction', '')}"
        )
    if task == 'note_summary':
        return (
            "Tu résumes un post Instagram pour un encart rédactionnel interne. "
            "Réponds uniquement en JSON valide sous la forme "
            "{\"title\":\"titre court\",\"comment\":\"note directe\"}. "
            "Va droit au fait. N'écris jamais de formule comme \"Ce post Instagram met...\", "
            "\"Ce contenu parle de...\" ou \"Dans ce post...\". "
            "Le titre doit faire 3 à 7 mots. Le commentaire doit être une note interne concrète, "
            "en une phrase courte, avec sujet + angle + action à retenir.\n\n"
            f"Encart actuel:\nTitre: {payload.get('planner_title', '')}\nCommentaire: {payload.get('planner_comment', '')}\n\n"
            f"Légende du post:\n{payload.get('caption', '')}"
        )
    if task == 'hashtags':
        return (
            "Tu suggères des hashtags Instagram pertinents. "
            "Priorité aux hashtags déjà présents dans les dossiers existants quand ils correspondent au contenu. "
            "Tu peux compléter avec quelques nouveaux hashtags utiles si les dossiers ne suffisent pas. "
            "Réponds uniquement en JSON valide sous la forme {\"hashtags\":[\"#tag\"]}. "
            "Donne 10 à 20 hashtags, sans doublons, tous commençant par #.\n\n"
            f"Légende:\n{payload.get('caption', '')}\n\n"
            f"Hashtags déjà disponibles:\n{json.dumps(payload.get('hashtag_folders', {}), ensure_ascii=False)}"
        )
    if task == 'ideas':
        return (
            "Tu es un stratège éditorial Instagram. "
            "Propose des idées de posts à partir des notes, campagnes et contenus existants. "
            "Réponds uniquement en JSON valide sous la forme "
            "{\"ideas\":[{\"title\":\"...\",\"comment\":\"...\",\"caption\":\"...\"}]}. "
            "Fais des idées concrètes, variées et actionnables.\n\n"
            f"Contexte:\n{payload.get('context', '')}"
        )
    if task == 'redundancy':
        return (
            "Tu analyses un planning Instagram pour détecter les posts trop redondants. "
            "Réponds uniquement en JSON valide sous la forme "
            "{\"findings\":[{\"posts\":[\"id1\",\"id2\"],\"reason\":\"...\",\"suggestion\":\"...\"}]}. "
            "Signale seulement les ressemblances réellement utiles à corriger.\n\n"
            f"Posts:\n{json.dumps(payload.get('posts', []), ensure_ascii=False)}"
        )
    return build_ai_prompt(payload.get('text', ''), payload.get('instruction', ''))

def extract_json_object(text):
    text = (text or '').strip()
    if text.startswith('```'):
        text = text.strip('`')
        if text.lower().startswith('json'):
            text = text[4:].strip()
    start = text.find('{')
    end = text.rfind('}')
    if start >= 0 and end >= start:
        text = text[start:end + 1]
    return json.loads(text)

def call_configured_ai(settings, prompt):
    provider = resolve_ai_provider(settings)
    if provider == 'ollama':
        return call_ollama(settings, prompt)
    if provider == 'claude':
        return call_claude(settings, prompt)
    if provider == 'gemini':
        return call_gemini(settings, prompt)
    return call_openai_compatible(settings, prompt)

def get_ai_settings(extra=None):
    safety = load_json(account_safety_file(get_active_account()))
    return {**safety.get('ai_settings', {}), **(extra or {})}

def resolve_ai_provider(settings):
    provider = (settings.get('provider') or 'ollama').strip().lower()
    base_url = (settings.get('base_url') or '').lower()
    if provider == 'ollama' and (':1234' in base_url or '/v1' in base_url or 'lmstudio' in base_url):
        return 'lmstudio'
    return provider

def normalize_openai_base_url(provider, base_url):
    cleaned = (base_url or '').rstrip('/')
    for suffix in ('/chat/completions', '/models'):
        if cleaned.endswith(suffix):
            cleaned = cleaned[:-len(suffix)]
    if provider in ('openai', 'deepseek', 'lmstudio') and not cleaned.endswith('/v1'):
        return f"{cleaned}/v1"
    return cleaned

def choose_openai_compatible_model(provider, settings, base_url, headers):
    explicit = (settings.get('model') or '').strip()
    if explicit:
        return explicit
    if provider == 'lmstudio':
        try:
            models = get_json(f"{base_url}/models", headers=headers)
            data = models.get('data', []) if isinstance(models, dict) else []
            first = next((item.get('id') for item in data if isinstance(item, dict) and item.get('id')), '')
            if first:
                return first
        except Exception:
            return 'local-model'
        return 'local-model'
    if provider == 'deepseek':
        return 'deepseek-chat'
    return 'gpt-4o-mini'

def call_openai_compatible(settings, prompt):
    provider = resolve_ai_provider(settings)
    defaults = {
        'openai': 'https://api.openai.com/v1',
        'deepseek': 'https://api.deepseek.com/v1',
        'lmstudio': 'http://127.0.0.1:1234/v1'
    }
    base_url = normalize_openai_base_url(provider, settings.get('base_url') or defaults.get(provider, defaults['openai']))
    headers = {}
    api_key = settings.get('api_key', '').strip()
    if api_key:
        headers['Authorization'] = f"Bearer {api_key}"
    model = choose_openai_compatible_model(provider, settings, base_url, headers)

    response = post_json(f"{base_url}/chat/completions", {
        "model": model,
        "messages": [
            {"role": "system", "content": "You return only the rewritten text."},
            {"role": "user", "content": prompt}
        ],
        "temperature": float(settings.get('temperature') or 0.7)
    }, headers=headers)
    content = response.get('choices', [{}])[0].get('message', {}).get('content', '').strip()
    if content:
        return content
    if response.get('error'):
        raise ValueError(str(response.get('error')))
    raise ValueError(f"empty {provider} response from {base_url}/chat/completions")

def call_ollama(settings, prompt):
    base_url = (settings.get('base_url') or 'http://127.0.0.1:11434').rstrip('/')
    model = settings.get('model') or 'llama3.1'
    response = post_json(f"{base_url}/api/chat", {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    })
    content = response.get('message', {}).get('content', '').strip()
    if content:
        return content
    if response.get('error'):
        raise ValueError(str(response.get('error')))
    raise ValueError(f"empty ollama response from {base_url}/api/chat")

def call_claude(settings, prompt):
    api_key = settings.get('api_key', '').strip()
    if not api_key:
        raise ValueError('missing api key')
    model = settings.get('model') or 'claude-3-5-sonnet-latest'
    response = post_json('https://api.anthropic.com/v1/messages', {
        "model": model,
        "max_tokens": 1800,
        "messages": [{"role": "user", "content": prompt}]
    }, headers={
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01"
    })
    parts = response.get('content', [])
    return ''.join(part.get('text', '') for part in parts if part.get('type') == 'text').strip()

def call_gemini(settings, prompt):
    api_key = settings.get('api_key', '').strip()
    if not api_key:
        raise ValueError('missing api key')
    model = settings.get('model') or 'gemini-1.5-flash'
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    response = post_json(url, {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": float(settings.get('temperature') or 0.7)}
    })
    candidates = response.get('candidates', [])
    parts = candidates[0].get('content', {}).get('parts', []) if candidates else []
    return ''.join(part.get('text', '') for part in parts).strip()

@app.route('/api/ai/rewrite', methods=['POST'])
def ai_rewrite():
    data = request.json or {}
    text = data.get('text', '')
    instruction = data.get('instruction', '')
    settings = get_ai_settings(data.get('settings', {}))
    prompt = build_ai_prompt(text, instruction)

    try:
        after = call_configured_ai(settings, prompt)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as e:
        return jsonify({'error': str(e)}), 502
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    if not after:
        return jsonify({'error': 'empty ai response'}), 502
    return jsonify({'before': text, 'after': after})

@app.route('/api/ai/task', methods=['POST'])
def ai_task():
    data = request.json or {}
    task = data.get('task', '')
    payload = data.get('payload', {})
    settings = get_ai_settings(data.get('settings', {}))
    prompt = build_ai_task_prompt(task, payload)

    try:
        raw = call_configured_ai(settings, prompt)
        parsed = extract_json_object(raw)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as e:
        return jsonify({'error': str(e)}), 502
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    return jsonify(parsed)

@app.route('/api/upload', methods=['POST'])
def upload():
    if 'file' not in request.files: return jsonify([]), 400
    active_account = get_active_account()
    upload_folder = account_upload_folder(active_account)
    upload_prefix = account_upload_url_prefix(active_account)
    category = request.form.get('category', '')
    subfolder = upload_category_folder(category)
    target_folder = os.path.join(upload_folder, subfolder) if subfolder else upload_folder
    target_prefix = f"{upload_prefix}/{subfolder}" if subfolder else upload_prefix
    os.makedirs(target_folder, exist_ok=True)
    files = request.files.getlist('file')
    items = []
    for file in files:
        if not file.filename: continue
        ext = os.path.splitext(file.filename)[1].lower()
        uid = f"temp_{uuid.uuid4()}{ext}"
        path = os.path.join(target_folder, uid)
        file.save(path)
        media_type = 'gif' if ext == '.gif' else ('video' if ext in ['.mp4','.mov'] else 'image')
        items.append({"src": f"{target_prefix}/{uid}", "filename": uid, "type": media_type})
    return jsonify(items)

@app.route('/api/save_post_structure', methods=['POST'])
def save_post_structure():
    data = request.json
    if not data or 'post' not in data:
        return jsonify({'error': 'missing post'}), 400

    post = data['post']
    if not post.get('id'):
        post['id'] = str(uuid.uuid4())
    post.setdefault('media', [])

    active_account = get_active_account()
    ensure_account_files(active_account)
    upload_folder = account_upload_folder(active_account)
    upload_prefix = account_upload_url_prefix(active_account)

    db = load_json(account_data_file(active_account))
    if 'grid' not in db: db['grid'] = []

    existing_post = next((p for p in db.get('grid', []) if p.get('id') == post.get('id')), None)
    date_str = post.get('publish_date') or datetime.now().strftime("%Y-%m-%d")
    post_subfolder = upload_category_folder('post', post)
    post_root_folder = os.path.join(upload_folder, post_subfolder)
    post_root_prefix = f"{upload_prefix}/{post_subfolder}"
    os.makedirs(post_root_folder, exist_ok=True)
    folder_name = f"Post_{date_str}_{post['id'][:8]}"
    post_folder_path = os.path.join(post_root_folder, folder_name)
    existing_folder = find_existing_post_folder(upload_folder, post.get('id'), existing_post)
    allowed_roots = account_upload_folders_all(active_account)
    if existing_folder and is_safe_child_any(allowed_roots, existing_folder) and is_safe_child_any(allowed_roots, post_folder_path):
        move_or_merge_folder(existing_folder, post_folder_path)
    os.makedirs(post_folder_path, exist_ok=True)

    new_media_list = []
    for m in post['media']:
        m = persist_data_url_field(m, 'thumbnail', post_folder_path, f"{post_root_prefix}/{folder_name}", 'thumb')
        src = m.get('src', '')
        saved_data_url = save_data_url(src, post_folder_path)
        if saved_data_url:
            new_media_list.append({
                **m,
                "src": f"{post_root_prefix}/{folder_name}/{saved_data_url}",
                "filename": saved_data_url,
                "type": "image"
            })
            continue

        old_filename = os.path.basename(src)
        # On essaie d'abord la résolution exacte de l'URL (gère legacy + nouveau).
        resolved_path, _ = resolve_media_src_to_path(src, active_account)
        old_path = resolved_path if resolved_path else os.path.join(upload_folder, old_filename)
        if not resolved_path and not os.path.exists(old_path):
            # Recherche relative aux deux racines connues, au cas où l'URL ne contiendrait
            # pas le préfixe complet.
            for root in allowed_roots:
                candidate = os.path.join(root, old_filename)
                if os.path.exists(candidate) and is_safe_child(root, candidate):
                    old_path = candidate
                    break
        new_path = os.path.join(post_folder_path, old_filename.replace('temp_', ''))

        if old_filename and os.path.exists(old_path) and is_safe_child_any(allowed_roots, old_path):
            shutil.move(old_path, new_path)
            new_media_list.append(media_item_from_saved_file(m, new_path, f"{post_root_prefix}/{folder_name}"))
        elif old_filename and os.path.exists(new_path) and is_safe_child(post_folder_path, new_path):
            new_media_list.append(media_item_from_saved_file(m, new_path, f"{post_root_prefix}/{folder_name}"))
        elif old_filename and os.path.exists(os.path.join(post_folder_path, old_filename)) and is_safe_child(post_folder_path, os.path.join(post_folder_path, old_filename)):
            new_media_list.append(media_item_from_saved_file(m, os.path.join(post_folder_path, old_filename), f"{post_root_prefix}/{folder_name}"))
        else:
            new_media_list.append(m)

    post['media'] = prefix_post_media_order(new_media_list, post_folder_path, f"{post_root_prefix}/{folder_name}")

    info_path = os.path.join(post_folder_path, "infos.txt")
    with open(info_path, 'w', encoding='utf-8') as f:
        f.write(f"CAPTION:\n{post.get('caption', '')}\n\n")
        f.write(f"TAGS:\n{post.get('tags', '')}\n\n")
        f.write(f"IDENTIFICATIONS (@):\n{post.get('tags', '')}\n\n")
        f.write(f"COMMENT:\n{post.get('first_comment', '')}\n\n")
        f.write(f"DATE:\n{post.get('publish_date', '')}\n")

    idx = next((i for i, p in enumerate(db['grid']) if p['id'] == post['id']), -1)
    if idx >= 0:
        db['grid'][idx] = post
    else:
        db['grid'].insert(0, post)
    
    save_json(account_data_file(active_account), db)
    return jsonify({'status': 'ok', 'post': post})

@app.route('/api/save_settings', methods=['POST'])
def save_settings():
    data = request.json
    active_account = get_active_account()
    ensure_account_files(active_account)
    db = load_json(account_data_file(active_account))
    safety = load_json(account_safety_file(active_account))
    if 'profile' in data:
        db['profile'] = data['profile']
    if 'safety' in data:
        safety = data['safety']

    requested_name = (db.get('profile') or {}).get('name', '')
    target_slug = unique_account_slug(slugify_account(requested_name), active_account) if requested_name else active_account
    if requested_name and target_slug != active_account:
        active_account, db, safety = migrate_account_slug(active_account, target_slug, db, safety)

    save_json(account_data_file(active_account), db)
    save_json(account_safety_file(active_account), safety)
    return jsonify({'status': 'ok', 'active': active_account, 'accounts': list_accounts(), 'db': db, 'safety': safety})

@app.route('/api/save_order', methods=['POST'])
def save_order():
    data = request.json
    active_account = get_active_account()
    ensure_account_files(active_account)
    db = load_json(account_data_file(active_account))
    if 'grid' in data: db['grid'] = data['grid']
    save_json(account_data_file(active_account), db)
    return jsonify({'status': 'ok'})

@app.route('/api/open_folder', methods=['POST'])
def open_folder():
    path = account_upload_folder(get_active_account())
    os.makedirs(path, exist_ok=True)
    try:
        if platform.system() == "Windows": os.startfile(path)
        elif platform.system() == "Darwin": subprocess.Popen(["open", path])
        else: subprocess.Popen(["xdg-open", path])
        return jsonify({'status': 'opened'})
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/export_zip', methods=['GET'])
def export_zip():
    active_account = get_active_account()
    ensure_account_files(active_account)
    upload_folder = account_upload_folder(active_account)
    os.makedirs(upload_folder, exist_ok=True)
    archive_path = os.path.join(ARCHIVE_FOLDER, f"backup_{active_account}_{int(time.time())}.zip")
    other_account_dirs = {a['id'] for a in list_accounts() if a['id'] != 'default'} if active_account == 'default' else set()
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(account_data_file(active_account), 'data/database.json')
        z.write(account_safety_file(active_account), 'data/safety.json')
        # Médias dans le dossier compte (nouveau chemin uploads/<slug>/...)
        for root, _, files in os.walk(upload_folder):
            for filename in files:
                path = os.path.join(root, filename)
                z.write(path, os.path.join('uploads', os.path.relpath(path, upload_folder)))
        # Pour 'default' uniquement : inclure aussi les anciens médias laissés
        # à plat sous static/uploads (avant la migration sous-dossier).
        # On exclut soigneusement les sous-dossiers des autres comptes.
        if active_account == 'default':
            legacy_root = UPLOAD_FOLDER
            try:
                top_entries = os.listdir(legacy_root)
            except OSError:
                top_entries = []
            for entry in top_entries:
                if entry == 'default' or entry in other_account_dirs:
                    continue
                entry_path = os.path.join(legacy_root, entry)
                if os.path.isdir(entry_path):
                    for root, _, files in os.walk(entry_path):
                        for filename in files:
                            path = os.path.join(root, filename)
                            z.write(path, os.path.join('uploads', os.path.relpath(path, legacy_root)))
                elif os.path.isfile(entry_path):
                    z.write(entry_path, os.path.join('uploads', entry))
    return send_file(archive_path, as_attachment=True)

@app.route('/api/import_backup', methods=['POST'])
def import_backup():
    if 'file' not in request.files:
        return jsonify({'error': 'missing file'}), 400

    file = request.files['file']
    if not file.filename.lower().endswith('.zip'):
        return jsonify({'error': 'zip only'}), 400

    active_account = get_active_account()
    ensure_account_files(active_account)
    upload_folder = account_upload_folder(active_account)
    os.makedirs(upload_folder, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        backup_path = os.path.join(tmp, 'backup.zip')
        file.save(backup_path)
        try:
            with zipfile.ZipFile(backup_path, 'r') as z:
                for member in z.namelist():
                    normalized = member.replace('\\', '/')
                    if normalized.startswith('/') or '..' in normalized.split('/'):
                        return jsonify({'error': 'unsafe backup'}), 400
                z.extractall(tmp)
        except zipfile.BadZipFile:
            return jsonify({'error': 'invalid zip'}), 400

        db_src = os.path.join(tmp, 'data', 'database.json')
        safety_src = os.path.join(tmp, 'data', 'safety.json')
        uploads_src = os.path.join(tmp, 'uploads')

        if os.path.exists(db_src):
            save_json(account_data_file(active_account), load_json(db_src))
        if os.path.exists(safety_src):
            save_json(account_safety_file(active_account), load_json(safety_src))
        if os.path.isdir(uploads_src):
            other_account_dirs = {a['id'] for a in list_accounts() if a['id'] != 'default'} if active_account == 'default' else set()
            for name in os.listdir(upload_folder):
                if name in other_account_dirs:
                    continue
                path = os.path.join(upload_folder, name)
                if os.path.isdir(path):
                    shutil.rmtree(path, ignore_errors=True)
                else:
                    os.remove(path)
            for name in os.listdir(uploads_src):
                shutil.move(os.path.join(uploads_src, name), os.path.join(upload_folder, name))

    return jsonify({'status': 'imported'})

@app.route('/api/duplicate_post', methods=['POST'])
def duplicate_post():
    data = request.json
    post_id = data.get('id')
    smart = bool(data.get('smart'))
    caption_override = data.get('caption_override')
    active_account = get_active_account()
    ensure_account_files(active_account)
    db = load_json(account_data_file(active_account))
    if 'grid' not in db: db['grid'] = []
    
    target = next((item for item in db['grid'] if item['id'] == post_id), None)
    if target:
        clone = copy.deepcopy(target)
        clone['id'] = str(uuid.uuid4())
        clone['status'] = 'draft'
        if isinstance(caption_override, str):
            clone['caption'] = caption_override
            clone['smart_duplicate'] = True
        if not isinstance(caption_override, str) and smart and clone.get('caption'):
            settings = get_ai_settings()
            prompt = build_ai_task_prompt('variants', {
                'caption': clone.get('caption', ''),
                'instruction': 'Crée une seule variante distincte pour une duplication intelligente.',
                'count': 1
            })
            try:
                parsed = extract_json_object(call_configured_ai(settings, prompt))
                variants = parsed.get('variants', [])
                if variants:
                    clone['caption'] = variants[0]
                    clone['smart_duplicate'] = True
            except Exception:
                clone['smart_duplicate_error'] = True
        db['grid'].insert(0, clone)
        save_json(account_data_file(active_account), db)
        return jsonify(clone)
    return jsonify({'error': 'not found'}), 404

@app.route('/api/delete_post', methods=['POST'])
def delete_post():
    data = request.json or {}
    post_id = data.get('id')
    if not post_id:
        return jsonify({'error': 'missing id'}), 400

    active_account = get_active_account()
    ensure_account_files(active_account)
    upload_folder = account_upload_folder(active_account)
    db = load_json(account_data_file(active_account))
    if 'grid' not in db:
        db['grid'] = []

    post = next((item for item in db['grid'] if item.get('id') == post_id), None)
    if not post:
        return jsonify({'error': 'not found'}), 404

    db['grid'] = [item for item in db['grid'] if item.get('id') != post_id]

    referenced_dirs = set()
    allowed_roots = account_upload_folders_all(active_account)
    for item in db['grid']:
        for media in item.get('media', []):
            src = media.get('src', '')
            if not isinstance(src, str) or not src.startswith('/static/uploads/'):
                continue
            resolved, _ = resolve_media_src_to_path(src, active_account)
            if not resolved:
                continue
            media_dir = os.path.dirname(resolved)
            if is_safe_child_any(allowed_roots, media_dir):
                referenced_dirs.add(os.path.abspath(media_dir))

    candidate_dirs = set()
    for media in post.get('media', []):
        src = media.get('src', '')
        if not isinstance(src, str) or not src.startswith('/static/uploads/'):
            continue
        resolved, _ = resolve_media_src_to_path(src, active_account)
        if not resolved:
            continue
        media_dir = os.path.dirname(resolved)
        if is_safe_child_any(allowed_roots, media_dir):
            candidate_dirs.add(os.path.abspath(media_dir))

    # Les Ghost Posts sans média ont quand même un dossier infos.txt créé à la sauvegarde.
    id_prefix = post_id[:8]
    if id_prefix:
        for root_folder in allowed_roots:
            if not os.path.isdir(root_folder):
                continue
            try:
                for name in os.listdir(root_folder):
                    folder_path = os.path.join(root_folder, name)
                    if os.path.isdir(folder_path) and name.startswith('Post_') and name.endswith(f"_{id_prefix}"):
                        candidate_dirs.add(os.path.abspath(folder_path))
                # Aussi un niveau plus bas sous "Posts - programmes" / "Posts - non programmes".
                for sub in (FOLDER_POSTS_SCHEDULED, FOLDER_POSTS_UNSCHEDULED):
                    sub_path = os.path.join(root_folder, sub)
                    if os.path.isdir(sub_path):
                        for name in os.listdir(sub_path):
                            folder_path = os.path.join(sub_path, name)
                            if os.path.isdir(folder_path) and name.startswith('Post_') and name.endswith(f"_{id_prefix}"):
                                candidate_dirs.add(os.path.abspath(folder_path))
            except OSError:
                continue

    for folder_path in candidate_dirs:
        if (
            folder_path not in (os.path.abspath(r) for r in allowed_roots)
            and folder_path not in referenced_dirs
            and is_safe_child_any(allowed_roots, folder_path)
        ):
            shutil.rmtree(folder_path, ignore_errors=True)

    save_json(account_data_file(active_account), db)
    return jsonify({'status': 'deleted'})

@app.route('/api/cleanup_profile_photo_dupes', methods=['POST'])
def cleanup_profile_photo_dupes():
    """Outil de réparation : détecte les fichiers de photos profil dupliqués
    entre les dossiers Drive-friendly (legacy 'Photo profils - nouvelles non
    programmees' + nouveaux 'Photo profils - non programmees' + 'Photo profils
    - programmees') et supprime les doublons.

    Stratégie :
      1) Liste tous les fichiers dans les 4 dossiers candidats (compte actif).
      2) Pour chaque fichier, calcule un hash de contenu (sha256).
      3) Pour chaque groupe de fichiers identiques :
         - Si une entrée de safety.profile_photo_plans pointe vers l'un d'eux,
           on conserve celui dans le dossier "programmees" ;
         - Sinon on conserve l'unique copie restante (la plus récente).
         - Toutes les autres copies sont supprimées.
      4) Met à jour safety.profile_photo_plans et safety.profile_photo_gallery
         pour pointer vers le fichier survivant.

    Body JSON optionnel :
      - dry_run : bool (par défaut True : ne supprime rien, retourne le rapport)
    Retour : rapport JSON {groups: [...], removed: [...], kept: [...]}.
    """
    import hashlib
    payload = request.json or {}
    dry_run = bool(payload.get('dry_run', True))

    active_account = get_active_account()
    ensure_account_files(active_account)
    upload_folder = account_upload_folder(active_account)
    upload_prefix = account_upload_url_prefix(active_account)
    legacy_folder = legacy_upload_folder(active_account)
    legacy_prefix = legacy_upload_url_prefix(active_account)

    # Dossiers candidats où peuvent vivre des photos profil.
    candidate_folders = []
    for base, prefix in [(upload_folder, upload_prefix), (legacy_folder, legacy_prefix)]:
        for sub in (FOLDER_PROFILE_SCHEDULED, FOLDER_PROFILE_UNSCHEDULED,
                    FOLDER_PROFILE_EPHEMERAL, FOLDER_PROFILE_LEGACY_UNSCHEDULED):
            full = os.path.join(base, sub)
            if os.path.isdir(full):
                candidate_folders.append((full, sub, prefix))

    # Index des fichiers par hash de contenu.
    by_hash = {}
    for folder, sub, url_prefix in candidate_folders:
        try:
            entries = os.listdir(folder)
        except OSError:
            continue
        for name in entries:
            path = os.path.join(folder, name)
            if not os.path.isfile(path):
                continue
            try:
                h = hashlib.sha256()
                with open(path, 'rb') as f:
                    for chunk in iter(lambda: f.read(65536), b''):
                        h.update(chunk)
                digest = h.hexdigest()
            except OSError:
                continue
            url = f"{url_prefix}/{sub}/{name}"
            by_hash.setdefault(digest, []).append({
                'path': path, 'name': name, 'folder': sub, 'url': url,
                'mtime': os.path.getmtime(path),
                'is_scheduled': sub == FOLDER_PROFILE_SCHEDULED,
            })

    safety_data = load_json(account_safety_file(active_account))
    plans = safety_data.get('profile_photo_plans') or []
    gallery = safety_data.get('profile_photo_gallery') or []

    groups_report = []
    kept_total = []
    removed_total = []
    url_remap = {}

    for digest, files in by_hash.items():
        if len(files) <= 1:
            continue
        # Choix du survivant : priorité au dossier "programmees" si un plan
        # pointe vers l'un d'eux, sinon le plus récent.
        plan_referenced = any(any(p.get('url') == f['url'] for p in plans) for f in files)
        if plan_referenced:
            survivors = sorted(files, key=lambda f: (not f['is_scheduled'], -f['mtime']))
        else:
            survivors = sorted(files, key=lambda f: -f['mtime'])
        keep = survivors[0]
        kept_total.append(keep['url'])
        for f in survivors[1:]:
            url_remap[f['url']] = keep['url']
            removed_total.append(f['url'])
        groups_report.append({
            'hash': digest[:12],
            'kept': keep['url'],
            'removed': [f['url'] for f in survivors[1:]]
        })

    if not dry_run:
        # Suppression physique.
        for digest, files in by_hash.items():
            if len(files) <= 1:
                continue
            survivors = files[:]
            kept_url = next((g['kept'] for g in groups_report if g['hash'] == digest[:12]), None)
            for f in survivors:
                if f['url'] == kept_url:
                    continue
                try:
                    os.remove(f['path'])
                except OSError:
                    pass

        # Remap des URLs dans safety.
        changed = False
        for plan in plans:
            if isinstance(plan, dict) and plan.get('url') in url_remap:
                plan['url'] = url_remap[plan['url']]
                changed = True
        for item in gallery:
            if isinstance(item, dict) and item.get('url') in url_remap:
                item['url'] = url_remap[item['url']]
                changed = True
        if changed:
            safety_data['profile_photo_plans'] = plans
            safety_data['profile_photo_gallery'] = gallery
            save_json(account_safety_file(active_account), safety_data)

    return jsonify({
        'dry_run': dry_run,
        'groups': groups_report,
        'kept': kept_total,
        'removed': removed_total,
        'url_remap': url_remap,
    })


@app.route('/api/move_profile_photo', methods=['POST'])
def move_profile_photo():
    """Déplace un fichier photo de profil entre les dossiers Drive-friendly.

    Body JSON :
      - src              : URL '/static/uploads/...' actuelle de la photo
      - target           : 'scheduled' | 'unscheduled' | 'ephemeral'
      - date  (optionnel): date 'YYYY-MM-DD' pour préfixer le nom de fichier
                           des photos programmées (programmees = vrai planning)
      - note  (optionnel): note utilisateur, slugifiée pour le suffixe

    Retourne {status:'ok', src: nouvelle_url}. Si introuvable ou hors compte
    actif, l'URL d'origine est renvoyée sans toucher au disque.
    """
    data = request.json or {}
    src = data.get('src') or ''
    target = data.get('target') or ''
    date = (data.get('date') or '').strip()
    note = (data.get('note') or '').strip()

    if not src or not isinstance(src, str) or not src.startswith('/static/uploads/'):
        return jsonify({'status': 'noop', 'src': src})

    if target not in ('scheduled', 'unscheduled', 'ephemeral'):
        return jsonify({'error': 'invalid target'}), 400

    active_account = get_active_account()
    ensure_account_files(active_account)
    upload_folder = account_upload_folder(active_account)
    upload_prefix = account_upload_url_prefix(active_account)
    os.makedirs(upload_folder, exist_ok=True)

    resolved, _ = resolve_media_src_to_path(src, active_account)
    if not resolved or not os.path.isfile(resolved):
        # Rien à déplacer (URL externe, déjà supprimé, etc.)
        return jsonify({'status': 'noop', 'src': src})

    if target == 'scheduled':
        target_subfolder = FOLDER_PROFILE_SCHEDULED
    elif target == 'ephemeral':
        target_subfolder = FOLDER_PROFILE_EPHEMERAL
    else:
        target_subfolder = FOLDER_PROFILE_UNSCHEDULED
    target_folder = os.path.join(upload_folder, target_subfolder)
    os.makedirs(target_folder, exist_ok=True)

    ext = os.path.splitext(resolved)[1].lower()
    base = os.path.splitext(os.path.basename(resolved))[0]
    # Stripping du préfixe 'temp_' pour propreté.
    if base.startswith('temp_'):
        base = base.replace('temp_', '', 1)

    # Préfixe par date pour les programmées et éphémères, pour aider à trier
    # par ordre chronologique sur Google Drive. Format YYYY-MM-DD.
    if target == 'scheduled' and date:
        note_slug = slugify_filename_piece(note, max_len=24)
        new_name = f"{date}__{note_slug}{ext}" if note_slug else f"{date}__{base[:16]}{ext}"
    elif target == 'ephemeral' and date:
        note_slug = slugify_filename_piece(note, max_len=24)
        new_name = f"{date}__ephemeral__{note_slug or base[:16]}{ext}"
    else:
        # Non programmée : on garde un nom court basé sur le nom courant.
        new_name = os.path.basename(resolved).replace('temp_', '', 1)

    new_path = os.path.join(target_folder, new_name)
    # Si le fichier cible existe déjà (cas où on re-programme à la même date),
    # on ajoute un suffixe court pour ne pas écraser.
    if os.path.abspath(new_path) != os.path.abspath(resolved) and os.path.exists(new_path):
        stem, suffix = os.path.splitext(new_name)
        new_path = os.path.join(target_folder, f"{stem}_{uuid.uuid4().hex[:6]}{suffix}")

    allowed_roots = account_upload_folders_all(active_account)
    if not is_safe_child_any(allowed_roots, new_path) or not is_safe_child_any(allowed_roots, resolved):
        return jsonify({'error': 'unsafe path'}), 400

    try:
        if os.path.abspath(new_path) != os.path.abspath(resolved):
            shutil.move(resolved, new_path)
    except (OSError, shutil.Error) as e:
        return jsonify({'error': str(e)}), 500

    # Garde-fou : sur certains filesystems, shutil.move peut laisser la source
    # en place dans des conditions d'erreur partielles. On garantit ici que
    # le fichier d'origine n'existe plus. Cela évite toute duplication entre
    # les dossiers Drive-friendly (par ex. "non programmees" qui resterait
    # peuplé alors que la photo est désormais dans "programmees").
    if os.path.abspath(new_path) != os.path.abspath(resolved) and os.path.exists(resolved):
        try:
            os.remove(resolved)
        except OSError:
            pass

    rel_new = os.path.relpath(new_path, upload_folder).replace(os.sep, '/')
    new_url = f"{upload_prefix}/{rel_new}"
    return jsonify({'status': 'ok', 'src': new_url, 'filename': os.path.basename(new_path)})


@app.route('/api/save_all', methods=['POST'])
def save_all():
    data = request.json
    active_account = get_active_account()
    ensure_account_files(active_account)
    db = load_json(account_data_file(active_account))
    
    # Mise à jour de la grille et du profil
    if 'db' in data:
        if 'grid' in data['db']: db['grid'] = data['db']['grid']
        if 'profile' in data['db']: db['profile'] = data['db']['profile']
        save_json(account_data_file(active_account), db)
        
    # Mise à jour sécurité (hashtags/censure)
    if 'safety' in data:
        save_json(account_safety_file(active_account), data['safety'])
        
    return jsonify({'status': 'saved'})

if __name__ == '__main__':
    print("Application lancée : http://127.0.0.1:5000")
    app.run(debug=True)
