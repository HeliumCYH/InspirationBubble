/**
 * app.js - Main application logic for Inspiration Bubble
 */

// Global data object
const brainstormData = {
    thoughts: [],
    allKeywords: [],
    connections: [],
    summary: "",
    keywords: [],
    inspiration: [],
    voiceTextHistory: [],
    zoom: {
        scale: 1,
        min: 0.2,
        max: 3
    }
};

// --- Local Storage Logic ---
const saveToLocalStorage = () => {
    localStorage.setItem("brainstormData_MVP", JSON.stringify(brainstormData));
};

const loadFromLocalStorage = () => {
    const data = localStorage.getItem("brainstormData_MVP");
    if (data) {
        const parsed = JSON.parse(data);
        Object.assign(brainstormData, parsed);
        return true;
    }
    return false;
};

const clearAllData = () => {
    if (confirm("确定要清空所有历史数据和缓存吗？此操作不可撤销。")) {
        localStorage.removeItem("brainstormData_MVP");
        location.reload();
    }
};

// --- Rendering Logic ---

const renderInspiration = () => {
    const container = document.getElementById('inspirationContainer');
    if (!container) return;
    
    if (brainstormData.inspiration.length === 0) {
        container.innerHTML = `<div style="color: #999; text-align: center; margin-top: 20px;">暂无推荐灵感，请先输入想法。</div>`;
        return;
    }

    // 先渲染基础骨架
    container.innerHTML = brainstormData.inspiration.map((item, index) => `
        <div class="inspiration-item" id="ins-item-${index}">
            <a href="${item.link}" target="_blank" class="inspiration-title">💡 ${item.title}</a>
            <div class="inspiration-snippet">${item.snippet}</div>
            <div class="inspiration-ai-summary" id="ins-summary-${index}">
                <span class="loading-dots">AI 正在深度解读...</span>
            </div>
            <div class="inspiration-ai-tags" id="ins-tags-${index}"></div>
        </div>
    `).join('');

    // 异步触发 AI 总结（不阻塞主 UI）
    brainstormData.inspiration.forEach(async (item, index) => {
        try {
            const aiData = await summarizeSearchResult(item.title, item.snippet);
            
            // 动态更新总结文字
            const summaryEl = document.getElementById(`ins-summary-${index}`);
            if (summaryEl) {
                summaryEl.innerHTML = `<span class="ai-label">AI 洞察：</span>${aiData.brief}`;
                summaryEl.classList.add('fade-in');
            }

            // 动态更新关键词标签
            const tagsEl = document.getElementById(`ins-tags-${index}`);
            if (tagsEl && aiData.tags) {
                tagsEl.innerHTML = aiData.tags.map(tag => `<span class="ins-tag">#${tag}</span>`).join('');
                tagsEl.classList.add('fade-in');
            }
        } catch (err) {
            const summaryEl = document.getElementById(`ins-summary-${index}`);
            if (summaryEl) summaryEl.innerHTML = ""; // 失败则清空加载状态
        }
    });
};

// --- Context Menu Logic ---
let activeContextMenu = null;

const hideContextMenu = () => {
    if (activeContextMenu) {
        activeContextMenu.style.display = 'none';
    }
};

const showContextMenu = (x, y, keywordName) => {
    hideContextMenu();
    
    let menu = document.getElementById('bubbleContextMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'bubbleContextMenu';
        menu.className = 'context-menu';
        document.body.appendChild(menu);
    }
    
    const kw = brainstormData.allKeywords.find(k => (typeof k === 'string' ? k : k.name) === keywordName);
    const isCore = kw && typeof kw !== 'string' ? kw.isCore : false;
    
    menu.innerHTML = `
        <div class="context-menu-item" id="menu-toggle-core">
            <span>${isCore ? '📌 取消核心' : '⭐ 设为核心'}</span>
        </div>
        <div class="context-menu-item delete" id="menu-delete-kw">
            <span>🗑️ 删除气泡</span>
        </div>
    `;
    
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
    activeContextMenu = menu;
    
    // Bind actions
    document.getElementById('menu-toggle-core').onclick = () => {
        const kwIndex = brainstormData.allKeywords.findIndex(k => (typeof k === 'string' ? k : k.name) === keywordName);
        if (kwIndex !== -1) {
            let k = brainstormData.allKeywords[kwIndex];
            if (typeof k === 'string') {
                k = { name: k, level: 3, parent: null, isCore: true };
                brainstormData.allKeywords[kwIndex] = k;
            } else {
                k.isCore = !k.isCore;
            }
            
            // Sync with current summary card keywords if present
            const currentKw = brainstormData.keywords.find(kw => (typeof kw === 'string' ? kw : kw.name) === keywordName);
            if (currentKw && typeof currentKw !== 'string') {
                currentKw.isCore = k.isCore;
            }
            
            saveToLocalStorage();
            renderBubbles(false); 
            renderMindmap(); // Refresh to reflect any potential visual changes
        }
        hideContextMenu();
    };
    
    document.getElementById('menu-delete-kw').onclick = () => {
        if (confirm(`确定要删除关键词 "${keywordName}" 及其所有子节点吗？`)) {
            const toDelete = new Set([keywordName]);
            
            // 递归查找所有子节点
            const findDescendants = (parentId) => {
                brainstormData.allKeywords.forEach(k => {
                    const name = typeof k === 'string' ? k : k.name;
                    const parent = typeof k === 'string' ? null : k.parent;
                    if (parent === parentId && !toDelete.has(name)) {
                        toDelete.add(name);
                        findDescendants(name);
                    }
                });
            };
            findDescendants(keywordName);

            // 执行删除
            brainstormData.allKeywords = brainstormData.allKeywords.filter(k => !toDelete.has(typeof k === 'string' ? k : k.name));
            brainstormData.keywords = brainstormData.keywords.filter(k => !toDelete.has(typeof k === 'string' ? k : k.name));
            brainstormData.connections = brainstormData.connections.filter(c => !toDelete.has(c.source) && !toDelete.has(c.target));
            
            saveToLocalStorage();
            renderBubbles(false);
            renderMindmap();
        }
        hideContextMenu();
    };
};

// Global click to hide context menu
document.addEventListener('click', hideContextMenu);
document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('.bubble')) hideContextMenu();
});

const renderBubbles = (runSimulation = true) => {
    const container = document.getElementById('bubbleContainer');
    const viewport = document.getElementById('bubbleViewport');
    const svgLayer = document.getElementById('bubbleSvg');
    if (!container || !viewport || !svgLayer) return;
    
    // 应用当前缩放
    viewport.style.transform = `scale(${brainstormData.zoom.scale})`;
    
    const keywords = brainstormData.allKeywords;
    if (keywords.length === 0) {
        viewport.querySelectorAll('.bubble').forEach(b => b.remove());
        svgLayer.innerHTML = '';
        return;
    }

    // --- Identify nodes to add, keep, or remove ---
    const currentBubbles = Array.from(viewport.querySelectorAll('.bubble:not(.exiting)'));
    const currentWords = currentBubbles.map(b => b.dataset.word);
    
    // Nodes to remove
    currentBubbles.forEach(bubble => {
        if (!keywords.find(k => (typeof k === 'string' ? k : k.name) === bubble.dataset.word)) {
            bubble.classList.add('exiting');
            setTimeout(() => bubble.remove(), 500);
        }
    });

    const nodes = keywords.map(kw => {
        const name = typeof kw === 'string' ? kw : kw.name;
        const level = typeof kw === 'string' ? 3 : (kw.level || 3);
        const isCore = typeof kw === 'string' ? false : (kw.isCore || false);
        
        const existingBubble = currentBubbles.find(b => b.dataset.word === name);
        
        // 优先使用持久化的坐标，如果没有则随机初始化或从现有气泡读取
        let initialX, initialY;
        if (typeof kw !== 'string' && kw.x !== undefined && kw.y !== undefined) {
            initialX = kw.x;
            initialY = kw.y;
        } else if (existingBubble) {
            initialX = parseFloat(existingBubble.style.left) + existingBubble.offsetWidth / 2;
            initialY = parseFloat(existingBubble.style.top) + existingBubble.offsetHeight / 2;
        } else {
            initialX = Math.random() * container.offsetWidth;
            initialY = Math.random() * container.offsetHeight;
        }

        return {
            id: name,
            level: level,
            isCore: isCore,
            x: initialX,
            y: initialY,
            vx: 0,
            vy: 0,
            isNew: !currentWords.includes(name)
        };
    });

    const nodeMap = {};
    nodes.forEach(n => nodeMap[n.id] = n);

    const connections = brainstormData.connections;
    const bubbleMap = {};

    // --- Force-Directed Simulation (Maintain User Logic) ---
    if (runSimulation) {
        const iterations = 150;
        const k = Math.sqrt((container.offsetWidth * container.offsetHeight) / nodes.length) * 0.4;
        const repulsionBase = k * k;
        const attractionBase = k;

        for (let i = 0; i < iterations; i++) {
            for (let i1 = 0; i1 < nodes.length; i1++) {
                for (let i2 = i1 + 1; i2 < nodes.length; i2++) {
                    const n1 = nodes[i1], n2 = nodes[i2];
                    const dx = n1.x - n2.x;
                    const dy = n1.y - n2.y;
                    const distSq = dx * dx + dy * dy + 0.01;
                    const dist = Math.sqrt(distSq);
                    const force = repulsionBase / dist;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    n1.vx += fx; n1.vy += fy;
                    n2.vx -= fx; n2.vy -= fy;
                }
            }

            connections.forEach(conn => {
                const n1 = nodeMap[conn.source];
                const n2 = nodeMap[conn.target];
                if (n1 && n2) {
                    const dx = n1.x - n2.x;
                    const dy = n1.y - n2.y;
                    const distSq = dx * dx + dy * dy + 0.01;
                    const dist = Math.sqrt(distSq);
                    const strength = conn.strength || 5;
                    const force = (distSq / attractionBase) * (strength / 10);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    n1.vx -= fx; n1.vy -= fy;
                    n2.vx += fx; n2.vy += fy;
                }
            });

            const centerX = container.offsetWidth / 2;
            const centerY = container.offsetHeight / 2;
            nodes.forEach(n => {
                const dx = n.x - centerX;
                const dy = n.y - centerY;
                n.vx -= dx * 0.05;
                n.vy -= dy * 0.05;
            });

            nodes.forEach(n => {
                n.x += n.vx * 0.1;
                n.y += n.vy * 0.1;
                n.vx *= 0.5;
                n.vy *= 0.5;
                const padding = 40;
                n.x = Math.max(padding, Math.min(container.offsetWidth - padding, n.x));
                n.y = Math.max(padding, Math.min(container.offsetHeight - padding, n.y));
            });
        }
        
        // 模拟结束后，同步坐标到全局数据
        nodes.forEach(node => {
            const kw = brainstormData.allKeywords.find(k => (typeof k === 'string' ? k : k.name) === node.id);
            if (kw && typeof kw !== 'string') {
                kw.x = node.x;
                kw.y = node.y;
            }
        });
        saveToLocalStorage();
    }

    // --- Rendering with Transitions ---
    const drawConnections = () => {
        svgLayer.innerHTML = '';
        connections.forEach(conn => {
            const sourceEl = bubbleMap[conn.source];
            const targetEl = bubbleMap[conn.target];
            if (sourceEl && targetEl) {
                const sX = parseFloat(sourceEl.style.left) + sourceEl.offsetWidth / 2;
                const sY = parseFloat(sourceEl.style.top) + sourceEl.offsetHeight / 2;
                const tX = parseFloat(targetEl.style.left) + targetEl.offsetWidth / 2;
                const tY = parseFloat(targetEl.style.top) + targetEl.offsetHeight / 2;
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", sX); line.setAttribute("y1", sY);
                line.setAttribute("x2", tX); line.setAttribute("y2", tY);
                line.setAttribute("class", "connection-line");
                line.style.opacity = 0.1 + (conn.strength || 5) / 15;
                svgLayer.appendChild(line);
            }
        });
    };

    // Helper to find all descendants of a bubble
    const getAllDescendants = (parentId) => {
        let descendants = [];
        brainstormData.allKeywords.forEach(k => {
            if (typeof k !== 'string' && k.parent === parentId) {
                const childEl = viewport.querySelector(`.bubble[data-word="${k.name}"]`);
                if (childEl) {
                    descendants.push(childEl);
                    descendants = descendants.concat(getAllDescendants(k.name));
                }
            }
        });
        return descendants;
    };

    nodes.forEach(node => {
        let bubble = currentBubbles.find(b => b.dataset.word === node.id);
        
        if (!bubble) {
            bubble = document.createElement('div');
            bubble.className = `bubble entering level-${node.level}`;
            if (node.isCore) bubble.classList.add('is-core');
            bubble.dataset.word = node.id;
            bubble.textContent = node.id;
            viewport.appendChild(bubble);
            
            // Trigger entering animation
            requestAnimationFrame(() => {
                bubble.classList.remove('entering');
            });

            // Draggable Logic
            let isDragging = false, startX, startY, moved = false;
            let descendants = [], descInitPos = [];

            bubble.addEventListener('mousedown', (e) => {
                isDragging = true;
                moved = false;
                bubble.classList.add('dragging');
                bubble.style.animation = 'none';
                
                // 考虑缩放修正偏移
                startX = e.clientX / brainstormData.zoom.scale - parseFloat(bubble.style.left);
                startY = e.clientY / brainstormData.zoom.scale - parseFloat(bubble.style.top);
                
                // 查找所有子孙节点并记录相对位置，同时添加 dragging 类以禁用过渡
                descendants = getAllDescendants(node.id);
                descInitPos = descendants.map(d => {
                    d.classList.add('dragging');
                    d.style.animation = 'none';
                    return {
                        el: d,
                        relX: parseFloat(d.style.left) - parseFloat(bubble.style.left),
                        relY: parseFloat(d.style.top) - parseFloat(bubble.style.top)
                    };
                });
                
                e.stopPropagation();
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                moved = true;
                let newX = e.clientX / brainstormData.zoom.scale - startX, 
                    newY = e.clientY / brainstormData.zoom.scale - startY;
                
                // 限制父节点边界
                newX = Math.max(0, Math.min(newX, container.offsetWidth - bubble.offsetWidth));
                newY = Math.max(0, Math.min(newY, container.offsetHeight - bubble.offsetHeight));
                
                bubble.style.left = `${newX}px`; bubble.style.top = `${newY}px`;
                
                // 同步更新所有子孙节点位置
                descInitPos.forEach(pos => {
                    pos.el.style.left = `${newX + pos.relX}px`;
                    pos.el.style.top = `${newY + pos.relY}px`;
                });
                
                drawConnections();
            });
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    bubble.classList.remove('dragging');
                    bubble.style.animation = 'float 5s ease-in-out infinite';
                    
                    // 同步父节点最终位置
                    const parentKw = brainstormData.allKeywords.find(k => (typeof k === 'string' ? k : k.name) === node.id);
                    if (parentKw && typeof parentKw !== 'string') {
                        parentKw.x = parseFloat(bubble.style.left) + bubble.offsetWidth / 2;
                        parentKw.y = parseFloat(bubble.style.top) + bubble.offsetHeight / 2;
                    }

                    // 恢复子孙节点状态并同步位置
                    descendants.forEach(d => {
                        d.classList.remove('dragging');
                        d.style.animation = 'float 5s ease-in-out infinite';
                        
                        const childName = d.dataset.word;
                        const childKw = brainstormData.allKeywords.find(k => (typeof k === 'string' ? k : k.name) === childName);
                        if (childKw && typeof childKw !== 'string') {
                            childKw.x = parseFloat(d.style.left) + d.offsetWidth / 2;
                            childKw.y = parseFloat(d.style.top) + d.offsetHeight / 2;
                        }
                    });
                    
                    saveToLocalStorage();
                }
            });

            bubble.addEventListener('mouseenter', () => {
                document.querySelectorAll(`.card-tag`).forEach(tag => {
                    if (tag.textContent === node.id) tag.classList.add('highlight');
                });
            });
            bubble.addEventListener('mouseleave', () => {
                document.querySelectorAll(`.card-tag`).forEach(tag => tag.classList.remove('highlight'));
            });

            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e.clientX, e.clientY, node.id);
            });

            bubble.onclick = (e) => {
                if (moved) return;
                const input = document.getElementById('ideaInput');
                input.value = (input.value ? input.value + ' ' : '') + node.id;
                input.focus();
            };
        } else {
            // 更新层级和核心状态
            bubble.className = `bubble level-${node.level}`;
            if (node.isCore) bubble.classList.add('is-core');
        }
        
        // Update position
        bubble.style.left = `${node.x - bubble.offsetWidth / 2}px`;
        bubble.style.top = `${node.y - bubble.offsetHeight / 2}px`;
        bubble.style.animationDelay = `${Math.random() * 2}s`;
        
        bubbleMap[node.id] = bubble;
    });

    let connTicks = 0;
    const updateConnInterval = setInterval(() => {
        drawConnections();
        if (++connTicks > 30) clearInterval(updateConnInterval);
    }, 50);
};

const renderMindmap = () => {
    const container = document.getElementById('mindmapContainer');
    if (!container) return;
    
    const card = document.createElement('div');
    card.className = 'summary-card';
    const content = document.createElement('div');
    content.className = 'summary-content';
    content.innerHTML = `<span class="ai-label">AI 总结：</span>${brainstormData.summary}`;
    card.appendChild(content);
    
    const treeContainer = document.createElement('div');
    treeContainer.className = 'tree-container';
    
    // 构建树形结构
    const buildTree = (parentId) => {
        const children = brainstormData.keywords.filter(k => {
            if (typeof k === 'string') return false; // 兼容旧数据
            return k.parent === parentId || (!parentId && k.level === 1);
        });
        
        if (children.length === 0) return null;
        
        const group = document.createElement('div');
        group.className = 'tree-group';
        
        children.forEach(child => {
            const item = document.createElement('div');
            item.className = `tree-item level-${child.level}`;
            
            const tag = document.createElement('div');
            tag.className = 'card-tag';
            tag.textContent = child.name;
            
            // 同步图谱高亮
            tag.addEventListener('mouseenter', () => {
                document.querySelectorAll(`.bubble`).forEach(bubble => {
                    if (bubble.dataset.word === child.name) bubble.classList.add('highlight');
                });
            });
            tag.addEventListener('mouseleave', () => {
                document.querySelectorAll(`.bubble`).forEach(bubble => bubble.classList.remove('highlight'));
            });
            
            item.appendChild(tag);
            
            const subTree = buildTree(child.name);
            if (subTree) item.appendChild(subTree);
            
            group.appendChild(item);
        });
        return group;
    };
    
    // 处理可能的旧数据格式（字符串数组）
    if (brainstormData.keywords.length > 0 && typeof brainstormData.keywords[0] === 'string') {
        const tagsWrapper = document.createElement('div');
        tagsWrapper.className = 'card-tags';
        brainstormData.keywords.forEach(word => {
            const tag = document.createElement('div');
            tag.className = 'card-tag';
            tag.textContent = word;
            tagsWrapper.appendChild(tag);
        });
        treeContainer.appendChild(tagsWrapper);
    } else {
        const tree = buildTree(null);
        if (tree) treeContainer.appendChild(tree);
    }
    
    card.appendChild(treeContainer);
    
    if (container.firstChild) {
        container.insertBefore(card, container.firstChild);
    } else {
        container.appendChild(card);
    }
};

// --- History Logic ---

function addThoughtToHistory(content, thoughtData, thoughtHistory) {
    const thought = thoughtData || brainstormData.thoughts[brainstormData.thoughts.length - 1];
    if (!thought) return;

    const div = document.createElement('div');
    div.className = 'thought-item expanded';
    
    const originalText = document.createElement('div');
    originalText.className = 'original-text';
    originalText.textContent = content;
    div.appendChild(originalText);

    const details = document.createElement('div');
    details.className = 'thought-details';

    const summaryEl = document.createElement('div');
    summaryEl.className = 'summary-text';
    summaryEl.textContent = `📝 总结：${thought.summary}`;
    details.appendChild(summaryEl);

    const tagsEl = document.createElement('div');
    tagsEl.className = 'thought-tags';
    thought.keywords.forEach(kw => {
        const tag = document.createElement('span');
        tag.className = 'thought-tag';
        tag.textContent = `#${typeof kw === 'string' ? kw : kw.name}`;
        tagsEl.appendChild(tag);
    });
    details.appendChild(tagsEl);
    
    div.appendChild(details);
    div.onclick = () => div.classList.toggle('expanded');

    const firstChild = thoughtHistory.querySelector('.thought-item');
    if (firstChild) {
        thoughtHistory.insertBefore(div, firstChild);
    } else {
        thoughtHistory.appendChild(div);
    }
}

// --- App Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    const ideaInput = document.getElementById('ideaInput');
    const submitBtn = document.getElementById('submitBtn');
    const thoughtHistory = document.getElementById('thoughtHistory');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');

    const displayResults = () => {
        document.getElementById('visualPlaceholder').style.display = 'none';
        document.getElementById('visualResult').style.display = 'block';
    };

    // Load Initial Data
    if (loadFromLocalStorage()) {
        if (brainstormData.thoughts.length > 0) {
            displayResults();
            renderBubbles(false); // 加载时使用持久化的坐标，不重新模拟
            renderMindmap();
            renderInspiration();
            brainstormData.thoughts.forEach(t => addThoughtToHistory(t.text, t, thoughtHistory));
        }
    }

    clearCacheBtn.addEventListener('click', clearAllData);

    // --- Zoom Logic ---
    const bubbleContainer = document.getElementById('bubbleContainer');
    bubbleContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(
            brainstormData.zoom.min,
            Math.min(brainstormData.zoom.max, brainstormData.zoom.scale + delta)
        );
        
        if (newScale !== brainstormData.zoom.scale) {
            brainstormData.zoom.scale = newScale;
            renderBubbles(false);
        }
    }, { passive: false });

    // --- Speech Recognition Logic (AI Meeting Minutes) ---
    const voiceBtn = document.getElementById('voiceBtn');
    const meetingContent = document.getElementById('meetingContent');
    let recognition = null;
    let isRecording = false;
    let lastAITextLength = 0;
    let aiTriggerTimer = null;

    const silentUpdateAI = async (text) => {
        if (!text || text.length < 10) return;
        try {
            console.log(" [Meeting] Silent AI update triggered...");
            const aiResult = await callAIModel(`会议纪要实时内容：${text}`, brainstormData);
            
            // 更新全局状态 (增量更新关键词)
            let hasNewData = false;
            aiResult.keywords.forEach(newKw => {
                const existingIndex = brainstormData.allKeywords.findIndex(k => (typeof k === 'string' ? k : k.name) === newKw.name);
                if (existingIndex !== -1) {
                    const existing = brainstormData.allKeywords[existingIndex];
                    if (typeof existing === 'string') {
                        brainstormData.allKeywords[existingIndex] = {
                            name: newKw.name,
                            level: newKw.level,
                            parent: newKw.parent,
                            isCore: false
                        };
                        hasNewData = true;
                    } else if (existing.level !== newKw.level || existing.parent !== newKw.parent) {
                        existing.level = newKw.level;
                        existing.parent = newKw.parent;
                        hasNewData = true;
                    }
                } else {
                    brainstormData.allKeywords.push({
                        name: newKw.name,
                        level: newKw.level,
                        parent: newKw.parent,
                        isCore: false
                    });
                    hasNewData = true;
                }
            });
            if (aiResult.connections) {
                aiResult.connections.forEach(conn => {
                    const exists = brainstormData.connections.find(c => c.source === conn.source && c.target === conn.target);
                    if (!exists) {
                        brainstormData.connections.push(conn);
                        hasNewData = true;
                    }
                });
            }

            if (hasNewData) {
                displayResults();
                renderBubbles();
                // 自动保存
                saveToLocalStorage();
            }
            lastAITextLength = text.length;
        } catch (err) {
            console.warn("Silent AI update failed:", err);
        }
    };

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';

        recognition.onresult = (event) => {
            let fullTranscript = '';
            for (let i = 0; i < event.results.length; i++) {
                fullTranscript += event.results[i][0].transcript;
            }
            
            // 实时更新纪要板块
            if (meetingContent.querySelector('p')) {
                meetingContent.innerHTML = '';
            }
            meetingContent.textContent = fullTranscript;
            meetingContent.scrollTop = meetingContent.scrollHeight;

            // 自动触发 AI 总结逻辑
            clearTimeout(aiTriggerTimer);
            
            // 触发条件：文字增加超过 50 字，或者停顿 3 秒
            const textDiff = fullTranscript.length - lastAITextLength;
            if (textDiff > 50) {
                silentUpdateAI(fullTranscript);
            } else {
                aiTriggerTimer = setTimeout(() => {
                    if (fullTranscript.length > lastAITextLength) {
                        silentUpdateAI(fullTranscript);
                    }
                }, 3000);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopRecording();
            if (event.error === 'not-allowed') {
                alert("请允许浏览器访问麦克风以使用语音纪要功能。");
            }
        };

        recognition.onend = () => {
            // 如果是因为浏览器超时自动结束，但在录制状态中，则重启
            if (isRecording) {
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Failed to restart recognition:", e);
                }
            }
        };
    }

    const startRecording = () => {
        if (!recognition) return alert("您的浏览器不支持语音识别功能，建议使用 Chrome 浏览器。");
        isRecording = true;
        voiceBtn.classList.add('recording');
        try {
            recognition.start();
            if (meetingContent.querySelector('p')) {
                meetingContent.innerHTML = '';
            }
        } catch (e) {
            console.error("Start recording failed:", e);
            isRecording = false;
            voiceBtn.classList.remove('recording');
        }
    };

    const stopRecording = () => {
        isRecording = false;
        voiceBtn.classList.remove('recording');
        if (recognition) {
            recognition.stop();
        }
    };

    voiceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // 板块折叠逻辑
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = btn.closest('section');
            if (section) {
                section.classList.toggle('collapsed');
            }
        });
    });

    submitBtn.addEventListener('click', async () => {
        const text = ideaInput.value.trim();
        if (!text) return alert("请输入内容后再提交！");
        
        loadingOverlay.style.display = 'flex';
        submitBtn.disabled = true;

        try {
            // callAIModel is from api.js
            const aiResult = await callAIModel(text, brainstormData);
            
            // Update Global State
            brainstormData.summary = aiResult.summary;
            brainstormData.keywords = aiResult.keywords;
            brainstormData.thoughts.push({ text, summary: aiResult.summary, keywords: aiResult.keywords });
            
            // 合并关键词，保留 isCore 状态，更新 level 和 parent
            aiResult.keywords.forEach(newKw => {
                const existingIndex = brainstormData.allKeywords.findIndex(k => (typeof k === 'string' ? k : k.name) === newKw.name);
                if (existingIndex !== -1) {
                    const existing = brainstormData.allKeywords[existingIndex];
                    if (typeof existing === 'string') {
                        brainstormData.allKeywords[existingIndex] = {
                            name: newKw.name,
                            level: newKw.level,
                            parent: newKw.parent,
                            isCore: false
                        };
                    } else {
                        existing.level = newKw.level;
                        existing.parent = newKw.parent;
                    }
                } else {
                    brainstormData.allKeywords.push({
                        name: newKw.name,
                        level: newKw.level,
                        parent: newKw.parent,
                        isCore: false
                    });
                }
            });
            if (aiResult.connections) {
                aiResult.connections.forEach(conn => brainstormData.connections.push(conn));
            }

            // --- 核心优化：立刻渲染 AI 结果，不等待搜索 ---
            displayResults();
            renderBubbles();
            renderMindmap();
            addThoughtToHistory(text, aiResult, thoughtHistory);
            
            // 隐藏全局加载遮罩，让用户先看图谱
            loadingOverlay.style.display = 'none';
            submitBtn.disabled = false;
            ideaInput.value = '';

            // --- 后台执行搜索任务 ---
            if (aiResult.keywords && aiResult.keywords.length > 0) {
                // 清空旧灵感并显示局部加载状态
                const container = document.getElementById('inspirationContainer');
                if (container) container.innerHTML = `<div class="loading-dots" style="text-align:center; padding:20px;">正在连接云端灵感库...</div>`;
                
                // 异步发起搜索，不带 await
                callSearchAPI(aiResult.keywords[0]).then(results => {
                    brainstormData.inspiration = results;
                    saveToLocalStorage();
                    renderInspiration(); // 数据到了自动刷新右侧
                });
            } else {
                saveToLocalStorage();
            }

        } catch (err) {
            console.error(err);
            alert("操作失败，请确保后端服务运行在 http://localhost:3000");
        } finally {
            loadingOverlay.style.display = 'none';
            submitBtn.disabled = false;
        }
    });
});
