WidgetMetadata = {
  id: "danmu_api_top_only",
  title: "弹幕终极版(仅顶部)",
  version: "3.0.0",
  requiredVersion: "0.0.2",
  description: "多源弹幕 + 顶部弹幕 + 密度控制",
  author: "Enhanced",

  globalParams: [

    { name: "server", title: "弹幕源1", type: "input" },
    { name: "server2", title: "弹幕源2", type: "input" },
    { name: "server3", title: "弹幕源3", type: "input" },

    {
      name: "topRate",
      title: "顶部弹幕比例(%)",
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
      name: "maxCount",
      title: "弹幕数量上限",
      type: "input",
      value: "3000"
    },

    {
      name: "blockKeywords",
      title: "屏蔽词",
      type: "input",
      value: ""
    },

    {
      name: "colorMode",
      title: "弹幕颜色",
      type: "enumeration",
      value: "none",
      enumOptions: [
        { title: "保持原样", value: "none" },
        { title: "纯白", value: "white" },
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

async function getSource(id){
  try{
    let map = await Widget.storage.get(SOURCE_KEY);
    return map ? JSON.parse(map)[id] : null;
  }catch(e){return null;}
}

async function searchDanmu(params){

  const servers=[params.server,params.server2,params.server3]
  .filter(s=>s&&s.startsWith("http"))
  .map(s=>s.replace(/\/$/,""));

  if(!servers.length)return{animes:[]};

  let final=[];
  let mapEntries={};
  let seen=new Set();

  const tasks=servers.map(async server=>{
    try{
      const res=await Widget.http.get(`${server}/api/v2/search/anime?keyword=${params.title}`);
      const data=typeof res.data==="string"?JSON.parse(res.data):res.data;

      if(data?.animes){
        return{server,animes:data.animes};
      }
    }catch(e){}
    return null;
  });

  const results=await Promise.all(tasks);

  for(const r of results){
    if(!r)continue;

    for(const a of r.animes){
      if(!seen.has(a.animeId)){
        seen.add(a.animeId);
        final.push(a);
        mapEntries[a.animeId]=r.server;
      }
    }
  }

  try{
    let mapStr=await Widget.storage.get(SOURCE_KEY);
    let map=mapStr?JSON.parse(mapStr):{};
    Object.assign(map,mapEntries);
    await Widget.storage.set(SOURCE_KEY,JSON.stringify(map));
  }catch(e){}

  return{animes:final};
}

async function getDetailById(params){

  const{animeId}=params;
  let server=(await getSource(animeId))||params.server;

  try{
    const res=await Widget.http.get(`${server}/api/v2/bangumi/${animeId}`);
    const data=typeof res.data==="string"?JSON.parse(res.data):res.data;

    if(data?.bangumi?.episodes){

      let mapStr=await Widget.storage.get(SOURCE_KEY);
      let map=mapStr?JSON.parse(mapStr):{};

      for(const ep of data.bangumi.episodes){
        map[ep.episodeId]=server;
      }

      await Widget.storage.set(SOURCE_KEY,JSON.stringify(map));

      return data.bangumi.episodes;
    }

  }catch(e){}

  return[];
}

async function getCommentsById(params){

  const{commentId,blockKeywords,colorMode,maxCount,topRate,density}=params;

  if(!commentId)return null;

  let server=(await getSource(commentId))||params.server;

  try{

    const res=await Widget.http.get(`${server}/api/v2/comment/${commentId}`);
    const data=typeof res.data==="string"?JSON.parse(res.data):res.data;

    let list=data.comments||[];

    const blocked=blockKeywords
    ?blockKeywords.split(/[,，]/).map(k=>k.trim()).filter(Boolean)
    :[];

    if(blocked.length){
      list=list.filter(c=>{
        const msg=c.m||c.message||"";
        for(const k of blocked){
          if(msg.includes(k))return false;
        }
        return true;
      });
    }

    let densityRate=parseInt(density);

    if(!isNaN(densityRate)&&densityRate<100){
      list=list.filter(()=>Math.random()<densityRate/100);
    }

    let limit=parseInt(maxCount);

    if(!isNaN(limit)&&limit>0&&list.length>limit){
      list=list.slice(0,limit);
    }

    const highlight=[
      "卧槽","来了","名场面","前方高能","哈哈哈","泪目"
    ];

    let rate=parseInt(topRate);

    let offset=0;

    list.forEach(c=>{

      if(!c.p)return;

      let parts=c.p.split(",");

      if(parts.length<2)return;

      const text=c.m||"";

      let makeTop=false;

      if(highlight.some(w=>text.includes(w))){
        makeTop=true;
      }

      if(!makeTop&&!isNaN(rate)&&Math.random()<rate/100){
        makeTop=true;
      }

      if(makeTop){

        parts[1]="4";

        let t=parseFloat(parts[0])||0;
        t+=offset;

        parts[0]=t.toFixed(2);

        offset+=0.01;

      }

      c.p=parts.join(",");

    });

    if(colorMode!=="none"){

      const COLORS=[16711680,16776960,65280,65535,16711935];

      list.forEach(c=>{

        if(!c.p)return;

        let parts=c.p.split(",");

        if(parts.length<4)return;

        if(colorMode==="white"){
          parts[3]="16777215";
        }

        if(colorMode==="all"){
          parts[3]=COLORS[Math.floor(Math.random()*COLORS.length)];
        }

        c.p=parts.join(",");

      });

    }

    data.comments=list;

    return data;

  }catch(e){
    return null;
  }
}