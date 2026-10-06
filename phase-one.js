// Phase 1 safety, AI review, provenance and sync helpers.
'use strict';

    const AI_EDIT_FIELDS = [
        { key: 'name', id: 'ai-edit-name', label: 'Drug name' },
        { key: 'generic_name', id: 'ai-edit-generic-name', label: 'Generic name' },
        { key: 'brand_name', id: 'ai-edit-brand-name', label: 'Brand name' },
        { key: 'class', id: 'ai-edit-class', label: 'Class' },
        { key: 'system', id: 'ai-edit-system', label: 'System' },
        { key: 'indication', id: 'ai-edit-indication', label: 'Indication' },
        { key: 'side_effects', id: 'ai-edit-side-effects', label: 'Side effects' },
        { key: 'nursing', id: 'ai-edit-nursing', label: 'Nursing care' },
        { key: 'effect_of_drug', id: 'ai-edit-effect', label: 'Drug effect' },
        { key: 'class_zh_hk', id: 'ai-edit-class-zh-hk', label: '藥物分類' },
        { key: 'system_zh_hk', id: 'ai-edit-system-zh-hk', label: '系統' },
        { key: 'indication_zh_hk', id: 'ai-edit-indication-zh-hk', label: '用途' },
        { key: 'side_effects_zh_hk', id: 'ai-edit-side-effects-zh-hk', label: '副作用' },
        { key: 'nursing_zh_hk', id: 'ai-edit-nursing-zh-hk', label: '護理重點' },
        { key: 'effect_of_drug_zh_hk', id: 'ai-edit-effect-zh-hk', label: '藥物作用' },
    ];
    let activeAIChangeReview = null;
    let aiEditUndoStack = [];

    function buildAIImprovedDrugData(parsed, originalDraft) {
        const candidate = unwrapDrugObject(parsed);
        if (!candidate) throw new Error('AI did not return usable drug data. Please try again.');
        const chooseText = (value, fallback) => isMissingDrugText(value) ? String(fallback || '').trim() : String(value).trim();
        const sideEffects = chooseText(
            candidate.side_effects || candidate.SideEffects || candidate.sideEffects || candidate['side effects'],
            originalDraft.side_effects
        );
        if (isMissingDrugText(sideEffects) || sideEffects === DRUG_TEXT_FALLBACKS.sideEffects) {
            throw new Error('AI did not return useful side effects. The data was left unchanged.');
        }
        const nursing = normalizeThreeSentenceNursingCare(candidate.nursing || candidate.nursing_care || '');
        const nursingZh = normalizeThreeSentenceCantoneseNursingCare(candidate.nursing_zh_hk || candidate.nursing_care_zh_hk || '');
        const originalParts = getDrugNameParts(originalDraft);
        const candidateNameParts = getDrugNameParts(candidate);
        const genericName = chooseText(candidate.generic_name || candidate.generic || candidateNameParts.generic, originalDraft.generic_name || originalParts.generic);
        const brandName = chooseText(candidate.brand_name || candidate.brand || candidateNameParts.brand, originalDraft.brand_name || originalParts.brand);
        const formattedName = formatGenericBrandName(genericName, brandName, chooseText(candidate.name, originalDraft.name));
        const proposedSystem = resolveDrugSystem({ ...originalDraft, ...candidate, system: candidate.system || originalDraft.system });
        const improved = {
            name: formattedName,
            generic_name: genericName,
            brand_name: isMissingDrugText(brandName) ? '' : brandName,
            class: chooseText(candidate.class, originalDraft.class),
            system: systemCategories.includes(proposedSystem) ? proposedSystem : originalDraft.system,
            indication: chooseText(candidate.indication, originalDraft.indication),
            side_effects: sideEffects,
            nursing,
            effect_of_drug: chooseText(
                candidate.effect_of_drug || candidate.drug_effect || candidate['effect of drug'] || candidate.effect,
                originalDraft.effect_of_drug
            ),
            class_zh_hk: chooseText(candidate.class_zh_hk || candidate.class_zh, originalDraft.class_zh_hk),
            system_zh_hk: cantoneseSystemMap[systemCategories.includes(proposedSystem) ? proposedSystem : originalDraft.system] || '',
            indication_zh_hk: chooseText(candidate.indication_zh_hk || candidate.indication_zh, originalDraft.indication_zh_hk),
            side_effects_zh_hk: chooseText(candidate.side_effects_zh_hk || candidate.side_effects_zh, originalDraft.side_effects_zh_hk),
            nursing_zh_hk: nursingZh,
            effect_of_drug_zh_hk: chooseText(candidate.effect_of_drug_zh_hk || candidate.drug_effect_zh_hk || candidate.effect_zh_hk, originalDraft.effect_of_drug_zh_hk),
        };
        if (!improved.name) throw new Error('AI did not return a drug name. The data was left unchanged.');
        validateSimpleMobileDrugCard(improved);
        return improved;
    }

    function writeEditableDrugData(drugData, { includeMetadata = true } = {}) {
        AI_EDIT_FIELDS.forEach(({ key, id }) => {
            const field = document.getElementById(id);
            if (field) field.value = String(drugData?.[key] || '');
        });
        if (includeMetadata) {
            const sourceField = document.getElementById('ai-edit-data-source');
            const verifiedField = document.getElementById('ai-edit-verified-at');
            const modifiedField = document.getElementById('ai-edit-ai-modified');
            if (sourceField) sourceField.value = String(drugData?.data_source || sourceField.value || 'Manual entry');
            if (verifiedField) verifiedField.value = String(drugData?.verified_at || '');
            if (modifiedField) modifiedField.value = drugData?.ai_modified === true ? 'true' : 'false';
            const label = document.getElementById('ai-verification-label');
            if (label) label.textContent = drugData?.verified_at
                ? `✓ Verified ${formatVerifiedDate(drugData.verified_at)}`
                : '⚠ Needs verification';
        }
    }

    function markEditorAIChanged() {
        const modifiedField = document.getElementById('ai-edit-ai-modified');
        const verifiedField = document.getElementById('ai-edit-verified-at');
        const verificationLabel = document.getElementById('ai-verification-label');
        const verifyButton = document.getElementById('btn-mark-verified');
        if (modifiedField) modifiedField.value = 'true';
        if (verifiedField) verifiedField.value = '';
        if (verificationLabel) verificationLabel.textContent = '⚠ Needs verification after AI change';
        if (verifyButton) {
            verifyButton.disabled = false;
            verifyButton.textContent = '✓ Mark verified today';
        }
    }

    function captureAIEditorSnapshot() {
        return getEditableAISearchDrugDraft();
    }

    function pushAIUndoSnapshot() {
        aiEditUndoStack.push(captureAIEditorSnapshot());
        if (aiEditUndoStack.length > 20) aiEditUndoStack.shift();
        const undo = document.getElementById('btn-ai-diff-undo');
        if (undo) undo.disabled = false;
    }

    function setAIChangeRowDecision(fieldKey, decision) {
        if (!activeAIChangeReview) return;
        activeAIChangeReview.decisions[fieldKey] = decision;
        const row = document.getElementById(`ai-diff-row-${fieldKey}`);
        if (row) {
            row.classList.add('is-decided');
            row.dataset.decision = decision;
        }
    }

    function acceptAISuggestion(fieldKey, { saveUndo = true } = {}) {
        const review = activeAIChangeReview;
        const descriptor = AI_EDIT_FIELDS.find(field => field.key === fieldKey);
        if (!review || !descriptor || !(fieldKey in review.proposed)) return false;
        if (saveUndo) pushAIUndoSnapshot();
        const field = document.getElementById(descriptor.id);
        if (field) field.value = String(review.proposed[fieldKey] || '');
        markEditorAIChanged();
        setAIChangeRowDecision(fieldKey, 'ai');
        setAIReviewStatus(`${descriptor.label}: AI suggestion applied. Review before saving.`, 'var(--ios-blue)');
        return true;
    }

    function keepAIOriginal(fieldKey) {
        if (!activeAIChangeReview) return false;
        setAIChangeRowDecision(fieldKey, 'original');
        setAIReviewStatus('Original value kept. Nothing was saved.', 'var(--ios-gray)');
        return true;
    }

    function applyAllAISuggestions() {
        if (!activeAIChangeReview) return false;
        pushAIUndoSnapshot();
        activeAIChangeReview.changedKeys.forEach(fieldKey => acceptAISuggestion(fieldKey, { saveUndo: false }));
        setAIReviewStatus('All AI suggestions applied to the editor. Verify every field before saving.', 'var(--ios-blue)');
        return true;
    }

    function keepAllAIOriginals() {
        if (!activeAIChangeReview) return false;
        activeAIChangeReview.changedKeys.forEach(fieldKey => setAIChangeRowDecision(fieldKey, 'original'));
        const panel = document.getElementById('ai-diff-panel');
        if (panel) panel.hidden = true;
        setAIReviewStatus('All original values kept. Nothing was changed or saved.', 'var(--ios-gray)');
        return true;
    }

    function undoLastAIChange() {
        const snapshot = aiEditUndoStack.pop();
        if (!snapshot) return false;
        writeEditableDrugData(snapshot);
        if (activeAIChangeReview) {
            activeAIChangeReview.decisions = {};
            activeAIChangeReview.changedKeys.forEach(fieldKey => {
                const row = document.getElementById(`ai-diff-row-${fieldKey}`);
                if (!row) return;
                row.classList.remove('is-decided');
                delete row.dataset.decision;
            });
        }
        const undo = document.getElementById('btn-ai-diff-undo');
        if (undo) undo.disabled = aiEditUndoStack.length === 0;
        setAIReviewStatus('Last AI field change undone.', 'var(--ios-green)');
        return true;
    }

    function renderAIChangeReview(currentDraft, proposed) {
        const panel = document.getElementById('ai-diff-panel');
        if (!panel) return false;
        const changedFields = AI_EDIT_FIELDS.filter(({ key }) =>
            String(currentDraft?.[key] || '').trim() !== String(proposed?.[key] || '').trim()
        );
        activeAIChangeReview = {
            current: { ...currentDraft },
            proposed: { ...proposed },
            changedKeys: changedFields.map(field => field.key),
            decisions: {},
        };
        if (!changedFields.length) {
            panel.hidden = false;
            panel.innerHTML = '<div class="ai-diff-heading"><div><h4>No field changes suggested</h4><p>The concise AI result matches the current editor values.</p></div></div>';
            return true;
        }
        const displayValue = value => escapeHtml(String(value || '').trim() || '—');
        panel.innerHTML = `
            <div class="ai-diff-heading"><div><h4>Review ${changedFields.length} AI suggestions</h4><p>Choose each field. Nothing saves until you use a save button.</p></div></div>
            <div class="ai-diff-actions">
                <button type="button" class="ai-diff-apply-all" onclick="applyAllAISuggestions()">Use all AI</button>
                <button type="button" class="ai-diff-keep-all" onclick="keepAllAIOriginals()">Keep all original</button>
                <button id="btn-ai-diff-undo" type="button" class="ai-diff-undo" onclick="undoLastAIChange()" ${aiEditUndoStack.length ? '' : 'disabled'}>Undo last AI change</button>
            </div>
            <div class="ai-diff-list">${changedFields.map(({ key, label }) => `
                <article id="ai-diff-row-${key}" class="ai-diff-row">
                    <span class="ai-diff-label">${escapeHtml(label)}</span>
                    <div class="ai-diff-values">
                        <div class="ai-diff-value ai-diff-current"><strong>Current</strong>${displayValue(currentDraft[key])}</div>
                        <div class="ai-diff-value ai-diff-suggested"><strong>AI suggestion</strong>${displayValue(proposed[key])}</div>
                    </div>
                    <div class="ai-diff-row-actions">
                        <button type="button" class="ai-diff-use" onclick="acceptAISuggestion('${key}')">Use AI</button>
                        <button type="button" class="ai-diff-keep" onclick="keepAIOriginal('${key}')">Keep original</button>
                    </div>
                </article>`).join('')}</div>`;
        panel.hidden = false;
        panel.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        return true;
    }

    function applyAIImprovedDrugData(parsed, originalDraft) {
        const improved = buildAIImprovedDrugData(parsed, originalDraft);
        writeEditableDrugData({
            ...improved,
            data_source: originalDraft.data_source || 'DeepSeek AI draft',
            verified_at: '',
            ai_modified: true,
        });
        markEditorAIChanged();
        return improved;
    }

    function readPendingSheetWrites() {
        try {
            const value = JSON.parse(localStorage.getItem(PENDING_SHEET_WRITES_KEY) || '[]');
            return Array.isArray(value) ? value.filter(item => item && item.payload && item.mode) : [];
        } catch (_) {
            return [];
        }
    }

    function writePendingSheetWrites(items) {
        try { localStorage.setItem(PENDING_SHEET_WRITES_KEY, JSON.stringify(items.slice(-25))); } catch (_) {}
        updateSyncCentre();
    }

    function queuedSheetWriteKey(payload, mode) {
        return mode === 'update'
            ? `update:${payload.original_key || normalizeSearchText(payload.original_name)}`
            : `add:${getGoogleSheetSaveKey(payload)}`;
    }

    function queuePendingSheetWrite(payload, mode, originalName, error) {
        const key = queuedSheetWriteKey(payload, mode);
        const queue = readPendingSheetWrites().filter(item => item.key !== key);
        queue.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            key,
            created_at: new Date().toISOString(),
            mode,
            original_name: String(originalName || payload.original_name || ''),
            error: String(error?.message || error || 'Google Sheet unavailable').slice(0, 240),
            payload,
        });
        writePendingSheetWrites(queue);
    }

    function removeQueuedSheetWrite(payload, mode) {
        const key = queuedSheetWriteKey(payload, mode);
        writePendingSheetWrites(readPendingSheetWrites().filter(item => item.key !== key));
    }

    function setLastDatabaseSync(value = new Date().toISOString()) {
        try { localStorage.setItem(LAST_DATABASE_SYNC_KEY, value); } catch (_) {}
        updateSyncCentre();
    }

    function setSyncStatus(id, state, text) {
        const element = document.getElementById(id);
        if (!element) return;
        element.className = `sync-status-value ${state || ''}`.trim();
        element.textContent = text;
    }

    function updateAIUsageSummary() {
        const summary = window.DrugTutorAIUsage?.summary?.() || { pending: 0, total_tokens: 0, estimated_usd: 0 };
        const cost = Number(summary.estimated_usd || 0).toFixed(4);
        setSyncStatus('sync-ai-summary', summary.pending ? 'warning' : 'ok',
            `${Number(summary.total_tokens || 0).toLocaleString()} tokens · US$${cost} estimated · ${summary.pending} pending`);
        return summary;
    }

    function updateSyncCentre() {
        const pending = readPendingSheetWrites().length;
        setSyncStatus('sync-queue', pending ? 'warning' : 'ok', `${pending} pending`);
        const rawLastSync = localStorage.getItem(LAST_DATABASE_SYNC_KEY);
        setSyncStatus('sync-database', rawLastSync ? 'ok' : 'warning', rawLastSync
            ? `Last ${new Date(rawLastSync).toLocaleString()}`
            : 'Never synced');
        updateAIUsageSummary();
    }

    async function runConnectionCheck() {
        ['sync-sheet-drugs', 'sync-sheet-usage', 'sync-deepseek', 'sync-rxnorm', 'sync-openfda']
            .forEach(id => setSyncStatus(id, 'checking', 'Checking…'));
        const sheetCheck = checkGoogleSheetCapability(googleScriptURL, { requireUpdate: true });
        const deepSeekCheck = (async () => {
            const config = getApiConfiguration();
            if (!config.serverManaged) return config.configured
                ? { ok: true, message: 'Personal key saved · not sent for test' }
                : { ok: false, message: 'Personal key missing' };
            const response = await fetch(DEEPSEEK_PROXY_URL, { method: 'GET', cache: 'no-store' });
            const body = await response.json().catch(() => ({}));
            return { ok: response.ok && body.configured === true, message: body.configured ? `${body.model || DEEPSEEK_MODEL} ready` : 'Server key not configured' };
        })();
        const rxNormCheck = fetch(`${RXNORM_API_ROOT}/version.json`, { cache: 'no-store' })
            .then(response => ({ ok: response.ok, message: response.ok ? 'Official API reachable' : `HTTP ${response.status}` }))
            .catch(error => ({ ok: false, message: error?.message || 'Unavailable' }));
        const openFdaCheck = fetch(`${OPENFDA_LABEL_URL}?limit=1`, { cache: 'no-store' })
            .then(response => ({ ok: response.ok, message: response.ok ? 'Official dataset reachable' : `HTTP ${response.status}` }))
            .catch(error => ({ ok: false, message: error?.message || 'Unavailable' }));
        const [sheet, deepSeek, rxNorm, openFda] = await Promise.all([
            sheetCheck.catch(error => ({ ok: false, reason: error?.message || 'Unavailable' })),
            deepSeekCheck.catch(error => ({ ok: false, message: error?.message || 'Unavailable' })),
            rxNormCheck,
            openFdaCheck,
        ]);
        const protocol = Number(sheet?.body?.protocol_version || 0);
        setSyncStatus('sync-sheet-drugs', sheet.ok ? 'ok' : 'error', sheet.ok
            ? `Connected · protocol v${protocol} · bilingual add/update`
            : `Unavailable · ${sheet.reason || 'v2 bilingual support required'}`);
        const usageReady = sheet.ok && protocol >= 3 && sheet.body?.supports_usage_log === true;
        setSyncStatus('sync-sheet-usage', usageReady ? 'ok' : 'warning', usageReady
            ? 'Connected · AI_Usage sheet ready'
            : 'Apps Script v3 required · usage stays queued');
        setSyncStatus('sync-deepseek', deepSeek.ok ? 'ok' : 'error', deepSeek.message);
        setSyncStatus('sync-rxnorm', rxNorm.ok ? 'ok' : 'error', rxNorm.message);
        setSyncStatus('sync-openfda', openFda.ok ? 'ok' : 'error', openFda.message);
        updateSyncCentre();
        return { sheet, deepSeek, rxNorm, openFda };
    }

    async function syncAIUsageNow() {
        setSyncStatus('sync-sheet-usage', 'checking', 'Sending queued usage…');
        try {
            const result = await window.DrugTutorAIUsage.sync(googleScriptURL);
            setSyncStatus('sync-sheet-usage', 'ok', `${result.sent} record${result.sent === 1 ? '' : 's'} sent · ${result.pending} pending`);
            updateAIUsageSummary();
            return true;
        } catch (error) {
            setSyncStatus('sync-sheet-usage', 'error', error?.message || 'Usage sync failed');
            updateAIUsageSummary();
            return false;
        }
    }

    async function retryQueuedDrugSaves() {
        const queue = readPendingSheetWrites();
        if (!queue.length) {
            setSyncStatus('sync-queue', 'ok', '0 pending · nothing to retry');
            return true;
        }
        setSyncStatus('sync-queue', 'checking', `Retrying ${queue.length}…`);
        const remaining = [];
        let sent = 0;
        for (const entry of queue) {
            const capability = await checkGoogleSheetCapability(googleScriptURL, { requireUpdate: entry.mode === 'update' });
            if (!capability.ok) {
                remaining.push({ ...entry, error: capability.reason || 'Capability check failed' });
                continue;
            }
            const outcome = await postDrugToGoogleSheet(googleScriptURL, entry.payload, { mode: entry.mode });
            if (!outcome.ok) {
                remaining.push({ ...entry, error: outcome.message || outcome.code || 'Retry failed' });
                continue;
            }
            if (entry.mode === 'update') replaceDrugInLocalList(entry.original_name, entry.payload);
            else upsertDrugToLocalList(entry.payload);
            sent += 1;
        }
        writePendingSheetWrites(remaining);
        if (sent) setLastDatabaseSync();
        setSyncStatus('sync-queue', remaining.length ? 'warning' : 'ok', `${sent} sent · ${remaining.length} pending`);
        return remaining.length === 0;
    }
