require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // 静态文件服务

// Proxy for ModelScope AI
app.post('/api/ai', async (req, res) => {
    try {
        const payload = {
            ...req.body,
            enable_thinking: false
        };
        const response = await axios.post('https://api-inference.modelscope.cn/v1/chat/completions', payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MODEL_SCOPE_KEY}`
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('AI Proxy Error:', error.response ? error.response.data : error.message, req.body);
        res.status(error.response ? error.status : 500).json({ error: 'AI Request Failed' });
    }
});

// Proxy for Serphouse Search (Solves CORS)
app.get('/api/search', async (req, res) => {
    try {
        const { q, num } = req.query;
        // 修复：使用正确的接口地址 /serp/live，并添加 api_token 参数
        const searchUrl = `https://api.serphouse.com/serp/live?q=${encodeURIComponent(q)}&num=${num || 5}&api_token=${process.env.SERPHOUSE_KEY}`;
        
        console.log(`[Search] Requesting: ${searchUrl}`); // 调试：打印请求地址

        const response = await axios.get(searchUrl);
        
        console.log(`[Search] Response Data:`, JSON.stringify(response.data).substring(0, 500) + "..."); // 调试：打印前500字数据

        res.json(response.data);
    } catch (error) {
        console.error('Search Proxy Error:', error.response ? error.response.data : error.message);
        res.status(error.response ? error.status : 500).json({ error: 'Search Request Failed' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend API Gateway running at http://0.0.0.0:${PORT}`);
    console.log(`Serphouse Key Loaded: ${process.env.SERPHOUSE_KEY ? 'Yes (' + process.env.SERPHOUSE_KEY.substring(0, 5) + '...)' : 'No'}`);
});
