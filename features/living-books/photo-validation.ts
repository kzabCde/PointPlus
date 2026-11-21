import {photoMaxBytes,supportedPhotoMime} from './stamp-model'

export type PhotoInfo={mime:'image/png'|'image/jpeg'|'image/webp';width:number;height:number}
const u16=(bytes:Uint8Array,offset:number)=>((bytes[offset]<<8)|bytes[offset+1])
const u32=(b:Uint8Array,i:number)=>(b[i]*0x1000000+b[i+1]*65536+b[i+2]*256+b[i+3])
const ascii=(b:Uint8Array,i:number,len:number)=>
  String.fromCharCode(...b.slice(i,i+len))
export function inspectPhoto(bytes:Uint8Array,mime:string):PhotoInfo|null{
  if(bytes.length<30||bytes.length>photoMaxBytes||!supportedPhotoMime.includes(mime as PhotoInfo['mime']))
    return null
  let width=0,height=0
  if(mime==='image/png'){
    if(ascii(bytes,1,3)!=='PNG'||bytes[0]!==137||bytes[4]!==13||
      ascii(bytes,12,4)!=='IHDR')return null
    width=u32(bytes,16);height=u32(bytes,20)
    // APNG is deliberately rejected for predictable static scrapbook behavior.
    for(let i=24;i+3<bytes.length;i++){
      if(bytes[i]===97&&bytes[i+1]===99&&bytes[i+2]===84&&bytes[i+3]===76)
        return null
    }
  }else if(mime==='image/jpeg'){
    if(bytes[0]!==255||bytes[1]!==216)return null
    let i=2
    while(i+9<bytes.length){
      if(bytes[i]!==255){i++;continue}
      const marker=bytes[i+1]
      if(marker===0xDA||marker===0xD9)break
      if(marker===0xD8||marker===0x01||(marker>=0xD0&&marker<=0xD7)){i+=2;continue}
      const len=u16(bytes,i+2)
      if(len<2||i+2+len>bytes.length)break
      if([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB].includes(marker)){
        height=u16(bytes,i+5);width=u16(bytes,i+7);break
      }
      i+=2+len
    }
  }else{
    if(ascii(bytes,0,4)!=='RIFF'||ascii(bytes,8,4)!=='WEBP')return null
    const kind=ascii(bytes,12,4)
    if(kind==='VP8X'){
      if(bytes[20]&0x02)return null // animated WebP
      width=(bytes[24]|(bytes[25]<<8)|(bytes[26]<<16))+1
      height=(bytes[27]|(bytes[28]<<8)|(bytes[29]<<16))+1
    }else if(kind==='VP8 '){
      if(bytes.length<30||bytes[23]!==0x9d||bytes[24]!==0x01||bytes[25]!==0x2a)return null
      width=(bytes[26]|bytes[27]<<8)&0x3fff
      height=(bytes[28]|bytes[29]<<8)&0x3fff
    }else if(kind==='VP8L'){
      if(bytes.length<25||bytes[20]!==0x2f)return null
      width=(bytes[21]|((bytes[22]&0x3f)<<8))+1
      height=((bytes[22]>>6)|(bytes[23]<<2)|((bytes[24]&0x0f)<<10))+1
    }else return null
  }
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    width<1||height<1||width>8192||height>8192)return null
  return {mime:mime as PhotoInfo['mime'],width,height}
}
