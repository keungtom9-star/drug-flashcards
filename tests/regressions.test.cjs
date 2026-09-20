const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const inlineScripts = name => [...read(name).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).filter(source => source.trim());

function element() {
    const attributes = new Map(), classes = new Set();
    return {
        style: {}, dataset: {}, value: '', innerText: '', innerHTML: '', disabled: false, hidden: false, children: [],
        addEventListener() {},
        focus() { this.focused = true; }, blur() { this.focused = false; }, scrollIntoView() {},
        appendChild(child) { this.children.push(child); },
        classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle: (c, force) => { const add = force ?? !classes.has(c); if (add) classes.add(c); else classes.delete(c); return add; } },
        removeAttribute: key => attributes.delete(key), getAttribute: key => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
        querySelectorAll: () => [], querySelector: () => null,
    };
}

function browserContext(records = {}) {
    const storage = new Map(Object.entries(records)), elements = new Map(), viewportListeners = {}, css = {}, events = {};
    const document = {
        body: element(),
        documentElement: { style: { setProperty: (key, value) => { css[key] = value; } } },
        addEventListener() {}, querySelectorAll: () => [],
        getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
        createElement: () => element(), createDocumentFragment: () => element(),
    };
    const context = vm.createContext({
        document, navigator: { userAgent: 'test' }, console, URL, Response,
        localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
        addEventListener(name, callback) { (events[name] ||= []).push(callback); }, innerHeight: 844,
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        visualViewport: { scale: 1, height: 844, offsetTop: 0, addEventListener: (name, fn) => { viewportListeners[name] = fn; } },
        speechSynthesis: { cancel() {} },
        getComputedStyle: el => ({ display: el.style.display || el.cssDisplay || 'block' }),
        setTimeout() {}, clearTimeout() {}, alert() {},
    });
    context.window = context;
    context.parent = context;
    vm.runInContext(read('app-ui.js'), context);
    return { context, elements, storage, document, viewportListeners, css, events };
}
function loadQuiz(records = {}) {
    const state = browserContext(records);
    for (const source of inlineScripts('drugquiz.html')) vm.runInContext(source, state.context);
    return state;
}
function optionGroup(session = true, letters = ['A', 'B', 'C', 'D']) {
    const group = element();
    const options = letters.map(letter => Object.assign(element(), {
        dataset: { option: letter }, parentElement: group, closest: () => session ? {} : null,
    }));
    group.querySelectorAll = () => options;
    return options;
}
const question = { Topic: 'Practice', Question: 'Pick C', OptionA: 'First', OptionB: 'Second', OptionC: 'Third', OptionD: 'Fourth', Correct: 'C', Explanation: 'Example rationale' };

test('all inline application scripts parse', () => {
    for (const file of ['index.html', 'drugquiz.html', 'ward.html']) {
        for (const source of inlineScripts(file)) assert.doesNotThrow(() => new vm.Script(source, { filename: file }));
    }
});

test('Ward imaging reference covers and filters common radiology and echo studies', () => {
    const html = read('ward.html');
    assert.match(html, /data-tab="imaging"/);
    assert.match(html, /id="imaging" class="container"/);

    const state = browserContext();
    for (const source of inlineScripts('ward.html')) vm.runInContext(source, state.context);
    assert.ok(vm.runInContext('imagingReference.length', state.context) >= 14);
    for (const term of ['USG abdomen', 'AXR / KUB', 'CT brain', 'CT thorax', 'Venous USG Doppler', 'Echocardiogram', 'contrast safety']) {
        assert.match(html, new RegExp(term, 'i'));
    }

    const input = state.document.getElementById('imaging-search');
    input.value = 'droppler';
    state.context.renderImagingReference();
    assert.match(state.document.getElementById('imaging-grid').innerHTML, /Venous USG Doppler/);
    assert.match(state.document.getElementById('imaging-result-meta').textContent, /2 of 14/);

    state.context.setImagingCategory('Echo', element());
    input.value = '';
    state.context.renderImagingReference();
    assert.match(state.document.getElementById('imaging-grid').innerHTML, /Echocardiogram \(TTE\)/);
    assert.doesNotMatch(state.document.getElementById('imaging-grid').innerHTML, /CT pulmonary angiogram/);
});

test('malformed or incompatible saved state does not block startup; valid state survives', () => {
    const { context } = browserContext({ broken: '{', null: 'null', wrongType: '[]', valid: '{"review":3}' });
    for (const key of ['broken', 'null', 'missing', 'wrongType']) assert.deepEqual(context.DrugTutorUI.readStoredJSON(key, {}), {});
    assert.equal(context.DrugTutorUI.readStoredJSON('valid', {}).review, 3);
    const main = browserContext({ drug_tutor_search_history: '{' });
    for (const source of inlineScripts('index.html')) assert.doesNotThrow(() => vm.runInContext(source, main.context));
});

test('viewport changes follow keyboard height without overriding pinch zoom', () => {
    const { context, viewportListeners, css } = browserContext();
    assert.equal(css['--app-height'], '844px');
    context.visualViewport.height = 390;
    context.visualViewport.offsetTop = 20;
    viewportListeners.resize();
    assert.equal(css['--app-height'], '390px');
    assert.equal(css['--viewport-top'], '20px');
    context.visualViewport.scale = 2;
    context.visualViewport.height = 195;
    viewportListeners.resize();
    assert.equal(css['--app-height'], '390px');
});

test('revisiting an answered question cannot increase attempts or change its recorded score', () => {
    const { context } = loadQuiz();
    context.check(optionGroup()[0], 'A', 'C', 'exp-1', question);
    context.check(optionGroup()[2], 'C', 'C', 'exp-2', question);
    assert.equal(vm.runInContext('sessionAttempted', context), 1);
    assert.equal(vm.runInContext('sessionCorrect', context), 0);
    assert.equal(vm.runInContext('sessionAnswers.values().next().value', context), 'A');
});

test('returning to a question restores its answer and clears the previous scroll position', () => {
    const { context, document } = loadQuiz();
    const options = optionGroup();
    context.check(options[0], 'A', 'C', 'exp-old', question);
    context.testQuestion = question;
    const container = document.getElementById('quiz-container');
    const revisited = optionGroup();
    container.scrollTop = 800;
    container.querySelector = selector => selector === '[data-option="A"]' ? revisited[0] : null;
    vm.runInContext('quizQueue = [testQuestion]; renderCurrentQuestion()', context);
    assert.equal(container.scrollTop, 0);
    assert.equal(revisited[0].classList.contains('wrong'), true);
    assert.equal(revisited[2].classList.contains('correct'), true);
    assert.equal(revisited.every(option => option.disabled), true);
    assert.equal(vm.runInContext('sessionAttempted', context), 1);
});

test('generated previews do not affect session progress, and sparse options highlight the correct letter', () => {
    const { context, storage } = loadQuiz();
    const options = optionGroup(false, ['A', 'D']);
    context.check(options[0], 'A', 'D', 'exp-gen', { ...question, Correct: 'D' });
    assert.equal(vm.runInContext('sessionAttempted', context), 0);
    assert.equal(storage.has('quiz_progress'), false);
    assert.equal(options[1].classList.contains('correct'), true);
});

test('starting a fresh session resets the score without shuffling the source array in place', () => {
    const { context, document } = loadQuiz();
    context.rows = [question, { ...question, Question: 'Second' }, { ...question, Question: 'Third' }];
    const before = context.rows.map(q => q.Question);
    vm.runInContext('renderCurrentQuestion = () => {}; Math.random = () => 0; startQuiz(rows)', context);
    assert.deepEqual(context.rows.map(q => q.Question), before);
    assert.equal(document.getElementById('accuracy-display').innerText, '🎯 0%');
});

test('Back respects CSS-hidden views and exits to the parent when no nested view is open', () => {
    const { context, document } = loadQuiz();
    for (const id of ['gen-view', 'quiz-view', 'subtopic-view']) document.getElementById(id).cssDisplay = 'none';
    let destination;
    context.parent = { switchMode: mode => { destination = mode; } };
    context.goBack();
    assert.equal(destination, 'search');
    document.getElementById('subtopic-view').style.display = 'flex';
    destination = undefined;
    context.goBack();
    assert.equal(document.getElementById('subtopic-view').style.display, 'none');
    assert.equal(destination, undefined);
});

test('imported question text and quotation marks cannot break the option handler', () => {
    const { context } = loadQuiz();
    const hostile = { ...question, Question: '<img src=x onerror=alert(1)> & "quote"', OptionA: 'It\'s <safe> &quot;', Correct: "C'bad" };
    const html = context.buildCardHTML(hostile, 'test', true);
    assert.ok(!html.includes('<img src=x'));
    assert.ok(html.includes('&lt;safe&gt;'));
    const encoded = html.match(/onclick="([^"]+)"/)[1];
    const decoded = encoded.replace(/&(quot|#39|lt|gt|amp);/g, (_, key) => ({ quot: '"', '#39': "'", lt: '<', gt: '>', amp: '&' }[key]));
    assert.doesNotThrow(() => new vm.Script(decoded));
});

test('unknown search text is rendered as text and passed through a bound handler', async () => {
    const { context, document } = browserContext({ ds_key: 'test-key' });
    for (const source of inlineScripts('index.html')) vm.runInContext(source, context);
    const query = '<img src=x onerror=alert(1)> "quote"';
    document.getElementById('search-input').value = query;
    let passed;
    context.fetch = async () => { throw new Error('Sheet unavailable'); };
    context.triggerAISearch = q => { passed = q; };
    context.runSearch();
    assert.ok(!document.getElementById('search-results').innerHTML.includes('<img src=x'));
    await document.getElementById('ask-ai-search').onclick();
    assert.equal(passed, query);
});

test('cached clinical questions still load when the CSV library is unavailable', () => {
    const { context, storage, document } = loadQuiz();
    storage.set('clinical_question_bank:sheet-a', JSON.stringify([question]));
    document.getElementById('sheet-url').value = 'sheet-a';
    vm.runInContext('renderTopics = () => {}; filterTopics = () => {}', context);
    context.loadSheet();
    assert.equal(vm.runInContext('dbQuestions.length', context), 1);
    assert.match(document.getElementById('db-status').innerText, /saved questions.*offline/);
    document.getElementById('sheet-url').value = 'sheet-b';
    context.loadSheet();
    assert.equal(vm.runInContext('dbQuestions.length', context), 0);
});

function workerContext(base = 'https://example.test/drug-flashcards/') {
    const handlers = {}, entries = new Map(), deleted = [], requested = [];
    const cache = {
        async addAll(urls) { for (const url of urls) { requested.push(url); entries.set(url, new Response(url)); } },
        async put(key, response) { entries.set(key, response); },
        async match(key) { return entries.get(key)?.clone(); },
    };
    let online = true;
    const prefix = `drug-tutor-${encodeURIComponent(new URL(base).pathname)}-`;
    const context = vm.createContext({
        URL, Response,
        self: { location: { href: base + 'service-worker.js' }, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting() {}, clients: { claim() {} } },
        caches: { open: async () => cache, keys: async () => [prefix+'v2', prefix+'v3', prefix+'v4', prefix+'v5', prefix+'v6', prefix+'v7', 'another-app'], delete: async key => deleted.push(key) },
        fetch: async request => { if (!online) throw Error('offline'); return new Response('network:'+request.url); },
    });
    vm.runInContext(read('service-worker.js'), context);
    return { handlers, entries, requested, deleted, setOffline: () => { online = false; } };
}
async function lifecycle(worker, type) {
    let promise;
    worker.handlers[type]({ waitUntil: value => { promise = value; } });
    await promise;
}
function request(worker, url, mode = 'navigate', method = 'GET') {
    let response;
    worker.handlers.fetch({ request: { url, mode, method }, respondWith: value => { response = value; } });
    return response;
}

test('service worker installs under root and GitHub Pages subpaths', async () => {
    for (const base of ['https://example.test/', 'https://example.test/drug-flashcards/']) {
        const worker = workerContext(base);
        await lifecycle(worker, 'install');
        assert.ok(worker.requested.every(url => url.startsWith(base)));
        assert.ok(worker.requested.includes(base+'drugquiz.html'));
        assert.ok(worker.requested.includes(base+'app-ui.js'));
    }
});

test('visiting Ward cannot replace cached home or Clinical pages', async () => {
    const base = 'https://example.test/drug-flashcards/';
    const worker = workerContext(base);
    await lifecycle(worker, 'install');
    await request(worker, base+'ward.html');
    worker.setOffline();
    assert.equal(await (await request(worker, base+'index.html')).text(), base+'index.html');
    assert.equal(await (await request(worker, base+'ward.html')).text(), 'network:'+base+'ward.html');
    assert.equal(await (await request(worker, base+'drugquiz.html')).text(), base+'drugquiz.html');
});

test('worker leaves other apps, third parties and writes untouched', async () => {
    const worker = workerContext();
    await lifecycle(worker, 'activate');
    assert.deepEqual(worker.deleted, ['drug-tutor-%2Fdrug-flashcards%2F-v2', 'drug-tutor-%2Fdrug-flashcards%2F-v3', 'drug-tutor-%2Fdrug-flashcards%2F-v4', 'drug-tutor-%2Fdrug-flashcards%2F-v5', 'drug-tutor-%2Fdrug-flashcards%2F-v6']);
    assert.equal(request(worker, 'https://example.test/other-app/index.html'), undefined);
    assert.equal(request(worker, 'https://api.example.test/chat'), undefined);
    assert.equal(request(worker, 'https://example.test/drug-flashcards/index.html', 'navigate', 'POST'), undefined);
});

function loadMain(records = {}) {
    const state = browserContext({ auto_sync_startup: '0', ...records });
    for (const source of inlineScripts('index.html')) vm.runInContext(source, state.context);
    return state;
}

test('startup and all navigation tabs work after removing the old study controls', () => {
    const { context, document, events } = loadMain({ drug_tutor_search_history: '{' });
    const ids = new Set([...read('index.html').matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    const getElement = document.getElementById.bind(document);
    document.getElementById = id => ids.has(id) ? getElement(id) : null;
    document.querySelectorAll = selector => selector === '.glass-nav .nav-btn'
        ? ['search', 'quiz', 'ward', 'clinical'].map(mode => getElement('nav-' + mode)) : [];
    for (const callback of events.DOMContentLoaded || []) assert.doesNotThrow(callback);
    assert.ok(vm.runInContext('activeSourceList.length', context) > 0);
    assert.equal(vm.runInContext('quizList.length === activeSourceList.length', context), true);
    assert.equal(getElement('search-section').style.display, 'block');
    assert.equal(getElement('search-api-notice').hidden, false);
    vm.runInContext('setupWardPreload = () => {}; setupClinicalPreload = () => {}; beginClinicalBackSync = () => {};', context);
    for (const mode of ['quiz', 'ward', 'clinical', 'search']) {
        context.switchMode(mode);
        assert.equal(getElement(mode + '-section').style.display, 'block');
        assert.equal(getElement('nav-' + mode).getAttribute('aria-current'), 'page');
    }
    assert.equal(document.getElementById('nav-flash'), null);
    assert.equal(document.getElementById('flashcard-section'), null);
    assert.equal(typeof context.rateCurrentCard, 'undefined');
    assert.equal(typeof context.generateDailyPicks, 'undefined');
});

test('local search ranks names before incidental text and supports case, multiple words and systems', () => {
    const { context } = loadMain();
    context.rows = [
        { name: 'Other medicine', class: 'Example', indication: 'Reference', nursing: 'See Panadol', system: '🫀 Cardio' },
        { name: 'Paracetamol (Panadol)', class: 'Example', indication: 'Pain', system: '🧠 CNS / Neuro' },
        { name: 'Panadol Extra', class: 'Example', indication: 'Pain', system: '🧠 CNS / Neuro' },
        { name: 'Co-amoxiclav', class: 'Example', indication: 'Example indication', system: '🦠 Infections' },
    ];
    vm.runInContext('activeSourceList = prepareDrugListForFastSearch(rows)', context);
    assert.deepEqual(Array.from(context.findLocalDrugs('  PANADOL  '), row => row.name), ['Panadol Extra', 'Paracetamol (Panadol)', 'Other medicine']);
    assert.equal(context.findLocalDrugs('panadol pain').length, 2);
    assert.equal(context.findLocalDrugs('co amoxiclav')[0].name, 'Co-amoxiclav');
    assert.equal(context.findLocalDrugs('panadol', '🫀 Cardio')[0].name, 'Other medicine');
    assert.equal(context.findLocalDrugs('', '🦠 Infections').length, 1);
});

test('search pagination exposes every match and clear restores useful guidance', () => {
    const { context, document } = loadMain();
    context.rows = Array.from({ length: 45 }, (_, index) => ({ name: 'Example drug ' + index, class: 'Practice', system: '🫀 Cardio' }));
    vm.runInContext('activeSourceList = prepareDrugListForFastSearch(rows)', context);
    document.getElementById('search-input').value = 'example';
    context.runSearch();
    assert.equal(document.getElementById('search-status').textContent, '30 of 45 matching drugs');
    assert.equal(document.getElementById('more-search-results').hidden, false);
    context.showMoreSearchResults();
    assert.equal(document.getElementById('search-status').textContent, '45 of 45 matching drugs');
    assert.equal(document.getElementById('more-search-results').hidden, true);
    context.clearSearch();
    assert.equal(document.getElementById('search-input').value, '');
    assert.match(document.getElementById('search-results').innerHTML, /What are you looking for/);
    assert.equal(document.getElementById('clear-search').hidden, true);
});

test('external drug searches use a real secure link instead of window.open', () => {
    const { context, document } = loadMain();
    const opened = [];
    document.createElement = tag => {
        const node = element();
        node.click = () => opened.push({ tag, href: node.href, target: node.target, rel: node.rel });
        node.remove = () => {};
        return node;
    };
    context.open = () => { throw new Error('window.open should not be used'); };
    context.openGoogleDeepLink('Metformin 中文 香港');
    context.openDrugsCom({ name: 'Metformin (Glucophage)' });
    assert.equal(opened.length, 2);
    assert.equal(opened[0].tag, 'a');
    assert.equal(new URL(opened[0].href).hostname, 'www.google.com');
    assert.equal(new URL(opened[0].href).searchParams.get('q'), 'Metformin 中文 香港');
    assert.equal(new URL(opened[0].href).searchParams.get('client'), 'safari');
    assert.equal(new URL(opened[1].href).hostname, 'www.drugs.com');
    assert.equal(new URL(opened[1].href).searchParams.get('searchterm'), 'Metformin');
    assert.ok(opened.every(link => link.target === '_blank' && link.rel.includes('noopener')));
});

test('a missing local drug checks Google Sheet before using AI', async () => {
    const { context, document } = loadMain({ ds_key: 'test-key' });
    document.getElementById('sheet-url').value = 'https://example.test/drugs.csv';
    document.getElementById('search-input').value = 'Cloud medicine';
    context.Papa = { parse: () => ({ data: [{ name: 'Cloud medicine (Sheetbrand)', class: 'Example', indication: 'Testing', system: '🫀 Cardio' }] }) };
    context.fetch = async () => ({ ok: true, text: async () => 'csv' });
    let aiCalls = 0;
    context.triggerAISearch = async () => { aiCalls++; };
    await context.resolveMissingDrug('Cloud medicine');
    assert.equal(aiCalls, 0);
    assert.equal(context.findLocalDrugs('Cloud medicine')[0].name, 'Cloud medicine (Sheetbrand)');
    assert.match(document.getElementById('search-status').textContent, /Found in Google Sheet/);
});

test('a drug absent from Google Sheet is found by AI, added once to Sheet and made searchable', async () => {
    const { context, document } = loadMain({ ds_key: 'test-key' });
    document.getElementById('sheet-url').value = 'https://example.test/drugs.csv';
    document.getElementById('search-input').value = 'Novelmed';
    context.Papa = { parse: () => ({ data: [] }) };
    let sheetWrites = 0;
    context.fetch = async (_url, options = {}) => {
        if (options.method === 'POST') {
            sheetWrites++;
            return { ok: true, text: async () => '' };
        }
        return { ok: true, text: async () => 'name,class' };
    };
    context.streamAIResponse = async (_messages, onUpdate) => onUpdate(JSON.stringify({
        name: 'Novelmed (Nova)', class: 'Test class', system: '🫀 Cardio', indication: 'Testing',
        side_effects: 'Example effect', nursing: 'Monitor response', effect_of_drug: 'Example action'
    }));
    await context.resolveMissingDrug('Novelmed');
    assert.equal(sheetWrites, 1);
    assert.equal(context.findLocalDrugs('Novelmed')[0].name, 'Novelmed (Nova)');
    await context.saveToGoogleSheet({ name: 'Novelmed (Another brand)', class: 'Test class', system: '🫀 Cardio' });
    assert.equal(sheetWrites, 1);
});

test('search history saves submitted searches once, with a small limit', () => {
    const { context, storage } = loadMain();
    for (let i = 0; i < 8; i++) context.rememberSearch('Term ' + i);
    context.rememberSearch('TERM 7');
    const history = JSON.parse(storage.get('drug_tutor_search_history'));
    assert.equal(history.length, 6);
    assert.equal(history[0], 'TERM 7');
    assert.equal(history.filter(term => term.toLowerCase() === 'term 7').length, 1);
});

test('missing or blank API keys open setup without sending AI requests or resetting a quiz', async () => {
    const { context, document } = loadMain({ ds_key: '  ' });
    let aiRequests = 0;
    context.fetch = async url => {
        if (/api\.(deepseek|openrouter)/.test(String(url))) aiRequests++;
        throw Error('Sheet unavailable');
    };
    document.getElementById('search-input').value = 'unknown drug';
    context.runSearch();
    await document.getElementById('ask-ai-search').onclick();
    assert.equal(document.getElementById('settings-panel').style.display, 'flex');
    assert.equal(document.getElementById('deepseek-key').focused, true);
    await context.triggerAISearch('unknown drug');
    await assert.rejects(context.streamAIResponse([], () => {}), /Add an API key/);
    vm.runInContext('currentRoundTotal = 5; currentRoundAnswered = 2;', context);
    context.startQuizRound();
    assert.equal(vm.runInContext('currentRoundAnswered', context), 2);
    assert.equal(aiRequests, 0);
});

test('API reminders follow the active provider and save/clear updates them immediately', () => {
    const { context, document, storage } = loadMain({ ds_key: 'existing-test-key', active_provider: 'openrouter-trinity' });
    context.updateApiNotices();
    assert.equal(document.getElementById('search-api-notice').hidden, false);
    context.openApiSettings();
    assert.equal(document.getElementById('openrouter-key').focused, true);
    document.getElementById('provider-select').value = 'openrouter-trinity';
    document.getElementById('openrouter-key').value = '  replacement-test-key  ';
    context.saveSettings();
    assert.equal(storage.get('openrouter_key'), 'replacement-test-key');
    assert.equal(document.getElementById('search-api-notice').hidden, true);
    assert.equal(document.getElementById('quiz-api-notice').hidden, true);
    document.getElementById('openrouter-key').value = ' ';
    context.saveSettings();
    assert.equal(document.getElementById('search-api-notice').hidden, false);
});

test('Clinical Bank reads the shared DeepSeek key and guides keyless generation to Settings', async () => {
    const { context, document, storage, events } = loadQuiz({ api_key: 'legacy-shared-test-key' });
    context.onload();
    assert.equal(document.getElementById('api-key').value, 'legacy-shared-test-key');
    assert.equal(document.getElementById('clinical-api-notice').hidden, true);
    storage.set('ds_key', '');
    storage.set('api_key', '');
    for (const callback of events.storage || []) callback({ key: 'ds_key' });
    assert.equal(document.getElementById('clinical-api-notice').hidden, false);
    let requests = 0;
    context.fetch = async () => { requests++; };
    await context.startGeneration();
    assert.equal(document.getElementById('settings-overlay').style.display, 'flex');
    assert.equal(document.getElementById('api-key').focused, true);
    assert.equal(requests, 0);
});
