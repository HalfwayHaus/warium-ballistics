"use strict";
const test=require("node:test"), assert=require("node:assert/strict"), vm=require("node:vm"), fs=require("node:fs");
function fixture() {
    const replies=[], overlays=new Set();let listener, poll;
    const controls={position:{set(x,y,z){this.x=x;this.y=y;this.z=z;}},distance:0};
    const parent={postMessage:(message,origin)=>replies.push({message,origin})};
    const window={parent,WARIUM_PARENT_ORIGIN:"https://calculator.example",addEventListener:(_type,fn)=>{listener=fn;},
        bluemap:{updateLoop:1,mapViewer:{map:{data:{id:"world"}},controlsManager:controls,markers:{add:m=>overlays.add(m),remove:m=>overlays.delete(m),
            updateMarkerSetsFromData(data={},ignore=[]){for(const m of overlays)if(!ignore.includes(m.id) && !data[m.id])overlays.delete(m);}}}},
        BlueMap:{MarkerSet:class {constructor(id,data){this.id=id;this.data=data;this.markers=new Map(Object.entries(data.markers));}}}};
    vm.runInNewContext(fs.readFileSync(require.resolve("./map-adapter.js"),"utf8"),{window,setInterval:fn=>{poll=fn;}});
    const send=(data,extra={})=>listener({source:parent,origin:window.WARIUM_PARENT_ORIGIN,data:{protocol:"warium-bluemap-v2",channel:"session-token",...data},...extra});
    const solution={type:"solution",mapId:"world",fit:true,markerSet:{markers:{low:{type:"line",line:[{x:10,y:64,z:20},{x:110,y:84,z:20}],lineColor:{r:100,g:220,b:40,a:1}}}}};
    return {window,send,poll,solution,replies,overlays,controls};
}
test("renderer handshake, world coordinates, fit and replace/clear lifecycle",()=>{
    const f=fixture();
    f.window.bluemap.updateLoop=null;f.send({type:"hello"});assert.equal(f.replies.length,0,"wait for initial URL camera setup");
    f.window.bluemap.updateLoop=1;f.send({type:"hello"});
    assert.equal(f.replies.at(-1).message.type,"ready");
    f.send(f.solution);
    assert.equal(f.overlays.size,1);assert.equal(f.replies.at(-1).message.type,"drawn");
    assert.equal(f.replies.at(-1).origin,"https://calculator.example");
    assert.equal(f.controls.position.x,60);assert.equal(f.controls.position.y,74);assert.equal(f.controls.position.z,20);
    assert.ok(f.controls.distance>=100);
    const marker=[...f.overlays][0].data.markers.low;
    assert.equal(marker.line[1].x,110);assert.equal(marker.depthTest,false);
    f.window.bluemap.mapViewer.markers.updateMarkerSetsFromData({},["bm-players"]);
    assert.equal(f.overlays.size,1,"upstream marker polling preserves the temporary overlay");
    f.send(f.solution);assert.equal(f.overlays.size,1,"replacement does not accumulate stale solutions");
    f.send({type:"clear"});assert.equal(f.overlays.size,0);
    f.send(f.solution);f.window.bluemap.mapViewer.map.data.id="nether";f.poll();
    assert.equal(f.overlays.size,0);assert.equal(f.replies.at(-1).message.type,"map-changed");
    f.send(f.solution);assert.equal(f.overlays.size,0);assert.equal(f.replies.at(-1).message.type,"error");
});
test("adapter rejects other windows, origins, tokens and invalid marker data",()=>{
    const f=fixture();
    f.send({type:"hello"},{origin:"https://untrusted.example"});
    f.send({type:"hello"},{source:{}});assert.equal(f.replies.length,0);
    f.send(f.solution);assert.equal(f.overlays.size,0,"handshake required");
    f.send({type:"hello"});
    f.send({...f.solution,channel:"different"});assert.equal(f.overlays.size,0);
    for(const marker of [null,{type:"html",html:"<script>bad</script>"},{type:"line",line:[{x:Infinity,y:1,z:2},{x:1,y:1,z:2}]}])
        f.send({...f.solution,markerSet:{markers:{bad:marker}}});
    assert.equal(f.overlays.size,0);
    const huge=structuredClone(f.solution);huge.markerSet.markers.low.line=Array(100001).fill({x:1,y:2,z:3});f.send(huge);
    assert.equal(f.overlays.size,0);
    f.send(f.solution);assert.equal(f.overlays.size,1,"valid messages still work after rejected data");
});
test("sandbox uses isolated, temporary storage compatible with BlueMap",()=>{
    const {window}=fixture();
    window.localStorage.setItem("value",42);
    assert.equal(window.localStorage.getItem("value"),"42");assert.equal(window.sessionStorage.getItem("value"),null);
    assert.equal(window.localStorage.length,1);assert.equal(window.localStorage.key(0),"value");
    window.localStorage.clear();assert.equal(window.localStorage.length,0);
});
