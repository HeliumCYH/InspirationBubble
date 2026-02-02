FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10

# 安装 Node.js 并清理缓存
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /home/user/app

# 复制项目文件（利用 .dockerignore 排除无关文件）
COPY . .

# 安装 Node.js 依赖
RUN npm install --production

# 安装 Python 依赖并清理缓存
RUN pip install --no-cache-dir gradio

# 暴露端口
EXPOSE 7860

ENTRYPOINT ["python", "-u", "app.py"]
