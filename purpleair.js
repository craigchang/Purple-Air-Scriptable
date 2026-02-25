// purpleair.js

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
  
  let param = args.widgetParameter // sensor id from widget param
  // let param = 123456789 // manual override of sensor id
  let url = "https://www.purpleair.com/json?" + param
  let req = new Request(url)
  let json = await req.loadJSON()
  
  if (config.runsInWidget) {
    // get current PM2.5 value from json
    let conc_PM25 = json?.results[0]['PM2_5Value']
    let stats = JSON.parse(json?.results[0]['Stats'])
    
    // calculates AQI
    // let aqi = Math.round(calculateAQI('PM25', conc_PM25))
    // let cat = calculateAqiCategory(aqi)
    // let bgColor = calculateAqiBackgroundColor(aqi)
    let aqi = 0
    let cat = ""
    let bgColor = ""
    {
      [aqi, cat, bgColor] = calculateAQI('PM25', conc_PM25)
    }
  
    // create and show widget
    let widget = createWidget(
      "Purple Air",
      `${Math.round(aqi)} ${stats.v > stats.v1 ? "\u2191" : "\u2193"}`,
      `${cat}`,
      `${conc_PM25} PM2.5`,
      `${bgColor}`
    )
    Script.setWidget(widget)
    Script.complete()
  } else { // non-widget mode
    // get locaiton of sensor
    let sensorLocation = json?.results[0]['Label']
    let stats = JSON.parse(json?.results[0]['Stats'])
  
    // create table
    let table = new UITable()
  
    // add header
    let row = new UITableRow()
    row.isHeader = true
    row.addText(`Purple Air Stats in ${sensorLocation}`)
    table.addRow(row)
  
    // fill data
    table.addRow(createRow("Real time or current", calculateAQI('PM25', stats.pm)[0]))
    table.addRow(createRow("10 minute average", calculateAQI('PM25', stats.v1)[0]))
    table.addRow(createRow("30 minute average", calculateAQI('PM25', stats.v2)[0]))
    table.addRow(createRow("1 hour average", calculateAQI('PM25', stats.v3)[0]))
    table.addRow(createRow("6 hour average", calculateAQI('PM25', stats.v4)[0]))
    table.addRow(createRow("24 hour average", calculateAQI('PM25', stats.v5)[0]))
    table.addRow(createRow("One week average", calculateAQI('PM25', stats.v6)[0]))
    
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