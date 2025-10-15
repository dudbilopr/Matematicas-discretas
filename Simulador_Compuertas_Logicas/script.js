document.addEventListener('DOMContentLoaded', () => {
    const sandbox = document.getElementById('sandbox');
    const svg = document.getElementById('wire-svg');

    let components = [];
    let wires = [];
    let nextId = 0;
    let wiring = null;
    let dragging = null;
    let clockIntervals = [];

    // --- CLASES DE COMPONENTES (La mayoría sin cambios en su lógica interna) ---
    class Component {
        constructor(type, x, y) {
            this.id = `comp-${nextId++}`;
            this.type = type;
            this.element = document.createElement('div');
            this.element.id = this.id;
            this.element.className = `component ${type}`;
            this.element.style.left = `${x}px`;
            this.element.style.top = `${y}px`;
            this.element.dataset.id = this.id;

            this.inputs = [];
            this.outputs = [];

            sandbox.appendChild(this.element);
            this.makeDraggable();
            this.element.addEventListener('dblclick', () => removeComponent(this.id));
        }

        addNode(type, position, name = '') {
            const nodeEl = document.createElement('div');
            nodeEl.className = `node node-${type} node-${type}-${position}`;
            const node = { element: nodeEl, value: 0, connections: [], name: name, parent: this };

            if (type === 'in') {
                node.id = `${this.id}-in-${this.inputs.length}`;
                nodeEl.dataset.nodeId = node.id;
                this.inputs.push(node);
            } else {
                node.id = `${this.id}-out-${this.outputs.length}`;
                nodeEl.dataset.nodeId = node.id;
                this.outputs.push(node);
            }
            this.element.appendChild(nodeEl);
            nodeEl.addEventListener('click', (e) => { e.stopPropagation(); handleNodeClick(node); });
            return node;
        }

        makeDraggable() {
            this.element.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('node')) return;
                dragging = {
                    component: this,
                    offsetX: e.clientX - this.element.offsetLeft,
                    offsetY: e.clientY - this.element.offsetTop
                };
            });
        }
        
        calculate() { /* Sobrescribir en clases hijas */ }

        destroy() {
            this.element.remove();
        }
    }

    class Input extends Component {
        constructor(x, y) {
            super('INPUT', x, y);
            this.element.classList.add('input-switch');
            this.element.innerHTML = `<span>I</span>`;
            const outNode = this.addNode('out', 'single');
            this.element.addEventListener('click', () => {
                outNode.value = outNode.value === 1 ? 0 : 1;
                this.element.classList.toggle('on', outNode.value === 1);
                propagateSignal();
            });
        }
    }
    
    class Output extends Component {
        constructor(x, y) {
            super('OUTPUT', x, y);
            this.element.classList.add('output-light');
            this.element.innerHTML = `<span>💡</span>`;
            this.addNode('in', 'single');
        }
        calculate() {
            const on = this.inputs[0].value === 1;
            this.element.classList.toggle('on', on);
        }
    }
    
    class Clock extends Component {
        constructor(x, y) {
            super('CLOCK', x, y);
            const outNode = this.addNode('out', 'single');
            this.element.innerHTML = '🕒';
            const interval = setInterval(() => {
                outNode.value = outNode.value === 1 ? 0 : 1;
                this.element.classList.toggle('on', outNode.value === 1);
                propagateSignal();
            }, 1000);
            clockIntervals.push(interval);
        }
         destroy() {
            super.destroy();
            clockIntervals.forEach(clearInterval);
            clockIntervals = [];
        }
    }

    class Gate extends Component {
        constructor(type, numInputs, x, y) {
            super(type, x, y);
            if (numInputs === 1) {
                this.addNode('in', 'single');
            } else {
                this.addNode('in', '1');
                this.addNode('in', '2');
            }
            this.addNode('out', 'single');
        }
    }
    
    class AND extends Gate { constructor(x, y) { super('AND', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value && this.inputs[1].value) ? 1 : 0; } }
    class OR extends Gate { constructor(x, y) { super('OR', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value || this.inputs[1].value) ? 1 : 0; } }
    class NOT extends Gate { constructor(x, y) { super('NOT', 1, x, y); } calculate() { this.outputs[0].value = this.inputs[0].value ? 0 : 1; } }
    class XOR extends Gate { constructor(x, y) { super('XOR', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value !== this.inputs[1].value) ? 1 : 0; } }
    class NAND extends Gate { constructor(x, y) { super('NAND', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value && this.inputs[1].value) ? 0 : 1; } }
    class NOR extends Gate { constructor(x, y) { super('NOR', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value || this.inputs[1].value) ? 0 : 1; } }
    class XNOR extends Gate { constructor(x, y) { super('XNOR', 2, x, y); } calculate() { this.outputs[0].value = (this.inputs[0].value === this.inputs[1].value) ? 1 : 0; } }
    
    class DFlipFlop extends Component {
        constructor(x, y) {
            super('D_FLIP_FLOP', x, y);
            this.element.innerHTML = `<div class="dff-main"><span class="dff-label">D</span><span class="dff-label">Q</span></div><div class="dff-main"><span class="dff-label">▶</span><span class="dff-label">Q</span></div>`;
            this.state = 0;
            this.lastClock = 0;
            this.addNode('in', '1 dff-d-node', 'D');
            this.addNode('in', '2 dff-clk-node', 'CLK');
            this.addNode('out', '1', 'Q');
            this.addNode('out', '2', 'Q_BAR');
        }

        calculate() {
            const clock = this.inputs[1].value;
            if (clock === 1 && this.lastClock === 0) { // Rising edge
                this.state = this.inputs[0].value;
            }
            this.lastClock = clock;
            this.outputs[0].value = this.state;
            this.outputs[1].value = this.state ? 0 : 1;
        }
    }
    
    const componentClasses = { INPUT: Input, OUTPUT: Output, CLOCK: Clock, AND: AND, OR: OR, NOT: NOT, XOR: XOR, NAND: NAND, NOR: NOR, XNOR: XNOR, D_FLIP_FLOP: DFlipFlop };
    
    function createComponent(type, x = 150, y = 150) {
        if (componentClasses[type]) {
            components.push(new componentClasses[type](x, y));
        }
    }
    
    // --- LÓGICA DE CABLES Y SEÑALES ---
    function handleNodeClick(node) {
        const isOutputNode = node.id.includes('-out-');
        if (!wiring && isOutputNode) {
            wiring = { startNode: node };
            node.element.style.border = '2px solid var(--accent-primary)';
        } else if (wiring && !isOutputNode) {
            if (wiring.startNode.parent === node.parent || node.connections.length > 0) {
                 resetWiring();
                 return;
            }
            createWire(wiring.startNode, node);
            resetWiring();
            propagateSignal();
        } else {
             resetWiring();
        }
    }

    function createWire(startNode, endNode) {
        const wire = {
            id: `wire-${nextId++}`,
            startNode: startNode,
            endNode: endNode,
            path: document.createElementNS('http://www.w3.org/2000/svg', 'path')
        };
        wire.path.classList.add('wire-path');
        wire.path.dataset.id = wire.id;
        wire.path.addEventListener('dblclick', () => removeWire(wire.id));
        svg.appendChild(wire.path);

        startNode.connections.push(wire);
        endNode.connections.push(wire);
        wires.push(wire);
        updateWirePositions();
    }
    
    function resetWiring() {
        if (wiring) {
            wiring.startNode.element.style.border = '';
        }
        wiring = null;
    }
    
    function propagateSignal() {
        for (let i = 0; i < components.length; i++) {
            components.forEach(comp => {
                comp.inputs.forEach(input => {
                    input.value = 0;
                    input.connections.forEach(wire => {
                        input.value = wire.startNode.value;
                    });
                });
            });
            components.forEach(comp => comp.calculate());
        }
        updateVisuals();
    }

    function updateVisuals() {
        components.forEach(comp => {
            [...comp.inputs, ...comp.outputs].forEach(node => {
                node.element.classList.toggle('on', node.value === 1);
            });
        });
        wires.forEach(wire => {
            wire.path.classList.toggle('on', wire.startNode.value === 1);
        });
        updateWirePositions();
    }

    function updateWirePositions() {
        const sandboxRect = sandbox.getBoundingClientRect();
        wires.forEach(wire => {
            const startRect = wire.startNode.element.getBoundingClientRect();
            const endRect = wire.endNode.element.getBoundingClientRect();
            const x1 = startRect.left + startRect.width / 2 - sandboxRect.left;
            const y1 = startRect.top + startRect.height / 2 - sandboxRect.top;
            const x2 = endRect.left + endRect.width / 2 - sandboxRect.left;
            const y2 = endRect.top + endRect.height / 2 - sandboxRect.top;
            
            // Dibuja la curva de Bézier
            const dx = Math.abs(x1 - x2) * 0.5;
            const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
            wire.path.setAttribute('d', pathData);
        });
    }

    // --- ELIMINACIÓN, GUARDADO Y CARGA (Sin cambios) ---
    function findComponentById(id) { return components.find(c => c.id === id); }
    function findNodeById(id) {
        for (const comp of components) {
            const node = [...comp.inputs, ...comp.outputs].find(n => n.id === id);
            if (node) return node;
        }
        return null;
    }

    function removeComponent(id) {
        const comp = findComponentById(id);
        if (!comp) return;
        [...comp.inputs, ...comp.outputs].forEach(node => {
            [...node.connections].forEach(wire => removeWire(wire.id));
        });
        if (comp.destroy) comp.destroy();
        components = components.filter(c => c.id !== id);
    }
    
    function removeWire(id) {
        const wire = wires.find(w => w.id === id);
        if (!wire) return;
        wire.startNode.connections = wire.startNode.connections.filter(w => w.id !== id);
        wire.endNode.connections = wire.endNode.connections.filter(w => w.id !== id);
        wire.path.remove();
        wires = wires.filter(w => w.id !== id);
        propagateSignal();
    }

    function saveCircuit() {
        const circuit = {
            components: components.map(c => ({
                id: c.id, type: c.type, x: c.element.offsetLeft, y: c.element.offsetTop
            })),
            wires: wires.map(w => ({
                id: w.id, startNodeId: w.startNode.id, endNodeId: w.endNode.id
            }))
        };
        localStorage.setItem('logicCircuitPro', JSON.stringify(circuit));
        alert('¡Circuito guardado!');
    }

    function loadCircuit() {
        const savedCircuit = localStorage.getItem('logicCircuitPro');
        if (!savedCircuit) { alert('No hay ningún circuito guardado.'); return; }
        
        [...components].forEach(c => removeComponent(c.id));
        wires = []; components = []; svg.innerHTML = ''; clockIntervals.forEach(clearInterval); clockIntervals = [];

        const circuit = JSON.parse(savedCircuit);
        const idMap = {};

        circuit.components.forEach(compData => {
            const newComp = new componentClasses[compData.type](compData.x, compData.y);
            idMap[compData.id] = newComp.id;
            components[components.length - 1] = newComp;
        });
        
        circuit.wires.forEach(wireData => {
            const startComp = components.find(c => c.id === idMap[wireData.startNodeId.split('-out-')[0]]);
            const endComp = components.find(c => c.id === idMap[wireData.endNodeId.split('-in-')[0]]);
            
            if (startComp && endComp) {
                const startNodeIndex = parseInt(wireData.startNodeId.split('-out-')[1]);
                const endNodeIndex = parseInt(wireData.endNodeId.split('-in-')[1]);
                createWire(startComp.outputs[startNodeIndex], endComp.inputs[endNodeIndex]);
            }
        });
        propagateSignal();
    }

    // --- EVENT LISTENERS ---
    document.querySelectorAll('.add-component').forEach(btn => {
        btn.addEventListener('click', () => createComponent(btn.dataset.type));
    });
    document.getElementById('save-button').addEventListener('click', saveCircuit);
    document.getElementById('load-button').addEventListener('click', loadCircuit);
    
    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        let x = e.clientX - dragging.offsetX;
        let y = e.clientY - dragging.offsetY;
        x = Math.max(0, Math.min(x, sandbox.clientWidth - dragging.component.element.offsetWidth));
        y = Math.max(0, Math.min(y, sandbox.clientHeight - dragging.component.element.offsetHeight));
        dragging.component.element.style.left = `${x}px`;
        dragging.component.element.style.top = `${y}px`;
        updateWirePositions();
    });
    
    document.addEventListener('mouseup', () => { dragging = null; });
    sandbox.addEventListener('click', resetWiring);
});