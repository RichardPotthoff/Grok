import { turtle, segs, editIdx, prvSeg, prvEndX, prvEndY, redraw, updateSeg } from './draw.js';

export function setupControls() {
    const cont = document.querySelector('.controls');
    cont.innerHTML = `
        <div class="tabs">
            <div class="tab active" data-tab="draw">Draw</div>
            <div class="tab" data-tab="file">File</div>
            <div class="tab" data-tab="settings">Settings</div>
        </div>
        <div id="draw" class="tab-content active">
            <div class="current-segment">
                Current Segment: <span id="currentLen">0</span> pixels, <span id="currentAng">0</span> degrees
            </div>
            <div class="control-buttons">
                <button id="clear">Clear</button>
                <button id="insertBtn">Insert Arc</button>
                <button id="deleteBtn">Delete Arc</button>
            </div>
            <div class="scrollable-table">
                <table id="segmentTable">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Length (pixels)</th>
                            <th>Angle (degrees)</th>
                        </tr>
                    </thead>
                    <tbody id="segmentTableBody"></tbody>
                </table>
            </div>
        </div>
        <div id="file" class="tab-content">
            <div class="control-buttons">
                <button id="exportBtn">Export Path</button>
                <label for="importFile">Import Path:</label>
                <input type="file" id="importFile" accept=".txt">
            </div>
        </div>
        <div id="settings" class="tab-content">
            <div class="settings-option">
                <label>Layout Side:</label>
                <select id="layoutSide">
                    <option value="left">Controls on Left</option>
                    <option value="right">Controls on Right</option>
                </select>
            </div>
        </div>
    `;
    cont.querySelector('#clear').addEventListener('click', clear);
    cont.querySelector('#insertBtn').addEventListener('click', insertArc);
    cont.querySelector('#deleteBtn').addEventListener('click', deleteArc);
    cont.querySelector('#exportBtn').addEventListener('click', exportPath);
    cont.querySelector('#importFile').addEventListener('change', importPath);
    cont.querySelector('#layoutSide').addEventListener('change', (e) => swapLayout(e.target.value));
    cont.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });
    redraw(); // Initial table update
}

function clear() {
    segs.length = 0;
    editIdx = -1;
    redraw();
}

function insertArc() {
    if (editIdx === -2) {
        segs.unshift({ len: 0, ang: 0 });
    } else if (editIdx === -1 || editIdx === segs.length) {
        segs.push({ len: 0, ang: 0 });
    } else {
        segs.splice(editIdx + 1, 0, { len: 0, ang: 0 });
    }
    editIdx = editIdx === -2 ? 0 : editIdx + 1;
    redraw();
}

function deleteArc() {
    if (editIdx < 0 || editIdx >= segs.length) return;
    segs.splice(editIdx, 1);
    if (editIdx >= segs.length) editIdx = -1;
    redraw();
}

function exportPath() {
    if (segs.length === 0) {
        alert("No segments to export!");
        return;
    }
    const data = segs.map(seg => `${seg.len},${seg.ang}`).join(',\n') + '\n';
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'turtle_path.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importPath(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        try {
            const cleaned = text.replace(/[\[\]]/g, '');
            const lines = cleaned.trim().split('\n');
            segs.length = 0;
            let lineNum = 0;
            for (const line of lines) {
                lineNum++;
                const parts = line.split(',').map(num => num.trim());
                let n = parts.length;
                if (parts[n-1] === "") n -= 1;
                if (n % 2 !== 0) {
                    throw new Error(`Invalid number of values in line ${lineNum}: ${line} (expected "length,angle")`);
                }
                for (let i = 0; i < n; i += 2) {
                    const len = parseFloat(parts[i]);
                    const ang = parseFloat(parts[i+1]);
                    if (isNaN(len)) {
                        throw new Error(`Invalid length in line ${lineNum}, pair ${i/2 + 1}: ${parts[i]} is not a number`);
                    }
                    if (isNaN(ang)) {
                        throw new Error(`Invalid angle in line ${lineNum}, pair ${i/2 + 1}: ${parts[i+1]} is not a number`);
                    }
                    segs.push({ len, ang });
                }
            }
            editIdx = -1;
            redraw();
        } catch (err) {
            alert(`Error loading file: ${err.message}`);
            segs.length = 0;
            editIdx = -1;
            redraw();
        }
    };
    reader.onerror = function() {
        alert("Error reading file!");
    };
    reader.readAsText(file);
}

function showTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('active');
}

function swapLayout(side) {
    const cont = document.querySelector('.container');
    if (side === 'right') {
        cont.style.gridTemplateColumns = '1fr 300px';
        cont.style.gridTemplateAreas = '"canvas controls"';
        cont.children[0].style.order = 1;
        cont.children[1].style.order = 0;
    } else {
        cont.style.gridTemplateColumns = '300px 1fr';
        cont.style.gridTemplateAreas = '"controls canvas"';
        cont.children[0].style.order = 0;
        cont.children[1].style.order = 1;
    }
}