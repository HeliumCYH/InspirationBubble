/**
 * api.js - Handles all communication with the backend API Gateway
 */

const BACKEND_URL = 'http://localhost:3000';

/**
 * Calls the AI model via the backend proxy
 */
async function callAIModel(content, brainstormData) {
    const existingKeywords = brainstormData.allKeywords.map(k => typeof k === 'string' ? k : k.name).join(", ");
    const corePoints = brainstormData.allKeywords.filter(k => typeof k !== 'string' && k.isCore).map(k => k.name).join(", ");
    
    const prompt = `你是专业的讨论内容梳理助手，需处理各类口头 / 文字讨论内容，严格基于原文完成核心信息提取与层级化思维导图生成，全程遵循以下规则，无任何引申、杜撰、补充，所有内容均来自输入的发言 / 讨论原文：

## 核心规则：
1. **关键词提取**：先从讨论内容中提取无冗余的核心关键词 / 关键信息点，拒绝无关词汇，不遗漏核心内容。
2. **逻辑层级梳理**：自动梳理信息的逻辑层级关系。
   - 根节点（Level 1）：本次讨论的核心主题（从原文提取，不自定义）。
   - 一级节点（Level 2）：讨论的核心板块 / 维度。
   - 二级及以下节点（Level 3+）：对应板块的细分关键词 / 信息点。
   - 层级根据内容自然划分，不强行嵌套。
3. **结构化生成**：按「根节点→一级节点→二级节点→…」的结构生成，节点内容仅为提取的关键词 / 简洁信息点，无需长句描述。
4. **严禁加工**：无中生有、不做任何引申思考，不添加原文未提及的内容，不做总结性加工，仅做信息的层级化提炼与呈现。

## 技术要求：
1. **输出格式**：必须严格以 JSON 格式返回，不包含 Markdown 代码块。
2. **跨灵感关联**：在保证上述规则的前提下，尝试建立本次提取的关键词与现有关键词 [${existingKeywords}] 之间的逻辑联系（connections）。
3. **核心关注**：用户特别关注的核心论点是 [${corePoints}]，请在提取关键词时重点围绕这些点展开。

## JSON 结构要求：
{
  "summary": "根节点内容（讨论核心主题）", 
  "keywords": [
    {"name": "关键词1", "level": 1, "parent": null},
    {"name": "关键词2", "level": 2, "parent": "关键词1"},
    ...
  ], 
  "connections": [
    {"source": "关键词1", "target": "关键词2", "strength": 8}
  ]
}
注意：connections 中的 strength 为 1-10 的紧密程度。

内容：${content}`;

    try {
        const response = await fetch(`${BACKEND_URL}/api/ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "Qwen/Qwen2.5-7B-Instruct",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 1024,
                temperature: 0.5,
                enable_thinking: false,
                response_format: { "type": "json_object" }
            })
        });

        if (!response.ok) {
            throw new Error(`AI 请求失败 (状态码: ${response.status})`);
        }

        const res = await response.json();
        console.log(' [Debug] AI Raw Response:', res); // 打印 AI 原始响应

        let rawContent = res.choices[0].message.content;
        rawContent = rawContent.replace(/```json|```/g, "").trim();
        
        try {
            const parsed = JSON.parse(rawContent);
            console.log(' [Debug] AI Parsed Content:', parsed); // 打印 AI 解析后的内容
            return parsed;
        } catch (e) {
            console.error(' [Error] AI JSON Parse Failed:', rawContent);
            throw e;
        }
    } catch (error) {
        console.error('AI 调用失败:', error);
        throw error;
    }
}

/**
 * Calls the search API via the backend proxy
 */
async function callSearchAPI(keyword) {
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

    try {
        const response = await fetch(`${BACKEND_URL}/api/ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "Qwen/Qwen2.5-7B-Instruct",
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
        console.error('搜索条目总结失败:', error);
        return { brief: "自动总结生成失败", tags: ["灵感", "参考", "案例"] };
    }
}
