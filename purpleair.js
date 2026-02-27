// purpleair.js
// Uses the Purple Air API (api.purpleair.com/v1/sensors) with API key. Requires "sensorIndex:apiKey" in widget parameter.

// Depending on a user selection, performs one of two actions:
// 1. Compute the air quality index for the sensor id  the air quality index (AQI) for the sensor id provided in a param
// 2. Presents a UI to browse air quality information retrieved from Purple Air REST API

// Reference: https://en.wikipedia.org/wiki/Air_quality_index

// Future enchancements
// Calculation to dynamically change color based on AQI value
// Support additional pollutants other than PM2.5

// store low/high concentrations for pollutants in all categories
const PM25_BREAKPOINTS = [
  { concLow: 0,     concHigh: 12.0,  aqiLow: 0,   aqiHigh: 50,  category: 'Good',                           color: '#53d769' },
  { concLow: 12.1,  concHigh: 35.4,  aqiLow: 51,  aqiHigh: 100, category: 'Moderate',                       color: '#dddd55' },
  { concLow: 35.5,  concHigh: 55.4,  aqiLow: 101, aqiHigh: 150, category: 'Unhealthy for Sensitive Groups', color: '#ef8533' },
  { concLow: 55.5,  concHigh: 150.4, aqiLow: 151, aqiHigh: 200, category: 'Unhealthy',                      color: '#ea3324' },
  { concLow: 150.5, concHigh: 250.4, aqiLow: 201, aqiHigh: 300, category: 'Very Unhealthy',                 color: '#8c1a4b' },
  { concLow: 250.5, concHigh: 350.4, aqiLow: 301, aqiHigh: 400, category: 'Hazardous',                      color: '#731425' },
  { concLow: 350.5, concHigh: 500.4, aqiLow: 401, aqiHigh: 500, category: 'Hazardous',                      color: '#731425' }
]
const UP_ARROW = "\u2191"
const DOWN_ARROW = "\u2193"

function main() {
  // Widget parameter: "sensorIndex:apiKey" (API key from develop.purpleair.com)
  let param = args.widgetParameter || ""
  let sensorIndex = param
  let apiKey = null 
  if (param.includes(":")) {
    const parts = param.split(":")
    sensorIndex = parts[0]
    apiKey = parts.slice(1).join(":")
  }
  let searchParams = 'fields=name,pm2.5,pm2.5_10minute,pm2.5_30minute,pm2.5_60minute,pm2.5_6hour,pm2.5_24hour,pm2.5_1week'
  let req = new Request(`https://api.purpleair.com/v1/sensors/${sensorIndex}?${searchParams}`)
  req.headers = { "X-API-Key": apiKey }
  let data = req.loadJSON()

  // Current API schema: { sensor: { name, pm2.5?, stats: { pm2.5, pm2.5_10minute, ... } } }
  let sensor = data?.sensor || data
  let sensorName = sensor.name ?? sensor.label ?? `Sensor ${sensorIndex}`
  let stats = sensor.stats || {}
  let conc_PM25 = sensor["pm2.5"] ?? stats["pm2.5"] ?? 0
  let pm25Averages = getPM25AveragesByTimeRange(stats)

  if (config.runsInWidget) {
    let {aqi, category, bgColor} = calculateAQI(conc_PM25)
    let trend = pm25Averages.pm25Current > pm25Averages.pm25Avg10Min ? UP_ARROW : DOWN_ARROW
    let widget = createWidget(
      "Purple Air",
      `${Math.round(aqi)} ${trend}`,
      `Sensor ${sensorIndex}`,
      `${category}`,
      `PM2.5: ${conc_PM25}`,
      `${bgColor}`
    )
    Script.setWidget(widget)
    Script.complete()
  } else {
    table = createUITable(sensorName, pm25Averages)
    table.present()
  }
}

// Helper function to create rows in UI table when script runs
function createTableRow(fieldName, avg) {
  let row = new UITableRow()
  row.addText(fieldName)
  row.addText(avg.toString()).rightAligned()
  return row
}

// Helper function to create UI Table when script runs
function createUITable(sensorName, pm25Averages) {
  let table = new UITable()
  let tableRowHeader = new UITableRow()
  tableRowHeader.isHeader = true
  tableRowHeader.addText(`Purple Air Stats in ${sensorName}`)
  table.addRow(tableRowHeader)
  table.addRow(createTableRow("Real time or current", calculateAQI(pm25Averages.pm25Current).aqi))
  table.addRow(createTableRow("10 minute average", calculateAQI(pm25Averages.pm25Avg10Min).aqi))
  table.addRow(createTableRow("30 minute average", calculateAQI(pm25Averages.pm25Avg30Min).aqi))
  table.addRow(createTableRow("1 hour average", calculateAQI(pm25Averages.pm25Avg1Hour).aqi))
  table.addRow(createTableRow("6 hour average", calculateAQI(pm25Averages.pm25Avg6Hour).aqi))
  table.addRow(createTableRow("24 hour average", calculateAQI(pm25Averages.pm25Avg24Hour).aqi))
  table.addRow(createTableRow("One week average", calculateAQI(pm25Averages.pm25Avg1Week).aqi))
  return table
}

// Helper function to create rows in the widget interface in iOS
function createWidgetRow(widget, title, color, textOpacity, fontSize, isBold) {
  let preTxt = widget.addText(title)
  preTxt.textColor = color
  preTxt.textOpacity = textOpacity
  preTxt.font = isBold ? Font.boldSystemFont(fontSize) : Font.systemFont(fontSize)
}

// Helper function to create widget interface in iOS
function createWidget(pretitle, aqi, sensorName, cat, pm25, color) {
  let w = new ListWidget()
  w.backgroundColor = new Color(color)
  w.spacing = 0
  textColor = Color.white()
  createWidgetRow(w, pretitle, textColor, 1, 15, true)
  w.addSpacer(-5)
  createWidgetRow(w, aqi, textColor, 1, 44)
  w.addSpacer(14)
  createWidgetRow(w, sensorName, textColor, 1, 15)
  w.addSpacer(1)
  createWidgetRow(w, cat, textColor, 1, 15)
  w.addSpacer(1)
  createWidgetRow(w, pm25, textColor, 1, 15)
  return w
}

// Returns average PM2.5 stats by time range from current API schema (stats.pm2.5, stats.pm2.5_10minute, etc.).
function getPM25AveragesByTimeRange(stats) {
  if (!stats) {
    return {
      pm25Current: 0, pm25Avg10Min: 0, pm25Avg30Min: 0, pm25Avg1Hour: 0,
      pm25Avg6Hour: 0, pm25Avg24Hour: 0, pm25Avg1Week: 0
    }
  }
  return {
    pm25Current: stats["pm2.5"] ?? 0,
    pm25Avg10Min: stats["pm2.5_10minute"] ?? 0,
    pm25Avg30Min: stats["pm2.5_30minute"] ?? 0,
    pm25Avg1Hour: stats["pm2.5_60minute"] ?? 0,
    pm25Avg6Hour: stats["pm2.5_6hour"] ?? 0,
    pm25Avg24Hour: stats["pm2.5_24hour"] ?? 0,
    pm25Avg1Week: stats["pm2.5_1week"] ?? 0
  }
}

// Calculates the AQI (air quality index) for PM2.5
function calculateAQI(concentration) {
  const breakpoints = PM25_BREAKPOINTS
  let band = breakpoints[breakpoints.length - 1]

  // determine the concentration within a breakpoint
  for (const b of breakpoints) {
    if (concentration <= b.concHigh) {
      band = b
      break
    }
  }

  const {aqiLow, aqiHigh, concLow, concHigh, color, category} = band
  let aqi = Math.min(500, ((aqiHigh - aqiLow) / (concHigh - concLow)) * (concentration - concLow) + aqiLow)
  return {
    aqi : aqi.toFixed(2),
    category, 
    bgColor: color
  }
}

main()