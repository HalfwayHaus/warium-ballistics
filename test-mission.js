"use strict";
const assert = require("node:assert/strict");
const B = require("./ballistics"), M = require("./mission");
const origin = {x:-80,y:64,z:35}, target = {x:120,y:64,z:35};
const solve = (profile, extra={}) => M.enrich(B.solveTarget({origin,target,speed:profile.speed,profile,...extra}),profile);
for (const id of Object.keys(B.WEAPONS)) for (const shell of Object.keys(B.WEAPONS[id].shells)) {
    const profile = B.getProfile(id,shell,4,true);
    const r = solve(profile);
    assert.ok(r.solutions.length, `${id}/${shell} fixture reaches target`);
    for (const s of r.solutions) {
        assert.ok(Math.abs(s.residual)<1e-6, `${id}/${shell} residual ${s.residual}`);
        assert.ok(s.dispersion.p90Meters >= s.dispersion.medianMeters);
        const end = s.worldPoints.at(-1);
        assert.ok(Math.abs(end.x-target.x)<1e-6 && Math.abs(end.y-target.y)<1e-6 && Math.abs(end.z-target.z)<1e-6);
    }
}
const p = B.getProfile("ordinance","cluster",0,true);
assert.equal(B.getProfile("peeler","standard",0,true).inaccuracy,2.5);
assert.equal(B.getProfile("peeler","pod",0,true).inaccuracy,2);
assert.equal(p.speed,4.5); assert.equal(p.boost,1.04); assert.equal(p.burn,30);
assert.equal(B.getProfile("ordinance","standard",0,false).boost,1.02);
assert.equal(B.getProfile("ordinance","standard",0,true).burn,40);
const r = solve(p), cluster = r.solutions[0].cluster;
assert.equal(cluster.timeTicks,31); assert.equal(cluster.mother.length,32); assert.equal(cluster.children.length,8);
assert.deepEqual(cluster,M.clusterPaths(r.solutions[0],p,target.y));
for (const child of cluster.children) {
    assert.deepEqual(child.points[0],cluster.release);
    assert.equal(child.impact.y,target.y);
    assert.ok(child.timeTicks > 31);
}
assert.ok(new Set(cluster.children.map(c=>c.impact.x)).size>1);
// Independently replay the tick sequence to check the release position and thrust boundary.
let x=origin.x, y=origin.y, vx=Math.cos(r.solutions[0].elevation*Math.PI/180)*4.5, vy=Math.sin(r.solutions[0].elevation*Math.PI/180)*4.5;
for(let tick=1;tick<=31;tick++){x+=vx;y+=vy;vx*=.99;vy=vy*.99-.05;if(tick<=30){vx*=1.04;vy*=1.04;}}
assert.ok(Math.abs(x-cluster.release.x)<1e-8 && Math.abs(y-cluster.release.y)<1e-8);
const floor = solve(p,{fixedElevation:Math.atan2(1.5,1)*180/Math.PI});
assert.equal(floor.solutions.length,1); assert.ok(Math.abs(floor.solutions[0].elevation-56.309932474)<1e-8);
assert.ok(Math.abs(floor.solutions[0].residual)>1,"Fixed mount must retain its miss, not pretend to solve the target");
assert.deepEqual(B.resolveReferencePosition({x:0,y:64,z:0,weaponId:"ordinance",referenceMode:"breech",launchMode:"vertical"}).origin,{x:.5,y:67,z:.5});
assert.throws(()=>B.resolveReferencePosition({x:0,y:64,z:0,weaponId:"ordinance",referenceMode:"breech",launchMode:"horizontal"}));
for(const url of ["javascript:alert(1)","data:text/html,a","https://u:p@example.org/","not a url"]) assert.throws(()=>M.parseMapUrl(url));
assert.equal(M.parseMapUrl("https://map.example.org/base/#world:0:0:0").hash,"#world:0:0:0");
const markers = M.markerSet(r).markers;
assert.equal(Object.keys(markers).filter(id=>id.startsWith("child-")).length,r.solutions.length*8);
assert.deepEqual(M.markerSet(null).markers,{});
for(const m of Object.values(markers)) assert.ok(m.line.every(p=>[p.x,p.y,p.z].every(Number.isFinite)));
const short = solve(B.getProfile("artillery","solid",1,true)).solutions[0];
const long = solve(B.getProfile("artillery","solid",11,true)).solutions[0];
assert.ok(long.dispersion.medianMeters < short.dispersion.medianMeters);
assert.throws(()=>B.solveTarget({origin,target:{x:NaN,y:0,z:0},speed:5}));
console.log("Mission tests passed: all ammunition, powered roots, floor mount, release timing, bomblets, precision and map data.");
