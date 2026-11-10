import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import { findDshHome } from "./core.js";

const SUFFIXES = [
  [".xn--fiqs8s", "CN"],
  [".xn--fiqz9s", "CN"],
  [".xn--j6w193g", "HK"],
  [".xn--mix082f", "MO"],
  [".xn--55qx5d", "CN"],
  [".xn--io0a7i", "CN"],
  [".xn--55qw42g", "CN"],
  [".xn--zfr164b", "CN"],
  [".xn--czru2d", "CN"],
  [".xn--hxt814e", "CN"],
  [".xn--fiq228c5hs", "CN"],
  [".xn--3bst00m", "CN"],
  [".xn--ses554g", "CN"],
  [".中国", "CN"],
  [".中國", "CN"],
  [".公司", "CN"],
  [".网络", "CN"],
  [".網絡", "CN"],
  [".公益", "CN"],
  [".政务", "CN"],
  [".商城", "CN"],
  [".网店", "CN"],
  [".中文网", "CN"],
  [".集团", "CN"],
  [".网址", "CN"],
  [".在线", "CN"],
  [".移动", "CN"],
  [".我爱你", "CN"],
  [".香港", "HK"],
  [".澳门", "MO"],
  [".澳門", "MO"],
  [".com.cn", "CN"],
  [".net.cn", "CN"],
  [".org.cn", "CN"],
  [".gov.cn", "CN"],
  [".edu.cn", "CN"],
  [".ac.cn", "CN"],
  [".mil.cn", "CN"],
  [".ah.cn", "CN"],
  [".bj.cn", "CN"],
  [".cq.cn", "CN"],
  [".fj.cn", "CN"],
  [".gd.cn", "CN"],
  [".gs.cn", "CN"],
  [".gx.cn", "CN"],
  [".gz.cn", "CN"],
  [".ha.cn", "CN"],
  [".hb.cn", "CN"],
  [".he.cn", "CN"],
  [".hi.cn", "CN"],
  [".hl.cn", "CN"],
  [".hn.cn", "CN"],
  [".jl.cn", "CN"],
  [".js.cn", "CN"],
  [".jx.cn", "CN"],
  [".ln.cn", "CN"],
  [".nm.cn", "CN"],
  [".nx.cn", "CN"],
  [".qh.cn", "CN"],
  [".sc.cn", "CN"],
  [".sd.cn", "CN"],
  [".sh.cn", "CN"],
  [".sn.cn", "CN"],
  [".sx.cn", "CN"],
  [".tj.cn", "CN"],
  [".xj.cn", "CN"],
  [".xz.cn", "CN"],
  [".yn.cn", "CN"],
  [".zj.cn", "CN"],
  [".hk.cn", "HK"],
  [".mo.cn", "MO"],
  [".cn", "CN"],
  [".com.hk", "HK"],
  [".edu.hk", "HK"],
  [".gov.hk", "HK"],
  [".idv.hk", "HK"],
  [".net.hk", "HK"],
  [".org.hk", "HK"],
  [".hk", "HK"],
  [".com.mo", "MO"],
  [".edu.mo", "MO"],
  [".gov.mo", "MO"],
  [".net.mo", "MO"],
  [".org.mo", "MO"],
  [".mo", "MO"],
];

const FILE_SUFFIX = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "json", "md", "yml", "yaml",
  "css", "html", "map", "log", "txt", "png", "jpg", "jpeg", "gif", "svg",
  "woff", "woff2", "lock", "vue", "py", "go", "rs", "java", "xml", "toml",
  "ini", "bak", "patch", "diff", "sh", "ps1", "cmd", "exe",
]);

// 跨国银行 / 央行 / 国际金融组织 / 主流加密交易所。
// regionOfSuffix 对 .com/.co.jp/.co.kr 这类通用后缀不触发区域判定,银行表精准补齐。
// 子域匹配(online.chase.com → chase.com)也命中。保持小写。
const BANK_HOSTS = new Set([
  "chase.com", "jpmorgan.com", "jpmorganchase.com", "bankofamerica.com",
  "wellsfargo.com", "citibank.com", "citi.com", "usbank.com", "pncbank.com",
  "pnc.com", "tdbank.com", "capitalone.com", "truist.com", "americanexpress.com",
  "amex.com", "discover.com", "ally.com", "schwab.com", "fidelity.com",
  "goldmansachs.com", "morganstanley.com",
  "hsbc.com", "hsbc.co.uk", "barclays.co.uk", "barclays.com", "lloydsbank.com",
  "lloyds.com", "natwest.com", "rbs.co.uk", "santander.co.uk", "nationwide.co.uk",
  "standardchartered.com", "sc.com", "metrobankonline.co.uk", "aib.ie", "boi.com",
  "deutsche-bank.de", "db.com", "commerzbank.de", "sparkasse.de", "dkb.de",
  "ing.de", "n26.com", "targobank.de", "erstebank.at", "raiffeisen.at",
  "bnpparibas.com", "bnpparibas.fr", "credit-agricole.fr", "creditagricole.fr",
  "societegenerale.com", "societegenerale.fr", "labanquepostale.fr", "lcl.fr",
  "ubs.com", "credit-suisse.com", "raiffeisen.ch", "zkb.ch", "pictet.com",
  "juliusbaer.com", "postfinance.ch",
  "ing.com", "abnamro.com", "abnamro.nl", "rabobank.com", "rabobank.nl",
  "kbc.com", "kbc.be", "belfius.be",
  "unicredit.eu", "unicreditgroup.eu", "unicredit.it", "intesasanpaolo.com",
  "intesasanpaolo.it", "mps.it",
  "santander.com", "bbva.com", "bbva.es", "caixabank.es", "bankinter.com",
  "sabadell.com", "novobanco.pt", "millenniumbcp.pt",
  "nordea.com", "seb.se", "swedbank.se", "handelsbanken.se", "danskebank.com",
  "dnb.no", "op.fi",
  "mufg.jp", "bk.mufg.jp", "smbc.co.jp", "mizuhobank.co.jp", "mizuho-fg.co.jp",
  "resona-gr.co.jp", "japanpost.jp", "jp-bank.japanpost.jp", "rakuten-bank.co.jp",
  "sbi-sec.co.jp", "nomura.com",
  "kbstar.com", "shinhan.com", "wooribank.com", "hanabank.com", "ibk.co.kr",
  "nonghyup.com", "kakaobank.com", "tossbank.com",
  "dbs.com", "dbs.com.sg", "posb.com.sg", "uob.com.sg", "uob.com", "ocbc.com",
  "ocbc.com.sg", "maybank2u.com", "maybank.com", "maybank2u.com.my",
  "cimbclicks.com.my", "cimb.com",
  "commbank.com.au", "westpac.com.au", "westpac.co.nz", "anz.com", "anz.com.au",
  "anz.co.nz", "nab.com.au", "bankwest.com.au", "asb.co.nz", "bnz.co.nz",
  "kiwibank.co.nz", "macquarie.com", "macquarie.com.au",
  "rbc.com", "rbcroyalbank.com", "td.com", "tdcanadatrust.com", "scotiabank.com",
  "bmo.com", "cibc.com", "desjardins.com", "nationalbank.ca",
  "sbi.co.in", "onlinesbi.sbi", "hdfcbank.com", "icicibank.com", "axisbank.com",
  "kotak.com", "pnbindia.in", "bankofindia.co.in", "yesbank.in", "idfcfirstbank.com",
  "bca.co.id", "mandiri.co.id", "bri.co.id", "bni.co.id", "bangkokbank.com",
  "scb.co.th", "ktb.co.th", "kasikornbank.com", "vietcombank.com.vn", "bidv.com.vn",
  "vietinbank.vn", "agribank.com.vn", "metrobank.com.ph", "bpi.com.ph", "bdo.com.ph",
  "enbd.com", "rakbank.ae", "adcb.com", "dubaiislamic.ae", "mashreqbank.com",
  "adib.ae", "alrajhibank.com.sa", "snb.com", "samba.com", "qnb.com",
  "leumi.co.il", "bankhapoalim.co.il", "mizrahi-tefahot.co.il", "discountbank.co.il",
  "sberbank.ru", "vtb.com", "vtb.ru", "alfabank.ru", "tinkoff.ru",
  "gazprombank.ru", "rshb.ru", "otkritie.ru",
  "itau.com.br", "bradesco.com.br", "santander.com.br", "bb.com.br",
  "caixa.gov.br", "nubank.com.br", "banorte.com", "banamex.com", "bancomer.com",
  "santander.com.mx", "scotiabank.com.mx", "hsbc.com.mx", "bancochile.cl",
  "bci.cl", "bancolombia.com", "davivienda.com", "bbvacolombia.com",
  "standardbank.co.za", "absa.co.za", "fnb.co.za", "nedbank.co.za",
  "capitecbank.co.za", "ecobank.com", "gtbank.com", "firstbanknigeria.com",
  "accessbankplc.com", "zenithbank.com",
  // 大陆:.cn 已被 SUFFIXES 覆盖区域,这里登记非 .cn 后缀和核心主域方便 bank kind 命中。
  "icbc.com.cn", "icbc-ltd.com", "abchina.com", "boc.cn", "boc-info.com", "ccb.com",
  "bankcomm.com", "pingan.com", "cmbchina.com", "spdb.com.cn", "cmbc.com.cn",
  "cib.com.cn", "cebbank.com", "hxb.com.cn", "bosc.cn", "psbc.com",
  "hsbc.com.hk", "hangseng.com", "hangseng.com.hk", "bochk.com",
  "cmbwinglungbank.com", "scb.com.hk", "bea.com.hk", "dahsing.com", "icbcasia.com",
  "chbank.com.hk", "dbs.com.hk", "bnu.com.mo", "icbc.com.mo",
  "ctbcbank.com", "esunbank.com.tw", "cathaybk.com.tw", "taishinbank.com.tw",
  "fubon.com", "megabank.com.tw", "landbank.com.tw", "firstbank.com.tw",
  "federalreserve.gov", "frbservices.org", "ecb.europa.eu", "bankofengland.co.uk",
  "boj.or.jp", "boc.gov.cn", "pbc.gov.cn", "snb.ch", "rba.gov.au", "rbnz.govt.nz",
  "worldbank.org", "imf.org", "bis.org", "adb.org", "afdb.org", "iadb.org",
  "swift.com", "visa.com", "mastercard.com", "unionpayintl.com", "unionpay.com",
  "binance.com", "coinbase.com", "kraken.com", "bitstamp.net", "bitfinex.com",
  "bybit.com", "okx.com", "huobi.com", "kucoin.com", "gate.io", "bitget.com",
  "crypto.com", "gemini.com", "upbit.com", "bithumb.com",
]);

function bankHit(name) {
  if (!name || typeof name !== "string") return false;
  if (BANK_HOSTS.has(name)) return true;
  let dot = name.indexOf(".");
  while (dot !== -1) {
    if (BANK_HOSTS.has(name.slice(dot + 1))) return true;
    dot = name.indexOf(".", dot + 1);
  }
  return false;
}

const LOOKUP_MS = 2000;
const LOOKUP_TTL_MS = 5000;
const lookupCache = new Map();

function isLocalLabV4(value) {
  const a = value >>> 24;
  const b = (value >>> 16) & 255;
  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isLocalLabAddress(addr) {
  const name = hostOf(addr);
  if (!name) return false;
  if (name.includes(":")) {
    const value = parseIpv6(name);
    if (value == null) return false;
    if ((value >> 32n) === 0xffffn) return isLocalLabV4(Number(value & 0xffffffffn) >>> 0);
    if (value === 0n || value === 1n) return true;
    if ((value >> 118n) === 0x3fan) return true;
    if ((value >> 121n) === 0x7en) return true;
    return false;
  }
  const value = ipv4ToInt(name);
  return value != null && isLocalLabV4(value);
}

async function lookupIps(name) {
  const key = String(name || "").toLowerCase();
  const cached = lookupCache.get(key);
  if (cached && cached.at > Date.now() - LOOKUP_TTL_MS) return cached.ips;
  let ips = [];
  try {
    const rows = await Promise.race([
      dns.lookup(key, { all: true, verbatim: true }),
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error("lookup-timeout")), LOOKUP_MS);
        if (typeof timer.unref === "function") timer.unref();
      }),
    ]);
    ips = [...new Set((Array.isArray(rows) ? rows : [rows]).map((row) => row && row.address).filter(Boolean))];
  } catch {
    ips = [];
  }
  lookupCache.set(key, { at: Date.now(), ips });
  if (lookupCache.size > 256) lookupCache.delete(lookupCache.keys().next().value);
  return ips;
}

const DENIAL = "目标不在本会话授权范围：先在对话里给出域名 / IP / CIDR，或把 net-policy.json 的 mode 设为 off。";

// 渗透(?!测试)：「渗透测试 / IP 与渗透测试」不是攻击任务（#73）。
// exploit(?!-)：exploit-db.com 等资料站不算 exploit 关键词。
// (?<!防御)攻击：「防御攻击手法」不误触。
const ATTACK =
  /渗透测试|红队|打点|拿站|渗透(?!测试)|打穿|打下|打站|入侵|拿壳|拿权限|爆破|提权|webshell|getshell|端口扫描|pentest|\bexploit\b(?![-a-z0-9])|\bbreach\b|\bpwn\b|(?<!防御)攻击(?!面)|(?<!surface\s)\battack\b(?!\s+surface)/i;

// 外挂硬拦。单字「辅助 / 透视」太容易误伤辅助函数、透视投影，必须带游戏或挂本身。
const CHEAT_STRONG =
  /外挂|游戏辅助|自瞄|自动瞄准|无后座|无限弹药|人物透视|物品透视|透视挂|开透视|加速挂|飞天挂|瞬移挂|锁头|压枪挂|改血|过反作弊|注入游戏|aimbot|wallhack|triggerbot|spinbot|silent\s*aim|game\s*cheat|anti-?cheat|cheat\s*engine/i;
const CHEAT_GAME =
  /游戏|网游|端游|手游|\bgame\b|steam|csgo|\bcs2\b|pubg|valorant|和平精英|王者荣耀|原神/i;
const CHEAT_WEAK =
  /内存修改|读内存|写内存|dll注入/i;

// ReDoS 保险:ATTACK 含零宽环视,整段消息(贴代码/日志)超过上限时按窗扫，不一次喂整篇。
const ATTACK_SCAN_CAP = 256 * 1024;
const ATTACK_WINDOW = 8192;

const NET_TOPIC =
  /(?:代理|\bproxy\b|socks|vpn|frp|clash|v2ray|小飞机|机场|出口\s*ip|本机\s*ip|内网\s*ip|公网\s*ip|ip\s*地址|ip\s*归属|ip\s*查询|ip\s*相关|dns|域名解析|网卡|隧道|反向代理|正向代理|http[s]?\s*代理)/i;

function ipv4ToInt(ip) {
  const parts = String(ip).split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const number = Number(part);
    if (number > 255) return null;
    value = value * 256 + number;
  }
  return value >>> 0;
}

function parseIpv6(input) {
  let text = String(input || "").trim().toLowerCase().split("%")[0];
  if (!text) return null;
  if (text.includes(".")) {
    const colon = text.lastIndexOf(":");
    const tail = ipv4ToInt(text.slice(colon + 1));
    if (tail == null) return null;
    const hi = (tail >>> 16).toString(16);
    const lo = (tail & 0xffff).toString(16);
    text = `${text.slice(0, colon + 1)}${hi}:${lo}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 && left.length !== 8) return null;
  if (halves.length === 2 && missing < 0) return null;
  const parts = halves.length === 2 ? [...left, ...Array(missing).fill("0"), ...right] : left;
  if (parts.length !== 8) return null;
  let out = 0n;
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
    out = (out << 16n) + BigInt(parseInt(part, 16));
  }
  return out;
}

export function regionOfSuffix(host) {
  const name = String(host || "").trim().toLowerCase().replace(/\.$/, "");
  if (!name || name === "localhost" || name.endsWith(".local")) return "";
  for (const [suffix, region] of SUFFIXES) {
    if (name === suffix.slice(1) || name.endsWith(suffix)) return region;
  }
  return "";
}

function hostOf(raw) {
  let host = String(raw || "").trim().toLowerCase();
  if (!host) return "";
  const at = host.lastIndexOf("@");
  if (at >= 0) host = host.slice(at + 1);
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end > 1 ? host.slice(1, end) : "";
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(host)) return host.replace(/:\d+$/, "");
  if (/^[a-z0-9.-]+:\d+$/.test(host)) return host.replace(/:\d+$/, "");
  return host.replace(/\.$/, "");
}

// 本地补丁 2026-11-04：从自由文本里抽 host 时，只收「长得像 host」的东西。
// 原来 addHost 收什么认什么，中文句子里带「。」「：」会被整句当成一个 host
// （例：「靶标：example.com」→ 抽出 "红队演练…靶标：example.com"），
// 这个假 host 永远不在白名单里，于是合法目标照样被拦。
const HOST_PUNCT = /[\s\/\\@#$%^&*+=|~`<>\[\]{}()'\u2018\u2019\u201c\u201d?\uff1f!\uff01\uff0c,\u3001;\uff1b:\uff1a\u3002\uff0e\u00b7\u300a\u300b\u3010\u3011\u300c\u300d]/;
const HOST_SHAPE = /^(?:[a-z0-9\u4e00-\u9fff](?:[a-z0-9\u4e00-\u9fff-]{0,61}[a-z0-9\u4e00-\u9fff])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59}|[\u4e00-\u9fff]{2,12})$/u;

function looksLikeHost(host) {
  if (!host) return false;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return true;
  if (host.includes(":")) return parseIpv6(host) != null;
  if (HOST_PUNCT.test(host)) return false;
  return HOST_SHAPE.test(host);
}

function addHost(raw, hosts) {
  const host = hostOf(raw);
  if (!host || host.length > 253 || !looksLikeHost(host)) return;
  hosts.add(host);
}

function inFilePath(sample, index) {
  const prev = sample[index - 1];
  return prev === "/" || prev === "\\";
}

/** 网址里的主机照收。裸名字要像域名：路径片段、文件后缀、两段的 .mo 文件名丢掉。 */
function keepBareDomain(sample, index, name) {
  if (inFilePath(sample, index)) return false;
  const labels = name.split(".");
  const tail = labels[labels.length - 1];
  if (FILE_SUFFIX.has(tail)) return false;
  if (labels.length === 2 && tail === "mo") return false;
  return true;
}

function collectFromText(text, hosts) {
  const sample = String(text || "").slice(0, 32768);
  const url = /\b(?:[a-z][a-z0-9+.-]*:\/\/)([^/?#\s]+)/gi;
  for (const match of sample.matchAll(url)) addHost(match[1], hosts);
  const mapped = [];
  const mappedRe = /(?:[0-9a-f]{0,4}:){1,6}ffff:(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)/gi;
  for (const match of sample.matchAll(mappedRe)) {
    const value = match[0].toLowerCase();
    hosts.add(value);
    mapped.push({ start: match.index, end: match.index + match[0].length });
  }
  const covered = (index, length) => mapped.some((span) => index >= span.start && index + length <= span.end);
  const ipv4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
  for (const match of sample.matchAll(ipv4)) {
    if (covered(match.index, match[0].length)) continue;
    hosts.add(match[0]);
  }
  const ipv6 = /(?<![\d:])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?![\d])/gi;
  for (const match of sample.matchAll(ipv6)) {
    const value = match[0];
    if (/^[\d:]+$/.test(value)) continue;
    if (covered(match.index, value.length)) continue;
    hosts.add(value);
  }
  const domain = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;
  for (const match of sample.matchAll(domain)) {
    const name = match[0].toLowerCase();
    if (!keepBareDomain(sample, match.index, name)) continue;
    hosts.add(name);
  }
  if (/\blocalhost\b/i.test(sample)) hosts.add("localhost");
}

const HOST_NAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const V4_TEXT = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export function allowFilePath(dshHome = findDshHome()) {
  return path.join(dshHome, "net-scope-allow.txt");
}

/** 只接受一个 IP 或一个完整主机名。账号可以写成 user@host。密钥、网段、通配符丢掉。 */
export function entryHost(raw) {
  const text = String(raw || "").trim();
  if (!text || text.startsWith("#")) return "";
  if (text.length > 253 || /[\s/\\*]/.test(text)) return "";
  if (/BEGIN |PRIVATE KEY|ssh-(?:rsa|ed25519|dss) /i.test(text)) return "";
  let body = text;
  const at = body.lastIndexOf("@");
  if (at >= 0) {
    const user = body.slice(0, at);
    if (!/^[A-Za-z0-9._-]{1,32}$/.test(user)) return "";
    body = body.slice(at + 1);
  }
  const host = hostOf(body);
  if (!host || host.length > 253) return "";
  if (V4_TEXT.test(host)) return host;
  if (host.includes(":")) return parseIpv6(host) != null ? host : "";
  if (!HOST_NAME.test(host)) return "";
  const tail = host.slice(host.lastIndexOf(".") + 1);
  if (FILE_SUFFIX.has(tail)) return "";
  return host;
}

export function normalizeAllowText(text) {
  const kept = [];
  const seen = new Set();
  let dropped = 0;
  for (const line of String(text || "").split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    if (raw.startsWith("#")) {
      kept.push(raw);
      continue;
    }
    // 本地补丁：允许 IPv4 CIDR（如 203.0.113.0/24）
    const cidr = parseCidrLine(raw);
    if (cidr) {
      const label = `${intToIpv4(cidr.net)}/${maskBits(cidr.mask)}`;
      if (!seen.has(label)) { seen.add(label); kept.push(label); }
      continue;
    }
    const host = entryHost(raw);
    if (!host) {
      dropped += 1;
      continue;
    }
    if (seen.has(host)) continue;
    seen.add(host);
    const at = raw.lastIndexOf("@");
    kept.push(at > 0 ? `${raw.slice(0, at)}@${host}` : host);
  }
  return { text: kept.length ? `${kept.join("\n")}\n` : "", dropped, hosts: [...seen] };
}

export function readAllowText(dshHome = findDshHome()) {
  try {
    return fs.readFileSync(allowFilePath(dshHome), "utf8");
  } catch {
    return "";
  }
}

/* ───────────────────────────────────────────────────────────────────────
 * 本地补丁 2026-11-04：白名单真正生效 + 支持 IPv4 CIDR + 全局放行开关
 *
 *   $DSH_HOME/net-scope-allow.txt   一行一条：域名 / IP / IPv4 CIDR（# 注释）
 *   $DSH_HOME/net-scope-open.json   {"allowPublic": true} → 区域闸整体放行
 *   env DSH_PURGE_OPEN_NET=1        同上，临时调试用
 *
 * 面板里「本地靶场」那个保存按钮走的就是这里。改完要重启宿主。
 * ─────────────────────────────────────────────────────────────────────── */

let allowCache = { key: "", exact: new Set(), cidrs: [], open: false };

function maskBits(mask) {
  let bits = 0;
  let m = mask >>> 0;
  while (m) { bits += m & 1; m >>>= 1; }
  return bits;
}

function intToIpv4(value) {
  const v = value >>> 0;
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join(".");
}

function parseCidrLine(raw) {
  const m = /^((?:\d{1,3}\.){3}\d{1,3})\/(\d{1,2})$/.exec(String(raw || "").trim());
  if (!m) return null;
  const base = ipv4ToInt(m[1]);
  const bits = Number(m[2]);
  if (base == null || !Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { net: (base & mask) >>> 0, mask };
}

function allowOpen(dshHome) {
  if (/^(1|true|yes|on)$/i.test(String(process.env.DSH_PURGE_OPEN_NET || ""))) return true;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dshHome, "net-scope-open.json"), "utf8"));
    return !!(cfg && cfg.allowPublic === true);
  } catch {
    return false;
  }
}

function loadAllow(dshHome = findDshHome()) {
  // 不缓存：名单文件很小，闸门调用频率低；缓存曾导致改动不生效（mtime 判定靠不住）。
  const file = allowFilePath(dshHome);
  const key = file;
  const open = allowOpen(dshHome);

  const exact = new Set();
  const cidrs = [];
  for (const line of readAllowText(dshHome).split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    const cidr = parseCidrLine(raw);
    if (cidr) { cidrs.push(cidr); continue; }
    const host = entryHost(raw);
    if (host) exact.add(host);
  }
  allowCache = { key, exact, cidrs, open };
  return allowCache;
}

function ipv4InCidrs(value, cidrs) {
  if (value == null || !cidrs.length) return false;
  return cidrs.some((c) => ((value & c.mask) >>> 0) === c.net);
}

/** 域名/IP 是否命中白名单：精确域名、精确 IP，或解析后落在允许的 CIDR 里 */
async function isAllowlisted(name, allow) {
  const host = hostOf(name);
  if (!host) return false;
  if (allow.exact.has(host)) return true;
  if (host.includes(":")) return false;
  const direct = ipv4ToInt(host);
  if (direct != null) return ipv4InCidrs(direct, allow.cidrs);
  if (!allow.cidrs.length) return false;
  const ips = await lookupIps(host);
  return ips.some((ip) => {
    const v = ipv4ToInt(hostOf(ip));
    return v != null && ipv4InCidrs(v, allow.cidrs);
  });
}

function debugGate(names, allow) {
  try {
    const home = findDshHome();
    const flag = path.join(home, "dsh-purge", "gate-debug.on");
    if (!fs.existsSync(flag)) return;
    const line = JSON.stringify({
      at: new Date().toISOString(),
      names,
      exact: [...allow.exact],
      cidrs: allow.cidrs.map((c) => intToIpv4(c.net) + "/" + maskBits(c.mask)),
      open: allow.open,
    });
    fs.appendFileSync(path.join(home, "dsh-purge", "gate-debug.log"), line + "\n");
  } catch { /* 调试失败不影响判定 */ }
}

export async function writeAllowText(dshHome = findDshHome(), text = "") {
  const normalized = normalizeAllowText(text);
  const file = allowFilePath(dshHome);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, normalized.text, "utf8");
  } catch (e) {
    throw new Error(`write ${file} failed: ${e && e.message ? e.message : e}`);
  }
  allowCache = { key: "", exact: new Set(), cidrs: [], open: false };
  return normalized;
}

export function ownServerNote() {
  return "";
}

function isIp(host) {
  return V4_TEXT.test(host) || host.includes(":");
}

function taskHit(label, kind) {
  return { label, kind };
}

/** 代理 / IP / DNS 等配置咨询，不含攻击词时不拦（#73）。 */
export function isBenignNetworkTopic(text) {
  const t = String(text || "").trim();
  if (!t || !NET_TOPIC.test(t)) return false;
  return !scanHas(ATTACK, t);
}

function scanHas(re, text) {
  const sample = String(text || "");
  const cap = Math.min(sample.length, ATTACK_SCAN_CAP);
  if (!cap) return false;
  if (cap <= ATTACK_WINDOW) return re.test(sample.slice(0, cap));
  const hop = ATTACK_WINDOW - 256;
  for (let i = 0; i < cap; i += hop) {
    if (re.test(sample.slice(i, i + ATTACK_WINDOW))) return true;
  }
  return false;
}

export function isAttackTask(text) {
  const sample = String(text || "");
  if (isBenignNetworkTopic(sample)) return false;
  return scanHas(ATTACK, sample);
}

export function isCheatTask(text) {
  const sample = String(text || "");
  const cap = sample.length > ATTACK_SCAN_CAP ? sample.slice(0, ATTACK_SCAN_CAP) : sample;
  if (CHEAT_STRONG.test(cap)) return true;
  return CHEAT_GAME.test(cap) && CHEAT_WEAK.test(cap);
}

function hostsInTask(text) {
  const hosts = new Set();
  const sample = String(text || "");
  const cap = Math.min(sample.length, ATTACK_SCAN_CAP);
  const win = 32768;
  const hop = 28672;
  const labeled = /(?:[a-z0-9\u00a1-\uffff](?:[a-z0-9\u00a1-\uffff-]{0,61}[a-z0-9\u00a1-\uffff])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59}|[\u4e00-\u9fff]{2,12})/giu;
  for (let i = 0; i < cap; i += hop) {
    const chunk = sample.slice(i, i + win);
    collectFromText(chunk, hosts);
    for (const match of chunk.matchAll(labeled)) {
      const name = match[0].toLowerCase().replace(/\.$/, "");
      if (!keepBareDomain(chunk, match.index, name)) continue;
      addHost(name, hosts);
    }
  }
  return hosts;
}

/**
 * 本地靶场只认解析结果。后缀（.lab / .htb）本身不放行。
 * 走系统解析（含 hosts）：所有 A/AAAA 都必须是本机/私网，有一条公网或解析失败就拦。
 */
async function isRangeTarget(name) {
  if (!name) return false;
  if (name === "localhost" || name.endsWith(".localhost")) return true;
  if (isIp(name)) return isLocalLabAddress(name);
  const ips = await lookupIps(name);
  if (!ips.length) return false;
  return ips.every((ip) => isLocalLabAddress(ip));
}

export async function publicHostHit(text) {
  const names = [];
  for (const host of hostsInTask(text)) {
    const name = hostOf(host);
    if (name) names.push(name);
  }
  if (!names.length) return null;
  const allow = loadAllow();
  debugGate(names, allow);
  if (allow.open) return null;                       // 全局开关：区域闸不拦
  for (const name of names) {
    if (bankHit(name)) return taskHit(name, "bank"); // 银行/支付类始终拦，不受白名单影响
    if (await isRangeTarget(name)) continue;
    if (await isAllowlisted(name, allow)) continue;  // 授权外网资产：白名单放行
    return taskHit(name, isIp(name) ? "ip" : "domain");
  }
  return null;
}

export async function taskTargetHit(text) {
  if (!isAttackTask(text)) return null;
  let found = false;
  for (const host of hostsInTask(text)) {
    if (hostOf(host)) found = true;
  }
  if (!found) return taskHit("unspecified", "domain");
  return publicHostHit(text);
}

function blobOf(value, depth = 0) {
  if (value == null || depth > 3) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => blobOf(item, depth + 1)).join("\n");
  if (typeof value !== "object") return "";
  const skip = new Set(["agent", "session", "ctx", "next", "signal", "context"]);
  return Object.entries(value)
    .filter(([key]) => !skip.has(key))
    .map(([, item]) => blobOf(item, depth + 1))
    .join("\n")
    .slice(0, 32768);
}

function toolArgText(message) {
  const parts = [];
  const calls = message?.toolCalls || message?.tool_calls || [];
  for (const call of Array.isArray(calls) ? calls : []) {
    parts.push(blobOf(call.arguments ?? call.input ?? call.params ?? call));
  }
  if (Array.isArray(message?.content)) {
    for (const block of message.content) {
      if (!block || typeof block !== "object") continue;
      if (block.type === "tool_use" || block.type === "tool-call" || block.type === "tool-call-start") {
        parts.push(blobOf(block.input ?? block.arguments ?? block));
      }
    }
  }
  if (message?.toolName || message?.name) parts.push(String(message.toolName || message.name));
  return parts.join("\n");
}

export function latestToolText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const parts = [];
  for (let i = list.length - 1; i >= 0 && parts.length < 6; i -= 1) {
    const role = list[i]?.role;
    if (role !== "assistant" && role !== "model") continue;
    const blob = toolArgText(list[i]);
    if (blob.trim()) parts.push(blob);
  }
  return parts.join("\n");
}

export function execArgText(exec) {
  if (!exec || typeof exec !== "object") return "";
  return blobOf({
    name: exec.tool?.name || exec.name || exec.toolName,
    args: exec.arguments ?? exec.args ?? exec.input ?? exec.parameters ?? exec.params,
    command: exec.command,
    call: exec.toolCall ?? exec.call,
  });
}

function isRedteamPayload(payload) {
  const session = payload?.agent?.session || payload?.session;
  const raw = session?.agentPreset || session?.header?.agentPreset || session?.projectionValues?.agentPreset || payload?.agent?.preset;
  const id = String(raw?.id || raw?.name || raw || "").toLowerCase();
  return id.includes("redteam");
}

function messageBody(message) {
  if (typeof message?.content === "string") return message.content;
  if (!Array.isArray(message?.content)) return typeof message?.text === "string" ? message.text : "";
  return message.content.map((block) => {
    if (typeof block === "string") return block;
    if (block && block.type === "text" && typeof block.text === "string") return block.text;
    return "";
  }).join("\n");
}

function looksLikeToolResult(message, text) {
  if (message?.toolCallId || message?.tool_call_id || message?.toolName) return true;
  if (message?.source?.kind && message.source.kind !== "user") return true;
  const head = String(text || "").slice(0, 240);
  return /^(?:Tool result|\[tool|function_call|toolu_|call_)/i.test(head);
}

function humanTaskText(message) {
  if (!message || typeof message !== "object") return "";
  if (message.role && message.role !== "user") return "";
  const kind = message.source?.kind;
  if (kind && kind !== "user") return "";
  const text = messageBody(message);
  if (!text || looksLikeToolResult(message, text)) return "";
  if (/^\s*Current runtime context\b/i.test(text)) return "";
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "\n").trim();
}

/** 只看本轮新用户句。整段历史拼在一起会把工具回包、上一轮域名和攻击词叠成误拦。 */
export function currentTaskText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  let cut = -1;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const role = list[i]?.role;
    if (role === "assistant" || role === "model") {
      cut = i;
      break;
    }
  }
  return list.slice(cut + 1).map(humanTaskText).filter(Boolean).join("\n");
}

function sessionOf(payload) {
  const agent = payload?.agent;
  if (agent?.session && typeof agent.session.append === "function") return agent.session;
  if (payload?.session && typeof payload.session.append === "function") return payload.session;
  return null;
}

async function denialMessage() {
  try {
    const mod = await import("@deepseek-ai/dsh-llm");
    if (typeof mod.createAssistantMessage === "function") {
      return mod.createAssistantMessage({
        content: [{ type: "text", text: DENIAL }],
        source: { provider: "deepseek", model: "deepseek-chat" },
      });
    }
  } catch {
    /* 宿主包不在这条导入路径上时用手写消息。 */
  }
  return {
    id: randomUUID(),
    role: "assistant",
    content: [{ type: "text", text: DENIAL }],
    source: { kind: "model", provider: "deepseek", model: "deepseek-chat" },
  };
}

const COMPACT_STREAM_TYPES = new Set([
  "chunk",
  "text-chunks",
  "reasoning-chunks",
  "tool-call-chunks",
]);

function denialChunks() {
  return [
    { type: "block-start", index: 0, blockType: "text" },
    { type: "text-delta", index: 0, text: DENIAL },
    { type: "block-end", index: 0, block: { type: "text", text: DENIAL } },
    { type: "finish", reason: "stop" },
  ];
}

/** 宿主持久化只要 Accumulator 紧致记录；裸 chunk 会让 firstRunMemberTime 读 undefined.length（#84）。
 *  审查「4.1 才是正解」: 每个 chunk 包成 { type: "chunk", time, chunk },走 compact chunk
 *  单条路径,避免批记录 (text-chunks 需要 .texts 字段而不是 .chunks) 字段名错配再次崩溃。 */
function denialStream(now = Date.now()) {
  const time0 = Number.isSafeInteger(now) ? now : Date.now();
  const chunks = denialChunks();
  const records = chunks.map((chunk, i) => ({
    type: "chunk",
    time: time0 + i,
    chunk,
  }));
  for (const record of records) {
    if (!COMPACT_STREAM_TYPES.has(record.type)) {
      throw new TypeError(`denial stream must use compact Assistant records, got ${record.type}`);
    }
  }
  return records;
}

async function appendDenial(session, turn, step) {
  session.append("assistant/message", {
    turn,
    step,
    message: await denialMessage(),
    stream: denialStream(),
  }, { surfaceOp: "append" });
}

async function parkDenial(payload) {
  const session = sessionOf(payload);
  const turn = Number(payload?.turn);
  const step = Number(payload?.step);
  if (!session || !Number.isSafeInteger(turn) || !Number.isSafeInteger(step) || step < 1) return false;
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  let outerOpened = false;
  let innerOpened = false;
  try {
    if (step === 1) {
      for (const message of messages) {
        session.append("user/message", message, { surfaceOp: "append" });
      }
    }
    session.append("step/start", { turn, step });
    outerOpened = true;
    await appendDenial(session, turn, step);
    session.append("step/end", { turn, step });
    return true;
  } catch {
    try {
      if (!outerOpened) {
        session.append("step/start", { turn, step });
        innerOpened = true;
      }
      await appendDenial(session, turn, step);
      session.append("step/end", { turn, step });
      return true;
    } catch {
      // 无论哪一层开过 step/start，都必须补 step/end，否则孤儿步让宿主崩。
      if (outerOpened || innerOpened) {
        try { session.append("step/end", { turn, step }); } catch { /* 步已经合不上时，交给宿主收尾。 */ }
      }
      return false;
    }
  }
}

function denyToolResult() {
  /* 宿主 tools/pre-execute 的决策协议是 { kind, reason }，不是工具结果对象。 */
  return { kind: "deny", reason: DENIAL };
}

/* ============================================================
 * 策略层
 * mode:
 *   off        —— 不注册任何钩子
 *   dynamic    —— 默认：用户在本轮对话里说出的域名/IP/CIDR 即授权；工具参数
 *                 只允许命中该会话的授权范围（+ 基础设施域名）
 *   allowlist  —— 只放行 net-scope-allow.txt（域名 / IP / IPv4 CIDR）
 *   local-only —— 保守模式：只认本机 / RFC1918
 * 配置文件：$DSH_HOME/redteam/net-policy.json
 * ============================================================ */

const INFRA_SUFFIXES = [
  "fofa.info", "quake.360.net", "360.net", "crt.sh", "github.com", "githubusercontent.com",
  "api.github.com", "raw.githubusercontent.com", "pypi.org", "files.pythonhosted.org",
  "registry.npmjs.org", "npmjs.com", "deepseek.com", "deepseek.stream",
  "dsh-plugin.org", "awesome-dsh-plugin.com", "localhost",
];

function isInfraHost(name, policy) {
  const h = hostOf(name);
  if (!h) return false;
  const extra = Array.isArray(policy?.infra) ? policy.infra : [];
  const all = INFRA_SUFFIXES.concat(extra);
  return all.some((s) => h === s || h.endsWith("." + s));
}

function policyFilePath(dshHome = findDshHome()) {
  return path.join(dshHome, "redteam", "net-policy.json");
}

let policyCache = { at: -1, value: null };

function loadPolicy(dshHome = findDshHome()) {
  try {
    const st = fs.statSync(policyFilePath(dshHome));
    if (policyCache.value && policyCache.at === st.mtimeMs) return policyCache.value;
    const raw = JSON.parse(fs.readFileSync(policyFilePath(dshHome), "utf8"));
    const modes = new Set(["off", "dynamic", "allowlist", "local-only"]);
    const value = {
      mode: modes.has(raw && raw.mode) ? raw.mode : "dynamic",
      blockBanks: raw && raw.blockBanks === true,
      autoCidr: Number.isInteger(raw && raw.autoCidr) ? raw.autoCidr : 24,
      infra: Array.isArray(raw && raw.infra) ? raw.infra.map(String) : [],
    };
    policyCache = { at: st.mtimeMs, value };
    return value;
  } catch {
    return { mode: "dynamic", blockBanks: false, autoCidr: 24, infra: [] };
  }
}

const sessionScopes = new WeakMap();
const sessionScopesById = new Map();

function emptyScope() {
  return { hosts: new Set(), ips: new Set(), cidrs: [] };
}

function scopeOf(session) {
  if (!session || (typeof session !== "object" && typeof session !== "function")) return emptyScope();
  let scope = sessionScopes.get(session);
  const id = typeof session.id === "string" ? session.id : "";
  if (!scope && id) scope = sessionScopesById.get(id);
  if (!scope && id) {
    // 派生会话（红队编排派出的执行角色）空白名单时继承父会话的授权范围：
    // "用户给的目标"是跨会话的授权事实，不因派生而逐层空白。
    const parentId = session.header && typeof session.header.parentSession === "string"
      ? session.header.parentSession
      : "";
    if (parentId) {
      const parentScope = sessionScopesById.get(parentId);
      if (parentScope) scope = parentScope;
    }
  }
  if (!scope) scope = emptyScope();
  sessionScopes.set(session, scope);
  if (id) {
    sessionScopesById.set(id, scope);
    if (sessionScopesById.size > 200) sessionScopesById.delete(sessionScopesById.keys().next().value);
  }
  return scope;
}

function addCidr(scope, cidr) {
  if (!cidr) return;
  if (scope.cidrs.some((x) => x.net === cidr.net && x.mask === cidr.mask)) return;
  scope.cidrs.push(cidr);
}

function addIp(scope, ip) {
  const value = hostOf(ip);
  if (!value) return;
  /* IPv4 / IPv6 都按精确地址记；CIDR 只支持 IPv4（parseCidrLine 限定）。 */
  if (value.includes(":")) { scope.ips.add(value.toLowerCase()); return; }
  if (ipv4ToInt(value) == null) return;
  scope.ips.add(value);
}

function addIpWithRange(scope, ip, autoCidr) {
  addIp(scope, ip);
  if (!Number.isInteger(autoCidr) || autoCidr < 0 || autoCidr > 32) return;
  if (autoCidr === 32) return;
  const value = ipv4ToInt(hostOf(ip));
  if (value == null) return;
  const mask = autoCidr === 0 ? 0 : (0xffffffff << (32 - autoCidr)) >>> 0;
  addCidr(scope, { net: (value & mask) >>> 0, mask });
}

function scopeHasHost(scope, name) {
  const h = hostOf(name);
  if (!h) return false;
  if (scope.hosts.has(h)) return true;
  for (const root of scope.hosts) {
    if (h === root || h.endsWith("." + root)) return true;
  }
  if (h.includes(":")) return scope.ips.has(h.toLowerCase());
  const value = ipv4ToInt(h);
  if (value != null) {
    if (scope.ips.has(h)) return true;
    if (scope.cidrs.some((c) => ((value & c.mask) >>> 0) === c.net)) return true;
  }
  return false;
}

/** 把本轮用户文本里的域名/IP/CIDR 记进当前会话授权范围。 */
async function registerScopeFromText(scope, text, policy) {
  const sample = String(text || "").slice(0, 32768);
  /* CIDR 单独抓：collectFromText 只会抓到网段起始 IP */
  for (const m of sample.matchAll(/\b((?:\d{1,3}\.){3}\d{1,3}\/\d{1,2})\b/g)) {
    addCidr(scope, parseCidrLine(m[1]));
  }
  const names = [];
  for (const host of hostsInTask(sample)) {
    const name = hostOf(host);
    if (!name) continue;
    names.push(name);
    if (isIp(name)) {
      addIpWithRange(scope, name, policy.autoCidr);
    } else {
      scope.hosts.add(name);
    }
  }
  /* 域名解析到的地址也记进范围，同时按 autoCidr 带上所在网段 */
  for (const name of names.slice(0, 8)) {
    if (isIp(name)) continue;
    const ips = await lookupIps(name);
    for (const ip of ips) addIpWithRange(scope, ip, policy.autoCidr);
  }
  return names;
}

/** 工具参数里出现未授权公网主机 → 返回 hit；否则 null。 */
function scopeViolation(scope, text, policy) {
  const names = [];
  for (const host of hostsInTask(text)) {
    const name = hostOf(host);
    if (name) names.push(name);
  }
  for (const name of names) {
    if (isLocalLabAddress(name)) continue;
    if (isInfraHost(name, policy)) continue;
    if (scopeHasHost(scope, name)) continue;
    if (policy.blockBanks && bankHit(name)) return taskHit(name, "bank");
    return taskHit(name, isIp(name) ? "ip" : "domain");
  }
  return null;
}

export function installRegionGate(ctx) {
  if (!ctx || typeof ctx.on !== "function") return;
  // 0.2.2 适配：policy 改为每次事件现场读（loadPolicy 自带 mtime 缓存，开销可忽略）。
  // 以前是启动快照 + off 直接不装钩子，运行时改 net-policy.json 完全不生效；
  // 现在 off / dynamic / allowlist 改完立即生效，off 时事件直接放行。
  const hook = async (payload, next) => {
    const forward = () => (typeof next === "function" ? next() : { kind: "enter", messages: payload?.messages || [] });
    const policy = loadPolicy();
    if (policy.mode === "off") return forward();
    const step = Number(payload?.step);
    const session = sessionOf(payload);
    let scope = null;
    let hit = null;
    try {
      scope = scopeOf(session);
      const task = currentTaskText(payload?.messages);
      const redteam = isRedteamPayload(payload);
      if (step === 1) {
        if (!task && !redteam) return forward();
        if (task && isCheatTask(task)) hit = taskHit("cheat", "cheat");
        else if (task) {
          const names = await registerScopeFromText(scope, task, policy);
          if (policy.mode === "dynamic") {
            const empty = scope.hosts.size === 0 && scope.ips.size === 0 && scope.cidrs.length === 0;
            if (isAttackTask(task) && names.length === 0 && empty) hit = taskHit("unspecified", "domain");
          } else if (policy.mode === "allowlist" || policy.mode === "local-only") {
            if (isAttackTask(task)) hit = await taskTargetHit(task);
          }
        }
      } else if (policy.mode === "dynamic") {
        if (redteam || isAttackTask(task)) hit = scopeViolation(scope, latestToolText(payload?.messages), policy);
      } else if (redteam || isAttackTask(task)) {
        hit = await publicHostHit(latestToolText(payload?.messages));
      }
    } catch {
      return forward();
    }
    if (!hit) return forward();
    try {
      const parked = await parkDenial(payload);
      if (parked) return { kind: "enter", messages: [] };
    } catch {
      /* 禁止句没写上时不能把这一轮收成空白。 */
    }
    return forward();
  };

  const toolHook = async (exec, next) => {
    const forward = () => (typeof next === "function" ? next() : denyToolResult());
    const name = String(exec?.tool?.name || exec?.name || exec?.toolName || "").toLowerCase();
    if (!["bash", "pwsh", "browser_navigate", "browser_open", "browser_click"].includes(name)) return forward();
    try {
      const blob = execArgText(exec);
      if (!blob.trim()) return forward();
      const policy = loadPolicy();
      if (policy.mode === "off") return forward();
      let hit = null;
      if (policy.mode === "dynamic") {
        const session = exec?.agent?.session || exec?.session || null;
        hit = scopeViolation(scopeOf(session), blob, policy);
      } else {
        hit = await publicHostHit(blob);
      }
      if (!hit) return forward();
    } catch {
      return forward();
    }
    if (exec && typeof exec === "object") {
      exec.blocked = true;
      exec.error = DENIAL;
    }
    return denyToolResult();
  };

  const arm = () => {
    if (ctx.__dshPurgeRegionGate) return true;
    try {
      ctx.on("agent/pre-step", hook, { global: true, prepend: true });
      try { try { ctx.on("tools/pre-execute", toolHook, { global: true, prepend: true }); } catch { try { ctx.on("tools/pre-execute", toolHook); } catch { /* 旧宿主没有工具钩。 */ } } } catch { /* 旧宿主没有工具钩。 */ }
      ctx.__dshPurgeRegionGate = true;
      return true;
    } catch {
      return false;
    }
  };
  if (arm()) return;
  queueMicrotask(() => {
    if (arm()) return;
    const t1 = setTimeout(() => {
      if (arm()) return;
      const t2 = setTimeout(() => { arm(); }, 200);
      if (typeof t2.unref === "function") t2.unref();
    }, 50);
    if (typeof t1.unref === "function") t1.unref();
  });
}

/* 仅供本地测试使用：不参与运行时逻辑。 */
export const __test = { parseCidrLine, scopeHasHost, registerScopeFromText, scopeViolation, emptyScope, loadPolicy, isInfraHost, looksLikeHost, hostsInTask, addHost };
