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
    voiceTextHistory: []
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

const renderBubbles = () => {
    const container = document.getElementById('bubbleContainer');
    const svgLayer = document.getElementById('bubbleSvg');
    if (!container || !svgLayer) return;
    
    container.querySelectorAll('.bubble').forEach(b => b.remove());
    svgLayer.innerHTML = '';

    const keywords = brainstormData.allKeywords;
    if (keywords.length === 0) return;

    const nodes = keywords.map(word => ({
        id: word,
        x: Math.random() * container.offsetWidth,
        y: Math.random() * container.offsetHeight,
        vx: 0,
        vy: 0
    }));

    const nodeMap = {};
    nodes.forEach(n => nodeMap[n.id] = n);

    const connections = brainstormData.connections;
    const bubbleMap = {};

    // --- Simple Force-Directed Simulation ---
    const iterations = 150;
    const k = Math.sqrt((container.offsetWidth * container.offsetHeight) / nodes.length) * 0.8;
    const repulsionBase = k * k;
    const attractionBase = k;

    for (let i = 0; i < iterations; i++) {
        // 1. Repulsion between all nodes
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

        // 2. Attraction between connected nodes
        connections.forEach(conn => {
            const n1 = nodeMap[conn.source];
            const n2 = nodeMap[conn.target];
            if (n1 && n2) {
                const dx = n1.x - n2.x;
                const dy = n1.y - n2.y;
                const distSq = dx * dx + dy * dy + 0.01;
                const dist = Math.sqrt(distSq);
                // Weight by strength (default to 5 if not provided)
                const strength = conn.strength || 5;
                const force = (distSq / attractionBase) * (strength / 10);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                n1.vx -= fx; n1.vy -= fy;
                n2.vx += fx; n2.vy += fy;
            }
        });

        // 3. Gravity/Center force
        const centerX = container.offsetWidth / 2;
        const centerY = container.offsetHeight / 2;
        nodes.forEach(n => {
            const dx = n.x - centerX;
            const dy = n.y - centerY;
            n.vx -= dx * 0.05;
            n.vy -= dy * 0.05;
        });

        // 4. Apply forces and damping
        nodes.forEach(n => {
            n.x += n.vx * 0.1;
            n.y += n.vy * 0.1;
            // Damping
            n.vx *= 0.5;
            n.vy *= 0.5;

            // Boundary Constraints
            const padding = 40;
            n.x = Math.max(padding, Math.min(container.offsetWidth - padding, n.x));
            n.y = Math.max(padding, Math.min(container.offsetHeight - padding, n.y));
        });
    }

    // --- Rendering ---
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
                // Strength affects opacity
                line.style.opacity = 0.1 + (conn.strength || 5) / 15;
                svgLayer.appendChild(line);
            }
        });
    };

    nodes.forEach(node => {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.dataset.word = node.id;
        bubble.textContent = node.id;
        container.appendChild(bubble);
        
        // Offset to center the bubble on its calculated x,y
        bubble.style.left = `${node.x - bubble.offsetWidth / 2}px`;
        bubble.style.top = `${node.y - bubble.offsetHeight / 2}px`;
        bubble.style.animationDelay = `${Math.random() * 2}s`;
        
        bubbleMap[node.id] = bubble;

        // Draggable Logic
        let isDragging = false, startX, startY;
        bubble.addEventListener('mousedown', (e) => {
            isDragging = true;
            bubble.classList.add('dragging');
            bubble.style.animation = 'none';
            startX = e.clientX - parseFloat(bubble.style.left);
            startY = e.clientY - parseFloat(bubble.style.top);
            e.stopPropagation();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newX = e.clientX - startX, newY = e.clientY - startY;
            newX = Math.max(0, Math.min(newX, container.offsetWidth - bubble.offsetWidth));
            newY = Math.max(0, Math.min(newY, container.offsetHeight - bubble.offsetHeight));
            bubble.style.left = `${newX}px`; bubble.style.top = `${newY}px`;
            drawConnections();
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                bubble.classList.remove('dragging');
                bubble.style.animation = 'float 5s ease-in-out infinite';
            }
        });

        // Highlight Logic
        bubble.addEventListener('mouseenter', () => {
            document.querySelectorAll(`.card-tag`).forEach(tag => {
                if (tag.textContent === node.id) tag.classList.add('highlight');
            });
        });
        bubble.addEventListener('mouseleave', () => {
            document.querySelectorAll(`.card-tag`).forEach(tag => tag.classList.remove('highlight'));
        });

        bubble.onclick = () => {
            const input = document.getElementById('ideaInput');
            input.value = (input.value ? input.value + ' ' : '') + node.id;
            input.focus();
        };
    });

    setTimeout(drawConnections, 50);
};

const renderMindmap = () => {
    const container = document.getElementById('mindmapContainer');
    if (!container) return;
    
    const card = document.createElement('div');
    card.className = 'summary-card';
    const content = document.createElement('div');
    content.className = 'summary-content';
    content.textContent = brainstormData.summary;
    card.appendChild(content);
    
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'card-tags';
    brainstormData.keywords.forEach(word => {
        const tag = document.createElement('div');
        tag.className = 'card-tag';
        tag.textContent = word;
        tag.addEventListener('mouseenter', () => {
            document.querySelectorAll(`.bubble`).forEach(bubble => {
                if (bubble.textContent === word) bubble.classList.add('highlight');
            });
        });
        tag.addEventListener('mouseleave', () => {
            document.querySelectorAll(`.bubble`).forEach(bubble => bubble.classList.remove('highlight'));
        });
        tagsContainer.appendChild(tag);
    });
    card.appendChild(tagsContainer);
    
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
        tag.textContent = `#${kw}`;
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
            renderBubbles();
            renderMindmap();
            renderInspiration();
            brainstormData.thoughts.forEach(t => addThoughtToHistory(t.text, t, thoughtHistory));
        }
    }

    clearCacheBtn.addEventListener('click', clearAllData);

    // --- Speech Recognition Logic (AI Meeting Minutes) ---
    const voiceBtn = document.getElementById('voiceBtn');
    const meetingContent = document.getElementById('meetingContent');
    let recognition = null;
    let isRecording = false;

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
            meetingContent.scrollTop = meetingContent.scrollHeight; // 自动滚动到底部
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
            
            aiResult.keywords.forEach(kw => {
                if (!brainstormData.allKeywords.includes(kw)) brainstormData.allKeywords.push(kw);
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
