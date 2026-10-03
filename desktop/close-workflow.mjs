// A cancelled dialog, failed write or edits during saving must keep the work open.
export async function mayClose({dirty,choose,save}){if(!dirty)return true;const decision=await choose();if(decision==='discard')return true;if(decision!=='save')return false;try{return await save()===true;}catch{return false;}}
