(function (root) {
    "use strict";
    const B = typeof module === "object" ? require("./ballistics.js") : root.WariumBallistics;
    const rad = d => d * Math.PI / 180;
    function random(seed) {
        return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    }
    function step(state, boost = 1) {
        for (const axis of ["x", "y", "z"]) state[axis] += state["v" + axis];
        state.vx *= 0.99 * boost;
        state.vy = (state.vy * 0.99 - 0.05) * boost;
        state.vz *= 0.99 * boost;
    }
    const position = s => ({ x: s.x, y: s.y, z: s.z });
    function clusterPaths(solution, profile, targetY, seed = 31208) {
        const yaw = rad(solution.yaw), elevation = rad(solution.elevation);
        const state = { ...solution.muzzle, vx: -Math.sin(yaw) * Math.cos(elevation) * profile.speed,
            vy: Math.sin(elevation) * profile.speed, vz: Math.cos(yaw) * Math.cos(elevation) * profile.speed };
        const mother = [position(state)];
        for (let tick = 1; tick <= profile.releaseTick; tick++) {
            step(state, tick <= profile.burn ? profile.boost : 1);
            mother.push(position(state));
        }
        const release = position(state);
        const rng = random(seed);
        const spread = B.MINECRAFT_SPREAD_SCALE * 12 * Math.hypot(state.vx, state.vy, state.vz);
        const children = Array.from({ length: 8 }, (_, i) => {
            const child = { ...state };
            for (const axis of ["vx", "vy", "vz"]) child[axis] += spread * (rng() - rng());
            const points = [position(child)];
            let impact = null, timeTicks = null;
            for (let tick = 1; tick <= 4000; tick++) {
                const before = position(child);
                step(child);
                if (before.y >= targetY && child.y <= targetY && child.y < before.y) {
                    const f = (targetY - before.y) / (child.y - before.y);
                    impact = { x: before.x + f * (child.x - before.x), y: targetY, z: before.z + f * (child.z - before.z) };
                    points.push(impact); timeTicks = profile.releaseTick + tick - 1 + f; break;
                }
                points.push(position(child));
                if (child.y < targetY - 512 && child.vy < 0) break;
            }
            return { id: i + 1, points, impact, timeTicks };
        });
        return { mother, release, timeTicks: profile.releaseTick, children };
    }
    function enrich(result, profile) {
        if (profile.releaseTick) result.solutions = result.solutions.filter(s => s.timeTicks >= profile.releaseTick);
        if (!result.solutions.length && profile.releaseTick) result.reason = "No bomblet solution: the nominal path cannot reach the target after the tick-31 release. Try a different range or height.";
        for (const s of result.solutions) {
            const range = result.geometry.horizontalRange;
            s.worldPoints = s.points.map(p => ({ x: result.origin.x + p.x * result.geometry.dx / range,
                y: result.origin.y + p.y, z: result.origin.z + p.x * result.geometry.dz / range }));
            if (profile.releaseTick) s.cluster = clusterPaths(s, profile, result.target.y);
        }
        return result;
    }
    function parseMapUrl(value) {
        const url = new URL(value);
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Enter a public HTTP or HTTPS BlueMap link without a username or password.");
        return url;
    }
    function markerSet(result) {
        const markers = {};
        const line = (id, label, points, color) => {
            if (points.length < 2) return;
            markers[id] = { type: "line", label, position: points[0], line: points,
                lineWidth: 3, lineColor: color, depthTest: false };
        };
        const cross = (id, point, color) => {
            line(id + "-x", id, [{...point, x:point.x-3}, {...point, x:point.x+3}], color);
            line(id + "-z", id, [{...point, z:point.z-3}, {...point, z:point.z+3}], color);
        };
        if (result?.solutions.some(s => s.fireable !== false)) {
            cross("Target", result.target, {r:239,g:120,b:109,a:1});
            result.solutions.filter(s => s.fireable !== false).forEach((s, i) => {
                const color = s.type === "high" ? {r:239,g:185,b:93,a:1} : {r:155,g:218,b:85,a:1};
                cross("Launch " + i, s.muzzle, color);
                line("arc-"+i, s.type + " trajectory", s.cluster?.mother || s.worldPoints, color);
                if (s.cluster) {
                    cross("Release " + i, s.cluster.release, {r:100,g:190,b:255,a:1});
                    s.cluster.children.forEach(c => {
                        line(`child-${i}-${c.id}`, `Representative bomblet ${c.id}`, c.points, {...color,a:0.55});
                        if (c.impact) cross(`Impact ${i}-${c.id}`, c.impact, color);
                    });
                }
            });
        }
        return { label: "Warium firing solution", toggleable: true, defaultHidden: false, markers };
    }
    const api = { step, clusterPaths, enrich, parseMapUrl, markerSet };
    if (typeof module === "object") module.exports = api;
    root.WariumMission = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
