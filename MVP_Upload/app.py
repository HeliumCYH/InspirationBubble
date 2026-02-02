import subprocess
import os
import sys

# 启动 Node.js 服务器并监听 7860 端口
print("Starting Inspiration Bubble (Node.js) on port 7860...")
os.environ["PORT"] = "7860"

try:
    # 运行 Node.js 程序
    subprocess.run(["node", "server.js"], check=True)
except KeyboardInterrupt:
    print("Stopping server...")
except Exception as e:
    print(f"Error occurred: {e}")
    sys.exit(1)
