---
name: quake-recon
description: 用 Quake 360 API 批量测绘靶标资产（域名/IP/端口/标题/指纹/服务）；内置限速客户端，单线程 + 间隔 + 退避重试
whenToUse: 信息收集阶段需要快速铺开某单位/域名的互联网资产面时
role: recon
enabled: true
---

# Quake 360 资产测绘（限速安全版）

## 凭据
- 与 `fofa-recon` **互补不互斥**：只配了 `FOFA_KEY` 时改用 fofa-recon；两个都配可以一个查 Quake、一个查 FOFA 互相校验。
- API Token：从环境变量 `QUAKE_KEY` 读取（**任何 key 都不要写进仓库**；本技能所有脚本只读环境变量）
- 获取：登录 <https://quake.360.net> → 用户中心 → API Token
- 接口：`POST https://quake.360.net/api/v3/search/quake_service`
- 请求头：`X-QuakeToken: <QUAKE_KEY>`、`Content-Type: application/json`
- 请求体：`{"query": "...", "start": 0, "size": 100, "ignore_cache": true, "include": ["ip","port","hostname","domain","title","service","location"]}`
- 响应：`code === 0` 成功；`data` 为资产数组；`meta.pagination.total` 为总数

## 常用 DSL
- `domain:"example.com"` —— 主域名及其子域资产
- `ip:"203.0.113.5"` —— 指定 IP
- `cert:"example.com"` —— 按证书反查
- `org:"示例科技"` —— 按单位名称
- `port:443 AND domain:"example.com"` —— 组合条件
- `title:"后台"` / `body:"login"` —— 页面特征

## 使用纪律
1. **精确查询优先**：先 `domain=` / `cert=` / `org=` 缩小范围，再考虑 `body=` / `title=` 宽泛语句。
2. **默认只取前 1–3 页**（每页 100 条）拿到入口即可，不要全量翻页。
3. **单进程单线程**，同一时刻只跑一个采集任务；多个查询串行排队。
4. **结果落盘缓存**：同一查询先看 `runs/quake-*.jsonl` 是否已有。
5. **长任务放后台**：用 `run_in_background` 跑。
6. 配额耗尽或被限速时改用证书透明、DNS、搜索引擎，不要死磕。

## 限速客户端（用这个，不要手写 curl 循环）
```bash
mkdir -p runs
cat > runs/quake_client.py <<'PY'
#!/usr/bin/env python3
"""Quake 采集（限速安全）：单线程 + 最小间隔 + 指数退避 + 结果缓存。

用法:
  python3 runs/quake_client.py 'domain:"example.com"' --pages 2 --size 100 --interval 1.5
输出:
  runs/quake-<slug>.jsonl   每行一个资产
"""
import argparse, hashlib, json, os, sys, time, urllib.error, urllib.request

try:
    KEY = os.environ["QUAKE_KEY"]
except KeyError:
    KEY = ""
API = "https://quake.360.net/api/v3/search/quake_service"
INCLUDE = ["ip", "port", "hostname", "domain", "title", "service", "location"]
RETRY_BACKOFF = [5, 15, 45]
HARD_BUDGET = 30


def fetch(query, start, size, timeout=30):
    body = json.dumps({
        "query": query, "start": start, "size": size,
        "ignore_cache": True, "include": INCLUDE,
    }).encode()
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "X-QuakeToken": KEY,
        "Content-Type": "application/json",
        "User-Agent": "redteam-recon/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "ignore")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"code": e.code, "message": raw[:200]}


def pick(row):
    def dig(*paths):
        for p in paths:
            cur, ok = row, True
            for key in p.split("."):
                if isinstance(cur, dict) and key in cur:
                    cur = cur[key]
                else:
                    ok = False
                    break
            if ok and cur not in (None, "", [], {}):
                return cur
        return ""

    def first(v):
        if isinstance(v, list):
            return v[0] if v else ""
        return v

    return {
        "host": first(dig("hostname", "host", "ip")),
        "ip": first(dig("ip")),
        "port": first(dig("port")),
        "domain": first(dig("domain")),
        "title": first(dig("title", "service.http.title")),
        "service": first(dig("service.name", "service_name", "protocol", "service")),
        "location": first(dig("location.country_cn", "location.country", "location_name", "country")),
        "raw": row,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--pages", type=int, default=2)
    ap.add_argument("--size", type=int, default=100)
    ap.add_argument("--interval", type=float, default=1.5)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    if not KEY:
        print("[error] 缺 QUAKE_KEY：在 $DSH_HOME/.env 填 QUAKE_KEY=<token> 后重启 dsh web", file=sys.stderr)
        return 2

    slug = hashlib.md5(args.query.encode()).hexdigest()[:8]
    out = args.out or f"runs/quake-{slug}.jsonl"
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    if os.path.exists(out) and os.path.getsize(out) > 0:
        print(f"[cache] {out} 已存在，如需重拉先删除", file=sys.stderr)
        return 0

    seen, rows, requests_made, last_ts = set(), [], 0, 0.0
    for page in range(args.pages):
        wait = args.interval - (time.time() - last_ts)
        if wait > 0:
            time.sleep(wait)
        status, data = None, None
        for attempt, backoff in enumerate([0] + RETRY_BACKOFF):
            if attempt:
                print(f"[backoff] {backoff}s 后重试 page={page}", file=sys.stderr)
                time.sleep(backoff)
            last_ts = time.time()
            requests_made += 1
            if requests_made > HARD_BUDGET:
                print(f"[stop] 达到请求预算 {HARD_BUDGET}", file=sys.stderr)
                break
            status, data = fetch(args.query, page * args.size, args.size)
            code = data.get("code")
            msg = str(data.get("message", ""))
            if status == 200 and code == 0:
                break
            if status == 429 or "频率" in msg or "too many" in msg.lower() or code == 429:
                continue
            print(f"[stop] 不可重试错误 http={status} code={code} {msg}", file=sys.stderr)
            data = None
            break
        if data is None:
            break
        batch = data.get("data") or []
        for row in batch:
            item = pick(row)
            key = (item["ip"], item["port"], item["host"])
            if key in seen:
                continue
            seen.add(key)
            rows.append(item)
        if len(batch) < args.size:
            break

    with open(out, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"[ok] {len(rows)} 条 -> {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
PY
chmod +x runs/quake_client.py
```

本机已预置：`$DSH_HOME/redteam/runs/quake_client.py`（可直接用，参数相同）。

## 快速验证
```bash
python3 runs/quake_client.py 'domain:"example.com"' --pages 1 --size 10
head -3 runs/quake-*.jsonl
```
