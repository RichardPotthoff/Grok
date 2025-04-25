export function setupStyles() {
    const sty = document.createElement('style');
    sty.textContent = `
        body { margin: 0; font-family: Arial, sans-serif; }
        .container { display: grid; grid-template-columns: 300px 1fr; height: 100vh; overflow: hidden; }
        .controls { padding: 10px; overflow-y: auto; border-right: 1px solid #ccc; }
        .canvas-container { position: relative; overflow: hidden; }
        canvas { border: 1px solid black; display: block; width: 100%; height: 100%; }
        .tabs { display: flex; border-bottom: 1px solid #ccc; }
        .tab { padding: 10px; cursor: pointer; background-color: #f0f0f0; border-right: 1px solid #ccc; }
        .tab.active { background-color: #fff; font-weight: bold; }
        .tab-content { display: none; padding: 10px; }
        .tab-content.active { display: block; }
        .current-segment { margin: 10px 0; font-size: 14px; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        table, th, td { border: 1px solid black; }
        th, td { padding: 3px; text-align: center; }
        th:nth-child(1), td:nth-child(1) { width: 40px; }
        th:nth-child(2), td:nth-child(2) { width: 120px; }
        th:nth-child(3), td:nth-child(3) { width: 120px; }
        td input[type="number"] { width: 90px; padding: 2px; }
        .selected { background-color: #d3d3d3; }
        .scrollable-table { max-height: 300px; overflow-y: auto; }
        .control-buttons { margin: 10px 0; }
        .control-buttons button { margin: 0 5px; padding: 5px 10px; }
        .settings-option { margin: 10px 0; }
        @media (max-width: 768px) {
            .container { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; }
            .controls { border-right: none; border-bottom: 1px solid #ccc; }
            .scrollable-table { max-height: 200px; }
            th:nth-child(1), td:nth-child(1) { width: 30px; }
            th:nth-child(2), td:nth-child(2) { width: 100px; }
            th:nth-child(3), td:nth-child(3) { width: 100px; }
            td input[type="number"] { width: 70px; }
        }
    `;
    document.head.appendChild(sty);
}