import type {ApplicationFormValues} from './masterApplication';

export const MASTER_APPLICATION_DRAFT_PREFIX = 'mq.master.application-draft.v1:';
export type MasterApplicationDraft = {
    form: Omit<ApplicationFormValues, 'categoryIds'>;
    categoryIds: string[];
    editing: boolean;
    pendingSubmit: boolean;
};
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function validDraft(value: unknown): value is MasterApplicationDraft {
    if (!record(value) || !exactKeys(value, ['form', 'categoryIds', 'editing', 'pendingSubmit']) || !record(value.form)) return false;
    const form = value.form;
    // Partial text is valid draft data, but never relaxes submission DTO checks.
    return exactKeys(form, ['fullName', 'iin', 'district', 'experienceYears'])
        && typeof form.fullName === 'string' && form.fullName.length <= 150
        && typeof form.iin === 'string' && /^\d{0,12}$/.test(form.iin)
        && typeof form.district === 'string' && form.district.length <= 100
        && typeof form.experienceYears === 'number' && Number.isInteger(form.experienceYears) && form.experienceYears >= 0 && form.experienceYears <= 60
        && Array.isArray(value.categoryIds) && value.categoryIds.length <= 1000 && value.categoryIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 500)
        && new Set(value.categoryIds).size === value.categoryIds.length
        && typeof value.editing === 'boolean' && typeof value.pendingSubmit === 'boolean';
}
function storage(): StoragePort | null { try { return typeof window === 'undefined' ? null : window.sessionStorage; } catch { return null; } }
export function createMasterApplicationDraftStore(getStorage: () => StoragePort | null = storage) {
    const key = (ownerId: string) => MASTER_APPLICATION_DRAFT_PREFIX + encodeURIComponent(ownerId);
    return {
        load(ownerId: string): MasterApplicationDraft | null {
            try {
                if (!ownerId) return null;
                const target = getStorage(), raw = target?.getItem(key(ownerId));
                if (!raw) return null;
                const saved: unknown = JSON.parse(raw);
                if (!record(saved) || !exactKeys(saved, ['version', 'ownerId', 'value']) || saved.version !== 1 || saved.ownerId !== ownerId || !validDraft(saved.value)) {
                    target?.removeItem(key(ownerId)); return null;
                }
                return saved.value;
            } catch { return null; }
        },
        save(ownerId: string, value: MasterApplicationDraft): boolean {
            try {
                const target = getStorage();
                if (!ownerId || !target || !validDraft(value)) return false;
                target.setItem(key(ownerId), JSON.stringify({version: 1, ownerId, value})); return true;
            } catch { return false; }
        },
        clear(ownerId?: string): void {
            try {
                const target = getStorage(); if (!target) return;
                if (ownerId) { target.removeItem(key(ownerId)); return; }
                const keys: string[] = [];
                for (let index = 0; index < target.length; index++) { const name = target.key(index); if (name?.startsWith(MASTER_APPLICATION_DRAFT_PREFIX)) keys.push(name); }
                keys.forEach(name => target.removeItem(name));
            } catch { /* Storage can be unavailable without blocking the form. */ }
        },
    };
}
export const masterApplicationDraftStore = createMasterApplicationDraftStore();
export function clearMasterApplicationDrafts() { masterApplicationDraftStore.clear(); }
