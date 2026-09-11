"use strict";
const assert = require("node:assert/strict"), B = require("./ballistics"), M = require("./mission");
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for (const [id,facing] of Object.entries(B.FACINGS)) {
    const center = B.getAimerAim(facing.yaw,id);
    near(center.setting,0); assert.ok(center.inRange);
    for (const offset of [-30.5,-25,0,25,30.5]) {
        const aim = B.getAimerAim(B.normalizeSignedDegrees(facing.yaw+offset),id);
        near(aim.yaw,offset); near(aim.setting,offset); assert.ok(aim.inRange);
        // Reconstruct the horizontal shoot vector from AimerProcedureProcedure.
        const f = facing.yaw*Math.PI/180, t = Math.tan(aim.yaw*Math.PI/180);
        const x = -Math.sin(f) - Math.cos(f)*t, z = Math.cos(f)-Math.sin(f)*t;
        near(B.normalizeSignedDegrees(Math.atan2(-x,z)*180/Math.PI-facing.yaw),offset);
    }
    for (const offset of [-180,-90,-30.51,30.51,90]) {
        const aim=B.getAimerAim(facing.yaw+offset,id);
        assert.equal(aim.inRange,false); assert.equal(aim.setting,null);
    }
}
near(B.getAimerAim(-90).setting,0);
assert.equal(B.getAimerAim(-45).inRange,false,"Auto cardinal must not fabricate a valid diagonal setting");
near(B.getAimerAim(-45,"custom",-50).setting,5);
near(B.getAimerAim(-89.74,"east").setting,.5);
for (const pitch of [-21.5,0,44.5]) assert.ok(B.getAimerPitch(pitch,0,"artillery").inRange);
for (const pitch of [-21.51,44.51,80]) assert.equal(B.getAimerPitch(pitch,0,"artillery").setting,null);
const corrected = B.getAimerPitch(30,25,"artillery");
near(Math.atan(Math.tan(corrected.pitch*Math.PI/180)*Math.cos(25*Math.PI/180))*180/Math.PI,30);
const mortar = B.getAimerPitch(45,25,"mortar");
near(B.mortarElevationFromSetting(mortar.pitch,25),45);
assert.throws(()=>B.getAimerAim(0,"custom",181));
const profile=B.getProfile("artillery","solid",4,true);
const r=M.enrich(B.solveTarget({origin:{x:0,y:64,z:0},target:{x:200,y:64,z:0},speed:profile.speed,profile}),profile);
r.solutions.forEach(s=>s.fireable=B.getAimerPitch(s.elevation,0,"artillery").inRange);
assert.equal(r.solutions.filter(s=>s.fireable).length,1);
assert.equal(Object.keys(M.markerSet(r).markers).filter(id=>id.startsWith("arc-")).length,1);
r.solutions.forEach(s=>s.fireable=false); assert.deepEqual(M.markerSet(r).markers,{});
console.log("Aiming tests passed: all facings/signs, yaw wrapping and limits, pitch boundaries/conversion, rounding and blocked overlays.");
