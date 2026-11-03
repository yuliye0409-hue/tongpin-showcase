const $ = (selector, root = document) => root.querySelector(selector);
const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1Z"/>',
  photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  letter: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  link: '<path d="m10 14 4-4m-7 3-2 2a4 4 0 0 0 6 6l4-4m2-6 2-2a4 4 0 0 0-6-6L9 7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h.1m4 0h.1m4 0h.1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  share: '<path d="M14 3h7v7m0-7L10 14M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  flower: '<path d="M12 9C3-4-3 12 9 12-4 21 12 27 12 15c9 13 15-3 3-3 13-9-3-15-3-3Z"/><circle cx="12" cy="12" r="2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.heart}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nav = [['home','概览'],['photo','照片回忆'],['letter','手写信箱'],['promises','我们的约定']];
const modal = $('#modal');
const assetRoot = new URL('./assets/', document.baseURI);
const siteUrl = new URL('./', document.baseURI).href;
let state, view = 'home', toastTimeout, sceneFrame = 0, modalOpener;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

function imageUrl(value) {
  const url = new URL(value, document.baseURI);
  if (url.origin !== assetRoot.origin || !url.pathname.startsWith(assetRoot.pathname)) throw new Error('展示图片必须位于本站 assets 目录');
  return url.href;
}
function date(value, options = {}) {
  const input = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+08:00` : value;
  return new Intl.DateTimeFormat('zh-CN', {month:'long',day:'numeric',timeZone:'Asia/Shanghai',...options}).format(new Date(input));
}
function today() {
  const parts = new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Shanghai'}).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const dayDiff = value => Math.round((Date.parse(value) - Date.parse(today())) / 86400000);
const avatar = name => `<span class="avatar ${name !== state.members[0] ? 'rose' : ''}">${escape(name?.slice(0,1) || '♡')}</span>`;
const heading = (title, copy, actions = '', eyebrow = 'OUR LITTLE WORLD') => `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="heading-subtitle">${copy}</p></div><div class="heading-actions">${actions}</div></div>`;
const shareButton = () => `<button class="button secondary" data-action="share">${icon('link')}分享这个小世界</button>`;
const empty = (title, copy) => `<div class="empty-state"><span>♡</span><h3>${title}</h3><p>${copy}</p></div>`;

function render() {
  $('#navigation').innerHTML = nav.map(([key,label], index) => `<a href="#${key}" class="nav-item ${view === key ? 'active' : ''}" data-view="${key}" aria-keyshortcuts="${index+1}" ${view === key ? 'aria-current="page"' : ''}>${icon(key === 'promises' ? 'heart' : key)}<span>${label}</span></a>`).join('');
  $('#sidebar-people').innerHTML = `${state.members.map(escape).join(' & ')}<span>♡</span>`;
  $('#breadcrumb-current').textContent = nav.find(n=>n[0]===view)[1];
  $('#mode-badge').textContent = state.sample ? '公开只读 · 示例内容' : '公开只读展示';
  const notice = state.sample ? '<p class="showcase-notice"><strong>公开只读展示</strong> · 当前人物、照片及文字为示例内容，不代表站点所有者的真实记录。无需登录即可浏览。</p>' : '<p class="showcase-notice"><strong>公开只读展示</strong> · 无需登录即可浏览。内容由站点维护者发布，访客不能修改。</p>';
  const page = ({home:homePage,photo:photoPage,letter:letterPage,promises:promisesPage})[view];
  $('#content').innerHTML = `<div class="content-wrap">${notice}${page()}</div>`;
  document.documentElement.dataset.page = view;
  $('.hero-art')?.insertAdjacentHTML('afterbegin','<img class="world-illustration" src="./assets/paper-world.svg" alt="" width="1200" height="620">');
}
function homePage() {
  const hour = Number(new Intl.DateTimeFormat('en-GB',{hour:'numeric',hourCycle:'h23',timeZone:'Asia/Shanghai'}).format(new Date()));
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '午后好' : '晚上好';
  const photos = state.records.filter(r=>r.type==='photo');
  const letters = state.records.filter(r=>r.type==='letter');
  const cover = (r,i) => r ? `<button type="button" class="polaroid ${i ? 'second' : ''}" data-action="read" data-id="${escape(r.id)}" aria-label="打开照片：${escape(r.title)}"><span class="photo-tape" aria-hidden="true"></span><img src="${escape(imageUrl(r.media))}" alt="" width="180" height="180"><span class="polaroid-caption">${escape(i ? 'our kind of days.' : 'you, me & the sea ♡')}</span></button>` : '';
  return `${heading(`${greeting}，欢迎来访 <span class="greeting-heart">♡</span>`,'今天，也有一些小事想和你分享。',shareButton())}
  <section class="hero" aria-label="记录我们的故事"><div class="hero-copy"><div class="hero-kicker"><span aria-hidden="true">✳</span> LOVE IN THE LITTLE THINGS</div><h2>把普通的日子，<br>过成<i>我们的故事。</i></h2><p>照片、写给你的信、值得记住的日子，<br>在这里，都有一个只属于我们的角落。</p><div class="hero-bottom"><a class="button primary" href="#photo" data-view="photo">${icon('photo')}翻开我们的相册${icon('arrow')}</a><span>慢慢记录，好好相爱。</span></div></div><div class="hero-art">${cover(photos[0],0)}${cover(photos[1],1)}<span class="hand-star" aria-hidden="true">✧</span><span class="small-heart" aria-hidden="true">♡</span><span class="hero-scribble" aria-hidden="true">better, together.</span></div></section>
  <section class="stats-grid" aria-label="我们的记录"><a class="stat-card" href="#promises" data-view="promises" aria-label="查看我们的纪念日"><div><p class="stat-label">${icon('heart')}我们已经在一起</p><p class="stat-value">${state.since ? Math.max(1,1-dayDiff(state.since)) : '—'}<small>天，仍然心动</small></p></div><span class="stat-decoration">${icon('flower')}</span></a><a class="stat-card" href="#photo" data-view="photo" aria-label="查看所有照片"><div><p class="stat-label">${icon('photo')}一起收藏的瞬间</p><p class="stat-value">${String(photos.length).padStart(2,'0')}<small>张照片</small></p></div><span class="stat-decoration">${icon('photo')}</span></a><a class="stat-card" href="#letter" data-view="letter" aria-label="查看所有信件"><div><p class="stat-label">${icon('letter')}想对你说的话</p><p class="stat-value">${String(letters.length).padStart(2,'0')}<small>封情书</small></p></div><span class="stat-decoration">${icon('letter')}</span></a></section>
  <div class="dashboard-columns"><section><div class="section-heading"><h2>最近的小美好 <small>OUR MOMENTS</small></h2><a class="button text" href="#photo" data-view="photo">查看相册 ${icon('arrow')}</a></div><div class="page-grid home-album">${photos.slice(0,2).map(albumCard).join('') || empty('相册，正在慢慢收集','一起期待下一份小美好。')}</div><p class="section-footnote">小小的日常，慢慢拼成我们的模样 ♡</p></section><aside class="dashboard-aside">${countdownCard()}${wishCard()}</aside></div>`;
}
function countdownCard() {
  const next = state.anniversaries.filter(a=>dayDiff(a.date)>=0).sort((a,b)=>a.date.localeCompare(b.date))[0];
  return `<section class="side-card countdown-card"><h3 class="side-card-title">${next ? escape(next.title) : '值得期待的日子'}${icon('calendar')}</h3>${next ? `<p class="countdown-date">${date(next.date,{year:'numeric'})}</p><p class="countdown-number">${dayDiff(next.date)}<small>天后</small></p><p class="countdown-caption">${dayDiff(next.date)===0 ? '就是今天，好好庆祝吧。' : '想到这里，就开始期待了。'}</p>` : '<p class="countdown-caption">为下一次见面，留一个倒计时。</p>'}<span class="countdown-flower" aria-hidden="true">✳</span></section>`;
}
function wishCard(large = false) {
  return `<section class="side-card ${large ? 'wish-large' : ''}"><h3 class="side-card-title">我们的心愿清单 ${icon('heart')}</h3><div role="list">${(large ? state.wishes : state.wishes.slice(0,3)).map(w=>`<div role="listitem" class="wish-item readonly-wish ${w.done ? 'done' : ''}"><span class="wish-marker" aria-hidden="true">${icon(w.done ? 'check' : 'flower')}</span><span>${escape(w.title)}${w.done ? '<span class="sr-only">（已完成）</span>' : ''}</span></div>`).join('') || '<p class="page-description">还有好多事情，想和你一起做。</p>'}</div></section>`;
}
function albumCard(r) {
  return `<button type="button" class="album-card" data-action="read" data-id="${escape(r.id)}"><img src="${escape(imageUrl(r.media))}" alt="${escape(r.title || '我们的回忆')}" loading="lazy" width="400" height="300"><h3>${escape(r.title || '想和你一起记住的瞬间')}</h3><div class="album-meta"><span>${escape(r.author)} · ${date(r.created)}</span><span class="album-open">${icon('photo')}查看</span></div></button>`;
}
function photoPage() {
  const photos = state.records.filter(r=>r.type==='photo');
  return `${heading('照片回忆','把想留住的瞬间，放进我们的相册。','','COLLECTING OUR DAYS')}<div class="section-heading"><p class="page-description">有些瞬间，过很久再看，还是会笑。</p><span class="photo-count">共 ${photos.length} 个瞬间</span></div><div class="page-grid">${photos.map(albumCard).join('') || empty('相册，正在等下一份回忆','有些风景，想和你一起记住。')}</div>`;
}
function letterPage() {
  const letters = state.records.filter(r=>r.type==='letter');
  return `${heading('手写信箱','有些话，想慢一点，认真地写给你。','','WORDS FROM THE HEART')}<p class="page-description">用指尖写下想念，或用文字寄出心意。点开信封，读一份认真写下的心意。</p>${letters.length ? `<div class="page-grid">${letters.map(r=>`<button class="letter-card" data-action="read" data-id="${escape(r.id)}"><div class="letter-seal">♡</div><h3>${escape(r.title || '一封只写给你的信')}</h3><p>To ${escape(state.members.find(n=>n!==r.author) || '亲爱的你')}<br>有一份心意，等你轻轻打开。</p><small>${escape(r.author)} 寄于 ${date(r.created,{year:'numeric'})}</small></button>`).join('')}</div>` : empty('信箱，正在等第一封信','想念有很多种表达，写一封信是其中一种。')}`;
}
function promisesPage() {
  return `${heading('我们的约定','把「以后一起」变成「我们做到了」。','','LITTLE PLANS, BIG DREAMS')}<p class="page-description">认真记住每一个特别的日子，也期待那些还没一起完成的小事。</p><div class="promise-grid">${wishCard(true)}<section class="side-card"><h3 class="side-card-title">值得记住的日子 ${icon('calendar')}</h3>${state.anniversaries.map(a=>`<div class="date-item"><div><strong>${escape(a.title)}</strong><p>${date(a.date,{year:'numeric'})}</p></div><div class="date-days">${Math.abs(dayDiff(a.date))}<small>${dayDiff(a.date)>=0 ? '天后' : '天前'}</small></div></div>`).join('') || '<p class="page-description">下一次见面、第一次旅行、彼此的生日…</p>'}</section></div>`;
}
function openModal(title, description, content) {
  $('#modal-content').innerHTML = `<div class="modal-inner"><div class="modal-header"><h2 id="modal-title">${escape(title)}</h2><button class="modal-close" data-action="close" aria-label="关闭弹窗">${icon('close')}</button></div>${description ? `<p class="modal-description">${escape(description)}</p>` : ''}${content}</div>`;
  if (!modal.hasAttribute('open')) {
    modalOpener=document.activeElement;
    if(typeof modal.showModal==='function')modal.showModal();
    else { modal.setAttribute('open',''); modal.setAttribute('aria-modal','true'); document.body.classList.add('modal-fallback'); $('.modal-close',modal).focus(); }
  }
}
function readRecord(id) {
  const r = state.records.find(r=>r.id===id);
  if (!r) return;
  const media = r.media ? `<img class="${r.type==='letter' ? 'handwritten-letter' : 'lightbox-photo'}" src="${escape(imageUrl(r.media))}" alt="${escape(r.title || '回忆')}" width="900" height="600">` : '';
  const body = `<div class="read-meta">${avatar(r.author)}${escape(r.author)} · ${date(r.created,{year:'numeric'})}</div>${r.type==='letter' ? `<div class="letter-reading">${escape(r.body)}${media}</div>` : `${media}<p class="record-body">${escape(r.body)}</p>`}<p class="auth-alt">${icon('heart')}把爱留在日常里 · 公开展示内容</p>`;
  openModal(r.title || '一起收藏的瞬间','',body);
}
function about() {
  openModal('关于这个小世界','同频 · 公开只读展示版',`<div class="readonly-info"><p>照片、信件、心愿和纪念日，沿用原来的小世界。</p><p>${state.sample ? '当前展示的是原项目的示例人物、示例文字和风景图片，不是站点所有者的真实私人记录。' : '本站内容由维护者公开发布，任何访问者都可以浏览。'}</p><p>点击首页照片可放大，点击数字卡片可进入对应栏目；相册、信封和底部导航都支持手机触控。内容由维护者发布，访客无需登录即可浏览。</p><p>内容更新后，刷新这个固定网址即可查看。最后一次内容更新：${date(state.updated,{year:'numeric'})}。</p></div><div class="form-actions"><button class="button primary" data-action="share">${icon('link')}分享这个小世界</button></div>`);
}
function share() {
  openModal('把这个小世界，分享给你','这是固定的网站地址。任何拿到地址的人都可以查看公开内容。',`<div class="link-box share-url"><a href="${escape(siteUrl)}" id="share-link">${escape(siteUrl)}</a></div><button class="button primary full-width" data-action="copy-link">${icon('link')}复制网站链接</button><p class="auth-alt">对方无需登录，打开即可浏览；访客不能修改内容。</p>`);
}
function toast(message) {
  clearTimeout(toastTimeout); $('#toast').textContent=message; $('#toast').classList.add('visible');
  toastTimeout=setTimeout(()=>$('#toast').classList.remove('visible'),3800);
}
function closeModal() {
  if(typeof modal.close==='function')modal.close();else modal.removeAttribute('open');
  modal.removeAttribute('aria-modal'); document.body.classList.remove('modal-fallback');
  if(modalOpener?.isConnected)modalOpener.focus({preventScroll:true});
}
function currentView() {
  return nav.some(([key])=>key===location.hash.slice(1)) ? location.hash.slice(1) : 'home';
}
function showView() {
  if (!state) return;
  view=currentView(); if(modal.hasAttribute('open'))closeModal(); render();
  $('.content-wrap')?.classList.add('paper-enter'); window.scrollTo({top:0});
}
function navigate(key) {
  if(!nav.some(([view])=>view===key))return;
  if(location.hash.slice(1)!==key)location.hash=key;
  showView();
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-view],[data-action]');
  if(!button)return;
  if(button.dataset.view){event.preventDefault();navigate(button.dataset.view);return;}
  const action=button.dataset.action;
  if(action==='close')closeModal();
  if(action==='about' && state)about();
  if(action==='share' && state)share();
  if(action==='read' && state)readRecord(button.dataset.id);
  if(action==='reload')location.reload();
  if(action==='copy-link'){
    try{await navigator.clipboard.writeText(siteUrl);toast('网站链接已复制，发给想分享的人吧 ♡');}
    catch{const range=document.createRange();range.selectNodeContents($('#share-link'));getSelection().removeAllRanges();getSelection().addRange(range);toast('已选中网址，请长按或按 Ctrl+C 复制');}
  }
});
window.addEventListener('hashchange',()=>{if(currentView()!==view)showView();});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && document.body.classList.contains('modal-fallback')){closeModal();return;}
  if(event.key==='Tab' && document.body.classList.contains('modal-fallback')){
    const controls=[...modal.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"]')];
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  }
  if(event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || modal.hasAttribute('open') || !state)return;
  if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(/^[1-4]$/.test(event.key)){event.preventDefault();navigate(nav[Number(event.key)-1][0]);}
});
document.addEventListener('pointermove',event=>{
  if(reducedMotion.matches || !finePointer.matches || modal.hasAttribute('open'))return;
  const hero=event.target.closest('.hero');if(!hero)return;
  const bounds=hero.getBoundingClientRect();
  const x=((event.clientX-bounds.left)/bounds.width-.5)*12, y=((event.clientY-bounds.top)/bounds.height-.5)*9;
  cancelAnimationFrame(sceneFrame);
  sceneFrame=requestAnimationFrame(()=>{hero.style.setProperty('--scene-x',`${x.toFixed(2)}px`);hero.style.setProperty('--scene-y',`${y.toFixed(2)}px`);});
});
document.addEventListener('pointerout',event=>{
  const hero=event.target.closest('.hero');if(!hero || hero.contains(event.relatedTarget))return;
  cancelAnimationFrame(sceneFrame);hero.style.removeProperty('--scene-x');hero.style.removeProperty('--scene-y');
});
modal.addEventListener('click',event=>{
  if(event.target!==modal)return;
  const bounds=modal.getBoundingClientRect();
  if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom)closeModal();
});
async function init() {
  try{
    const response=await fetch(new URL('./content.json',document.baseURI),{cache:'no-store'});
    if(!response.ok)throw new Error(`内容文件读取失败（${response.status}）`);
    const data=await response.json();
    if(!Array.isArray(data.members) || !Array.isArray(data.records) || !Array.isArray(data.wishes) || !Array.isArray(data.anniversaries))throw new Error('内容文件格式有误');
    state=data; showView();
  }catch(error){
    $('#content').innerHTML=`<div class="content-wrap">${empty('暂时没有打开我们的小世界',escape(error.message))}<p class="auth-alt"><button class="button secondary" data-action="reload">重新打开</button></p></div>`;
  }
}
void init();
