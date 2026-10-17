'use client';
import {formatServiceDate} from '@masterqala/ui';
import {masterCategoryName} from '@/lib/category-name';
import { Button, TextField, useLocale } from '@masterqala/ui';
import Link from 'next/link';

import { useAuth } from '@/lib/auth';
import { useMasterApplicationController } from '@/lib/useMasterApplicationController';
import { masterSurfaceText } from '@/lib/masterSurfaceCopy';
import { masterDesignCopy } from '@/lib/masterDesignCopy';
import type { ApplicationDocument } from '@/lib/masterApplication';
export default function BecomeMasterPage() {
    const { user } = useAuth(), { language } = useLocale();
    return user ? <ApplicationSession key={user.id} ownerId={user.id}/> : <div className="mq-master-dashboard"><p role="status">{masterSurfaceText(language, 'loading')}</p></div>;
}
function ApplicationSession({ ownerId }: {
    ownerId: string;
}) {
    const { language } = useLocale(), controller = useMasterApplicationController({ ownerId });
    const copy = (key: Parameters<typeof masterSurfaceText>[1]) => masterSurfaceText(language, key);
    const { application, categories, form, categoryIds, showForm, canEdit, canUpload, canSubmit, busy, error, files } = controller;
    const app = application.data;
    const security = (document: ApplicationDocument) => ({ PENDING_SCAN: 'securityPending', SCANNING: 'securityScanning', CLEAN: 'securityClean', INFECTED: 'securityInfected', SCAN_FAILED: 'securityFailed' } as const)[document.scanStatus!] ?? 'securityUnknown';
    const cdr = (document: ApplicationDocument) => ({ NOT_REQUIRED: 'cdrNotRequired', PENDING: 'cdrPending', SANITIZED: 'cdrSanitized', BYPASSED: 'cdrBypassed', CDR_FAILED: 'cdrFailed' } as const)[document.cdrStatus!] ?? 'cdrUnknown';
    const readError = application.error || categories.error;
    const date = app?.blockedUntil ? Date.parse(app.blockedUntil) : NaN;
    const editable = !app || app.status === 'NEEDS_INFO' || app.status === 'REJECTED';
    if(app?.status==='ACTIVE'){
      const c=masterDesignCopy(language);
      return <div className="mq-master-dashboard mq-master-current-page" data-master-active-profile>
        <p className="mq-master-current-page__status">{c.profilePilot}</p><h1>{c.verified}</h1><p className="mq-master-current-page__intro">{c.profileIntro} · {copy('ACTIVE')}</p>
        {readError&&<div role="alert" className="mq-master-read-warning"><p>{copy('stale')}</p><p>{readError}</p></div>}{error&&<p role="alert">{error}</p>}
        {Number.isFinite(date)&&date>Date.now()&&<p>{copy('blocked')} {formatServiceDate(new Date(date),language,{day:'numeric',month:'long',year:'numeric'})}</p>}
        <div className="mq-master-current-grid"><div className="mq-master-current-stack"><section className="mq-master-card"><h2>{app.fullName}</h2><p>{copy('specialty')}: {app.categories.length?app.categories.map(item=>masterCategoryName(item.category,language)).join(', '):copy('unavailable')}<br/>{copy('district')}: {app.district||copy('unavailable')}<br/>{copy('experienceYears')}: {app.experienceYears}</p></section>
          <nav className="mq-master-current-actions" aria-label={c.workspace}><Link className="mq-master-finance__action" href="/history">{c.orders}</Link><Link className="mq-master-finance__action" href="/wallet">{c.wallet}</Link><Button disabled aria-describedby="master-active-readonly">{c.edit}</Button></nav>
          <details id="master-documents" className="mq-master-card mq-master-document-details"><summary>{c.documents}</summary><p>{copy('uploadHelp')}</p>{app.documents.map(document=><div key={document.id}><h3>{document.type==='ID_CARD'?copy('ID_CARD'):document.type==='QUALIFICATION'?copy('QUALIFICATION'):document.type}</h3><p>{document.originalName}</p><p>{copy(security(document))}</p><p>{copy(cdr(document))}</p></div>)}</details>
          <Link className="mq-master-secondary-action" href="/">{copy('backWork')}</Link><Button variant="secondary" data-refresh-application disabled={!!busy||application.loading||categories.loading} onClick={controller.refresh}>{copy('refreshApplication')}</Button>
        </div><aside className="mq-master-current-stack"><section className="mq-master-card"><h2>{c.editTitle}</h2><p id="master-active-readonly">{copy('readOnlyActive')}</p></section><section className="mq-master-card"><h2>{c.protected}</h2><p>{c.protectedBody}</p></section></aside></div>
      </div>;
    }
    return <div className="mq-master-dashboard mq-master-application"><header><Link href="/">{copy('backWork')}</Link><h1>{copy('application')}</h1><Button variant="secondary" data-refresh-application disabled={!!busy || application.loading || categories.loading} onClick={controller.refresh}>{copy('refreshApplication')}</Button></header>
  {readError && <div role="alert" className="mq-master-read-warning"><p>{app || showForm ? copy('stale') : null}</p><p>{readError}</p></div>}
  {error && <p role="alert" className="mq-master-read-warning">{error}</p>}
  {controller.draftRestored&&<p role="status">{{ru:'Черновик восстановлен в этой вкладке. Проверьте данные перед отправкой.',kk:'Осы қойындыдағы жоба қалпына келтірілді. Жібермес бұрын деректерді тексеріңіз.',en:'The draft was restored in this tab. Check the details before submitting.'}[language]}</p>}
  {controller.submissionUncertain&&<p role="status">{{ru:'Проверяем результат предыдущей отправки. Не отправляйте заявку повторно до обновления.',kk:'Алдыңғы жіберу нәтижесі тексерілуде. Жаңартылғанша өтінімді қайталамаңыз.',en:'Checking the previous submission. Wait for refreshed data before trying again.'}[language]}</p>}
  {application.loading && !app && !showForm ? <p role="status">{copy('loading')}</p> : null}
  {Number.isFinite(date) && date > Date.now() && <p>{copy('blocked')} {formatServiceDate(new Date(date),language,{day:'numeric',month:'long',year:'numeric'})}</p>}
  {app && <section className="mq-master-card"><h2>{copy(app.status)}</h2><dl><div><dt>{copy('fullName')}</dt><dd>{app.fullName}</dd></div><div><dt>{copy('district')}</dt><dd>{app.district || copy('unavailable')}</dd></div><div><dt>{copy('experienceYears')}</dt><dd>{app.experienceYears}</dd></div><div><dt>{copy('specialty')}</dt><dd>{app.categories.length ? app.categories.map(item => masterCategoryName(item.category,language)).join(', ') : copy('unavailable')}</dd></div></dl>{app.status === 'NEEDS_INFO' && app.latestDecisionComment && <p>{copy('additional')}: {app.latestDecisionComment}</p>}{app.status === 'REJECTED' && app.rejectionReason && <p>{copy('decision')}: {app.rejectionReason}</p>}{canEdit && !controller.editing && <Button variant="accent" data-edit-application disabled={!!busy} onClick={controller.edit}>{copy('editApplication')}</Button>}</section>}
  {showForm && <form className="mq-master-card" onSubmit={event => { event.preventDefault(); void controller.submit(); }}><fieldset className="mq-master-application__fields" disabled={!!busy || !editable || !application.fresh}>
   <TextField label={copy('fullName')} name="fullName" value={form.fullName} variant="responsive" fullWidth required minLength={5} maxLength={150} autoComplete="name" onChange={event => controller.changeField('fullName', event.target.value)}/>
   <TextField label={copy('iin')} helper={copy('iinHelp')} name="iin" value={form.iin} variant="responsive" fullWidth required inputMode="numeric" pattern="[0-9]{12}" minLength={12} maxLength={12} autoComplete="off" onChange={event => controller.changeField('iin', event.target.value)}/>
   <TextField label={copy('district')} name="district" value={form.district} variant="responsive" fullWidth required minLength={2} maxLength={100} onChange={event => controller.changeField('district', event.target.value)}/>
   <TextField label={copy('experienceYears')} name="experienceYears" type="number" value={form.experienceYears} variant="responsive" fullWidth required min={0} max={60} step={1} onChange={event => controller.changeField('experienceYears', Number(event.target.value))}/>
   <fieldset className="mq-master-application__categories"><legend>{copy('categories')}</legend>{categories.data?.map(category => <label key={category.id}><input type="checkbox" checked={categoryIds.includes(category.id)} onChange={event => controller.changeCategory(category.id, event.target.checked)}/>{masterCategoryName(category,language)}</label>)}</fieldset>
  </fieldset><p className="mq-master-muted">{copy('submitFlowNote')}</p>{!application.fresh && <p>{copy('staleForm')}</p>}{editable && <Button type="submit" variant="accent" className="mq-master-action" loading={busy === 'submit'} loadingLabel={copy('saving')} disabled={!canSubmit}>{copy('sendReview')}</Button>}{controller.editing && <Button variant="secondary" data-cancel-application disabled={!!busy} onClick={controller.cancel}>{copy('cancelEdit')}</Button>}</form>}
  {app && <section className="mq-master-card"><h2>{copy('documents')}</h2><p className="mq-master-muted">{copy('uploadHelp')}</p>{(['ID_CARD', 'QUALIFICATION'] as const).map(type => <div key={type} className="mq-master-application__document"><h3>{copy(type)}</h3>{app.documents.filter(document => document.type === type).map(document => <div key={document.id}><p>{document.originalName}</p><p>{copy(security(document))}</p><p>{copy(cdr(document))}</p></div>)}{canUpload && <><label htmlFor={`master-document-${type}`}>{copy(type)}</label><input id={`master-document-${type}`} type="file" accept="image/jpeg,image/png,application/pdf" disabled={!!busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file)
        void controller.uploadFile(type, file); }}/></>}{busy === 'upload:' + type && <p role="status">{copy('uploading')}</p>}{files[type] && busy !== 'upload:' + type && <div><p>{files[type].name}</p><p className="mq-master-muted">{copy('retryUploadWarning')}</p><Button variant="secondary" disabled={!!busy || !canUpload} onClick={() => void controller.uploadFile(type, files[type]!)}>{copy('retryUpload')}</Button></div>}</div>)}</section>}

 </div>;
}
