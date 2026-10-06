(function (global) {
    'use strict';

    const HISTORY_KEY = 'drug_tutor_ai_usage_history_v1';
    const PENDING_KEY = 'drug_tutor_ai_usage_pending_v1';
    const MAX_HISTORY = 250;
    const MAX_ERROR_CHARS = 240;
    const PRICING_VERSION = '2026-09-10';
    const PRICE_PER_MILLION_USD = {
        off_peak: { cache_hit: 0.003, cache_miss: 0.15, output: 0.60 },
        peak: { cache_hit: 0.006, cache_miss: 0.30, output: 1.20 },
    };

    let configuredScriptUrl = '';
    let scheduledSync = null;

    function readStored(key, fallback) {
        try {
            const parsed = JSON.parse(global.localStorage.getItem(key) || 'null');
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function writeStored(key, value) {
        try {
            global.localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    }

    function finiteToken(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
    }

    function normalizeUsage(rawUsage) {
        const raw = rawUsage && typeof rawUsage === 'object' ? rawUsage : {};
        const promptTokens = finiteToken(raw.prompt_tokens);
        const details = raw.prompt_tokens_details && typeof raw.prompt_tokens_details === 'object'
            ? raw.prompt_tokens_details
            : {};
        const cacheHitTokens = Math.min(promptTokens, finiteToken(
            raw.prompt_cache_hit_tokens ?? raw.cache_hit_tokens ?? details.cached_tokens
        ));
        const explicitMiss = raw.prompt_cache_miss_tokens ?? raw.cache_miss_tokens;
        const cacheMissTokens = explicitMiss == null
            ? Math.max(0, promptTokens - cacheHitTokens)
            : Math.min(promptTokens || Infinity, finiteToken(explicitMiss));
        const completionTokens = finiteToken(raw.completion_tokens);
        const totalTokens = finiteToken(raw.total_tokens) || promptTokens + completionTokens;
        return {
            prompt_tokens: promptTokens,
            cache_hit_tokens: cacheHitTokens,
            cache_miss_tokens: cacheMissTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
        };
    }

    function addUsage(first, second) {
        const a = normalizeUsage(first);
        const b = normalizeUsage(second);
        return {
            prompt_tokens: a.prompt_tokens + b.prompt_tokens,
            cache_hit_tokens: a.cache_hit_tokens + b.cache_hit_tokens,
            cache_miss_tokens: a.cache_miss_tokens + b.cache_miss_tokens,
            completion_tokens: a.completion_tokens + b.completion_tokens,
            total_tokens: a.total_tokens + b.total_tokens,
        };
    }

    function pricingPeriod(dateValue) {
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now());
        const weekday = date.getUTCDay() >= 1 && date.getUTCDay() <= 5;
        const hour = date.getUTCHours();
        return weekday && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10))
            ? 'peak'
            : 'off_peak';
    }

    function estimateCost(usage, period) {
        const tokens = normalizeUsage(usage);
        const rates = PRICE_PER_MILLION_USD[period] || PRICE_PER_MILLION_USD.off_peak;
        return Number((
            (tokens.cache_hit_tokens * rates.cache_hit
                + tokens.cache_miss_tokens * rates.cache_miss
                + tokens.completion_tokens * rates.output) / 1_000_000
        ).toFixed(8));
    }

    function makeRequestId() {
        try {
            if (global.crypto && typeof global.crypto.randomUUID === 'function') {
                return global.crypto.randomUUID();
            }
        } catch (_) {}
        return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function scheduleSync() {
        if (!configuredScriptUrl || scheduledSync) return;
        scheduledSync = global.setTimeout(async () => {
            scheduledSync = null;
            try { await sync(configuredScriptUrl); } catch (_) {}
        }, 2500);
    }

    function record(options) {
        const value = options && typeof options === 'object' ? options : {};
        const timestamp = value.timestamp || new Date().toISOString();
        const usage = normalizeUsage(value.usage);
        const period = pricingPeriod(timestamp);
        const entry = {
            request_id: String(value.request_id || makeRequestId()),
            timestamp,
            feature: String(value.feature || 'DeepSeek AI').slice(0, 100),
            model: String(value.model || 'deepseek-flash').slice(0, 80),
            mode: value.mode === 'personal' ? 'personal' : 'server',
            success: value.success !== false,
            prompt_tokens: usage.prompt_tokens,
            cache_hit_tokens: usage.cache_hit_tokens,
            cache_miss_tokens: usage.cache_miss_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            retry_count: finiteToken(value.retry_count),
            estimated_usd: estimateCost(usage, period),
            pricing_period: period,
            pricing_version: PRICING_VERSION,
            error: String(value.error || '').slice(0, MAX_ERROR_CHARS),
        };
        const history = readStored(HISTORY_KEY, []);
        history.unshift(entry);
        writeStored(HISTORY_KEY, history.slice(0, MAX_HISTORY));
        const pending = readStored(PENDING_KEY, []);
        if (!pending.some(item => item.request_id === entry.request_id)) pending.push(entry);
        writeStored(PENDING_KEY, pending.slice(-MAX_HISTORY));
        scheduleSync();
        try {
            global.dispatchEvent(new CustomEvent('drug-tutor-ai-usage', { detail: entry }));
        } catch (_) {}
        return entry;
    }

    async function getCapabilities(scriptUrl) {
        const response = await global.fetch(`${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=capabilities`, {
            method: 'GET',
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Google Sheet capability check failed (${response.status}).`);
        return response.json();
    }

    async function sync(scriptUrl = configuredScriptUrl) {
        const target = String(scriptUrl || '').trim();
        const pending = readStored(PENDING_KEY, []);
        if (!target || pending.length === 0) return { ok: true, sent: 0, pending: pending.length };
        const capabilities = await getCapabilities(target);
        if (!capabilities?.ok || Number(capabilities.protocol_version || 0) < 3 || capabilities.supports_usage_log !== true) {
            const error = new Error('Google Sheet needs the v3 Apps Script for AI usage logging.');
            error.code = 'usage_protocol_mismatch';
            throw error;
        }

        let sent = 0;
        let queue = pending.slice();
        for (const entry of pending) {
            const response = await global.fetch(target, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'log_ai_usage', protocol_version: 3, ...entry }),
            });
            if (!response.ok) throw new Error(`AI usage upload failed (${response.status}).`);
            const result = await response.json();
            if (!result?.ok) throw new Error(result?.message || 'AI usage upload was not acknowledged.');
            queue = queue.filter(item => item.request_id !== entry.request_id);
            writeStored(PENDING_KEY, queue);
            sent += 1;
        }
        return { ok: true, sent, pending: queue.length };
    }

    function summary() {
        const history = readStored(HISTORY_KEY, []);
        return {
            requests: history.length,
            pending: readStored(PENDING_KEY, []).length,
            total_tokens: history.reduce((sum, item) => sum + finiteToken(item.total_tokens), 0),
            estimated_usd: Number(history.reduce((sum, item) => sum + Number(item.estimated_usd || 0), 0).toFixed(6)),
        };
    }

    function configure(options) {
        configuredScriptUrl = String(options?.scriptUrl || configuredScriptUrl || '').trim();
        if (configuredScriptUrl) scheduleSync();
    }

    global.DrugTutorAIUsage = Object.freeze({
        configure,
        record,
        sync,
        summary,
        getHistory: () => readStored(HISTORY_KEY, []),
        getPending: () => readStored(PENDING_KEY, []),
        normalizeUsage,
        addUsage,
        pricingPeriod,
        estimateCost,
        pricingVersion: PRICING_VERSION,
    });
})(window);
