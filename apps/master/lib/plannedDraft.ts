export interface PlannedDraft { price: string; term: string; comment: string }
export const emptyPlannedDraft = (): PlannedDraft => ({ price: '', term: '', comment: '' });
export const PLANNED_DRAFT_PREFIX = 'mq.master.planned.bid.v1:';
export const plannedDraftKey = (ownerId: string, orderId: string) => `${PLANNED_DRAFT_PREFIX}${encodeURIComponent(ownerId)}:${encodeURIComponent(orderId)}`;
export function clearPlannedDrafts(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>): void {
  try {
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key?.startsWith(PLANNED_DRAFT_PREFIX)) storage.removeItem(key);
    }
  } catch { /* Logout must still finish when storage is inaccessible. */ }
}
// sessionStorage scopes drafts to this browser tab. Never submit restored drafts automatically.
export function readPlannedDraft(storage: Pick<Storage, 'getItem'>, ownerId: string, orderId: string): PlannedDraft {
  try { const raw = JSON.parse(storage.getItem(plannedDraftKey(ownerId, orderId)) ?? 'null');
    if (raw && typeof raw.price === 'string' && typeof raw.term === 'string' && typeof raw.comment === 'string')
      return { price: raw.price.slice(0, 20), term: raw.term.slice(0, 200), comment: raw.comment.slice(0, 1000) };
  } catch { /* A blocked or corrupt store must not prevent bidding. */ }
  return emptyPlannedDraft();
}
export function writePlannedDraft(storage: Pick<Storage, 'setItem'>, ownerId: string, orderId: string, draft: PlannedDraft): boolean {
  try { storage.setItem(plannedDraftKey(ownerId, orderId), JSON.stringify(draft)); return true; } catch { return false; }
}
