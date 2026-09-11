"use strict";
const vm = require("node:vm"), fs = require("node:fs"), assert = require("node:assert/strict");
let receive, poll, active = [], replies = [];
const parent = {postMessage: data => replies.push(data)};
class MarkerSet { constructor(id,data){this.id=id;this.data=data;} dispose(){this.disposed=true;} }
const window = {parent, addEventListener:(type,fn)=>{if(type==="message")receive=fn;},
    BlueMap:{MarkerSet},bluemap:{mapViewer:{map:{data:{id:"world"}},markers:{add:x=>active.push(x),remove:x=>{active=active.filter(y=>y!==x);}}}}};
vm.runInNewContext(fs.readFileSync(require.resolve("./bluemap-bridge.js"),"utf8"),{window,setInterval:fn=>{poll=fn;}});
const send = (type, data={}, origin="http://127.0.0.1:8765", source=parent) => receive({origin,source,data:{protocol:"warium-bluemap-v1",channel:"test",type,...data}});
send("hello",{},"https://attacker.example"); assert.equal(replies.length,0);
send("hello",{},undefined,{}); assert.equal(replies.length,0);
send("hello"); assert.equal(replies.at(-1).type,"ready");
const markerSet={markers:{a:{type:"line",line:[{x:0,y:64,z:0},{x:10,y:70,z:10}],lineColor:{r:155,g:218,b:85,a:1}}}};
send("solution",{mapId:"world",markerSet}); assert.equal(active.length,1); assert.equal(replies.at(-1).type,"drawn");
send("solution",{mapId:"world",markerSet}); assert.equal(active.length,1,"Replace, do not accumulate markers");
send("solution",{mapId:"world",channel:"wrong",markerSet}); assert.equal(active.length,1);
send("solution",{mapId:"nether",markerSet}); assert.equal(active.length,0); assert.equal(replies.at(-1).type,"error");
send("solution",{mapId:"world",markerSet}); window.bluemap.mapViewer.map.data.id="nether"; poll(); assert.equal(active.length,0);
window.bluemap.mapViewer.map.data.id="world";
send("solution",{mapId:"world",markerSet:{markers:{x:{type:"html",html:"bad"}}}});assert.equal(active.length,0);
send("solution",{mapId:"world",markerSet});send("clear");assert.equal(active.length,0);
console.log("Bridge tests passed: origin/source/token checks, replacement, map changes, schema and clear.");
