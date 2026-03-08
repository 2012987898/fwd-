WidgetMetadata = {
  id: "danmu_api_ultimate_v4_6",
  title: "终极并发弹幕 v4.6",
  version: "4.6.0",
  requiredVersion: "0.0.2",
  description: "多API并发 + AI高能弹幕 + 延迟校准 + 智能轨道调度 + 居中弹幕密度控制",
  author: "AI Ultimate",

  globalParams: [
    { name:"server",title:"源1(必填)",type:"input",value:"" },
    { name:"server2",title:"源2",type:"input" },
    { name:"server3",title:"源3",type:"input" },
    { name:"maxCount",title:"📊弹幕数量上限",type:"input",value:"3000" },
    {
      name:"convertMode",
      title:"🔠繁简转换",
      type:"enumeration",
      value:"none",
      enumOptions:[
        {title:"保持原样",value:"none"},
        {title:"转简体",value:"t2s"},
        {title:"转繁体",value:"s2t"}
      ]
    },
    {
      name:"colorMode",
      title:"🎨弹幕颜色",
      type:"enumeration",
      value:"none",
      enumOptions:[
        {title:"保持原样",value:"none"},
        {title:"全部纯白",value:"white"},
        {title:"部分彩色",value:"partial"},
        {title:"完全彩色",value:"all"}
      ]
    },
    { name:"blockKeywords",title:"🚫弹幕屏蔽词",type:"input",value:"" }
  ],

  modules:[
    { id:"searchDanmu",title:"搜索",functionName:"searchDanmu",type:"danmu" },
    { id:"getDetail",title:"详情",functionName:"getDetailById",type:"danmu" },
    { id:"getComments",title:"弹幕",functionName:"getCommentsById",type:"danmu" }
  ]
}

// =======================
// 来源记录
// =======================
const SOURCE_KEY="dm_source_map"
async function getSource(id){
  try{
    let map=await Widget.storage.get(SOURCE_KEY)
    return map?JSON.parse(map)[id]:null
  }catch(e){return null}
}

// =======================
// AI配置
// =======================
const AI_CONFIG={
  highEnergyChance:0.15,
  centerMode:"5",
  bigFont:"36",
  colors:["16711680","16776960","16744192","13445375"],
  words:["卧槽","牛逼","神回","泪目","高能","封神","名场面","绝了","燃爆","神作"],
  spam:["加微信","VX","福利","资源","看片","广告","代理"]
}

// =======================
// AI弹幕
// =======================
function processAI(list){
  return list.filter(c=>{
    let msg=(c.m||c.message||"").trim()
    if(!msg) return false
    for(let s of AI_CONFIG.spam) if(msg.includes(s)) return false
    if(!c.p) return true
    let p=c.p.split(',')
    for(let w of AI_CONFIG.words){
      if(msg.includes(w)&&Math.random()<AI_CONFIG.highEnergyChance){
        p[1]=AI_CONFIG.centerMode
        p[2]=AI_CONFIG.bigFont
        p[3]=AI_CONFIG.colors[Math.floor(Math.random()*AI_CONFIG.colors.length)]
        c.p=p.join(',')
        break
      }
    }
    return true
  })
}

// =======================
// 名场面增强
// =======================
function boostClimax(list){
  let map={}
  list.forEach(c=>{
    if(!c.p) return
    let t=Math.floor(parseFloat(c.p.split(',')[0])||0)
    map[t]=(map[t]||0)+1
  })
  list.forEach(c=>{
    if(!c.p) return
    let p=c.p.split(',')
    let t=Math.floor(parseFloat(p[0])||0)
    if(map[t]>8){
      p[1]="5"
      p[2]="38"
      c.p=p.join(',')
    }
  })
}

// =======================
// 弹幕延迟校准
// =======================
function autoSyncDanmu(list){
  if(!list||list.length<50) return list
  let buckets={}
  list.forEach(c=>{
    if(!c.p) return
    let t=parseFloat(c.p.split(',')[0])
    if(isNaN(t)) return
    let key=Math.round(t)
    buckets[key]=(buckets[key]||0)+1
  })
  let max=0, peak=0
  for(let k in buckets){
    if(buckets[k]>max){ max=buckets[k]; peak=parseInt(k) }
  }
  let offset=0
  if(peak<5) offset=2
  if(peak>20) offset=-2
  if(offset!==0){
    list.forEach(c=>{
      if(!c.p) return
      let p=c.p.split(',')
      let t=parseFloat(p[0])+offset
      if(t<0) t=0
      p[0]=t.toFixed(2)
      c.p=p.join(',')
    })
  }
  return list
}

// =======================
// 居中弹幕队列
// =======================
let centerQueue = []
let centerShowing = false
const CENTER_DURATION = 3   // 居中弹幕停留时间
const CENTER_INTERVAL = 2   // 居中弹幕最小间隔（控制密度）
let lastCenterTime = 0      // 上一条居中弹幕显示时间

function scheduleCenterDanmu(list){
  const newCenter = []
  list.forEach(c=>{
    if(!c.p) return
    let p=c.p.split(',')
    if(p[1]==="4"||p[1]==="5") newCenter.push(c)
  })
  // 控制密度，加入队列
  newCenter.forEach(c=>centerQueue.push(c))
  return list.filter(c=>{
    let p=c.p.split(',')
    return !(p[1]==="4"||p[1]==="5")
  })
}

async function showNextCenterDanmu(){
  if(centerQueue.length===0) return
  const now = Date.now()/1000
  if(now - lastCenterTime < CENTER_INTERVAL){
    await sleep((CENTER_INTERVAL - (now - lastCenterTime))*1000)
  }
  const c = centerQueue.shift()
  lastCenterTime = Date.now()/1000
  displayDanmu(c) // 渲染函数
  await sleep(CENTER_DURATION*1000)
  showNextCenterDanmu()
}

function sleep(ms){ return new Promise(res=>setTimeout(res, ms)) }

// =======================
// 滚动弹幕轨道调度
// =======================
function scheduleScrollDanmu(list){
  const scrollTracks = 10
  let scrollTimes = Array(scrollTracks).fill(0)
  list.forEach(c=>{
    if(!c.p) return
    let p = c.p.split(',')
    let mode = p[1]
    if(mode!=="4" && mode!=="5"){
      let minTrack = scrollTimes.indexOf(Math.min(...scrollTimes))
      let t = parseFloat(p[0])||0
      t = Math.max(t, scrollTimes[minTrack])
      scrollTimes[minTrack] = t
      p[0] = t.toFixed(2)
      if(p.length<8) p.push(minTrack)
      else p[7]=minTrack
      c.p = p.join(',')
    }
  })
  return list
}

// =======================
// 搜索
// =======================
async function searchDanmu(params){
  const {title}=params
  const servers=[params.server,params.server2,params.server3].filter(s=>s&&s.startsWith("http")).map(s=>s.replace(/\/$/,''))
  let animes=[], mapEntries={}, seen=new Set()
  const tasks=servers.map(async server=>{
    try{
      const res=await Widget.http.get(`${server}/api/v2/search/anime?keyword=${encodeURIComponent(title)}`)
      const data=typeof res.data==="string"?JSON.parse(res.data):res.data
      if(data?.animes){
        for(const a of data.animes){
          if(!seen.has(a.animeId)){
            seen.add(a.animeId)
            animes.push(a)
            mapEntries[a.animeId]=server
          }
        }
      }
    }catch(e){}
  })
  await Promise.all(tasks)
  try{
    let mapStr=await Widget.storage.get(SOURCE_KEY)
    let map=mapStr?JSON.parse(mapStr):{}
    Object.assign(map,mapEntries)
    await Widget.storage.set(SOURCE_KEY,JSON.stringify(map))
  }catch(e){}
  return {animes}
}

// =======================
// 详情
// =======================
async function getDetailById(params){
  const {animeId}=params
  let server=(await getSource(animeId))||params.server
  try{
    const res=await Widget.http.get(`${server}/api/v2/bangumi/${animeId}`)
    const data=typeof res.data==="string"?JSON.parse(res.data):res.data
    if(data?.bangumi?.episodes){
      let mapStr=await Widget.storage.get(SOURCE_KEY)
      let map=mapStr?JSON.parse(mapStr):{}
      for(const ep of data.bangumi.episodes) map[ep.episodeId]=server
      await Widget.storage.set(SOURCE_KEY,JSON.stringify(map))
      return data.bangumi.episodes
    }
  }catch(e){}
  return []
}

// =======================
// 获取弹幕
// =======================
async function getCommentsById(params){
  const {commentId,colorMode,maxCount,blockKeywords}=params
  if(!commentId) return null
  let server=(await getSource(commentId))||params.server
  try{
    const res=await Widget.http.get(`${server}/api/v2/comment/${commentId}?withRelated=true`)
    const data=typeof res.data==="string"?JSON.parse(res.data):res.data
    let list=data.comments||[]

    list=autoSyncDanmu(list)

    if(blockKeywords){
      const blocked=blockKeywords.split(',').map(s=>s.trim())
      list=list.filter(c=>{
        let msg=c.m||""
        for(let k of blocked) if(msg.includes(k)) return false
        return true
      })
    }

    list=processAI(list)
    boostClimax(list)
    list=scheduleCenterDanmu(list)
    list=scheduleScrollDanmu(list)

    if(colorMode&&colorMode!=="none"){
      const COLORS=["16711680","16776960","16744192","13445375"]
      const WHITE="16777215"
      list.forEach(c=>{
        if(!c.p) return
        let p=c.p.split(',')
        if(colorMode==="white") p[3]=WHITE
        else if(colorMode==="partial") p[3]=Math.random()<0.5?COLORS[Math.floor(Math.random()*COLORS.length)]:WHITE
        else if(colorMode==="all") p[3]=COLORS[Math.floor(Math.random()*COLORS.length)]
        c.p=p.join(',')
      })
    }

    let limit=parseInt(maxCount)||3000
    if(list.length>limit) list=list.sort(()=>Math.random()-0.5).slice(0,limit)

    data.comments=list
    return data
  }catch(e){return null}
}