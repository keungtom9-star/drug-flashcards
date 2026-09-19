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
        style: {}, dataset: {}, value: '', innerText: '', innerHTML: '', disabled: false,
        classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
        getAttribute: key => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
        querySelectorAll: () => [], querySelector: () => null,
    };
}

function browserContext(records = {}) {
    const storage = new Map(Object.entries(records)), elements = new Map(), viewportListeners = {}, css = {};
    const document = {
        documentElement: { style: { setProperty: (key, value) => { css[key] = value; } } },
        addEventListener() {}, querySelectorAll: () => [],
        getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
        createElement: () => element(),
    };
    const context = vm.createContext({
        document, navigator: { userAgent: 'test' }, console, URL, Response,
        localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
        addEventListener() {}, innerHeight: 844,
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        visualViewport: { scale: 1, height: 844, offsetTop: 0, addEventListener: (name, fn) => { viewportListeners[name] = fn; } },
        speechSynthesis: { cancel() {} },
        getComputedStyle: el => ({ display: el.style.display || el.cssDisplay || 'block' }),
        setTimeout() {}, clearTimeout() {},
    });
    context.window = context;
    context.parent = context;
    vm.runInContext(read('app-ui.js'), context);
    return { context, elements, storage, document, viewportListeners, css };
}
function loadQuiz() {
    const state = browserContext();
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

test('malformed or incompatible saved state does not block startup; valid state survives', () => {
    const { context } = browserContext({ broken: '{', null: 'null', wrongType: '[]', valid: '{"review":3}' });
    for (const key of ['broken', 'null', 'missing', 'wrongType']) assert.deepEqual(context.DrugTutorUI.readStoredJSON(key, {}), {});
    assert.equal(context.DrugTutorUI.readStoredJSON('valid', {}).review, 3);
    const main = browserContext({ drug_tutor_anki: '{' });
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

test('unknown search text is rendered as text and passed through a bound handler', () => {
    const { context, document } = browserContext();
    for (const source of inlineScripts('index.html')) vm.runInContext(source, context);
    const query = '<img src=x onerror=alert(1)> "quote"';
    document.getElementById('search-input').value = query;
    let passed;
    context.triggerAISearch = q => { passed = q; };
    context.runSearch();
    assert.ok(!document.getElementById('search-results').innerHTML.includes('<img src=x'));
    document.getElementById('ask-ai-search').onclick();
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
        caches: { open: async () => cache, keys: async () => [prefix+'v2', prefix+'v3', 'another-app'], delete: async key => deleted.push(key) },
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
    assert.deepEqual(worker.deleted, ['drug-tutor-%2Fdrug-flashcards%2F-v2']);
    assert.equal(request(worker, 'https://example.test/other-app/index.html'), undefined);
    assert.equal(request(worker, 'https://api.example.test/chat'), undefined);
    assert.equal(request(worker, 'https://example.test/drug-flashcards/index.html', 'navigate', 'POST'), undefined);
});
