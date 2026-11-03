import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const content=JSON.parse(readFileSync(path.join(root,'content.json'),'utf8'));
const script=readFileSync(path.join(root,'app.js'),'utf8');
const html=readFileSync(path.join(root,'index.html'),'utf8');
const isDate=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;

test('公开内容格式、日期及记录编号有效',()=>{
  assert.equal(typeof content.sample,'boolean');
  assert.ok(isDate(content.updated));
  assert.ok(isDate(content.since));
  assert.equal(content.members.length,2);
  for(const member of content.members)assert.ok(typeof member==='string' && member.trim());
  assert.notEqual(content.members[0],content.members[1]);
  const ids=new Set();
  for(const record of content.records){
    assert.ok(typeof record.id==='string' && record.id && !ids.has(record.id));ids.add(record.id);
    assert.ok(['photo','letter'].includes(record.type));
    assert.ok(content.members.includes(record.author));
    assert.equal(typeof record.title,'string');assert.equal(typeof record.body,'string');
    assert.ok(Number.isFinite(Date.parse(record.created)));
    if(record.type==='photo')assert.ok(record.media);
  }
  for(const wish of content.wishes){assert.equal(typeof wish.title,'string');assert.equal(typeof wish.done,'boolean');}
  for(const anniversary of content.anniversaries){assert.equal(typeof anniversary.title,'string');assert.ok(isDate(anniversary.date));}
});

test('照片与手写图片只引用可发布的本地素材',()=>{
  for(const record of content.records){
    if(!record.media)continue;
    assert.match(record.media,/^assets\/[\w/-]+\.(jpg|jpeg|png|webp|svg)$/i);
    const target=path.resolve(root,record.media);
    assert.ok(target.startsWith(path.join(root,'assets')+path.sep));
    assert.ok(existsSync(target),record.media);
  }
  for(const name of ['favicon.svg','paper-world.svg','icons/apple-touch-icon.png'])assert.ok(existsSync(path.join(root,'assets',name)));
});

test('公开数据没有后台凭证，页面入口适配 GitHub 项目子路径',()=>{
  const check=(value)=>{
    if(Array.isArray(value)){value.forEach(check);return;}
    if(!value || typeof value!=='object')return;
    for(const [key,item] of Object.entries(value)){
      assert.ok(!/email|password|token|secret|csrf|cookie|api.?key|invite/i.test(key),`禁止公开字段：${key}`);
      check(item);
    }
  };
  check(content);
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(match[1].startsWith('./') || match[1].startsWith('#'),match[1]);
  assert.ok(!/\/api\/|localStorage|sessionStorage|serviceWorker\.register|method\s*:\s*['"]POST/.test(script));
  assert.ok(!/name="(?:email|password)"|type="file"/.test(html));
});
