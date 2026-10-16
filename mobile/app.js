const mode='layers';let idleNode=0;
const edges={"0": [2, 1, 3], "2": [0, 7], "7": [2, 6], "6": [7, 4], "4": [6, 5], "5": [4, 8], "8": [5, 1], "1": [8, 0], "3": [0]};
const stage=document.querySelector('#stage'),canvas=document.querySelector('#scene'),status=document.querySelector('#status'),loading=document.querySelector('#loading');
document.querySelector('#'+mode).setAttribute('aria-current','page');
document.querySelector('#note').textContent=mode==='whole'?'Цельная сцена: шерсть сохраняется в исходном окружении. Вода и растения вне области кота воспроизводятся отдельно. Проверяем, заметна ли граница между движущимся и неподвижным фоном.':'Раздельные слои: фон движется постоянно, кот вырезается по зелёному экрану. Проверяем шерсть, цветной край и естественность посадки на парапете.';
const names=['влево','вниз слева','вверх слева','прямо','вправо','вниз справа','вверх справа','вверх','вниз'];
let entered=false;let pose=3,wanted=3,active=null,source=null,ready=false,paused=false,completed=0,frameCount=0,lastPointer=3,dwell,tour=[],raf;
let downRest;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clips=new Map(),assets=new Map(),gl=canvas.getContext('webgl',{alpha:false,antialias:false});
if(!gl){document.querySelector('#enter').textContent='WebGL недоступен';document.querySelector('#entry-status').textContent='Откройте сад в браузере с поддержкой WebGL.';throw Error('WebGL unavailable');}
const manifestPromise=fetch('assets.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Manifest unavailable');return r.json()});
async function preloadAssets(){
 const manifest=await manifestPromise;let index=0,bytes=0;const total=manifest.reduce((n,a)=>n+a.bytes,0);
 await Promise.all(Array.from({length:4},async()=>{while(index<manifest.length){const item=manifest[index++];
  if(assets.has(item.name)){bytes+=item.bytes;continue;}
  const response=await fetch('../layers/'+item.name+'?v='+item.hash,{signal:AbortSignal.timeout(90000)});if(!response.ok)throw Error('Asset unavailable: '+item.name);
  const blob=await response.blob();if(blob.size!==item.bytes)throw Error('Incomplete asset: '+item.name);
  assets.set(item.name,{url:URL.createObjectURL(blob),blob});bytes+=item.bytes;
  document.querySelector('#entry-status').textContent='Сад просыпается · '+Math.round(bytes/total*100)+'%';
 }}));
}
const asset=name=>assets.get(name).url;
const audioBytes=name=>assets.get(name).blob.arrayBuffer();
function compile(t,s){const h=gl.createShader(t);gl.shaderSource(h,s);gl.compileShader(h);if(!gl.getShaderParameter(h,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(h));return h;}
const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec2 point;varying vec2 uv;void main(){uv=vec2((point.x+1.)*.5,(1.-point.y)*.5);gl_Position=vec4(point,0.,1.);}'));
gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`precision highp float;varying vec2 uv;uniform sampler2D cat;uniform sampler2D garden;uniform float separate;uniform float catScale;
float matte(vec3 c){return 1.-smoothstep(.045,.19,c.g-max(c.r,c.b));}
float ellipse(vec2 p,vec2 c,vec2 r){return 1.-smoothstep(.94,1.06,length((p-c)/r));}
void main(){vec3 bg=texture2D(garden,uv).rgb;vec2 px=uv*vec2(1280.,720.);px=vec2(512.,609.)+(px-vec2(512.,609.))/catScale;if(separate<.5){vec3 c=texture2D(cat,uv).rgb;float head=ellipse(px,vec2(528.,316.),vec2(271.,237.));float body=ellipse(px,vec2(522.,510.),vec2(228.,126.));float tail=ellipse(px,vec2(825.,527.),vec2(180.,111.));gl_FragColor=vec4(mix(bg,c,max(head,max(body,tail))),1.);}else{vec2 t=(px-vec2(90.,110.))/.73/vec2(1280.,720.);if(t.x<0.||t.x>1.||t.y<0.||t.y>1.){gl_FragColor=vec4(bg,1.);return;}vec3 c=texture2D(cat,t).rgb;float alpha=matte(c);vec3 key=texture2D(cat,vec2(.015,.015)).rgb;vec3 clean=clamp((c-key*(1.-alpha))/max(alpha,.025),0.,1.);clean.g=min(clean.g,max(clean.r,clean.b)+.03);
// Keep the fine alpha silhouette; reduce bright edge reconstruction and the baked rim light.
vec2 pixel=vec2(2.5/1280.,2.5/720.);
float nearAlpha=min(min(matte(texture2D(cat,t+vec2(pixel.x,0.)).rgb),matte(texture2D(cat,t-vec2(pixel.x,0.)).rgb)),min(matte(texture2D(cat,t+vec2(0.,pixel.y)).rgb),matte(texture2D(cat,t-vec2(0.,pixel.y)).rgb)));
float edge=max(1.-alpha,alpha-nearAlpha);
clean=min(clean,c+vec3(.075));
clean*=vec3(.94,.925,.97);
// A little reflected scene colour at semi-transparent hairs, without blurring the fur.
clean=mix(clean,bg,.12*edge);
clean*=1.-.08*edge;
float shadow=exp(-pow((px.x-520.)/156.,2.)-pow((px.y-609.)/13.,2.))*.16;
shadow+=exp(-pow((px.x-453.)/45.,2.)-pow((px.y-609.)/4.5,2.))*.22;
shadow+=exp(-pow((px.x-586.)/47.,2.)-pow((px.y-609.)/4.5,2.))*.22;bg*=1.-shadow;gl_FragColor=vec4(mix(bg,clean,alpha),1.);}}`));
gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const attribute=gl.getAttribLocation(program,'point');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
const textures=[0,1].map(i=>{gl.activeTexture(gl.TEXTURE0+i);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);for(const [p,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,p,v);return t;});
gl.uniform1i(gl.getUniformLocation(program,'cat'),0);gl.uniform1i(gl.getUniformLocation(program,'garden'),1);gl.uniform1f(gl.getUniformLocation(program,'separate'),mode==='layers'?1:0);
function upload(i,s){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,s);}
let dirty=true,bgDirty=true,lastCatTime=-1,lastGardenTime=-1,lastDrawAt=0;
let catFit=1;
function resizeScene(){const r=canvas.getBoundingClientRect();catFit=matchMedia('(max-aspect-ratio:4/3)').matches?Math.min(1,stage.clientWidth/(r.height/720)/560):1;gl.uniform1f(gl.getUniformLocation(program,'catScale'),catFit);dirty=true;bgDirty=true;}
new ResizeObserver(resizeScene).observe(stage);resizeScene();
function draw(){lastDrawAt=performance.now();if(source&&ambient.readyState>=2){if(source instanceof HTMLVideoElement&&source.currentTime!==lastCatTime){dirty=true;lastCatTime=source.currentTime;}if(ambient.currentTime!==lastGardenTime){bgDirty=true;lastGardenTime=ambient.currentTime;}if(dirty&&(!(source instanceof HTMLVideoElement)||source.readyState>=2)){upload(0,source);dirty=false;}if(bgDirty){upload(1,ambient);bgDirty=false;}gl.drawArrays(gl.TRIANGLE_STRIP,0,4);frameCount++;}if(!paused&&!document.hidden&&!reduced)raf=requestAnimationFrame(draw);}
function video(path){const v=document.createElement('video');if(path)v.src=path;v.muted=true;v.playsInline=true;v.preload='auto';document.body.append(v);return v;}
function loaded(v){return new Promise((yes,no)=>{v.addEventListener('loadeddata',yes,{once:true});v.addEventListener('error',()=>no(Error('Не загружено '+v.src)),{once:true});v.load();});}
const ambient=video();ambient.loop=true;const pool=[video(),video()];
function watch(v,callback){if(v.requestVideoFrameCallback){const f=()=>{callback();v.requestVideoFrameCallback(f)};v.requestVideoFrameCallback(f);}else v.addEventListener('timeupdate',callback);}
watch(ambient,()=>bgDirty=true);

status.dataset.build='garden-mobile-1';
let mediaFailed=false;
let playSerial=0,reverseCount=0,waitCount=0,clipStarts=0;
let reactionPending=false,reacting=false,reactions=0,preparing=false;
let audioCtx,voiceGain,voiceSource,voiceBuffer,audioReady;
let soundOn=true,musicOn=false,musicGain,musicBuffer,musicSource,musicPromise;
const musicButton=document.querySelector('#music');
const soundButton=document.querySelector('#sound'),reactionButton=document.querySelector('#reaction');
function updateAudio(){
 soundButton.textContent=soundOn?'Звук: вкл':'Звук: выкл';soundButton.setAttribute('aria-pressed',String(soundOn));
 musicButton.textContent=musicOn?'Музыка: вкл':'Музыка: выкл';musicButton.setAttribute('aria-pressed',String(musicOn));
 if(!audioCtx)return;
 const musicLevel=musicOn&&soundOn?.14:0;
 if(musicGain)musicGain.gain.setTargetAtTime(musicLevel,audioCtx.currentTime,.15);
 status.dataset.music=String(musicOn);status.dataset.musicLevel=String(musicLevel);status.dataset.musicLoaded=String(!!musicBuffer);
 voiceGain.gain.setTargetAtTime(soundOn?1:0,audioCtx.currentTime,.015);
 status.dataset.sound=String(soundOn);status.dataset.audio=audioCtx.state;status.dataset.voiceLoaded=String(!!voiceBuffer);
}
async function unlockAudio(){
 if(!audioCtx){
  audioCtx=new AudioContext();audioCtx.onstatechange=updateAudio;voiceGain=audioCtx.createGain();voiceGain.gain.value=1;voiceGain.connect(audioCtx.destination);
  audioReady=audioBytes('meow-clean.wav').then(b=>audioCtx.decodeAudioData(b)).then(b=>{voiceBuffer=b;});
 }
 await audioCtx.resume();await audioReady;updateAudio();
}
function stopVoice(){if(voiceSource){voiceSource.stop();voiceSource.disconnect();voiceSource=null;}}
function startVoice(){stopVoice();if(!voiceBuffer||!reacting||paused||document.hidden)return;const offset=active.currentTime;if(offset>=voiceBuffer.duration)return;voiceSource=audioCtx.createBufferSource();voiceSource.buffer=voiceBuffer;voiceSource.connect(voiceGain);voiceSource.start(0,offset);}
function report(){status.dataset.pose=String(pose);status.dataset.target=String(wanted);status.dataset.state=reacting?'reacting':active?'moving':'rest';status.dataset.pending=String(reactionPending);status.dataset.completed=String(completed);status.dataset.reactions=String(reactions);status.textContent=reacting?'Кот приветствует вас':reactionPending?'Завершаю движение и возвращаюсь к вам':`${active?'Поворот':'Положение'}: ${names[pose]} · Цель: ${names[wanted]}`;document.querySelectorAll('[data-pose]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.pose)===wanted)));}
function nextPose(from,to){const q=[[from]],seen=new Set([from]);while(q.length){const path=q.shift();for(const n of edges[path[path.length-1]]||[]){if(seen.has(n))continue;const p=[...path,n];if(n===to)return p[1];seen.add(n);q.push(p);}}return from;}
// Start decoding while seeking: a paused/offscreen video may never emit seeked.
function prepareClip(v,startAt,serial){
 return new Promise((resolve,reject)=>{
  let started=performance.now(),positioned=false,playing=false,done=false;
  const finish=(error,cancelled=false)=>{if(done)return;done=true;clearInterval(timer);v.removeEventListener('error',onError);error?reject(error):resolve(!cancelled);};
  const onError=()=>finish(Error('Video decode failed: '+(v.error?.code||'unknown')));
  const check=()=>{
   if(serial!==playSerial){finish(null,true);return;}
   if(paused||document.hidden){started=performance.now();playing=false;return;}
   if(performance.now()-started>8000){finish(Error('Video seek failed'));return;}
   if(v.readyState<1)return;
   if(!positioned){positioned=true;if(Math.abs(v.currentTime-startAt)>.005)v.currentTime=startAt;}
   if(!playing){playing=true;v.play().then(()=>{if(!done)check();},error=>{if(!done)finish(error);});return;}
   if(!v.paused&&!v.seeking&&v.readyState>=2&&v.currentTime>=startAt-.08)finish();
  };
  const timer=setInterval(check,20);v.addEventListener('error',onError);check();
 });
}
async function playClip(clip,next,isReaction=false,startAt=0){
 const v=pool.find(item=>item!==source)||pool[0];
 v.onended=null;v.pause();v.src=clip.src;v.dataset.idleNext=clip.idleNext??'';
 v.dataset.from=clip.from??'';v.dataset.to=clip.to??'';v.load();
 v.defaultPlaybackRate=clip.rate;v.playbackRate=clip.rate;
 const serial=++playSerial,requested=performance.now(),previous=source;window.kittenTrace?.('clip-request',{clip:v.getAttribute('src'),next,startAt,serial});
 if(active&&active!==v){active.onended=null;active.pause();}
 active=v;preparing=true;reacting=isReaction;report();updateAudio();
 v.onended=null;
 try{
  for(let attempt=0;attempt<2;attempt++){
   try{if(!await prepareClip(v,startAt,serial))return;break;}
   catch(error){
    if(serial!==playSerial)return;
    window.kittenTrace?.('clip-recovery',{clip:v.getAttribute('src'),attempt,time:v.currentTime,seeking:v.seeking,ready:v.readyState,message:error.message});
    if(attempt===1)throw error;
    // Reset the decoder, not just the same failed currentTime request.
    v.pause();v.load();v.playbackRate=v.defaultPlaybackRate;
   }
  }
  if(serial!==playSerial)return;
  source=v;dirty=true;preparing=false;
  v.onended=()=>{if(serial!==playSerial||active!==v)return;stopVoice();dirty=true;pose=next;if(next===8&&downRest){source=downRest;dirty=true;}idleNode=v.dataset.idleNext?Number(v.dataset.idleNext):0;active=null;if(reacting)reactions++;reacting=false;completed++;updateAudio();report();advance();};
  // Leave the last decoded frame intact until the next clip is actually ready.
  if(previous instanceof HTMLVideoElement&&previous!==v){previous.pause();previous.onended=null;}
  loading.hidden=true;delete status.dataset.playError;
  clipStarts++;status.dataset.clipStarts=String(clipStarts);status.dataset.startDelayMs=String(Math.round(performance.now()-requested));
  if(isReaction)startVoice();
 }catch(e){if(serial!==playSerial)return;v.pause();v.onended=null;mediaFailed=true;active=null;preparing=false;reacting=false;report();updateAudio();loading.hidden=false;loading.textContent='Видео не удалось восстановить. Выберите направление для повторной попытки.';status.dataset.playError=e.message;window.kittenTrace?.('clip-error',{message:e.message,serial,clip:v.getAttribute('src'),target:startAt,time:v.currentTime,seeking:v.seeking,ready:v.readyState,seekable:Array.from({length:v.seekable.length},(_,i)=>[v.seekable.start(i),v.seekable.end(i)]),buffered:Array.from({length:v.buffered.length},(_,i)=>[v.buffered.start(i),v.buffered.end(i)])});console.warn(e);}
}
function advance(){
 if(!entered||!ready||paused||document.hidden||active||reduced||mediaFailed)return;
 const goal=reactionPending?3:wanted;
 if(idleNode!==0&&(goal!==3||reactionPending||tour.length)){playClip(clips.get(`exit-${idleNode}`),3);return;}
 if(pose===goal){
  if(reactionPending){reactionPending=false;playClip(clips.get('reaction'),3,true);return;}
  if(tour.length){clearTimeout(dwell);dwell=setTimeout(()=>{wanted=tour.shift();report();advance();},350);return;}if(pose===3){playClip(clips.get(`idle-${idleNode}`),3);}return;
 }
 const next=nextPose(pose,goal);playClip(clips.get(`${pose}-${next}`),next);
}
function select(n){mediaFailed=false;window.kittenTrace?.('command',{target:n});status.dataset.commands=String(Number(status.dataset.commands||0)+1);status.dataset.lastCommand=String(n);tour=[];clearTimeout(dwell);wanted=n;lastPointer=n;report();if(ready){loading.hidden=true;if(!paused&&!reduced)ambient.play().catch(()=>{});advance();}}
async function requestReaction(){mediaFailed=false;if(mode!=='layers'||!ready||reduced||reacting||reactionPending)return;reactionPending=true;tour=[];clearTimeout(dwell);report();try{await unlockAudio();if(paused||document.hidden)await audioCtx.suspend();}catch(e){console.warn('Audio unavailable',e);}advance();}
reactionButton.onclick=requestReaction;
musicButton.onclick=async()=>{
 musicButton.disabled=true;
 try{
  await unlockAudio();
  if(!musicPromise)musicPromise=audioBytes('fairytale-waltz.m4a').then(b=>audioCtx.decodeAudioData(b)).then(b=>{musicBuffer=b;musicGain=audioCtx.createGain();musicGain.gain.value=0;musicGain.connect(audioCtx.destination);musicSource=audioCtx.createBufferSource();musicSource.buffer=b;musicSource.loop=true;musicSource.connect(musicGain);musicSource.start();}).catch(e=>{musicPromise=null;throw e});
  await musicPromise;musicOn=!musicOn;if(musicOn)soundOn=true;updateAudio();if(paused||document.hidden)await audioCtx.suspend();
 }catch(e){status.textContent='Музыка не загрузилась. Попробуйте ещё раз.';console.warn(e)}finally{musicButton.disabled=false;}
};
soundButton.onclick=async()=>{try{await unlockAudio();soundOn=!soundOn;updateAudio();if(paused||document.hidden)audioCtx.suspend();}catch(e){status.textContent='Не удалось включить звук';}};
document.querySelectorAll('[data-pose]').forEach(b=>{b.disabled=true;b.addEventListener('click',()=>select(Number(b.dataset.pose)));});
function coords(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];}
function target(e){
 const r=stage.getBoundingClientRect(), x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
 const n=x>.38&&x<.62?(y<.34?7:y>.72?8:3):x<.5?(y<.34?2:y>.68?1:0):(y<.34?6:y>.68?5:4);
 if(n!==wanted)select(n);
}
const blocked=e=>!entered||!!e.target.closest('button,a,dialog');let gesture=null;
stage.addEventListener('pointerdown',e=>{
 if(blocked(e)||!e.isPrimary||e.button!==0)return;
 gesture={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now(),moved:false};stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove',e=>{
 if(blocked(e))return;
 if(gesture&&gesture.id===e.pointerId){if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>9)gesture.moved=true;if(gesture.moved)target(e);}
 else if(e.pointerType==='mouse')target(e);
});
function release(e,cancel=false){
 if(!gesture||e.pointerId!==gesture.id)return;const g=gesture;gesture=null;
 if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);
 if(g.moved||cancel){select(3);return;}
 let[x,y]=coords(e);x=.4+(x-.4)/catFit;y=609/720+(y-609/720)/catFit;if(performance.now()-g.at<600&&x>.20&&x<.66&&y>.15&&y<.87)requestReaction();else select(3);
}
stage.addEventListener('pointerup',e=>release(e));stage.addEventListener('pointercancel',e=>release(e,true));
stage.addEventListener('lostpointercapture',e=>{if(gesture?.id===e.pointerId)release(e,true)});
window.addEventListener('blur',()=>{gesture=null;if(entered)select(3)});
stage.addEventListener('keydown',e=>{if(e.target!==stage||!entered)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();requestReaction();return;}const n={ArrowLeft:0,ArrowRight:4,ArrowUp:7,ArrowDown:8,Home:3}[e.key];if(n!==undefined){e.preventDefault();select(n)}});

document.querySelector('#tour').onclick=()=>{mediaFailed=false;tour=mode==='layers'?[0,2,7,6,4,5,8,1,0,3]:[0,1,2,3,4,5,6,3];wanted=tour.shift();report();advance()};
let observedVideo=null,observedTime=-1,lastProgressAt=0,lastRecoveryAt=0,recoveries=0;
function playbackHealth(){
 const now=performance.now();status.dataset.preparing=String(preparing);status.dataset.renderFrames=String(frameCount);
 status.dataset.activeClip=active?.getAttribute('src')||'';
 status.dataset.mediaTime=String(active?.currentTime??0);status.dataset.mediaPaused=String(active?.paused??true);status.dataset.seeking=String(active?.seeking??false);
 if(!entered||!ready||paused||document.hidden||reduced){lastProgressAt=now;return;}
 if(now-lastDrawAt>350){cancelAnimationFrame(raf);dirty=true;bgDirty=true;draw();}
 if(!active){observedVideo=null;if(wanted!==pose||reactionPending||pose===3)advance();return;}
 if(active!==observedVideo||active.currentTime!==observedTime){observedVideo=active;observedTime=active.currentTime;lastProgressAt=now;}
 if(preparing)return;
 if(active.ended){const finish=active.onended;if(finish)finish();return;}
 if((active.paused||now-lastProgressAt>700)&&now-lastRecoveryAt>700){
  lastRecoveryAt=now;recoveries++;status.dataset.recoveries=String(recoveries);
  const v=active;v.play().then(()=>{if(active===v&&reacting)startVoice();}).catch(e=>{status.dataset.playError=e.name;});
 }
}
setInterval(playbackHealth,200);
function resume(){if(!entered||paused||document.hidden||reduced)return;audioCtx?.resume();ambient.play().catch(()=>{});if(active&&!preparing)active.play().then(()=>{if(reacting)startVoice();}).catch(()=>{});cancelAnimationFrame(raf);draw();advance();}
function suspend(){ambient.pause();active?.pause();stopVoice();audioCtx?.suspend();cancelAnimationFrame(raf);}
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'Продолжить':'Пауза';if(paused)suspend();else resume();};
document.addEventListener('visibilitychange',()=>{if(document.hidden){gesture=null;suspend();}else resume()});
window.addEventListener('pageshow',()=>{if(entered)resume()});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();suspend();loading.hidden=false;loading.innerHTML='Саду нужно проснуться заново. <button onclick="location.reload()">Вернуться в сад</button>';});
async function boot(){try{
 await preloadAssets();
 downRest=new Image();downRest.src=asset('down-rest.png');await downRest.decode();
 const poster=new Image();poster.src=asset('poster.png');await poster.decode();source=poster;
 ambient.src=asset('ambient.mp4');await loaded(ambient);
 const paths=["0-2", "2-0", "2-7", "7-2", "7-6", "6-7", "6-4", "4-6", "4-5", "5-4", "5-8", "8-5", "8-1", "1-8", "1-0", "0-1", "0-3", "3-0", "idle-0", "exit-1", "idle-1", "exit-2", "idle-2", "exit-3", "idle-3", "exit-4", "idle-4", "reaction"];
 for(const key of paths){const directional=/^\d+-\d+$/.test(key);const[a,b]=key.split('-');clips.set(key,{src:asset(key+'.mp4'),rate:directional?1.4:1,from:directional?a:undefined,to:directional?b:undefined,idleNext:key.startsWith('idle-')?String((Number(key.slice(5))+1)%5):undefined});}
 ready=true;loading.hidden=true;document.querySelector('#entry-status').textContent='Всё готово. Сад ждёт вас.';report();updateAudio();draw();window.dispatchEvent(new Event('garden-ready'));
 }catch(e){console.error(e);document.querySelector('#entry-status').textContent='Не удалось загрузить сад. Проверьте связь и попробуйте снова.';const enter=document.querySelector('#enter');enter.disabled=false;enter.textContent='Повторить';enter.onclick=()=>location.reload();}}
boot();
