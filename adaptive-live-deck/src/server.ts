#!/usr/bin/env bun
import { adaptRequest, normalizePreferences, preferencesForPreset } from './adapt';
import { EVENT_ID, nextSlideId, previousSlideId, slides } from './deck';
import { renderPersonalizedSlide } from './render';
import { LiveDeckSession } from './session';
import type { Preferences } from './types';

const session = new LiveDeckSession();
const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/speaker') {
      return redirect(`/speaker/${EVENT_ID}`);
    }
    if (url.pathname === '/join') {
      return redirect(`/join/${EVENT_ID}`);
    }
    if (url.pathname === `/speaker/${EVENT_ID}`) {
      return html(speakerPage(url.origin));
    }
    if (url.pathname === `/join/${EVENT_ID}` || url.pathname === `/attendee/${EVENT_ID}`) {
      return html(attendeePage());
    }
    if (url.pathname === '/api/deck') {
      return json({ eventId: EVENT_ID, slides });
    }
    if (url.pathname === '/api/session') {
      return json(session.getState());
    }
    if (url.pathname === '/api/session/slide' && request.method === 'POST') {
      const body = await request.json().catch(() => ({})) as { slideId?: string; direction?: 'next' | 'prev' };
      const current = session.getState().currentSlideId;
      const slideId = body.slideId ?? (body.direction === 'prev' ? previousSlideId(current) : nextSlideId(current));
      try {
        return json(session.setSlide(slideId));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Invalid slide id' }, 400);
      }
    }
    if (url.pathname === '/api/adapt' && request.method === 'POST') {
      const body = await request.json().catch(() => ({})) as {
        requestText?: string;
        preset?: string;
        currentPreferences?: Preferences;
      };
      const current = normalizePreferences(body.currentPreferences ?? preferencesForPreset(body.preset ?? 'standard'));
      const result = body.requestText ? adaptRequest(body.requestText, current) : {
        ...preferencesForPreset(body.preset ?? 'standard'),
        explanation: 'Applied preset.',
      };
      return json(result);
    }
    if (url.pathname === '/api/render' && request.method === 'POST') {
      const body = await request.json().catch(() => ({})) as {
        slideId?: string;
        preferences?: Preferences;
      };
      return json(renderPersonalizedSlide(
        body.slideId ?? session.getState().currentSlideId,
        normalizePreferences(body.preferences ?? preferencesForPreset('standard')),
      ));
    }
    if (url.pathname === '/api/events') {
      return sse();
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`Adaptive Live Deck demo running at http://localhost:${server.port}`);
console.log(`Speaker:  http://localhost:${server.port}/speaker/${EVENT_ID}`);
console.log(`Attendee: http://localhost:${server.port}/join/${EVENT_ID}`);

function redirect(pathname: string): Response {
  return new Response(null, { status: 302, headers: { location: pathname } });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function html(body: string): Response {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function sse(): Response {
  let unsubscribe = () => {};
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      unsubscribe = session.subscribe(send);
    },
    cancel() {
      unsubscribe();
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}

function speakerPage(origin: string): string {
  const attendeeUrl = `${origin}/join/${EVENT_ID}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Speaker · Adaptive Live Deck</title>
  <style>${baseCss()}${speakerCss()}</style>
</head>
<body class="speaker-shell">
  <main class="speaker-frame">
    <section class="speaker-slide" id="slide"></section>
    <aside class="speaker-panel">
      <p class="eyebrow">Adaptive Live Deck</p>
      <h1>Speaker controls the moment. Attendees control the interface.</h1>
      <div class="qr-card" aria-label="QR placeholder">
        <div class="qr-grid">${'<span></span>'.repeat(49)}</div>
        <p>Join</p>
      </div>
      <a href="${attendeeUrl}">${attendeeUrl}</a>
      <div class="controls">
        <button id="prev">Prev</button>
        <button id="next">Next</button>
      </div>
      <p id="speaker-status" class="status-line"></p>
    </aside>
  </main>
  <div class="progress"><span id="progress"></span></div>
  <script>${speakerScript()}</script>
</body>
</html>`;
}

function attendeePage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Attendee · Adaptive Live Deck</title>
  <style>${baseCss()}${attendeeCss()}</style>
</head>
<body class="attendee-shell">
  <main class="phone">
    <section class="join-card" id="join">
      <p class="eyebrow">Join demo-event</p>
      <h1>Make this talk fit me</h1>
      <div class="preset-grid">
        <button data-preset="standard">Standard</button>
        <button data-preset="jaLarge">日本語 + Large</button>
        <button data-preset="beginner">Beginner</button>
        <button data-preset="highContrast">High Contrast</button>
        <button data-preset="expert">Expert Notes</button>
      </div>
      <label>
        Ask your agent
        <textarea id="initial-request" placeholder="例: 日本語で、もっと大きく、初心者向けにして"></textarea>
      </label>
      <button id="start">Start live view</button>
    </section>
    <section class="deck-card hidden" id="deck">
      <div class="live-row">
        <span class="live-dot"></span>
        <span>Live with speaker</span>
        <span id="prefs"></span>
      </div>
      <article id="personalized-slide"></article>
      <p id="attendee-status" class="status-line">Waiting for the speaker.</p>
      <button id="customize">Customize</button>
      <section class="customizer hidden" id="customizer">
        <label>
          Ask your agent
          <textarea id="custom-request" placeholder="もっと文字を大きく、専門用語の説明を増やして"></textarea>
        </label>
        <button id="apply">Apply to my view</button>
        <p id="agent-note"></p>
      </section>
    </section>
  </main>
  <script>${attendeeScript()}</script>
</body>
</html>`;
}

function baseCss(): string {
  return `
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#101616;color:#f5f1e8}button,textarea{font:inherit}button{border:0;border-radius:8px;background:#39d98a;color:#09110d;font-weight:800;cursor:pointer}button:hover{filter:brightness(1.08)}button:focus-visible,textarea:focus-visible,a:focus-visible{outline:3px solid #f8c86b;outline-offset:3px}.eyebrow{margin:0 0 12px;color:#237f63;text-transform:uppercase;letter-spacing:.14em;font-size:12px;font-weight:800}.hidden{display:none!important}.status-line{margin:0;color:#c9ffe2;font-size:14px;line-height:1.45}`;
}

function speakerCss(): string {
  return `
.speaker-shell{min-height:100vh;background:#0e1514}.speaker-frame{display:grid;grid-template-columns:minmax(0,1fr) 360px;min-height:100vh}.speaker-slide{display:flex;flex-direction:column;justify-content:center;padding:8vw;background:#f3f1ea;color:#15201e}.speaker-slide .eyebrow{color:#237f63}.speaker-slide h2{font-size:clamp(48px,7vw,104px);line-height:1;margin:0 0 32px;font-family:Georgia,serif}.speaker-slide p{font-size:clamp(24px,3vw,42px);line-height:1.35;max-width:980px}.speaker-slide strong{color:#277c77}.speaker-panel{padding:32px;background:#111d1a;border-left:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:22px}.speaker-panel h1{font-size:25px;line-height:1.15;margin:0}.speaker-panel a{color:#c9ffe2;overflow-wrap:anywhere}.qr-card{padding:18px;border:1px solid rgba(57,217,138,.35);border-radius:8px;background:#0b1311}.qr-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;aspect-ratio:1}.qr-grid span{background:#f5f1e8;border-radius:2px}.qr-grid span:nth-child(3n),.qr-grid span:nth-child(7n+1){background:#39d98a}.qr-card p{margin:12px 0 0;font-weight:800}.controls{display:grid;grid-template-columns:1fr 1fr;gap:12px}.controls button{padding:16px}.progress{position:fixed;left:0;right:0;bottom:0;height:5px;background:rgba(255,255,255,.12)}.progress span{display:block;height:100%;width:25%;background:#39d98a;transition:width .2s}@media (max-width:840px){.speaker-frame{grid-template-columns:1fr}.speaker-panel{border-left:0;border-top:1px solid rgba(255,255,255,.1)}.qr-card{max-width:260px}}`;
}

function attendeeCss(): string {
  return `
.attendee-shell{min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#10201c,#23302b 58%,#493f2a)}.phone{width:min(420px,100%);min-height:min(760px,calc(100vh - 48px));border:1px solid rgba(255,255,255,.14);border-radius:28px;background:#f7f2e8;color:#17201e;box-shadow:0 30px 90px rgba(0,0,0,.35);overflow:auto}.join-card,.deck-card{padding:24px}.join-card h1{font-family:Georgia,serif;font-size:44px;line-height:1;margin:0 0 24px}.preset-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}.preset-grid button{min-height:48px;padding:12px;background:#17201e;color:#f7f2e8}.preset-grid button.active{background:#39d98a;color:#09110d}label{display:grid;gap:8px;font-weight:800;color:#31413e}textarea{min-height:92px;resize:vertical;border:1px solid #c9d1ca;border-radius:8px;padding:12px;background:#fff;color:#17201e}#start,#apply,#customize{width:100%;min-height:48px;padding:14px;margin-top:14px}.live-row{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#52625f;margin-bottom:18px}.live-dot{width:9px;height:9px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 6px rgba(22,163,74,.12)}#prefs{margin-left:auto;color:#1b7b58;text-align:right}.slide-view{min-height:430px;border-radius:18px;padding:28px;background:#fff;color:#17201e;display:flex;flex-direction:column;gap:18px;font-size:calc(18px * var(--font-scale,1))}.slide-view.theme-high{background:#050807;color:#fff;border:3px solid #39d98a}.slide-view h2{font-family:Georgia,serif;font-size:calc(34px * var(--font-scale,1));line-height:1.05;margin:0}.slide-view p{line-height:1.45;margin:0}.takeaway{margin-top:auto;padding-top:18px;border-top:1px solid rgba(0,0,0,.15);font-weight:900}.theme-high .takeaway{border-color:rgba(255,255,255,.3)}.terms{display:grid;gap:8px}.term{padding:10px;border-radius:8px;background:rgba(57,217,138,.13)}.customizer{margin-top:12px;padding-top:12px;border-top:1px solid #d2d8d4}.deck-card .status-line{margin-top:10px;color:#50605d}#agent-note{font-size:13px;color:#50605d}@media (max-width:430px){.attendee-shell{padding:0;place-items:stretch}.phone{width:100%;min-height:100vh;border-radius:0}.join-card,.deck-card{padding:20px}.join-card h1{font-size:38px}.slide-view{min-height:390px;padding:22px}}`;
}

function speakerScript(): string {
  return `
const slides=${JSON.stringify(slides)};
let state={currentSlideId:slides[0].id};
const slideEl=document.getElementById('slide');
const progress=document.getElementById('progress');
const statusEl=document.getElementById('speaker-status');
function currentIndex(){return slides.findIndex(s=>s.id===state.currentSlideId)}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function render(){
  const slide=slides[currentIndex()]||slides[0];
  slideEl.innerHTML='<p class="eyebrow">'+escapeHtml(slide.id)+'</p><h2>'+escapeHtml(slide.title)+'</h2><p>'+escapeHtml(slide.en)+'</p><p><strong>'+escapeHtml(slide.takeaway)+'</strong></p>';
  progress.style.width=((currentIndex()+1)/slides.length*100)+'%';
  statusEl.textContent='Current slide: '+slide.id+' · '+(currentIndex()+1)+'/'+slides.length;
}
async function setSlide(direction){
  state=await fetch('/api/session/slide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({direction})}).then(r=>r.json());
  render();
}
document.getElementById('next').onclick=()=>setSlide('next');
document.getElementById('prev').onclick=()=>setSlide('prev');
document.addEventListener('keydown',event=>{
  if(['ArrowRight','ArrowDown',' '].includes(event.key)){event.preventDefault();setSlide('next')}
  if(['ArrowLeft','ArrowUp'].includes(event.key)){event.preventDefault();setSlide('prev')}
});
fetch('/api/session').then(r=>r.json()).then(next=>{state=next;render()});
render();`;
}

function attendeeScript(): string {
  return `
let preferences={language:'en',fontScale:1,detail:'normal',contrast:'default',level:'standard'};
let state={currentSlideId:'s01'};
let selectedPreset='standard';
const presetButtons=[...document.querySelectorAll('[data-preset]')];
presetButtons.forEach(button=>button.onclick=()=>{selectedPreset=button.dataset.preset;presetButtons.forEach(b=>b.classList.toggle('active',b===button));});
presetButtons[0].classList.add('active');
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function safeClassName(value){return String(value).split(/\\s+/).filter(part=>/^[a-z0-9_-]+$/i.test(part)).join(' ')}
function safeStyle(value){return /^--font-scale:[0-9.]+$/.test(String(value))?String(value):'--font-scale:1'}
async function adapt(requestText,preset){
  preferences=await fetch('/api/adapt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestText,preset,currentPreferences:preferences})}).then(r=>r.json());
  document.getElementById('agent-note').textContent=preferences.explanation||'Updated.';
  render();
}
async function render(){
  const rendered=await fetch('/api/render',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slideId:state.currentSlideId,preferences})}).then(r=>r.json());
  const prefLabel=[preferences.language,Math.round(preferences.fontScale*100)+'%',preferences.level,preferences.contrast].join(' / ');
  document.getElementById('prefs').textContent=prefLabel;
  document.getElementById('attendee-status').textContent='Synced to '+rendered.slide.id+' · '+rendered.slide.title;
  document.getElementById('personalized-slide').innerHTML='<div class="slide-view '+safeClassName(rendered.className)+'" style="'+safeStyle(rendered.style)+'"><p class="eyebrow">'+escapeHtml(rendered.slide.id)+'</p><h2>'+escapeHtml(rendered.title)+'</h2><p>'+escapeHtml(rendered.body)+'</p><div class="terms">'+rendered.terms.map(t=>'<div class="term"><strong>'+escapeHtml(t.label)+'</strong><br>'+escapeHtml(t.body)+'</div>').join('')+'</div><p class="takeaway">'+escapeHtml(rendered.takeaway)+'</p></div>';
}
document.getElementById('start').onclick=async()=>{
  const requestText=document.getElementById('initial-request').value;
  await adapt(requestText,selectedPreset);
  document.getElementById('join').classList.add('hidden');
  document.getElementById('deck').classList.remove('hidden');
};
document.getElementById('customize').onclick=()=>document.getElementById('customizer').classList.toggle('hidden');
document.getElementById('apply').onclick=()=>adapt(document.getElementById('custom-request').value,selectedPreset);
const events=new EventSource('/api/events');
events.onmessage=event=>{state=JSON.parse(event.data);render();};
async function refreshSession(){
  const next=await fetch('/api/session',{cache:'no-store'}).then(r=>r.json());
  if(next.currentSlideId!==state.currentSlideId){
    state=next;
    render();
  }
}
events.onerror=()=>refreshSession();
setInterval(refreshSession,300);
fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(next=>{state=next;render()});`;
}
