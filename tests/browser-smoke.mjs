import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startStaticServer } from './static-server.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output=path.join(root,'test-results');await mkdir(output,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const server=process.env.SITE_URL ? null : await startStaticServer();
const base=process.env.SITE_URL||server.base;
let browser;
const views=[['home','欢迎来访'],['photo','照片回忆'],['letter','手写信箱'],['promises','我们的约定']];
const errors=[],badResponses=[],writes=[],external=[];
try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
  for(const width of [320,390,768,1440]){
    const touch=width<=640;
    const context=await browser.newContext({viewport:{width,height:width>800 ? 1000:844},isMobile:touch,hasTouch:touch,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
    const page=await context.newPage();
    const activate=locator=>touch ? locator.tap() : locator.click();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',r=>{if(r.status()>=400)badResponses.push(`${r.status()} ${r.url()}`);});
    page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method()+' '+r.url());if(new URL(r.url()).origin!==new URL(base).origin)external.push(r.url());});
    await page.goto(base,{waitUntil:'networkidle'});
    await page.locator('.hero').waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('.hero img')].every(i=>i.complete&&i.naturalWidth>0));
    assert.match(await page.locator('#mode-badge').innerText(),/公开只读/);
    assert.ok((await page.locator('#about-button').boundingBox()).height<=46,'展示说明按钮不应挤占下一行');
    if(width>850)assert.ok((await page.locator('.sidebar-account').boundingBox()).height<=48,'电脑顶栏署名不应逐字换行');
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(await overflow(),false,`${width}px home overflow`);
    await page.screenshot({path:path.join(output,`home-${width}.png`),animations:'disabled'});
    for(const [view,title] of views){
      await activate(page.locator(`#navigation [data-view="${view}"]`));
      await page.getByRole('heading',{name:view==='home' ? new RegExp(title) : title,exact:view!=='home'}).waitFor();
      assert.equal(await overflow(),false,`${width}px ${view} overflow`);
    }
    assert.equal(await page.locator('[data-view="daily"],[data-view="game"],.game-promo,.feed-filters').count(),0);
    if(touch){
      for(const target of await page.locator('#navigation .nav-item,.share-icon,#about-button').all()){
        const bounds=await target.boundingBox();assert.ok(bounds.width>=44 && bounds.height>=44,'手机交互目标至少 44px');
      }
    }
    await activate(page.locator('#navigation [data-view="photo"]'));
    await activate(page.locator('.album-card').first());
    await page.locator('#modal[open] .lightbox-photo').waitFor();
    await page.waitForFunction(()=>document.querySelector('.lightbox-photo').naturalWidth>0);
    await page.keyboard.press('Escape');await page.locator('#modal').waitFor({state:'hidden'});
    await activate(page.locator('#navigation [data-view="letter"]'));
    await activate(page.locator('.letter-card').first());
    await page.getByText('喜欢和你分享生活里细碎的小事。',{exact:false}).waitFor();
    await page.screenshot({path:path.join(output,`letter-${width}.png`),animations:'disabled'});
    const letterBounds=await page.locator('#modal').boundingBox();
    assert.ok(letterBounds.x>=0 && letterBounds.y>=0 && letterBounds.x+letterBounds.width<=width+1,'信件弹窗位于视口内');
    await activate(page.getByRole('button',{name:'关闭弹窗',exact:true}));
    await page.reload({waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'手写信箱',exact:true}).waitFor();
    assert.equal(new URL(page.url()).hash,'#letter');
    await activate(page.getByRole('button',{name:'分享网站',exact:true}));
    assert.equal(await page.locator('#share-link').innerText(),base);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}}));
    await activate(page.getByRole('button',{name:'复制网站链接',exact:true}));
    await page.getByText('已选中网址，请长按或按 Ctrl+C 复制',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>getSelection().toString()),base);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('input,textarea,form,[data-action="compose"],[data-action="login"]').count(),0);
    await activate(page.locator('#navigation [data-view="home"]'));
    await activate(page.locator('.hero-art .polaroid').first());
    await page.locator('#modal[open] .lightbox-photo').waitFor();await page.keyboard.press('Escape');
    await activate(page.getByRole('link',{name:'查看所有照片',exact:true}));
    await page.getByRole('heading',{name:'照片回忆',exact:true}).waitFor();
    await activate(page.locator('#navigation [data-view="home"]'));
    await activate(page.getByRole('link',{name:'查看所有信件',exact:true}));
    await page.getByRole('heading',{name:'手写信箱',exact:true}).waitFor();
    if(width===1440){
      await page.keyboard.press('1');await page.locator('.hero').waitFor();
      const hero=await page.locator('.hero').boundingBox();await page.mouse.move(hero.x+hero.width*.7,hero.y+hero.height*.5);
      await page.waitForFunction(()=>document.querySelector('.hero').style.getPropertyValue('--scene-x')!=='');
      await page.keyboard.press('2');await page.getByRole('heading',{name:'照片回忆',exact:true}).waitFor();
      console.log('PASS 数字键导航及场景跟随');
    }
    assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
    console.log(`PASS ${width}px：四个栏目、触屏入口、照片、信件、固定链接、刷新与布局`);
    await context.close();
  }
  if(!process.env.SITE_URL){
    const context=await browser.newContext();const page=await context.newPage();
    await page.route('**/content.json',route=>route.fulfill({status:503,body:'unavailable'}));
    await page.goto(base);await page.getByRole('heading',{name:'暂时没有打开我们的小世界'}).waitFor();
    await page.getByText('内容文件读取失败（503）',{exact:true}).waitFor();
    await context.close();console.log('PASS 内容加载失败明确提示，不显示伪造数据');
    const legacy=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await legacy.addInitScript(()=>{
      Object.defineProperty(HTMLDialogElement.prototype,'showModal',{value:undefined,configurable:true});
      Object.defineProperty(HTMLDialogElement.prototype,'close',{value:undefined,configurable:true});
    });
    const oldPage=await legacy.newPage();oldPage.on('pageerror',e=>errors.push(e.message));
    await oldPage.goto(base);await oldPage.locator('.hero').waitFor();
    await oldPage.getByRole('button',{name:'分享网站',exact:true}).tap();
    assert.equal(await oldPage.locator('body.modal-fallback #modal[open]').count(),1);
    await oldPage.keyboard.press('Shift+Tab');
    assert.equal(await oldPage.getByRole('button',{name:'复制网站链接',exact:true}).evaluate(el=>el===document.activeElement),true,'兼容弹窗限制键盘焦点');
    await oldPage.keyboard.press('Escape');assert.equal(await oldPage.locator('#modal[open]').count(),0);
    await oldPage.locator('#navigation [data-view="letter"]').tap();await oldPage.locator('.letter-card').tap();
    await oldPage.getByRole('button',{name:'关闭弹窗',exact:true}).tap();
    assert.equal(await oldPage.locator('body.modal-fallback').count(),0);
    await oldPage.goto(base+'#game');await oldPage.locator('.hero').waitFor();
    assert.equal(await oldPage.locator('[data-view="game"]').count(),0);
    await legacy.close();console.log('PASS 无原生弹窗时仍可打开/关闭，旧游戏链接回到概览');
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
  await browser?.close();await server?.close();
}
