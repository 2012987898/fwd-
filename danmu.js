// ==========================================
// Forward 弹幕插件 1.3 Pro（顶部固定弹幕）
// ==========================================
const WidgetMetadata = {
  id: "danmu_api_Max_binfa_v1_3_fixed",
  title: "并发弹幕 Pro 1.3 - 顶部固定",
  version: "1.3.1",
  requiredVersion: "0.0.2",
  site: "https://t.me/MakkaPakkaOvO",
  description: "支持顶部固定弹幕，繁简转换，颜色模式，屏蔽词，数量限制",
  author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
  globalParams: [
    { name: "server", title: "源1 (必填)", type: "input", value: "" },
    { name: "server2", title: "源2", type: "input" },
    { name: "server3", title: "源3", type: "input" },
    { name: "maxCount", title: "📊 弹幕数量上限", type: "input", value: "3000" },
    { name: "searchBlockKeywords", title: "👁️ 搜索结果屏蔽词 (逗号分隔)", type: "input", value: "" },
    { name: "convertMode", title: "🔠 弹幕转换", type: "enumeration", value: "none", enumOptions:[
        { title: "保持原样", value: "none" },
        { title: "转简体 (繁->简)", value: "t2s" },
        { title: "转繁体 (简->繁)", value: "s2t" }
    ]},
    { name: "colorMode", title: "🎨 弹幕颜色", type: "enumeration", value: "none", enumOptions:[
        { title: "保持原样", value: "none" },
        { title: "全部纯白", value: "white" },
        { title: "部分彩色 (50%彩色)", value: "partial" },
        { title: "完全彩色 (100%彩色)", value: "all" }
    ]},
    { name: "blockKeywords", title: "🚫 弹幕内容屏蔽词 (逗号分隔)", type: "input", value: "" }
  ],
  modules: [
    { id: "searchDanmu", title: "搜索", functionName: "searchDanmu", type: "danmu", params: [] },
    { id: "getDetail", title: "详情", functionName: "getDetailById", type: "danmu", params: [] },
    { id: "getComments", title: "弹幕", functionName: "getCommentsById", type: "danmu", params: [] }
  ]
};

// ==========================================
// 繁简转换核心
// ==========================================
const DICT_URL_S2T = "https://cdn.jsdelivr.net/npm/opencc-data@1.0.3/data/STCharacters.txt";
const DICT_URL_T2S = "https://cdn.jsdelivr.net/npm/opencc-data@1.0.3/data/TSCharacters.txt";
let MEM_DICT = null;

async function initDict(mode) {
  if (!mode || mode === "none") return;
  if (MEM_DICT) return;
  const key = `dict_${mode}`;
  let local = await Widget.storage.get(key);
  if (!local) {
      try {
          const res = await Widget.http.get(mode === "s2t" ? DICT_URL_S2T : DICT_URL_T2S);
          let text = res.data || res;
          if (typeof text === "string" && text.length > 100) {
              const map = {};
              text.split("\n").forEach(l => {
                  const p = l.split(/\s+/);
                  if (p.length >= 2) map[p[0]] = p[1];
              });
              await Widget.storage.set(key, JSON.stringify(map));
              MEM_DICT = map;
          }
      } catch(e) {}
  } else {
      try { MEM_DICT = JSON.parse(local); } catch(e) {}
  }
}

function convertText(text) {
  if (!text || !MEM_DICT) return text;
  return text.split("").map(c => MEM_DICT[c] || c).join("");
}

// ==========================================
// 工具函数
// ==========================================
const SOURCE_KEY = "dm_source_map";
const HEADERS = { "Content-Type": "application/json", "User-Agent": "ForwardWidgets/1.0.0" };

async function getSource(id) {
  try {
      let map = await Widget.storage.get(SOURCE_KEY);
      return map ? JSON.parse(map)[id] : null;
  } catch(e){ return null; }
}

function timeoutPromise(promise, ms=5000) {
  return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject("timeout"), ms))
  ]);
}

// ==========================================
// 搜索弹幕
// ==========================================
async function searchDanmu(params) {
  const { title, season, searchBlockKeywords } = params;
  const queryTitle = title.trim();
  const servers = [params.server, params.server2, params.server3]
      .filter(Boolean)
      .map(s => s.trim().replace(/\/$/, ""))
      .filter(s => /^https?:\/\//.test(s));
  if (!servers.length) return { animes: [] };

  let finalAnimes = [], mapEntries = {}, seenIds = new Set(), seenTitles = new Set();

  const tasks = servers.map(server => timeoutPromise(
      Widget.http.get(`${server}/api/v2/search/anime?keyword=${encodeURIComponent(queryTitle)}`, { headers: HEADERS })
      .then(res => {
          const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
          if (data?.success && data.animes) return { server, animes: data.animes };
          return null;
      })
  , 5000));

  const results = await Promise.allSettled(tasks);
  for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
          for (const a of r.value.animes) {
              if (!seenIds.has(a.animeId) && !seenTitles.has(a.animeTitle)) {
                  seenIds.add(a.animeId);
                  seenTitles.add(a.animeTitle);
                  finalAnimes.push(a);
                  mapEntries[a.animeId] = r.value.server;
              }
          }
      }
  }

  // 保存来源映射
  try {
      let mapStr = await Widget.storage.get(SOURCE_KEY);
      let map = mapStr ? JSON.parse(mapStr) : {};
      Object.assign(map, mapEntries);
      await Widget.storage.set(SOURCE_KEY, JSON.stringify(map));
  } catch(e){}

  // 屏蔽词过滤
  if (searchBlockKeywords) {
      const blockedList = searchBlockKeywords.split(/[,，]/).map(k => k.trim()).filter(k=>k);
      if (blockedList.length) {
          const reg = new RegExp(blockedList.join("|"), "i");
          finalAnimes = finalAnimes.filter(a => !reg.test(a.animeTitle));
      }
  }

  // 排序逻辑
  if (finalAnimes.length > 0) {
      let matched = [], unmatched = [];
      finalAnimes.forEach(a => matchSeason(a, queryTitle, season) ? matched.push(a) : unmatched.push(a));
      finalAnimes = [...matched, ...unmatched];
  }

  return { animes: finalAnimes };
}

// ==========================================
// 匹配季数
// ==========================================
function matchSeason(anime, queryTitle, season) {
  if (!anime?.animeTitle) return false;
  const title = anime.animeTitle.split("(")[0].trim();
  if (!title.startsWith(queryTitle)) return false;
  const afterTitle = title.substring(queryTitle.length).trim();
  if (afterTitle === '' && season?.toString() === "1") return true;

  const seasonIndex = afterTitle.match(/\d+/);
  if (seasonIndex && seasonIndex[0] === season?.toString()) return true;

  const chineseNumber = afterTitle.match(/[一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾]+/);
  if (chineseNumber && convertChineseNumber(chineseNumber[0]) === Number(season)) return true;

  return false;
}

function convertChineseNumber(cn) {
  if (/^\d+$/.test(cn)) return Number(cn);
  const digits = { '零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'壹':1,'貳':2,'參':3,'肆':4,'伍':5,'陸':6,'柒':7,'捌':8,'玖':9 };
  const units = { '十':10,'拾':10,'百':100,'佰':100,'千':1000,'仟':1000 };
  let res=0, cur=0, lastUnit=1;
  for (let c of cn) {
      if(digits[c]!==undefined) cur=digits[c];
      else if(units[c]!==undefined){
          const u=units[c];
          if(cur===0) cur=1;
          if(u>=lastUnit) res=cur*u; else res+=cur*u;
          lastUnit=u; cur=0;
      }
  }
  if(cur>0) res+=cur;
  return res;
}

// ==========================================
// 获取详情
// ==========================================
async function getDetailById(params) {
  const { animeId } = params;
  const server = await getSource(animeId) || params.server;
  try {
      const res = await Widget.http.get(`${server}/api/v2/bangumi/${animeId}`, { headers: HEADERS });
      const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      if (data?.bangumi?.episodes) {
          let mapStr = await Widget.storage.get(SOURCE_KEY);
          let map = mapStr ? JSON.parse(mapStr) : {};
          for(const ep of data.bangumi.episodes) map[ep.episodeId] = server;
          await Widget.storage.set(SOURCE_KEY, JSON.stringify(map));
          return data.bangumi.episodes;
      }
  } catch(e){}
  return [];
}

// ==========================================
// 获取弹幕（顶部固定弹幕）
// ==========================================
async function getCommentsById(params) {
  const { commentId, convertMode, blockKeywords, colorMode, maxCount } = params;
  if(!commentId) return null;

  await initDict(convertMode);
  const server = await getSource(commentId) || params.server;

  try {
      const res = await Widget.http.get(`${server}/api/v2/comment/${commentId}?withRelated=true&chConvert=0`, { headers: HEADERS });
      const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      let list = data.comments || [];

      const blockedList = blockKeywords?.split(/[,，]/).map(k=>k.trim()).filter(k=>k) || [];
      const blockReg = blockedList.length ? new RegExp(blockedList.join("|"), "i") : null;

      if(list.length){
          if(convertMode!=="none" && MEM_DICT){
              list.forEach(c=>{ if(c.m) c.m=convertText(c.m); if(c.message) c.message=convertText(c.message); });
          }

          if(blockReg){
              list = list.filter(c => !blockReg.test(c.m || c.message || ""));
          }

          let limit = parseInt(maxCount);
          if(!isNaN(limit) && limit>0 && list.length>limit){
              list = list.sort(()=>Math.random()-0.5).slice(0, limit)
                         .sort((a,b)=>(parseFloat(a.p?.split(",")[0]||0))-(parseFloat(b.p?.split(",")[0]||0)));
          }

          const COLORS=[16711680,16776960,16752384,16738740,13445375,11730943,11730790];
          const COLOR_WHITE="16777215";
          list.forEach(c=>{
              if(!c.p) return;
              let parts=c.p.split(",");
              if(parts.length<3) return;
              let colorIndex = parts.length>=8?3:2;
              let targetColor = COLOR_WHITE;
              if(colorMode==="white") targetColor = COLOR_WHITE;
              else if(colorMode==="partial") targetColor = Math.random()<0.5?COLORS[(Math.random()*COLORS.length)|0].toString():COLOR_WHITE;
              else if(colorMode==="all") targetColor = COLORS[(Math.random()*COLORS.length)|0].toString();
              parts[colorIndex] = targetColor;
              c.p = parts.join(",");
          });

          // ⚡ 顶部固定弹幕标记
          list.forEach(c => { c.position = "top-fixed"; });
      }

      data.comments = list;
      return data;

  } catch(e){ return null; }
}