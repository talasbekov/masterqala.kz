// Fixture request cookie only; no production requests or native hydration claim.
export async function cookies(){return {get:name=>name==='mq_locale'&&globalThis.fixtureLocaleCookie?{value:globalThis.fixtureLocaleCookie}:undefined}}
