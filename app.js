(function () {
    "use strict";

    const B = window.WariumBallistics;
    const M = window.WariumMission;
    const form = document.getElementById("calculator-form");
    const weaponSelect = document.getElementById("weapon");
    const shellSelect = document.getElementById("shell");
    const barrelsInput = document.getElementById("barrels");
    const barrelsRow = document.getElementById("barrels-row");
    const referenceMode = document.getElementById("reference-mode");
    const runtimeState = document.getElementById("runtime-state");
    const runtimeNote = document.getElementById("runtime-note");
    const referenceNote = document.getElementById("reference-note");
    const status = document.getElementById("status");
    const solutionList = document.getElementById("solution-list");
    const canvas = document.getElementById("trajectory");
    const context = canvas.getContext("2d");

    const summary = {
        range: document.getElementById("summary-range"),
        height: document.getElementById("summary-height"),
        speed: document.getElementById("summary-speed"),
        spread: document.getElementById("summary-spread")
    };

    function option(value, label) {
        const element = document.createElement("option");
        element.value = value;
        element.textContent = label;
        return element;
    }

    function populateWeapons() {
        for (const [id, weapon] of Object.entries(B.WEAPONS)) {
            weaponSelect.appendChild(option(id, weapon.name));
        }
        weaponSelect.value = "artillery";
        populateShells();
    }

    function populateShells() {
        const previous = shellSelect.value;
        shellSelect.replaceChildren();
        const weapon = B.WEAPONS[weaponSelect.value];
        for (const [id, shell] of Object.entries(weapon.shells)) {
            shellSelect.appendChild(option(id, shell.name));
        }
        if ([...shellSelect.options].some((item) => item.value === previous)) shellSelect.value = previous;
        barrelsRow.hidden = !weapon.usesBarrels;
        updateNotes();
    }

    function selectedRuntime() {
        return form.elements.runtime.value === "rpl";
    }

    function updateNotes() {
        document.getElementById("base-yaw-row").hidden = document.getElementById("launcher-facing").value !== "custom";
        const weapon = B.WEAPONS[weaponSelect.value];
        document.getElementById("ordinance-options").hidden = weaponSelect.value !== "ordinance";
        document.getElementById("vertical-vector-row").hidden = document.getElementById("launch-mode").value !== "vertical";
        const rpl = selectedRuntime();
        runtimeState.textContent = rpl ? "RPL 2.1.1 profile" : "No-RPL slower profile";
        runtimeNote.textContent = weapon.usesBarrels
            ? (rpl
                ? "Warium applies its 2x launch-speed multiplier to this weapon."
                : "Uses Warium's slower base launch speed.")
            : weaponSelect.value === "ordinance"
                ? "Ordinance starts at 4.5 blocks/tick. RPL changes powered boost from 1.02 to 1.04 per tick."
                : "Launch speed and powered boost for this profile do not change with RPL.";

        if (referenceMode.value === "muzzle") {
            referenceNote.textContent = "Use the projectile spawn point at the muzzle for maximum accuracy.";
        } else if (weaponSelect.value === "mortar") {
            referenceNote.textContent = "Enter the mortar block coordinates. The calculator applies Warium's +0.5 X/Z and +3 Y spawn offset.";
        } else {
            referenceNote.textContent = "Enter the breech block coordinates. The calculator applies block-center and barrel-length muzzle offsets.";
        }
    }

    function numberValue(id) {
        const text = document.getElementById(id).value.trim();
        if (!text) throw new Error("All active numeric fields are required.");
        const value = Number(text);
        if (!Number.isFinite(value)) throw new Error("Every coordinate must be a valid number.");
        return value;
    }

    function format(value, digits) {
        return Number(value).toFixed(digits).replace("-0.00", "0.00").replace("-0.0", "0.0");
    }

    function signed(value, digits) {
        const rounded = format(value, digits);
        return value > 0 ? `+${rounded}` : rounded;
    }

    function solutionName(type) {
        if (type === "low") return "Low-angle solution";
        if (type === "high") return "High-angle solution";
        return "Firing solution";
    }

    function renderSolutions(result) {
        solutionList.replaceChildren();
        for (const solution of result.solutions) {
            const card = document.createElement("article");
            card.className = `solution-card ${solution.type}${solution.fireable ? "" : " blocked"}`;
            const pitchRows = result.weaponId === "mortar"
                ? `
                    <div><dt>Mortar aimer pitch</dt><dd>${signed(solution.mortarPitch, 2)} deg</dd></div>
                    <div><dt>True launch elevation</dt><dd>${signed(solution.elevation, 2)} deg</dd></div>`
                : `<div><dt>Minecraft pitch</dt><dd>${signed(solution.minecraftPitch, 2)} deg</dd></div>`;
            card.innerHTML = `
                <header>
                    <h3>${result.fixedElevation !== undefined ? "Fixed-mount preview" : solutionName(solution.type)}</h3>
                </header>
                <div class="aim-pair">
                    <div><span>${result.fixedElevation !== undefined ? "Fixed launch elevation" : "Aimer pitch"}</span><strong>${result.fixedElevation !== undefined ? signed(solution.elevation, 2) + "°" : solution.pitchAim.inRange ? signed(solution.pitchAim.setting, 1) + "°" : "Out of range"}</strong></div>
                    <div><span>Aimer yaw (±30.5°)</span><strong>${signed(result.aim.setting, 1)}°</strong></div>
                </div>
                ${solution.fireable ? "" : `<p class="aim-error" role="alert">${result.fixedElevation !== undefined
                    ? "This fixed mount misses the target. Change the launch setup or firing/target coordinates."
                    : `Required Aimer pitch ${signed(solution.aimerPitch, 2)}° exceeds the −21.5° to +44.5° range. Change your firing position, target coordinates, weapon/barrels, or use another valid arc.`}</p>`}
                <p class="field-note aim-reference">Launcher facing: ${result.aim.facing}. Yaw rounded to 0.5° steps; exact offset ${signed(result.aim.yaw, 2)}°.</p>
                <dl>
                    ${pitchRows}
                    <div><dt>True launch elevation</dt><dd>${signed(solution.elevation, 2)} deg</dd></div>
                    <div><dt>Compass bearing</dt><dd>${format(solution.bearing, 2)} deg</dd></div>
                    <div><dt>Nominal vertical miss</dt><dd>${format(solution.residual, 2)} m</dd></div>
                    <div><dt>Flight time</dt><dd>${format(solution.timeSeconds, 2)} s</dd></div>
                    <div><dt>Apex altitude</dt><dd>Y ${format(solution.apexWorldY, 1)}</dd></div>
                    <div><dt>Impact speed</dt><dd>${format(solution.impactSpeedBlocksPerSecond, 1)} m/s</dd></div>
                    <div><dt>Median target-plane miss</dt><dd>${format(solution.dispersion.medianMeters, 1)} m / ${format(solution.dispersion.percentError, 2)}%</dd></div>
                    <div><dt>90th-percentile plane miss</dt><dd>${format(solution.dispersion.p90Meters, 1)} m</dd></div>
                </dl>`;
            solutionList.appendChild(card);
        }
    }

    function resizeCanvas() {
        const rectangle = canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(rectangle.width * ratio));
        canvas.height = Math.max(1, Math.round(rectangle.height * ratio));
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        return { width: rectangle.width, height: rectangle.height };
    }

    function drawEmpty(message) {
        const size = resizeCanvas();
        context.clearRect(0, 0, size.width, size.height);
        context.fillStyle = "#737b70";
        context.font = "13px Consolas, monospace";
        context.textAlign = "center";
        context.fillText(message, size.width / 2, size.height / 2);
    }

    function drawTrajectory(result) {
        if (!result || result.solutions.length === 0) {
            drawEmpty("NO TRAJECTORY");
            return;
        }

        const size = resizeCanvas();
        const width = size.width;
        const height = size.height;
        const padding = { left: 58, right: 24, top: 22, bottom: 42 };
        const sectionPoint = p => ({x: ((p.x-result.origin.x)*result.geometry.dx + (p.z-result.origin.z)*result.geometry.dz)/result.geometry.horizontalRange, y:p.y-result.origin.y});
        const traces = result.solutions.flatMap(s => s.cluster
            ? [{type:s.type, points:s.cluster.mother.map(sectionPoint)}, ...s.cluster.children.map(c => ({type:s.type, child:true, points:c.points.map(sectionPoint)}))]
            : [{type:s.type, points:s.points}]);
        const allPoints = traces.flatMap(trace => trace.points);
        allPoints.push({ x: result.geometry.horizontalRange, y: result.geometry.dy });
        const minY = Math.min(0, result.geometry.dy, ...allPoints.map((point) => point.y));
        const maxY = Math.max(1, ...allPoints.map((point) => point.y));
        const range = Math.max(1, result.geometry.horizontalRange, ...allPoints.map(p => p.x));
        const minX = Math.min(0, ...allPoints.map(p => p.x));
        const ySpan = Math.max(1, maxY - minY);

        const projectX = (x) => padding.left + ((x - minX) / (range - minX)) * (width - padding.left - padding.right);
        const projectY = (y) => padding.top + ((maxY - y) / ySpan) * (height - padding.top - padding.bottom);

        context.clearRect(0, 0, width, height);
        context.lineWidth = 1;
        context.strokeStyle = "#272c27";
        context.fillStyle = "#788075";
        context.font = "11px Consolas, monospace";
        context.textAlign = "center";

        for (let i = 0; i <= 5; i += 1) {
            const x = minX + (range - minX) * i / 5;
            const px = projectX(x);
            context.beginPath();
            context.moveTo(px, padding.top);
            context.lineTo(px, height - padding.bottom);
            context.stroke();
            context.fillText(`${Math.round(x)} m`, px, height - 17);
        }

        context.textAlign = "right";
        for (let i = 0; i <= 4; i += 1) {
            const y = minY + ySpan * i / 4;
            const py = projectY(y);
            context.beginPath();
            context.moveTo(padding.left, py);
            context.lineTo(width - padding.right, py);
            context.stroke();
            context.fillText(`${Math.round(y)} m`, padding.left - 8, py + 4);
        }

        const targetX = projectX(result.geometry.horizontalRange);
        const targetY = projectY(result.geometry.dy);
        context.strokeStyle = "#ef786d";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(targetX - 6, targetY - 6);
        context.lineTo(targetX + 6, targetY + 6);
        context.moveTo(targetX + 6, targetY - 6);
        context.lineTo(targetX - 6, targetY + 6);
        context.stroke();

        for (const solution of traces) {
            context.strokeStyle = solution.type === "high" ? "#efb95d" : "#9bda55";
            context.lineWidth = solution.child ? 1 : 2.5;
            context.globalAlpha = solution.child ? 0.55 : 1;
            context.beginPath();
            solution.points.forEach((point, index) => {
                const px = projectX(point.x);
                const py = projectY(point.y);
                if (index === 0) context.moveTo(px, py);
                else context.lineTo(px, py);
            });
            context.stroke();
        }
        context.globalAlpha = 1;
        for (const s of result.solutions.filter(s => s.cluster)) {
            const p = sectionPoint(s.cluster.release);
            context.fillStyle = "#64beff"; context.beginPath();
            context.arc(projectX(p.x),projectY(p.y),5,0,2*Math.PI); context.fill();
        }
    }

    function calculate() {
        try {
            const weaponId = weaponSelect.value;
            const barrels = Number(barrelsInput.value);
            if (B.WEAPONS[weaponId].usesBarrels && (!Number.isInteger(barrels) || barrels < 1 || barrels > 11)) {
                throw new Error("Barrel blocks must be a whole number from 1 to 11.");
            }

            const inputPosition = {
                x: numberValue("origin-x"),
                y: numberValue("origin-y"),
                z: numberValue("origin-z"),
                referenceMode: referenceMode.value,
                weaponId,
                barrels,
                launchMode: document.getElementById("launch-mode").value
            };
            const target = {
                x: numberValue("target-x"),
                y: numberValue("target-y"),
                z: numberValue("target-z")
            };
            const profile = B.getProfile(weaponId, shellSelect.value, barrels, selectedRuntime());
            const reference = B.resolveReferencePosition(inputPosition);
            const geometry = B.getGeometry(reference.origin, target);
            const facingId = document.getElementById("launcher-facing").value;
            const aim = B.getAimerAim(geometry.yaw, facingId, facingId === "custom" ? numberValue("base-yaw") : 0);
            if (geometry.horizontalRange > 1e-6 && !aim.inRange) throw new Error(
                `${aim.facing} would require ${signed(aim.yaw, 2)}° yaw, outside Warium’s ±30.5° Aimer range. Reorient the launcher toward the target, then select its actual facing (or custom base yaw for a rotated mount).`);
            const vertical = weaponId === "ordinance" && document.getElementById("launch-mode").value === "vertical";
            const magnitude = vertical ? numberValue("vertical-vector") : 1;
            if (magnitude < 0 || magnitude > 10) throw new Error("Horizontal vector magnitude must be between 0 and 10.");
            if (vertical && magnitude === 0) throw new Error("A straight-up no-lock launch cannot solve an offset target. Its nominal X/Z stays at the launch point; yaw is undefined. Use the retained horizontal magnitude from your floor mount.");
            const result = M.enrich(B.solveTarget({
                origin: reference.origin,
                target,
                speed: profile.speed,
                launchOffset: reference.launchOffset,
                profile,
                relativeYaw: aim.yaw,
                fixedElevation: vertical ? Math.atan2(1.5, magnitude) * 180 / Math.PI : undefined
            }), profile);
            result.aim = aim;
            for (const solution of result.solutions) {
                solution.pitchAim = B.getAimerPitch(solution.elevation, aim.yaw, weaponId);
                solution.aimerPitch = solution.pitchAim.pitch;
                // Floor-mounted Ordinance forces its elevation; it is not an adjustable Aimer pitch.
                solution.fireable = aim.inRange && (vertical ? Math.abs(solution.residual) < 0.001 : solution.pitchAim.inRange);
            }
            const drawable = {...result, solutions: result.solutions.filter(s => s.fireable)};

            summary.range.textContent = `${format(result.geometry.horizontalRange, 1)} m`;
            summary.height.textContent = `${signed(result.geometry.dy, 1)} m`;
            summary.speed.textContent = `${format(profile.speed, 2)} blk/t (${format(profile.speedBlocksPerSecond, 0)} m/s)`;
            summary.spread.textContent = format(profile.inaccuracy, 2);

            if (result.solutions.length === 0) {
                status.className = "status-message error";
                status.textContent = result.reason;
            } else {
                status.className = "status-message";
                const countText = vertical
                    ? "Fixed floor-mount trajectory preview. Check nominal vertical miss: this mount cannot freely choose a target elevation."
                    : result.solutions.length === 2 ? "Low and high arcs found." : "One valid arc found.";
                const mortarNote = weaponId === "mortar"
                    ? " Orient the mortar to the listed yaw first; its pitch setting accounts for Warium's transformed launch vector."
                    : "";
                status.textContent = `${countText}${mortarNote} Face the launcher ${aim.facing}; use the Aimer settings below. Trajectories use the exact aim; 0.5° control steps introduce additional rounding error. Error estimates measure random miss at the vertical target plane.`;
                if (drawable.solutions.length < result.solutions.length) {
                    status.className = "status-message error";
                    status.textContent = drawable.solutions.length
                        ? "An arc is outside Warium’s aiming limits and cannot be fired. Use the valid arc, or change your firing inputs to bring the other arc within range. Only valid arcs are mapped."
                        : "No usable firing solution for this setup. Please change your firing inputs: position, target coordinates, launcher orientation, or weapon/barrel count. See the limits below.";
                }
            }

            renderSolutions(result);
            drawTrajectory(drawable);
            renderCluster(drawable);
            window.lastBallisticResult = drawable;
            window.dispatchEvent(new CustomEvent("warium-result", {detail:drawable}));
            try { localStorage.setItem("warium-ballistics-inputs", JSON.stringify(Object.fromEntries(new FormData(form)))); } catch (_) {}
        } catch (error) {
            status.className = "status-message error";
            status.textContent = error.message;
            solutionList.replaceChildren();
            drawEmpty("INVALID INPUT");
            window.lastBallisticResult = null;
            renderCluster(null);
            window.dispatchEvent(new CustomEvent("warium-result", {detail:null}));
        }
    }

    function renderCluster(result) {
        const host = document.getElementById("cluster-results"); host.replaceChildren();
        const clusters = result?.solutions.filter(s => s.cluster) || [];
        document.getElementById("cluster-section").hidden = !clusters.length;
        for (const s of clusters) {
            const node = document.createElement("article"); const r = s.cluster.release;
            node.innerHTML = `<h3>${solutionName(s.type)} — release X ${format(r.x,1)}, Y ${format(r.y,1)}, Z ${format(r.z,1)}</h3>
                <div class="table-scroll"><table><thead><tr><th>Sample bomblet</th><th>Landing X</th><th>Y</th><th>Z</th><th>Total time</th></tr></thead><tbody>${s.cluster.children.map(c => `<tr><td>${c.id}</td><td>${c.impact ? format(c.impact.x,1) : "No crossing"}</td><td>${c.impact ? format(c.impact.y,1) : "—"}</td><td>${c.impact ? format(c.impact.z,1) : "—"}</td><td>${c.timeTicks ? format(c.timeTicks/20,2) + " s" : "—"}</td></tr>`).join("")}</tbody></table></div>`;
            host.appendChild(node);
        }
    }

    function restoreInputs() {
        try {
            const saved = JSON.parse(localStorage.getItem("warium-ballistics-inputs"));
            if (!saved) return;
            if (B.WEAPONS[saved.weapon]) { weaponSelect.value = saved.weapon; populateShells(); }
            for (const [name, value] of Object.entries(saved)) {
                const control = form.elements[name];
                if (!control) continue;
                if (control instanceof RadioNodeList) control.value = value;
                else control.value = value;
            }
        } catch (ignored) {
            // Invalid local state should never prevent the calculator from loading.
        }
    }

    populateWeapons();
    restoreInputs();
    populateShells();
    updateNotes();

    weaponSelect.addEventListener("change", () => {
        populateShells();
        calculate();
    });
    shellSelect.addEventListener("change", calculate);
    referenceMode.addEventListener("change", () => {
        updateNotes();
        calculate();
    });
    form.elements.runtime.forEach((radio) => radio.addEventListener("change", () => {
        updateNotes();
        calculate();
    }));
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        calculate();
    });
    for (const id of ["launch-mode", "vertical-vector", "launcher-facing", "base-yaw"]) document.getElementById(id).addEventListener("change", () => {updateNotes(); calculate();});
    // Invalidate old paths as soon as the user edits an unsolved coordinate/setup.
    form.addEventListener("input", () => {
        window.lastBallisticResult = null; solutionList.replaceChildren(); renderCluster(null);
        drawEmpty("CALCULATE UPDATED INPUTS"); status.textContent = "Inputs changed. Calculate the updated solution.";
        window.dispatchEvent(new CustomEvent("warium-result", {detail:null}));
    });
    window.addEventListener("resize", () => drawTrajectory(window.lastBallisticResult));

    calculate();
})();
