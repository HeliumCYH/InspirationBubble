FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10

# 安装 Node.js
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

WORKDIR /home/user/app

# 复制所有项目文件
COPY . .

# 安装 Node.js 依赖
RUN npm install

# 安装 Python 依赖 (根据魔搭指南)
RUN pip install gradio

# 暴露端口
EXPOSE 7860

ENTRYPOINT ["python", "-u", "app.py"]
