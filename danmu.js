WidgetMetadata = {
  id: "danmu_api_Max_binfa",
  title: "并发弹幕",
  version: "1.3.0",
  requiredVersion: "0.0.2",
  site: "https://t.me/MakkaPakkaOvO",
  description: "并发搜索多api、繁简互转、数量限制、关键词屏蔽、颜色重写（修复顶部弹幕）",
  author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",

  globalParams: [
      { name: "server", title: "源1 (必填)", type: "input", value: "" },
      { name: "server2", title: "源2", type: "input" },
      { name: "server3", title: "源3", type: "input" },

      { 
          name: "maxCount",
          title: "📊 弹幕数量上限",
          type: "input",
          value: "3000"
      },

      { 
          name: "convertMode",
          title: "🔠 弹幕转换",
          type: "enumeration",
          value: "none",
          enumOptions: [
              { title: "保持原样", value: "none" },
              { title: "转简体", value: "t2s" },
              { title: "转繁体", value: "s2t" }
          ]
      },

      { 
          name: "colorMode",
          title: "🎨 弹幕颜色",
          type: "enumeration",
          value: "none",
          enumOptions: [
              { title: "保持原样", value: "none" },
              { title: "全部白色", value: "white" },
              { title: "部分彩色", value: "partial" },
              { title: "完全彩色", value: "all" }
          ]
      },

      { 
          name: "blockKeywords",
          title: "🚫 弹幕屏蔽词",
          type: "input",
          value: ""
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
      let map=await Widget.storage.get(SOURCE_KEY);
      return map?JSON.parse(map)[id]:null;
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

  const tasks=servers.map(async(server)=>{

      try{

          const res=await Widget.http.get(
              `${server}/api/v2/search/anime?keyword=${params.title}`
          );

          let data=typeof res.data==="string"?JSON.parse(res.data):res.data;

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

  let mapStr=await Widget.storage.get(SOURCE_KEY);
  let map=mapStr?JSON.parse(mapStr):{};
  Object.assign(map,mapEntries);
  await Widget.storage.set(SOURCE_KEY,JSON.stringify(map));

  return{animes:final};

}

async function getDetailById(params){

  const server=(await getSource(params.animeId))||params.server;

  try{

      const res=await Widget.http.get(
          `${server}/api/v2/bangumi/${params.animeId}`
      );

      let data=typeof res.data==="string"?JSON.parse(res.data):res.data;

      if(data?.bangumi?.episodes){

          let mapStr=await Widget.storage.get(SOURCE_KEY);
          let map=mapStr?JSON.parse(mapStr):{};

          data.bangumi.episodes.forEach(ep=>{
              map[ep.episodeId]=server;
          });

          await Widget.storage.set(SOURCE_KEY,JSON.stringify(map));

          return data.bangumi.episodes;

      }

  }catch(e){}

  return[];

}

async function getCommentsById(params){

  const {commentId,maxCount,colorMode,blockKeywords}=params;

  if(!commentId)return null;

  const server=(await getSource(commentId))||params.server;

  try{

      const res=await Widget.http.get(
          `${server}/api/v2/comment/${commentId}`
      );

      let data=typeof res.data==="string"?JSON.parse(res.data):res.data;

      let list=data.comments||[];

      const blocked=blockKeywords
      ?blockKeywords.split(/[,，]/).map(k=>k.trim())
      :[];

      list=list.filter(c=>{

          const msg=c.m||c.message||"";

          return !blocked.some(k=>msg.includes(k));

      });

      list=list.map(c=>{

          if(!c.p)return c;

          let parts=c.p.split(",");

          // 修复 p
          if(parts.length===3){

              parts.splice(2,0,"25");

          }

          if(parts.length<4)return null;

          c.p=parts.join(",");

          return c;

      }).filter(Boolean);

      if(colorMode!=="none"){

          const COLORS=[16711680,16776960,65280,65535,255,16711935];

          list.forEach(c=>{

              let parts=c.p.split(",");

              if(parts.length<4)return;

              let color="16777215";

              if(colorMode==="white"){

                  color="16777215";

              }else if(colorMode==="partial"){

                  color=Math.random()<0.5
                  ?COLORS[Math.floor(Math.random()*COLORS.length)].toString()
                  :"16777215";

              }else if(colorMode==="all"){

                  color=COLORS[Math.floor(Math.random()*COLORS.length)].toString();

              }

              parts[3]=color;

              c.p=parts.join(",");

          });

      }

      let limit=parseInt(maxCount);

      if(limit>0&&list.length>limit){

          for(let i=list.length-1;i>0;i--){

              const j=Math.floor(Math.random()*(i+1));

              [list[i],list[j]]=[list[j],list[i]];

          }

          list=list.slice(0,limit);

      }

      data.comments=list;

      return data;

  }catch(e){

      return null;

  }

}