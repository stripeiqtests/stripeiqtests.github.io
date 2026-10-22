const formats:Record<string,{extension:string;matches:(bytes:Uint8Array)=>boolean}>={
  'image/png':{extension:'png',matches:b=>[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)},
  'image/jpeg':{extension:'jpg',matches:b=>b[0]===255&&b[1]===216&&b[2]===255},
  'image/gif':{extension:'gif',matches:b=>['GIF87a','GIF89a'].includes(new TextDecoder().decode(b.slice(0,6)))},
  'image/webp':{extension:'webp',matches:b=>new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP'},
};
export class ImageValidationError extends Error {
  code:'format'|'size'|'decode'|'dimensions';
  constructor(code:ImageValidationError['code']){super(code);this.code=code;}
}
export async function validateQuestionImage(file:File) {
  const format=formats[file.type];
  if(!format)throw new ImageValidationError('format');
  if(file.size===0||file.size>5*1024*1024)throw new ImageValidationError('size');
  const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
  if(!format.matches(bytes))throw new ImageValidationError('format');
  let width:number,height:number;
  try {
    if(typeof createImageBitmap==='function'){
      const bitmap=await createImageBitmap(file);width=bitmap.width;height=bitmap.height;bitmap.close();
    }else{
      const url=URL.createObjectURL(file);
      try{
        const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
          const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;
        });width=image.naturalWidth;height=image.naturalHeight;
      }finally{URL.revokeObjectURL(url);}
    }
  }catch{throw new ImageValidationError('decode');}
  if(!width||!height||width>8000||height>8000||width*height>40000000)throw new ImageValidationError('dimensions');
  // Keep the original bytes, including animation and fine puzzle details.
  return {extension:format.extension,contentType:file.type};
}
