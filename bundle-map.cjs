const fs=require('fs'),path=require('path');
require('esbuild').buildSync({stdin:{contents:"import {LogicFlow,RectNode,RectNodeModel,DiamondNode,DiamondNodeModel} from '@logicflow/core'; import Anchor from '@logicflow/core/es/view/Anchor'; import {h} from 'preact'; window.TPlanLogicFlow=LogicFlow; window.TPlanFlowShapes={RectNode,RectNodeModel,DiamondNode,DiamondNodeModel,Anchor,h};",resolveDir:__dirname},bundle:true,minify:true,format:'iife',outfile:'logicflow-vendor.js',legalComments:'eof'});
fs.writeFileSync('logicflow-vendor.css',fs.readFileSync('node_modules/@logicflow/core/dist/index.css','utf8').replace(':focus{outline:none}', '.lf-graph :focus{outline:none}'));
fs.mkdirSync('assets/licenses',{recursive:true});
let notices='T计划 includes locally bundled @logicflow/core 2.2.5 (Apache-2.0) and dependencies. JavaScript unmodified, bundled with esbuild. CSS modification: scope the global :focus reset to .lf-graph to preserve host keyboard focus indicators.\n';
for(const name of ['@logicflow/core','mobx','uuid','preact','lodash-es','mousetrap','classnames','mobx-utils','mobx-preact']){
 const dir=path.join('node_modules',name),p=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
 notices+='\n\n===== '+name+' '+p.version+' ('+p.license+') =====\n';
 for(const file of fs.readdirSync(dir).filter(f=>/^(license|licence|notice|copying)(\.|$)/i.test(f)))notices+=fs.readFileSync(path.join(dir,file),'utf8')+'\n';
}
fs.writeFileSync('assets/licenses/LogicFlow-and-dependencies.txt',notices);
