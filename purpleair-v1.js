// purpleair-v1.js (legacy)
// Uses the legacy public JSON endpoint only (www.purpleair.com/json).
// Widget parameter: sensor index only (e.g. 123456).

// Depending on a user selection, performs one of two actions:
// 1. Compute the air quality index for the sensor id  the air quality index (AQI) for the sensor id provided in a param
// 2. Presents a UI to browse air quality information retrieved from Purple Air REST API

// Reference: https://en.wikipedia.org/wiki/Air_quality_index

// Future enchancements
// 1. Increase/Decrease indicator
// 2. Calculation to dynamically change color based on AQI value

// store low/high concentrations for pollutants in all categories
// c1 = Good
// c2 = Moderate
// c3 = Unhealthy for sensitive groups
// c4 = Unhealthy
// c5 = Very Unhealthy
// c6,c7 = Hazardous
const P = {
    'PM25': {
      'c1': [0.0, 12.0],
      'c2': [12.1, 35.4],
      'c3': [35.5, 55.4],
      'c4': [55.5, 150.4],
      'c5': [150.5, 250.4],
      'c6': [250.5, 350.4],
      'c7': [350.5, 500.4]
    }
  }

  let param = args.widgetParameter || ""  // sensor index
  let req = new Request("https://www.purpleair.com/json?" + param)
  let json = await req.loadJSON()

  if (config.runsInWidget) {
    // get current PM2.5 value from json (legacy: results[0].PM2_5Value, Stats, Label)
    let conc_PM25 = json?.results[0]['PM2_5Value']
    let stats = JSON.parse(json?.results[0]['Stats'])
    let pm25Averages = getPM25AveragesByTimeRange(stats)

    // calculates AQI
    let aqi = 0
    let cat = ""
    let bgColor = ""
    {
      [aqi, cat, bgColor] = calculateAQI('PM25', conc_PM25)
    }

    // trend: up if current > 10min average
    let trend = pm25Averages.pm25Current > pm25Averages.pm25Avg10Min ? "\u2191" : "\u2193"

    // create and show widget
    let widget = createWidget(
      "Purple Air",
      `${Math.round(aqi)} ${trend}`,
      `${cat}`,
      `${conc_PM25} PM2.5`,
      `${bgColor}`
    )
    Script.setWidget(widget)
    Script.complete()
  } else { // non-widget mode
    let sensorLocation = json?.results[0]['Label']
    let stats = JSON.parse(json?.results[0]['Stats'])
    // Average PM2.5 by time range (legacy stats: pm, v1–v6)
    let pm25Averages = getPM25AveragesByTimeRange(stats)

    // create table
    let table = new UITable()

    // add header
    let row = new UITableRow()
    row.isHeader = true
    row.addText(`Purple Air Stats in ${sensorLocation}`)
    table.addRow(row)

    // fill data: average PM2.5 stats by time range
    table.addRow(createRow("Real time or current", calculateAQI('PM25', pm25Averages.pm25Current)[0]))
    table.addRow(createRow("10 minute average", calculateAQI('PM25', pm25Averages.pm25Avg10Min)[0]))
    table.addRow(createRow("30 minute average", calculateAQI('PM25', pm25Averages.pm25Avg30Min)[0]))
    table.addRow(createRow("1 hour average", calculateAQI('PM25', pm25Averages.pm25Avg1Hour)[0]))
    table.addRow(createRow("6 hour average", calculateAQI('PM25', pm25Averages.pm25Avg6Hour)[0]))
    table.addRow(createRow("24 hour average", calculateAQI('PM25', pm25Averages.pm25Avg24Hour)[0]))
    table.addRow(createRow("One week average", calculateAQI('PM25', pm25Averages.pm25Avg1Week)[0]))

    // present table
    table.present()
  }

  // Helper function to create rows in the widget interface in iOS
  function createWidgetRow(widget, title, color, textOpacity, fontSize, isBold) {
    let preTxt = widget.addText(title)
    preTxt.textColor = color
    preTxt.textOpacity = textOpacity
    preTxt.font = isBold ? Font.boldSystemFont(fontSize) : Font.systemFont(fontSize)
  }

  // Helper function to create widget interface in iOS
  function createWidget(pretitle, aqi, cat, pm25, color) {
    let w = new ListWidget()
    w.backgroundColor = new Color(color)
    w.spacing = 0
    textColor = Color.white()
    createWidgetRow(w, pretitle, textColor, 1, 15, true)
    w.addSpacer(-5)
    createWidgetRow(w, aqi, textColor, 1, 44)
    w.addSpacer(30)
    createWidgetRow(w, cat, textColor, 1, 15)
    w.addSpacer(1)
    createWidgetRow(w, pm25, textColor, 1, 15)
    return w
  }

  // Returns average PM2.5 stats by time range from legacy API (pm, v1–v6).
  function getPM25AveragesByTimeRange(stats) {
    if (!stats) {
      return {
        pm25Current: 0, pm25Avg10Min: 0, pm25Avg30Min: 0, pm25Avg1Hour: 0,
        pm25Avg6Hour: 0, pm25Avg24Hour: 0, pm25Avg1Week: 0
      }
    }
    return {
      pm25Current: stats.pm ?? 0,
      pm25Avg10Min: stats.v1 ?? 0,
      pm25Avg30Min: stats.v2 ?? 0,
      pm25Avg1Hour: stats.v3 ?? 0,
      pm25Avg6Hour: stats.v4 ?? 0,
      pm25Avg24Hour: stats.v5 ?? 0,
      pm25Avg1Week: stats.v6 ?? 0
    }
  }

  // Helper function to create rows in UI table when script runs
  function createRow(title, number) {
    let row = new UITableRow()
    row.addText(title)
    row.addText(number.toString()).rightAligned()
    return row
  }

  // Determines the low/high indices of air quality
  function findLowAndHighAQI(p, c) {
    let between = (val, min, max) => (min <= val && val <= max)
    let c1 = p['c1']
    let c2 = p['c2']
    let c3 = p['c3']
    let c4 = p['c4']
    let c5 = p['c5']
    let c6 = p['c6']
    let c7 = p['c7']

    if (between(c, c1[0], c1[1]))
      return [0, 50, c1[0], c1[1], 'Good', "#53d769"]
    if (between(c, c2[0], c2[1]))
      return [51, 100, c2[0], c2[1], 'Moderate', "#dddd55"]
    if (between(c, c3[0], c3[1]))
      return [101, 150, c3[0], c3[1], 'Unhealthy for sensitive groups', "#ef8533"]
    if (between(c, c4[0], c4[1]))
      return [151, 200, c4[0], c4[1], 'Unhealthy', "#ea3324"]
    if (between(c, c5[0], c5[1]))
      return [201, 300, c5[0], c5[1], 'Very Unhealthy', "#8c1a4b"]
    if (between(c, c6[0], c6[1]))
      return [301, 400, c6[0], c6[1], 'Hazardous', "#731425"]
    if (between(c, c7[0], c7[1]))
      return [401, 500, c7[0], c7[1], 'Hazardous', "#731425"]

    return [0,0,0,0]
  }

  function calculateAQI(pollutant, concentration) {
    let iLow = 0
    let iHigh = 0
    let cLow = 0
    let cHigh = 0
    let category = 0
    let bgColor = ""
    let aqi = 0

    // wierd js error in scriptable with destructuring, placed a block around it to fix issue
    {
      [iLow, iHigh, cLow, cHigh, category, bgColor] = findLowAndHighAQI(P[pollutant], concentration)
    }
    aqi = (((iHigh -  iLow) / (cHigh - cLow)) * (concentration - cLow) + iLow).toFixed(2)
    return [aqi, category, bgColor]
  }
