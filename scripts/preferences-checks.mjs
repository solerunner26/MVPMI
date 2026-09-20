// Header-only language/theme controls; preserve an open preferences view for callers.
async function outsideSettings(page,action){
 const open=await page.locator('.preferences-panel .reading-control').count()>0;
 if(open)await page.getByRole('button',{name:/Close|બંધ કરો/}).click();
 await action();
 if(open)await page.getByTestId('Reading settings').click();
}
export async function toggleTheme(page){await outsideSettings(page,()=>page.getByTestId('Theme').click())}
export async function chooseTheme(page,theme){if(await page.locator('.app').getAttribute('data-theme')!==theme)await toggleTheme(page)}
export async function chooseLanguage(page,lang){await outsideSettings(page,async()=>{if(await page.locator('.app').getAttribute('data-lang')!==lang)await page.getByTestId('Language').click()})}
export async function openMemberHelp(page){await page.getByTestId('Reading settings').click();await page.getByTestId('Member help').click()}
export async function appointFirstRepresentative(page,requestId){
 await page.getByTestId('Village management').click();
 await page.getByRole('button',{name:/Villages & admins/}).click();
 const card=page.locator('.workflow-card').filter({has:page.getByRole('heading',{name:/થોરાળા/})});
 await card.locator('select').selectOption('request:'+requestId);
 await card.getByLabel(/Assignment \/ change reason/).fill('Known first representative, identity checked in person');
 await card.getByRole('checkbox').check();
 await card.getByRole('button',{name:/Save assignment/}).click();
 await card.getByText(/Current administrator:/).waitFor();
 await page.getByRole('button',{name:/Back to dashboard/}).click();
}
