const assert = require("node:assert/strict");
const B = require("./ballistics");
const D = require("./drop-range");
const fs = require("node:fs");

const page = fs.readFileSync(require.resolve("./index.html"), "utf8");
assert.match(page, /id="barrels"[^>]*max="21"/);
assert.match(page, /app\.js\?v=railgun-limits-2/);

for (const [id, base, divisor, maxBarrels] of [["railgun_205", 8, 1.5, 21], ["railgun_60", 7, 1.25, 11], ["railgun_15", 8, 1, 6]]) {
    const one = B.getProfile(id, "penetrator", 1, false);
    const maximum = B.getProfile(id, "penetrator", maxBarrels, false);
    assert.equal(B.WEAPONS[id].maxBarrels, maxBarrels);
    assert.ok(Math.abs(one.speed - (base + 1 / divisor)) < 1e-9);
    assert.ok(Math.abs(maximum.speed - (base + maxBarrels / divisor)) < 1e-9);
    assert.equal(B.getProfile(id, "penetrator", maxBarrels, true).speed, maximum.speed * 2);
    assert.ok(maximum.inaccuracy < one.inaccuracy);
    assert.equal(B.resolveReferencePosition({weaponId:id, referenceMode:"breech", x:0, y:64, z:0, barrels:maxBarrels}).launchOffset, maxBarrels + 1);
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
