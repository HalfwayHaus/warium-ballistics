const assert = require("node:assert/strict");
const B = require("./ballistics");
const D = require("./drop-range");

for (const [id, base, divisor] of [["railgun_205", 8, 1.5], ["railgun_60", 7, 1.25], ["railgun_15", 8, 1]]) {
    const one = B.getProfile(id, "penetrator", 1, false);
    const eleven = B.getProfile(id, "penetrator", 11, false);
    assert.ok(Math.abs(one.speed - (base + 1 / divisor)) < 1e-9);
    assert.ok(Math.abs(eleven.speed - (base + 11 / divisor)) < 1e-9);
    assert.equal(B.getProfile(id, "penetrator", 11, true).speed, eleven.speed * 2);
    assert.ok(eleven.inaccuracy < one.inaccuracy);
    assert.equal(one.lift, 0.04);
}
assert.equal(B.getProfile("railgun_60", "scatter", 4, false).inaccuracy, 1.5);
assert.equal(B.getProfile("railgun_60", "scatter", 4, false).maxTicks, 100);
assert.equal(B.getProfile("large_ordinance", "rocket", 0, false).speed, 4.5);
assert.equal(B.getProfile("large_ordinance", "cruise", 0, false).guided, true);

const low = D.calculate("large_glide", 128, 64);
const high = D.calculate("large_glide", 256, 64);
assert.ok(low.distance > 0 && high.distance > low.distance);
assert.ok(D.calculate("xl_cruise", 256, 64).distance > D.calculate("xl_rocket", 256, 64).distance);
assert.equal(D.calculate("loitering_drone", 256, 64).distance, null);
assert.throws(() => D.calculate("large_glide", 64, 64), /above/);
assert.throws(() => D.calculate("unknown", 256, 64), /Select/);
console.log("Futurism profiles and drop-range tests passed.");
