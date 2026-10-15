'use client';
import type {ComponentProps} from 'react';
import {useTranslation} from 'react-i18next';
import {AddressEditor as SharedAddressEditor,AddressDetails as SharedAddressDetails} from '@masterqala/ui';
export type {AddressFormValue} from '@masterqala/ui';
export function AddressEditor(props: Omit<ComponentProps<typeof SharedAddressEditor>, 't'>) {
 const {t}=useTranslation();
 return <SharedAddressEditor {...props} t={key=>t(key)} />;
}
export function AddressDetails(props: Omit<ComponentProps<typeof SharedAddressDetails>, 't'>) {
 const {t}=useTranslation();
 return <SharedAddressDetails {...props} t={key=>t(key)} />;
}
