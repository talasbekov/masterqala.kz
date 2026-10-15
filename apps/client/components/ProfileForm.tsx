'use client';
import type {ComponentProps} from 'react';
import {useTranslation} from 'react-i18next';
import {ProfileForm as SharedProfileForm} from '@masterqala/ui';
export function ProfileForm(props: Omit<ComponentProps<typeof SharedProfileForm>, 't'>) {
 const {t}=useTranslation();
 return <SharedProfileForm {...props} t={key=>t(key)} />;
}
