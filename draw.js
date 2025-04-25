import { toRad, toDeg, normAng } from './util.js';

// Shared state (will be accessed by ctrl.js)
let cvs, ctx;
export let turtle = { x: 0, y: 0, hdg: 0 };
export let segs = [];
export let isDrag = false, dragX = 0, dragY = 0, prvSeg = null, prvEndX = 0, prvEndY = 0;
export let editIdx = -1, origEditIdx = -1, editStartX = 0, editStartY = 0, editStartHdg = 0, initOffX = 0, initOffY = 0;

export function setupDrawing() {
    cvs = document.createElement('canvas');
    document.querySelector('.canvas-container').appendChild(cvs);
    ctx = cvs.getContext('2d');
    resizeCvs();
    window.addEventListener('resize', resizeCvs);
    cvs.addEventListener('mousedown', startDrag);
    cvs.addEventListener('mousemove', updateDrag);
    cvs.addEventListener('mouseup', stopDrag);
    cvs.addEventListener('touchstart', startDrag);
    cvs.addEventListener('touchmove', updateDrag);
    cvs.addEventListener('touchend', stopDrag);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    redraw();
}

function resizeCvs() {
    const cont = cvs.parentElement;
    cvs.width = cont.clientWidth;
    cvs.height = cont.clientHeight;
    turtle.x = cvs.width / 2;
    turtle.y = cvs.height / 2;
    redraw();
}

export function drawArcSeg(len, ang, isPrv = false, startX = turtle.x, startY = turtle.y, startHdg = turtle.hdg) {
    if (len === 0) {
        if (!isPrv) turtle.hdg += toRad(ang);
        return { endX: startX, endY: startY, hdg: startHdg + toRad(ang) };
    }
    if (ang === 0) {
        const dx = len * Math.cos(startHdg);
        const dy = len * Math.sin(startHdg);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        const endX = startX + dx;
        const endY = startY + dy;
        if (!isPrv) {
            turtle.x = endX;
            turtle.y = endY;
        }
        ctx.lineTo(endX, endY);
        ctx.stroke();
        return { endX, endY, hdg: startHdg };
    }
    const angRad = toRad(ang);
    const rad = Math.abs(len / angRad);
    const steps = Math.max(10, Math.floor(Math.abs(len) / 5));
    const stepLen = len / steps;
    const stepAng = angRad / steps;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    let curX = startX, curY = startY, curHdg = startHdg;
    for (let i = 0; i < steps; i++) {
        const dx = stepLen * Math.cos(curHdg);
        const dy = stepLen * Math.sin(curHdg);
        curX += dx;
        curY += dy;
        curHdg += stepAng;
        ctx.lineTo(curX, curY);
    }
    ctx.stroke();
    if (!isPrv) {
        turtle.x = curX;
        turtle.y = curY;
        turtle.hdg = curHdg;
    }
    return { endX: curX, endY: curY, hdg: curHdg };
}

export function calcPosUpTo(idx) {
    let tmpT = { x: cvs.width / 2, y: cvs.height / 2, hdg: 0 };
    for (let i = 0; i < idx && i < segs.length; i++) {
        const { endX, endY, hdg } = drawArcSeg(segs[i].len, segs[i].ang, true, tmpT.x, tmpT.y, tmpT.hdg);
        tmpT.x = endX;
        tmpT.y = endY;
        tmpT.hdg = hdg;
    }
    return tmpT;
}

export function redraw() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    turtle.x = cvs.width / 2;
    turtle.y = cvs.height / 2;
    turtle.hdg = 0;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    let tmpT = { x: turtle.x, y: turtle.y, hdg: turtle.hdg };
    for (let i = 0; i < segs.length; i++) {
        const { endX, endY, hdg } = drawArcSeg(segs[i].len, segs[i].ang, false, tmpT.x, tmpT.y, tmpT.hdg);
        tmpT.x = endX;
        tmpT.y = endY;
        tmpT.hdg = hdg;
    }
    if (editIdx >= 0 && editIdx < segs.length) {
        const pos = calcPosUpTo(editIdx);
        editStartX = pos.x;
        editStartY = pos.y;
        editStartHdg = pos.hdg;
        const { endX, endY } = drawArcSeg(segs[editIdx].len, segs[editIdx].ang, true, editStartX, editStartY, editStartHdg);
        if (!isDrag) {
            prvEndX = endX;
            prvEndY = endY;
        }
    } else if (editIdx === -1) {
        const pos = calcPosUpTo(segs.length);
        editStartX = pos.x;
        editStartY = pos.y;
        editStartHdg = pos.hdg;
        prvEndX = editStartX;
        prvEndY = editStartY;
    } else if (editIdx === -2) {
        editStartX = cvs.width / 2;
        editStartY = cvs.height / 2;
        editStartHdg = 0;
        prvEndX = editStartX;
        prvEndY = editStartY;
    }
    if (isDrag && prvSeg) {
        ctx.strokeStyle = 'gray';
        ctx.lineWidth = 1;
        drawArcSeg(prvSeg.len, prvSeg.ang, true, editStartX, editStartY, editStartHdg);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
    }
    ctx.beginPath();
    ctx.arc(editStartX, editStartY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(prvEndX, prvEndY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'green';
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.stroke();
    updateSegTable();
}

function getRelPos(e) {
    const rect = cvs.getBoundingClientRect();
    let x, y;
    if (e.type.startsWith('touch')) {
        const touch = e.touches[0] || e.changedTouches[0];
        x = touch.clientX - rect.left;
        y = touch.clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }
    return { x, y };
}

function startDrag(e) {
    e.preventDefault();
    isDrag = true;
    const pos = getRelPos(e);
    dragX = pos.x;
    dragY = pos.y;
    origEditIdx = editIdx;
    if (editIdx === -1) {
        segs.push({ len: 0, ang: 0 });
        editIdx = segs.length - 1;
    }
    if (editIdx >= 0 && editIdx < segs.length) {
        const pos = calcPosUpTo(editIdx);
        editStartX = pos.x;
        editStartY = pos.y;
        editStartHdg = pos.hdg;
        const { endX, endY } = drawArcSeg(segs[editIdx].len, segs[editIdx].ang, true, editStartX, editStartY, editStartHdg);
        prvEndX = endX;
        prvEndY = endY;
        prvSeg = { len: segs[editIdx].len, ang: segs[editIdx].ang };
        initOffX = prvEndX - editStartX;
        initOffY = prvEndY - editStartY;
    } else if (editIdx === -2) {
        prvSeg = { len: 0, ang: 0 };
        prvEndX = editStartX;
        prvEndY = editStartY;
        initOffX = 0;
        initOffY = 0;
    }
    redraw();
}

function updateDrag(e) {
    if (!isDrag) return;
    e.preventDefault();
    const pos = getRelPos(e);
    const dx = pos.x - dragX;
    const dy = pos.y - dragY;
    prvEndX = editStartX + initOffX + dx;
    prvEndY = editStartY + initOffY + dy;
    const secDx = prvEndX - editStartX;
    const secDy = prvEndY - editStartY;
    const secLen = Math.sqrt(secDx * secDx + secDy * secDy);
    const secAng = Math.atan2(secDy, secDx);
    const angRad = secAng - editStartHdg;
    let angDeg = toDeg(angRad);
    let arcAngDeg = 2 * angDeg;
    arcAngDeg = normAng(arcAngDeg);
    const absAngRad = toRad(Math.abs(arcAngDeg));
    let arcLen = 0;
    if (absAngRad > 0.0001) {
        const rad = secLen / (2 * Math.sin(absAngRad / 2));
        arcLen = rad * absAngRad;
    } else {
        arcLen = secLen;
    }
    prvSeg = { len: arcLen, ang: arcAngDeg };
    if (editIdx >= 0 && editIdx < segs.length) {
        segs[editIdx] = { len: arcLen, ang: arcAngDeg };
    }
    redraw();
}

function stopDrag(e) {
    if (!isDrag) return;
    e.preventDefault();
    isDrag = false;
    if (prvSeg) {
        if (editIdx >= 0) {
            if (origEditIdx === -1) {
                editIdx = -1;
            }
        } else if (editIdx === -2) {
            segs.unshift(prvSeg);
            editIdx = 0;
        }
        prvSeg = null;
    }
    initOffX = 0;
    initOffY = 0;
    redraw();
}

function updateSegTable() {
    const tbody = document.querySelector('#segmentTableBody');
    if (!tbody) return; // Avoid errors if ctrl.js hasn't initialized yet
    tbody.innerHTML = '';
    const startRow = document.createElement('tr');
    if (editIdx === -2) startRow.classList.add('selected');
    startRow.innerHTML = `<td>Start</td><td>-</td><td>-</td>`;
    startRow.onclick = (e) => {
        if (e.target.tagName !== 'INPUT') editSeg(-2);
    };
    tbody.appendChild(startRow);
    segs.forEach((seg, idx) => {
        const row = document.createElement('tr');
        if (idx === editIdx) row.classList.add('selected');
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td><input type="number" value="${seg.len.toFixed(2)}" onchange="updateSeg(${idx}, 'len', this.value)"></td>
            <td><input type="number" value="${seg.ang.toFixed(2)}" onchange="updateSeg(${idx}, 'ang', this.value)"></td>
        `;
        row.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') editSeg(idx);
        };
        tbody.appendChild(row);
    });
    const endRow = document.createElement('tr');
    if (editIdx === -1) endRow.classList.add('selected');
    endRow.innerHTML = `<td>End</td><td>-</td><td>-</td>`;
    endRow.onclick = (e) => {
        if (e.target.tagName !== 'INPUT') editSeg(-1);
    };
    tbody.appendChild(endRow);
    const insBtn = document.querySelector('#insertBtn');
    const delBtn = document.querySelector('#deleteBtn');
    if (insBtn) insBtn.disabled = false;
    if (delBtn) delBtn.disabled = editIdx < 0 || editIdx >= segs.length;
}

function editSeg(idx) {
    editIdx = idx;
    redraw();
}

export function updateSeg(idx, field, val) {
    segs[idx][field] = parseFloat(val) || 0;
    redraw();
}