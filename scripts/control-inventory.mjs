// Source inventory is a review checklist, never evidence of behaviour coverage.
import ts from 'typescript';
import {readdir, readFile, mkdir, writeFile} from 'node:fs/promises';
import {join, relative} from 'node:path';
const root=process.cwd(), entries=[];
async function scan(directory){
 for(const item of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,item.name);
  if(item.isDirectory()){await scan(path);continue;}
  if(!path.endsWith('.tsx'))continue;
  const source=await readFile(path,'utf8'), tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node){
   if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
    const tag=node.tagName.getText(tree), attrs=node.attributes.properties;
    const handlers=attrs.filter(a=>ts.isJsxAttribute(a)&&/^on(Click|Change|Input|Submit|Key|Pointer|Mouse|Drag|Drop)/.test(a.name.getText(tree)));
    const role=attrs.find(a=>ts.isJsxAttribute(a)&&a.name.getText(tree)==='role');
    if(['button','input','select','textarea','summary'].includes(tag)||handlers.length||role){
     const p=tree.getLineAndCharacterOfPosition(node.getStart(tree));
     entries.push({file:relative(root,path),line:p.line+1,column:p.character+1,tag,handlers:handlers.map(a=>a.name.getText(tree)),attributes:attrs.filter(a=>ts.isJsxAttribute(a)&&['aria-label','title','role','disabled'].includes(a.name.getText(tree))).map(a=>a.getText(tree)),verification:'unverified'});
    }
   }
   ts.forEachChild(node,visit);
  }
  visit(tree);
 }
}
await scan(join(root,'components'));
const output=process.argv[2]??'docs/tiimi/todennus/audit-20261012/control-inventory.json';
await mkdir(join(root,output,'..'),{recursive:true});
await writeFile(output,JSON.stringify({scope:'Component JSX declaration sites; repeated instances, native menus and runtime conditions require separate checks',behaviourCoverage:false,total:entries.length,buttons:entries.filter(e=>e.tag==='button').length,entries},null,2)+'\n');
console.log(`Inventoried ${entries.length} declaration sites; ${entries.filter(e=>e.tag==='button').length} buttons. All remain unverified by this scan.`);
