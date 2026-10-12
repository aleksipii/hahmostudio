/** Keep elapsed-time updates out of the recording control's accessible name. */
export function dialogueRecorderLabel(mode:'idle'|'loading'|'recording'|'saving'):string {
 switch(mode){
  case 'idle':return 'Äänitä repliikki omalla äänellä';
  case 'loading':return 'Peruuta mikrofonilupa';
  case 'recording':return 'Lopeta ja käytä repliikki';
  case 'saving':return 'Liitetään ääntä…';
 }
}
