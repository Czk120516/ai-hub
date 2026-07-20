"""
Netlify 部署脚本 — 打包静态站点 + Functions 并上传。
"""
import os
import sys
import json
import time
import zipfile
import tempfile
import shutil
from pathlib import Path
import urllib.request
import urllib.error

SITE_ID = "b1210c26-a6fc-4744-8cc7-e429846275e5"
AUTH_TOKEN = "nfp_X63evNLNGe2rTgRpohGoJSPEZGiePnju8399"
PROJECT_DIR = Path(__file__).parent

def api_request(method, path, data=None):
    url = f"https://api.netlify.com/api/v1{path}"
    hdrs = {"Authorization": f"Bearer {AUTH_TOKEN}"}
    body = json.dumps(data).encode() if data else None
    if body:
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:500]
        print(f"  API Error {e.code}: {err}")
        return None

def add_to_zip(zf, src_dir, arc_prefix=""):
    """递归添加目录到 zip"""
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            fp = os.path.join(root, f)
            arcname = os.path.join(arc_prefix, os.path.relpath(fp, src_dir))
            zf.write(fp, arcname)

def build_deploy_zip():
    """构建包含 out/ + netlify/ + netlify.toml 的 zip"""
    out_dir = PROJECT_DIR / "out"
    func_dir = PROJECT_DIR / "netlify" / "functions"
    toml_file = PROJECT_DIR / "netlify.toml"
    
    if not out_dir.exists():
        print("[X] out/ directory not found, run npm run build first")
        sys.exit(1)
    
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    zip_path = tmp.name
    tmp.close()
    
    print("[*] Packing deploy files...")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # 1. 静态站点文件 (out/ 内容作为根)
        for f in out_dir.rglob("*"):
            if f.is_file():
                arcname = str(f.relative_to(out_dir))
                zf.write(f, arcname)
                if arcname == "index.html":
                    print(f"   + {arcname}")
        
        # 2. netlify.toml
        if toml_file.exists():
            zf.write(toml_file, "netlify.toml")
            print(f"   + netlify.toml")
        
        # 3. Functions
        if func_dir.exists():
            for f in func_dir.rglob("*"):
                if f.is_file():
                    arcname = str(Path("netlify") / "functions" / f.name)
                    zf.write(f, arcname)
                    print(f"   + {arcname}")
    
    size = os.path.getsize(zip_path) / 1024
    print(f"   Packed: {size:.1f} KB")
    return zip_path

def deploy_zip(zip_path):
    """上传 zip 到 Netlify"""
    print(f"[*] Uploading to Netlify...")
    
    with open(zip_path, 'rb') as f:
        zip_data = f.read()
    
    boundary = "----FormBoundary7MA4YWxkTrZu0gW"
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="file"; filename="site.zip"\r\n'
    body += b'Content-Type: application/zip\r\n\r\n'
    body += zip_data
    body += b"\r\n"
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="draft"\r\n\r\nfalse\r\n'
    body += f"--{boundary}--\r\n".encode()
    
    req = urllib.request.Request(
        f"https://api.netlify.com/api/v1/sites/{SITE_ID}/deploys",
        data=body, method="POST"
    )
    req.add_header("Authorization", f"Bearer {AUTH_TOKEN}")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            print(f"   Deploy ID: {result.get('id','?')[:14]}")
            print(f"   State: {result.get('state','?')}")
            return result
    except urllib.error.HTTPError as e:
        print(f"   [X] Upload failed: {e.code} - {e.read().decode()[:500]}")
        return None

def check_deploy(deploy_id):
    """检查部署状态"""
    for i in range(30):
        time.sleep(10)
        d = api_request("GET", f"/sites/{SITE_ID}/deploys/{deploy_id}")
        if not d:
            continue
        state = d.get("state", "?")
        msg = d.get("summary", {}).get("message", "")
        print(f"   [{state}] {msg[:80]}")
        if state == "ready":
            return d
        if state == "error":
            err = d.get("error_message", "")
            print(f"   [X] Error: {err[:200]}")
            return d
    return None

# --- 主流程 ---
if __name__ == "__main__":
    out_dir = PROJECT_DIR / "out"
    
    if not out_dir.exists():
        print("[X] out/ directory not found, run npm run build first")
        sys.exit(1)
    
    zip_path = build_deploy_zip()
    result = deploy_zip(zip_path)
    os.unlink(zip_path)
    
    if not result:
        sys.exit(1)
    
    deploy_id = result.get("id")
    if deploy_id:
        print(f"\n[*] Waiting for deploy...")
        final = check_deploy(deploy_id)
        if final and final.get("state") == "ready":
            url = final.get("deploy_ssl_url") or final.get("ssl_url") or "https://ai-hub-czk.netlify.app"
            print(f"\n[OK] Deploy successful!")
            print(f"   {url}")
        else:
            print(f"\n[!] Deploy state abnormal, check Netlify dashboard")
    
    print(f"\n   Netlify 后台: https://app.netlify.com/projects/ai-hub-czk")
