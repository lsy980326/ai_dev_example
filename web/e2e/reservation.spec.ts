import {test,expect,type BrowserContext,type Page} from "@playwright/test";
import fs from "node:fs/promises";
const base=process.env.E2E_BASE_URL??"http://localhost:3000";
const out=process.env.E2E_OUTPUT??"test-results";
async function signIn(page:Page,user:string){
  await page.goto("/");await page.getByRole("button",{name:"로그인",exact:true}).click();
  await page.locator("#username").fill(user);await page.locator("#password").fill("demo-pass-2026");
  await page.locator("#kc-login").click();await expect(page.getByRole("button",{name:"로그아웃"})).toBeVisible();
}
async function post(context:BrowserContext,id=17,body:object={},origin:string|null=base){
  return context.request.post(`${base}/api/sessions/${id}/registrations`,{data:body,headers:origin?{Origin:origin}:{}});
}
test("public page, keyboard access, and BFF request boundaries",async({page,context})=>{
  await page.goto("/");await expect(page.getByRole("heading",{name:"금요일 시스템 설계 스터디",exact:true})).toBeVisible();
  await expect(page.getByText("마지막 한 자리",{exact:true})).toBeVisible();
  expect((await post(context,17,{},null)).status()).toBe(403);
  expect((await post(context,17,{},"https://untrusted.example")).status()).toBe(403);
  expect((await post(context)).status()).toBe(401);
  await page.keyboard.press("Tab");await expect(page.getByRole("link",{name:"다음 모임"})).toBeFocused();
  await fs.mkdir(out,{recursive:true});await page.screenshot({path:`${out}/desktop-before.png`,fullPage:true});
});
test("real OIDC, two members competing, retry, and a lost response",async({browser})=>{
  const a=await browser.newContext();const b=await browser.newContext();const pa=await a.newPage();const pb=await b.newPage();
  try{
    await signIn(pa,"demo-a");await signIn(pb,"demo-b");
    const publicSession=await (await a.request.get(`${base}/api/auth/session`)).json();
    expect(/access[_]?token|refresh[_]?token|id[_]?token/i.test(JSON.stringify(publicSession))).toBe(false);
    expect((await post(a,17,{memberId:"victim"})).status()).toBe(400);
    expect((await post(a,17,{},"https://untrusted.example")).status()).toBe(403);
    const results=await Promise.all([post(a),post(b)]);
    expect(results.map(r=>r.status()).sort()).toEqual([201,409]);
    const winner=results[0].status()===201?0:1;const contexts=[a,b];const pages=[pa,pb];
    const created=await results[winner].json();const retry=await post(contexts[winner]);
    expect(retry.status()).toBe(200);expect((await retry.json()).registrationId).toBe(created.registrationId);
    const loser=pages[1-winner];await loser.getByRole("button",{name:"참가 신청",exact:true}).click();
    await expect(loser.getByRole("status")).toContainText("마지막 자리가 먼저 확정됐어요");
    const confirmed=pages[winner];await confirmed.reload();await expect(confirmed.getByText("참가 확정",{exact:true}).first()).toBeVisible();
    await confirmed.screenshot({path:`${out}/desktop-confirmed.png`,fullPage:true});
    await confirmed.setViewportSize({width:390,height:844});
    expect(await confirmed.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await confirmed.screenshot({path:`${out}/mobile-confirmed.png`,fullPage:true});
    const sessions=await (await a.request.get(`${base.replace(/\/$/,"")}/api/auth/session`)).json();
    expect(/access[_]?token|refresh[_]?token|id[_]?token/i.test(JSON.stringify(sessions))).toBe(false);
    await confirmed.getByRole("button",{name:/더 나은 API를 만드는 시간/}).click();
    let forwarded=false;
    await confirmed.route("**/api/sessions/18/registrations",async route=>{await route.fetch();forwarded=true;await route.abort("connectionfailed");});
    await confirmed.getByRole("button",{name:"참가 신청",exact:true}).click();
    await expect(confirmed.getByRole("status")).toContainText("연결이 끊겨");expect(forwarded).toBe(true);
    await confirmed.unroute("**/api/sessions/18/registrations");
    await confirmed.getByRole("button",{name:"참가 신청",exact:true}).click();
    await expect(confirmed.getByRole("status")).toContainText("이미 확정된 신청을 확인했어요");
    const cookies=await contexts[winner].cookies();const sessionCookie=cookies.find(c=>c.name.endsWith("next-auth.session-token"));
    expect(sessionCookie).toBeDefined();
    if(sessionCookie){await contexts[winner].addCookies([{...sessionCookie,value:`tampered.${sessionCookie.value.slice(10)}`}]);}
    expect((await post(contexts[winner],18)).status()).toBe(401);
  }finally{await a.close();await b.close();}
});
