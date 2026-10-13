import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../app/(app)/order/new/page.tsx',import.meta.url),'utf8');
const auth=readFileSync(new URL('../lib/auth.tsx',import.meta.url),'utf8');
test('new-order source keys the form by authenticated owner and uses guarded draft initialization rather than locale-dependent geolocation',()=>{
 assert.match(page,/<NewOrderForm key=\{user.id\} ownerId=\{user.id\}/);assert.match(page,/useNewOrderDraft\(ownerId\)/);assert.match(page,/applyInitialLocation\(\{ lat: pos.coords.latitude/);assert.doesNotMatch(page,/\}, \[t\]\)/);assert.match(page,/if \(!ready\|\|pending\|\|completedOrderId\) return/);
});
test('new-order source clears only after successful order creation and revalidates restored preview through API',()=>{
 assert.match(page,/if\(!finishCreate\(request,order.id\)\)return;\s*router.push\(`\/order\/\$\{order.id\}`\)/);assert.match(page,/const request=beginCreate\(\);if\(!request\)return;/);assert.match(page,/if\(pending\|\|completedOrderId\)return <NewOrderCreationStatus/);assert.match(page,/api\('\/orders\/preview'/);assert.match(page,/let cancelled=false/);assert.match(page,/return\(\)=>\{cancelled=true;\}/);assert.match(auth,/const logout = \(\) => \{\s*clearNewOrderDraft\(\)/);assert.doesNotMatch(auth,/localStorage.clear/);
});
