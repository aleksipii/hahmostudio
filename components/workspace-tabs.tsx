import type {Workspace} from '../lib/workspace';
export default function WorkspaceTabs({workspace,change}:{workspace:Workspace;change:(next:Workspace)=>void}){
 return <nav className="workspace-tabs" aria-label="Työtila">{([['character','Hahmo'],['performance','Esitys'],['animation','Animointi']] as const).map(([id,label])=><button key={id} aria-pressed={workspace===id} className={workspace===id?'active':''} onClick={()=>change(id)}>{label}</button>)}</nav>;
}
