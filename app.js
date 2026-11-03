const $ = (selector, root = document) => root.querySelector(selector);
const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1Z"/>',
  daily: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4M8 1v4m8-4v4"/>',
  photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  letter: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  game: '<path d="M7 7h10c3 0 5 10 3 12-2 1-4-3-5-3H9c-1 0-3 4-5 3C2 17 4 7 7 7Z"/><path d="M7 10v5m-2.5-2.5h5M15 11h.01M18 14h.01M10 7V4h4"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  link: '<path d="m10 14 4-4m-7 3-2 2a4 4 0 0 0 6 6l4-4m2-6 2-2a4 4 0 0 0-6-6L9 7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h.1m4 0h.1m4 0h.1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  flower: '<path d="M12 9C3-4-3 12 9 12-4 21 12 27 12 15c9 13 15-3 3-3 13-9-3-15-3-3Z"/><circle cx="12" cy="12" r="2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.heart}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nav = [['home','概览'],['daily','日常碎片'],['photo','照片回忆'],['letter','手写信箱'],['game','双人游乐场'],['promises','我们的约定']];
const modal = $('#modal');
const assetRoot = new URL('./assets/', document.baseURI);
const siteUrl = new URL('./', document.baseURI).href;
let state, view = 'home', feedFilter = 'all', toastTimeout, sceneFrame = 0;
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
const typeLabel = type => ({daily:'日常碎片',photo:'照片回忆',letter:'手写信'}[type]);
const heading = (title, copy, actions = '', eyebrow = 'OUR LITTLE WORLD') => `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="heading-subtitle">${copy}</p></div><div class="heading-actions">${actions}</div></div>`;
const shareButton = () => `<button class="button secondary" data-action="share">${icon('link')}分享这个小世界</button>`;
const empty = (title, copy) => `<div class="empty-state"><span>♡</span><h3>${title}</h3><p>${copy}</p></div>`;

function render() {
  $('#navigation').innerHTML = nav.map(([key,label], index) => `<button class="nav-item ${view === key ? 'active' : ''}" data-view="${key}" aria-keyshortcuts="${index+1}" ${view === key ? 'aria-current="page"' : ''}>${icon(key === 'promises' ? 'heart' : key)}<span>${label}</span>${key === 'letter' && state.records.some(r=>r.type==='letter') ? `<small class="nav-badge">${state.records.filter(r=>r.type==='letter').length}</small>` : ''}</button>`).join('');
  $('#sidebar-people').innerHTML = `${state.members.map(escape).join(' & ')}<span>♡</span>`;
  $('#breadcrumb-current').textContent = nav.find(n=>n[0]===view)[1];
  $('#mode-badge').textContent = state.sample ? '公开只读 · 示例内容' : '公开只读展示';
  const notice = state.sample ? '<p class="showcase-notice"><strong>公开只读展示</strong> · 当前人物、照片及文字为示例内容，不代表站点所有者的真实记录。无需登录即可浏览。</p>' : '<p class="showcase-notice"><strong>公开只读展示</strong> · 无需登录即可浏览。内容由站点维护者发布，访客不能修改。</p>';
  const page = ({home:homePage,daily:dailyPage,photo:photoPage,letter:letterPage,game:gamePage,promises:promisesPage})[view];
  $('#content').innerHTML = `<div class="content-wrap">${notice}${page()}</div>`;
  document.documentElement.dataset.page = view;
  $('.hero-art')?.insertAdjacentHTML('afterbegin','<img class="world-illustration" src="./assets/paper-world.svg" alt="" width="1200" height="620">');
}
function homePage() {
  const hour = Number(new Intl.DateTimeFormat('en-GB',{hour:'numeric',hourCycle:'h23',timeZone:'Asia/Shanghai'}).format(new Date()));
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '午后好' : '晚上好';
  const photos = state.records.filter(r=>r.type==='photo');
  const letters = state.records.filter(r=>r.type==='letter');
  const records = state.records.filter(r=>r.type!=='letter' && (feedFilter==='all' || r.type===feedFilter)).slice(0,3);
  const cover = (r,i) => `<figure class="polaroid ${i ? 'second' : ''}"><span class="photo-tape"></span><img src="${escape(imageUrl(r?.media || 'assets/paper-world.svg'))}" alt="" width="180" height="180"><figcaption>${escape(i ? 'our kind of days.' : 'you, me & the sea ♡')}</figcaption></figure>`;
  return `${heading(`${greeting}，欢迎来访 <span class="greeting-heart">♡</span>`,'今天，也有一些小事想和你分享。',shareButton())}
  <section class="hero" aria-label="记录我们的故事"><div class="hero-copy"><div class="hero-kicker"><span>✳</span> LOVE IN THE LITTLE THINGS</div><h2>把普通的日子，<br>过成<i>我们的故事。</i></h2><p>照片、碎碎念、没说出口的话，<br>在这里，都有一个只属于我们的角落。</p><div class="hero-bottom"><button class="button primary" data-view="daily">${icon('daily')}看看我们的日常${icon('arrow')}</button><span>慢慢记录，好好相爱。</span></div></div><div class="hero-art" aria-hidden="true">${cover(photos[0],0)}${cover(photos[1],1)}<span class="hand-star">✧</span><span class="small-heart">♡</span><span class="hero-scribble">better, together.</span></div></section>
  <section class="stats-grid" aria-label="我们的记录"><div class="stat-card"><div><p class="stat-label">${icon('heart')}我们已经在一起</p><p class="stat-value">${state.since ? Math.max(1,1-dayDiff(state.since)) : '—'}<small>天，仍然心动</small></p></div><span class="stat-decoration">${icon('flower')}</span></div><div class="stat-card"><div><p class="stat-label">${icon('photo')}一起收藏的瞬间</p><p class="stat-value">${String(photos.length).padStart(2,'0')}<small>张照片</small></p></div><span class="stat-decoration">${icon('photo')}</span></div><div class="stat-card"><div><p class="stat-label">${icon('letter')}想对你说的话</p><p class="stat-value">${String(letters.length).padStart(2,'0')}<small>封情书</small></p></div><span class="stat-decoration">${icon('letter')}</span></div></section>
  <div class="dashboard-columns"><section><div class="section-heading"><h2>最近的小美好 <small>OUR MOMENTS</small></h2><button class="button text" data-view="daily">查看全部 ${icon('arrow')}</button></div><div class="feed-filters">${[['all','全部动态'],['daily','日常碎片'],['photo','照片回忆']].map(([key,label])=>`<button class="filter ${feedFilter===key ? 'active' : ''}" data-filter="${key}" aria-pressed="${feedFilter===key}">${label}</button>`).join('')}</div>${records.map(recordCard).join('') || empty('还没有这一类记录','一起期待下一份小美好。')}<p class="section-footnote">小小的日常，慢慢拼成我们的模样 ♡</p></section><aside class="dashboard-aside">${countdownCard()}${wishCard()}<section class="side-card game-promo"><h3 class="side-card-title">今天，也一起玩吧</h3><p>在忙碌的日子里，留一点时间给彼此。</p><button class="button" data-view="game">去双人游乐场 ${icon('arrow')}</button><div class="mini-board" aria-hidden="true">${['♡','','×','','♡','','×','','♡'].map(s=>`<span>${s}</span>`).join('')}</div></section></aside></div>`;
}
function recordCard(r) {
  return `<article class="record-card"><div class="record-header">${avatar(r.author)}<div><div class="record-author">${escape(r.author)}</div><div class="record-time">${date(r.created,{year:'numeric'})}</div></div>${r.mood ? `<span class="mood-chip">${escape(r.mood)}</span>` : ''}</div>${r.title ? `<h3 class="record-title">${escape(r.title)}</h3>` : ''}${r.body ? `<p class="record-body">${escape(r.body)}</p>` : ''}${r.media ? `<img class="record-image" src="${escape(imageUrl(r.media))}" alt="${escape(r.title || '我们收藏的照片')}" loading="lazy" data-action="read" data-id="${escape(r.id)}" tabindex="0" role="button" aria-label="查看照片：${escape(r.title || '照片')}" width="600" height="350">` : ''}<div class="record-footer"><span class="record-kind">${icon(r.type)}${typeLabel(r.type)} · 公开展示</span><span class="readonly-heart" aria-label="已收藏 ${Number(r.hearts)||0} 份心意">${icon('heart')}${Number(r.hearts)||0}</span></div></article>`;
}
function countdownCard() {
  const next = state.anniversaries.filter(a=>dayDiff(a.date)>=0).sort((a,b)=>a.date.localeCompare(b.date))[0];
  return `<section class="side-card countdown-card"><h3 class="side-card-title">${next ? escape(next.title) : '值得期待的日子'}${icon('calendar')}</h3>${next ? `<p class="countdown-date">${date(next.date,{year:'numeric'})}</p><p class="countdown-number">${dayDiff(next.date)}<small>天后</small></p><p class="countdown-caption">${dayDiff(next.date)===0 ? '就是今天，好好庆祝吧。' : '想到这里，就开始期待了。'}</p>` : '<p class="countdown-caption">为下一次见面，留一个倒计时。</p>'}<span class="countdown-flower" aria-hidden="true">✳</span></section>`;
}
function wishCard(large = false) {
  return `<section class="side-card ${large ? 'wish-large' : ''}"><h3 class="side-card-title">我们的心愿清单 ${icon('heart')}</h3><div role="list">${(large ? state.wishes : state.wishes.slice(0,3)).map(w=>`<div role="listitem" class="wish-item readonly-wish ${w.done ? 'done' : ''}"><span class="wish-check" aria-hidden="true">${w.done ? icon('check') : ''}</span><span>${escape(w.title)}${w.done ? '<span class="sr-only">（已完成）</span>' : ''}</span></div>`).join('') || '<p class="page-description">还有好多事情，想和你一起做。</p>'}</div></section>`;
}
function dailyPage() {
  return `${heading('日常碎片','不必是大事，只要是你，就想听。','','EVERYDAY, WITH YOU')}<p class="page-description">分享今天的心情、街角的风、还有突然想你的那一秒。</p><div class="daily-layout">${state.records.filter(r=>r.type==='daily').map(recordCard).join('') || empty('日常，正在慢慢收集','再普通的日常，也值得被认真收藏。')}</div>`;
}
function photoPage() {
  const photos = state.records.filter(r=>r.type==='photo');
  return `${heading('照片回忆','把想留住的瞬间，放进我们的相册。','','COLLECTING OUR DAYS')}<div class="section-heading"><p class="page-description">有些瞬间，过很久再看，还是会笑。</p><span class="photo-count">共 ${photos.length} 个瞬间</span></div><div class="page-grid">${photos.map(r=>`<button class="album-card" data-action="read" data-id="${escape(r.id)}"><img src="${escape(imageUrl(r.media))}" alt="${escape(r.title || '我们的回忆')}" loading="lazy" width="400" height="300"><h3>${escape(r.title || '想和你一起记住的瞬间')}</h3><div class="album-meta"><span>${escape(r.author)} · ${date(r.created)}</span><span>♡ ${Number(r.hearts)||0}</span></div></button>`).join('') || empty('相册，正在等下一份回忆','有些风景，想和你一起记住。')}</div>`;
}
function letterPage() {
  const letters = state.records.filter(r=>r.type==='letter');
  return `${heading('手写信箱','有些话，想慢一点，认真地写给你。','','WORDS FROM THE HEART')}<p class="page-description">用指尖写下想念，或用文字寄出心意。点开信封，读一份认真写下的心意。</p>${letters.length ? `<div class="page-grid">${letters.map(r=>`<button class="letter-card" data-action="read" data-id="${escape(r.id)}"><div class="letter-seal">♡</div><h3>${escape(r.title || '一封只写给你的信')}</h3><p>To ${escape(state.members.find(n=>n!==r.author) || '亲爱的你')}<br>有一份心意，等你轻轻打开。</p><small>${escape(r.author)} 寄于 ${date(r.created,{year:'numeric'})}</small></button>`).join('')}</div>` : empty('信箱，正在等第一封信','想念有很多种表达，写一封信是其中一种。')}`;
}
function promisesPage() {
  return `${heading('我们的约定','把「以后一起」变成「我们做到了」。','','LITTLE PLANS, BIG DREAMS')}<p class="page-description">认真记住每一个特别的日子，也期待那些还没一起完成的小事。</p><div class="promise-grid">${wishCard(true)}<section class="side-card"><h3 class="side-card-title">值得记住的日子 ${icon('calendar')}</h3>${state.anniversaries.map(a=>`<div class="date-item"><div><strong>${escape(a.title)}</strong><p>${date(a.date,{year:'numeric'})}</p></div><div class="date-days">${Math.abs(dayDiff(a.date))}<small>${dayDiff(a.date)>=0 ? '天后' : '天前'}</small></div></div>`).join('') || '<p class="page-description">下一次见面、第一次旅行、彼此的生日…</p>'}</section></div>`;
}
function gamePage() {
  return `${heading('双人游乐场','今天的快乐，想分你一半。','','PLAY A LITTLE, LOVE A LOT')}<p class="page-description">哪怕隔着屏幕，也能一起度过一小段开心的时间。</p><p class="showcase-notice">这里保留原来的游戏界面。当前为只读预览，尚未连接双人游戏服务，不会同步棋局或保存进度。</p><section class="game-hero memory-hero"><span class="pill">双人合作 · 记忆挑战</span><h2>把心意，一一配对</h2><p>一起翻开卡片，找到 6 对相同的心意。你记一半，我记一半。</p><div class="memory-progress">共同的目标，让快乐加倍。</div><div class="memory-board" role="group" aria-label="合作翻牌卡片，只读预览">${Array.from({length:12},(_,i)=>`<button class="memory-cell" disabled aria-label="第 ${i+1} 张卡片，只读预览"><span>♡</span></button>`).join('')}</div><span class="game-preview-label">只读游戏预览</span></section><section class="game-hero"><span class="game-symbol">♡ × ♡</span><h2>心动连线</h2><p>你画爱心，我画叉叉。三个连成一线，就赢啦。</p><div class="game-status">一人一步，把时间留给彼此。</div><div class="game-board" role="group" aria-label="三乘三棋盘，只读预览">${['♡','','×','','♡','','×','','♡'].map((mark,i)=>`<button class="game-cell ${mark==='×' ? 'other' : ''}" disabled aria-label="第 ${i+1} 格，只读预览">${mark}</button>`).join('')}</div><span class="game-preview-label">只读游戏预览</span></section><section class="question-card"><div><p class="eyebrow">A LITTLE CLOSER</p><h3>如果可以重过一天，你最想回到我们哪一天？</h3><p>没有标准答案，只是想再了解你多一点。</p></div><button class="button secondary" data-view="daily">看看我们的日常 ${icon('arrow')}</button></section>`;
}

function openModal(title, description, content) {
  $('#modal-content').innerHTML = `<div class="modal-inner"><div class="modal-header"><h2 id="modal-title">${escape(title)}</h2><button class="modal-close" data-action="close" aria-label="关闭弹窗">×</button></div>${description ? `<p class="modal-description">${escape(description)}</p>` : ''}${content}</div>`;
  if (!modal.open) modal.showModal();
}
function readRecord(id) {
  const r = state.records.find(r=>r.id===id);
  if (!r) return;
  const media = r.media ? `<img class="${r.type==='letter' ? 'handwritten-letter' : 'lightbox-photo'}" src="${escape(imageUrl(r.media))}" alt="${escape(r.title || '回忆')}" width="900" height="600">` : '';
  const body = `<div class="read-meta">${avatar(r.author)}${escape(r.author)} · ${date(r.created,{year:'numeric'})}</div>${r.type==='letter' ? `<div class="letter-reading">${escape(r.body)}${media}</div>` : `${media}<p class="record-body">${escape(r.body)}</p>`}<p class="auth-alt">${icon('heart')}把爱留在日常里 · 公开展示内容</p>`;
  openModal(r.title || '一起收藏的瞬间','',body);
}
function about() {
  openModal('关于这个小世界','同频 · 公开只读展示版',`<div class="readonly-info"><p>照片、日常、信件、心愿和纪念日，沿用原来的小世界。</p><p>${state.sample ? '当前展示的是原项目的示例人物、示例文字和风景图片，不是站点所有者的真实私人记录。' : '本站内容由维护者公开发布，任何访问者都可以浏览。'}</p><p>访客无需登录，可以浏览栏目、放大照片、拆开信件和分享网址。当前没有上传、共同编辑、邮件提醒或在线双人游戏。</p><p>内容更新后，刷新这个固定网址即可查看。最后一次内容更新：${date(state.updated,{year:'numeric'})}。</p></div><div class="form-actions"><button class="button primary" data-action="share">${icon('link')}分享这个小世界</button></div>`);
}
function share() {
  openModal('把这个小世界，分享给你','这是固定的网站地址。任何拿到地址的人都可以查看公开内容。',`<div class="link-box share-url"><a href="${escape(siteUrl)}" id="share-link">${escape(siteUrl)}</a></div><button class="button primary full-width" data-action="copy-link">${icon('link')}复制网站链接</button><p class="auth-alt">对方无需登录，打开即可浏览；访客不能修改内容。</p>`);
}
function toast(message) {
  clearTimeout(toastTimeout); $('#toast').textContent=message; $('#toast').classList.add('visible');
  toastTimeout=setTimeout(()=>$('#toast').classList.remove('visible'),3800);
}
function setMenu(open) {
  $('#sidebar').classList.toggle('open',open); $('#mobile-backdrop').classList.toggle('visible',open);
  $('.mobile-menu').setAttribute('aria-expanded',String(open));
}
function currentView() {
  return nav.some(([key])=>key===location.hash.slice(1)) ? location.hash.slice(1) : 'home';
}
function showView() {
  if (!state) return;
  view=currentView(); setMenu(false); if(modal.open)modal.close(); render();
  $('.content-wrap')?.classList.add('paper-enter'); window.scrollTo({top:0});
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-view],[data-action],[data-filter]');
  if(!button)return;
  if(button.dataset.view){ if(location.hash.slice(1)===button.dataset.view)showView(); else location.hash=button.dataset.view; return; }
  if(button.dataset.filter){feedFilter=button.dataset.filter;render();return;}
  const action=button.dataset.action;
  if(action==='close')modal.close();
  if(action==='menu')setMenu(!$('#sidebar').classList.contains('open'));
  if(action==='about' && state)about();
  if(action==='share' && state)share();
  if(action==='read' && state)readRecord(button.dataset.id);
  if(action==='reload')location.reload();
  if(action==='copy-link'){
    try{await navigator.clipboard.writeText(siteUrl);toast('网站链接已复制，发给想分享的人吧 ♡');}
    catch{const range=document.createRange();range.selectNodeContents($('#share-link'));getSelection().removeAllRanges();getSelection().addRange(range);toast('已选中网址，请长按或按 Ctrl+C 复制');}
  }
});
$('#mobile-backdrop').addEventListener('click',()=>setMenu(false));
window.addEventListener('hashchange',showView);
document.addEventListener('keydown',event=>{
  if((event.key==='Enter' || event.key===' ') && event.target.matches('.record-image')){event.preventDefault();readRecord(event.target.dataset.id);return;}
  if(event.key==='Escape')setMenu(false);
  if(event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || modal.open || !state)return;
  if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(/^[1-6]$/.test(event.key)){event.preventDefault();location.hash=nav[Number(event.key)-1][0];}
});
document.addEventListener('pointermove',event=>{
  if(reducedMotion.matches || !finePointer.matches || modal.open)return;
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
  if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom)modal.close();
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
