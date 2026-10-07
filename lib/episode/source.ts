

/* ───────────────────────── Jaksojako ───────────────────────── */

export type EpisodeSource={index:number;title:string;text:string;firstLine:number};
const episodeHeading=/^(?:#{1,6}\s*)?(?:Jakso|Episode)\s+(\d{1,3})\s*[:.–—-]\s*(.*)$/iu;
/** `---`-rivi tai `Jakso N:` / `Episode N:` -otsikko aloittaa uuden jakson. Rivinumerot säilyvät `firstLine`-siirtymänä. */
export function splitEpisodes(text:string):EpisodeSource[]{
 const lines=text.replace(/\r\n?/g,'\n').split('\n'),out:EpisodeSource[]=[];let start=0,title='';
 const hasContent=(a:number,b:number)=>lines.slice(a,b).some(l=>l.trim()&&!/^-{3,}\s*$/.test(l.trim())&&!/^#(?:\s|$)/.test(l.trim()));
 const preamble=/^(?:(?:Resurssi|Resource)\s|(?:Tunnus\s+)?@|(?:Musiikki|Music|Taustamusiikki|Background music|Pituus|Duration|Sarja|Series|Hahmo|Character)\s*[^:]*:|\/\/)/i;
 const hasBody=(a:number,b:number)=>lines.slice(a,b).some(l=>{const t=l.trim();return t&&!/^-{3,}$/.test(t)&&!/^#(?:\s|$)/.test(t)&&!preamble.test(t);});
 const push=(end:number)=>{if(hasContent(start,end))out.push({index:out.length+1,title:title||'Jakso '+(out.length+1),text:lines.slice(start,end).join('\n'),firstLine:start+1});};
 for(let i=0;i<lines.length;i++){const t=lines[i].trim();
  if(/^-{3,}$/.test(t)){push(i);start=i+1;title='';continue;}
  if(t==='#!kilsat'){if(hasContent(start,i))push(i);start=i;title='';continue;}
  if(/^(?:Jakson nimi|Title)\s*:/i.test(t)&&!title)title=t.slice(t.indexOf(':')+1).trim();
  const m=t.replace(/\*\*/g,'').match(episodeHeading);
  // Pelkät resurssi-/asetusrivit ennen otsikkoa kuuluvat otsikon jaksoon (ei omaa tyhjää jaksoa).
  if(m){if(hasBody(start,i)){push(i);start=i;}title=m[2].trim()||'Jakso '+m[1];}
 }
 push(lines.length);
 if(!out.length)out.push({index:1,title:'Jakso 1',text,firstLine:1});
 return out;
}
