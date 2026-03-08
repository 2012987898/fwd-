WidgetMetadata = {
  id: "danmu_api_top_opt",
  title: "弹幕增强(顶部优化)",
  version: "3.1.0",
  requiredVersion: "0.0.2",
  description: "Forward弹幕优化版，顶部弹幕优先",
  author: "rewrite",

  globalParams: [
    { name: "server", title: "弹幕源1", type: "input" },
    { name: "server2", title: "弹幕源2", type: "input" },
    { name: "server3", title: "弹幕源3", type: "input" },

    {
      name: "topRate",
      title: "顶部弹幕比例%",
      type: "input",
      value: "10"
    },

    {
      name: "maxCount",
      title: "最大弹幕数",
      type: "input",
      value: "2000"
    },

    {
      name: "density",
      title: "弹幕密度%",
      type: "input",
      value: "80"
    }
  ],

  modules: [
    { id:"searchDanmu",functionName:"searchDanmu",type:"danmu"},
    { id:"getDetail",functionName:"getDetailById",type:"danmu"},
    { id:"getComments",functionName:"getCommentsById",type:"danmu"}
  ]
}

const SOURCE_KEY="dm_source_map"

async function getSource(id){
  try{
    let m=await Widget.storage.get(SOURCE_KEY)
    return m?JSON.parse(m)[id]:null
  }catch(e){return null}
}

async function searchDanmu(params){

  const servers=[params.server,params.server2,params.server3]
  .filter(s=>s&&s.startsWith("http"))

  if(!servers.length)return{animes:[]}

  let final=[]
  let map={}
  let seen=new Set()

  const tasks=servers.map(async s=>{
    try{
      const r=await Widget.http.get(`${s}/api/v2/search/anime?keyword=${params.title}`)
      const d=typeof r.data==="string"?JSON.parse(r.data):r.data
      if(d?.animes)return{server:s,animes:d.animes}
    }catch(e){}
    return null
  })

  const res=await Promise.all(tasks)

  for(const r of res){
    if(!r)continue
    for(const a of r.animes){
      if(!seen.has(a.animeId)){
        seen.add(a.animeId)
        final.push(a)
        map[a.animeId]=r.server
      }
    }
  }

  try{
    let m=await Widget.storage.get(SOURCE_KEY)
    let obj=m?JSON.parse(m):{}
    Object.assign(obj,map)
    await Widget.storage.set(SOURCE_KEY,JSON.stringify(obj))
  }catch(e){}

  return{animes:final}
}

async function getDetailById(params){

  const {animeId}=params
  let server=(await getSource(animeId))||params.server

  try{
    const r=await Widget.http.get(`${server}/api/v2/bangumi/${animeId}`)
    const d=typeof r.data==="string"?JSON.parse(r.data):r.data

    if(d?.bangumi?.episodes){

      let m=await Widget.storage.get(SOURCE_KEY)
      let map=m?JSON.parse(m):{}

      for(const ep of d.bangumi.episodes){
        map[ep.episodeId]=server
      }

      await Widget.storage.set(SOURCE_KEY,JSON.stringify(map))
      return d.bangumi.episodes
    }

  }catch(e){}

  return[]
}

async function getCommentsById(params){

  const {commentId,topRate,maxCount,density}=params

  if(!commentId)return null

  let server=(await getSource(commentId))||params.server

  try{

    const r=await Widget.http.get(`${server}/api/v2/comment/${commentId}`)
    const d=typeof r.data==="string"?JSON.parse(r.data):r.data

    let list=d.comments||[]

    // 密度控制
    let dens=parseInt(density)
    if(!isNaN(dens)&&dens<100){
      list=list.filter(()=>Math.random()<dens/100)
    }

    // 数量限制
    let limit=parseInt(maxCount)
    if(!isNaN(limit)&&list.length>limit){
      list=list.slice(0,limit)
    }

    // 顶部弹幕算法
    let rate=parseInt(topRate)
    let offset=0

    list.forEach(c=>{

      if(!c.p)return

      let parts=c.p.split(",")

      if(parts.length<2)return

      if(parts[1]=="1" && Math.random()<rate/100){

        // 改为固定弹幕
        parts[1]="4"

        // 微调时间确保占用顶部轨道
        let t=parseFloat(parts[0])||0
        t+=offset
        parts[0]=t.toFixed(2)

        offset+=0.02
      }

      c.p=parts.join(",")
    })

    d.comments=list
    return d

  }catch(e){
    return null
  }
}