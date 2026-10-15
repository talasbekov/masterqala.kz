import {UsersController} from './users.controller';
import {validate} from 'class-validator';
import {UpdateMeDto} from './dto';

describe('User language contract',()=>{
 it('returns the persisted UI language separately from user text',async()=>{
  const controller=new UsersController({masterProfile:{findUnique:async()=>null}} as any);
  const result=await controller.me({id:'user-1',name:'Айгерім',phone:'+77000000000',role:'CLIENT',defaultAddress:'Astana',language:'kk'} as any);
  expect(result).toMatchObject({name:'Айгерім',language:'kk'});
 });
 it('rejects a country code as a UI language',async()=>{
  const dto=Object.assign(new UpdateMeDto(),{language:'KZ'});
  const errors=await validate(dto);
  expect(errors.some(error=>error.property==='language')).toBe(true);
 });
});
