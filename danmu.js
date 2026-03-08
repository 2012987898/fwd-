WidgetMetadata = {
  id: "danmu_api_enhanced",
  title: "弹幕增强版",
  version: "2.0.0",
  requiredVersion: "0.0.2",
  site: "https://t.me/MakkaPakkaOvO",
  description: "并发搜索、多源弹幕、高潮弹幕固定、密度控制、颜色增强",
  author: "Enhanced",

  globalParams: [
    { name: "server", title: "源1", type: "input" },
    { name: "server2", title: "源2", type: "input" },
    { name: "server3", title: "源3", type: "input" },

    {
      name: "maxCount",
      title: "弹幕数量上限",
      type: "input",
      value: "3000"
    },

    {
      name: "topRate",
      title: "固定弹幕比例(%)",
      type: "input",
      value: "5"
    },

    {
      name: "density",
      title: "弹幕密度(%)",
      type: "input",
      value: "100"
    },

    {
      name: "blockKeywords",
      title: "弹幕屏蔽词",
      type: "input",
      value: ""
    },

    {
      name: "colorMode",
      title: "弹幕颜色模式",
      type: "enumeration",
      value: "none",
      enumOptions: [
        { title: "保持原样", value: "none" },
        { title: "白色", value: "white" },
        { title: "随机彩色", value: "all" }
      ]
    }
  ],

  modules: [
    { id: "searchDanmu", title: "搜索", functionName: "searchDanmu", type: "danmu", params: [] },
    { id: "getDetail", title: "详情", functionName: "getDetailById", type: "danmu", params: [] },
    { id: "getComments", title: "弹幕", functionName: "getCommentsById", type: "danmu", params: [] }
  ]
};

const SOURCE_KEY = "dm_source_map";

async function getSource(id) {
  try {
    let map = await Widget.storage.get(SOURCE_KEY);
    return map ? JSON.parse(map)[id] : null;
  } catch(e) {
    return null;
  }
}

async function searchDanmu(params) {

  const servers = [params.server, params.server2, params.server3]
    .filter(s => s && s.startsWith("http"))
    .map(s => s.replace(/\/$/, ""));

  if (!servers.length) return { animes: [] };

  let finalAnimes = [];
  let mapEntries = {};
  let seen = new Set();

  const tasks = servers.map(async server => {

    try {

      const res = await Widget.http.get(`${server}/api/v2/search/anime?keyword=${params.title}`);
      const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;

      if (data?.animes) {
        return { server, animes: data.animes };
      }

    } catch(e) {}

    return null;

  });

  const results = await Promise.all(tasks);

  for (const r of results) {

    if (!r) continue;

    for (const a of r.animes) {

      if (!seen.has(a.animeId)) {

        seen.add(a.animeId);
        finalAnimes.push(a);
        mapEntries[a.animeId] = r.server;

      }

    }

  }

  try {

    let mapStr = await Widget.storage.get(SOURCE_KEY);
    let map = mapStr ? JSON.parse(mapStr) : {};

    Object.assign(map, mapEntries);

    await Widget.storage.set(SOURCE_KEY, JSON.stringify(map));

  } catch(e) {}

  return { animes: finalAnimes };

}

async function getDetailById(params) {

  const { animeId } = params;
  let server = (await getSource(animeId)) || params.server;

  try {

    const res = await Widget.http.get(`${server}/api/v2/bangumi/${animeId}`);
    const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;

    if (data?.bangumi?.episodes) {

      let mapStr = await Widget.storage.get(SOURCE_KEY);
      let map = mapStr ? JSON.parse(mapStr) : {};

      for (const ep of data.bangumi.episodes) {
        map[ep.episodeId] = server;
      }

      await Widget.storage.set(SOURCE_KEY, JSON.stringify(map));

      return data.bangumi.episodes;

    }

  } catch(e) {}

  return [];

}

async function getCommentsById(params) {

  const { commentId, blockKeywords, colorMode, maxCount, topRate, density } = params;

  if (!commentId) return null;

  let server = (await getSource(commentId)) || params.server;

  try {

    const res = await Widget.http.get(`${server}/api/v2/comment/${commentId}`);
    const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;

    let list = data.comments || [];

    const blocked = blockKeywords
      ? blockKeywords.split(/[,，]/).map(k => k.trim()).filter(Boolean)
      : [];

    if (blocked.length) {

      list = list.filter(c => {

        const msg = c.m || c.message || "";

        for (const k of blocked) {
          if (msg.includes(k)) return false;
        }

        return true;

      });

    }

    let densityRate = parseInt(density);

    if (!isNaN(densityRate) && densityRate < 100) {

      list = list.filter(() => Math.random() < densityRate / 100);

    }

    let limit = parseInt(maxCount);

    if (!isNaN(limit) && limit > 0 && list.length > limit) {

      list = list.slice(0, limit);

    }

    const highlightWords = [
      "卧槽","来了","名场面","前方高能","泪目","哈哈哈"
    ];

    let fixedRate = parseInt(topRate);

    list.forEach(c => {

      if (!c.p) return;

      let parts = c.p.split(",");

      if (parts.length < 2) return;

      const text = c.m || "";

      if (highlightWords.some(w => text.includes(w))) {

        parts[1] = "4";
        c.p = parts.join(",");
        return;

      }

      if (!isNaN(fixedRate) && parts[1] === "1" && Math.random() < fixedRate/100) {

        parts[1] = "4";
        c.p = parts.join(",");

      }

    });

    if (colorMode !== "none") {

      const COLORS = [16711680,16776960,65280,65535,16711935];

      list.forEach(c => {

        if (!c.p) return;

        let parts = c.p.split(",");

        if (parts.length < 4) return;

        if (colorMode === "white") {
          parts[3] = "16777215";
        }

        if (colorMode === "all") {
          parts[3] = COLORS[Math.floor(Math.random()*COLORS.length)];
        }

        c.p = parts.join(",");

      });

    }

    data.comments = list;

    return data;

  } catch(e) {

    return null;

  }

}