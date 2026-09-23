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
        document, navigator: { userAgent: 'test' }, console, URL, Response, TextDecoder,
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
    assert.ok(vm.runInContext('imagingReference.length', state.context) >= 24);
    for (const term of ['USG abdomen', 'AXR / KUB', 'CT brain', 'CT thorax', 'Venous USG Doppler', 'Carotid USG Doppler', 'CT KUB', 'CTA aorta', 'MRI brain', 'MRI spine', 'Echocardiogram', 'TOE / TEE', 'VFSS', 'V/Q lung scan', 'contrast safety']) {
        assert.match(html, new RegExp(term, 'i'));
    }

    const input = state.document.getElementById('imaging-search');
    input.value = 'droppler';
    state.context.renderImagingReference();
    assert.match(state.document.getElementById('imaging-grid').innerHTML, /Venous USG Doppler/);
    assert.match(state.document.getElementById('imaging-result-meta').textContent, /2 of 24/);

    state.context.setImagingCategory('Echo', element());
    input.value = '';
    state.context.renderImagingReference();
    assert.match(state.document.getElementById('imaging-grid').innerHTML, /Echocardiogram \(TTE\)/);
    assert.match(state.document.getElementById('imaging-grid').innerHTML, /TOE \/ TEE/);
    assert.doesNotMatch(state.document.getElementById('imaging-grid').innerHTML, /CT pulmonary angiogram/);

    state.context.setImagingCategory('MRI', element());
    state.context.renderImagingReference();
    assert.match(state.document.getElementById('imaging-grid').innerHTML, /MRI brain/);
    assert.match(state.document.getElementById('imaging-grid').innerHTML, /MRI spine/);
    assert.doesNotMatch(state.document.getElementById('imaging-grid').innerHTML, /CT brain/);
});

test('Ward laboratory reference explains common values and safe ABG / VBG use', () => {
    const html = read('ward.html');
    assert.match(html, /Laboratory values \+ ABG \/ VBG/);
    assert.match(html, /adult ranges below are approximate learning aids/i);
    assert.match(html, /Never use PvO₂ to judge oxygenation/);
    assert.match(html, /Assay-specific 99th percentile \+ serial change/);
    assert.match(html, /expected PaCO₂ ≈ 1\.5 × HCO₃⁻ \+ 8 \(±2 mmHg\)/);
    assert.doesNotMatch(html, /Troponin I[^\n]*&lt;\s*0\.04/i);

    const state = browserContext();
    for (const source of inlineScripts('ward.html')) vm.runInContext(source, state.context);
    assert.ok(vm.runInContext('labReference.length', state.context) >= 60);
    for (const term of ['haemoglobin', 'INR', 'sodium', 'creatinine', 'bilirubin', 'CRP', 'troponin', 'HbA1c', 'albumin:creatinine ratio', 'PaCO₂', 'lactate', 'anion gap']) {
        assert.match(html, new RegExp(term, 'i'));
    }

    const input = state.document.getElementById('lab-search');
    input.value = 'serial delta';
    state.context.renderLabReference();
    assert.match(state.document.getElementById('lab-grid').innerHTML, /High-sensitivity troponin I \/ T/);
    assert.match(state.document.getElementById('lab-result-meta').textContent, /1 of 62/);

    state.context.setLabCategory('ABG / VBG', element());
    input.value = '';
    state.context.renderLabReference();
    assert.match(state.document.getElementById('lab-grid').innerHTML, /PaCO₂/);
    assert.match(state.document.getElementById('lab-grid').innerHTML, /VBG: what it can and cannot answer/);
    assert.doesNotMatch(state.document.getElementById('lab-grid').innerHTML, /Sodium/);
});

test('Ward infusion cheatsheet has a dedicated mobile-readable tab', () => {
    const html = read('ward.html');
    const infusionTab = html.indexOf('data-tab="infusion"');
    const infusionPanel = html.indexOf('id="infusion" class="container"');
    const cheatsheet = html.indexOf('IV Infusion / Syringe Pump Ward Cheatsheet');
    const medsPanel = html.indexOf('id="meds" class="container"');

    assert.ok(infusionTab >= 0);
    assert.ok(infusionPanel >= 0 && infusionPanel < cheatsheet);
    assert.ok(cheatsheet < medsPanel, 'infusion reference must not remain inside the Meds panel');
    assert.match(html, /id="infusion-pump"/);
    assert.match(html, /id="syringe-pump"/);
    assert.match(html, /class="val-table infusion-table"/);
    assert.match(html, /Medication & preparation/);
    assert.match(html, /verify the current prescription, patient weight, concentration/i);
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
    context.visualViewport.height = 764;
    viewportListeners.resize();
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

test('unknown search text is safe and offers text lookup without an infusion upload', async () => {
    const { context, document } = browserContext({ ds_key: 'test-key' });
    for (const source of inlineScripts('index.html')) vm.runInContext(source, context);
    const query = '<img src=x onerror=alert(1)> "quote"';
    document.getElementById('search-input').value = query;
    let passed;
    context.fetch = async () => { throw new Error('Sheet unavailable'); };
    context.triggerAISearch = q => { passed = q; };
    context.runSearch();
    assert.ok(!document.getElementById('search-results').innerHTML.includes('<img src=x'));
    assert.doesNotMatch(document.getElementById('search-results').innerHTML, /upload an infusion chart|ai-image-upload/i);
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
        caches: { open: async () => cache, keys: async () => [prefix+'v2', prefix+'v3', prefix+'v4', prefix+'v5', prefix+'v6', prefix+'v7', prefix+'v8', prefix+'v9', prefix+'v10', prefix+'v11', prefix+'v12', prefix+'v13', prefix+'v14', prefix+'v15', prefix+'v16', prefix+'v17', prefix+'v18', prefix+'v19', prefix+'v20', 'another-app'], delete: async key => deleted.push(key) },
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

test('Netlify build publishes Home, Ward and Clinical as multi-page entries', () => {
    const viteConfig = read('vite.config.ts');
    const netlifyConfig = read('netlify.toml');
    for (const page of ['index.html', 'ward.html', 'drugquiz.html']) assert.match(viteConfig, new RegExp(page.replace('.', '\\.')));
    assert.match(viteConfig, /rollupOptions[\s\S]*input/);
    for (const asset of ['app-ui.js', 'service-worker.js', 'manifest.json']) assert.match(viteConfig, new RegExp(asset.replace('.', '\\.')));
    assert.match(netlifyConfig, /publish\s*=\s*"dist"/);
    assert.match(netlifyConfig, /from\s*=\s*"\/ward"[\s\S]*to\s*=\s*"\/ward\.html"/);
    assert.match(netlifyConfig, /from\s*=\s*"\/clinical"[\s\S]*to\s*=\s*"\/drugquiz\.html"/);
    assert.match(netlifyConfig, /from\s*=\s*"\/assets\/index\.html"[\s\S]*to\s*=\s*"\/index\.html"/);
    assert.doesNotMatch(netlifyConfig, /from\s*=\s*"\/\*"/);
    assert.match(viteConfig, /Incomplete production build\. Missing/);
    assert.match(viteConfig, /keep-manifest-at-app-root/);
    const manifest = JSON.parse(read('manifest.json'));
    assert.equal(manifest.start_url, './index.html');
    assert.equal(manifest.scope, './');
    assert.doesNotMatch(viteConfig, /GEMINI_API_KEY|process\.env\.API_KEY/);
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
    assert.deepEqual(worker.deleted, ['drug-tutor-%2Fdrug-flashcards%2F-v2', 'drug-tutor-%2Fdrug-flashcards%2F-v3', 'drug-tutor-%2Fdrug-flashcards%2F-v4', 'drug-tutor-%2Fdrug-flashcards%2F-v5', 'drug-tutor-%2Fdrug-flashcards%2F-v6', 'drug-tutor-%2Fdrug-flashcards%2F-v7', 'drug-tutor-%2Fdrug-flashcards%2F-v8', 'drug-tutor-%2Fdrug-flashcards%2F-v9', 'drug-tutor-%2Fdrug-flashcards%2F-v10', 'drug-tutor-%2Fdrug-flashcards%2F-v11', 'drug-tutor-%2Fdrug-flashcards%2F-v12', 'drug-tutor-%2Fdrug-flashcards%2F-v13', 'drug-tutor-%2Fdrug-flashcards%2F-v14', 'drug-tutor-%2Fdrug-flashcards%2F-v15', 'drug-tutor-%2Fdrug-flashcards%2F-v16', 'drug-tutor-%2Fdrug-flashcards%2F-v17', 'drug-tutor-%2Fdrug-flashcards%2F-v18', 'drug-tutor-%2Fdrug-flashcards%2F-v19', 'drug-tutor-%2Fdrug-flashcards%2F-v20']);
    assert.equal(request(worker, 'https://example.test/other-app/index.html'), undefined);
    assert.equal(request(worker, 'https://api.example.test/chat'), undefined);
    assert.equal(request(worker, 'https://example.test/drug-flashcards/index.html', 'navigate', 'POST'), undefined);
});

function loadMain(records = {}) {
    const state = browserContext({ auto_sync_startup: '0', ...records });
    for (const source of inlineScripts('index.html')) vm.runInContext(source, state.context);
    return state;
}

function fillAIEditor(document, overrides = {}) {
    const values = {
        'ai-edit-name': 'Novelmed (Nova)',
        'ai-edit-class': 'Edited class',
        'ai-edit-system': '🫀 Cardio',
        'ai-edit-indication': 'Edited indication',
        'ai-edit-side-effects': 'Nausea, dizziness, hypotension',
        'ai-edit-nursing': 'Monitor blood pressure and response',
        'ai-edit-effect': 'Edited drug action',
        ...overrides,
    };
    for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
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
    assert.equal(getElement('search-api-notice').hidden, true);
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

test('tool iframe guard replaces a recursively loaded app shell', () => {
    const { context, document } = loadMain();
    document.baseURI = 'https://example.test/';
    const frame = element();
    frame.contentDocument = {
        title: 'AI Drug Tutor',
        getElementById: id => id === 'app-container' ? {} : null,
    };
    assert.equal(context.replaceRecursiveToolFrame(frame, 'Ward', 'ward.html'), true);
    assert.match(frame.srcdoc, /Ward could not load/);
    assert.match(frame.srcdoc, /https:\/\/example\.test\/ward\.html/);
});

test('fast adaptive quiz creates an instant balanced question and limits AI prefetch', () => {
    const { context } = loadMain({ ds_key: 'sk-test' });
    const drugs = context.prepareDrugListForFastSearch([
        { name: 'Atenolol', class: 'Selective beta blocker', indication: 'Hypertension', nursing: 'Monitor heart rate and blood pressure', system: '🫀 Cardio' },
        { name: 'Bisoprolol', class: 'Selective beta blocker', indication: 'Heart failure and hypertension', nursing: 'Monitor heart rate and blood pressure', system: '🫀 Cardio' },
        { name: 'Metoprolol', class: 'Selective beta blocker', indication: 'Post-MI and heart failure', nursing: 'Monitor heart rate and blood pressure', system: '🫀 Cardio' },
        { name: 'Propranolol', class: 'Non-selective beta blocker', indication: 'Tremor and hypertension', nursing: 'Check for bronchospasm and bradycardia', system: '🫀 Cardio' },
        { name: 'Labetalol', class: 'Alpha and beta blocker', indication: 'Hypertensive crisis', nursing: 'Monitor blood pressure closely', system: '🫀 Cardio' },
    ]);
    const first = context.buildLocalAdaptiveQuizQuestion(drugs, 'applying');
    const second = context.buildLocalAdaptiveQuizQuestion(drugs, 'applying');
    assert.equal(first.type, 'local_adaptive');
    assert.equal(first.options.length, 4);
    assert.equal(new Set(first.options).size, 4);
    assert.ok(first.options.includes(first.correctAnswerText));
    assert.notEqual(second.correctAnswerText, first.correctAnswerText);
    assert.match(first.aiExplanation, /Nursing focus:/);
    assert.match(read('index.html'), /Math\.min\(QUIZ_PREFETCH_TARGET, questionsAfterCurrent\)/);
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
    assert.equal(document.body.classList.contains('search-results-active'), true);
    assert.equal(document.getElementById('search-status').textContent, '30 of 45 matching drugs');
    assert.equal(document.getElementById('more-search-results').hidden, false);
    context.showMoreSearchResults();
    assert.equal(document.getElementById('search-status').textContent, '45 of 45 matching drugs');
    assert.equal(document.getElementById('more-search-results').hidden, true);
    context.clearSearch();
    assert.equal(document.getElementById('search-input').value, '');
    assert.equal(document.body.classList.contains('search-results-active'), false);
    assert.match(document.getElementById('search-results').innerHTML, /What are you looking for/);
    assert.equal(document.getElementById('clear-search').hidden, true);
});

test('mobile search focus keeps the keyboard view uncluttered and Back exits results', () => {
    const { context, document } = loadMain();
    const html = read('index.html');
    context.setSearchFocus(true);
    assert.equal(document.body.classList.contains('search-focus-active'), true);
    assert.match(html, /search-focus-active #search-api-notice/);
    assert.match(html, /search-focus-active #search-browse/);
    assert.match(html, /search-focus-active \.glass-nav/);

    document.getElementById('search-input').value = 'Metformin';
    context.runSearch();
    assert.equal(document.body.classList.contains('search-results-active'), true);
    document.querySelector = () => ({ id: 'nav-search' });
    context.renderAllSystems = () => {};
    context.handleTopBack();
    assert.equal(document.getElementById('search-input').value, '');
    assert.equal(document.body.classList.contains('search-results-active'), false);
    assert.equal(document.body.classList.contains('search-focus-active'), false);
});

test('mobile navigation uses a compact top switcher and gives content more room', () => {
    const html = read('index.html');
    assert.match(html, /body\.mobile-ui \.glass-nav\s*\{[\s\S]*?order:\s*2;/);
    assert.match(html, /body\.mobile-ui #app-container\s*\{[\s\S]*?order:\s*3;/);
    assert.match(html, /body\.mobile-ui \.app-icon-img\s*\{[\s\S]*?width:\s*24px;[\s\S]*?height:\s*24px;/);
    assert.match(html, /body\.mobile-ui \.nav-ico\s*\{\s*font-size:\s*\.84rem;/);
    assert.match(html, /body\.mobile-ui \.nav-btn\s*\{[\s\S]*?height:\s*38px;[\s\S]*?flex-direction:\s*row;/);
    assert.match(html, /body\.mobile-ui\.ward-fullscreen #app-container\s*\{\s*width:\s*100%;/);
});

test('embedded Ward keeps laboratory and imaging content inside the iPhone viewport', () => {
    const html = read('ward.html');
    assert.match(html, /window\.parent !== window/);
    assert.match(html, /html\.embedded \.sticky-header\s*\{\s*padding-top:\s*4px;/);
    assert.match(html, /html, body\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?overflow-x:\s*hidden;/);
    assert.match(html, /\.container\s*>\s*\*\s*\{\s*min-width:\s*0;\s*max-width:\s*100%;/);
    assert.match(html, /\.lab-item summary\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\) 20px;/);
    assert.match(html, /\.lab-range\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?overflow-wrap:\s*anywhere;/);
    assert.match(html, /\.imaging-card summary\s*>\s*:nth-child\(2\)\s*\{\s*min-width:\s*0;/);
});

test('the app brand returns to a clean main search page', () => {
    const { context, document } = loadMain();
    document.getElementById('search-input').value = 'Metformin';
    document.getElementById('search-section').scrollTop = 240;
    vm.runInContext("searchSystem = '🫀 Cardio'; activeAppMode = 'clinical';", context);
    context.goHome();
    assert.equal(vm.runInContext('activeAppMode', context), 'search');
    assert.equal(vm.runInContext('searchSystem', context), 'All');
    assert.equal(document.getElementById('search-input').value, '');
    assert.equal(document.getElementById('search-section').scrollTop, 0);
    assert.equal(document.body.classList.contains('search-results-active'), false);
    assert.equal(document.body.classList.contains('search-focus-active'), false);
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

test('a Google Sheet result waits for review and explicit local add', async () => {
    const { context, document } = loadMain({ ds_key: 'test-key' });
    document.getElementById('sheet-url').value = 'https://example.test/drugs.csv';
    document.getElementById('search-input').value = 'Cloud medicine';
    context.Papa = { parse: () => ({ data: [{ name: 'Cloud medicine (Sheetbrand)', class: 'Example', indication: 'Testing', system: '🫀 Cardio' }] }) };
    context.fetch = async () => ({ ok: true, text: async () => 'csv' });
    let aiCalls = 0;
    context.triggerAISearch = async () => { aiCalls++; };
    await context.resolveMissingDrug('Cloud medicine');
    assert.equal(aiCalls, 0);
    assert.equal(context.findLocalDrugs('Cloud medicine').length, 0);
    assert.match(document.getElementById('search-status').textContent, /Found in Google Sheet/);
    assert.match(document.getElementById('ai-search-output').innerHTML, /Nothing has been added yet/);
    fillAIEditor(document, { 'ai-edit-name': 'Cloud medicine (Edited brand)', 'ai-edit-side-effects': 'Headache, nausea' });
    document.getElementById('btn-add-local').onclick();
    assert.equal(context.findLocalDrugs('Cloud medicine')[0].name, 'Cloud medicine (Edited brand)');
});

test('an AI-found drug waits for edited approval before Sheet and local add', async () => {
    const { context, document } = loadMain({ ds_key: 'test-key' });
    document.getElementById('sheet-url').value = 'https://example.test/drugs.csv';
    document.getElementById('search-input').value = 'Novelmed';
    context.Papa = { parse: () => ({ data: [] }) };
    let sheetWrites = 0;
    let writtenPayload;
    context.fetch = async (_url, options = {}) => {
        if (options.method === 'POST') {
            sheetWrites++;
            writtenPayload = JSON.parse(options.body);
            return { ok: true, text: async () => '' };
        }
        return { ok: true, text: async () => 'name,class' };
    };
    context.streamAIResponse = async (_messages, onUpdate) => onUpdate(JSON.stringify({
        name: 'Novelmed (Nova)', class: 'Test class', system: '🫀 Cardio', indication: 'Testing',
        side_effects: 'Example effect', nursing: 'Monitor response', effect_of_drug: 'Example action'
    }));
    await context.resolveMissingDrug('Novelmed');
    assert.equal(sheetWrites, 0);
    assert.equal(context.findLocalDrugs('Novelmed').length, 0);
    assert.match(document.getElementById('ai-search-output').innerHTML, /Review drug details/);

    fillAIEditor(document, {
        'ai-edit-name': 'Novelmed (Edited brand)',
        'ai-edit-indication': 'Edited indication for testing',
        'ai-edit-side-effects': 'Edited nausea, rash, dizziness'
    });
    await document.getElementById('btn-save-sheet').onclick();
    assert.equal(sheetWrites, 1);
    assert.equal(writtenPayload.name, 'Novelmed (Edited brand)');
    assert.equal(writtenPayload.indication, 'Edited indication for testing');
    assert.equal(writtenPayload.side_effects, 'Edited nausea, rash, dizziness');
    assert.equal(context.findLocalDrugs('Novelmed')[0].name, 'Novelmed (Edited brand)');
    await document.getElementById('btn-save-sheet').onclick();
    assert.equal(sheetWrites, 1);
});

test('AI drug search repairs placeholder side effects before display or Sheet save', async () => {
    const { context, document } = loadMain({ ds_key: 'test-key' });
    let aiCalls = 0;
    context.streamAIResponse = async (_messages, onUpdate) => {
        aiCalls++;
        onUpdate(JSON.stringify(aiCalls === 1 ? {
            name: 'Examplemed (Example)', class: 'Example class', system: '🫀 Cardio', indication: 'Example indication',
            side_effects: 'Not specified', nursing: 'Monitor the patient', effect_of_drug: 'Example action'
        } : {
            name: 'Examplemed (Example)', class: 'Example class', system: '🫀 Cardio', indication: 'Example indication',
            side_effects: 'Nausea, dizziness, hypotension', nursing: 'Monitor the patient', effect_of_drug: 'Example action'
        }));
    };
    let saveCalls = 0;
    context.saveToGoogleSheet = async () => { saveCalls++; return true; };
    await context.triggerAISearch('Examplemed');
    assert.equal(aiCalls, 2);
    assert.equal(saveCalls, 0);
    assert.match(document.getElementById('ai-search-output').innerHTML, /Nausea, dizziness, hypotension/);
    assert.doesNotMatch(document.getElementById('ai-search-output').innerHTML, /Side Effects<\/div><div[^>]*>Not specified/i);

    const fallback = context.normalizeAISearchDrugPayload({ name: 'Fallbackmed', side_effects: 'Not listed', nursing: 'N/A', effect_of_drug: 'Unknown' });
    assert.doesNotMatch([fallback.side_effects, fallback.nursing, fallback.effect_of_drug].join(' '), /not specified|not listed|unknown|n\/a/i);
    assert.throws(() => context.validateEditedAISearchDrug({ name: 'Fallbackmed', side_effects: 'Not specified' }), /useful.*side effects/i);
});

test('image search results also require an explicit Add action', async () => {
    const { context, document } = loadMain({ ds_key: 'test-key' });
    let saves = 0;
    context.saveToGoogleSheet = async () => { saves++; return true; };
    context.renderAIImageSearchResults([context.normalizeAISearchDrugPayload({
        name: 'Imagemed (Image)', class: 'Test', system: '🫀 Cardio', indication: 'Testing',
        side_effects: 'Nausea', nursing: 'Monitor', effect_of_drug: 'Test action'
    })]);
    assert.equal(saves, 0);
    assert.match(document.getElementById('ai-search-output').innerHTML, /Nothing has been added yet/);
    await document.getElementById('btn-save-sheet-0').onclick();
    assert.equal(saves, 1);
});

test('drug Explain enforces readable Cantonese and retries an English response', async () => {
    const { context } = loadMain({ ds_key: 'test-key' });
    const prompts = [];
    const liveUpdates = [];
    context.streamAIResponse = async (messages, onUpdate) => {
        prompts.push(messages);
        onUpdate(prompts.length === 1
            ? 'This medicine lowers blood glucose and requires renal monitoring.'
            : '## 💊 點樣起效\n- 幫身體減少製造血糖。\n## 🎯 點解會用\n- 主要用嚟控制糖尿病。\n## 🩺 護士要留意\n- 留意腎功能同食慾變化。\n## ⚠️ 常見／嚴重副作用\n- 常見肚瀉、作嘔同肚痛。\n## 🚨 幾時要即刻報醫生\n- 呼吸急促或極度虛弱要即報。');
    };
    const answer = await context.generateCantoneseDrugExplanation('Metformin', text => liveUpdates.push(text));
    assert.equal(prompts.length, 2);
    assert.match(prompts[0][1].content, /只可以用繁體中文廣東話/);
    assert.equal(context.isMostlyCantoneseExplanation(answer), true);
    assert.match(answer, /護士要留意/);
    assert.doesNotMatch(answer, /This medicine/);
    assert.ok(liveUpdates.length > 0);
    assert.ok(liveUpdates.every(text => !text.includes('This medicine')));
    assert.match(liveUpdates.at(-1), /護士要留意/);
});

test('AI text streams across split server-sent event chunks', async () => {
    const { context } = loadMain({ ds_key: 'test-key' });
    const encoder = new TextEncoder();
    const payload = 'data: {"choices":[{"delta":{"content":"廣東話"}}]}\n\ndata: {"choices":[{"delta":{"content":"逐段出"}}]}\n\ndata: [DONE]\n\n';
    context.fetch = async () => new Response(new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(payload.slice(0, 19)));
            controller.enqueue(encoder.encode(payload.slice(19, 57)));
            controller.enqueue(encoder.encode(payload.slice(57)));
            controller.close();
        }
    }), { status: 200 });
    const updates = [];
    await context.streamAIResponse([], text => updates.push(text));
    assert.deepEqual(updates, ['廣東話', '廣東話逐段出']);
});

test('AI drug search exposes partial text before the editable result', async () => {
    const { context, document } = loadMain({ ds_key: 'test-key' });
    const streamedFrames = [];
    const finalJson = JSON.stringify({
        name: 'Streammed (Live)', class: 'Example class', system: '🫀 Cardio', indication: 'Testing',
        side_effects: 'Nausea, dizziness', nursing: 'Monitor response', effect_of_drug: 'Example action'
    });
    context.streamAIResponse = async (_messages, onUpdate) => {
        onUpdate('{"name":"Stream');
        streamedFrames.push(document.getElementById('ai-search-stream').textContent);
        onUpdate(finalJson);
        streamedFrames.push(document.getElementById('ai-search-stream').textContent);
    };
    await context.triggerAISearch('Streammed');
    assert.equal(streamedFrames[0], '{"name":"Stream');
    assert.equal(streamedFrames[1], finalJson);
    assert.match(document.getElementById('ai-search-output').innerHTML, /Review drug details/);
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
    const { context, document } = loadMain({ ds_key: '  ', active_provider: 'deepseek-v4-flash' });
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

test('server-managed Qwen is the default and never sends an API key from the browser', async () => {
    const { context, document } = loadMain();
    context.updateApiNotices();
    const requests = [];
    context.fetch = async (url, options) => {
        requests.push({ url, options });
        return new Response('data: {"choices":[{"delta":{"content":"Ready"}}]}\n\ndata: [DONE]\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
        });
    };

    const updates = [];
    await context.streamAIResponse([{ role: 'user', content: 'Explain this drug.' }], text => updates.push(text));

    assert.equal(vm.runInContext('currentProvider', context), 'openrouter-qwen');
    assert.equal(document.getElementById('search-api-notice').hidden, true);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/.netlify/functions/openrouter-qwen');
    assert.equal(requests[0].options.headers.Authorization, undefined);
    assert.equal(JSON.parse(requests[0].options.body).model, 'qwen/qwen3.8-27b:free');
    assert.deepEqual(updates, ['Ready']);
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
