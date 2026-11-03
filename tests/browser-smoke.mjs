import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output=path.join(root,'test-results');await mkdir(output,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const prefix='/tongpin-showcase/';
const types={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
let server,browser;
let base=process.env.SITE_URL;
if(!base){
  server=createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(!pathname.startsWith(prefix)){res.writeHead(404).end();return;}
      const relative=pathname.slice(prefix.length)||'index.html';
      if(!/^(index\.html|content\.json|app\.js|styles\.css|playful\.css|showcase\.css|assets\/[\w/.-]+)$/.test(relative)){res.writeHead(404).end();return;}
      const target=path.resolve(root,relative);
      if(!target.startsWith(root+path.sep)){res.writeHead(404).end();return;}
      const bytes=await readFile(target);
      res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}${prefix}`;
}
const views=[['home','欢迎来访'],['daily','日常碎片'],['photo','照片回忆'],['letter','手写信箱'],['game','双人游乐场'],['promises','我们的约定']];
const errors=[],badResponses=[],writes=[],external=[];
try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
  for(const width of [320,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:width>800 ? 1000:844},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',r=>{if(r.status()>=400)badResponses.push(`${r.status()} ${r.url()}`);});
    page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method()+' '+r.url());if(new URL(r.url()).origin!==new URL(base).origin)external.push(r.url());});
    await page.goto(base,{waitUntil:'networkidle'});
    await page.locator('.hero').waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('.hero img')].every(i=>i.complete&&i.naturalWidth>0));
    assert.match(await page.locator('#mode-badge').innerText(),/公开只读/);
    assert.ok((await page.locator('#about-button').boundingBox()).height<=42,'展示说明按钮不应挤占下一行');
    if(width>850)assert.ok((await page.locator('.sidebar-account').boundingBox()).height<=48,'电脑顶栏署名不应逐字换行');
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(await overflow(),false,`${width}px home overflow`);
    await page.screenshot({path:path.join(output,`home-${width}.png`),animations:'disabled'});
    for(const [view,title] of views){
      await page.locator(`#navigation [data-view="${view}"]`).click();
      await page.getByRole('heading',{name:view==='home' ? new RegExp(title) : title,exact:view!=='home'}).waitFor();
      assert.equal(await overflow(),false,`${width}px ${view} overflow`);
    }
    await page.locator('#navigation [data-view="photo"]').click();
    await page.locator('.album-card').first().click();
    await page.locator('#modal[open] .lightbox-photo').waitFor();
    await page.waitForFunction(()=>document.querySelector('.lightbox-photo').naturalWidth>0);
    await page.keyboard.press('Escape');await page.locator('#modal').waitFor({state:'hidden'});
    await page.locator('#navigation [data-view="letter"]').click();
    await page.locator('.letter-card').first().click();
    await page.getByText('喜欢和你分享生活里细碎的小事。',{exact:false}).waitFor();
    await page.screenshot({path:path.join(output,`letter-${width}.png`),animations:'disabled'});
    const letterBounds=await page.locator('#modal').boundingBox();
    assert.ok(letterBounds.x>=0 && letterBounds.y>=0 && letterBounds.x+letterBounds.width<=width+1,'信件弹窗位于视口内');
    await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
    await page.reload({waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'手写信箱',exact:true}).waitFor();
    assert.equal(new URL(page.url()).hash,'#letter');
    await page.getByRole('button',{name:'分享网站',exact:true}).click();
    assert.equal(await page.locator('#share-link').innerText(),base);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}}));
    await page.getByRole('button',{name:'复制网站链接',exact:true}).click();
    await page.getByText('已选中网址，请长按或按 Ctrl+C 复制',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>getSelection().toString()),base);
    await page.keyboard.press('Escape');
    await page.locator('#navigation [data-view="game"]').click();
    assert.equal(await page.locator('.memory-cell:enabled,.game-cell:enabled').count(),0);
    assert.equal(await page.locator('input,textarea,form,[data-action="compose"],[data-action="login"]').count(),0);
    if(width<=390){
      await page.getByRole('button',{name:'打开导航',exact:true}).click();
      assert.equal(await page.locator('.mobile-menu').getAttribute('aria-expanded'),'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.mobile-menu').getAttribute('aria-expanded'),'false');
    }
    if(width===1440){
      await page.keyboard.press('1');await page.locator('.hero').waitFor();
      await page.getByRole('button',{name:'照片回忆',exact:true}).last().click();
      assert.equal(await page.locator('.record-card').count(),2);
      await page.keyboard.press('1');
      const hero=await page.locator('.hero').boundingBox();await page.mouse.move(hero.x+hero.width*.7,hero.y+hero.height*.5);
      await page.waitForFunction(()=>document.querySelector('.hero').style.getPropertyValue('--scene-x')!=='');
      await page.keyboard.press('3');await page.getByRole('heading',{name:'照片回忆',exact:true}).waitFor();
      console.log('PASS 筛选、数字键导航及场景跟随');
    }
    assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
    console.log(`PASS ${width}px：六个栏目、照片、信件、固定链接、刷新、只读与布局`);
    await context.close();
  }
  if(!process.env.SITE_URL){
    const context=await browser.newContext();const page=await context.newPage();
    await page.route('**/content.json',route=>route.fulfill({status:503,body:'unavailable'}));
    await page.goto(base);await page.getByRole('heading',{name:'暂时没有打开我们的小世界'}).waitFor();
    await page.getByText('内容文件读取失败（503）',{exact:true}).waitFor();
    await context.close();console.log('PASS 内容加载失败明确提示，不显示伪造数据');
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto(base);await page.locator('.hero').waitFor();
  const hero=await page.locator('.hero').boundingBox();await page.mouse.move(hero.x+hero.width*.7,hero.y+200);
  assert.equal(await page.locator('.hero').evaluate(el=>el.style.getPropertyValue('--scene-x')),'');
  await context.close();
  assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);assert.deepEqual(writes,[]);assert.deepEqual(external,[]);
  console.log('PASS 减少动画、零脚本错误、零失效资源、零写入和第三方请求');
  console.log('Screenshots: '+output);
}finally{
  await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));
}
