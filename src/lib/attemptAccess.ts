const prefix='inner-code:attempt:';
const memory=new Map<string,{token:string;createdAt:number}>();
const maxAge=7*24*60*60*1000;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function attemptAccess(slug:string,reset=false) {
  let saved=memory.get(slug);
  if(!reset){
    try{
      const raw=localStorage.getItem(prefix+slug);
      if(raw){const value=JSON.parse(raw);if(uuid.test(value?.token)&&Number.isFinite(value.createdAt))saved=value;}
    }catch{/* A storage-blocked tab can still finish the in-memory attempt. */}
  }
  if(reset||!saved||Date.now()-saved.createdAt>maxAge||saved.createdAt>Date.now()+60000){
    saved={token:crypto.randomUUID(),createdAt:Date.now()};
  }
  memory.set(slug,saved);
  let persisted=false;
  try{localStorage.setItem(prefix+slug,JSON.stringify(saved));persisted=true;}catch{/* UI explains reload recovery is unavailable. */}
  return {...saved,persisted};
}

export function clearAttemptAccess(slug:string){
  memory.delete(slug);try{localStorage.removeItem(prefix+slug);}catch{/* optional storage */}
}
