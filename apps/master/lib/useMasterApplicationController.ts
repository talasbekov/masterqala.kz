'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useOwnedAccountResource, type AccountApi } from '@masterqala/ui';
import { api as defaultApi, ApiError } from './api';
import { uploadApplicationDocument, type Application, type ApplicationFormValues, type Category } from './masterApplication';
import {masterApplicationDraftStore} from './master-application-draft';
type Form = Omit<ApplicationFormValues, 'categoryIds'>;
type DocumentType = 'ID_CARD' | 'QUALIFICATION';
const blank = (): Form => ({ fullName: '', iin: '', district: '', experienceYears: 0 });
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function parseApplication(value: unknown): Application {
    if (!record(value) || typeof value.id !== 'string' || !value.id || typeof value.fullName !== 'string' || !value.fullName || typeof value.iin !== 'string' || typeof value.district !== 'string' || typeof value.experienceYears !== 'number' || !Number.isFinite(value.experienceYears) || !['PENDING_REVIEW', 'NEEDS_INFO', 'ACTIVE', 'REJECTED'].includes(String(value.status)) || !Array.isArray(value.categories) || !value.categories.every(item => record(item) && record(item.category) && typeof item.category.id === 'string' && typeof item.category.name === 'string') || !Array.isArray(value.documents) || !value.documents.every(item => record(item) && typeof item.id === 'string' && typeof item.type === 'string' && typeof item.originalName === 'string'))
        throw new Error('Invalid application response');
    return value as unknown as Application;
}
function parseCategories(value: unknown): Category[] {
    if (!Array.isArray(value) || !value.every(item => record(item) && typeof item.id === 'string' && !!item.id && typeof item.name === 'string'))
        throw new Error('Invalid categories response');
    return value as Category[];
}
const editableStatus = (value: Application | null) => !value || value.status === 'NEEDS_INFO' || value.status === 'REJECTED';
/** Current DTO constraints only; the server remains authoritative. */
function validForm(form: Form, categoryIds: string[]) { return typeof form.fullName === 'string' && form.fullName.length >= 5 && form.fullName.length <= 150 && typeof form.iin === 'string' && /^\d{12}$/.test(form.iin) && typeof form.district === 'string' && form.district.length >= 2 && form.district.length <= 100 && Number.isInteger(form.experienceYears) && form.experienceYears >= 0 && form.experienceYears <= 60 && categoryIds.length > 0 && categoryIds.every(id => typeof id === 'string' && !!id) && new Set(categoryIds).size === categoryIds.length; }
export function useMasterApplicationController({ ownerId, api = defaultApi, upload = uploadApplicationDocument }: {
    ownerId: string | null;
    api?: AccountApi;
    upload?: typeof uploadApplicationDocument;
}) {
    const applicationApi = useCallback(async (path: string) => { try {
        return parseApplication(await api(path));
    }
    catch (error) {
        if (error instanceof ApiError && error.status === 404)
            return null;
        throw error;
    } }, [api]);
    const categoriesApi = useCallback(async (path: string) => parseCategories(await api(path)), [api]);
    const application = useOwnedAccountResource<Application | null>({ ownerId, path: '/masters/application', api: applicationApi });
    const categories = useOwnedAccountResource<Category[]>({ ownerId, path: '/categories', api: categoriesApi });
    const ownership = useMemo(() => ({ ownerId }), [ownerId]), current = useRef(ownership), live = useRef(false), writeGeneration = useRef(0), editorRevision = useRef(0), lock = useRef(false), abort = useRef<AbortController | null>(null);
    const [form, setForm] = useState<Form>(blank), [categoryIds, setCategoryIds] = useState<string[]>([]), [editing, setEditing] = useState(false), [busy, setBusy] = useState<string | null>(null), [error, setError] = useState(''), [writeNeedsRefresh, setWriteNeedsRefresh] = useState(false), [files, setFiles] = useState<Partial<Record<DocumentType, File>>>({});
    const values = useRef(form), selected = useRef(categoryIds), dirty = useRef(false);
    const pendingSubmit = useRef(false), editingValue = useRef(false);
    const [draftRestored, setDraftRestored] = useState(false), [submissionUncertain, setSubmissionUncertain] = useState(false);
    const verified = useRef({ generation: application.generation, fresh: application.fresh });
    useLayoutEffect(() => {
        current.current = ownership; live.current = true; writeGeneration.current++; editorRevision.current++; lock.current = false; abort.current?.abort(); abort.current = null;
        const saved = ownerId ? masterApplicationDraftStore.load(ownerId) : null;
        dirty.current = !!saved; values.current = saved?.form ?? blank(); selected.current = saved?.categoryIds ?? []; editingValue.current = saved?.editing ?? false; pendingSubmit.current = saved?.pendingSubmit ?? false;
        setForm(values.current); setCategoryIds(selected.current); setEditing(editingValue.current); setBusy(null); setError(''); setWriteNeedsRefresh(pendingSubmit.current); setSubmissionUncertain(pendingSubmit.current); setDraftRestored(!!saved); setFiles({});
        return () => { live.current = false; writeGeneration.current++; editorRevision.current++; abort.current?.abort(); };
    }, [ownership]);
    useLayoutEffect(() => { verified.current = { generation: application.generation, fresh: application.fresh }; }, [application.generation, application.fresh]);
    const owned = () => !!ownerId && live.current && current.current === ownership;
    const persist = () => { if (owned()) masterApplicationDraftStore.save(ownerId!, {form: values.current, categoryIds: selected.current, editing: editingValue.current, pendingSubmit: pendingSubmit.current}); };
    const clearDraft = () => { if (owned()) masterApplicationDraftStore.clear(ownerId!); pendingSubmit.current = false; setSubmissionUncertain(false); setDraftRestored(false); };
    const dataLifetime = useMemo(() => ({data: application.data, generation: application.generation}), [application.data, application.generation]);
    const currentDataLifetime = useRef(dataLifetime);
    useLayoutEffect(() => {currentDataLifetime.current = dataLifetime;}, [dataLifetime]);
    const capturedEditor = editorRevision.current;
    const editorCurrent = () => editorRevision.current === capturedEditor;
    const capturedRead = application.generation;
    const fresh = () => owned() && currentDataLifetime.current === dataLifetime && verified.current.fresh && verified.current.generation === capturedRead;
    const restore = (value: Application | null) => { const next = value ? { fullName: value.fullName, iin: value.iin, district: value.district, experienceYears: value.experienceYears } : blank(); values.current = next; selected.current = value ? value.categories.map(item => item.category.id) : []; setForm(next); setCategoryIds(selected.current); };
    useEffect(() => {
        if (!application.fresh || !owned()) return;
        if (!editableStatus(application.data)) {
            clearDraft(); dirty.current = false; editingValue.current = false; setEditing(false); restore(application.data); return;
        }
        // A fresh owner-scoped GET reconciles an interrupted POST. Only the user
        // can submit again after this read; a failed GET keeps the marker intact.
        if (pendingSubmit.current) { pendingSubmit.current = false; setSubmissionUncertain(false); persist(); }
        if (!dirty.current && !editing) restore(application.data);
    }, [application.data, application.generation, application.fresh, editing]);
    useEffect(() => { if (application.fresh) {
        setWriteNeedsRefresh(false);
        setError('');
    } }, [application.generation, application.fresh]);
    useEffect(() => {
        if (!owned() || !application.fresh || !categories.fresh || !categories.data || pendingSubmit.current || lock.current) return;
        const available = selected.current.filter(id => categories.data!.some(category => category.id === id));
        if (available.length !== selected.current.length) {
            selected.current = available; setCategoryIds(available);
            if (dirty.current || editingValue.current) persist();
        }
    }, [application.fresh, categories.data, categories.fresh]);
    const showForm = editing || (application.fresh && application.data === null);
    const canEdit = application.fresh && !writeNeedsRefresh && !!application.data && editableStatus(application.data);
    const canUpload = application.fresh && !writeNeedsRefresh && !!application.data && ['PENDING_REVIEW', 'NEEDS_INFO'].includes(application.data.status);
    const knownCategories = (ids: string[]) => !!categories.data && ids.every(id => categories.data!.some(category => category.id === id));
    const canSubmit = application.fresh && !writeNeedsRefresh && !submissionUncertain && categories.fresh && showForm && editableStatus(application.data) && validForm(form, categoryIds) && knownCategories(categoryIds) && !busy;
    function changeField<K extends keyof Form>(key: K, value: Form[K]) { if (!fresh() || !editorCurrent() || lock.current || !showForm || !editableStatus(application.data))
        return; if (!Object.hasOwn(blank(), key)) return; dirty.current = true; values.current = { ...values.current, [key]: value }; setForm(values.current); persist(); setError(''); }
    function changeCategory(id: string, checked: boolean) { if (!fresh() || !editorCurrent() || lock.current || !showForm || !editableStatus(application.data))
        return; if (!categories.fresh || !knownCategories([id])) return; dirty.current = true; selected.current = checked ? [...new Set([...selected.current, id])] : selected.current.filter(value => value !== id); setCategoryIds(selected.current); persist(); setError(''); }
    function edit() { if (!fresh() || !editorCurrent() || lock.current || !canEdit)
        return; writeGeneration.current++; editorRevision.current++; restore(application.data); dirty.current = false; editingValue.current = true; setEditing(true); persist(); setError(''); }
    function cancel() { if (!owned() || !editorCurrent() || lock.current)
        return; writeGeneration.current++; editorRevision.current++; clearDraft(); restore(application.data); dirty.current = false; editingValue.current = false; setEditing(false); setError(''); }
    function refresh() { if (!owned() || lock.current)
        return; verified.current.fresh = false; void application.retry(); void categories.retry(); }
    async function submit() {
        if (!fresh() || !editorCurrent() || lock.current || writeNeedsRefresh || pendingSubmit.current || !categories.fresh || !showForm || !editableStatus(application.data) || !validForm(values.current, selected.current) || !knownCategories(selected.current))
            return;
        const revision = ++writeGeneration.current, read = capturedRead, controller = new AbortController();
        abort.current = controller;
        lock.current = true;
        pendingSubmit.current = true;
        persist();
        setBusy('submit');
        setError('');
        const valid = () => owned() && writeGeneration.current === revision && verified.current.generation === read && verified.current.fresh && !controller.signal.aborted;
        try {
            const result = parseApplication(await api('/masters/application', { method: 'POST', body: JSON.stringify({ ...values.current, categoryIds: selected.current }), signal: controller.signal }));
            if (!valid())
                return;
            editorRevision.current++;
            clearDraft();
            application.replaceData(result);
            dirty.current = false;
            restore(result);
            editingValue.current = false;
            setEditing(false);
        }
        catch (cause) {
            if (valid() && !(cause instanceof Error && cause.name === 'AbortError')) {
                setError(cause instanceof Error ? cause.message : 'Application update failed');
                verified.current.fresh = false;
                setWriteNeedsRefresh(true);
                setSubmissionUncertain(true);
            }
        }
        finally {
            if (owned() && writeGeneration.current === revision) {
                lock.current = false;
                abort.current = null;
                setBusy(null);
            }
        }
    }
    async function uploadFile(type: DocumentType, file: File) {
        if (!fresh() || lock.current || !canUpload)
            return;
        const revision = ++writeGeneration.current, read = capturedRead, controller = new AbortController();
        abort.current = controller;
        lock.current = true;
        setBusy('upload:' + type);
        setFiles(previous => ({ ...previous, [type]: file }));
        setError('');
        const valid = () => owned() && writeGeneration.current === revision && verified.current.generation === read && verified.current.fresh && !controller.signal.aborted;
        let succeeded = false;
        try {
            await upload(type, file, { signal: controller.signal });
            if (!valid())
                return;
            succeeded = true;
            setFiles(previous => ({ ...previous, [type]: undefined }));
        }
        catch (cause) {
            if (valid() && !(cause instanceof Error && cause.name === 'AbortError')) {
                setError(cause instanceof Error ? cause.message : 'Document upload failed');
                verified.current.fresh = false;
                setWriteNeedsRefresh(true);
            }
        }
        finally {
            if (owned() && writeGeneration.current === revision) {
                lock.current = false;
                abort.current = null;
                setBusy(null);
                if (succeeded) {
                    verified.current.fresh = false;
                    void application.retry();
                }
            }
        }
    }
    return { application: { ...application, fresh: application.fresh && !writeNeedsRefresh }, categories, form, categoryIds, editing, showForm, canEdit, canUpload, canSubmit, busy, error, files, draftRestored, submissionUncertain, changeField, changeCategory, edit, cancel, refresh, submit, uploadFile };
}
