# scripts/uploader.py

import requests
import os
import json
import time

# ==============================================================================
# 1. 配置区域：脚本将从环境变量读取这些值
# ==============================================================================

# 本地文件路径 (相对于仓库根目录)
# 因为Action会检出整个仓库，所以路径是相对于根目录的
LOCAL_FILES_PATH = 'dictionary' 

# API接口地址
API_URL = 'https://api-overseas.retiehe.com/backend/host-v3/site/content'

# 从请求Payload中获取的固定信息
DOMAIN = 'e2adict'
USERNAME = 'newbiexvwusxijhfn2'

# 从GitHub Secrets读取凭证 (通过环境变量)
AUTH_TOKEN = os.environ.get('AUTH_TOKEN')
COOKIE_STRING = os.environ.get('COOKIE_STRING')

# ==============================================================================
# 2. 脚本主体
# ==============================================================================

def upload_file(file_path, remote_key):
    """上传单个文件的函数"""
    headers = {
        'Authorization': AUTH_TOKEN,
        'Cookie': COOKIE_STRING,
        # 其他Headers保持不变
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'Origin': 'https://host.retiehe.com',
        'Referer': 'https://host.retiehe.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            file_content = f.read()
    except Exception as e:
        print(f" 读取文件失败: {file_path}, 错误: {e}")
        return

    # 注意：这里的 'key' 需要包含 'dictionary/' 前缀
    payload = {
        "content": file_content,
        "domain": DOMAIN,
        "key": f"dictionary/{remote_key}",
        "type": "string",
        "username": USERNAME
    }
    
    try:
        print(f" 正在上传: {payload['key']} ...")
        response = requests.post(API_URL, headers=headers, data=json.dumps(payload))
        
        if response.status_code == 200 and response.json().get('success'):
            print(f" 上传成功: {payload['key']}")
        else:
            print(f" 上传失败: {payload['key']}, 状态码: {response.status_code}, 响应: {response.text}")
            # 如果失败，抛出异常以使 GitHub Action 失败
            response.raise_for_status()
            
    except requests.exceptions.RequestException as e:
        print(f" 请求异常: {payload['key']}, 错误: {e}")
        raise e


def main():
    """主函数"""
    if not AUTH_TOKEN or not COOKIE_STRING:
        print(" 错误: 环境变量 AUTH_TOKEN 或 COOKIE_STRING 未设置！")
        exit(1)

    if not os.path.isdir(LOCAL_FILES_PATH):
        print(f" 错误: 文件夹 '{LOCAL_FILES_PATH}' 在仓库中不存在。")
        exit(1)

    for filename in os.listdir(LOCAL_FILES_PATH):
        if filename.endswith('.json'):
            local_file_path = os.path.join(LOCAL_FILES_PATH, filename)
            # remote_key 就是文件名本身，例如 "aaron.json"
            upload_file(local_file_path, filename)
            time.sleep(0.2) # 轻微延迟

if __name__ == '__main__':
    main()
    print("\n 所有文件处理完毕！")
