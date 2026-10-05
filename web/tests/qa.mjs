// Real-browser smoke check. Reuses installed Chrome; no test packages required.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const url = process.env.HUMM_QA_URL || 'http://127.0.0.1:4180/';
const output = process.env.HUMM_QA_OUTPUT || await fs.mkdtemp(path.join(os.tmpdir(), 'humm-web-qa-'));
const visualOnly = process.argv.includes('--visual-only');
await fs.mkdir(output, { recursive: true });
const checks = [];
const errors = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome;
let ws;
try {
  let pages;
  try { pages = await (await fetch('http://127.0.0.1:9335/json/list')).json(); }
  catch {
    const binary = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    chrome = spawn(binary, ['--headless=new', '--remote-debugging-port=9335', `--user-data-dir=${path.join(output, 'chrome-profile')}`, '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
    await pause(3500);
    pages = await (await fetch('http://127.0.0.1:9335/json/list')).json();
  }
  ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      message.error ? task.reject(message.error) : task.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const check = (name, success, detail) => { checks.push({ name, success, detail }); console.log(`${success ? 'PASS' : 'FAIL'} ${name}`); assert.ok(success, detail ? JSON.stringify(detail) : name); };
  const until = async (expression, timeout = 15000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await evaluate(expression)) return true; await pause(100); }
    return false;
  };
  const dimensions = (width, height, mobile = false) => call('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 1 });
  const screenshot = async name => { const result = await call('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, `${name}.png`), Buffer.from(result.data, 'base64')); };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await call('Page.enable'); await call('Runtime.enable');
  await call('Emulation.setFocusEmulationEnabled', { enabled: true });
  await dimensions(1536, 1024);
  await call('Page.navigate', { url });
  check('Site loads and fonts resolve', await until(`document.querySelector('#hero-title') && document.fonts.status === 'loaded'`));
  await evaluate(`document.fonts.ready`); await pause(600);
  await screenshot('hero-desktop');
  const copy = await evaluate(`[document.querySelector('.brand span').textContent,...[...document.querySelectorAll('.site-header nav > *')].map(e=>e.textContent.trim()),...document.querySelector('#hero-title').innerText.split('\\n').filter(Boolean),...document.querySelector('.hero-lede').innerText.split('\\n'),...document.querySelectorAll('.hero-copy .button')].map(e=>typeof e==='string'?e.trim():e.textContent.trim())`);
  check('Hero copy matches the design brief', JSON.stringify(copy) === JSON.stringify(['HUMM','The app','Why HUMM','Plans','App Store','HUM A MELODY.','MAKE IT A','SONG.','The tune in your head. A whole band in your pocket.','Hum, beatbox, or whistle. HUMM takes it from there.','Try now']), copy);
  check('Blank contact details and no guessed store link', await evaluate(`document.querySelector('#contact-email').hidden && !document.querySelector('#contact-email').textContent && !document.querySelector('[href*="apps.apple.com"]')`));
  check('Real app previews load', await until(`[...document.querySelectorAll('.phone img')].every(i=>i.complete&&i.naturalWidth>0)`));
  const phoneSource = await evaluate(`document.querySelector('.phone-back img').naturalWidth`);
  check('Connected iPhone screenshot is included', phoneSource === 1206, phoneSource);
  for (const section of ['the-app', 'try-now', 'why-humm', 'get-humm']) {
    await evaluate(`document.querySelector('#${section}').scrollIntoView({behavior:'instant'})`); await pause(600);
    await screenshot(`${section==='why-humm'?'benefits':section}-desktop`);
  }
  for (const screen of ['choices', 'drums', 'taste', 'studio']) {
    await click(`[data-screen="${screen}"]`);
    check(`Feature preview changes to ${screen}`, await until(`document.querySelector('#feature-image').src.endsWith('/${screen}.png')&&document.querySelector('[data-screen="${screen}"]').getAttribute('aria-pressed')==='true'`));
  }
  await click('[data-store]');
  check('App Store placeholder has a clear message', await evaluate(`document.querySelector('#store-dialog').open&&document.querySelector('#store-title').textContent.includes('ALMOST HERE')`));
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  check('App Store dialog dismisses with Escape', await until(`!document.querySelector('#store-dialog').open`));

  for (const [width, height] of [[320,568],[375,812],[393,852],[440,956],[768,1024],[1024,768],[1536,1024]]) {
    await dimensions(width, height, width < 768);
    await pause(160);
    for (const section of ['main','the-app','try-now','why-humm','get-humm']) {
      await evaluate(`document.querySelector('#${section}').scrollIntoView({behavior:'instant'})`); await pause(150);
      const layout = await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll('h1,h2,h3,.button,.studio-heading,.demo-track')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+.5)}).map(e=>e.textContent.trim())})`);
      check(`${width}×${height} ${section} has no horizontal overflow or clipped controls`, layout.scroll <= width && !layout.clipped.length, layout);
    }
    if (width === 393) {
      await evaluate(`scrollTo({top:0,behavior:'instant'})`); await pause(500); await screenshot('hero-mobile');
      await evaluate(`document.querySelector('#try-now').scrollIntoView({behavior:'instant'})`); await pause(400); await screenshot('demo-mobile');
      await evaluate(`document.querySelector('#get-humm').scrollIntoView({behavior:'instant'});scrollTo({top:document.body.scrollHeight,behavior:'instant'})`); await pause(400); await screenshot('footer-mobile');
    }
  }
  await dimensions(1536,1024);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  check('Reduced-motion preference removes animations', await evaluate(`getComputedStyle(document.querySelector('.phone-front')).animationName==='none'&&getComputedStyle(document.documentElement).scrollBehavior==='auto'`));
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await evaluate(`document.querySelector('#piano').scrollIntoView({behavior:'instant'})`); await pause(200);
  const pianoLayout = await evaluate(`(()=>{const p=document.querySelector('#piano').getBoundingClientRect(),b=document.querySelector('.piano-key.black').getBoundingClientRect();return {width:p.width,x:p.x,upsideDown:Math.abs(p.bottom-b.bottom)<2,white:document.querySelectorAll('.piano-key:not(.black)').length,black:document.querySelectorAll('.piano-key.black').length}})()`);
  check('Piano spans the viewport and black keys attach at the bottom', pianoLayout.width===1536&&pianoLayout.x===0&&pianoLayout.upsideDown&&pianoLayout.white===28&&pianoLayout.black===20, pianoLayout);
  await call('Input.dispatchKeyEvent', { type:'keyDown',key:'a',code:'KeyA' });
  check('Computer keyboard plays and highlights piano key', await until(`document.querySelector('.piano-key[data-offset="0"]').classList.contains('pressed')`));
  await call('Input.dispatchKeyEvent', { type:'keyUp',key:'a',code:'KeyA' });
  check('Piano key releases', await evaluate(`!document.querySelector('.piano-key[data-offset="0"]').classList.contains('pressed')`));
  await click('#octave-up'); check('Piano octave changes pitch labels', await evaluate(`document.querySelector('.piano-key').getAttribute('aria-label')==='Play C4'`));
  await click('#octave-down'); await click('#piano-mute');
  check('Piano mute updates its accessible state', await evaluate(`document.querySelector('#piano-mute').getAttribute('aria-pressed')==='true'&&document.querySelector('#piano-mute').getAttribute('aria-label')==='Unmute piano'`));
  await click('#piano-mute');

  if (!visualOnly) {
    await evaluate(`document.querySelector('#try-now').scrollIntoView({behavior:'instant'})`);
    check('Demo module is ready with exactly three empty rows', await until(`document.querySelector('#demo-mic').dataset.loaded==='true'&&document.querySelectorAll('.demo-track').length===3&&document.querySelector('#demo-play').disabled`));
    await evaluate(`globalThis.qaOriginalMic=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')}`);
    await click('#demo-mic');
    check('Denied microphone permission explains recovery', await until(`document.querySelector('#demo-status').textContent.includes('Microphone access is off')&&!document.querySelector('#demo-mic').disabled`));
    await evaluate(`navigator.mediaDevices.getUserMedia=async()=>{await new Promise(r=>setTimeout(r,350));globalThis.qaLateContext=new AudioContext();globalThis.qaLateStream=qaLateContext.createMediaStreamDestination().stream;return qaLateStream}`);
    await click('#demo-mic'); await click('#demo-cancel'); await pause(700);
    check('Cancel during permission request releases late microphone stream', await evaluate(`qaLateStream.getTracks().every(t=>t.readyState==='ended')&&document.querySelector('#demo-studio').dataset.state==='ready'`));
    await evaluate(`qaLateContext.close();navigator.mediaDevices.getUserMedia=async()=>{const ctx=new AudioContext();globalThis.qaInputContext=ctx;const dest=ctx.createMediaStreamDestination();globalThis.qaInputStream=dest.stream;const osc=ctx.createOscillator(),gain=ctx.createGain();gain.gain.value=.13;osc.connect(gain).connect(dest);osc.frequency.value=261.63;const pitches=[261.63,329.63,392,329.63,293.66,261.63,329.63,392,440,392,329.63,293.66];for(let i=0;i<40;i++){const at=ctx.currentTime+.2+i*.65;osc.frequency.setValueAtTime(pitches[i%pitches.length],at);gain.gain.setValueAtTime(.13,at);gain.gain.setTargetAtTime(.00001,at+.48,.015);}osc.start();globalThis.qaInputOsc=osc;await ctx.resume();return dest.stream}`);
    await click('#demo-mic');
    check('Microphone captures actual audio frames', await until(`document.querySelector('#demo-studio').dataset.state==='recording'`));
    await pause(10500);
    if (await evaluate(`document.querySelector('#demo-studio').dataset.state==='recording'`)) await click('#demo-mic');
    check('Recorded pitched melody becomes three real music tracks', await until(`document.querySelector('#demo-studio').dataset.state==='result'&&document.querySelector('#track-count').textContent==='3 / 3'&&!document.querySelector('#demo-play').disabled`,30000), await evaluate(`document.querySelector('#demo-status').textContent`));
    check('Microphone is released after analysis', await evaluate(`qaInputStream.getTracks().every(t=>t.readyState==='ended')`));
    check('Every generated track has musical events', await evaluate(`[...document.querySelectorAll('.demo-track')].every(row=>row.querySelector('.track-pattern .note'))`));
    await click('#demo-play'); await pause(600);
    check('Playback uses a progressing audio clock', await evaluate(`document.querySelector('#demo-play span').textContent==='Stop your song'&&document.querySelectorAll('.track-pattern .current').length===3`));
    await pause(1100); check('Playback timer advances', await evaluate(`document.querySelector('#demo-time').value!=='0:00'`));
    await click('[data-kind="bass"] .mute-button');
    check('Track mute updates the actual playback controls', await evaluate(`document.querySelector('[data-kind="bass"]').classList.contains('is-muted')&&document.querySelector('[data-kind="bass"] .mute-button').getAttribute('aria-pressed')==='true'`));
    await evaluate(`const s=document.querySelector('#lead-sound');s.value='piano';s.dispatchEvent(new Event('change',{bubbles:true}))`);
    await screenshot('demo-result-desktop');
    await click('#demo-play');
    check('Playback stops and removes all moving cursors', await until(`document.querySelector('#demo-play span').textContent==='Play your song'&&!document.querySelector('.track-pattern .current')`));
    await click('#demo-reset');
    check('Start over clears all three tracks and playback', await evaluate(`document.querySelector('#track-count').textContent==='0 / 3'&&document.querySelector('#demo-play').disabled&&!document.querySelector('.track-pattern .note')`));
    check('Demo never offers saving or exporting', await evaluate(`![...document.querySelectorAll('#demo-studio button')].some(b=>/save|download|export/i.test(b.textContent))&&localStorage.length===0`));
    await evaluate(`qaInputOsc.stop();qaInputContext.close();navigator.mediaDevices.getUserMedia=qaOriginalMic`);
  }
  check('Homepage has one App Store action', await evaluate(`document.querySelectorAll('[data-store]').length===1`));
  await dimensions(1536,1024);
  await evaluate(`scrollTo({top:200,behavior:'instant'})`); await pause(100);
  check('Phone depth movement stays within twelve pixels', await evaluate(`Math.abs(parseFloat(document.querySelector('.hero-phones').style.getPropertyValue('--drift')))<=12`));
  await call('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]}); await pause(100);
  check('Live reduced-motion change removes phone movement', await evaluate(`getComputedStyle(document.querySelector('.hero-phones')).transform==='none'`));
  await call('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  for (const page of ['features.html','plans.html','why-humm.html']) {
    await call('Page.navigate', {url:new URL(page,url).href});
    check(`${page} loads directly`, await until(`document.querySelector('.page-title') && document.fonts.status==='loaded'`));
    await pause(350);
    check(`${page} marks current navigation and keeps one store action`, await evaluate(`document.querySelector('nav [aria-current="page"]')?.getAttribute('href')==='./${page}'&&document.querySelectorAll('[data-store]').length===1`));
    await screenshot(page.replace('.html','')+'-desktop');
    if(page==='features.html') {
      await click('[data-preview="drums"] summary');
      check('Product disclosure changes actual screenshot', await until(`document.querySelector('#story-image').src.endsWith('/drums.png')&&document.querySelectorAll('.story-steps details[open]').length===1`));
      await click('[data-preview="hum-current"] summary');
    }
    if(page==='plans.html') {
      await click('.faq details summary');
      check('Plan FAQ opens with readable answer',await evaluate(`document.querySelector('.faq details').open&&document.querySelector('.faq details p').textContent.includes('three')`));
      check('Plans distinguish pending prices and recording limits',await evaluate(`document.body.textContent.includes('Planned US launch pricing')&&document.querySelector('.plan-table').textContent.includes('10–60 sec')&&document.querySelector('.plan-table').textContent.includes('Up to 3 min')`));
    }
    for(const [width,height] of [[320,568],[393,852],[768,1024],[1024,768],[1536,1024]]) {
      await dimensions(width,height,width<768);await pause(120);
      const layout=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll('h1,h2,h3,.button,summary')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+.5)}).map(e=>e.textContent.trim())})`);
      check(`${page} at ${width}px has no clipped page content`,layout.scroll<=width&&!layout.clipped.length,layout);
      if(width===393){
        await evaluate(`scrollTo({top:0,behavior:'instant'})`);await screenshot(page.replace('.html','')+'-mobile');
        await click('#menu-toggle');
        check(`${page} mobile menu opens accessibly`,await evaluate(`document.querySelector('#menu-toggle').getAttribute('aria-expanded')==='true'&&getComputedStyle(document.querySelector('#main-nav')).display==='flex'`));
        await evaluate(`document.querySelector('#menu-toggle').focus()`);
        await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        check(`${page} menu closes with Escape`,await evaluate(`document.querySelector('#menu-toggle').getAttribute('aria-expanded')==='false'&&document.activeElement.id==='menu-toggle'`));
      }
    }
    if(page==='why-humm.html') {
      await evaluate(`document.querySelector('.comparison').scrollIntoView({behavior:'instant'})`);await pause(200);await screenshot('comparison-desktop');
    }
    const broken=await evaluate(`Promise.all([...new Set([...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>new URL(h).origin===location.origin))].map(async h=>({href:h,ok:(await fetch(h)).ok}))).then(r=>r.filter(x=>!x.ok))`);
    check(`${page} internal page links resolve`,broken.length===0,broken);
  }
  check('No uncaught browser errors', errors.length===0, errors);
  await fs.writeFile(path.join(output,'results.json'), JSON.stringify({url,checks,errors},null,2));
  console.log(`Verified ${checks.length} checks. Screenshots: ${output}`);
} finally { ws?.close(); chrome?.kill(); }
