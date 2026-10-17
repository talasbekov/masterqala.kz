import type {DisputeTarget} from '@masterqala/ui';

export const DISPUTE_DRAFT_PREFIX = 'mq.master.dispute.v1:';
export type DisputeDraft = {
  reason: string; statement: string; category: 'quality'|'price'|'behavior'|'other';
  pending: 'submit'|'reply'|'upload'|null; body: string|null; disputeId: string|null;
};
export type DisputeDraftScope = DisputeTarget & {ownerId: string};
export const emptyDisputeDraft = (): DisputeDraft => ({reason:'', statement:'', category:'quality', pending:null, body:null, disputeId:null});
const key = (scope: DisputeDraftScope) => DISPUTE_DRAFT_PREFIX + [scope.ownerId, scope.kind, scope.id].map(encodeURIComponent).join(':');

export function readDisputeDraft(scope: DisputeDraftScope): {draft: DisputeDraft; available: boolean} {
  try {
    const raw = window.sessionStorage.getItem(key(scope));
    if (!raw) return {draft:emptyDisputeDraft(), available:true};
    const value = JSON.parse(raw);
    if (value?.ownerId !== scope.ownerId || value?.kind !== scope.kind || value?.id !== scope.id ||
        typeof value.reason !== 'string' || value.reason.length > 2000 ||
        typeof value.statement !== 'string' || value.statement.length > 2000 ||
        !['quality','price','behavior','other'].includes(value.category) ||
        ![null,'submit','reply','upload'].includes(value.pending) ||
        !(value.body === null || typeof value.body === 'string') ||
        !(value.disputeId === null || typeof value.disputeId === 'string')) throw new Error('Invalid saved dispute');
    if (value.body !== null) {
      const body = JSON.parse(value.body);
      const content = value.disputeId ? body?.counterStatement : body?.reason;
      if (typeof content !== 'string' || content.length > 2000) throw new Error('Invalid saved submission');
    }
    if ((value.pending === 'reply' || value.pending === 'upload') && !value.disputeId) throw new Error('Missing dispute identity');
    return {draft:{reason:value.reason, statement:value.statement, category:value.category, pending:value.pending, body:value.body, disputeId:value.disputeId}, available:true};
  } catch { return {draft:emptyDisputeDraft(), available:false}; }
}
export function saveDisputeDraft(scope: DisputeDraftScope, draft: DisputeDraft): boolean {
  try { window.sessionStorage.setItem(key(scope),JSON.stringify({...scope,...draft})); return true; } catch { return false; }
}
export function removeDisputeDraft(scope: DisputeDraftScope): boolean {
  try { window.sessionStorage.removeItem(key(scope)); return true; } catch { return false; }
}
export function clearMasterDisputeDrafts(): void {
  try {
    const storage = window.sessionStorage;
    for (let index=storage.length-1;index>=0;index--) {
      const name = storage.key(index);
      if (name?.startsWith(DISPUTE_DRAFT_PREFIX)) storage.removeItem(name);
    }
  } catch { /* Storage can be unavailable. */ }
}
