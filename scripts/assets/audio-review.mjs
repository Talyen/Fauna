import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { assets } from "./assets.mjs";
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--serve")) throw new Error("Usage: npm run audio:review -- [--serve]");
const prepared = await assets();
const manifest = JSON.parse(await readFile("assets/manifest.json", "utf8"));
const media = manifest.assets
  .filter((entry) => ["sound", "music"].includes(entry.kind))
  .map((entry) => ({ ...entry, ...prepared.records[entry.id] }));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Fauna Sound desk</title>
<style>body{background:#000;color:#eee;font:16px system-ui;max-width:900px;margin:32px auto;padding:24px}button,select{font:inherit;padding:12px;margin:6px}pre{white-space:pre-wrap}section{margin:24px 0}</style>
<h1>Fauna Sound desk</h1><p>Audition prepared selections. Choices stay in this browser until exported; this tool never installs replacements.</p>
<label>Action <select id="action"></select></label><label>Candidate <select id="candidate"></select></label>
<label><input id="matched" type="checkbox" checked> Match preview levels</label>
<section><button id="current">Play current</button><button id="audition">Play candidate</button><button id="stop">Stop</button></section>
<section><button id="choose">Choose candidate</button><button id="keep">Keep current</button><button id="silence">No sound</button><button id="export">Export choices</button></section>
<p id="status" role="status"></p><details><summary>Source and selection</summary><pre id="source"></pre></details>
<script type="module">
const media=${JSON.stringify(media).replaceAll("<", "\\u003c")};
const byId=new Map(media.map(entry=>[entry.id,entry]));
const action=document.getElementById('action'),candidate=document.getElementById('candidate'),status=document.getElementById('status');
const key='fauna.audio-review.'+${JSON.stringify(prepared.manifestHash)};
let choices={};try{choices=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
let context,voice,gain,generation=0;
function stop(){generation++;try{voice?.stop()}catch{}voice?.disconnect();gain?.disconnect();voice=null;gain=null}
function details(){document.getElementById('source').textContent=JSON.stringify({current:byId.get(action.value),candidate:byId.get(candidate.value),choice:choices[action.value]??'Undecided'},null,2)}
function fill(){stop();candidate.replaceChildren(...media.filter(entry=>entry.kind===byId.get(action.value).kind).map(entry=>new Option(entry.id,entry.id)));candidate.value=action.value;details()}
for(const entry of media)action.add(new Option(entry.id,entry.id));fill();
action.onchange=fill;candidate.onchange=()=>{stop();details()};
async function play(id){stop();const token=generation;try{context??=new AudioContext();await context.resume();const response=await fetch('/media/'+encodeURIComponent(id));if(!response.ok)throw Error('Media unavailable');const buffer=await context.decodeAudioData(await response.arrayBuffer());if(token!==generation)return;
let sum=0,peak=0,count=0;for(let channel=0;channel<buffer.numberOfChannels;channel++){const data=buffer.getChannelData(channel);for(let index=0;index<data.length;index++){const v=data[index];sum+=v*v;peak=Math.max(peak,Math.abs(v));count++}}
const rms=Math.sqrt(sum/Math.max(count,1));const level=document.getElementById('matched').checked?Math.min(3.981,Math.pow(10,-22/20)/Math.max(rms,0.000001),Math.pow(10,-1.5/20)/Math.max(peak,0.000001)):1;
voice=context.createBufferSource();voice.buffer=buffer;gain=context.createGain();gain.gain.value=level;voice.connect(gain);gain.connect(context.destination);voice.start();status.textContent='Playing '+id;
}catch(error){status.textContent='Could not audition: '+error.message}}
document.getElementById('current').onclick=()=>play(action.value);document.getElementById('audition').onclick=()=>play(candidate.value);document.getElementById('stop').onclick=stop;
function choose(id){stop();const entry=id===null?null:byId.get(id);choices[action.value]={id,sourceHash:entry?.sourceHash??null,outputHash:entry?.outputHash??null};try{localStorage.setItem(key,JSON.stringify(choices));status.textContent='Choice saved locally.'}catch{status.textContent='Choice retained in memory; export before closing.'}details()}
document.getElementById('choose').onclick=()=>choose(candidate.value);document.getElementById('keep').onclick=()=>choose(action.value);document.getElementById('silence').onclick=()=>choose(null);
document.getElementById('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({manifestHash:${JSON.stringify(prepared.manifestHash)},choices},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='fauna-audio-choices.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',()=>{stop();void context?.close()});
</script></html>`;
await mkdir("reports/audio-review", { recursive: true });
await writeFile("reports/audio-review/index.html", html);
await writeFile("reports/audio-review/media.json", JSON.stringify(media, null, 2));
console.log("Generated reports/audio-review/index.html. Use --serve for listening.");
if (args.includes("--serve")) {
  const server = createServer((request, response) => {
    void serve(request, response);
  });
  async function serve(request, response) {
    try {
      if (request.url === "/") {
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(html);
        return;
      }
      const entry = media.find((item) => `/media/${encodeURIComponent(item.id)}` === request.url);
      if (!entry) {
        response.writeHead(404).end();
        return;
      }
      response.setHeader(
        "Content-Type",
        entry.output.endsWith(".mp3")
          ? "audio/mpeg"
          : entry.output.endsWith(".ogg")
            ? "audio/ogg"
            : "audio/wav",
      );
      response.end(await readFile(`public/${entry.url.slice(2)}`));
    } catch {
      response.writeHead(500).end("Could not read prepared media.");
    }
  }
  server.listen(0, "127.0.0.1", () => console.log(`Sound desk: http://127.0.0.1:${server.address().port}`));
  const close = () => server.close();
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
