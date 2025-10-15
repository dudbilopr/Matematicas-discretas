document.addEventListener('DOMContentLoaded', () => {
    // --- REFERENCIAS AL DOM ---
    const sandboxContainer = document.getElementById('sandbox-container');
    const sandbox = document.getElementById('sandbox');
    const svg = document.getElementById('wire-svg');
    const selectionBox = document.getElementById('selection-box');
    const modal = document.getElementById('info-modal');
    const truthTablePanel = document.getElementById('truth-table-panel');

    // --- ESTADO DE LA APLICACIÓN ---
    let components = [];
    let wires = [];
    let selectedComponents = [];
    let nextId = 0;
    
    const viewport = { x: 0, y: 0, zoom: 1, isPanning: false, panStartX: 0, panStartY: 0 };
    let interactionState = { wiring: null, dragging: null, isSelecting: false, selectionStartX: 0, selectionStartY: 0 };

    // --- BASE DE DATOS DE INFORMACIÓN DE COMPONENTES ---
    const componentInfo = {
        'AND': { title: 'Compuerta AND', explanation: 'La compuerta AND (Y) produce una salida ALTA (1) únicamente si todas sus entradas son ALTAS (1). Si alguna de sus entradas es BAJA (0), la salida será BAJA (0).', expression: 'Q = A ⋅ B', truthTable: { headers: ['Entrada A', 'Entrada B', 'Salida Q'], rows: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]] } },
        'OR': { title: 'Compuerta OR', explanation: 'La compuerta OR (O) produce una salida ALTA (1) si al menos una de sus entradas es ALTA (1). La salida solo será BAJA (0) si todas sus entradas son BAJAS (0).', expression: 'Q = A + B', truthTable: { headers: ['Entrada A', 'Entrada B', 'Salida Q'], rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]] } },
        'NOT': { title: 'Compuerta NOT (Inversor)', explanation: 'La compuerta NOT, también conocida como inversor, tiene una sola entrada y produce una salida que es el estado lógico opuesto. Si la entrada es ALTA (1), la salida es BAJA (0), y viceversa.', expression: 'Q = ¬A', truthTable: { headers: ['Entrada A', 'Salida Q'], rows: [[0, 1], [1, 0]] } },
        'XOR': { title: 'Compuerta XOR (O Exclusiva)', explanation: 'La compuerta XOR (O exclusiva) produce una salida ALTA (1) solo si sus entradas son diferentes entre sí. Si las entradas son iguales, la salida es BAJA (0).', expression: 'Q = A ⊕ B', truthTable: { headers: ['Entrada A', 'Entrada B', 'Salida Q'], rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]] } },
        'NAND': { title: 'Compuerta NAND (NO Y)', explanation: 'La compuenta NAND es la negación de una compuerta AND. Produce una salida BAJA (0) solo si todas sus entradas son ALTAS (1). En cualquier otro caso, la salida es ALTA (1).', expression: 'Q = ¬(A ⋅ B)', truthTable: { headers: ['Entrada A', 'Entrada B', 'Salida Q'], rows: [[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]] } },
        'NOR': { title: 'Compuerta NOR (NO O)', explanation: 'La compuerta NOR es la negación de una compuerta OR. Produce una salida ALTA (1) únicamente si todas sus entradas son BAJAS (0). Si alguna entrada es ALTA (1), la salida es BAJA (0).', expression: 'Q = ¬(A + B)', truthTable: { headers: ['Entrada A', 'Entrada B', 'Salida Q'], rows: [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 0]] } },
        'XNOR': { title: 'Compuerta XNOR (NO O Exclusiva)', explanation: 'La compuerta XNOR es la negación de una XOR. Produce una salida ALTA (1) solo si sus entradas son iguales. Si las entradas son diferentes, la salida es BAJA (0).', expression: 'Q = ¬(A ⊕ B)', truthTable: { headers: ['Entrada A', 'Entrada B', 'Salida Q'], rows: [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 1]] } },
        'D_FLIP_FLOP': { title: 'Flip-Flop Tipo D', explanation: 'El Flip-Flop Tipo D (Data) es un bloque de memoria fundamental. Almacena el valor de la entrada D en la salida Q, pero solo en el momento preciso en que la entrada de reloj (CLK) cambia de BAJO a ALTO (flanco de subida). La salida Q mantiene su valor hasta el siguiente flanco de subida.', expression: 'Qₙ₊₁ = D', truthTable: { headers: ['CLK', 'Entrada D', 'Salida Q', 'Salida Q̅'], rows: [['↑', 0, 0, 1], ['↑', 1, 1, 0]] } }
    };

    // --- LÓGICA DEL VIEWPORT Y DE INTERACCIÓN ---
    function applyTransform() { const transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`; sandbox.style.transform = transform; svg.style.transform = transform; document.getElementById('zoom-level').textContent = `Zoom: ${Math.round(viewport.zoom * 100)}%`; }
    function screenToWorld(x, y) { return { x: (x - viewport.x) / viewport.zoom, y: (y - viewport.y) / viewport.zoom }; }

    function initializeEventListeners() {
        sandboxContainer.addEventListener('wheel', e => { e.preventDefault(); const rect = sandboxContainer.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const worldBefore = screenToWorld(mouseX, mouseY); const zoomAmount = e.deltaY < 0 ? 1.1 : 1 / 1.1; viewport.zoom = Math.max(0.2, Math.min(viewport.zoom * zoomAmount, 3)); const worldAfter = screenToWorld(mouseX, mouseY); viewport.x += (worldAfter.x - worldBefore.x) * viewport.zoom; viewport.y += (worldAfter.y - worldBefore.y) * viewport.zoom; applyTransform(); });
        sandboxContainer.addEventListener('mousedown', e => { if (e.button !== 0 && e.button !== 1) return; const rect = sandboxContainer.getBoundingClientRect(); if (document.body.classList.contains('space-pressed') || e.button === 1) { viewport.isPanning = true; viewport.panStartX = e.clientX; viewport.panStartY = e.clientY; sandboxContainer.style.cursor = 'grabbing'; return; } if (e.shiftKey) { interactionState.isSelecting = true; interactionState.selectionStartX = e.clientX - rect.left; interactionState.selectionStartY = e.clientY - rect.top; Object.assign(selectionBox.style, { left: `${interactionState.selectionStartX}px`, top: `${interactionState.selectionStartY}px`, width: '0px', height: '0px', display: 'block' }); clearSelection(); return; } if (!e.target.closest('.component')) clearSelection(); });
        window.addEventListener('mousemove', e => { if (viewport.isPanning) { const dx = e.clientX - viewport.panStartX; const dy = e.clientY - viewport.panStartY; viewport.x += dx; viewport.y += dy; viewport.panStartX = e.clientX; viewport.panStartY = e.clientY; applyTransform(); return; } if (interactionState.isSelecting) { const rect = sandboxContainer.getBoundingClientRect(); const currentX = e.clientX - rect.left; const currentY = e.clientY - rect.top; const { selectionStartX, selectionStartY } = interactionState; const x = Math.min(selectionStartX, currentX); const y = Math.min(selectionStartY, currentY); const width = Math.abs(selectionStartX - currentX); const height = Math.abs(selectionStartY - currentY); Object.assign(selectionBox.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` }); } if (interactionState.dragging) { const dx = e.clientX - interactionState.dragging.lastX; const dy = e.clientY - interactionState.dragging.lastY; selectedComponents.forEach(comp => comp.moveTo(comp.x + dx / viewport.zoom, comp.y + dy / viewport.zoom)); interactionState.dragging.lastX = e.clientX; interactionState.dragging.lastY = e.clientY; updateWirePositions(); } });
        window.addEventListener('mouseup', () => { if (viewport.isPanning) { viewport.isPanning = false; if (!document.body.classList.contains('space-pressed')) sandboxContainer.style.cursor = 'default'; } if (interactionState.isSelecting) { interactionState.isSelecting = false; selectionBox.style.display = 'none'; selectComponentsInBox(); } interactionState.dragging = null; });
        window.addEventListener('keydown', e => { if (e.code === 'Space' && !document.body.classList.contains('space-pressed')) { document.body.classList.add('space-pressed'); sandboxContainer.style.cursor = 'grab'; } if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement.getAttribute('contenteditable') !== 'true') { e.preventDefault(); [...selectedComponents].forEach(comp => removeComponent(comp.id)); clearSelection(); } });
        window.addEventListener('keyup', e => { if (e.code === 'Space') { document.body.classList.remove('space-pressed'); if (!viewport.isPanning) sandboxContainer.style.cursor = 'default'; } });
        document.querySelectorAll('.add-component').forEach(btn => { btn.addEventListener('click', e => { if (e.target.closest('span') && componentInfo[btn.dataset.type]) showInfoModal(btn.dataset.type); }); btn.setAttribute('draggable', 'true'); btn.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', btn.dataset.type)); });
        sandboxContainer.addEventListener('dragover', e => e.preventDefault());
        sandboxContainer.addEventListener('drop', e => { e.preventDefault(); const type = e.dataTransfer.getData('text/plain'); if (!type) return; const rect = sandboxContainer.getBoundingClientRect(); const worldCoords = screenToWorld(e.clientX - rect.left, e.clientY - rect.top); createComponent(type, worldCoords.x - 40, worldCoords.y - 30); });
        modal.addEventListener('click', e => { if (e.target === modal || e.target.classList.contains('modal-close-btn')) hideInfoModal(); });
        document.getElementById('save-button').addEventListener('click', saveCircuit);
        document.getElementById('load-button').addEventListener('click', loadCircuit);
        
        // ### LÍNEA CORREGIDA Y AÑADIDA ###
        document.getElementById('generate-truth-table-btn').addEventListener('click', generateTruthTable);
        initializeTablePanelDrag();
    }

    // --- LÓGICA DE SELECCIÓN Y COMPONENTES (sin cambios) ---
    function updateSelectionVisuals() { components.forEach(c => c.element.classList.toggle('selected', selectedComponents.includes(c))); document.getElementById('selection-count').textContent = `Seleccionados: ${selectedComponents.length}`; }
    function clearSelection() { selectedComponents = []; updateSelectionVisuals(); }
    function selectComponent(component, addToSelection = false) { if (!addToSelection) clearSelection(); if (!selectedComponents.includes(component)) selectedComponents.push(component); updateSelectionVisuals(); }
    function selectComponentsInBox() { const boxRect = selectionBox.getBoundingClientRect(); components.forEach(comp => { const compRect = comp.element.getBoundingClientRect(); if (boxRect.left < compRect.right && boxRect.right > compRect.left && boxRect.top < compRect.bottom && boxRect.bottom > compRect.top) { if (!selectedComponents.includes(comp)) selectedComponents.push(comp); } }); updateSelectionVisuals(); }
    class Component {
        constructor(type, x, y) {
            this.id = `comp-${nextId++}`; this.type = type; this.x = x; this.y = y;
            this.element = document.createElement('div');
            Object.assign(this.element, { id: this.id, className: `component ${type}` });
            this.moveTo(x, y);
            this.inputs = []; this.outputs = [];
            sandbox.appendChild(this.element);
            this.element.addEventListener('mousedown', e => { if (e.button !== 0 || e.target.classList.contains('node')) return; e.stopPropagation(); if (!selectedComponents.includes(this)) selectComponent(this, e.shiftKey); interactionState.dragging = { lastX: e.clientX, lastY: e.clientY }; });
            if (this.type !== 'LABEL') {
                this.element.addEventListener('dblclick', e => { e.stopPropagation(); removeComponent(this.id); });
            }
        }
        moveTo(x, y) { this.x = x; this.y = y; this.element.style.left = `${x}px`; this.element.style.top = `${y}px`; }
        addNode(type, position, name = '') { const nodeEl = document.createElement('div'); nodeEl.className = `node node-${type} node-${type}-${position}`; const node = { element: nodeEl, value: 0, connections: [], name, parent: this }; if (type === 'in') { node.id = `${this.id}-in-${this.inputs.length}`; this.inputs.push(node); } else { node.id = `${this.id}-out-${this.outputs.length}`; this.outputs.push(node); } this.element.appendChild(nodeEl); nodeEl.addEventListener('click', e => { e.stopPropagation(); handleNodeClick(node); }); return node; }
        calculate() {}
        destroy() { this.element.remove(); }
    }
    class Label extends Component { constructor(x, y, text = 'Etiqueta') { super('LABEL', x, y); this.element.textContent = text; this.element.setAttribute('contenteditable', 'false'); this.element.addEventListener('dblclick', e => { e.stopPropagation(); this.element.setAttribute('contenteditable', 'true'); this.element.focus(); }); this.element.addEventListener('blur', () => this.element.setAttribute('contenteditable', 'false')); this.element.addEventListener('keydown', e => e.stopPropagation()); } }
    class Input extends Component { constructor(x, y) { super('INPUT', x, y); this.element.classList.add('input-switch'); this.element.innerHTML = `<span>I</span>`; const outNode = this.addNode('out', 'single'); this.element.addEventListener('click', e => { if(e.target.closest('.node')) return; outNode.value = outNode.value === 1 ? 0 : 1; this.element.classList.toggle('on', outNode.value === 1); propagateSignal(); }); } }
    class Output extends Component { constructor(x, y) { super('OUTPUT', x, y); this.element.classList.add('output-light'); this.element.innerHTML = `<span>💡</span>`; this.addNode('in', 'single'); } calculate() { const on = this.inputs[0].value === 1; this.element.classList.toggle('on', on); } }
    class Clock extends Component { constructor(x, y) { super('CLOCK', x, y); const outNode = this.addNode('out', 'single'); this.element.innerHTML = '🕒'; this.interval = setInterval(() => { outNode.value = outNode.value === 1 ? 0 : 1; this.element.classList.toggle('on', outNode.value === 1); propagateSignal(); }, 1000); } destroy() { super.destroy(); clearInterval(this.interval); } }
    class Gate extends Component { constructor(type, numInputs, x, y) { super(type, x, y); if (numInputs === 1) this.addNode('in', 'single'); else { this.addNode('in', '1'); this.addNode('in', '2'); } this.addNode('out', 'single'); } }
    class And extends Gate { constructor(x, y) { super('AND', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value && this.inputs[1].value) ? 1 : 0; } }
    class Or extends Gate { constructor(x, y) { super('OR', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value || this.inputs[1].value) ? 1 : 0; } }
    class Not extends Gate { constructor(x, y) { super('NOT', 1, x, y); } calculate() { this.outputs[0].value = this.inputs[0].value ? 0 : 1; } }
    class Xor extends Gate { constructor(x, y) { super('XOR', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value !== this.inputs[1].value) ? 1 : 0; } }
    class Nand extends Gate { constructor(x, y) { super('NAND', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value && this.inputs[1].value) ? 0 : 1; } }
    class Nor extends Gate { constructor(x, y) { super('NOR', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value || this.inputs[1].value) ? 0 : 1; } }
    class Xnor extends Gate { constructor(x, y) { super('XNOR', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value === this.inputs[1].value) ? 1 : 0; } }
    class DFlipFlop extends Component { constructor(x, y) { super('D_FLIP_FLOP', x, y); this.element.innerHTML = `<div class="dff-main"><span class="dff-label">D</span><span class="dff-label">Q</span></div><div class="dff-main"><span class="dff-label">▶</span><span class="dff-label">Q</span></div>`; this.state = 0; this.lastClock = 0; this.addNode('in', '1 dff-d-node', 'D'); this.addNode('in', '2 dff-clk-node', 'CLK'); this.addNode('out', '1', 'Q'); this.addNode('out', '2', 'Q_BAR'); } calculate() { const clock = this.inputs[1].value; if (clock === 1 && this.lastClock === 0) this.state = this.inputs[0].value; this.lastClock = clock; this.outputs[0].value = this.state; this.outputs[1].value = this.state ? 0 : 1; } }
    const componentClasses = { 'LABEL': Label, 'INPUT': Input, 'OUTPUT': Output, 'CLOCK': Clock, 'AND': And, 'OR': Or, 'NOT': Not, 'XOR': Xor, 'NAND': Nand, 'NOR': Nor, 'XNOR': Xnor, 'D_FLIP_FLOP': DFlipFlop };
    function createComponent(type, x, y, text) { if (componentClasses[type]) components.push(new componentClasses[type](x, y, text)); }

    // --- LÓGICA DE CABLES Y SEÑALES ---
    function handleNodeClick(node) { const isOutputNode = node.parent.outputs.includes(node); if (!interactionState.wiring && isOutputNode) { interactionState.wiring = { startNode: node }; node.element.style.border = '2px solid var(--accent-primary)'; } else if (interactionState.wiring && !isOutputNode) { if (interactionState.wiring.startNode.parent === node.parent || node.connections.length > 0) { resetWiring(); return; } createWire(interactionState.wiring.startNode, node); resetWiring(); propagateSignal(); } else { resetWiring(); } }
    function createWire(startNode, endNode) { const wire = { id: `wire-${nextId++}`, startNode, endNode, path: document.createElementNS('http://www.w3.org/2000/svg', 'path') }; wire.path.classList.add('wire-path'); wire.path.setAttribute('data-id', wire.id); wire.path.addEventListener('dblclick', e => { e.stopPropagation(); removeWire(wire.id); }); svg.appendChild(wire.path); startNode.connections.push(wire); endNode.connections.push(wire); wires.push(wire); propagateSignal(); }
    function resetWiring() { if (interactionState.wiring) interactionState.wiring.startNode.element.style.border = ''; interactionState.wiring = null; }
    function propagateSignal() { const iterations = components.length + 1; for (let i = 0; i < iterations; i++) { for (const comp of components) { if (comp.type !== 'LABEL') { for (const input of comp.inputs) { input.value = 0; if (input.connections.length > 0) input.value = input.connections[0].startNode.value; } } } for (const comp of components) comp.calculate(); } updateVisuals(); }
    function updateVisuals() { components.forEach(comp => { [...comp.inputs, ...comp.outputs].forEach(node => node.element.classList.toggle('on', node.value === 1)); }); wires.forEach(wire => wire.path.classList.toggle('on', wire.startNode.value === 1)); updateWirePositions(); }
    function updateWirePositions() { for (const wire of wires) { const { startNode, endNode, path } = wire; const startComp = startNode.parent; const endComp = endNode.parent; const x1 = startComp.x + startNode.element.offsetLeft + startNode.element.offsetWidth / 2; const y1 = startComp.y + startNode.element.offsetTop + startNode.element.offsetHeight / 2; const x2 = endComp.x + endNode.element.offsetLeft + endNode.element.offsetWidth / 2; const y2 = endComp.y + endNode.element.offsetTop + endNode.element.offsetHeight / 2; const dx = Math.abs(x1 - x2) * 0.5; path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`); } }

    // --- LÓGICA DE ELIMINACIÓN, GUARDADO Y CARGA ---
    function removeComponent(id) { const compIndex = components.findIndex(c => c.id === id); if(compIndex === -1) return; const comp = components[compIndex]; [...comp.inputs, ...comp.outputs].forEach(node => [...node.connections].forEach(wire => removeWire(wire.id))); if (comp.destroy) comp.destroy(); components.splice(compIndex, 1); selectedComponents = selectedComponents.filter(c => c.id !== id); updateSelectionVisuals(); propagateSignal(); }
    function removeWire(id) { const wireIndex = wires.findIndex(w => w.id === id); if(wireIndex === -1) return; const wire = wires[wireIndex]; const { startNode, endNode } = wire; startNode.connections = startNode.connections.filter(w => w.id !== id); endNode.connections = endNode.connections.filter(w => w.id !== id); wire.path.remove(); wires.splice(wireIndex, 1); propagateSignal(); }
    function saveCircuit() { const circuitData = { components: components.map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y, text: c.type === 'LABEL' ? c.element.textContent : undefined })), wires: wires.map(w => ({ startNodeId: w.startNode.id, endNodeId: w.endNode.id })) }; localStorage.setItem('logicCircuitPro', JSON.stringify(circuitData)); alert('¡Circuito guardado!'); }
    function clearCircuit() { components.filter(c => c.type === 'CLOCK').forEach(c => clearInterval(c.interval)); sandbox.innerHTML = ''; svg.innerHTML = ''; components = []; wires = []; selectedComponents = []; updateSelectionVisuals(); }
    function loadCircuit() { const saved = localStorage.getItem('logicCircuitPro'); if (!saved) { alert('No hay ningún circuito guardado.'); return; } clearCircuit(); const circuitData = JSON.parse(saved); const idMap = {}; for (const compData of circuitData.components) { createComponent(compData.type, compData.x, compData.y, compData.text); const newComp = components[components.length - 1]; idMap[compData.id] = newComp.id; } const findNodeById = (id) => { const [oldCompId, type, index] = id.split(/-(in|out)-/); const newCompId = idMap[oldCompId]; const comp = components.find(c => c.id === newCompId); if (!comp) return null; return type === 'in' ? comp.inputs[index] : comp.outputs[index]; }; for (const wireData of circuitData.wires) { const startNode = findNodeById(wireData.startNodeId); const endNode = findNodeById(wireData.endNodeId); if (startNode && endNode) createWire(startNode, endNode); } propagateSignal(); }

    // --- LÓGICA DEL PANEL DE TABLA DE VERDAD ---
    function initializeTablePanelDrag() {
        const header = document.getElementById('truth-table-header');
        let offsetX, offsetY, isDragging = false;
        header.addEventListener('mousedown', e => { isDragging = true; offsetX = e.clientX - truthTablePanel.offsetLeft; offsetY = e.clientY - truthTablePanel.offsetTop; window.addEventListener('mousemove', movePanel); window.addEventListener('mouseup', stopMovePanel); });
        const movePanel = e => { if (isDragging) { truthTablePanel.style.left = `${e.clientX - offsetX}px`; truthTablePanel.style.top = `${e.clientY - offsetY}px`; } };
        const stopMovePanel = () => { isDragging = false; window.removeEventListener('mousemove', movePanel); window.removeEventListener('mouseup', stopMovePanel); };
        document.getElementById('close-table-btn').addEventListener('click', () => truthTablePanel.classList.add('hidden'));
    }

    function generateTruthTable() {
        const inputs = components.filter(c => c.type === 'INPUT');
        const outputs = components.filter(c => c.type === 'OUTPUT');
        if (inputs.length === 0 || outputs.length === 0) { alert("El circuito debe tener al menos una Entrada (Switch) y una Salida (Luz)."); return; }
        if (inputs.length > 8) { alert(`La generación de tablas está limitada a 8 entradas. (Tu circuito tiene ${inputs.length})`); return; }
        const originalInputStates = inputs.map(input => input.outputs[0].value);
        const headers = [...inputs.map((_, i) => `In ${i + 1}`), ...outputs.map((_, i) => `Out ${i + 1}`), ''];
        const tableRows = [];
        const numCombinations = 2 ** inputs.length;
        for (let i = 0; i < numCombinations; i++) {
            const currentRow = [];
            inputs.forEach((input, j) => { const value = (i >> (inputs.length - 1 - j)) & 1; input.outputs[0].value = value; currentRow.push(value); });
            propagateSignal();
            outputs.forEach(output => { currentRow.push(output.inputs[0].value); });
            tableRows.push(currentRow);
        }
        inputs.forEach((input, i) => { input.outputs[0].value = originalInputStates[i]; });
        propagateSignal();
        const table = document.getElementById('dynamic-truth-table');
        table.innerHTML = '';
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; headerRow.appendChild(th); });
        const tbody = table.createTBody();
        tableRows.forEach(rowData => { const row = tbody.insertRow(); rowData.forEach(cellData => { const cell = row.insertCell(); cell.textContent = cellData; }); const deleteCell = row.insertCell(); const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '🗑️'; deleteBtn.className = 'delete-row-btn'; deleteBtn.onclick = () => row.remove(); deleteCell.appendChild(deleteBtn); });
        truthTablePanel.classList.remove('hidden');
    }

    // --- LÓGICA DEL MODAL DE INFORMACIÓN (sin cambios) ---
    function showInfoModal(type) { if (type === 'TRUTH_TABLE_CUSTOM') { return; } const info = componentInfo[type]; if (!info) return; document.getElementById('modal-title').textContent = info.title; document.getElementById('modal-explanation').textContent = info.explanation; document.getElementById('modal-expression').textContent = info.expression; document.getElementById('modal-symbol').className = `component ${type}`; const table = document.getElementById('modal-truth-table'); table.innerHTML = ''; const thead = table.createTHead(); const headerRow = thead.insertRow(); info.truthTable.headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; headerRow.appendChild(th); }); const tbody = table.createTBody(); info.truthTable.rows.forEach(rowData => { const row = tbody.insertRow(); rowData.forEach(cellData => { const cell = row.insertCell(); cell.textContent = cellData; }); }); modal.classList.remove('hidden'); }
    function hideInfoModal() { modal.classList.add('hidden'); }

    // --- INICIALIZACIÓN ---
    initializeEventListeners();
    applyTransform();
});
