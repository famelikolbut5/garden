const entry=document.querySelector('#entry'),enter=document.querySelector('#enter');
function enableEntry(){enter.disabled=false;enter.textContent='Войти в Garden';}
window.addEventListener('garden-ready',enableEntry);
if(ready)enableEntry();
enter.onclick=async()=>{
 enter.disabled=true;enter.textContent='Открываем ворота…';
 // User gesture unlocks both music and the kitten's voice. No autoplay promise.
 try{await musicButton.onclick();}catch(error){console.warn(error);}
 document.body.classList.add('inside-garden');entry.classList.add('leaving');setTimeout(()=>entry.hidden=true,650);
};
document.querySelector('#garden-home').onclick=()=>select(3);
document.querySelector('#about-keeper').onclick=requestReaction;
for(const [button,id] of [['about-garden','story-dialog'],['credits-open','credits-dialog']]){
 document.querySelector('#'+button).onclick=()=>{const dialog=document.querySelector('#'+id);dialog.showModal();dialog.append(document.querySelector('#record-cursor'));};
}
document.querySelectorAll('dialog').forEach(dialog=>{
 dialog.addEventListener('close',()=>document.body.append(document.querySelector('#record-cursor')));
 dialog.querySelectorAll('.close-dialog,.return-button').forEach(b=>b.onclick=()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
});
document.querySelector('#fullscreen').onclick=async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{document.querySelector('#fullscreen').title='Для полного экрана нажмите F11';}
};
// The cursor lives outside the scene's stacking context, above the entrance and dialogs.
const cursor=document.querySelector('#record-cursor');
let lastSpark=0;
const softMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function spark(x,y,burst=false){
 if(softMotion||document.querySelectorAll('.cursor-spark').length>=18)return;
 const dot=document.createElement('span');dot.className='cursor-spark';
 dot.style.left=x+'px';dot.style.top=y+'px';
 dot.style.setProperty('--drift-x',(Math.random()-.5)*(burst?44:16)+'px');
 dot.style.setProperty('--drift-y',(burst?-12:12)+Math.random()*16+'px');
 dot.style.setProperty('--spark-size',(burst?5:3)+Math.random()*3+'px');
 (document.querySelector('dialog[open]')||document.body).append(dot);dot.addEventListener('animationend',()=>dot.remove(),{once:true});
}
document.addEventListener('pointermove',e=>{
 if(e.pointerType!=='mouse')return;
 document.body.classList.add('recording-cursor');cursor.style.display='block';
 cursor.style.transform=`translate3d(${e.clientX-3}px,${e.clientY-3}px,0)`;
 cursor.classList.toggle('over-link',!!e.target.closest('button,a'));
 if(performance.now()-lastSpark>65){spark(e.clientX,e.clientY);lastSpark=performance.now();}
});
document.documentElement.addEventListener('pointerleave',()=>{cursor.style.display='none';document.body.classList.remove('recording-cursor');});
document.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='mouse')return;
 cursor.classList.remove('click');void cursor.offsetWidth;cursor.classList.add('click');
 for(let i=0;i<5;i++)spark(e.clientX,e.clientY,true);
});
