(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.FuturismDropRange = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    // Values come from Futurism 0.0.1's AdvancedOrdinanceActivateProcedure,
    // MediumOrdinanceActivateProcedure and the respective flight procedures.
    const MUNITIONS = {
        large_glide: { name: "Large glide bomb", group: "Ordinance bombs", kind: "glide" },
        xl_glide: { name: "Extra-large glide bomb", group: "Ordinance bombs", kind: "glide" },
        large_guided: { name: "Large coordinate-guided bomb", group: "Ordinance bombs", kind: "bomb" },
        xl_guided: { name: "Extra-large coordinate-guided bomb", group: "Ordinance bombs", kind: "bomb" },
        large_optical_bomb: { name: "Large optical guided bomb", group: "Ordinance bombs", kind: "bomb", lock: "optical" },
        xl_optical_bomb: { name: "Extra-large optical guided bomb", group: "Ordinance bombs", kind: "bomb", lock: "optical" },
        bunker_buster: { name: "Guided bunker buster", group: "Ordinance bombs", kind: "bomb" },
        xl_cruise: { name: "Extra-large cruise missile", group: "Cruise missiles", kind: "powered", speed: 4.5, cap: 4, acceleration: 0.1, delay: 40, ticks: 2200 },
        atomic_cruise: { name: "Atomic cruise missile", group: "Cruise missiles", kind: "powered", speed: 4.5, cap: 4, acceleration: 0.1, delay: 40, ticks: 2200 },
        xl_rocket: { name: "Extra-large rocket", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 10, acceleration: 0.2, ticks: 450 },
        xl_cluster: { name: "Large cluster missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 10, acceleration: 0.2, ticks: 450 },
        xl_cluster_mine: { name: "Large cluster mine missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 10, acceleration: 0.2, ticks: 450 },
        xl_ir: { name: "Extra-large IR missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 15, acceleration: 0.2, ticks: 260, lock: "IR" },
        xl_ir_loft: { name: "Extra-large IR lofting missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 12, acceleration: 0.2, ticks: 300, lock: "IR" },
        xl_radar: { name: "Extra-large radar missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 15, acceleration: 0.2, ticks: 260, lock: "radar" },
        xl_optical: { name: "Large optical missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 7, acceleration: 0.1, ticks: 450, lock: "optical" },
        anti_radiation: { name: "Anti-radiation missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 6, acceleration: 0.1, ticks: 320, lock: "radar emitter" },
        medium_ir: { name: "Medium IR missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 10, acceleration: 0.2, ticks: 140, lock: "IR" },
        medium_ir_extended: { name: "Medium extended-range IR missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 10, acceleration: 0.2, ticks: 220, lock: "IR" },
        medium_radar: { name: "Medium radar missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 10, acceleration: 0.1, ticks: 140, lock: "radar" },
        medium_radar_extended: { name: "Medium extended-range radar missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 10, acceleration: 0.1, ticks: 220, lock: "radar" },
        medium_optical: { name: "Medium optical missile", group: "Rockets and missiles", kind: "powered", speed: 4.5, cap: 4, acceleration: 0.1, ticks: 350, lock: "optical" },
        loitering_drone: { name: "Loitering munition drone", group: "Drone", kind: "drone" }
    };

    function bombReach(height, glide, releaseSpeed) {
        // Level-seeking, very distant target: a release-distance envelope, not
        // a guarantee of a hit. First 20 ticks are unsteered, as in the JAR.
        let x = 0, y = height, vx = releaseSpeed / Math.sqrt(3.25), vy = -releaseSpeed * 1.5 / Math.sqrt(3.25);
        for (let tick = 1; tick <= 4000 && y > 0; tick++) {
            x += vx; y += vy;
            if (tick > 20) {
                const speed = Math.hypot(vx, vy);
                const targetY = Math.min(y, 0.8 * (1000000 - x));
                const direction = Math.atan2(targetY - y, 1000000 - x);
                vx = vx * 0.95 + Math.cos(direction) * speed * 0.05;
                vy = vy * 0.95 + Math.sin(direction) * speed * 0.05;
                if (glide) vx /= 0.99;
            }
            vx *= 0.99;
            vy = vy * 0.99 - 0.05;
        }
        return Math.max(0, x);
    }

    function poweredReach(height, munition) {
        // Optimistic straight-and-level powered envelope. Terrain avoidance,
        // turning, sensor acquisition and target terminal dive reduce reach.
        let speed = munition.speed, distance = 0;
        for (let tick = 1; tick <= munition.ticks; tick++) {
            distance += speed;
            speed *= 0.99;
            if (tick > (munition.delay || 0) && speed < munition.cap) speed += munition.acceleration;
        }
        let y = height, vy = 0;
        for (let tick = 0; tick < 4000 && y > 0 && speed > 0.001; tick++) {
            distance += speed;
            y += vy;
            speed *= 0.99;
            vy = vy * 0.99 - 0.05;
        }
        return distance;
    }

    function calculate(id, releaseY, targetY, releaseSpeed = 0.2) {
        const munition = MUNITIONS[id];
        if (!munition) throw new Error("Select a munition.");
        if (![releaseY, targetY, releaseSpeed].every(Number.isFinite)) throw new Error("Enter valid coordinates and speed.");
        if (releaseY <= targetY) throw new Error("Release Y must be above target Y.");
        if (releaseSpeed < 0 || releaseSpeed > 20) throw new Error("Release speed must be between 0 and 20 blocks/tick.");
        if (munition.kind === "drone") return { munition, distance: null, note: "The loitering drone is manually controlled and has no fixed fuel timer in its flight script. Y height alone cannot determine a maximum hit distance." };
        const height = releaseY - targetY;
        const distance = munition.kind === "powered"
            ? poweredReach(height, munition)
            : bombReach(height, munition.kind === "glide", releaseSpeed);
        const note = munition.kind === "powered"
            ? "Optimistic straight-and-level reach through the scripted powered period, plus a gravity-only coast from the entered altitude. Guidance turns, collision, unloaded chunks and launch geometry can shorten it."
            : "Level-seeking release envelope from the bomb's 20-tick unsteered phase and subsequent guidance. It assumes open air, a programmed target and the entered initial speed; actual aim and ship motion can change the hit point.";
        return { munition, distance, note };
    }
    return { MUNITIONS, calculate, bombReach, poweredReach };
});
