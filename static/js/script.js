document.addEventListener('DOMContentLoaded', () => {
    function getLocalStorageItem(key, fallback = '') {
        try {
            return window.localStorage ? window.localStorage.getItem(key) : fallback;
        } catch (err) {
            return fallback;
        }
    }

    function setLocalStorageItem(key, value) {
        try {
            if (window.localStorage) window.localStorage.setItem(key, value);
        } catch (err) { /* noop */ }
    }

    // --- STATE ---
    let db = { grid: [], profile: {} };
    let safety = { banned_hashtags: [], sensitive_words: [], snippets: {}, hashtag_folders: {} };
    let currentPostId = null;
    let selectedMediaIndex = 0;
    let cropper = null;
    let currentFolder = null;
    let carouselSortable = null;
    let translations = {};
    let currentLanguage = getLocalStorageItem('instaLocalPlannerLanguage', 'fr') || 'fr';
    let accounts = [];
    let activeAccount = 'default';
    let isSortingGrid = false;
    let selectedNotePostId = null;
    let notesVisible = getLocalStorageItem('instaLocalPlannerNotesVisible', 'true') !== 'false';
    let pendingAiText = '';
    let globalSearchTerm = '';
    let selectedPostIds = new Set();
    let lastSelectedPostId = null;
    let activeCampaignFilter = '';
    let activeTagFilter = '';
    let planningView = 'month';
    let queueStatusFilter = '';
    let queueCampaignFilter = '';
    let queueTagFilter = '';
    let activeDateFilter = '';
    let activeMarkerDatePick = null;
    let planningMonthCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    let planningCollapsed = getLocalStorageItem('instaLocalPlannerPlanningCollapsed', 'false') === 'true';
    let planningFullscreen = getLocalStorageItem('instaLocalPlannerPlanningFullscreen', 'false') === 'true';
    let aiSettingsHydrated = false;

    // --- DOM ---
    const gridEl = document.getElementById('grid-container');
    const modal = document.getElementById('edit-modal');
    const thumbList = document.getElementById('carousel-thumbnails');
    window.togglePlanningCollapsed = togglePlanningCollapsed;
    window.togglePlanningFullscreen = togglePlanningFullscreen;
    
    // --- 1. INIT ---
    loadAll();
    initLanguages();
    
    function loadAll() {
        fetch('/api/data').then(r => r.json()).then(d => {
            db = d.db || { grid: [], profile: {} };
            safety = d.safety || { banned_hashtags: [], sensitive_words: [], snippets: {}, hashtag_folders: {} };
            accounts = d.accounts || [];
            activeAccount = d.active_account || 'default';
            initHashtagStructure();
            renderGrid();
            updateUI();
            renderAccounts();
            renderToolbarFilters();
            renderPlanningPanel();
            checkLocalReminders();
        }).catch(err => console.error("Erreur chargement:", err));
    }

    function defaultCalendarMarkers() {
        return [
            { name: 'Nouvel an', color: '#4ec9b0', start: '2026-01-01', end: '2026-01-01', notes: 'Jour férié' },
            { name: 'Soldes hiver', color: '#38bdf8', start: '2026-01-14', end: '2026-02-10', notes: 'Période commerciale' },
            { name: 'Chandeleur', color: '#f59e0b', start: '2026-02-02', end: '2026-02-02', notes: 'Repère éditorial' },
            { name: 'Saint-Valentin', color: '#f472b6', start: '2026-02-14', end: '2026-02-14', notes: 'Repère éditorial' },
            { name: 'Mardi gras', color: '#a78bfa', start: '2026-02-17', end: '2026-02-17', notes: 'Repère éditorial' },
            { name: 'Fête des grands-mères', color: '#f472b6', start: '2026-03-01', end: '2026-03-01', notes: 'Repère éditorial' },
            { name: 'Journée des droits des femmes', color: '#c084fc', start: '2026-03-08', end: '2026-03-08', notes: 'Repère éditorial' },
            { name: 'Printemps', color: '#22c55e', start: '2026-03-20', end: '2026-03-20', notes: 'Saison' },
            { name: 'Poisson d’avril', color: '#60a5fa', start: '2026-04-01', end: '2026-04-01', notes: 'Repère éditorial' },
            { name: 'Pâques', color: '#f5d36b', start: '2026-04-05', end: '2026-04-05', notes: 'Repère éditorial' },
            { name: 'Lundi de Pâques', color: '#f5d36b', start: '2026-04-06', end: '2026-04-06', notes: 'Jour férié' },
            { name: 'Fête du Travail', color: '#ef4444', start: '2026-05-01', end: '2026-05-01', notes: 'Jour férié' },
            { name: 'Victoire 1945', color: '#64748b', start: '2026-05-08', end: '2026-05-08', notes: 'Jour férié' },
            { name: 'Ascension', color: '#60a5fa', start: '2026-05-14', end: '2026-05-14', notes: 'Jour férié' },
            { name: 'Lundi de Pentecôte', color: '#60a5fa', start: '2026-05-25', end: '2026-05-25', notes: 'Jour férié' },
            { name: 'Fête des mères', color: '#f472b6', start: '2026-05-31', end: '2026-05-31', notes: 'Repère éditorial' },
            { name: 'Fête des pères', color: '#38bdf8', start: '2026-06-21', end: '2026-06-21', notes: 'Repère éditorial' },
            { name: 'Fête de la musique', color: '#a78bfa', start: '2026-06-21', end: '2026-06-21', notes: 'Repère éditorial' },
            { name: 'Été', color: '#f97316', start: '2026-06-21', end: '2026-06-21', notes: 'Saison' },
            { name: 'Soldes été', color: '#38bdf8', start: '2026-06-24', end: '2026-07-21', notes: 'Période commerciale' },
            { name: 'Fête nationale', color: '#3b82f6', start: '2026-07-14', end: '2026-07-14', notes: 'Jour férié' },
            { name: 'Assomption', color: '#64748b', start: '2026-08-15', end: '2026-08-15', notes: 'Jour férié' },
            { name: 'Rentrée', color: '#22c55e', start: '2026-09-01', end: '2026-09-07', notes: 'Période éditoriale' },
            { name: 'Automne', color: '#b45309', start: '2026-09-22', end: '2026-09-22', notes: 'Saison' },
            { name: 'Fête des grands-pères', color: '#38bdf8', start: '2026-10-04', end: '2026-10-04', notes: 'Repère éditorial' },
            { name: 'Halloween', color: '#f97316', start: '2026-10-31', end: '2026-10-31', notes: 'Repère éditorial' },
            { name: 'Toussaint', color: '#64748b', start: '2026-11-01', end: '2026-11-01', notes: 'Jour férié' },
            { name: 'Armistice', color: '#64748b', start: '2026-11-11', end: '2026-11-11', notes: 'Jour férié' },
            { name: 'Black Week', color: '#111827', start: '2026-11-23', end: '2026-11-30', notes: 'Période commerciale' },
            { name: 'Black Friday', color: '#111827', start: '2026-11-27', end: '2026-11-27', notes: 'Repère commercial' },
            { name: 'Cyber Monday', color: '#111827', start: '2026-11-30', end: '2026-11-30', notes: 'Repère commercial' },
            { name: 'Avent / idées cadeaux', color: '#22c55e', start: '2026-12-01', end: '2026-12-24', notes: 'Période éditoriale' },
            { name: 'Hiver', color: '#60a5fa', start: '2026-12-21', end: '2026-12-21', notes: 'Saison' },
            { name: 'Noël', color: '#22c55e', start: '2026-12-25', end: '2026-12-25', notes: 'Jour férié' },
            { name: 'Saint-Sylvestre', color: '#f5d36b', start: '2026-12-31', end: '2026-12-31', notes: 'Repère éditorial' }
        ];
    }

    function initHashtagStructure() {
        if (!safety.hashtag_folders || Array.isArray(safety.hashtag_folders)) {
            const old = Array.isArray(safety.hashtags_library) ? safety.hashtags_library : [];
            safety.hashtag_folders = { "Général": old };
            delete safety.hashtags_library;
        }
        if (!safety.ai_settings) {
            safety.ai_settings = { provider: 'ollama', model: 'llama3.1', base_url: 'http://127.0.0.1:11434', api_key: '' };
        }
        if (!Array.isArray(safety.ai_prompts)) {
            safety.ai_prompts = [
                { name: 'Ton de marque', prompt: 'Garde un style chaleureux, concret, jamais trop vendeur.' },
                { name: 'Style court', prompt: 'Réécris en version courte, directe et naturelle.' }
            ];
        }
        if (!safety.custom_statuses || !Array.isArray(safety.custom_statuses)) {
            safety.custom_statuses = [
                { code: 'draft', label: '🔴 Draft' },
                { code: 'writing', label: '🟡 Rédaction' },
                { code: 'ready', label: '🟢 Prêt' }
            ];
        }
        if (!Array.isArray(safety.internal_tags)) safety.internal_tags = ['promo', 'coulisses', 'tuto', 'témoignage', 'annonce', 'humeur', 'concours'];
        if (!Array.isArray(safety.campaigns)) safety.campaigns = [];
        if (!Array.isArray(safety.frequency_goals)) {
            safety.frequency_goals = [{ name: 'posts', count: 3, period: 'week' }];
        }
        if (!Array.isArray(safety.post_templates)) {
            safety.post_templates = [
                { name: 'Concours', text: 'Concours : ...\n\nPour participer :\n1. ...\n2. ...\n3. ...\n\nRésultat annoncé le ...' },
                { name: 'Annonce', text: 'Nouveauté : ...\n\nPourquoi c’est utile : ...\n\nEt vous, vous en pensez quoi ?' },
                { name: 'Avis client', text: 'Avis client : ...\n\nLe besoin au départ : ...\n\nCe qui a changé : ...' },
                { name: 'Nouveauté', text: 'Nouveauté disponible : ...\n\nCe que ça apporte : ...\n\nÀ découvrir dès maintenant.' },
                { name: 'Storytelling', text: 'Aujourd’hui, je veux vous raconter...\n\nLe déclic : ...\n\nLa leçon : ...' },
                { name: 'Témoignage', text: 'Retour client : ...\n\nLe problème de départ : ...\n\nLe résultat : ...' }
            ];
        }
        if (!Array.isArray(safety.calendar_markers)) safety.calendar_markers = [];
        if (!Array.isArray(safety.profile_photo_plans)) safety.profile_photo_plans = [];
        if (!Array.isArray(safety.profile_photo_gallery)) safety.profile_photo_gallery = [];
        if (!safety.calendar_markers_initialized) {
            defaultCalendarMarkers().forEach(marker => {
                if (!safety.calendar_markers.some(item => item.name === marker.name && item.start === marker.start)) {
                    safety.calendar_markers.push(marker);
                }
            });
            safety.calendar_markers_initialized = true;
        }
    }

    function t(key, fallback = '') {
        return key.split('.').reduce((acc, part) => acc && acc[part], translations) || fallback || key;
    }

    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.innerText = t(el.dataset.i18n, el.innerText);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = t(el.dataset.i18nPlaceholder, el.placeholder);
        });
        document.documentElement.lang = currentLanguage;
    }

    function loadLanguage(code) {
        return fetch(`/api/language/${code}`)
            .then(r => r.ok ? r.json() : Promise.reject(new Error('language not found')))
            .then(payload => {
                translations = payload;
                currentLanguage = code;
                setLocalStorageItem('instaLocalPlannerLanguage', code);
                applyTranslations();
            })
            .catch(() => {
                if (code !== 'fr') return loadLanguage('fr');
            });
    }

    function initLanguages() {
        const select = document.getElementById('language-select');
        fetch('/api/languages')
            .then(r => r.json())
            .then(languages => {
                if (select) {
                    select.innerHTML = '';
                    languages.forEach(lang => {
                        const option = document.createElement('option');
                        option.value = lang.code;
                        option.innerText = lang.name;
                        option.selected = lang.code === currentLanguage;
                        select.appendChild(option);
                    });
                    select.onchange = () => loadLanguage(select.value);
                }
                return loadLanguage(currentLanguage);
            })
            .catch(() => loadLanguage('fr'));
    }

    function importLanguageFile(files) {
        if (!files.length) return;
        const fd = new FormData();
        fd.append('file', files[0]);
        fetch('/api/import_language', { method: 'POST', body: fd })
            .then(r => {
                if (!r.ok) throw new Error('language import failed');
                return r.json();
            })
            .then(payload => {
                currentLanguage = payload.code;
                initLanguages();
                showToast(t('toast.language_imported', 'Langue importée'));
            })
            .catch(() => showToast(t('toast.language_import_error', 'Import langue impossible')));
    }

    function collectLocalReminders() {
        const today = new Date();
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().slice(0, 10);
        const reminders = [];
        (db.grid || []).forEach(post => {
            if (post.type === 'spacer') return;
            const label = post.planner_title || post.title || String(post.id || '').slice(0, 8);
            if (post.publish_date === tomorrow) reminders.push({ post, type: 'publish', text: `${t('notifications.publish_tomorrow', 'Post à publier demain')} : ${label}` });
            if (!post.caption && post.media && post.media.length) reminders.push({ post, type: 'caption', text: `${t('notifications.caption_missing', 'Légende à finaliser')} : ${label}` });
            if ((post.media || []).some(m => m.type === 'video' && !m.thumbnail)) reminders.push({ post, type: 'thumbnail', text: `${t('notifications.thumbnail_missing', 'Miniature vidéo manquante')} : ${label}` });
        });
        return reminders;
    }

    function checkLocalReminders() {
        const reminders = collectLocalReminders();
        if (!reminders.length) return;
        const message = [...new Set(reminders.map(r => r.text.split(':')[0]))].slice(0, 3).join(' • ');
        showToast(message);
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('InstaLocalPlanner', { body: message });
        } else if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function openRemindersPanel() {
        openIdeasModal();
        document.querySelector('#ai-ideas-modal h2').innerText = t('notifications.title', 'Rappels');
        const list = document.getElementById('ai-ideas-list');
        const reminders = collectLocalReminders();
        if (!reminders.length) {
            list.innerHTML = `<div class="ai-list-item">${t('notifications.none', 'Aucun rappel actif.')}</div>`;
            return;
        }
        list.innerHTML = '';
        reminders.forEach(reminder => {
            const row = document.createElement('div');
            row.className = 'ai-list-item';
            const text = document.createElement('div');
            text.innerText = reminder.text;
            const actions = document.createElement('div');
            actions.className = 'tools-row';
            const openBtn = document.createElement('button');
            openBtn.className = 'btn-primary small';
            openBtn.innerText = t('ai.open_first_post', 'Ouvrir');
            openBtn.onclick = () => openModal(reminder.post);
            actions.appendChild(openBtn);
            row.appendChild(text);
            row.appendChild(actions);
            list.appendChild(row);
        });
    }

    function renderAccounts() {
        const selects = [
            document.getElementById('account-select'),
            document.getElementById('quick-account-select')
        ].filter(Boolean);
        if (!selects.length) return;

        selects.forEach(select => {
            select.innerHTML = '';
            accounts.forEach(account => {
                const option = document.createElement('option');
                option.value = account.id;
                option.innerText = account.name || account.id;
                option.selected = account.id === activeAccount;
                select.appendChild(option);
            });
        });
    }

    function refreshAccounts() {
        return fetch('/api/accounts')
            .then(r => r.json())
            .then(payload => {
                accounts = payload.accounts || [];
                activeAccount = payload.active || activeAccount;
                renderAccounts();
            });
    }

    function switchAccount(accountId) {
        return fetch('/api/accounts/active', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id: accountId})
        }).then(r => {
            if (!r.ok) throw new Error('account switch failed');
            return r.json();
        }).then(payload => {
            accounts = payload.accounts || [];
            activeAccount = payload.active || accountId;
            currentPostId = null;
            selectedMediaIndex = 0;
            if (modal) modal.classList.add('hidden');
            loadAll();
            showToast(t('toast.account_switched', 'Compte changé'));
        }).catch(() => showToast(t('toast.save_error', 'Erreur sauvegarde')));
    }

    function createAccount() {
        const name = prompt(t('settings.account_name_prompt', 'Nom du nouveau compte :'));
        if (!name || !name.trim()) return;

        fetch('/api/accounts', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: name.trim()})
        }).then(r => {
            if (!r.ok) throw new Error('account create failed');
            return r.json();
        }).then(payload => {
            accounts = payload.accounts || [];
            activeAccount = payload.active || activeAccount;
            loadAll();
            showToast(t('toast.account_created', 'Compte créé'));
        }).catch(() => showToast(t('toast.save_error', 'Erreur sauvegarde')));
    }

    function deleteActiveAccount() {
        const account = accounts.find(item => item.id === activeAccount) || { id: activeAccount, name: activeAccount };
        const label = account.name || account.id;
        const expected = String(label);
        const typed = window.prompt(
            t('settings.account_delete_confirm', 'Tapez le nom du profil pour confirmer la suppression : {name}').replace('{name}', expected),
            ''
        );
        if (typed !== expected) return;

        fetch(`/api/accounts/${encodeURIComponent(account.id)}`, {
            method: 'DELETE'
        }).then(r => {
            if (!r.ok) throw new Error('account delete failed');
            return r.json();
        }).then(payload => {
            accounts = payload.accounts || [];
            activeAccount = payload.active || 'default';
            currentPostId = null;
            selectedMediaIndex = 0;
            if (modal) modal.classList.add('hidden');
            loadAll();
            showToast(t('toast.account_deleted', 'Profil supprimé'));
        }).catch(() => showToast(t('toast.delete_error', 'Erreur suppression')));
    }

    // --- 2. GRID RENDERING ---
    function renderGrid() {
        if(!gridEl) return;
        gridEl.innerHTML = '';
        const posts = db.grid || [];
        const countEl = document.getElementById('ui-posts');
        if(countEl) countEl.innerText = posts.length;
        
        posts.forEach(post => {
            const hasMedia = post.media && post.media.length > 0;
            const isGhost = post.type === 'ghost' && !hasMedia;
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.id = post.id;
            cell.classList.toggle('search-hidden', !postMatchesSearch(post, globalSearchTerm));
            cell.classList.toggle('batch-selected', selectedPostIds.has(post.id));

            const div = document.createElement('div');
            div.className = `grid-item ${post.type === 'spacer' ? 'spacer' : ''} ${isGhost ? 'type-ghost' : ''} status-${post.status || 'draft'}`;
            div.dataset.id = post.id;
            if (post.type !== 'spacer') {
                div.draggable = true;
                div.addEventListener('dragstart', (e) => {
                    const ids = selectedPostIds.has(post.id) ? Array.from(selectedPostIds) : [post.id];
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('application/x-instalocalplanner-posts', JSON.stringify(ids));
                    e.dataTransfer.setData('text/plain', ids.join(','));
                    div.classList.add('dragging-to-calendar');
                });
                div.addEventListener('dragend', () => div.classList.remove('dragging-to-calendar'));
            }

            if (post.type !== 'spacer') {
                cell.appendChild(createPostNoteCard(post));
            }
            
            if (post.type === 'spacer') {
                // CSS via ::after
            } else if (isGhost) {
                // --- TITRE NOTE ---
                const title = document.createElement('h3');
                // Priorité au titre explicite, sinon début de caption, sinon défaut
                title.innerText = post.title || (post.caption ? post.caption.slice(0, 20) : 'Note');
                div.appendChild(title);
                
                const sub = document.createElement('span');
                sub.innerText = t('status.draft_label', 'Brouillon');
                div.appendChild(sub);
            } else if (hasMedia) {
                const m = post.media[0];
                const el = document.createElement(m.type === 'video' && !m.thumbnail ? 'video' : 'img');
                el.src = m.type === 'video' && m.thumbnail ? m.thumbnail : m.src;
                div.appendChild(el);
                
                const dot = document.createElement('div'); dot.className = 'status-dot'; div.appendChild(dot);
                
                if (post.media.length > 1) {
                    const icon = document.createElement('span'); 
                    icon.className = 'material-symbols-outlined carousel-icon'; 
                    icon.innerText = 'filter_none';
                    div.appendChild(icon);
                }
            }
            
            div.onclick = (e) => handleGridItemClick(e, post);
            cell.appendChild(div);
            if (post.type !== 'spacer') {
                cell.appendChild(createQuickPostControls(post));
            }
            gridEl.appendChild(cell);
        });
        applyNotesVisibility();
    }

    function createQuickPostControls(post) {
        const bar = document.createElement('div');
        bar.className = 'quick-post-controls';
        bar.onclick = (e) => e.stopPropagation();

        const date = document.createElement('input');
        date.type = 'date';
        date.value = post.publish_date || '';
        date.title = t('planning.quick_date', 'Date rapide');
        date.onchange = () => {
            post.publish_date = date.value;
            savePostQuickUpdate(post, t('toast.date_updated', 'Date mise à jour'));
        };
        bar.appendChild(date);

        const campaign = document.createElement('select');
        campaign.className = 'quick-campaign-select';
        campaign.innerHTML = `<option value="">${t('organization.no_campaign', 'Sans campagne')}</option>`;
        (safety.campaigns || []).forEach(item => {
            const option = document.createElement('option');
            option.value = item.name;
            option.innerText = item.name;
            option.selected = item.name === post.campaign;
            campaign.appendChild(option);
        });
        campaign.title = t('organization.campaigns', 'Collections / campagnes');
        campaign.onchange = () => {
            post.campaign = campaign.value;
            savePostQuickUpdate(post, t('toast.campaign_updated', 'Campagne mise à jour'));
        };
        bar.appendChild(campaign);

        return bar;
    }

    function savePostQuickUpdate(post, message) {
        fetch('/api/save_post_structure', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({post})
        }).then(r => {
            if (!r.ok) throw new Error('save failed');
            return r.json();
        }).then(d => {
            const idx = db.grid.findIndex(p => p.id === d.post.id);
            if (idx >= 0) db.grid[idx] = d.post;
            renderGrid();
            renderPlanningPanel();
            showToast(message);
        }).catch(() => showToast(t('toast.save_error', 'Erreur sauvegarde')));
    }

    function savePostStructure(post) {
        return fetch('/api/save_post_structure', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({post})
        }).then(r => r.ok ? r.json() : Promise.reject(new Error('save failed'))).then(result => {
            const idx = db.grid.findIndex(p => p.id === result.post.id);
            if (idx >= 0) db.grid[idx] = result.post;
            return result.post;
        });
    }

    function handleGridItemClick(e, post) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            updateBatchSelection(post.id, e);
            return;
        }
        if (post.type === 'spacer') {
            e.preventDefault();
            e.stopPropagation();
            updateBatchSelection(post.id, e);
            return;
        }
        clearBatchSelection();
        openModal(post);
    }

    function updateBatchSelection(postId, e) {
        if (e.shiftKey && lastSelectedPostId) {
            const ids = (db.grid || []).map(p => p.id);
            const start = ids.indexOf(lastSelectedPostId);
            const end = ids.indexOf(postId);
            if (start >= 0 && end >= 0) {
                const [from, to] = start < end ? [start, end] : [end, start];
                ids.slice(from, to + 1).forEach(id => selectedPostIds.add(id));
            } else {
                selectedPostIds.add(postId);
            }
        } else if (e.ctrlKey || e.metaKey) {
            if (selectedPostIds.has(postId)) selectedPostIds.delete(postId);
            else selectedPostIds.add(postId);
            lastSelectedPostId = postId;
        } else {
            selectedPostIds = new Set([postId]);
            lastSelectedPostId = postId;
        }
        renderGrid();
        showToast(t('toast.batch_selected', '{count} post(s) sélectionné(s)').replace('{count}', selectedPostIds.size));
    }

    function clearBatchSelection() {
        selectedPostIds.clear();
        lastSelectedPostId = null;
    }

    function createPostNoteCard(post) {
        const note = document.createElement('div');
        const hasText = Boolean((post.planner_title || '').trim() || (post.planner_comment || '').trim());
        note.className = `post-note-card ${hasText ? '' : 'empty'} ${post.note_expanded ? 'expanded' : ''} ${selectedNotePostId === post.id ? 'selected' : ''}`;
        note.dataset.id = post.id;
        note.title = t('notes.edit_hint', 'Double-clic pour éditer, Suppr pour vider');

        renderPostNoteContent(note, post);

        note.onclick = (e) => {
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                updateBatchSelection(post.id, e);
                return;
            }
            selectPostNote(post.id);
        };
        note.ondblclick = (e) => {
            e.stopPropagation();
            editPostNoteInline(note, post);
        };

        return note;
    }

    function selectPostNote(postId) {
        selectedNotePostId = postId;
        document.querySelectorAll('.post-note-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.id === postId);
        });
    }

    function renderPostNoteContent(note, post) {
        note.innerHTML = '';
        appendPostMetaRow(note, post);
        const title = (post.planner_title || '').trim();
        const comment = (post.planner_comment || '').trim();
        const shouldClamp = shouldClampPlannerComment(comment);

        if (!title && !comment) {
            const placeholder = document.createElement('div');
            placeholder.className = 'post-note-placeholder';
            placeholder.innerText = t('notes.empty', 'Double-clic: titre / commentaire');
            note.appendChild(placeholder);
            appendPlannerAiAction(note, post);
            return;
        }

        const titleEl = document.createElement('div');
        titleEl.className = 'post-note-title';
        titleEl.innerText = title || t('notes.no_title', 'Sans titre');
        note.appendChild(titleEl);

        if (comment) {
            const commentEl = document.createElement('div');
            commentEl.className = 'post-note-comment';
            if (shouldClamp && !post.note_expanded) commentEl.classList.add('clamped');
            commentEl.innerText = comment;
            note.appendChild(commentEl);

            if (shouldClamp) {
                const toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'post-note-toggle';
                toggle.innerText = post.note_expanded ? t('notes.collapse', 'Réduire') : t('notes.expand', 'Déplier');
                toggle.onclick = (e) => {
                    e.stopPropagation();
                    post.note_expanded = !post.note_expanded;
                    saveAll();
                    renderGrid();
                };
                note.appendChild(toggle);
            }
        }
        appendPlannerAiAction(note, post);
    }

    function appendPlannerAiAction(note, post) {
        const actions = document.createElement('div');
        actions.className = 'post-note-actions';
        const aiBtn = document.createElement('button');
        aiBtn.type = 'button';
        aiBtn.className = 'post-note-ai';
        aiBtn.title = t('ai.note_summary', 'Remplir avec l’IA');
        aiBtn.innerText = 'auto_awesome';
        aiBtn.onclick = (e) => {
            e.stopPropagation();
            generatePlannerSummary(post);
        };
        actions.appendChild(aiBtn);
        note.appendChild(actions);
    }

    function appendPostMetaRow(note, post) {
        const row = document.createElement('div');
        row.className = 'post-note-meta-row';
        const badge = document.createElement('span');
        badge.className = 'post-id-badge';
        badge.innerText = `ID ${String(post.id || '').slice(0, 8)}`;
        badge.title = post.id || '';
        badge.onclick = (e) => {
            e.stopPropagation();
            if (navigator.clipboard && post.id) {
                navigator.clipboard.writeText(post.id);
                showToast(t('toast.id_copied', 'ID copié'));
            }
        };
        row.appendChild(badge);

        if (post.campaign) {
            const campaign = document.createElement('span');
            campaign.className = 'post-note-meta';
            campaign.innerText = post.campaign;
            const campaignConfig = (safety.campaigns || []).find(item => item.name === post.campaign);
            if (campaignConfig && campaignConfig.color) campaign.style.borderColor = campaignConfig.color;
            campaign.onclick = (e) => {
                e.stopPropagation();
                activeCampaignFilter = post.campaign;
                renderToolbarFilters();
                renderGrid();
            };
            row.appendChild(campaign);
        }

        const postTags = Array.isArray(post.internal_tags) ? post.internal_tags : String(post.internal_tags || '').split(',').map(v => v.trim()).filter(Boolean);
        postTags.slice(0, 3).forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'post-note-meta tag-meta';
            tagEl.innerText = tag;
            tagEl.onclick = (e) => {
                e.stopPropagation();
                activeTagFilter = tag;
                renderToolbarFilters();
                renderGrid();
            };
            row.appendChild(tagEl);
        });

        note.appendChild(row);
    }

    function postMatchesSearch(post, term) {
        const postTags = Array.isArray(post.internal_tags) ? post.internal_tags : String(post.internal_tags || '').split(',').map(v => v.trim()).filter(Boolean);
        if (activeDateFilter && post.publish_date !== activeDateFilter) return false;
        if (activeCampaignFilter && post.campaign !== activeCampaignFilter) return false;
        if (activeTagFilter && !postTags.includes(activeTagFilter)) return false;
        if (!term) return true;
        const haystack = [
            post.id,
            post.title, post.caption, post.tags, post.first_comment,
            post.status, post.planner_title, post.planner_comment,
            post.campaign, postTags.join(' ')
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(term.toLowerCase());
    }

    function shouldClampPlannerComment(comment) {
        const sentences = (comment.match(/[.!?…]+(\s|$)/g) || []).length;
        return comment.length > 140 || sentences > 2;
    }

    function editPostNoteInline(note, post) {
        selectedNotePostId = post.id;
        note.classList.add('selected');
        note.innerHTML = '';

        const editor = document.createElement('div');
        editor.className = 'post-note-editor';

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = post.planner_title || '';
        titleInput.placeholder = t('notes.title_placeholder', 'Titre');

        const commentInput = document.createElement('input');
        commentInput.type = 'text';
        commentInput.value = post.planner_comment || '';
        commentInput.placeholder = t('notes.comment_placeholder', 'Commentaire');

        editor.appendChild(titleInput);
        editor.appendChild(commentInput);
        note.appendChild(editor);

        let saved = false;
        const commit = () => {
            if (saved) return;
            saved = true;
            post.planner_title = titleInput.value.trim();
            post.planner_comment = commentInput.value.trim();
            saveAll();
            renderGrid();
        };

        [titleInput, commentInput].forEach(input => {
            input.onclick = (e) => e.stopPropagation();
            input.ondblclick = (e) => e.stopPropagation();
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    saved = true;
                    renderGrid();
                }
            };
            input.onblur = () => setTimeout(() => {
                if (!note.contains(document.activeElement)) commit();
            }, 0);
        });

        titleInput.focus();
        titleInput.select();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && (selectedPostIds.size || selectedNotePostId)) {
            e.preventDefault();
            clearBatchSelection();
            selectedNotePostId = null;
            renderGrid();
            showToast(t('toast.selection_cleared', 'Sélection annulée'));
            return;
        }
        if (e.key !== 'Delete') return;
        const active = document.activeElement;
        if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return;

        if (selectedPostIds.size) {
            e.preventDefault();
            deleteSelectedPosts(e.ctrlKey && e.shiftKey);
            return;
        }

        if (!selectedNotePostId) return;
        const post = db.grid.find(p => p.id === selectedNotePostId);
        if (!post) return;
        e.preventDefault();
        post.planner_title = '';
        post.planner_comment = '';
        saveAll();
        renderGrid();
        showToast(t('toast.note_cleared', 'Encart vidé'));
    });

    function deleteSelectedPosts(skipConfirm = false) {
        const ids = Array.from(selectedPostIds);
        if (!ids.length) return;
        const message = t('confirm.delete_selected_posts', 'Supprimer {count} post(s) sélectionné(s) ?').replace('{count}', ids.length);
        if (!skipConfirm && !confirm(message)) return;

        Promise.all(ids.map(id => fetch('/api/delete_post', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id})
        }).then(r => {
            if (!r.ok) throw new Error('delete failed');
            return r.json();
        }))).then(() => {
            db.grid = db.grid.filter(p => !selectedPostIds.has(p.id));
            clearBatchSelection();
            renderGrid();
            showToast(t('toast.batch_deleted', '{count} post(s) supprimé(s)').replace('{count}', ids.length));
        }).catch(() => showToast(t('toast.delete_error', 'Erreur suppression')));
    }

    function applyNotesVisibility() {
        if (!gridEl) return;
        gridEl.classList.toggle('notes-hidden', !notesVisible);
        const btn = document.getElementById('btn-notes-mode');
        if (btn) btn.classList.toggle('active', notesVisible);
    }

    // --- 3. UI PROFILE ---
    function updateUI() {
        if (!db.profile) return;
        if (typeof db.profile.bio === 'string' && db.profile.bio.length > 150) {
            db.profile.bio = db.profile.bio.slice(0, 150);
        }
        const ids = {
            'ui-username': 'name', 'ui-fullname': 'fullname', 
            'ui-bio': 'bio', 'ui-followers': 'followers', 'ui-following': 'following'
        };
        for (const [id, key] of Object.entries(ids)) {
            const el = document.getElementById(id);
            if(el) el.innerText = db.profile[key] || '';
        }
        const uiAvatar = document.getElementById('ui-avatar');
        const uiAvatarPh = document.getElementById('ui-avatar-ph');
        if (db.profile.avatar && uiAvatar) {
            uiAvatar.src = db.profile.avatar;
            uiAvatar.classList.remove('hidden');
            if(uiAvatarPh) uiAvatarPh.classList.add('hidden');
        } else if (uiAvatarPh) {
            if(uiAvatar) uiAvatar.classList.add('hidden');
            uiAvatarPh.classList.remove('hidden');
        }
    }

    // --- 4. MODAL LOGIC ---
    function openModal(post) {
        currentPostId = post.id;
        selectedMediaIndex = 0;
        renderStatusOptions();
        renderCampaignOptions();
        renderTemplateOptions();
        renderAiPromptControls();
        
        // Remplissage
        document.getElementById('inp-caption').value = post.caption || '';
        document.getElementById('inp-tags').value = post.tags || '';
        document.getElementById('inp-comment').value = post.first_comment || '';
        document.getElementById('post-status-select').value = post.status || 'draft';
        document.getElementById('inp-date').value = post.publish_date || '';
        document.getElementById('inp-time').value = post.publish_time || '';
        document.getElementById('post-campaign-select').value = post.campaign || '';
        document.getElementById('post-internal-tags').value = Array.isArray(post.internal_tags) ? post.internal_tags.join(', ') : (post.internal_tags || '');
        renderInternalTagSuggestions();
        renderCampaignDetails(post.campaign || '');

        // Gestion Titre (Ghost seulement)
        const titleRow = document.getElementById('row-title-ghost');
        const titleInp = document.getElementById('inp-title');
        const convertDraftBtn = document.getElementById('btn-convert-draft');
        if (post.type === 'ghost') {
            titleRow.classList.remove('hidden');
            titleInp.value = post.title || '';
            if (convertDraftBtn) convertDraftBtn.classList.remove('hidden');
        } else {
            titleRow.classList.add('hidden');
            if (convertDraftBtn) convertDraftBtn.classList.add('hidden');
        }

        // Reset Tab active
        document.querySelector('.tab-btn[data-target="tab-edit"]').click();

        renderCarousel(post);
        renderHashtagsCollections();
        checkContentSafety();
        updateCounters();
        resetAiPreview();
        renderMobilePreview(post);
        
        modal.classList.remove('hidden');
    }

    function renderStatusOptions() {
        const select = document.getElementById('post-status-select');
        if (!select) return;
        select.innerHTML = '';
        (safety.custom_statuses || []).forEach(status => {
            const option = document.createElement('option');
            option.value = status.code;
            option.innerText = status.label || status.code;
            select.appendChild(option);
        });
    }

    function renderCampaignOptions() {
        const select = document.getElementById('post-campaign-select');
        if (!select) return;
        select.innerHTML = `<option value="">${t('organization.no_campaign', 'Sans campagne')}</option>`;
        (safety.campaigns || []).forEach(campaign => {
            const option = document.createElement('option');
            option.value = campaign.name;
            option.innerText = campaign.objective ? `${campaign.name} - ${campaign.objective}` : campaign.name;
            select.appendChild(option);
        });
        select.onchange = () => renderCampaignDetails(select.value);
    }

    function renderCampaignDetails(name) {
        const box = document.getElementById('campaign-details');
        if (!box) return;
        const campaign = (safety.campaigns || []).find(c => c.name === name);
        if (!campaign) {
            box.classList.add('hidden');
            box.innerText = '';
            return;
        }
        const period = [campaign.start, campaign.end].filter(Boolean).join(' → ');
        box.innerText = [campaign.objective, period, campaign.notes].filter(Boolean).join(' | ');
        box.style.borderLeftColor = campaign.color || '#333';
        box.classList.toggle('hidden', !box.innerText);
    }

    function renderInternalTagSuggestions() {
        const box = document.getElementById('internal-tag-suggestions');
        const input = document.getElementById('post-internal-tags');
        if (!box || !input) return;
        box.innerHTML = '';
        (safety.internal_tags || []).forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'chip-btn';
            chip.innerText = tag;
            chip.onclick = () => {
                const current = input.value.split(',').map(v => v.trim()).filter(Boolean);
                if (!current.includes(tag)) current.push(tag);
                input.value = current.join(', ');
            };
            box.appendChild(chip);
        });
    }

    function renderTemplateOptions() {
        const select = document.getElementById('template-select');
        if (!select) return;
        select.innerHTML = `<option value="">${t('organization.choose_template', 'Appliquer un modèle...')}</option>`;
        (safety.post_templates || []).forEach((tpl, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.innerText = tpl.name;
            select.appendChild(option);
        });
    }

    function applySelectedTemplate(mode) {
        const select = document.getElementById('template-select');
        if (!select || select.value === '') return;
        const tpl = (safety.post_templates || [])[Number(select.value)];
        if (!tpl) return;
        const text = tpl.text || '';
        if (mode === 'append') {
            captionArea.value += (captionArea.value.trim() ? '\n\n' : '') + text;
        } else if (!captionArea.value.trim() || confirm(t('confirm.apply_template', 'Remplacer la légende par ce modèle ?'))) {
            captionArea.value = text;
        }
        updateCounters();
        calculateSEO();
    }

    function currentExportText(post) {
        const caption = document.getElementById('inp-caption')?.value ?? post.caption ?? '';
        const mentions = document.getElementById('inp-tags')?.value ?? post.tags ?? '';
        const firstComment = document.getElementById('inp-comment')?.value ?? post.first_comment ?? '';
        const parts = [caption, mentions].map(value => String(value || '').trim()).filter(Boolean);
        let text = parts.join('\n\n');
        if (firstComment.trim()) text += `${text ? '\n\n' : ''}${t('post.first_comment', 'Premier Commentaire')}:\n${firstComment.trim()}`;
        return text.trim() || t('qr.empty_content', 'Aucun contenu');
    }

    function makeQrSafeText(text) {
        return String(text || '')
            .replace(/\u00a0/g, ' ')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/[–—]/g, '-')
            .replace(/…/g, '...')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .split('\n')
            .map(line => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
            .join('\n')
            .trim();
    }

    function renderQrTools(text, error = '') {
        const tools = document.getElementById('qr-export-tools');
        if (!tools) return;
        tools.innerHTML = '';

        const info = document.createElement('div');
        info.className = error ? 'qr-status error' : 'qr-status';
        info.innerText = error || t('qr.payload_hint', 'QR généré depuis la légende actuelle en version mobile-safe.');
        tools.appendChild(info);

        const count = document.createElement('div');
        count.className = 'qr-count';
        count.innerText = t('qr.char_count', '{count} caractères').replace('{count}', text.length);
        tools.appendChild(count);

        const row = document.createElement('div');
        row.className = 'tools-row';
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn-secondary small';
        copyBtn.innerText = t('qr.copy_text', 'Copier le texte');
        copyBtn.onclick = () => {
            navigator.clipboard?.writeText(text);
            showToast(t('toast.qr_text_copied', 'Texte QR copié'));
        };

        const regenBtn = document.createElement('button');
        regenBtn.type = 'button';
        regenBtn.className = 'btn-secondary small';
        regenBtn.innerText = t('qr.regenerate', 'Régénérer');
        regenBtn.onclick = generateQR;

        row.appendChild(copyBtn);
        row.appendChild(regenBtn);
        tools.appendChild(row);
    }

    // --- FIX QR CODE : Génération au clic sur l'onglet ---
    function generateQR() {
            const post = db.grid.find(p => p.id === currentPostId);
            const qrBox = document.getElementById('qrcode-box');
            
            if(qrBox && post) {
                qrBox.innerHTML = '';
                const fullText = makeQrSafeText(currentExportText(post));
                renderQrTools(fullText);

                // Petit QR Code (Aperçu)
                try {
                    if (typeof QRCode === 'undefined') throw new Error('QRCode unavailable');
                    new QRCode(qrBox, { 
                        text: fullText, 
                        width: 250,    
                        height: 250,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.L
                    });
                    
                    // AJOUT : Clic pour ouvrir en grand
                    qrBox.onclick = () => openFullQR(fullText);
                    
                    // Petit texte d'aide sous le QR code (optionnel, via JS)
                    qrBox.title = t('qr.click_to_zoom', 'Cliquez pour agrandir');

                } catch (e) {
                    qrBox.innerText = t('qr.data_error', 'Erreur données');
                    renderQrTools(fullText, t('qr.data_error_hint', 'QR impossible : utilisez le bouton copier le texte.'));
                }
            }
        }

        // 2. Fonction pour ouvrir le QR Code en GÉANT
        window.openFullQR = function(text) {
            const overlay = document.getElementById('qr-overlay');
            const container = document.getElementById('qrcode-full');
            
            // Nettoyer précédent
            container.innerHTML = '';
            overlay.classList.remove('hidden');

            // Générer en TRES GRAND (600px)
            // La taille élevée permet de séparer les points pour les longs textes
            try {
                new QRCode(container, { 
                    text: text, 
                    width: 600,    // Taille massive pour lisibilité parfaite
                    height: 600,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.L 
                });
            } catch (e) {
                container.innerText = t('qr.data_error_hint', 'QR impossible : utilisez le bouton copier le texte.');
            }
        };

        // 3. Fermeture
        window.closeQrModal = function() {
            document.getElementById('qr-overlay').classList.add('hidden');
        };

    function renderCarousel(post) {
        const mainImg = document.getElementById('main-preview-img');
        const mainVid = document.getElementById('main-preview-video');
        const list = document.getElementById('carousel-thumbnails');
        
        // Mode Texte (Ghost)
        if (!post.media || post.media.length === 0) {
            mainImg.classList.add('hidden');
            mainVid.classList.add('hidden');
            list.innerHTML = `<div style="color:#666; font-size:12px; padding:10px; text-align:center;">${t('media.no_media_note', 'Mode Note (Pas de média)')}</div>`;
            updateMediaToolState(null);
            return;
        }
        
        const media = post.media[selectedMediaIndex];
        if (media) {
            if (media.type === 'video') {
                mainImg.classList.add('hidden'); mainVid.classList.remove('hidden');
                mainVid.src = media.src;
            } else {
                mainVid.classList.add('hidden'); mainImg.classList.remove('hidden');
                mainImg.src = media.src;
            }
            updateMediaToolState(media);
        }

        list.innerHTML = '';
        post.media.forEach((m, idx) => {
            const div = document.createElement('div');
            div.className = `thumb-item ${idx === selectedMediaIndex ? 'selected' : ''}`;
            if (m.type === 'video' && !m.thumbnail) {
                const videoIcon = document.createElement('div');
                videoIcon.className = 'thumb-video-placeholder';
                videoIcon.innerText = 'play_arrow';
                div.appendChild(videoIcon);
            } else {
                const img = document.createElement('img'); img.src = m.thumbnail || m.src;
                div.appendChild(img);
            }
            div.onclick = () => { selectedMediaIndex = idx; renderCarousel(post); renderMobilePreview(post); };
            list.appendChild(div);
        });

        if (carouselSortable) { carouselSortable.destroy(); carouselSortable = null; }
        carouselSortable = new Sortable(list, {
            animation: 150,
            onEnd: (evt) => {
                const item = post.media.splice(evt.oldIndex, 1)[0];
                post.media.splice(evt.newIndex, 0, item);
                selectedMediaIndex = evt.newIndex;
                saveAll();
                renderCarousel(post);
                renderGrid();
            }
        });
    }

    function renderMobilePreview(post) {
        const user = document.getElementById('mobile-preview-user');
        const avatar = document.getElementById('mobile-preview-avatar');
        const avatarPh = document.getElementById('mobile-preview-avatar-ph');
        const mediaBox = document.getElementById('mobile-preview-media');
        const captionBox = document.getElementById('mobile-preview-caption');
        const commentBox = document.getElementById('mobile-preview-comment');
        if (!mediaBox || !captionBox || !commentBox) return;

        if (user) user.innerText = db.profile?.name || 'username';
        if (db.profile?.avatar && avatar) {
            avatar.src = db.profile.avatar;
            avatar.classList.remove('hidden');
            if (avatarPh) avatarPh.classList.add('hidden');
        } else {
            if (avatar) avatar.classList.add('hidden');
            if (avatarPh) avatarPh.classList.remove('hidden');
        }

        mediaBox.innerHTML = '';
        const media = (post.media || [])[selectedMediaIndex] || (post.media || [])[0];
        if (media) {
            const el = document.createElement(media.type === 'video' ? 'video' : 'img');
            el.src = media.thumbnail || media.src;
            if (media.type === 'video') {
                el.controls = true;
                el.muted = true;
            }
            mediaBox.appendChild(el);
        } else {
            const ghost = document.createElement('div');
            ghost.className = 'mobile-preview-ghost';
            ghost.innerText = post.title || post.planner_title || t('media.no_media_note', 'Mode Note (Pas de média)');
            mediaBox.appendChild(ghost);
        }

        const caption = document.getElementById('inp-caption')?.value || post.caption || '';
        const tags = document.getElementById('inp-tags')?.value || post.tags || '';
        const firstComment = document.getElementById('inp-comment')?.value || post.first_comment || '';
        captionBox.innerText = [caption, tags].map(v => String(v || '').trim()).filter(Boolean).join('\n\n') || t('placeholders.write_here', 'Écrivez ici...');
        commentBox.innerText = firstComment.trim() ? `${t('post.first_comment', 'Premier Commentaire')} : ${firstComment.trim()}` : '';
    }

    // --- 5. TOOLS ---
    document.getElementById('btn-crop-start').onclick = () => {
        const img = document.getElementById('main-preview-img');
        if (img.classList.contains('hidden')) return alert(t('alerts.crop_unavailable', 'Impossible de recadrer (Vidéo ou Texte)'));
        if (cropper) cropper.destroy();
        cropper = new Cropper(img, { aspectRatio: 4/5 });
        document.getElementById('btn-crop-apply').classList.remove('hidden');
    };

    document.getElementById('btn-crop-apply').onclick = () => {
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas();
        const post = db.grid.find(p => p.id === currentPostId);
        if(post && post.media[selectedMediaIndex]) {
            post.media[selectedMediaIndex].src = canvas.toDataURL();
            cropper.destroy(); cropper = null;
            document.getElementById('btn-crop-apply').classList.add('hidden');
            renderCarousel(post);
            renderGrid();
            saveAll();
        }
    };

    const captionArea = document.getElementById('inp-caption');
    captionArea.addEventListener('input', () => {
        checkContentSafety(); updateCounters(); calculateSEO();
        const post = db.grid.find(p => p.id === currentPostId);
        if (post) renderMobilePreview(post);
    });
    ['inp-tags', 'inp-comment'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            const post = db.grid.find(p => p.id === currentPostId);
            if (post) renderMobilePreview(post);
        });
    });

    function resetAiPreview() {
        pendingAiText = '';
        const preview = document.getElementById('ai-preview');
        const applyBtn = document.getElementById('btn-ai-apply');
        const status = document.getElementById('ai-status');
        const options = document.getElementById('ai-options');
        if (preview) preview.classList.add('hidden');
        if (applyBtn) applyBtn.classList.add('hidden');
        if (options) options.classList.add('hidden');
        if (status) status.innerText = '';
    }

    function collectAiSettings() {
        if (!aiSettingsHydrated) {
            return safety.ai_settings || {};
        }
        return {
            provider: document.getElementById('ai-provider')?.value || 'ollama',
            model: document.getElementById('ai-model')?.value || '',
            base_url: document.getElementById('ai-base-url')?.value || '',
            api_key: document.getElementById('ai-api-key')?.value || ''
        };
    }

    function aiProviderDefaults(provider) {
        return {
            ollama: { base_url: 'http://127.0.0.1:11434', model: 'llama3.1' },
            lmstudio: { base_url: 'http://127.0.0.1:1234/v1', model: '' },
            openai: { base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
            claude: { base_url: '', model: 'claude-3-5-sonnet-latest' },
            gemini: { base_url: '', model: 'gemini-1.5-flash' },
            deepseek: { base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' }
        }[provider || 'ollama'] || { base_url: '', model: '' };
    }

    function updateAiProviderDefaults(force = false) {
        const provider = document.getElementById('ai-provider')?.value || 'ollama';
        const model = document.getElementById('ai-model');
        const base = document.getElementById('ai-base-url');
        const defaults = aiProviderDefaults(provider);
        const knownBases = ['http://127.0.0.1:11434', 'http://127.0.0.1:1234', 'http://127.0.0.1:1234/v1', 'https://api.openai.com/v1', 'https://api.deepseek.com/v1'];
        const knownModels = ['llama3.1', 'gpt-4o-mini', 'claude-3-5-sonnet-latest', 'gemini-1.5-flash', 'deepseek-chat', 'local-model'];
        if (base && (force || !base.value || knownBases.includes(base.value.trim()))) {
            base.value = defaults.base_url;
        }
        if (model && (force || !model.value || knownModels.includes(model.value.trim()))) {
            model.value = defaults.model;
        }
        if (model) {
            model.placeholder = provider === 'lmstudio'
                ? t('ai.model_lmstudio_placeholder', 'Optionnel : modèle chargé dans LM Studio')
                : 'llama3.1, gpt-4o-mini, claude-3-5-sonnet-latest...';
        }
    }

    function fillAiPromptSettings() {
        const textarea = document.getElementById('ai-prompts');
        if (!textarea) return;
        textarea.value = (safety.ai_prompts || [])
            .map(item => `${item.name || ''}|${(item.prompt || '').replace(/\n/g, '\\n')}`)
            .join('\n');
    }

    function collectAiPromptSettings() {
        const text = document.getElementById('ai-prompts')?.value || '';
        safety.ai_prompts = text.split('\n').map(line => {
            const [name, ...prompt] = line.split('|');
            return {
                name: (name || '').trim(),
                prompt: prompt.join('|').replace(/\\n/g, '\n').trim()
            };
        }).filter(item => item.name && item.prompt);
    }

    function renderAiPromptControls() {
        const select = document.getElementById('ai-prompt-select');
        if (!select) return;
        select.innerHTML = `<option value="">${t('ai.choose_prompt', 'Choisir une consigne...')}</option>`;
        (safety.ai_prompts || []).forEach((item, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.innerText = item.name || t('ai.custom_prompt', 'Consigne');
            select.appendChild(option);
        });
    }

    function applySelectedAiPrompt() {
        const select = document.getElementById('ai-prompt-select');
        const instruction = document.getElementById('ai-instruction');
        if (!select || !instruction || select.value === '') return;
        const item = (safety.ai_prompts || [])[Number(select.value)];
        if (!item || !item.prompt) return;
        instruction.value = instruction.value.trim()
            ? `${instruction.value.trim()}\n\n${item.prompt}`
            : item.prompt;
    }

    function runAiTask(task, payload) {
        return fetch('/api/ai/task', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ task, payload, settings: collectAiSettings() })
        }).then(r => {
            if (!r.ok) return r.json().then(err => Promise.reject(err));
            return r.json();
        });
    }

    function renderAiOptions(items, onApply) {
        const box = document.getElementById('ai-options');
        if (!box) return;
        box.innerHTML = '';
        items.forEach((text, index) => {
            const item = document.createElement('div');
            item.className = 'ai-option';
            const pre = document.createElement('div');
            pre.innerText = text;
            const row = document.createElement('div');
            row.className = 'tools-row';
            const btn = document.createElement('button');
            btn.className = 'btn-primary small';
            btn.innerText = t('common.validate', 'Valider');
            btn.onclick = () => onApply(text, index);
            row.appendChild(btn);
            item.appendChild(pre);
            item.appendChild(row);
            box.appendChild(item);
        });
        box.classList.toggle('hidden', !items.length);
    }

    function extractHashtags(text) {
        return Array.from(new Set((text || '').match(/#[\p{L}\p{N}_-]+/gu) || []));
    }

    function renderHashtagSuggestionOptions(tags) {
        const box = document.getElementById('ai-options');
        if (!box) return;
        const cleanTags = Array.from(new Set((tags || []).map(tag => tag.startsWith('#') ? tag : `#${tag}`).filter(tag => tag.length > 1)));
        const libraryTags = new Set(Object.values(safety.hashtag_folders || {}).flat().map(tag => tag.toLowerCase()));
        const knownTags = cleanTags.filter(tag => libraryTags.has(tag.toLowerCase()));
        const newTags = cleanTags.filter(tag => !libraryTags.has(tag.toLowerCase()));
        box.innerHTML = '';

        const item = document.createElement('div');
        item.className = 'ai-option';
        const tagWrap = document.createElement('div');
        tagWrap.className = 'ai-tag-picker';
        const selected = new Set();
        const addGroup = (label, list, className) => {
            if (!list.length) return;
            const group = document.createElement('div');
            group.className = 'ai-tag-group';
            const groupTitle = document.createElement('strong');
            groupTitle.innerText = label;
            const chips = document.createElement('div');
            chips.className = 'chips-container compact-chips';
            list.forEach(tag => {
                const chip = document.createElement('span');
                chip.className = `chip-btn ${className}`;
                chip.innerText = tag;
                chip.onclick = () => {
                    if (selected.has(tag)) selected.delete(tag);
                    else selected.add(tag);
                    chip.classList.toggle('selected', selected.has(tag));
                };
                chips.appendChild(chip);
            });
            group.appendChild(groupTitle);
            group.appendChild(chips);
            tagWrap.appendChild(group);
        };
        addGroup(t('ai.hashtags_from_library', 'Depuis vos dossiers'), knownTags, 'known-tag');
        addGroup(t('ai.hashtags_new', 'Nouveaux suggérés'), newTags, 'new-tag');
        if (!knownTags.length && !newTags.length) cleanTags.forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'chip-btn';
            chip.innerText = tag;
            tagWrap.appendChild(chip);
        });

        const row = document.createElement('div');
        row.className = 'tools-row';
        const getSelectedTags = () => selected.size ? Array.from(selected) : [];

        const appendBtn = document.createElement('button');
        appendBtn.className = 'btn-primary small';
        appendBtn.innerText = t('ai.add_selected_hashtags', 'Ajouter sélection');
        appendBtn.onclick = () => {
            const picked = getSelectedTags();
            if (!picked.length) return showToast(t('ai.select_hashtags_first', 'Sélectionnez des hashtags'));
            const existing = extractHashtags(captionArea.value);
            const toAdd = picked.filter(tag => !existing.includes(tag));
            captionArea.value += (captionArea.value.trim() ? '\n' : '') + toAdd.join(' ');
            updateCounters();
            calculateSEO();
            box.classList.add('hidden');
            showToast(t('toast.tags_added', 'Tags ajoutés'));
        };

        const replaceBtn = document.createElement('button');
        replaceBtn.className = 'btn-secondary small';
        replaceBtn.innerText = t('ai.replace_with_selected_hashtags', 'Remplacer par sélection');
        replaceBtn.onclick = () => {
            const picked = getSelectedTags();
            if (!picked.length) return showToast(t('ai.select_hashtags_first', 'Sélectionnez des hashtags'));
            captionArea.value = captionArea.value.replace(/#[\p{L}\p{N}_-]+/gu, '').trim();
            captionArea.value += (captionArea.value ? '\n' : '') + picked.join(' ');
            updateCounters();
            calculateSEO();
            box.classList.add('hidden');
            showToast(t('toast.tags_added', 'Tags ajoutés'));
        };

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-secondary small';
        copyBtn.innerText = t('common.copy', 'Copier');
        copyBtn.onclick = () => {
            const picked = getSelectedTags();
            if (!picked.length) return showToast(t('ai.select_hashtags_first', 'Sélectionnez des hashtags'));
            navigator.clipboard?.writeText(picked.join(' '));
            showToast(t('toast.folder_copied', 'Dossier copié !'));
        };

        row.appendChild(appendBtn);
        row.appendChild(replaceBtn);
        row.appendChild(copyBtn);
        item.appendChild(tagWrap);
        item.appendChild(row);
        box.appendChild(item);
        box.classList.toggle('hidden', !cleanTags.length);
    }

    function generatePlannerSummary(post) {
        if (!post || !(post.caption || post.planner_title || post.planner_comment)) {
            showToast(t('ai.no_content', 'Rien à résumer'));
            return;
        }
        showToast(t('ai.loading', 'Génération...'));
        runAiTask('note_summary', {
            caption: post.caption || '',
            planner_title: post.planner_title || '',
            planner_comment: post.planner_comment || ''
        }).then(result => {
            post.planner_title = result.title || post.planner_title || '';
            post.planner_comment = result.comment || post.planner_comment || '';
            saveAll();
            renderGrid();
            showToast(t('ai.note_ready', 'Encart rempli'));
        }).catch(err => showToast((err && err.error) ? err.error : t('ai.error', 'Erreur IA')));
    }

    function buildIdeasContext() {
        return (db.grid || []).filter(p => p.type !== 'spacer').slice(0, 20).map(p => ({
            title: p.title || p.planner_title || '',
            note: p.planner_comment || '',
            caption: (p.caption || '').slice(0, 600),
            campaign: p.campaign || '',
            tags: p.internal_tags || []
        })).map(p => JSON.stringify(p)).join('\n');
    }

    function renderAiList(container, items, onUse) {
        container.innerHTML = '';
        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'ai-list-item';
            const title = document.createElement('strong');
            title.innerText = item.title || item.reason || t('ai.idea', 'Idée');
            const body = document.createElement('div');
            body.innerText = item.comment || item.suggestion || item.caption || '';
            const actions = document.createElement('div');
            actions.className = 'tools-row';
            const btn = document.createElement('button');
            btn.className = 'btn-primary small';
            btn.innerText = t('common.validate', 'Valider');
            btn.onclick = () => onUse(item, index);
            actions.appendChild(btn);
            row.appendChild(title);
            row.appendChild(body);
            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    function renderRedundancyFindings(container, findings) {
        container.innerHTML = '';
        findings.forEach((finding) => {
            const row = document.createElement('div');
            row.className = 'ai-list-item redundancy-finding';
            const title = document.createElement('strong');
            const ids = finding.posts || [];
            title.innerText = `${t('ai.redundancy_group', 'Posts proches')} : ${ids.map(id => String(id).slice(0, 8)).join(', ')}`;
            const body = document.createElement('div');
            body.innerText = [finding.reason, finding.suggestion].filter(Boolean).join('\n');
            const actions = document.createElement('div');
            actions.className = 'tools-row';

            const selectBtn = document.createElement('button');
            selectBtn.className = 'btn-primary small';
            selectBtn.innerText = t('ai.select_posts', 'Sélectionner');
            selectBtn.onclick = () => selectRedundantPosts(ids);

            const openBtn = document.createElement('button');
            openBtn.className = 'btn-secondary small';
            openBtn.innerText = t('ai.open_first_post', 'Ouvrir le 1er');
            openBtn.onclick = () => openRedundantPost(ids[0]);

            const rewriteBtn = document.createElement('button');
            rewriteBtn.className = 'btn-secondary small';
            rewriteBtn.innerText = t('ai.rewrite_to_differentiate', 'Variante pour différencier');
            rewriteBtn.onclick = () => generateDifferentiationVariant(ids, finding);

            actions.appendChild(selectBtn);
            actions.appendChild(openBtn);
            actions.appendChild(rewriteBtn);
            row.appendChild(title);
            row.appendChild(body);
            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    function selectRedundantPosts(ids) {
        selectedPostIds = new Set((ids || []).filter(id => db.grid.some(p => p.id === id)));
        lastSelectedPostId = ids && ids[0] ? ids[0] : null;
        globalSearchTerm = '';
        const search = document.getElementById('global-search');
        if (search) search.value = '';
        renderGrid();
        showToast(t('toast.batch_selected', '{count} post(s) sélectionné(s)').replace('{count}', selectedPostIds.size));
    }

    function openRedundantPost(id) {
        const post = db.grid.find(p => p.id === id);
        if (post && post.type !== 'spacer') openModal(post);
    }

    function generateDifferentiationVariant(ids, finding) {
        const targetId = (ids || []).find(id => db.grid.some(p => p.id === id && p.type !== 'spacer'));
        const post = db.grid.find(p => p.id === targetId);
        if (!post) return;
        openModal(post);
        const instruction = document.getElementById('ai-instruction');
        if (instruction) {
            instruction.value = `${t('ai.differentiate_instruction', 'Différencie ce post des contenus similaires sans changer son intention.')}\n${finding.suggestion || finding.reason || ''}`.trim();
        }
        const btn = document.getElementById('btn-ai-variants');
        if (btn) btn.click();
    }

    function fillAiSettings() {
        const ai = safety.ai_settings || {};
        const provider = ai.provider || 'ollama';
        const defaults = aiProviderDefaults(provider);
        const ids = {
            'ai-provider': provider,
            'ai-model': ai.model || defaults.model,
            'ai-base-url': ai.base_url || defaults.base_url,
            'ai-api-key': ai.api_key || ''
        };
        Object.entries(ids).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });
        aiSettingsHydrated = true;
        updateAiProviderDefaults(false);
        fillAiPromptSettings();
        renderAiPromptControls();
    }

    const aiUsePromptBtn = document.getElementById('btn-ai-use-prompt');
    if (aiUsePromptBtn) {
        aiUsePromptBtn.onclick = applySelectedAiPrompt;
    }

    const aiProviderSelect = document.getElementById('ai-provider');
    if (aiProviderSelect) {
        aiProviderSelect.addEventListener('change', () => updateAiProviderDefaults(true));
    }

    const aiGenerateBtn = document.getElementById('btn-ai-generate');
    if (aiGenerateBtn) {
        aiGenerateBtn.onclick = () => {
            const text = captionArea.value;
            const instruction = document.getElementById('ai-instruction').value;
            const status = document.getElementById('ai-status');
            const applyBtn = document.getElementById('btn-ai-apply');
            const preview = document.getElementById('ai-preview');
            if (status) status.innerText = t('ai.loading', 'Génération...');
            if (applyBtn) applyBtn.classList.add('hidden');

            fetch('/api/ai/rewrite', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ text, instruction, settings: collectAiSettings() })
            }).then(r => {
                if (!r.ok) return r.json().then(err => Promise.reject(err));
                return r.json();
            }).then(result => {
                pendingAiText = result.after || '';
                document.getElementById('ai-before').innerText = result.before || '';
                document.getElementById('ai-after').innerText = pendingAiText;
                if (preview) preview.classList.remove('hidden');
                if (applyBtn) applyBtn.classList.remove('hidden');
                if (status) status.innerText = t('ai.ready', 'Proposition prête');
            }).catch(err => {
                if (status) status.innerText = t('ai.error', 'Erreur IA');
                showToast((err && err.error) ? err.error : t('ai.error', 'Erreur IA'));
            });
        };
    }

    const aiVariantsBtn = document.getElementById('btn-ai-variants');
    if (aiVariantsBtn) {
        aiVariantsBtn.onclick = () => {
            const status = document.getElementById('ai-status');
            if (status) status.innerText = t('ai.loading', 'Génération...');
            runAiTask('variants', {
                caption: captionArea.value,
                instruction: document.getElementById('ai-instruction').value,
                count: 3
            }).then(result => {
                const variants = result.variants || [];
                renderAiOptions(variants, (text) => {
                    captionArea.value = text;
                    updateCounters();
                    calculateSEO();
                    checkContentSafety();
                    document.getElementById('ai-options').classList.add('hidden');
                    showToast(t('ai.applied', 'Proposition appliquée'));
                });
                if (status) status.innerText = t('ai.ready', 'Proposition prête');
            }).catch(err => {
                if (status) status.innerText = t('ai.error', 'Erreur IA');
                showToast((err && err.error) ? err.error : t('ai.error', 'Erreur IA'));
            });
        };
    }

    const aiHashtagsBtn = document.getElementById('btn-ai-hashtags');
    if (aiHashtagsBtn) {
        aiHashtagsBtn.onclick = () => {
            const status = document.getElementById('ai-status');
            if (status) status.innerText = t('ai.loading', 'Génération...');
            runAiTask('hashtags', {
                caption: captionArea.value,
                hashtag_folders: safety.hashtag_folders || {}
            }).then(result => {
                const tags = result.hashtags || [];
                renderHashtagSuggestionOptions(tags);
                if (status) status.innerText = t('ai.ready', 'Proposition prête');
            }).catch(err => {
                if (status) status.innerText = t('ai.error', 'Erreur IA');
                showToast((err && err.error) ? err.error : t('ai.error', 'Erreur IA'));
            });
        };
    }

    const aiApplyBtn = document.getElementById('btn-ai-apply');
    if (aiApplyBtn) {
        aiApplyBtn.onclick = () => {
            if (!pendingAiText) return;
            captionArea.value = pendingAiText;
            checkContentSafety();
            updateCounters();
            calculateSEO();
            resetAiPreview();
            showToast(t('ai.applied', 'Proposition appliquée'));
        };
    }

    const templateReplaceBtn = document.getElementById('btn-template-replace');
    if (templateReplaceBtn) templateReplaceBtn.onclick = () => applySelectedTemplate('replace');
    const templateAppendBtn = document.getElementById('btn-template-append');
    if (templateAppendBtn) templateAppendBtn.onclick = () => applySelectedTemplate('append');

    function checkContentSafety() {
        const text = captionArea.value.toLowerCase();
        const box = document.getElementById('censure-box');
        box.innerHTML = ''; box.classList.add('hidden');
        let found = false;
        
        if (safety.sensitive_words) {
             safety.sensitive_words.forEach(word => {
                if (text.includes(word.toLowerCase())) {
                    found = true;
                    const leet = generateLeetspeak(word);
                    const div = document.createElement('div');
                    div.innerHTML = `⚠️ <b>${word}</b> <button class="suggestion-btn">${t('censure.replace_with', 'Remplacer par "{word}"').replace('{word}', leet)}</button>`;
                    div.querySelector('button').onclick = () => {
                        captionArea.value = captionArea.value.replace(new RegExp(word, 'gi'), leet);
                        checkContentSafety();
                    };
                    box.appendChild(div);
                }
            });
        }
        if (found) box.classList.remove('hidden');
    }

    function generateLeetspeak(word) {
        const map = { 'a': '@', 'e': '€', 'i': '1', 'o': '0', 's': '$', 'l': '|' };
        return word.split('').map(c => map[c.toLowerCase()] || c).join('');
    }

    function calculateSEO() {
        const text = captionArea.value;
        const tags = (text.match(/#/g) || []).length;
        const len = text.length;
        let score = 0;

        const okLen = len > 50 && len < 2200;
        const okTags = tags >= 5 && tags <= 30;
        const okQue = text.includes('?');
        const okFmt = text.includes('\n\n');

        if (okLen) score += 40;
        if (okTags) score += 30;
        if (okQue) score += 10;
        if (okFmt) score += 20;

        document.getElementById('seo-score').innerText = `${score}/100`;
        const prog = document.getElementById('seo-progress');
        prog.style.width = `${score}%`;
        prog.style.backgroundColor = score > 70 ? '#10b981' : '#fbbf24';

        document.getElementById('seo-len').className = okLen ? 'valid' : '';
        document.getElementById('seo-tags').className = okTags ? 'valid' : '';
        document.getElementById('seo-que').className = okQue ? 'valid' : '';
        document.getElementById('seo-fmt').className = okFmt ? 'valid' : '';
    }

    document.getElementById('btn-quick-ban').onclick = () => {
        const inp = document.getElementById('inp-quick-ban');
        const word = inp.value.trim().toLowerCase();
        if(word) {
            if(!safety.sensitive_words) safety.sensitive_words = [];
            if(!safety.sensitive_words.includes(word)) {
                safety.sensitive_words.push(word);
                saveAll();
                inp.value = '';
                checkContentSafety();
                showToast(t('toast.censure_added', '"{word}" ajouté à la censure').replace('{word}', word));
            }
        }
    };

    // --- SAVE POST (Modifié pour Titre) ---
    document.getElementById('btn-save-post').onclick = () => {
        const post = db.grid.find(p => p.id === currentPostId);
        if(!post) return;
        
        post.caption = document.getElementById('inp-caption').value;
        post.tags = document.getElementById('inp-tags').value;
        post.first_comment = document.getElementById('inp-comment').value;
        post.publish_date = document.getElementById('inp-date').value;
        post.publish_time = document.getElementById('inp-time').value;
        post.status = document.getElementById('post-status-select').value;
        post.campaign = document.getElementById('post-campaign-select').value;
        post.internal_tags = document.getElementById('post-internal-tags').value.split(',').map(v => v.trim()).filter(Boolean);
        
        // Sauvegarde du Titre (Ghost)
        if(post.type === 'ghost') {
            post.title = document.getElementById('inp-title').value;
        }

        fetch('/api/save_post_structure', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({post: post})
        }).then(r => r.json()).then(d => {
            const idx = db.grid.findIndex(p => p.id === d.post.id);
            if(idx >= 0) db.grid[idx] = d.post;
            modal.classList.add('hidden'); renderGrid(); showToast(t('toast.saved', 'Sauvegardé !'));
        });
    };

    // --- UTILS ---
    document.getElementById('btn-duplicate-post').onclick = () => {
        fetch('/api/duplicate_post', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id: currentPostId})
        }).then(r=>r.json()).then(clone => {
            db.grid.unshift(clone); saveAll(); renderGrid(); showToast(t('toast.duplicated', 'Dupliqué !')); openModal(clone);
        });
    };

    const convertDraftBtn = document.getElementById('btn-convert-draft');
    if (convertDraftBtn) {
        convertDraftBtn.onclick = () => {
            const post = db.grid.find(p => p.id === currentPostId);
            if (!post || post.type !== 'ghost') return;
            post.type = 'post';
            post.title = document.getElementById('inp-title').value || post.title || '';
            fetch('/api/save_post_structure', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({post})
            }).then(r => r.json()).then(d => {
                const idx = db.grid.findIndex(p => p.id === d.post.id);
                if(idx >= 0) db.grid[idx] = d.post;
                renderGrid();
                showToast(t('toast.draft_converted', 'Brouillon transformé en post'));
                openModal(d.post);
            });
        };
    }

    document.getElementById('btn-smart-duplicate-post').onclick = () => {
        const post = db.grid.find(p => p.id === currentPostId);
        if (!post) return;
        const status = document.getElementById('ai-status');
        if (status) status.innerText = t('ai.loading', 'Génération...');
        runAiTask('variants', {
            caption: captionArea.value || post.caption || '',
            instruction: t('ai.smart_duplicate_instruction', 'Crée des variantes distinctes pour une duplication intelligente.'),
            count: 3
        }).then(result => {
            const variants = result.variants || [];
            renderAiOptions(variants, (text) => createDuplicateWithCaption(text));
            if (status) status.innerText = t('ai.choose_variant', 'Choisissez une variante à dupliquer');
        }).catch(err => {
            if (status) status.innerText = t('ai.error', 'Erreur IA');
            showToast((err && err.error) ? err.error : t('ai.error', 'Erreur IA'));
        });
    };

    function createDuplicateWithCaption(caption) {
        fetch('/api/duplicate_post', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id: currentPostId, caption_override: caption})
        }).then(r => {
            if (!r.ok) throw new Error('duplicate failed');
            return r.json();
        }).then(clone => {
            return enrichSmartDuplicateNote(clone, caption);
        }).catch(() => showToast(t('toast.save_error', 'Erreur sauvegarde')));
    }

    function enrichSmartDuplicateNote(clone, caption) {
        return runAiTask('note_summary', {
            caption,
            planner_title: clone.planner_title || clone.title || '',
            planner_comment: clone.planner_comment || ''
        }).then(summary => {
            clone.planner_title = summary.title || clone.planner_title || '';
            clone.planner_comment = summary.comment || clone.planner_comment || '';
            if (clone.type === 'ghost' && clone.planner_title) clone.title = clone.planner_title;
            return fetch('/api/save_post_structure', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({post: clone})
            }).then(r => r.ok ? r.json() : Promise.reject(new Error('save failed')))
              .then(d => d.post || clone);
        }).catch(() => clone).then(finalClone => {
            db.grid.unshift(finalClone);
            saveAll();
            renderGrid();
            resetAiPreview();
            showToast(t('toast.smart_duplicated', 'Duplication intelligente prête'));
            openModal(finalClone);
        });
    }

    document.getElementById('btn-delete-post').onclick = () => {
        if(confirm(t('confirm.delete_post', 'Supprimer ?'))) {
            const idToDelete = currentPostId;
            fetch('/api/delete_post', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id: idToDelete})
            }).then(r => {
                if (!r.ok) throw new Error('delete failed');
                return r.json();
            }).then(() => {
                db.grid = db.grid.filter(p => p.id !== idToDelete);
                renderGrid();
                modal.classList.add('hidden');
                showToast(t('toast.deleted', 'Post supprimé'));
            }).catch(() => showToast(t('toast.delete_error', 'Erreur suppression')));
        }
    };

    document.getElementById('btn-open-folder').onclick = () => {
        fetch('/api/open_folder', {method: 'POST'});
        showToast(t('toast.folder_opened', 'Dossier ouvert'));
    };

    function saveAll() {
        fetch('/api/save_all', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ db: db, safety: safety })
        });
    }

    function updateCounters() { document.getElementById('counter-caption').innerText = `${captionArea.value.length}/2200`; }
    
    function renderHashtagsCollections() {
        const c = document.getElementById('hashtags-collections'); c.innerHTML = '';
        if (safety.hashtag_folders) {
            for (const [name, tags] of Object.entries(safety.hashtag_folders)) {
                const chip = document.createElement('span'); 
                chip.className = 'chip-btn'; 
                chip.style.marginRight='5px'; 
                chip.innerText = `📁 ${name}`;
                chip.onclick = () => {
                    captionArea.value += (captionArea.value ? "\n" : "") + tags.join(' ');
                    updateCounters(); calculateSEO();
                    showToast(t('toast.tags_added', 'Tags "{name}" ajoutés').replace('{name}', name));
                };
                c.appendChild(chip);
            }
        }
    }
    
    function showToast(msg) {
        const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
        document.getElementById('toast-container').appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }

    // --- TABS HANDLING (FIX QR CODE HERE) ---
    document.querySelectorAll('.tab-btn, .set-tab').forEach(btn => {
        btn.onclick = () => {
            const parent = btn.closest(btn.classList.contains('set-tab') ? '.settings-body' : '.modal-content');
            parent.querySelectorAll('.tab-btn, .set-tab').forEach(b => b.classList.remove('active'));
            parent.querySelectorAll('.tab-content, .set-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.dataset.target;
            document.getElementById(targetId).classList.add('active');
            
            // Si on ouvre l'onglet Export, on génère le QR Code
            if (targetId === 'tab-export') {
                setTimeout(generateQR, 50); // Petit délai pour être sûr que le DOM est visible
            }
        };
    });
    
    document.querySelectorAll('.close-modal').forEach(b=>b.onclick=()=>b.closest('.modal-overlay, .modal').classList.add('hidden'));

    // --- DRAG & DROP GRID ---
    new Sortable(gridEl, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        filter: '.post-note-card, .post-note-card *',
        preventOnFilter: false,
        onStart: () => { isSortingGrid = true; },
        onEnd: () => {
            setTimeout(() => { isSortingGrid = false; }, 0);
            const newOrderIds = Array.from(gridEl.children).map(d => d.dataset.id);
            const newGrid = [];
            newOrderIds.forEach(id => {
                const item = db.grid.find(i => i.id === id);
                if(item) newGrid.push(item);
            });
            db.grid = newGrid;
            saveAll();
        }
    });

    // --- DRAG & DROP UPLOAD ---
    const dropZone = document.getElementById('drop-overlay');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => document.body.addEventListener(e, (ev) => { ev.preventDefault(); ev.stopPropagation(); }));
    function dragHasFiles(e) {
        return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    }
    document.body.addEventListener('dragenter', (e) => {
        const settingsModal = document.getElementById('settingsModal');
        const localDropZone = e.target && e.target.closest && e.target.closest('.mini-drop-zone, #profile-avatar-drop');
        const avatarBox = document.getElementById('profile-avatar-drop');
        const overAvatar = avatarBox && (() => {
            const rect = avatarBox.getBoundingClientRect();
            return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        })();
        const editModalOpen = modal && !modal.classList.contains('hidden');
        const settingsOpen = settingsModal && !settingsModal.classList.contains('hidden');
        if (isSortingGrid || !dragHasFiles(e) || editModalOpen || settingsOpen || localDropZone || overAvatar) {
            if (overAvatar) dropZone.classList.add('hidden');
            return;
        }
        dropZone.classList.remove('hidden');
    });
    dropZone.addEventListener('dragleave', (e) => { if(e.clientX===0 && e.clientY===0) dropZone.classList.add('hidden'); });
    dropZone.addEventListener('drop', (e) => {
        dropZone.classList.add('hidden');
        if (isSortingGrid || !dragHasFiles(e)) return;
        handleFiles(e.dataTransfer.files);
    });

    const fileInp = document.getElementById('file-input');
    document.getElementById('nav-create').onclick = () => fileInp.click();
    fileInp.onchange = (e) => handleFiles(e.target.files);

    function setupFileDropZone(zone, onFiles) {
        if (!zone) return;
        zone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!dragHasFiles(e)) return;
            if (zone.id === 'profile-avatar-drop') dropZone?.classList.add('hidden');
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!dragHasFiles(e)) return;
            if (zone.id === 'profile-avatar-drop') dropZone?.classList.add('hidden');
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
            if (!dragHasFiles(e)) return;
            onFiles(e.dataTransfer.files);
        });
    }

    const postMediaInput = document.getElementById('post-media-input');
    const addMediaBtn = document.getElementById('btn-add-media');
    if (addMediaBtn && postMediaInput) {
        addMediaBtn.onclick = () => postMediaInput.click();
        postMediaInput.onchange = (e) => addMediaToCurrentPost(e.target.files);
    }
    setupFileDropZone(document.getElementById('post-media-drop-zone'), addMediaToCurrentPost);

    const backupInput = document.getElementById('backup-input');
    const importBackupBtn = document.getElementById('nav-import-backup');
    if (importBackupBtn && backupInput) {
        importBackupBtn.onclick = () => backupInput.click();
        backupInput.onchange = (e) => importBackup(e.target.files);
    }

    const avatarDropZone = document.getElementById('avatar-drop-zone');
    const avatarInput = document.getElementById('avatar-input');
    if (avatarDropZone && avatarInput) {
        avatarDropZone.onclick = () => { avatarInput.dataset.target = 'settings'; avatarInput.click(); };
        avatarInput.accept = 'image/*';
        avatarInput.onchange = (e) => {
            if (avatarInput.dataset.target === 'profile') importAvatarDirect(e.target.files);
            else importAvatar(e.target.files);
            avatarInput.value = '';
            avatarInput.dataset.target = '';
        };
        setupFileDropZone(avatarDropZone, importAvatar);
    }
    const profileAvatarDrop = document.getElementById('profile-avatar-drop');
    if (profileAvatarDrop && avatarInput) {
        profileAvatarDrop.onclick = () => { avatarInput.dataset.target = 'profile'; avatarInput.click(); };
        setupFileDropZone(profileAvatarDrop, importAvatarDirect);
    }

    const profileGalleryDrop = document.getElementById('profile-gallery-drop-zone');
    const profileGalleryInput = document.getElementById('profile-gallery-input');
    if (profileGalleryDrop && profileGalleryInput) {
        profileGalleryDrop.onclick = () => profileGalleryInput.click();
        profileGalleryInput.onchange = (e) => {
            importProfileGalleryPhotos(e.target.files);
            profileGalleryInput.value = '';
        };
        setupFileDropZone(profileGalleryDrop, importProfileGalleryPhotos);
    }

    const profileGalleryCleanupBtn = document.getElementById('profile-gallery-cleanup-btn');
    if (profileGalleryCleanupBtn) {
        profileGalleryCleanupBtn.onclick = () => {
            // 1) Dry-run pour montrer ce qui va se passer
            fetch('/api/cleanup_profile_photo_dupes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dry_run: true })
            })
                .then(r => r.ok ? r.json() : Promise.reject(new Error('cleanup dry_run failed')))
                .then(report => {
                    const dupeCount = (report.removed || []).length;
                    if (!dupeCount) {
                        showToast(t('toast.cleanup_no_dupes', 'Aucun doublon détecté'));
                        return;
                    }
                    const msg = t('confirm.cleanup_dupes',
                        '{count} doublon(s) détecté(s). Conserver les versions dans "Photo profils - programmees" et supprimer les autres ?')
                        .replace('{count}', dupeCount);
                    if (!confirm(msg)) return;
                    return fetch('/api/cleanup_profile_photo_dupes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dry_run: false })
                    })
                        .then(r => r.ok ? r.json() : Promise.reject(new Error('cleanup failed')))
                        .then(finalReport => {
                            const removed = (finalReport.removed || []).length;
                            // Recharger safety pour refléter les URLs remappées.
                            return fetch('/api/data').then(r => r.json()).then(data => {
                                if (data && data.safety) safety = data.safety;
                                if (data && data.db) db = data.db;
                                renderProfilePhotoGallery();
                                renderPlanningPanel();
                                showToast(t('toast.cleanup_done',
                                    '{count} doublon(s) supprimé(s)').replace('{count}', removed));
                            });
                        });
                })
                .catch(() => showToast(t('toast.save_error', 'Erreur sauvegarde')));
        };
    }

    function importAvatar(files) {
        if (!files.length) return;
        uploadMediaFiles([files[0]], 'profile_avatar').then(items => {
            if (!items.length) return;
            document.getElementById('inputAvatar').value = items[0].src;
            showToast(t('toast.avatar_ready', 'Avatar prêt, pensez à enregistrer'));
        });
    }

    function importAvatarDirect(files) {
        if (!files.length) return;
        uploadMediaFiles([files[0]], 'profile_avatar').then(items => {
            if (!items.length) return;
            if (!db.profile) db.profile = {};
            db.profile.avatar = items[0].src;
            updateUI();
            saveAll();
            showToast(t('toast.avatar_saved', 'Photo de profil enregistrée'));
        });
    }

    function importProfileGalleryPhotos(files) {
        if (!files.length) return;
        const kind = document.getElementById('profile-gallery-kind')?.value || 'unscheduled';
        const date = document.getElementById('profile-gallery-date')?.value || '';
        const note = document.getElementById('profile-gallery-note')?.value || '';
        if (kind === 'scheduled' && !date) return showToast(t('planning.quick_date', 'Date rapide'));
        uploadMediaFiles(files, kind === 'scheduled' ? 'profile_avatar_scheduled' : 'profile_avatar').then(items => {
            if (!items.length) return;
            if (!Array.isArray(safety.profile_photo_gallery)) safety.profile_photo_gallery = [];
            if (!Array.isArray(safety.profile_photo_plans)) safety.profile_photo_plans = [];
            items.forEach((item, index) => {
                const entryNote = items.length > 1 ? `${note || t('planning.profile_photo', 'Photo profil')} ${index + 1}` : note;
                if (kind === 'scheduled') {
                    safety.profile_photo_plans.push({ date, url: item.src, note: entryNote, kind: 'ephemeral' });
                } else {
                    safety.profile_photo_gallery.push({ url: item.src, note: entryNote, kind: 'unscheduled' });
                }
            });
            syncProfilePhotoPlansToTextarea();
            renderProfilePhotoGallery();
            renderPlanningPanel();
            saveAll();
            showToast(t('toast.media_added', 'Média ajouté'));
        });
    }

    function importBackup(files) {
        if (!files.length || !confirm(t('confirm.import_backup', 'Restaurer cette sauvegarde ? Les données du compte actif seront remplacées.'))) return;
        const fd = new FormData();
        fd.append('file', files[0]);
        fetch('/api/import_backup', { method: 'POST', body: fd })
            .then(r => {
                if (!r.ok) throw new Error('backup import failed');
                return r.json();
            })
            .then(() => {
                showToast(t('toast.backup_imported', 'Backup restauré'));
                loadAll();
            })
            .catch(() => showToast(t('toast.backup_import_error', 'Restauration impossible')));
    }

    // La zone "Glisser vos médias ici" est aussi cliquable (auparavant inerte).
    const dropHint = document.getElementById('drop-zone');
    if (dropHint) {
        dropHint.style.cursor = 'pointer';
        dropHint.onclick = () => fileInp.click();
    }

    function uploadMediaFiles(files, category = '') {
        if(!files.length) return Promise.resolve([]);
        const fd = new FormData();
        if (category) fd.append('category', category);
        Array.from(files).forEach(f => fd.append('file', f));
        return fetch('/api/upload', {method:'POST', body:fd}).then(r => r.json());
    }

    function handleFiles(files) {
        uploadMediaFiles(files).then(items => {
            const newPost = { id: Date.now().toString(), type: 'post', status: 'draft', media: items };
            fetch('/api/save_post_structure', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({post: newPost})
            }).then(r => r.json()).then(d => {
                db.grid.unshift(d.post); renderGrid(); showToast(t('toast.post_created', 'Post créé !')); openModal(d.post);
            });
        });
    }

    function addMediaToCurrentPost(files) {
        const post = db.grid.find(p => p.id === currentPostId);
        if (!post || !files.length) return;
        const wasGhost = post.type === 'ghost';
        uploadMediaFiles(files).then(items => {
            if (!post.media) post.media = [];
            post.media.push(...items);
            if (post.type === 'ghost') post.type = 'post';
            selectedMediaIndex = post.media.length - items.length;
            return fetch('/api/save_post_structure', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({post: post})
            });
        }).then(r => r.json()).then(d => {
            const idx = db.grid.findIndex(p => p.id === d.post.id);
            if(idx >= 0) db.grid[idx] = d.post;
            renderCarousel(d.post);
            renderGrid();
            showToast(wasGhost ? t('toast.draft_converted', 'Brouillon transformé en post') : t('toast.media_added', 'Média ajouté'));
            if (wasGhost) openModal(d.post);
        });
    }

    function updateMediaToolState(media) {
        const videoOnly = media && media.type === 'video';
        ['btn-video-frame', 'btn-video-cover'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = !videoOnly;
        });
    }
    
    document.getElementById('nav-spacer').onclick = () => {
        db.grid.unshift({id: Date.now().toString(), type:'spacer', status:'draft'});
        saveAll(); renderGrid();
    };
    
    document.querySelectorAll('.btn-ratio').forEach(b => {
        if(b.id !== 'btn-ghost-mode') {
            b.onclick = () => {
                document.querySelectorAll('.btn-ratio').forEach(x=>x.classList.remove('active')); b.classList.add('active');
                gridEl.className = `grid-layout ratio-${b.dataset.ratio}` 
                    + (gridEl.classList.contains('preview-mode') ? ' preview-mode' : '')
                    + (!notesVisible ? ' notes-hidden' : '');
            };
        }
    });

    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
        globalSearch.oninput = () => {
            globalSearchTerm = globalSearch.value.trim();
            renderGrid();
        };
    }

    function renderToolbarFilters() {
        const campaignSelect = document.getElementById('filter-campaign');
        const tagSelect = document.getElementById('filter-tag');
        if (campaignSelect) {
            const current = campaignSelect.value || activeCampaignFilter;
            campaignSelect.innerHTML = `<option value="">${t('organization.all_campaigns', 'Toutes campagnes')}</option>`;
            (safety.campaigns || []).forEach(campaign => {
                const option = document.createElement('option');
                option.value = campaign.name;
                option.innerText = campaign.name;
                campaignSelect.appendChild(option);
            });
            campaignSelect.value = current;
            campaignSelect.onchange = () => {
                activeCampaignFilter = campaignSelect.value;
                renderGrid();
            };
        }
        if (tagSelect) {
            const current = tagSelect.value || activeTagFilter;
            tagSelect.innerHTML = `<option value="">${t('organization.all_tags', 'Tous tags')}</option>`;
            (safety.internal_tags || []).forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.innerText = tag;
                tagSelect.appendChild(option);
            });
            tagSelect.value = current;
            tagSelect.onchange = () => {
                activeTagFilter = tagSelect.value;
                renderGrid();
            };
        }
    }

    const clearFiltersBtn = document.getElementById('btn-clear-filters');
        if (clearFiltersBtn) {
        clearFiltersBtn.onclick = () => {
            activeCampaignFilter = '';
            activeTagFilter = '';
            activeDateFilter = '';
            globalSearchTerm = '';
            if (globalSearch) globalSearch.value = '';
            renderToolbarFilters();
            renderGrid();
            showToast(t('toast.filters_cleared', 'Filtres réinitialisés'));
        };
    }

    const remindersBtn = document.getElementById('btn-local-reminders');
    if (remindersBtn) remindersBtn.onclick = openRemindersPanel;

    function datedPosts() {
        return (db.grid || [])
            .filter(post => post.type !== 'spacer' && post.publish_date)
            .slice()
            .sort((a, b) => `${a.publish_date || ''} ${a.publish_time || ''}`.localeCompare(`${b.publish_date || ''} ${b.publish_time || ''}`));
    }

    function postLabel(post) {
        return post.planner_title || post.title || (post.caption || '').slice(0, 42) || String(post.id || '').slice(0, 8);
    }

    function planningPostPill(post) {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `planning-post status-${post.status || 'draft'}`;
        pill.dataset.postId = post.id || '';
        pill.innerText = '';
        if (post.publish_time) {
            const time = document.createElement('span');
            time.className = 'planning-post-time';
            time.innerText = post.publish_time;
            pill.appendChild(time);
        }
        const label = document.createElement('span');
        label.className = 'planning-post-label';
        label.innerText = postLabel(post);
        pill.appendChild(label);
        pill.draggable = true;
        pill.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-instalocalplanner-posts', JSON.stringify([post.id]));
            e.dataTransfer.setData('text/plain', post.id);
        });
        pill.onclick = () => openModal(post);
        pill.addEventListener('contextmenu', (e) => showPlanningContextMenu(e, post.publish_date || '', post));
        return pill;
    }

    function getDraggedPostIds(e) {
        const raw = e.dataTransfer.getData('application/x-instalocalplanner-posts') || e.dataTransfer.getData('text/plain') || '';
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch (err) {
            return raw.split(',').map(v => v.trim()).filter(Boolean);
        }
        return [];
    }

    function reorderPostsWithinDate(date, orderedIds) {
        const ids = orderedIds.filter(Boolean);
        const dayPosts = (db.grid || []).filter(post => post.type !== 'spacer' && post.publish_date === date);
        if (dayPosts.length < 2 || ids.length !== dayPosts.length) return;
        const dayIdSet = new Set(dayPosts.map(post => post.id));
        if (!ids.every(id => dayIdSet.has(id))) return;
        const ordered = ids.map(id => dayPosts.find(post => post.id === id)).filter(Boolean);
        let cursor = 0;
        db.grid = (db.grid || []).map(post => {
            if (post.type !== 'spacer' && post.publish_date === date) return ordered[cursor++] || post;
            return post;
        });
        saveAll();
        renderGrid();
        renderPlanningPanel();
        showToast(t('toast.planning_order_updated', 'Ordre du jour mis à jour'));
    }

    function appendPlanningPostList(parent, date, posts) {
        const list = document.createElement('div');
        list.className = 'planning-post-list';
        (posts || []).forEach(post => list.appendChild(planningPostPill(post)));
        parent.appendChild(list);
        if (posts.length > 1 && window.Sortable) {
            new Sortable(list, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                draggable: '.planning-post',
                onEnd: () => reorderPostsWithinDate(date, Array.from(list.children).map(item => item.dataset.postId))
            });
        }
    }

    function assignPostsToDate(ids, date) {
        const targets = (ids || []).map(id => db.grid.find(post => post.id === id)).filter(post => post && post.type !== 'spacer');
        if (!targets.length || !date) return;
        targets.forEach(post => { post.publish_date = date; });
        Promise.all(targets.map(post => fetch('/api/save_post_structure', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({post})
        }).then(r => r.ok ? r.json() : Promise.reject(new Error('save failed')))))
            .then(results => {
                results.forEach(result => {
                    const idx = db.grid.findIndex(p => p.id === result.post.id);
                    if (idx >= 0) db.grid[idx] = result.post;
                });
                renderGrid();
                renderPlanningPanel();
                showToast(t('toast.date_updated', 'Date mise à jour'));
            })
            .catch(() => showToast(t('toast.save_error', 'Erreur sauvegarde')));
    }

    function moveMarkerEdge(payload, date) {
        if (!payload || typeof payload.index !== 'number' || !date) return false;
        const marker = (safety.calendar_markers || [])[payload.index];
        if (!marker) return false;
        const start = marker.start || date;
        const end = marker.end || start;
        if (payload.edge === 'start') {
            marker.start = date <= end ? date : end;
            marker.end = date <= end ? end : date;
        } else {
            marker.start = date >= start ? start : date;
            marker.end = date >= start ? date : start;
        }
        syncCalendarMarkersToTextarea();
        saveAll();
        renderPlanningPanel();
        showToast(t('toast.marker_dates_updated', 'Dates du repère mises à jour'));
        return true;
    }

    function closePlanningContextMenu() {
        document.querySelector('.planning-context-menu')?.remove();
        document.removeEventListener('pointerdown', handlePlanningContextOutside);
    }

    function handlePlanningContextOutside(e) {
        if (e.target.closest('.planning-context-menu')) return;
        closePlanningContextMenu();
    }

    function addCalendarMarkerFromDate(date, options = {}) {
        if (!Array.isArray(safety.calendar_markers)) safety.calendar_markers = [];
        safety.calendar_markers.push({
            name: options.name || t('organization.new_marker', 'Nouveau repère'),
            color: options.color || '#4ec9b0',
            start: date,
            end: options.end || date,
            notes: options.notes || '',
            type: options.type || ''
        });
        syncCalendarMarkersToTextarea();
        saveAll();
        renderPlanningPanel();
    }

    function addDaysIso(date, days) {
        const d = new Date(`${date}T00:00:00`);
        if (Number.isNaN(d.getTime())) return date;
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
    }

    function copyText(text, message) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => showToast(message)).catch(() => showToast(text));
        } else {
            showToast(text);
        }
    }

    function promptMarkerForDate(date) {
        const name = window.prompt(t('organization.marker_name', 'Nom'), t('organization.new_marker', 'Nouveau repère'));
        if (name === null) return;
        const end = window.prompt(t('planning.marker_end_date', 'Fin du repère'), date) || date;
        addCalendarMarkerFromDate(date, { name: name.trim() || t('organization.new_marker', 'Nouveau repère'), end: end < date ? date : end });
    }

    function showMarkerQuickEditor(date) {
        closePlanningContextMenu();
        const menu = document.createElement('div');
        menu.className = 'planning-context-menu planning-context-form';
        menu.innerHTML = `
            <label>${t('organization.marker_name', 'Nom')}</label>
            <input class="planning-menu-input" data-field="name" value="${t('organization.new_marker', 'Nouveau repère')}">
            <label>${t('planning.quick_date', 'Date rapide')}</label>
            <input class="planning-menu-input" data-field="start" type="date" value="${date}">
            <label>${t('planning.marker_end_date', 'Fin du repère')}</label>
            <input class="planning-menu-input" data-field="end" type="date" value="${date}">
            <label>${t('organization.marker_color', 'Couleur')}</label>
            <input class="planning-menu-input" data-field="color" type="color" value="#4ec9b0">
            <div class="planning-menu-actions">
                <button type="button" data-action="save">${t('common.save', 'Enregistrer')}</button>
                <button type="button" data-action="cancel">${t('common.close', 'Fermer')}</button>
            </div>
        `;
        document.body.appendChild(menu);
        menu.style.left = '50%';
        menu.style.top = '50%';
        menu.style.transform = 'translate(-50%, -50%)';
        menu.querySelector('[data-action="cancel"]').onclick = closePlanningContextMenu;
        menu.querySelector('[data-action="save"]').onclick = () => {
            const name = menu.querySelector('[data-field="name"]').value.trim();
            const start = menu.querySelector('[data-field="start"]').value || date;
            const endRaw = menu.querySelector('[data-field="end"]').value || start;
            const end = endRaw < start ? start : endRaw;
            const color = menu.querySelector('[data-field="color"]').value || '#4ec9b0';
            closePlanningContextMenu();
            addCalendarMarkerFromDate(start, { name: name || t('organization.new_marker', 'Nouveau repère'), end, color });
        };
    }

    function unprogramPost(post) {
        if (!post) return;
        post.publish_date = '';
        post.publish_time = '';
        savePostQuickUpdate(post, t('toast.date_updated', 'Date mise à jour'));
    }

    function editPostPlanningFromMenu(post, fallbackDate) {
        if (!post) return;
        const nextDate = window.prompt(t('planning.quick_date', 'Date rapide'), post.publish_date || fallbackDate || '');
        if (nextDate === null) return;
        const nextTime = window.prompt(t('planning.quick_time', 'Heure rapide'), post.publish_time || '');
        if (nextTime === null) return;
        post.publish_date = nextDate.trim();
        post.publish_time = nextTime.trim();
        savePostQuickUpdate(post, t('toast.date_updated', 'Date mise à jour'));
    }

    function showPlanningContextMenu(e, date, post = null) {
        e.preventDefault();
        e.stopPropagation();
        closePlanningContextMenu();
        const menu = document.createElement('div');
        menu.className = 'planning-context-menu';

        const addItem = (icon, label, action, disabled = false) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.disabled = disabled;
            btn.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span>${label}</span>`;
            btn.addEventListener('pointerdown', (ev) => ev.stopPropagation());
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                closePlanningContextMenu();
                if (!disabled) action();
            });
            menu.appendChild(btn);
        };

        if (post) {
            addItem('open_in_new', t('ai.open_first_post', 'Ouvrir'), () => openModal(post));
            addItem('event_busy', t('planning.unprogram_post', 'Déprogrammer le post'), () => unprogramPost(post));
            addItem('edit_calendar', t('planning.edit_post_schedule', 'Modifier date / heure'), () => editPostPlanningFromMenu(post, date));
            addItem('content_copy', t('planning.copy_date', 'Copier date'), () => copyText(date, t('toast.date_copied', 'Date copiée')));
            addItem('open_in_full', t('planning.fullscreen', 'Grand planning'), () => {
                if (!planningFullscreen) togglePlanningFullscreen();
            });
            addItem('today', t('planning.filter_day', 'Filtrer ce jour'), () => {
                activeDateFilter = date;
                renderGrid();
                renderPlanningPanel();
            });
        } else {
            addItem('add', t('planning.add_event', 'Ajouter un évènement'), () => showMarkerQuickEditor(date));
            addItem('view_week', t('planning.add_event_3_days', 'Repère 3 jours'), () => addCalendarMarkerFromDate(date, {
                name: t('organization.new_marker', 'Nouveau repère'),
                end: addDaysIso(date, 2)
            }));
            addItem('date_range', t('planning.add_event_7_days', 'Repère 7 jours'), () => addCalendarMarkerFromDate(date, {
                name: t('organization.new_marker', 'Nouveau repère'),
                end: addDaysIso(date, 6)
            }));
            addItem('timeline', t('planning.add_separator_here', 'Ajouter séparateur ici'), () => addCalendarMarkerFromDate(date, {
                name: t('organization.separator', 'Séparateur'),
                color: '#666666',
                type: 'separator'
            }));
            addItem('ads_click', t('planning.start_marker_pick', 'Étendre un repère'), () => {
                if (!Array.isArray(safety.calendar_markers)) safety.calendar_markers = [];
                safety.calendar_markers.push({
                    name: t('organization.new_marker', 'Nouveau repère'),
                    color: '#4ec9b0',
                    start: date,
                    end: date,
                    notes: ''
                });
                activeMarkerDatePick = { index: safety.calendar_markers.length - 1, started: true };
                syncCalendarMarkersToTextarea();
                saveAll();
                renderPlanningPanel();
            });
            addItem('playlist_add', t('planning.schedule_selection_here', 'Programmer la sélection ici'), () => assignPostsToDate(Array.from(selectedPostIds), date), !selectedPostIds.size);
            addItem('event_repeat', t('planning.schedule_selection_next_week', 'Programmer la sélection +7j'), () => assignPostsToDate(Array.from(selectedPostIds), addDaysIso(date, 7)), !selectedPostIds.size);
            addItem('content_copy', t('planning.copy_date', 'Copier date'), () => copyText(date, t('toast.date_copied', 'Date copiée')));
            addItem('open_in_full', t('planning.fullscreen', 'Grand planning'), () => {
                if (!planningFullscreen) togglePlanningFullscreen();
            });
            addItem('view_list', t('planning.open_queue', 'Ouvrir la file'), () => {
                planningView = 'queue';
                renderPlanningPanel();
            });
            addItem('filter_alt', t('planning.filter_day', 'Filtrer ce jour'), () => {
                activeDateFilter = activeDateFilter === date ? '' : date;
                renderGrid();
                renderPlanningPanel();
            });
            addItem('filter_alt_off', t('planning.clear_day_filter', 'Retirer le filtre jour'), () => {
                activeDateFilter = '';
                renderGrid();
                renderPlanningPanel();
            }, !activeDateFilter);
            addItem('event_busy', t('planning.clear_day_posts', 'Déprogrammer les posts du jour'), () => {
                (db.grid || []).filter(item => item.type !== 'spacer' && item.publish_date === date).forEach(item => {
                    item.publish_date = '';
                    item.publish_time = '';
                });
                saveAll();
                renderGrid();
                renderPlanningPanel();
            });
        }

        document.body.appendChild(menu);
        menu.addEventListener('pointerdown', (ev) => ev.stopPropagation());
        const rect = menu.getBoundingClientRect();
        const x = Math.min(e.clientX, window.innerWidth - rect.width - 8);
        const y = Math.min(e.clientY, window.innerHeight - rect.height - 8);
        menu.style.left = `${Math.max(8, x)}px`;
        menu.style.top = `${Math.max(8, y)}px`;
        setTimeout(() => document.addEventListener('pointerdown', handlePlanningContextOutside), 0);
    }

    function setMarkerDateFromCalendar(date) {
        if (activeMarkerDatePick === null) return false;
        const activeIndex = typeof activeMarkerDatePick === 'object' ? activeMarkerDatePick.index : activeMarkerDatePick;
        const marker = (safety.calendar_markers || [])[activeIndex];
        if (!marker) {
            activeMarkerDatePick = null;
            return false;
        }
        if (!activeMarkerDatePick.started) {
            marker.start = date;
            marker.end = date;
            activeMarkerDatePick = { index: activeIndex, started: true };
        } else {
            const start = marker.start || date;
            marker.start = date < start ? date : start;
            marker.end = date > start ? date : start;
            activeMarkerDatePick = null;
        }
        syncCalendarMarkersToTextarea();
        saveAll();
        renderPlanningPanel();
        showToast(t('toast.marker_dates_updated', 'Dates du repère mises à jour'));
        return true;
    }

    function applyCalendarDrop(cell, date) {
        cell.dataset.date = date;
        cell.addEventListener('dragover', (e) => {
            const types = Array.from(e.dataTransfer.types || []);
            const acceptsPosts = types.includes('application/x-instalocalplanner-posts');
            const acceptsProfilePhoto = types.includes('application/x-instalocalplanner-profile-photo');
            const acceptsMarkerEdge = types.includes('application/x-instalocalplanner-marker-edge');
            if (!acceptsPosts && !acceptsProfilePhoto && !acceptsMarkerEdge) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            cell.classList.add('calendar-drop-target');
        });
        cell.addEventListener('dragleave', () => cell.classList.remove('calendar-drop-target'));
        cell.addEventListener('drop', (e) => {
            cell.classList.remove('calendar-drop-target');
            // Priorité au drop photo profil si présent.
            const pfpRaw = e.dataTransfer.getData('application/x-instalocalplanner-profile-photo');
            if (pfpRaw) {
                e.preventDefault();
                try {
                    const payload = JSON.parse(pfpRaw);
                    schedulePfpToDate(payload, date);
                } catch (err) { /* noop */ }
                return;
            }
            const markerRaw = e.dataTransfer.getData('application/x-instalocalplanner-marker-edge');
            if (markerRaw) {
                e.preventDefault();
                try {
                    moveMarkerEdge(JSON.parse(markerRaw), date);
                } catch (err) { /* noop */ }
                return;
            }
            e.preventDefault();
            assignPostsToDate(getDraggedPostIds(e), date);
        });
        cell.addEventListener('contextmenu', (e) => showPlanningContextMenu(e, date));
        cell.addEventListener('click', (e) => {
            if (e.target.closest('.planning-post')) return;
            if (setMarkerDateFromCalendar(date)) return;
            activeDateFilter = activeDateFilter === date ? '' : date;
            renderGrid();
            renderPlanningPanel();
            showToast(activeDateFilter ? t('planning.day_filtered', 'Filtre jour actif') : t('toast.filters_cleared', 'Filtres réinitialisés'));
        });
    }

    function renderPlanningPanel() {
        const panel = document.getElementById('planning-panel');
        const content = document.getElementById('planning-content');
        if (!panel || !content) return;
        syncPlanningShellState();
        if (planningCollapsed) return;
        document.querySelectorAll('.planning-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view === planningView));
        // Avant de vider le contenu, sortir le panneau Photos profil s'il y était :
        // sinon innerHTML = '' le détruirait. Re-parenter au drawer (parent d'origine).
        const pfpBox = document.getElementById('profile-photo-plans-panel');
        if (pfpBox && content.contains(pfpBox)) panel.appendChild(pfpBox);
        content.innerHTML = '';
        if (planningView === 'month') renderPlanningMonth(content);
        if (planningView === 'week') renderPlanningWeek(content);
        if (planningView === 'queue') renderPlanningQueue(content);
        if (planningView === 'goals') renderPlanningGoals(content);
        renderProfilePhotoPlansPanel();
    }

    function renderPlanningMonth(content) {
        const now = new Date(planningMonthCursor);
        const year = now.getFullYear();
        const month = now.getMonth();
        const nav = document.createElement('div');
        nav.className = 'calendar-month-nav';
        const prev = document.createElement('button');
        prev.className = 'btn-secondary small';
        prev.innerText = 'chevron_left';
        const next = document.createElement('button');
        next.className = 'btn-secondary small';
        next.innerText = 'chevron_right';
        const today = document.createElement('button');
        today.className = 'btn-secondary small';
        today.innerText = t('planning.today', 'Aujourd’hui');
        const title = document.createElement('strong');
        title.innerText = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        prev.onclick = () => {
            planningMonthCursor = new Date(year, month - 1, 1);
            renderPlanningPanel();
        };
        next.onclick = () => {
            planningMonthCursor = new Date(year, month + 1, 1);
            renderPlanningPanel();
        };
        today.onclick = () => {
            const current = new Date();
            planningMonthCursor = new Date(current.getFullYear(), current.getMonth(), 1);
            renderPlanningPanel();
        };
        nav.appendChild(prev);
        nav.appendChild(title);
        nav.appendChild(today);
        nav.appendChild(next);
        content.appendChild(nav);

        const first = new Date(year, month, 1);
        const startOffset = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const byDate = groupPostsByDate(datedPosts());
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(day => {
            const head = document.createElement('div');
            head.className = 'calendar-head';
            head.innerText = day;
            grid.appendChild(head);
        });
        for (let i = 0; i < startOffset; i++) grid.appendChild(document.createElement('div')).className = 'calendar-day muted';
        const dayCells = {};
        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            cell.classList.toggle('active-day-filter', activeDateFilter === date);
            dayCells[date] = cell;
            const num = document.createElement('strong');
            num.innerText = String(day);
            cell.appendChild(num);
            applyCalendarDrop(cell, date);
            appendPlanningPostList(cell, date, byDate[date] || []);
            renderProfilePhotoPlans(cell, date);
            grid.appendChild(cell);
        }
        renderMonthMarkerBars(dayCells, year, month, startOffset, daysInMonth);
        content.appendChild(grid);
        // Slot dédié pour le panneau Photos profil planifiées : placé directement
        // sous le calendrier, AVANT la légende des évènements, pour faciliter
        // le drag&drop d'une carte vers un jour visible sans devoir scroller.
        const pfpSlot = document.createElement('div');
        pfpSlot.className = 'profile-photo-plans-slot';
        content.appendChild(pfpSlot);
        renderCalendarMarkerLegend(content, year, month);
    }

    function renderPlanningWeek(content) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const byDate = groupPostsByDate(datedPosts());
        const week = document.createElement('div');
        week.className = 'week-timeline';
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            const date = day.toISOString().slice(0, 10);
            const col = document.createElement('div');
            col.className = 'week-day';
            col.innerHTML = `<strong>${day.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit' })}</strong>`;
            col.classList.toggle('active-day-filter', activeDateFilter === date);
            applyCalendarDrop(col, date);
            renderCalendarMarkers(col, date);
            appendPlanningPostList(col, date, byDate[date] || []);
            renderProfilePhotoPlans(col, date);
            week.appendChild(col);
        }
        content.appendChild(week);
        const pfpSlot = document.createElement('div');
        pfpSlot.className = 'profile-photo-plans-slot';
        content.appendChild(pfpSlot);
        renderCalendarMarkerLegend(content, now.getFullYear(), now.getMonth());
    }

    function renderPlanningQueue(content) {
        const filters = document.createElement('div');
        filters.className = 'queue-filters';

        const statusSelect = document.createElement('select');
        statusSelect.className = 'toolbar-select';
        statusSelect.innerHTML = `<option value="">${t('planning.all_statuses', 'Tous statuts')}</option>`;
        (safety.custom_statuses || []).forEach(status => {
            const option = document.createElement('option');
            option.value = status.code;
            option.innerText = status.label || status.code;
            option.selected = status.code === queueStatusFilter;
            statusSelect.appendChild(option);
        });
        statusSelect.onchange = () => {
            queueStatusFilter = statusSelect.value;
            renderPlanningPanel();
        };

        const campaignSelect = document.createElement('select');
        campaignSelect.className = 'toolbar-select';
        campaignSelect.innerHTML = `<option value="">${t('organization.all_campaigns', 'Toutes campagnes')}</option>`;
        (safety.campaigns || []).forEach(campaign => {
            const option = document.createElement('option');
            option.value = campaign.name;
            option.innerText = campaign.name;
            option.selected = campaign.name === queueCampaignFilter;
            campaignSelect.appendChild(option);
        });
        campaignSelect.onchange = () => {
            queueCampaignFilter = campaignSelect.value;
            renderPlanningPanel();
        };

        const tagSelect = document.createElement('select');
        tagSelect.className = 'toolbar-select';
        tagSelect.innerHTML = `<option value="">${t('organization.all_tags', 'Tous tags')}</option>`;
        (safety.internal_tags || []).forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.innerText = tag;
            option.selected = tag === queueTagFilter;
            tagSelect.appendChild(option);
        });
        tagSelect.onchange = () => {
            queueTagFilter = tagSelect.value;
            renderPlanningPanel();
        };

        filters.appendChild(statusSelect);
        filters.appendChild(campaignSelect);
        filters.appendChild(tagSelect);
        content.appendChild(filters);

        const list = document.createElement('div');
        list.className = 'queue-list';
        const posts = datedPosts().filter(post => {
            const future = post.publish_date >= new Date().toISOString().slice(0, 10);
            const statusOk = !queueStatusFilter || post.status === queueStatusFilter;
            const campaignOk = !queueCampaignFilter || post.campaign === queueCampaignFilter;
            const tagsOk = !queueTagFilter || getPostTags(post).includes(queueTagFilter);
            return future && statusOk && campaignOk && tagsOk;
        });
        if (!posts.length) list.innerHTML = `<div class="ai-list-item">${t('planning.queue_empty', 'Aucun post planifié.')}</div>`;
        posts.forEach(post => {
            const row = document.createElement('div');
            row.className = 'queue-row';
            const date = document.createElement('input');
            date.type = 'date';
            date.value = post.publish_date || '';
            date.onchange = (e) => {
                e.stopPropagation();
                post.publish_date = date.value;
                savePostQuickUpdate(post, t('toast.date_updated', 'Date mise à jour'));
            };
            const time = document.createElement('input');
            time.type = 'time';
            time.value = post.publish_time || '';
            time.onchange = (e) => {
                e.stopPropagation();
                post.publish_time = time.value;
                savePostQuickUpdate(post, t('toast.time_updated', 'Heure mise à jour'));
            };
            const title = document.createElement('span');
            title.innerText = postLabel(post);
            const meta = document.createElement('em');
            const incomplete = [];
            if (!post.caption) incomplete.push(t('planning.missing_caption', 'légende'));
            if ((post.media || []).some(m => m.type === 'video' && !m.thumbnail)) incomplete.push(t('planning.missing_thumbnail', 'miniature'));
            meta.innerText = [post.campaign || '', incomplete.length ? `${t('planning.incomplete', 'Incomplet')} : ${incomplete.join(', ')}` : ''].filter(Boolean).join(' | ');
            row.appendChild(date);
            row.appendChild(time);
            row.appendChild(title);
            row.appendChild(meta);
            row.onclick = (e) => {
                if (e.target === date || e.target === time) return;
                openModal(post);
            };
            list.appendChild(row);
        });
        content.appendChild(list);
    }

    function renderPlanningGoals(content) {
        const wrap = document.createElement('div');
        wrap.className = 'goal-list';
        const posts = datedPosts();
        (safety.frequency_goals || []).forEach(goal => {
            const count = Number(goal.count || 0);
            const actual = countPostsForPeriod(posts, goal.period || 'week');
            const pct = count ? Math.min(100, Math.round((actual / count) * 100)) : 0;
            const row = document.createElement('div');
            row.className = 'goal-row';
            row.innerHTML = `<strong>${goal.name}</strong><span>${actual}/${count} ${goal.period}</span><div class="goal-bar"><i style="width:${pct}%"></i></div>`;
            wrap.appendChild(row);
        });
        content.appendChild(wrap);
    }

    function groupPostsByDate(posts) {
        return posts.reduce((acc, post) => {
            (acc[post.publish_date] ||= []).push(post);
            return acc;
        }, {});
    }

    function dateInMarker(date, marker) {
        const start = marker.start || '';
        const end = marker.end || start;
        return date >= start && date <= end;
    }

    function markersForDate(date) {
        return (safety.calendar_markers || []).filter(marker => dateInMarker(date, marker));
    }

    function markersForDateWithIndex(date) {
        return (safety.calendar_markers || [])
            .map((marker, index) => ({ marker, index }))
            .filter(({ marker }) => dateInMarker(date, marker));
    }

    function markerEdgeHandle(index, edge) {
        const handle = document.createElement('span');
        handle.className = `calendar-marker-handle ${edge}`;
        handle.draggable = true;
        handle.title = edge === 'start'
            ? t('planning.drag_marker_start', 'Glisser pour déplacer le début')
            : t('planning.drag_marker_end', 'Glisser pour étirer la fin');
        handle.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-instalocalplanner-marker-edge', JSON.stringify({ index, edge }));
        });
        return handle;
    }

    function renderMonthMarkerBars(dayCells, year, month, startOffset, daysInMonth) {
        const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const monthStart = `${monthPrefix}-01`;
        const monthEnd = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`;
        const segments = [];

        (safety.calendar_markers || []).forEach((marker, index) => {
            if (!marker || marker.type === 'separator') return;
            const rawStart = marker.start || '';
            const rawEnd = marker.end || rawStart;
            if (!rawStart || rawStart > monthEnd || rawEnd < monthStart) return;

            const visibleStart = rawStart < monthStart ? monthStart : rawStart;
            const visibleEnd = rawEnd > monthEnd ? monthEnd : rawEnd;
            const startDay = Number(visibleStart.slice(8, 10));
            const endDay = Number(visibleEnd.slice(8, 10));
            if (!startDay || !endDay) return;

            const startIndex = startOffset + startDay - 1;
            const endIndex = startOffset + endDay - 1;
            let cursor = startIndex;
            while (cursor <= endIndex) {
                const row = Math.floor(cursor / 7) + 2;
                const rowEnd = Math.min(endIndex, (row - 1) * 7 - 1);
                segments.push({
                    marker,
                    index,
                    row,
                    startCol: (cursor % 7) + 1,
                    endCol: (rowEnd % 7) + 1,
                    isStart: cursor === startIndex && visibleStart === rawStart,
                    isEnd: rowEnd === endIndex && visibleEnd === rawEnd
                });
                cursor = rowEnd + 1;
            }
        });

        const lanesByRow = {};
        let maxLane = -1;
        segments.forEach(segment => {
            const rowLanes = lanesByRow[segment.row] || (lanesByRow[segment.row] = []);
            let lane = rowLanes.findIndex(items => !items.some(item => segment.startCol <= item.endCol && segment.endCol >= item.startCol));
            if (lane < 0) {
                lane = rowLanes.length;
                rowLanes.push([]);
            }
            rowLanes[lane].push(segment);
            maxLane = Math.max(maxLane, lane);

            const segmentDay = segment.row === 2
                ? segment.startCol - startOffset
                : ((segment.row - 2) * 7 - startOffset + segment.startCol);
            const segmentDate = `${monthPrefix}-${String(segmentDay).padStart(2, '0')}`;
            const originCell = dayCells[segmentDate];
            if (!originCell) return;

            const bar = document.createElement('div');
            bar.className = `calendar-marker-bar ${segment.isStart ? 'marker-start' : ''} ${segment.isEnd ? 'marker-end' : ''}`;
            bar.style.background = segment.marker.color || '#4ec9b0';
            bar.style.setProperty('--marker-lane', lane);
            const span = segment.endCol - segment.startCol + 1;
            bar.style.width = `calc(${span * 100}% + ${(span - 1) * 4}px)`;
            bar.title = [segment.marker.name, segment.marker.notes].filter(Boolean).join(' - ');
            if (segment.isStart) {
                const label = document.createElement('span');
                label.className = 'calendar-marker-bar-label';
                label.innerText = segment.marker.name || '';
                bar.appendChild(label);
                bar.appendChild(markerEdgeHandle(segment.index, 'start'));
            }
            if (segment.isEnd) {
                bar.appendChild(markerEdgeHandle(segment.index, 'end'));
            }
            originCell.classList.add('has-marker-origin');
            originCell.appendChild(bar);
        });

        Object.values(dayCells).forEach(cell => {
            cell.classList.toggle('has-marker-bars', maxLane >= 0);
            if (maxLane >= 0) cell.style.setProperty('--calendar-marker-lanes', String(Math.min(maxLane + 1, 4)));
            else cell.style.removeProperty('--calendar-marker-lanes');
        });
    }

    function renderCalendarMarkers(cell, date) {
        // Séparateurs : organisationnels uniquement, pas de chip dans les cases du calendrier.
        const markers = markersForDateWithIndex(date).filter(({ marker }) => marker && marker.type !== 'separator');
        if (!markers.length) return;
        const wrap = document.createElement('div');
        wrap.className = 'calendar-marker-stack';
        markers.slice(0, 3).forEach(({ marker, index }) => {
            const chip = document.createElement('span');
            chip.className = 'calendar-marker-line';
            chip.style.background = marker.color || '#4ec9b0';
            chip.title = [marker.name, marker.notes].filter(Boolean).join(' - ');
            const start = marker.start || date;
            const end = marker.end || start;
            chip.classList.toggle('marker-start', date === start);
            chip.classList.toggle('marker-end', date === end);
            chip.innerText = date === start ? (marker.name || '') : '';
            if (date === start) {
                chip.appendChild(markerEdgeHandle(index, 'start'));
            }
            if (date === end) {
                chip.appendChild(markerEdgeHandle(index, 'end'));
            }
            wrap.appendChild(chip);
        });
        cell.appendChild(wrap);
    }

    function renderCalendarMarkerLegend(content, year, month) {
        const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const markers = (safety.calendar_markers || []).map((marker, index) => ({ marker, index })).filter(({ marker }) => {
            const start = marker.start || '';
            const end = marker.end || start;
            return start.slice(0, 7) <= monthPrefix && end.slice(0, 7) >= monthPrefix;
        });
        const legend = document.createElement('div');
        legend.className = 'calendar-marker-legend';

        const actions = document.createElement('div');
        actions.className = 'calendar-marker-legend-actions';
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'btn-secondary small';
        add.innerText = t('organization.add_marker', 'Ajouter repère');
        add.onclick = () => {
            safety.calendar_markers.push({
                name: t('organization.new_marker', 'Nouveau repère'),
                color: '#4ec9b0',
                start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
                end: `${year}-${String(month + 1).padStart(2, '0')}-01`,
                notes: ''
            });
            syncCalendarMarkersToTextarea();
            saveAll();
            renderPlanningPanel();
        };
        const addSeparator = document.createElement('button');
        addSeparator.type = 'button';
        addSeparator.className = 'btn-secondary small';
        addSeparator.innerText = t('organization.add_separator', 'Ajouter séparateur');
        addSeparator.onclick = () => {
            safety.calendar_markers.push({
                name: t('organization.separator', 'Séparateur'),
                color: '#666666',
                start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
                end: `${year}-${String(month + 1).padStart(2, '0')}-01`,
                notes: '',
                type: 'separator'
            });
            syncCalendarMarkersToTextarea();
            saveAll();
            renderPlanningPanel();
        };
        actions.appendChild(add);
        actions.appendChild(addSeparator);
        legend.appendChild(actions);

        if (!markers.length) {
            const empty = document.createElement('small');
            empty.className = 'calendar-marker-empty';
            empty.innerText = t('planning.no_markers', 'Aucun repère ce mois.');
            legend.appendChild(empty);
            content.appendChild(legend);
            return;
        }

        markers.forEach(({ marker, index }) => {
            const item = document.createElement('div');
            item.className = `calendar-marker-legend-item ${marker.type === 'separator' ? 'separator-row' : ''}`;
            const isPickingThisMarker = activeMarkerDatePick && activeMarkerDatePick.index === index;
            item.classList.toggle('date-picking', Boolean(isPickingThisMarker));

            if (marker.type === 'separator') {
                // Vrai filet horizontal traversant. Le nom est rendu dans le filet
                // comme un caption discret, éditable au double-clic uniquement
                // pour rester ultra-compact et fonctionnel.
                const label = document.createElement('span');
                label.className = 'calendar-marker-separator-label';
                const labelText = (marker.name || '').trim();
                label.innerText = labelText;
                label.classList.toggle('empty', !labelText);
                label.title = t('organization.separator_edit_hint', 'Double-clic pour renommer');
                label.ondblclick = () => {
                    const next = window.prompt(
                        t('organization.separator', 'Séparateur'),
                        marker.name || ''
                    );
                    if (next === null) return;
                    marker.name = next.trim();
                    syncCalendarMarkersToTextarea();
                    saveAll();
                    renderPlanningPanel();
                };
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'btn-icon small danger';
                del.innerText = 'delete';
                del.title = t('common.delete', 'Supprimer');
                del.onclick = () => {
                    safety.calendar_markers.splice(index, 1);
                    syncCalendarMarkersToTextarea();
                    saveAll();
                    renderPlanningPanel();
                };
                item.appendChild(label);
                item.appendChild(del);
                legend.appendChild(item);
                return;
            }

            const color = document.createElement('input');
            color.type = 'color';
            color.value = marker.color || '#4ec9b0';
            color.title = t('organization.marker_color', 'Couleur');
            color.onchange = () => {
                marker.color = color.value;
                syncCalendarMarkersToTextarea();
                saveAll();
                renderPlanningPanel();
            };

            const name = document.createElement('input');
            name.type = 'text';
            name.value = marker.name || '';
            name.placeholder = t('organization.marker_name', 'Nom');
            name.className = 'calendar-marker-legend-name';
            name.onchange = () => {
                marker.name = name.value.trim() || t('organization.new_marker', 'Nouveau repère');
                syncCalendarMarkersToTextarea();
                saveAll();
                renderPlanningPanel();
            };

            // Affichage compact de la plage en lecture (ex. "12 → 18 mai")
            // toggle l'édition des dates avancée en mode replié.
            const datesSummary = document.createElement('button');
            datesSummary.type = 'button';
            datesSummary.className = 'calendar-marker-legend-dates-summary';
            datesSummary.title = t('organization.marker_edit_dates', 'Éditer les dates');
            datesSummary.innerText = formatMarkerRangeShort(marker);

            // Pictogramme commentaire : visible uniquement si une note est saisie.
            // Sert d'indicateur "ça vaut le coup de déplier" et de raccourci au toggle.
            const hasNote = Boolean((marker.notes || '').trim());
            const noteIcon = document.createElement('button');
            noteIcon.type = 'button';
            noteIcon.className = `calendar-marker-legend-note-icon${hasNote ? ' has-note' : ''}`;
            noteIcon.innerHTML = '<span class="material-symbols-outlined">mode_comment</span>';
            noteIcon.title = hasNote
                ? (marker.notes || '').slice(0, 120)
                : t('organization.marker_note_optional', 'Commentaire optionnel');
            noteIcon.setAttribute('aria-label', t('organization.marker_note', 'Commentaire'));
            // Note : caché si pas de note, pour rester sobre.
            if (!hasNote) noteIcon.classList.add('is-empty');

            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn-icon small danger';
            del.innerText = 'delete';
            del.title = t('common.delete', 'Supprimer');
            del.onclick = () => {
                safety.calendar_markers.splice(index, 1);
                syncCalendarMarkersToTextarea();
                saveAll();
                renderPlanningPanel();
            };

            const head = document.createElement('div');
            head.className = 'calendar-marker-legend-head';
            head.appendChild(color);
            head.appendChild(name);
            head.appendChild(noteIcon);
            head.appendChild(datesSummary);
            head.appendChild(del);

            // Zone détails repliable : dates précises, commentaire, pointer-dates.
            // Repli PAR DÉFAUT — seule l'activité "pointer dates" force l'ouverture.
            const details = document.createElement('div');
            details.className = 'calendar-marker-legend-details';
            details.classList.toggle('open', Boolean(isPickingThisMarker));

            const dates = document.createElement('div');
            dates.className = 'calendar-marker-legend-dates';
            const start = document.createElement('input');
            start.type = 'date';
            start.value = marker.start || '';
            start.onchange = () => {
                marker.start = start.value;
                if (!marker.end || marker.end < marker.start) marker.end = marker.start;
                syncCalendarMarkersToTextarea();
                saveAll();
                renderPlanningPanel();
            };
            const end = document.createElement('input');
            end.type = 'date';
            end.value = marker.end || marker.start || '';
            end.onchange = () => {
                marker.end = end.value || marker.start;
                syncCalendarMarkersToTextarea();
                saveAll();
                renderPlanningPanel();
            };
            dates.appendChild(start);
            dates.appendChild(end);

            const notes = document.createElement('textarea');
            notes.className = 'calendar-marker-legend-notes';
            notes.value = marker.notes || '';
            notes.placeholder = t('organization.marker_note_placeholder', 'Commentaire court');
            notes.rows = marker.notes && marker.notes.length > 80 ? 3 : 1;
            notes.onchange = () => {
                marker.notes = notes.value.trim();
                syncCalendarMarkersToTextarea();
                saveAll();
                renderPlanningPanel();
            };

            const pick = document.createElement('button');
            pick.type = 'button';
            pick.className = `btn-secondary small calendar-marker-pick ${isPickingThisMarker ? 'active' : ''}`;
            pick.innerText = isPickingThisMarker
                ? t('organization.pick_marker_dates_active', 'Cliquez 1-2 jours')
                : t('organization.pick_marker_dates', 'Pointer dates');
            pick.onclick = () => {
                activeMarkerDatePick = isPickingThisMarker ? null : { index, started: false };
                renderPlanningPanel();
            };

            details.appendChild(dates);
            details.appendChild(notes);
            details.appendChild(pick);

            datesSummary.onclick = () => {
                details.classList.toggle('open');
            };
            // L'icône commentaire ouvre/ferme aussi le détail, ce qui permet
            // au lecteur de vérifier le commentaire d'un clic.
            noteIcon.onclick = () => {
                details.classList.toggle('open');
            };

            item.appendChild(head);
            item.appendChild(details);
            legend.appendChild(item);
        });
        content.appendChild(legend);
    }

    function formatMarkerRangeShort(marker) {
        const start = (marker.start || '').slice(0, 10);
        const end = (marker.end || start || '').slice(0, 10);
        if (!start && !end) return '—';
        const fmt = (iso) => {
            if (!iso) return '';
            const d = new Date(iso + 'T00:00:00');
            if (Number.isNaN(d.getTime())) return iso;
            try {
                const lang = (currentLanguage === 'en' ? 'en' : 'fr');
                return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: '2-digit', month: 'short' });
            } catch (e) {
                return iso.slice(5);
            }
        };
        return start === end ? fmt(start) : `${fmt(start)} → ${fmt(end)}`;
    }

    function renderProfilePhotoPlans(cell, date) {
        (safety.profile_photo_plans || []).filter(plan => plan.date === date).forEach(plan => {
            const pill = document.createElement('button');
            pill.type = 'button';
            const kind = profilePhotoPlanKind(plan);
            pill.className = `planning-post profile-photo-plan ${kind === 'normal' ? 'normal' : 'ephemeral'}`;
            pill.innerText = `${kind === 'normal' ? t('planning.profile_photo_kind_normal_short', 'Profil') : t('planning.profile_photo_kind_ephemeral_short', 'Éph.')}: ${plan.note || t('planning.profile_photo', 'Photo profil')}`;
            pill.onclick = (e) => {
                e.stopPropagation();
                if (!db.profile) db.profile = {};
                db.profile.avatar = plan.url;
                updateUI();
                saveAll();
                showToast(t('toast.avatar_saved', 'Photo de profil enregistrée'));
            };
            cell.appendChild(pill);
        });
    }

    function profilePhotoPlanKind(plan) {
        return plan && plan.kind === 'normal' ? 'normal' : 'ephemeral';
    }

    function profilePhotoKindSelect(value, onChange) {
        const select = document.createElement('select');
        select.className = 'toolbar-select';
        [
            ['normal', t('planning.profile_photo_kind_normal', 'Normal futur')],
            ['ephemeral', t('planning.profile_photo_kind_ephemeral', 'Éphémère')]
        ].forEach(([kind, label]) => {
            const option = document.createElement('option');
            option.value = kind;
            option.innerText = label;
            option.selected = (value === 'normal' ? 'normal' : 'ephemeral') === kind;
            select.appendChild(option);
        });
        select.onchange = () => onChange(select.value);
        return select;
    }

    function renderProfilePhotoPlansPanel() {
        const box = document.getElementById('profile-photo-plans-panel');
        if (!box) return;
        // Si un slot dédié a été créé par renderPlanningMonth/Week, on y déplace
        // le panneau pour le positionner entre le calendrier et la légende.
        // Sinon (vues queue/goals), il reste à sa position d'origine en bas du drawer.
        const slot = document.querySelector('#planning-content .profile-photo-plans-slot');
        if (slot && box.parentElement !== slot) slot.appendChild(box);
        const today = new Date().toISOString().slice(0, 10);
        const allPlans = (safety.profile_photo_plans || []).filter(plan => plan && plan.date && plan.url);
        const visiblePlans = allPlans.filter(plan => {
            if (planningView !== 'month') return true;
            const cursor = new Date(planningMonthCursor);
            const monthPrefix = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
            return String(plan.date || '').slice(0, 7) === monthPrefix;
        });
        // Futur (et aujourd'hui) en avant, passé sous un toggle.
        const plansFuture = visiblePlans
            .filter(plan => String(plan.date) >= today)
            .slice()
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const plansPast = visiblePlans
            .filter(plan => String(plan.date) < today)
            .slice()
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const gallery = (safety.profile_photo_gallery || []).filter(item => item && item.url);

        box.innerHTML = '';
        box.classList.remove('hidden');

        const title = document.createElement('h4');
        title.innerText = t('planning.profile_photos', 'Photos profil planifiées');
        box.appendChild(title);

        // Bandeau d'actions ultra-court.
        const toolbar = document.createElement('div');
        toolbar.className = 'pfp-toolbar';
        const importBtn = document.createElement('button');
        importBtn.type = 'button';
        importBtn.className = 'btn-secondary small';
        importBtn.innerText = t('planning.pfp_import', 'Importer photo');
        importBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            input.onchange = () => handlePfpImport(Array.from(input.files || []));
            input.click();
        };
        const fromAvatar = document.createElement('button');
        fromAvatar.type = 'button';
        fromAvatar.className = 'btn-secondary small';
        fromAvatar.innerText = t('planning.pfp_from_avatar', 'Depuis avatar actuel');
        fromAvatar.disabled = !(db.profile && db.profile.avatar);
        fromAvatar.onclick = () => {
            if (!(db.profile && db.profile.avatar)) return;
            if (!Array.isArray(safety.profile_photo_gallery)) safety.profile_photo_gallery = [];
            safety.profile_photo_gallery.push({ url: db.profile.avatar, note: '', kind: 'unscheduled' });
            renderProfilePhotoGallery();
            saveAll();
            renderPlanningPanel();
            showToast(t('toast.media_added', 'Média ajouté'));
        };
        const help = document.createElement('span');
        help.className = 'pfp-help';
        help.innerText = t('planning.pfp_help', 'Glissez une carte sur un jour du calendrier pour la programmer');
        toolbar.appendChild(importBtn);
        toolbar.appendChild(fromAvatar);
        toolbar.appendChild(help);
        box.appendChild(toolbar);

        // Rangée non-programmées (drop d'import natif).
        const unschedSection = document.createElement('div');
        unschedSection.className = 'pfp-unsched-section';
        const unschedTitle = document.createElement('h5');
        unschedTitle.innerText = `${t('profile_gallery.unscheduled_title', 'Nouvelles non programmées')} (${gallery.length})`;
        unschedSection.appendChild(unschedTitle);
        const unschedRow = document.createElement('div');
        unschedRow.className = 'pfp-unsched-row';
        attachPfpImportDrop(unschedRow);
        if (!gallery.length) {
            const empty = document.createElement('div');
            empty.className = 'pfp-empty';
            empty.innerText = t('planning.pfp_drop_hint', 'Glisser ici pour importer une photo');
            unschedRow.appendChild(empty);
        } else {
            gallery.forEach((item, index) => {
                unschedRow.appendChild(buildPfpCard({ kind: 'unscheduled', galleryIndex: index, photo: item }));
            });
        }
        unschedSection.appendChild(unschedRow);
        box.appendChild(unschedSection);

        // Timeline chronologique des programmées (futur d'abord, passé en fold).
        const timelineSection = document.createElement('div');
        timelineSection.className = 'pfp-timeline-section';
        const timelineTitle = document.createElement('h5');
        timelineTitle.innerText = `${t('planning.pfp_scheduled_title', 'Programmées (chronologie)')} (${plansFuture.length})`;
        timelineSection.appendChild(timelineTitle);
        const timeline = document.createElement('div');
        timeline.className = 'pfp-timeline';
        if (!plansFuture.length) {
            const empty = document.createElement('div');
            empty.className = 'pfp-empty';
            empty.innerText = t('profile_gallery.empty_scheduled', 'Aucune photo programmée.');
            timeline.appendChild(empty);
        } else {
            plansFuture.forEach((plan) => {
                const planIndex = (safety.profile_photo_plans || []).indexOf(plan);
                if (planIndex < 0) return;
                timeline.appendChild(buildPfpCard({
                    kind: profilePhotoPlanKind(plan) === 'normal' ? 'normal' : 'ephemeral',
                    planIndex,
                    photo: plan
                }));
            });
        }
        timelineSection.appendChild(timeline);

        if (plansPast.length) {
            const pastWrap = document.createElement('details');
            pastWrap.className = 'pfp-past';
            const pastSummary = document.createElement('summary');
            pastSummary.innerText = `${t('planning.pfp_past_title', 'Passées')} (${plansPast.length})`;
            pastWrap.appendChild(pastSummary);
            const pastRow = document.createElement('div');
            pastRow.className = 'pfp-timeline pfp-timeline-past';
            plansPast.forEach((plan) => {
                const planIndex = (safety.profile_photo_plans || []).indexOf(plan);
                if (planIndex < 0) return;
                pastRow.appendChild(buildPfpCard({
                    kind: profilePhotoPlanKind(plan) === 'normal' ? 'normal' : 'ephemeral',
                    planIndex,
                    photo: plan,
                    past: true
                }));
            });
            pastWrap.appendChild(pastRow);
            timelineSection.appendChild(pastWrap);
        }
        box.appendChild(timelineSection);
    }

    function buildPfpCard({ kind, photo, planIndex, galleryIndex, past }) {
        const card = document.createElement('article');
        card.className = `pfp-card pfp-${kind}${past ? ' is-past' : ''}`;
        card.draggable = true;
        card.title = t('planning.pfp_drag_hint', 'Glisser vers un jour du calendrier pour programmer');

        const dragPayload = {
            source: typeof planIndex === 'number' ? 'plans' : 'gallery',
            index: typeof planIndex === 'number' ? planIndex : galleryIndex,
            url: photo.url,
            note: photo.note || ''
        };
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            try {
                e.dataTransfer.setData('application/x-instalocalplanner-profile-photo', JSON.stringify(dragPayload));
            } catch (err) { /* noop */ }
            card.classList.add('is-dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('is-dragging'));

        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = photo.note || t('planning.profile_photo', 'Photo profil');
        img.draggable = false;
        card.appendChild(img);

        const meta = document.createElement('div');
        meta.className = 'pfp-card-meta';
        if (typeof planIndex === 'number') {
            const dateLabel = document.createElement('span');
            dateLabel.className = 'pfp-date';
            dateLabel.innerText = formatPfpDateShort(photo.date);
            meta.appendChild(dateLabel);
        } else {
            const badge = document.createElement('span');
            badge.className = 'pfp-badge';
            badge.innerText = t('profile_gallery.unscheduled', 'Nouvelle non programmée');
            meta.appendChild(badge);
        }
        card.appendChild(meta);

        // Note inline éditable (1 ligne).
        const note = document.createElement('input');
        note.type = 'text';
        note.className = 'pfp-note';
        note.value = photo.note || '';
        note.placeholder = t('profile_gallery.note_placeholder', 'Note courte');
        note.onchange = () => {
            const value = note.value.trim();
            if (typeof planIndex === 'number') {
                const plan = safety.profile_photo_plans[planIndex];
                if (plan) plan.note = value;
            } else {
                const item = safety.profile_photo_gallery[galleryIndex];
                if (item) item.note = value;
            }
            syncProfilePhotoPlansToTextarea();
            saveAll();
        };
        card.appendChild(note);

        // Toggle normal ↔ éphémère uniquement pour les programmées.
        if (typeof planIndex === 'number') {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'pfp-kind-toggle';
            const currentKind = profilePhotoPlanKind(photo);
            toggle.innerText = currentKind === 'normal'
                ? t('planning.profile_photo_kind_normal', 'Normal futur')
                : t('planning.profile_photo_kind_ephemeral', 'Éphémère');
            toggle.title = t('planning.pfp_toggle_kind', 'Basculer normal / éphémère');
            toggle.onclick = () => {
                const plan = safety.profile_photo_plans[planIndex];
                if (!plan) return;
                plan.kind = profilePhotoPlanKind(plan) === 'normal' ? 'ephemeral' : 'normal';
                syncProfilePhotoPlansToTextarea();
                saveAll();
                renderPlanningPanel();
            };
            card.appendChild(toggle);
        }

        // Actions : appliquer + suppression.
        const actions = document.createElement('div');
        actions.className = 'pfp-actions';
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.className = 'btn-icon small';
        apply.innerText = 'check';
        apply.title = t('common.validate', 'Valider');
        apply.onclick = () => {
            if (!db.profile) db.profile = {};
            db.profile.avatar = photo.url;
            updateUI();
            saveAll();
            showToast(t('toast.avatar_saved', 'Photo de profil enregistrée'));
        };
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-icon small danger';
        remove.innerText = 'delete';
        remove.title = t('common.delete', 'Supprimer');
        remove.onclick = () => {
            if (typeof planIndex === 'number') {
                safety.profile_photo_plans = (safety.profile_photo_plans || []).filter((_, i) => i !== planIndex);
            } else {
                safety.profile_photo_gallery = (safety.profile_photo_gallery || []).filter((_, i) => i !== galleryIndex);
            }
            syncProfilePhotoPlansToTextarea();
            renderProfilePhotoGallery();
            saveAll();
            renderPlanningPanel();
        };
        actions.appendChild(apply);
        actions.appendChild(remove);
        card.appendChild(actions);

        return card;
    }

    function formatPfpDateShort(iso) {
        if (!iso) return '—';
        const d = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(d.getTime())) return iso;
        try {
            const lang = currentLanguage === 'en' ? 'en-US' : 'fr-FR';
            return d.toLocaleDateString(lang, { day: '2-digit', month: 'short' });
        } catch (e) {
            return iso.slice(5);
        }
    }

    function attachPfpImportDrop(zone) {
        zone.addEventListener('dragover', (e) => {
            // N'accepter que des fichiers, pas une carte interne (pour ne pas ajouter par drag interne).
            const types = Array.from(e.dataTransfer.types || []);
            if (!types.includes('Files')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            zone.classList.add('pfp-drop-hover');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('pfp-drop-hover'));
        zone.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files || []).filter(f => f && f.type && f.type.startsWith('image/'));
            if (!files.length) return;
            e.preventDefault();
            zone.classList.remove('pfp-drop-hover');
            handlePfpImport(files);
        });
    }

    function handlePfpImport(files) {
        if (!files.length) return;
        // Réutilise le pipeline existant : kind 'profile_avatar' = non programmée.
        uploadMediaFiles(files, 'profile_avatar').then(items => {
            if (!items.length) return;
            if (!Array.isArray(safety.profile_photo_gallery)) safety.profile_photo_gallery = [];
            items.forEach((item, index) => {
                const note = items.length > 1 ? `${t('planning.profile_photo', 'Photo profil')} ${index + 1}` : '';
                safety.profile_photo_gallery.push({ url: item.src, note, kind: 'unscheduled' });
            });
            syncProfilePhotoPlansToTextarea();
            renderProfilePhotoGallery();
            saveAll();
            renderPlanningPanel();
            showToast(t('toast.media_added', 'Média ajouté'));
        }).catch(() => showToast(t('toast.save_error', 'Erreur sauvegarde')));
    }

    /**
     * Programme (ou re-programme) une photo de profil vers la date donnée.
     * Accepte un payload de drag (source plans|gallery, index, url, note).
     */
    /**
     * Demande au serveur de déplacer/renommer un fichier de photo profil
     * entre les dossiers Drive-friendly. Best-effort : si l'appel échoue,
     * la programmation reste en place avec l'URL d'origine.
     */
    function movePfpFileOnDisk({ src, target, date, note }) {
        if (!src || typeof src !== 'string' || !src.startsWith('/static/uploads/')) {
            return Promise.resolve(src);
        }
        return fetch('/api/move_profile_photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ src, target, date: date || '', note: note || '' })
        })
            .then(r => (r.ok ? r.json() : null))
            .then(payload => (payload && payload.src) ? payload.src : src)
            .catch(() => src);
    }

    function schedulePfpToDate(payload, date) {
        if (!payload || !date) return false;
        if (!Array.isArray(safety.profile_photo_plans)) safety.profile_photo_plans = [];
        if (!Array.isArray(safety.profile_photo_gallery)) safety.profile_photo_gallery = [];
        let plan, kindForMove;
        if (payload.source === 'plans') {
            plan = safety.profile_photo_plans[payload.index];
            if (!plan) return false;
            plan.date = date;
            plan.kind = profilePhotoPlanKind(plan);
            // Note : éphémère ET normal vont tous deux dans "Photo profils - programmees"
            // car ce sont des photos programmées sur le planning. Le distinguo
            // normal/éphémère reste dans safety.profile_photo_plans.
            kindForMove = 'scheduled';
        } else if (payload.source === 'gallery') {
            const item = safety.profile_photo_gallery[payload.index];
            if (!item) return false;
            safety.profile_photo_gallery.splice(payload.index, 1);
            plan = {
                date,
                url: item.url,
                note: item.note || '',
                kind: 'ephemeral'
            };
            safety.profile_photo_plans.push(plan);
            kindForMove = 'scheduled';
        } else {
            return false;
        }

        // Rendu optimiste immédiat (carte placée dans la timeline).
        renderProfilePhotoGallery();
        renderPlanningPanel();
        showToast(t('toast.pfp_scheduled', 'Photo de profil programmée'));

        // CRITIQUE : on attend la résolution du move serveur AVANT d'écrire
        // safety.json. Sinon une persistance avec l'ancienne URL crée un état
        // incohérent (URL pointant vers un fichier déjà déplacé) qui peut
        // donner l'impression d'une duplication si le scan disque diverge
        // du JSON.
        movePfpFileOnDisk({ src: plan.url, target: kindForMove, date: plan.date, note: plan.note })
            .then(newSrc => {
                if (newSrc && newSrc !== plan.url) {
                    plan.url = newSrc;
                }
            })
            .finally(() => {
                syncProfilePhotoPlansToTextarea();
                saveAll();
                renderPlanningPanel();
            });
        return true;
    }

    function syncProfilePhotoPlansToTextarea() {
        const profilePlans = document.getElementById('org-profile-photo-plans');
        if (profilePlans) {
            profilePlans.value = (safety.profile_photo_plans || []).map(plan => `${plan.date || ''}|${plan.url || ''}|${plan.note || ''}|${plan.kind || ''}`).join('\n');
        }
    }

    function profilePhotoCard(plan, options = {}) {
        const card = document.createElement('div');
        card.className = 'profile-photo-plan-card profile-gallery-card';
        const img = document.createElement('img');
        img.src = plan.url;
        img.alt = plan.note || t('planning.profile_photo', 'Photo profil');
        const badge = document.createElement('span');
        badge.className = `profile-gallery-badge ${options.scheduled ? 'scheduled' : 'unscheduled'}`;
        badge.innerText = options.scheduled ? t('profile_gallery.scheduled', 'Profil éphémère programmé') : t('profile_gallery.unscheduled', 'Nouvelle non programmée');
        const date = document.createElement('input');
        date.type = 'date';
        date.value = plan.date || '';
        date.placeholder = t('planning.quick_date', 'Date rapide');
        const note = document.createElement('input');
        note.type = 'text';
        note.value = plan.note || '';
        note.placeholder = t('profile_gallery.note_placeholder', 'Note courte');
        const actions = document.createElement('div');
        actions.className = 'profile-photo-plan-actions';
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.className = 'btn-secondary small';
        apply.innerText = t('common.validate', 'Valider');
        apply.onclick = () => {
            if (!db.profile) db.profile = {};
            db.profile.avatar = plan.url;
            document.getElementById('inputAvatar').value = plan.url;
            updateUI();
            saveAll();
            showToast(t('toast.avatar_saved', 'Photo de profil enregistrée'));
        };
        const schedule = document.createElement('button');
        schedule.type = 'button';
        schedule.className = 'btn-secondary small';
        schedule.innerText = options.scheduled ? t('common.save', 'Enregistrer') : t('profile_gallery.schedule', 'Programmer');
        schedule.onclick = () => {
            const nextDate = date.value;
            const nextNote = note.value.trim();
            if (!nextDate) return showToast(t('planning.quick_date', 'Date rapide'));
            if (options.scheduled) {
                plan.date = nextDate;
                plan.note = nextNote;
                plan.kind = profilePhotoPlanKind(plan);
            } else {
                safety.profile_photo_gallery = (safety.profile_photo_gallery || []).filter(item => item !== plan);
                safety.profile_photo_plans.push({ date: nextDate, url: plan.url, note: nextNote, kind: 'ephemeral' });
            }
            syncProfilePhotoPlansToTextarea();
            renderProfilePhotoGallery();
            renderPlanningPanel();
            saveAll();
        };
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-icon small danger';
        remove.innerText = 'delete';
        remove.title = t('common.delete', 'Supprimer');
        remove.onclick = () => {
            if (options.scheduled) safety.profile_photo_plans = (safety.profile_photo_plans || []).filter(item => item !== plan);
            else safety.profile_photo_gallery = (safety.profile_photo_gallery || []).filter(item => item !== plan);
            syncProfilePhotoPlansToTextarea();
            renderProfilePhotoGallery();
            renderPlanningPanel();
            saveAll();
        };
        actions.appendChild(apply);
        actions.appendChild(schedule);
        actions.appendChild(remove);
        card.appendChild(img);
        card.appendChild(badge);
        card.appendChild(date);
        card.appendChild(note);
        card.appendChild(actions);
        return card;
    }

    function renderProfilePhotoGallery() {
        const box = document.getElementById('profile-gallery-content');
        if (!box) return;
        const scheduled = (safety.profile_photo_plans || [])
            .filter(plan => plan && plan.date && plan.url)
            .slice()
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const unscheduled = (safety.profile_photo_gallery || [])
            .filter(item => item && item.url)
            .slice();
        box.innerHTML = '';

        const scheduledSection = document.createElement('section');
        scheduledSection.className = 'profile-gallery-section';
        scheduledSection.innerHTML = `<h3>${t('profile_gallery.scheduled_title', 'Profils éphémères programmés')}</h3>`;
        const scheduledList = document.createElement('div');
        scheduledList.className = 'profile-gallery-grid';
        scheduled.forEach(plan => scheduledList.appendChild(profilePhotoCard(plan, { scheduled: true })));
        if (!scheduled.length) scheduledList.innerHTML = `<div class="ai-list-item">${t('profile_gallery.empty_scheduled', 'Aucune photo programmée.')}</div>`;
        scheduledSection.appendChild(scheduledList);

        const unscheduledSection = document.createElement('section');
        unscheduledSection.className = 'profile-gallery-section';
        unscheduledSection.innerHTML = `<h3>${t('profile_gallery.unscheduled_title', 'Nouvelles non programmées')}</h3>`;
        const unscheduledList = document.createElement('div');
        unscheduledList.className = 'profile-gallery-grid';
        unscheduled.forEach(plan => unscheduledList.appendChild(profilePhotoCard(plan, { scheduled: false })));
        if (!unscheduled.length) unscheduledList.innerHTML = `<div class="ai-list-item">${t('profile_gallery.empty_unscheduled', 'Aucune photo en attente.')}</div>`;
        unscheduledSection.appendChild(unscheduledList);

        box.appendChild(scheduledSection);
        box.appendChild(unscheduledSection);
    }

    function downloadJson(filename, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportPlanningJson() {
        collectOrganizationSettings();
        downloadJson('instalocalplanner_planning.json', {
            version: 1,
            exported_at: new Date().toISOString(),
            account: activeAccount,
            calendar_markers: safety.calendar_markers || [],
            profile_photo_plans: safety.profile_photo_plans || [],
            profile_photo_gallery: safety.profile_photo_gallery || [],
            posts: (db.grid || []).filter(post => post.type !== 'spacer').map(post => ({
                id: post.id,
                title: postLabel(post),
                publish_date: post.publish_date || '',
                publish_time: post.publish_time || '',
                status: post.status || '',
                campaign: post.campaign || '',
                internal_tags: getPostTags(post)
            }))
        });
        showToast(t('toast.planning_exported', 'Planning exporté'));
    }

    function importPlanningJsonPayload(payload) {
        if (!payload || typeof payload !== 'object') throw new Error('invalid planning');
        const changedPosts = [];
        if (Array.isArray(payload.calendar_markers)) {
            safety.calendar_markers = payload.calendar_markers.filter(marker => marker && marker.name && marker.start);
        }
        if (Array.isArray(payload.profile_photo_plans)) {
            safety.profile_photo_plans = payload.profile_photo_plans.filter(plan => plan && plan.date && plan.url);
        }
        if (Array.isArray(payload.profile_photo_gallery)) {
            safety.profile_photo_gallery = payload.profile_photo_gallery.filter(item => item && item.url);
        }
        if (Array.isArray(payload.posts)) {
            payload.posts.forEach(item => {
                if (!item || !item.id) return;
                const post = (db.grid || []).find(entry => entry.id === item.id);
                if (!post || post.type === 'spacer') return;
                let changed = false;
                ['publish_date', 'publish_time', 'status', 'campaign'].forEach(key => {
                    if (Object.prototype.hasOwnProperty.call(item, key) && post[key] !== item[key]) {
                        post[key] = item[key] || '';
                        changed = true;
                    }
                });
                if (Array.isArray(item.internal_tags)) {
                    post.internal_tags = item.internal_tags.map(tag => String(tag).trim()).filter(Boolean);
                    changed = true;
                }
                if (changed) changedPosts.push(post);
            });
        }
        return Promise.all(changedPosts.map(post => savePostStructure(post))).then(() => {
            fillOrganizationSettings();
            renderGrid();
            renderPlanningPanel();
            saveAll();
            showToast(t('toast.planning_imported', 'Planning importé'));
        });
    }

    function countPostsForPeriod(posts, period) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(start);
        if (period === 'month') end.setMonth(start.getMonth() + 1);
        else end.setDate(start.getDate() + 7);
        return posts.filter(post => {
            const d = new Date(`${post.publish_date}T00:00:00`);
            return d >= start && d < end;
        }).length;
    }

    function postVisualKind(post) {
        if (post.type === 'ghost') return 'ghost';
        const media = (post.media || [])[0];
        if (!media) return 'empty';
        return media.type === 'video' ? 'video' : 'image';
    }

    function overlapCount(a, b) {
        const left = new Set((a || []).map(v => String(v).toLowerCase()));
        return (b || []).filter(v => left.has(String(v).toLowerCase())).length;
    }

    function getPostTags(post) {
        return Array.isArray(post.internal_tags) ? post.internal_tags : String(post.internal_tags || '').split(',').map(v => v.trim()).filter(Boolean);
    }

    function readImageTone(src) {
        return new Promise(resolve => {
            if (!src) return resolve('unknown');
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const size = 24;
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, size, size);
                    const data = ctx.getImageData(0, 0, size, size).data;
                    let sum = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        sum += (0.2126 * data[i]) + (0.7152 * data[i + 1]) + (0.0722 * data[i + 2]);
                    }
                    resolve(sum / (data.length / 4) > 128 ? 'light' : 'dark');
                } catch (e) {
                    resolve('unknown');
                }
            };
            img.onerror = () => resolve('unknown');
            img.src = src;
        });
    }

    async function buildGridAnalysis() {
        const posts = (db.grid || []).filter(post => post.type !== 'spacer');
        const tonePairs = await Promise.all(posts.map(async post => {
            const media = (post.media || [])[0];
            return [post.id, await readImageTone(media?.thumbnail || media?.src || '')];
        }));
        const tones = Object.fromEntries(tonePairs);
        const counts = posts.reduce((acc, post) => {
            acc[postVisualKind(post)] = (acc[postVisualKind(post)] || 0) + 1;
            acc[tones[post.id] || 'unknown'] = (acc[tones[post.id] || 'unknown'] || 0) + 1;
            return acc;
        }, {});

        const warnings = [];
        for (let i = 0; i < posts.length - 1; i++) {
            const current = posts[i];
            const next = posts[i + 1];
            const sameKind = postVisualKind(current) === postVisualKind(next);
            const sameTone = tones[current.id] !== 'unknown' && tones[current.id] === tones[next.id];
            const sameCampaign = current.campaign && current.campaign === next.campaign;
            const sharedTags = overlapCount(getPostTags(current), getPostTags(next));
            if ((sameKind && sameTone) || sameCampaign || sharedTags >= 2) {
                warnings.push({
                    ids: [current.id, next.id],
                    text: `${postLabel(current)} / ${postLabel(next)}`
                });
            }
        }

        return { posts, counts, warnings };
    }

    function renderGridAnalysisLoading() {
        const content = document.getElementById('grid-analysis-content');
        if (content) content.innerHTML = `<div class="ai-list-item">${t('analysis.loading', 'Analyse en cours...')}</div>`;
    }

    function renderGridAnalysisResult(result) {
        const content = document.getElementById('grid-analysis-content');
        if (!content) return;
        const total = result.posts.length || 1;
        content.innerHTML = '';

        const summary = document.createElement('div');
        summary.className = 'analysis-summary';
        [
            ['image', t('analysis.images', 'Images')],
            ['video', t('analysis.videos', 'Vidéos')],
            ['ghost', t('analysis.ghosts', 'Notes')],
            ['light', t('analysis.light', 'Clairs')],
            ['dark', t('analysis.dark', 'Sombres')]
        ].forEach(([key, label]) => {
            const card = document.createElement('div');
            card.className = 'analysis-card';
            const value = result.counts[key] || 0;
            card.innerHTML = `<strong>${value}</strong><span>${label}</span><i style="width:${Math.round((value / total) * 100)}%"></i>`;
            summary.appendChild(card);
        });
        content.appendChild(summary);

        const warnings = document.createElement('div');
        warnings.className = 'analysis-warnings';
        if (!result.warnings.length) {
            warnings.innerHTML = `<div class="ai-list-item">${t('analysis.no_warnings', 'Aucune répétition forte détectée entre voisins.')}</div>`;
        } else {
            result.warnings.slice(0, 8).forEach(item => {
                const row = document.createElement('div');
                row.className = 'ai-list-item';
                row.innerHTML = `<strong>${t('analysis.neighbor_warning', 'Voisins similaires')}</strong><div>${item.text}</div>`;
                const actions = document.createElement('div');
                actions.className = 'tools-row';
                const selectBtn = document.createElement('button');
                selectBtn.className = 'btn-secondary small';
                selectBtn.innerText = t('ai.select_posts', 'Sélectionner');
                selectBtn.onclick = () => selectRedundantPosts(item.ids);
                actions.appendChild(selectBtn);
                row.appendChild(actions);
                warnings.appendChild(row);
            });
        }
        content.appendChild(warnings);
    }

    const planningBtn = document.getElementById('btn-planning-view');
    function syncPlanningShellState() {
        const panel = document.getElementById('planning-panel');
        const collapseBtn = document.getElementById('btn-planning-collapse');
        const fullBtn = document.getElementById('btn-planning-fullscreen');
        if (!panel) return;
        panel.classList.remove('hidden');
        panel.classList.toggle('collapsed', planningCollapsed);
        panel.classList.toggle('fullscreen', planningFullscreen);
        document.body.classList.toggle('planning-open', !planningCollapsed && !planningFullscreen);
        document.body.classList.toggle('planning-fullscreen-open', planningFullscreen && !planningCollapsed);
        planningBtn?.classList.toggle('active', !planningCollapsed);
        if (collapseBtn) {
            collapseBtn.innerText = planningCollapsed ? 'chevron_left' : 'chevron_right';
            collapseBtn.title = planningCollapsed ? t('planning.expand', 'Déplier') : t('planning.collapse', 'Replier');
        }
        if (fullBtn) {
            fullBtn.innerText = planningFullscreen ? 'close_fullscreen' : 'open_in_full';
            fullBtn.title = planningFullscreen ? t('planning.exit_fullscreen', 'Quitter grand planning') : t('planning.fullscreen', 'Grand planning');
        }
    }

    function togglePlanningCollapsed(force) {
        planningCollapsed = typeof force === 'boolean' ? force : !planningCollapsed;
        if (planningCollapsed) planningFullscreen = false;
        setLocalStorageItem('instaLocalPlannerPlanningCollapsed', String(planningCollapsed));
        setLocalStorageItem('instaLocalPlannerPlanningFullscreen', String(planningFullscreen));
        syncPlanningShellState();
        renderPlanningPanel();
    }

    function togglePlanningFullscreen() {
        planningFullscreen = !planningFullscreen;
        if (planningFullscreen) planningCollapsed = false;
        setLocalStorageItem('instaLocalPlannerPlanningCollapsed', String(planningCollapsed));
        setLocalStorageItem('instaLocalPlannerPlanningFullscreen', String(planningFullscreen));
        syncPlanningShellState();
        renderPlanningPanel();
    }
    function initPlanningResize() {
        const panel = document.getElementById('planning-panel');
        const handle = document.getElementById('planning-resize-handle');
        if (!panel || !handle) return;
        const savedWidth = Number(getLocalStorageItem('instaLocalPlannerPlanningWidth', '0') || 0);
        if (savedWidth) {
            const width = Math.min(Math.max(savedWidth, 360), window.innerWidth - 36);
            panel.style.width = `${width}px`;
            document.documentElement.style.setProperty('--planning-panel-width', `${width}px`);
        }
        handle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = panel.getBoundingClientRect().width;
            panel.classList.add('resizing');
            const onMove = (moveEvent) => {
                const max = Math.max(360, window.innerWidth - 36);
                const width = Math.min(max, Math.max(360, startWidth + (startX - moveEvent.clientX)));
                panel.style.width = `${width}px`;
                document.documentElement.style.setProperty('--planning-panel-width', `${width}px`);
            };
            const onUp = () => {
                panel.classList.remove('resizing');
                setLocalStorageItem('instaLocalPlannerPlanningWidth', String(Math.round(panel.getBoundingClientRect().width)));
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp, { once: true });
        });
        window.addEventListener('resize', () => {
            const current = panel.getBoundingClientRect().width;
            const max = Math.max(360, window.innerWidth - 36);
            if (current > max) {
                panel.style.width = `${max}px`;
                document.documentElement.style.setProperty('--planning-panel-width', `${max}px`);
            }
        });
    }
    initPlanningResize();
    syncPlanningShellState();

    if (planningBtn) {
        planningBtn.onclick = () => togglePlanningCollapsed();
    }

    const planningCollapseBtn = document.getElementById('btn-planning-collapse');
    if (planningCollapseBtn) {
        planningCollapseBtn.addEventListener('click', () => {
            planningCollapsed = document.getElementById('planning-panel')?.classList.contains('collapsed') || false;
            setLocalStorageItem('instaLocalPlannerPlanningCollapsed', String(planningCollapsed));
        });
    }

    const planningFullscreenBtn = document.getElementById('btn-planning-fullscreen');
    if (planningFullscreenBtn) {
        planningFullscreenBtn.addEventListener('click', () => {
            planningFullscreen = document.getElementById('planning-panel')?.classList.contains('fullscreen') || false;
            setLocalStorageItem('instaLocalPlannerPlanningFullscreen', String(planningFullscreen));
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (planningFullscreen) togglePlanningFullscreen();
            else closePlanningContextMenu();
        }
    });

    document.querySelectorAll('.planning-tab').forEach(btn => {
        btn.onclick = () => {
            planningView = btn.dataset.view;
            renderPlanningPanel();
        };
    });

    const exportPlanningBtn = document.getElementById('btn-export-planning-json');
    if (exportPlanningBtn) exportPlanningBtn.onclick = exportPlanningJson;

    const importPlanningBtn = document.getElementById('btn-import-planning-json');
    const planningJsonInput = document.getElementById('planning-json-input');
    if (importPlanningBtn && planningJsonInput) {
        importPlanningBtn.onclick = () => planningJsonInput.click();
        planningJsonInput.onchange = () => {
            const file = planningJsonInput.files && planningJsonInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    importPlanningJsonPayload(JSON.parse(reader.result)).catch(() => showToast(t('toast.planning_import_error', 'Import planning impossible')));
                } catch (err) {
                    showToast(t('toast.planning_import_error', 'Import planning impossible'));
                } finally {
                    planningJsonInput.value = '';
                }
            };
            reader.readAsText(file);
        };
    }

    const gridAnalysisBtn = document.getElementById('btn-grid-analysis');
    if (gridAnalysisBtn) {
        gridAnalysisBtn.onclick = () => {
            const panel = document.getElementById('grid-analysis-panel');
            panel?.classList.toggle('hidden');
            const isOpen = panel && !panel.classList.contains('hidden');
            gridAnalysisBtn.classList.toggle('active', isOpen);
            if (isOpen) {
                renderGridAnalysisLoading();
                buildGridAnalysis().then(renderGridAnalysisResult);
            }
        };
    }

    const closeGridAnalysisBtn = document.getElementById('btn-close-grid-analysis');
    if (closeGridAnalysisBtn) {
        closeGridAnalysisBtn.onclick = () => {
            document.getElementById('grid-analysis-panel')?.classList.add('hidden');
            gridAnalysisBtn?.classList.remove('active');
        };
    }

    const redundancyBtn = document.getElementById('btn-ai-redundancy');
    if (redundancyBtn) {
        redundancyBtn.onclick = () => {
            showToast(t('ai.loading', 'Génération...'));
            const posts = (db.grid || []).filter(p => p.type !== 'spacer').slice(0, 24).map(p => ({
                id: p.id,
                title: p.title || p.planner_title || '',
                caption: p.caption || '',
                note: p.planner_comment || ''
            }));
            runAiTask('redundancy', { posts }).then(result => {
                const findings = result.findings || [];
                openIdeasModal();
                document.querySelector('#ai-ideas-modal h2').innerText = t('ai.redundancy_title', 'Analyse anti-redondance');
                const list = document.getElementById('ai-ideas-list');
                if (!findings.length) {
                    list.innerHTML = `<div class="ai-list-item">${t('ai.no_redundancy', 'Aucune redondance forte détectée.')}</div>`;
                    return;
                }
                renderRedundancyFindings(list, findings);
            }).catch(err => showToast((err && err.error) ? err.error : t('ai.error', 'Erreur IA')));
        };
    }

    // --- BOUTON APERÇU : bascule le mode prévisualisation (masque les indicateurs d'édition) ---
    const btnNotesMode = document.getElementById('btn-notes-mode');
    if (btnNotesMode) {
        btnNotesMode.onclick = () => {
            notesVisible = !notesVisible;
            setLocalStorageItem('instaLocalPlannerNotesVisible', notesVisible ? 'true' : 'false');
            applyNotesVisibility();
            showToast(notesVisible ? t('toast.notes_on', 'Encarts affichés') : t('toast.notes_off', 'Encarts masqués'));
        };
    }
    applyNotesVisibility();

    const btnGhostMode = document.getElementById('btn-ghost-mode');
    if (btnGhostMode) {
        btnGhostMode.onclick = () => {
            gridEl.classList.toggle('preview-mode');
            const on = gridEl.classList.contains('preview-mode');
            btnGhostMode.classList.toggle('active', on);
            showToast(on ? t('toast.preview_on', 'Mode Aperçu activé') : t('toast.preview_off', 'Mode Aperçu désactivé'));
        };
    }

    document.getElementById('nav-create-ghost').onclick = () => {
        const title = prompt(t('prompt.note_title', 'Titre de votre idée :'));
        const newPost = { 
            id: Date.now().toString(), 
            type: 'ghost', 
            status: 'draft', 
            media: [],
            title: title || '',
            caption: '' 
        };
        fetch('/api/save_post_structure', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({post: newPost})
        }).then(r => r.json()).then(d => {
            db.grid.unshift(d.post); renderGrid(); showToast(t('toast.note_created', 'Note créée !'));
        });
    };

    const ideasNav = document.getElementById('nav-ai-ideas');
    if (ideasNav) ideasNav.onclick = () => openIdeasModal();

    window.openIdeasModal = function() {
        const modalIdeas = document.getElementById('ai-ideas-modal');
        const title = modalIdeas.querySelector('h2');
        if (title) title.innerText = t('ai.ideas_title', 'Idées de posts IA');
        document.getElementById('ai-ideas-list').innerHTML = '';
        modalIdeas.classList.remove('hidden');
    };

    window.closeIdeasModal = function() {
        document.getElementById('ai-ideas-modal').classList.add('hidden');
    };

    const generateIdeasBtn = document.getElementById('btn-generate-ideas');
    if (generateIdeasBtn) {
        generateIdeasBtn.onclick = () => {
            const list = document.getElementById('ai-ideas-list');
            list.innerHTML = `<div class="ai-list-item">${t('ai.loading', 'Génération...')}</div>`;
            runAiTask('ideas', { context: buildIdeasContext() }).then(result => {
                const ideas = result.ideas || [];
                renderAiList(list, ideas, (idea) => {
                    const newPost = {
                        id: Date.now().toString(),
                        type: 'ghost',
                        status: 'draft',
                        media: [],
                        title: idea.title || '',
                        planner_title: idea.title || '',
                        planner_comment: idea.comment || '',
                        caption: idea.caption || ''
                    };
                    fetch('/api/save_post_structure', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({post: newPost})
                    }).then(r => r.json()).then(d => {
                        db.grid.unshift(d.post);
                        renderGrid();
                        showToast(t('toast.note_created', 'Note créée !'));
                    });
                });
            }).catch(err => {
                list.innerHTML = '';
                showToast((err && err.error) ? err.error : t('ai.error', 'Erreur IA'));
            });
        };
    }

    // --- HASHTAGS MANAGER V2 ---
    window.openSettings = function() { 
        document.getElementById('settingsModal').classList.remove('hidden');
        if(db.profile) {
            document.getElementById('inputPseudo').value = db.profile.name || '';
            document.getElementById('inputBio').value = db.profile.bio || '';
            document.getElementById('inputAvatar').value = db.profile.avatar || '';
            updateBioCounter();
        }
        const langSelect = document.getElementById('language-select');
        if (langSelect) langSelect.value = currentLanguage;
        fillAiSettings();
        renderAccounts();
        if (!safety.sensitive_words) safety.sensitive_words = [];
        renderTagsCensure();
        initHashtagStructure();
        fillOrganizationSettings();
        renderProfilePhotoGallery();
        renderFolders();
    };

    window.closeSettings = function() {
        document.getElementById('settingsModal').classList.add('hidden');
    };

    window.switchTab = function(tabId, element) {
        document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        element.classList.add('active');
        if (tabId === 'tab-profile-photos') renderProfilePhotoGallery();
    };

    function updateBioCounter() {
        const bio = document.getElementById('inputBio');
        const counter = document.getElementById('bio-counter');
        if (bio && counter) counter.innerText = String((bio.value || '').length);
    }

    const bioInput = document.getElementById('inputBio');
    if (bioInput) bioInput.addEventListener('input', updateBioCounter);

    function renderTagsCensure() {
        const list = safety.sensitive_words || [];
        const container = document.getElementById('container-censure');
        const countSpan = document.getElementById('count-censure');
        if (container) {
            container.innerHTML = ''; 
            list.forEach((tag, index) => {
                const chip = document.createElement('div');
                chip.className = 'tag-chip';
                chip.innerHTML = `<span>${tag}</span><span class="tag-remove" onclick="removeCensureTag(${index})">✕</span>`;
                container.appendChild(chip);
            });
        }
        if(countSpan) countSpan.textContent = `(${list.length})`;
    }

    const csInput = document.getElementById('text-input-censure');
    if(csInput) {
        csInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const rawText = e.target.value;
                if (!rawText.trim()) return;
                const newItems = rawText.split(/[\s,]+/).filter(t => t.length > 0);
                newItems.forEach(item => {
                    if (!safety.sensitive_words.includes(item.toLowerCase())) safety.sensitive_words.push(item.toLowerCase());
                });
                e.target.value = '';
                renderTagsCensure();
            }
        };
    }

    window.removeCensureTag = function(index) {
        safety.sensitive_words.splice(index, 1);
        renderTagsCensure();
    };
    
    window.clearTags = function(type) {
        if(type === 'censure' && confirm(t('confirm.clear_all', 'Tout supprimer ?'))) {
            safety.sensitive_words = [];
            renderTagsCensure();
        }
    };

    const videoFrameBtn = document.getElementById('btn-video-frame');
    if (videoFrameBtn) {
        videoFrameBtn.onclick = () => {
            const post = db.grid.find(p => p.id === currentPostId);
            const media = post && post.media[selectedMediaIndex];
            const video = document.getElementById('main-preview-video');
            if (!post || !media || media.type !== 'video' || video.classList.contains('hidden')) return;

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1080;
            canvas.height = video.videoHeight || 1080;
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            media.thumbnail = canvas.toDataURL('image/png');
            savePostMediaUpdate(post, t('toast.thumbnail_saved', 'Miniature enregistrée'));
        };
    }

    function fillOrganizationSettings() {
        const statuses = document.getElementById('org-statuses');
        const tags = document.getElementById('org-tags');
        const campaigns = document.getElementById('org-campaigns');
        const templates = document.getElementById('org-templates');
        const goals = document.getElementById('org-goals');
        const markers = document.getElementById('org-calendar-markers');
        const profilePlans = document.getElementById('org-profile-photo-plans');
        if (statuses) statuses.value = (safety.custom_statuses || []).map(s => `${s.code}|${s.label}`).join('\n');
        if (tags) tags.value = (safety.internal_tags || []).join(', ');
        if (campaigns) campaigns.value = (safety.campaigns || []).map(c => `${c.name}|${c.color || ''}|${c.start || ''}|${c.end || ''}|${c.objective || ''}|${c.notes || ''}`).join('\n');
        if (templates) templates.value = (safety.post_templates || []).map(tpl => `${tpl.name}|${(tpl.text || '').replace(/\n/g, '\\n')}`).join('\n');
        if (goals) goals.value = (safety.frequency_goals || []).map(goal => `${goal.name}|${goal.count}|${goal.period || 'week'}`).join('\n');
        if (markers) markers.value = (safety.calendar_markers || []).map(marker => `${marker.name}|${marker.color || ''}|${marker.start || ''}|${marker.end || ''}|${marker.notes || ''}|${marker.type || ''}`).join('\n');
        if (profilePlans) profilePlans.value = (safety.profile_photo_plans || []).map(plan => `${plan.date || ''}|${plan.url || ''}|${plan.note || ''}|${plan.kind || ''}`).join('\n');
        renderCalendarMarkerEditor();
    }

    function syncCalendarMarkersFromTextarea() {
        const markersText = document.getElementById('org-calendar-markers')?.value || '';
        safety.calendar_markers = markersText.split('\n').map(line => {
            const [name, color, start, end, notes, type] = line.split('|');
            return {
                name: (name || '').trim(),
                color: (color || '#4ec9b0').trim(),
                start: (start || '').trim(),
                end: (end || start || '').trim(),
                notes: (notes || '').trim(),
                type: (type || '').trim()
            };
        }).filter(marker => marker.name && marker.start);
    }

    function renderCalendarMarkerEditor() {
        const box = document.getElementById('calendar-marker-editor');
        if (!box) return;
        box.innerHTML = '';
        (safety.calendar_markers || []).slice(0, 80).forEach((marker, index) => {
            const row = document.createElement('div');
            row.className = `calendar-marker-editor-row ${marker.type === 'separator' ? 'separator-row' : ''}`;

            const color = document.createElement('input');
            color.type = 'color';
            color.value = marker.color || '#4ec9b0';
            color.oninput = () => { marker.color = color.value; syncCalendarMarkersToTextarea(); };

            const name = document.createElement('input');
            name.type = 'text';
            name.value = marker.name || '';
            name.placeholder = t('organization.marker_name', 'Nom');
            name.oninput = () => { marker.name = name.value; syncCalendarMarkersToTextarea(); };

            const start = document.createElement('input');
            start.type = 'date';
            start.value = marker.start || '';
            start.onchange = () => {
                marker.start = start.value;
                if (!marker.end) marker.end = start.value;
                syncCalendarMarkersToTextarea();
            };

            const end = document.createElement('input');
            end.type = 'date';
            end.value = marker.end || marker.start || '';
            end.onchange = () => { marker.end = end.value; syncCalendarMarkersToTextarea(); };

            const notes = document.createElement('input');
            notes.type = 'text';
            notes.value = marker.notes || '';
            notes.placeholder = t('organization.marker_note_placeholder', 'Commentaire court');
            notes.oninput = () => { marker.notes = notes.value; syncCalendarMarkersToTextarea(); };

            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn-danger small';
            del.innerText = '×';
            del.onclick = () => {
                syncCalendarMarkersFromTextarea();
                safety.calendar_markers.splice(index, 1);
                fillOrganizationSettings();
            };
            row.appendChild(color);
            row.appendChild(name);
            row.appendChild(start);
            row.appendChild(end);
            row.appendChild(notes);
            row.appendChild(del);
            box.appendChild(row);
        });
    }

    function syncCalendarMarkersToTextarea() {
        const markers = document.getElementById('org-calendar-markers');
        if (markers) markers.value = (safety.calendar_markers || []).map(marker => `${marker.name}|${marker.color || ''}|${marker.start || ''}|${marker.end || ''}|${marker.notes || ''}|${marker.type || ''}`).join('\n');
    }

    function collectOrganizationSettings() {
        const statusesText = document.getElementById('org-statuses')?.value || '';
        const tagsText = document.getElementById('org-tags')?.value || '';
        const campaignsText = document.getElementById('org-campaigns')?.value || '';
        const templatesText = document.getElementById('org-templates')?.value || '';
        const goalsText = document.getElementById('org-goals')?.value || '';
        const profilePlansText = document.getElementById('org-profile-photo-plans')?.value || '';

        safety.custom_statuses = statusesText.split('\n').map(line => {
            const [code, ...label] = line.split('|');
            return { code: (code || '').trim(), label: (label.join('|') || code || '').trim() };
        }).filter(s => s.code);
        if (!safety.custom_statuses.length) safety.custom_statuses = [{ code: 'draft', label: '🔴 Draft' }];

        safety.internal_tags = tagsText.split(/[,;\n]+/).map(v => v.trim()).filter(Boolean);
        safety.campaigns = campaignsText.split('\n').map(line => {
            const [name, color, start, end, objective, ...notes] = line.split('|');
            return {
                name: (name || '').trim(),
                color: (color || '').trim(),
                start: (start || '').trim(),
                end: (end || '').trim(),
                objective: (objective || '').trim(),
                notes: notes.join('|').trim()
            };
        }).filter(c => c.name);
        safety.post_templates = templatesText.split('\n').map(line => {
            const [name, ...text] = line.split('|');
            return { name: (name || '').trim(), text: text.join('|').replace(/\\n/g, '\n').trim() };
        }).filter(tpl => tpl.name);
        safety.frequency_goals = goalsText.split('\n').map(line => {
            const [name, count, period] = line.split('|');
            return { name: (name || '').trim(), count: Number(count || 0), period: (period || 'week').trim() };
        }).filter(goal => goal.name && goal.count);
        safety.profile_photo_plans = profilePlansText.split('\n').map(line => {
            const [date, url, note, kind] = line.split('|');
            return {
                date: (date || '').trim(),
                url: (url || '').trim(),
                note: (note || '').trim(),
                kind: (kind || '').trim()
            };
        }).filter(plan => plan.date && plan.url);
        syncCalendarMarkersFromTextarea();
    }

    const videoCoverInput = document.getElementById('video-cover-input');
    const videoCoverBtn = document.getElementById('btn-video-cover');
    if (videoCoverBtn && videoCoverInput) {
        videoCoverBtn.onclick = () => videoCoverInput.click();
        videoCoverInput.onchange = (e) => {
            const post = db.grid.find(p => p.id === currentPostId);
            const media = post && post.media[selectedMediaIndex];
            if (!post || !media || media.type !== 'video' || !e.target.files.length) return;
            const reader = new FileReader();
            reader.onload = () => {
                media.thumbnail = reader.result;
                savePostMediaUpdate(post, t('toast.thumbnail_saved', 'Miniature enregistrée'));
            };
            reader.readAsDataURL(e.target.files[0]);
        };
    }

    const exportMarkersBtn = document.getElementById('btn-export-markers');
    if (exportMarkersBtn) {
        exportMarkersBtn.onclick = (e) => {
            e.preventDefault();
            collectOrganizationSettings();
            const blob = new Blob([JSON.stringify(safety.calendar_markers || [], null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'calendar_markers.json';
            a.click();
            URL.revokeObjectURL(url);
        };
    }

    const addMarkerBtn = document.getElementById('btn-add-marker');
    if (addMarkerBtn) {
        addMarkerBtn.onclick = (e) => {
            e.preventDefault();
            syncCalendarMarkersFromTextarea();
            const today = new Date().toISOString().slice(0, 10);
            safety.calendar_markers.push({
                name: t('organization.new_marker', 'Nouveau repère'),
                color: '#4ec9b0',
                start: today,
                end: today,
                notes: t('organization.marker_note_placeholder', 'Commentaire court')
            });
            fillOrganizationSettings();
        };
    }

    const addMarkerSeparatorBtn = document.getElementById('btn-add-marker-separator');
    if (addMarkerSeparatorBtn) {
        addMarkerSeparatorBtn.onclick = (e) => {
            e.preventDefault();
            syncCalendarMarkersFromTextarea();
            const today = new Date().toISOString().slice(0, 10);
            safety.calendar_markers.push({
                name: t('organization.separator', 'Séparateur'),
                color: '#666666',
                start: today,
                end: today,
                notes: t('organization.marker_note_placeholder', 'Commentaire court'),
                type: 'separator'
            });
            fillOrganizationSettings();
        };
    }

    const planCurrentAvatarBtn = document.getElementById('btn-plan-current-avatar');
    if (planCurrentAvatarBtn) {
        planCurrentAvatarBtn.onclick = (e) => {
            e.preventDefault();
            const avatar = document.getElementById('inputAvatar')?.value || db.profile?.avatar || '';
            if (!avatar) return showToast(t('toast.avatar_ready', 'Avatar prêt, pensez à enregistrer'));
            const date = prompt(t('planning.quick_date', 'Date rapide'), new Date().toISOString().slice(0, 10));
            if (!date) return;
            const note = prompt(t('organization.marker_note_placeholder', 'Commentaire court'), t('planning.profile_photo', 'Photo profil')) || '';
            const textarea = document.getElementById('org-profile-photo-plans');
            if (!textarea) return;
            textarea.value += `${textarea.value.trim() ? '\n' : ''}${date}|${avatar}|${note}`;
        };
    }

    const importMarkersBtn = document.getElementById('btn-import-markers');
    const markersFileInput = document.getElementById('markers-file-input');
    if (importMarkersBtn && markersFileInput) {
        importMarkersBtn.onclick = (e) => {
            e.preventDefault();
            markersFileInput.click();
        };
        markersFileInput.onchange = () => {
            const file = markersFileInput.files && markersFileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const parsed = JSON.parse(reader.result);
                    if (!Array.isArray(parsed)) throw new Error('invalid markers');
                    safety.calendar_markers = parsed.filter(marker => marker && marker.name && marker.start);
                    fillOrganizationSettings();
                    showToast(t('toast.markers_imported', 'Repères importés'));
                } catch (err) {
                    showToast(t('toast.markers_import_error', 'Import repères impossible'));
                }
            };
            reader.readAsText(file);
        };
    }

    function savePostMediaUpdate(post, message) {
        fetch('/api/save_post_structure', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({post: post})
        }).then(r => r.json()).then(d => {
            const idx = db.grid.findIndex(p => p.id === d.post.id);
            if(idx >= 0) db.grid[idx] = d.post;
            renderCarousel(d.post);
            renderGrid();
            showToast(message);
        });
    }

    window.renderFolders = function() {
        const list = document.getElementById('folder-list');
        list.innerHTML = '';
        Object.keys(safety.hashtag_folders).forEach(name => {
            const li = document.createElement('li');
            li.className = `folder-item ${currentFolder === name ? 'active' : ''}`;
            li.innerHTML = `<span>📁 ${name}</span> <span class="folder-delete" onclick="deleteFolder('${name}', event)">×</span>`;
            li.onclick = () => selectFolder(name);
            list.appendChild(li);
        });
    };

    window.createFolder = function() {
        const name = prompt(t('prompt.folder_name', 'Nom du nouveau dossier :'));
        if (name && !safety.hashtag_folders[name]) {
            safety.hashtag_folders[name] = [];
            renderFolders();
            selectFolder(name);
        }
    };

    window.deleteFolder = function(name, e) {
        e.stopPropagation();
        if(confirm(t('confirm.delete_folder', 'Supprimer le dossier "{name}" ?').replace('{name}', name))) {
            delete safety.hashtag_folders[name];
            if(currentFolder === name) currentFolder = null;
            renderFolders();
            renderCurrentTags();
        }
    };

    window.selectFolder = function(name) {
        currentFolder = name;
        document.getElementById('current-folder-title').innerText = name;
        renderFolders(); 
        renderCurrentTags();
    };

    window.renderCurrentTags = function() {
        const container = document.getElementById('container-hashtags');
        container.innerHTML = '';
        if (!currentFolder) return;

        const tags = safety.hashtag_folders[currentFolder] || [];
        const filter = document.getElementById('search-tag').value.toLowerCase();

        tags.forEach((tag, idx) => {
            if(tag.toLowerCase().includes(filter)) {
                const chip = document.createElement('div');
                chip.className = 'tag-chip';
                chip.innerHTML = `<span>${tag}</span><span class="tag-remove" onclick="removeTagFromFolder(${idx})">✕</span>`;
                container.appendChild(chip);
            }
        });
    };

    const htInput = document.getElementById('text-input-hashtags');
    if(htInput) {
        htInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if(!currentFolder) return alert(t('alerts.select_folder', 'Veuillez sélectionner un dossier.'));
                const raw = e.target.value;
                const newTags = raw.split(/[\s,]+/).filter(t => t).map(t => t.startsWith('#') ? t : '#'+t);
                newTags.forEach(t => {
                    if(!safety.hashtag_folders[currentFolder].includes(t)) {
                        safety.hashtag_folders[currentFolder].push(t);
                    }
                });
                e.target.value = '';
                renderCurrentTags();
            }
        };
    }

    window.removeTagFromFolder = function(idx) {
        if(currentFolder) {
            safety.hashtag_folders[currentFolder].splice(idx, 1);
            renderCurrentTags();
        }
    };

    window.filterTags = function(val) { renderCurrentTags(); };

    window.copyCurrentTags = function() {
        if(currentFolder) {
            navigator.clipboard.writeText(safety.hashtag_folders[currentFolder].join(' '));
            showToast(t('toast.folder_copied', 'Dossier copié !'));
        }
    };

    window.saveSettings = function() {
        if(!db.profile) db.profile = {};
        db.profile.name = document.getElementById('inputPseudo').value;
        db.profile.bio = document.getElementById('inputBio').value.slice(0, 150);
        db.profile.avatar = document.getElementById('inputAvatar').value;
        safety.ai_settings = collectAiSettings();
        collectAiPromptSettings();
        collectOrganizationSettings();

        fetch('/api/save_settings', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ profile: db.profile, safety: safety })
        }).then(r => r.json()).then(payload => {
            if (payload.db) db = payload.db;
            if (payload.safety) safety = payload.safety;
            if (payload.accounts) accounts = payload.accounts;
            if (payload.active) activeAccount = payload.active;
            updateUI(); 
            refreshAccounts();
            closeSettings(); 
            showToast(t('toast.settings_saved', 'Paramètres sauvegardés !'));
        }).catch(err => showToast(t('toast.save_error', 'Erreur sauvegarde')));
    };

    const accountSelect = document.getElementById('account-select');
    if (accountSelect) {
        accountSelect.onchange = () => switchAccount(accountSelect.value);
    }

    const quickAccountSelect = document.getElementById('quick-account-select');
    if (quickAccountSelect) {
        quickAccountSelect.onchange = () => switchAccount(quickAccountSelect.value);
    }

    const createAccountBtn = document.getElementById('btn-create-account');
    if (createAccountBtn) {
        createAccountBtn.onclick = createAccount;
    }

    const deleteAccountBtn = document.getElementById('btn-delete-account');
    if (deleteAccountBtn) {
        deleteAccountBtn.onclick = deleteActiveAccount;
    }

    const importLanguageBtn = document.getElementById('btn-import-language');
    const languageFileInput = document.getElementById('language-file-input');
    if (importLanguageBtn && languageFileInput) {
        importLanguageBtn.onclick = () => languageFileInput.click();
        languageFileInput.onchange = (e) => importLanguageFile(e.target.files);
    }

});
