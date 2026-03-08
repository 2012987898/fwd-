WidgetMetadata = {
  id: "danmu_api_top_binfa",
  title: "顶部并发弹幕",
  version: "2.0.0",

  modules: [
    {
      id: "danmu",
      type: "danmu",
      title: "弹幕模块",
      functionName: "getDanmu",
      description: "顶部并发弹幕系统",
      params: []
    }
  ]
}

const MAX_DANMU_PER_SECOND = 3

function randomColor() {
  const colors = [
    "#ffffff",
    "#ff4d4f",
    "#40a9ff",
    "#73d13d",
    "#faad14",
    "#b37feb"
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

function generateDanmu(start, end) {

  let danmus = []

  for (let t = start; t < end; t++) {

    let count = Math.floor(Math.random() * MAX_DANMU_PER_SECOND)

    for (let i = 0; i < count; i++) {

      danmus.push({
        time: t + Math.random(),
        text: randomText(),
        mode: "top",
        color: randomColor()
      })

    }

  }

  return danmus
}

function randomText() {

  const texts = [
    "哈哈哈哈",
    "笑死",
    "前方高能",
    "卧槽",
    "名场面",
    "来了来了",
    "太强了",
    "牛逼",
    "顶",
    "泪目",
    "经典",
    "DNA动了",
    "绷不住了"
  ]

  return texts[Math.floor(Math.random() * texts.length)]

}

async function getDanmu(params) {

  let start = 0
  let end = 300

  if (params && params.start) start = Number(params.start)
  if (params && params.end) end = Number(params.end)

  const danmu = generateDanmu(start, end)

  return danmu

}