import type {DisputeTarget} from '@masterqala/ui';

export const DISPUTE_DRAFT_PREFIX = 'mq.desktop.dispute.v1:';
export type DisputeDraft = {reason: string; category: 'quality'|'price'|'behavior'|'other'; pending: 'submit'|'upload'|null; body: string|null};
export type DisputeDraftScope = DisputeTarget & {ownerId: string};
export const emptyDisputeDraft = (): DisputeDraft => ({reason: '', category: 'quality', pending: null, body: null});
const key = (scope: DisputeDraftScope) => DISPUTE_DRAFT_PREFIX + [scope.ownerId, scope.kind, scope.id].map(encodeURIComponent).join(':');
const storage = () => window.sessionStorage;

export function readDisputeDraft(scope: DisputeDraftScope): {draft: DisputeDraft; available: boolean} {
  try {
    const raw = storage().getItem(key(scope));
    if (!raw) return {draft: emptyDisputeDraft(), available: true};
    const value = JSON.parse(raw);
    if (value?.ownerId !== scope.ownerId || value?.kind !== scope.kind || value?.id !== scope.id ||
        typeof value.reason !== 'string' || value.reason.length > 2000 ||
        !['quality', 'price', 'behavior', 'other'].includes(value.category) ||
        ![null, 'submit', 'upload'].includes(value.pending) ||
        !(value.body === null || typeof value.body === 'string')) throw new Error('Invalid saved dispute');
    if (value.body !== null) {
      const body = JSON.parse(value.body);
      if (typeof body?.reason !== 'string' || body.reason.length > 2000) throw new Error('Invalid saved submission');
    }
    return {draft: {reason: value.reason, category: value.category, pending: value.pending, body: value.body}, available: true};
  } catch { return {draft: emptyDisputeDraft(), available: false}; }
}

export function saveDisputeDraft(scope: DisputeDraftScope, draft: DisputeDraft): boolean {
  try { storage().setItem(key(scope), JSON.stringify({...scope, ...draft})); return true; } catch { return false; }
}
export function removeDisputeDraft(scope: DisputeDraftScope): boolean {
  try { storage().removeItem(key(scope)); return true; } catch { return false; }
}
export function clearDesktopDisputeDrafts(): void {
  try {
    const target = storage();
    for (let index = target.length - 1; index >= 0; index--) {
      const name = target.key(index);
      if (name?.startsWith(DISPUTE_DRAFT_PREFIX)) target.removeItem(name);
    }
  } catch { /* Storage can be unavailable. */ }
}
