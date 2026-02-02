/**
 * api.js - Handles all communication with the backend API Gateway
 */

// 自动识别环境：如果是 Live Server (5500) 则指向本地后端，否则使用相对路径 (魔搭)
const BACKEND_URL = window.location.port === '5501' ? 'http://localhost:7860' : '';

/**
 * Calls the AI model via the backend proxy
 */
async function callAIModel(content, brainstormData) {
    const existingKeywords = brainstormData.allKeywords.map(k => typeof k === 'string' ? k : k.name).join(", ");
    const corePoints = brainstormData.allKeywords.filter(k => typeof k !== 'string' && k.isCore).map(k => k.name).join(", ");
    
    const prompt = `你是专业的讨论内容梳理助手，需处理各类口头 / 文字讨论内容，严格基于原文完成核心信息提取与层级化思维导图生成。
请直接返回 JSON 结果，严禁输出任何 Markdown 代码块或解释性文字。

## 核心规则：
1. **关键词提取**：从讨论内容中提取核心关键词，拒绝冗余，不遗漏核心点。
2. **逻辑层级**：梳理信息层级（Level 1-3+），Level 1 为核心主题。
3. **结构化生成**：仅包含提取的关键词，无需长句。
4. **严禁加工**：仅提炼原文信息，不做任何引申或杜典。

## 技术要求：
1. **跨灵感关联**：尝试建立本次关键词与现有关键词 [${existingKeywords}] 之间的联系。
2. **核心关注**：重点围绕用户关注的核心论点 [${corePoints}] 展开。

## JSON 结构要求：
{
  "summary": "根节点内容", 
  "recent_summary": "最近输入内容的简短摘要（不超过20字）", 
  "keywords": [
    {"name": "关键词", "level": 层级, "parent": "父节点名或null"},
    ...
  ], 
  "connections": [
    {"source": "源节点", "target": "目标节点", "strength": 1-10}
  ]
}

内容：${content}`;

    // 定义模型优先级列表
    const modelPriority = [
        "Qwen/Qwen3-32B",
        "Qwen/Qwen3-8B",
        "Qwen/Qwen2.5-7B-Instruct"
    ];
    
    // 尝试每个模型直到成功
    for (const model of modelPriority) {
        try {
            console.log(` [Debug] 尝试使用模型: ${model}`);
            
            const response = await fetch(`${BACKEND_URL}/api/ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 4096,
                    temperature: 0.5,
                    // enable_thinking: false, // Removed to avoid invalid_parameter_error
                    response_format: { "type": "json_object" }
                })
            });

            if (!response.ok) {
                console.warn(`AI 请求失败 (状态码: ${response.status}), 尝试下一个模型...`);
                continue; // 尝试下一个模型
            }

            const res = await response.json();
            console.log(' [Debug] AI Raw Response:', res); // 打印 AI 原始响应

            let rawContent = res.choices[0].message.content;
            rawContent = rawContent.replace(/```json|```/g, "").trim();
            
            try {
                const parsed = JSON.parse(rawContent);
                console.log(' [Debug] AI Parsed Content:', parsed); // 打印 AI 解析后的内容
                return parsed; // 成功解析，返回结果
            } catch (e) {
                console.error(' [Error] AI JSON Parse Failed:', rawContent);
                console.warn('JSON 解析失败，尝试下一个模型...');
                continue; // JSON解析失败，尝试下一个模型
            }
        } catch (error) {
            console.error(`模型 ${model} 调用失败:`, error);
            console.warn(`继续尝试下一个模型...`);
            continue; // 继续尝试下一个模型
        }
    }
    
    // 如果所有模型都失败，抛出错误
    throw new Error('所有AI模型都无法使用，请检查网络连接和API密钥配置');
}

/**
 * Calls the search API via the backend proxy
 */
async function callSearchAPI(keywordInput) {
    // Handle both string and object inputs (e.g. {name: "keyword"})
    const keyword = (typeof keywordInput === 'object' && keywordInput !== null && keywordInput.name) 
        ? keywordInput.name 
        : keywordInput;

    try {
        const query = encodeURIComponent(keyword + " 头脑风暴 创意灵感 行业案例");
        const response = await fetch(`${BACKEND_URL}/api/search?q=${query}&num=5`);
        
        if (!response.ok) {
            throw new Error(`搜索服务请求失败 (状态码: ${response.status})`);
        }

        const res = await response.json();
        console.log(' [Debug] Serphouse Raw Response:', res); // 打印搜索原始响应
        
        // 修复：更鲁棒的深度解析逻辑
        let results = [];
        
        // 尝试多种可能的 Serphouse 数据路径
        if (res.results) {
            if (Array.isArray(res.results.results)) {
                results = res.results.results; // 对应 res.results.results
            } else if (res.results.results && Array.isArray(res.results.results.organic)) {
                results = res.results.results.organic; // 对应 res.results.results.organic
            } else if (Array.isArray(res.results)) {
                results = res.results; // 对应 res.results
            }
        } else if (Array.isArray(res.organic_results)) {
            results = res.organic_results;
        }

        const mappedResults = results.slice(0, 3).map(item => ({
            title: item.title || item.site_title || "无标题",
            snippet: item.snippet || item.description || "无简介",
            link: item.link || item.url || "#"
        }));

        console.log(' [Debug] Serphouse Parsed Results:', mappedResults); // 打印解析后的结果
        return mappedResults;
    } catch (error) {
        console.warn('搜索 API 调用失败，使用回退数据:', error);
        // ... 回退数据逻辑 ...
        return [
            {
                title: `关于 "${keyword}" 的延展思考`,
                snippet: "联网搜索暂时不可用，建议从用户痛点、技术实现、市场差异化三个维度深入思考该关键词。",
                link: "#"
            },
            {
                title: "头脑风暴经典案例库",
                snippet: "探索类似的创意如何从雏形发展为成熟产品，关注那些看似‘疯狂’的想法。",
                link: "https://www.ideou.com/blogs/inspiration"
            }
        ];
    }
}

/**
 * 为单个搜索结果生成AI总结和关键词
 */
async function summarizeSearchResult(title, snippet) {
    const prompt = `你是一个信息提炼专家。请根据以下网页的标题和片段内容，生成一个极简总结（30字以内）并提取3个核心关键词。
要求：严格以 JSON 格式返回。
JSON 结构：{"brief": "总结内容", "tags": ["标签1", "标签2", "标签3"]}

标题：${title}
片段：${snippet}`;

    // 定义模型优先级列表
    const modelPriority = [
        "Qwen/Qwen3-32B",
        "Qwen/Qwen3-8B",
        "Qwen/Qwen2.5-7B-Instruct"
    ];    
    
    // 尝试每个模型直到成功
    for (const model of modelPriority) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 200,
                    temperature: 0.3,
                    response_format: { "type": "json_object" }
                })
            });

            const res = await response.json();
            let content = res.choices[0].message.content;
            content = content.replace(/```json|```/g, "").trim();
            return JSON.parse(content);
        } catch (error) {
            console.error(`搜索条目总结失败，模型 ${model} 调用失败:`, error);
            console.warn(`继续尝试下一个模型...`);
            continue; // 继续尝试下一个模型
        }
    }
    
    // 如果所有模型都失败，返回默认值
    console.error('搜索条目总结所有模型都无法使用，返回默认值');
    return { brief: "自动总结生成失败", tags: ["灵感", "参考", "案例"] };
}
