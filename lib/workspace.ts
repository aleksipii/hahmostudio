export type Workspace='character'|'performance'|'animation';
export type WorkspaceView={workspace:Workspace;inspector:'selection'|'scene'|'motion'|'camera';libraryTab:'layers'|'episodes'|'library'|'script'};
/** View-only transition: document, selection, transport and device state stay outside. */
export function workspaceView(workspace:Workspace):WorkspaceView{
 return {workspace,inspector:workspace==='character'?'selection':workspace==='performance'?'scene':'motion',libraryTab:workspace==='animation'?'script':workspace==='performance'?'library':'layers'};
}
export type Theme='system'|'light'|'dark';
export function readTheme(value:string|null):Theme{return value==='light'||value==='dark'?value:'system';}
