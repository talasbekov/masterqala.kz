import {MasterView} from '../../components/PublicInfo';import {getMasterAppUrl} from '../../lib/env';
export default function MasterPage(){return <MasterView masterUrl={getMasterAppUrl()}/>}
