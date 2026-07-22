"""
Netlify 手动部署脚本 v2 — 打包项目源文件并上传（绕过构建额度）
"""
import os, json, zipfile, tempfile, urllib.request, sys

TOKEN = "nfp_X63evNLNGe2rTgRpohGoJSPEZGiePnju8399"
SITE_ID = "c6fabf41-c6c1-4afe-b138-ede45790efbc"
PROJECT = os.path.dirname(os.path.abspath(__file__))

# Include just source files
INCLUDE_DIRS = ['app', 'lib', 'components', 'public', 'hooks', '.next']
INCLUDE_FILES = [
    'package.json', 'package-lock.json', 'next.config.mjs', 'netlify.toml',
    'tsconfig.json', 'tailwind.config.ts', 'postcss.config.mjs',
]
EXCLUDE_DIRS = ['node_modules', '.git', '__pycache__', '.vercel', '.netlify']

print("[*] Creating deploy zip...")

zip_path = os.path.join(tempfile.gettempdir(), "netlify-deploy.zip")

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(PROJECT):
        # Filter dirs
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        # Only process relevant dirs
        rel_root = os.path.relpath(root, PROJECT)
        if rel_root == '.':
            pass  # root, include top-level files
        else:
            parts = rel_root.split(os.sep)
            if parts[0] not in INCLUDE_DIRS and not any(
                rel_root.startswith(d + os.sep) for d in INCLUDE_DIRS
            ):
                continue

        for f in files:
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, PROJECT).replace(os.sep, '/')

            # Include from INCLUDE_DIRS or INCLUDE_FILES
            should_include = False
            for d in INCLUDE_DIRS:
                if rel.startswith(d + '/'):
                    should_include = True
                    break
            if rel in INCLUDE_FILES:
                should_include = True

            if not should_include:
                continue

            # Skip large files
            if os.path.getsize(fp) > 5 * 1024 * 1024:
                print(f"   [SKIP large] {rel}")
                continue

            zf.write(fp, rel)

size_kb = os.path.getsize(zip_path) / 1024
print(f"   Packed: {size_kb:.0f} KB")

# Upload
print("[*] Uploading to Netlify...")

with open(zip_path, 'rb') as f:
    zip_data = f.read()

boundary = "----Boundary7MA4YWxkTrZu0gW"
body = b""
body += ("--" + boundary + "\r\n").encode()
body += b'Content-Disposition: form-data; name="file"; filename="site.zip"\r\n'
body += b'Content-Type: application/zip\r\n\r\n'
body += zip_data
body += b"\r\n"
body += ("--" + boundary + "\r\n").encode()
body += b'Content-Disposition: form-data; name="draft"\r\n\r\nfalse\r\n'
body += ("--" + boundary + "--\r\n").encode()

req = urllib.request.Request(
    "https://api.netlify.com/api/v1/sites/" + SITE_ID + "/deploys",
    data=body, method="POST"
)
req.add_header("Authorization", "Bearer " + TOKEN)
req.add_header("Content-Type", "multipart/form-data; boundary=" + boundary)

try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read())
        print(f"   Deploy ID: {result.get('id', '?')}")
        print(f"   State: {result.get('state', '?')}")
        deploy_url = result.get('deploy_ssl_url') or result.get('ssl_url')
        print(f"   URL: {deploy_url}")
except Exception as e:
    print(f"   [X] Upload failed: {e}")
    sys.exit(1)
finally:
    os.unlink(zip_path)

print("\n[*] Waiting for deploy to process...")

import time
deploy_id = result.get('id')
for i in range(20):
    time.sleep(5)
    try:
        req2 = urllib.request.Request(
            "https://api.netlify.com/api/v1/sites/" + SITE_ID + "/deploys/" + deploy_id
        )
        req2.add_header("Authorization", "Bearer " + TOKEN)
        with urllib.request.urlopen(req2, timeout=10) as resp:
            d = json.loads(resp.read())
        state = d.get('state', '?')
        msg = d.get('summary', {}).get('message', '')
        print(f"   [{state}] {msg[:100]}")
        if state == 'ready':
            print(f"\n[OK] Deploy ready!")
            print(f"   {d.get('deploy_ssl_url', '?')}")
            break
        elif state == 'error':
            print(f"\n[X] Deploy error: {d.get('error_message', '')[:200]}")
            break
    except Exception as e:
        print(f"   [WARN] Check error: {e}")
