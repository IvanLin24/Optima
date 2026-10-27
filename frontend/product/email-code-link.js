// AI: parse only. An email link must never perform a verification request on page load.
export function parseEmailCodeLink(hash){
  if(!hash.startsWith('#email-code?')||hash.length>1800)return null;
  const params=new URLSearchParams(hash.slice('#email-code?'.length));
  const email=params.get('email')||'',challenge=params.get('challenge')||'',code=params.get('code')||'';
  if(email.length>320||!/^\S+@\S+\.\S+$/.test(email)||!/^\d{6}$/.test(code)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(challenge))return null;
  return {email,challenge_id:challenge,code};
}
