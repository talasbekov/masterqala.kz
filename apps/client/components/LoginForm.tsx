'use client';
import type {ComponentProps} from 'react';
import {useTranslation} from 'react-i18next';
import {LoginForm as SharedLoginForm} from '@masterqala/ui';
export type {LoginPendingAction} from '@masterqala/ui';
export type LoginFormProps=Omit<ComponentProps<typeof SharedLoginForm>,'t'>;
export function LoginForm(props:LoginFormProps){const {t}=useTranslation();return <SharedLoginForm {...props} t={(key,values)=>t(key,values)}/>;}
