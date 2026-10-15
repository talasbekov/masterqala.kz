import {AboutView} from '../../components/PublicInfo';import {getAppUrl} from '../../lib/env';
export default function AboutPage(){return <AboutView appUrl={getAppUrl()}/>}
