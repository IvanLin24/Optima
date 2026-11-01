// One navigation at a time; rapid route changes keep only the latest destination.
export function createWorkspaceTransition({getTargets,after=()=>{},reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches!==false}){
 let running=false,next=null;
 async function fade(targets,entering,role){
  if(reduced())return;
  await Promise.all(targets.filter(el=>el?.isConnected&&el.animate).map(el=>{
   const offset=role?`translateX(${Number(role)*12}px)`:'translateY(6px)';
   const exit=role?`translateX(${-Number(role)*8}px)`:'translateY(-4px)';
   const frames=entering?[{opacity:0,transform:offset},{opacity:1,transform:'translate(0)'}]:[{opacity:1,transform:'translate(0)'},{opacity:0,transform:exit}];
   const animation=el.animate(frames,{duration:entering?260:110,easing:'cubic-bezier(.22,.75,.2,1)',fill:entering?'none':'forwards'});
   return animation.finished.catch(()=>{}).finally(()=>animation.cancel());
  }));
 }
 async function drain(job){
  running=true;
  while(job){
   const targets=getTargets(job.role);targets.forEach(el=>{if(el)el.inert=true;});
   try{
    await fade(targets,false,job.role);
    if(next){job.resolve(false);job=next;next=null;}
    job.commit();
    targets.forEach(el=>{if(el?.isConnected)el.inert=false;});
    await fade(getTargets(job.role),true,job.role);
    if(!next)after();
    job.resolve(true);
   }catch(error){job.reject(error);}
   finally{targets.forEach(el=>{if(el?.isConnected)el.inert=false;});}
   job=next;next=null;
  }
  running=false;
 }
 return {busy:()=>running,navigate(commit,{role=false}={}){return new Promise((resolve,reject)=>{
  const job={commit,role,resolve,reject};
  if(running){next?.resolve(false);next=job;}else void drain(job);
 });}};
}
