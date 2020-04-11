const fs = require('fs')
const path = require('path')
const https = require('https')

const PRODUCTION = process.env.production === 'true'

const COLUMN_MAPPING = {
  'pruid': 'id',
  'prname': 'name',
  'date': 'date',
  'numconf': 'confirmed',
  'numprob': 'probable',
  'numdeaths': 'deaths',
  'numtotal': 'total',
  'numtoday': 'new'
}

const AREAS = {
  '1' : 'Canada',
  '10': 'Newfoundland and Labrador',
  '11': 'Prince Edward Island',
  '12': 'Nova Scotia',
  '13': 'New Brunswick',
  '24': 'Québec',
  '35': 'Ontario',
  '46': 'Manitoba',
  '47': 'Saskatchewan',
  '48': 'Alberta',
  '59': 'British Columbia',
  '60': 'Yukon',
  '61': 'Northwest Territories',
  '62': 'Nunavut',
}

const IMPROVEMENT_TEXT = `<br>That's a <span class="flat">-{{yesterday-diff}}</span> improvement from yesterday and <span class="flat">-{{week-diff}}</span>
improvement from a week ago!`

// Run the show
getData(processData)

function getData(cb) {
  if (PRODUCTION) {
    getRemoteData(cb)
  } else {
    getLocalData('covid19.csv', cb)
  }
}

function getTemplate(cb) {
  if (PRODUCTION) {
    https.get({
      host: 'raw.githubusercontent.com',
      port: 443,
      path: '/20k-ultra/areweflatyet.ca/master/template.html'
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        cb(data)
      })
    }).on('error', e => {
      console.error(e)
      throw e
    })
  } else {
    getLocalData('template.html', cb)
  }
}

function getLocalData(file, cb) {
  const CSV_PATH = path.join(__dirname, file)
  fs.readFile(CSV_PATH, {
    encoding: 'utf-8'
  }, (err, data) => {
    if (err) {
      // Get remote data
      getRemoteData(data => {
        // Persist locally
        persistFile(data, file, () => {
          cb(data)
        })
      })
    } else {
      // Return local data
      cb(data)
    }
  })
}

function getRemoteData(cb) {
  https.get({
    host: 'health-infobase.canada.ca',
    port: 443,
    path: '/src/data/covidLive/covid19.csv'
  }, (res) => {
    let data = ''
    res.on('data', (chunk) => {
      data += chunk
    })
    res.on('end', () => {
      cb(data)
    })
  }).on('error', e => {
    console.error(e.message)
    throw e
  })
}

function persistFile(data, fileName, cb) {
  const FILE_PATH = path.join(__dirname, fileName)
  fs.writeFile(FILE_PATH, data, (err) => {
    if (err) {
      throw err
    }
    cb()
  })
}

function processData(data) {
  const SORTED_DATA = parseCSV(data).sortById()
  // Update template HTML
  getTemplate(template => {
    // Set Canada's values
    template = setNationalData(template, SORTED_DATA)
    // Set province values
    template = setProvinceData(template, SORTED_DATA)
    // Set generated timestamp
    const GENERATED_TIMESTAMP = new RegExp('{{generated-timestamp}}', 'gm')
    template = template.replace(GENERATED_TIMESTAMP, new Date())
    // Save updated templated
    persistFile(template, 'index.html', () => {
      console.log('Done!')
    })
  })
}

function setNationalData(template, data) {
  const NATIONAL_KEY = '1'
  const AVERAGE_CURVE = averageCurve(data[NATIONAL_KEY])
  const CURVE = normalizeCurve(AVERAGE_CURVE)
  const MAIN_TEXT = new RegExp('{{main-text}}', 'gm')
  // Set main text
  template = template.replace(MAIN_TEXT, getTextForValue(CURVE))
  // Set todays curve
  template = setCurve(template, NATIONAL_KEY, CURVE)
  // Set yesterday difference
  const DAY_DIFF = normalizeCurve(CURVE - averageCurve(data[NATIONAL_KEY].slice(0, (data[NATIONAL_KEY].length - 1))))
  template = template.replace(`{{${NATIONAL_KEY}-yesterday-diff}}`, DAY_DIFF)
  // Set week difference
  const WEEK_DIFF = normalizeCurve(CURVE - averageCurve(data[NATIONAL_KEY].slice(0, (data[NATIONAL_KEY].length - 7))))
  return template.replace(`{{${NATIONAL_KEY}-week-diff}}`, WEEK_DIFF)
}

function setProvinceData(template, data) {
  return Object.keys(data)
    .filter(key => {
      return Object.keys(AREAS).includes(key)
    })
    .reduce((modifiedTemplate, provinceKey) => {
      const AVERAGE_CURVE = averageCurve(data[provinceKey])
      const CURVE = normalizeCurve(AVERAGE_CURVE)
      // Set todays curve
      modifiedTemplate = setCurve(modifiedTemplate, provinceKey, CURVE)
      // Set yesterday difference
      const DAY_DIFF = normalizeCurve(CURVE - averageCurve(data[provinceKey].slice(0, (data[provinceKey].length - 1))))
      modifiedTemplate = modifiedTemplate.replace(`{{${provinceKey}-yesterday-diff}}`, DAY_DIFF)
      // Set week difference
      const WEEK_DIFF = normalizeCurve(CURVE - averageCurve(data[provinceKey].slice(0, (data[provinceKey].length - 7))))
      return modifiedTemplate.replace(`{{${provinceKey}-week-diff}}`, WEEK_DIFF)
    }, template)
}

function normalizeCurve(value) {
  if (isNaN(value)) return 0
  return parseFloat(value.toFixed(4))
}

function getStyleClass(value) {
  if (value > 15) {
    return 'soon'
  } else if (value <= 14.99 && value >= 10) {
    return 'progress'
  } else if (value <= 9.99 && value >= 5.2) {
    return 'working'
  } else if (value <= 5.19 && value >= 2) {
    return 'almost'
  } else if (value <= 1.99 && value >= 0.8) {
    return 'almost'
  } else {
    return 'flat'
  }
}

function getTextForValue(value) {
  if (value > 15) {
    return 'Keep going!'
  } else if (value <= 14.99 && value >= 10) {
    return 'Making progress!'
  } else if (value <= 9.99 && value >= 5.2) {
    return 'It\'s working!'
  } else if (value <= 5.19 && value >= 2) {
    return 'Getting closer!'
  } else if (value <= 1.99 && value >= 0.8) {
    return 'Almost there!'
  } else {
    return 'YES!'
  }
}

function averageCurve(areaData) {
  const SPREAD = 10
  const BUFFER = 1
  const DATA_LENGTH = areaData.length
  // Check if area has enough data
  if (areaData[areaData.length - 1].total < 100 || DATA_LENGTH < SPREAD) {
    return NaN
  }
  return (new Array(SPREAD))
    .fill(undefined)
    .reduce((acc, _, index) => {
      const FROM = areaData[DATA_LENGTH - (BUFFER + index)]
      const NOW = areaData[DATA_LENGTH - index]
      if (FROM && NOW) {
        return acc + angle(0, Math.log(FROM.total), BUFFER, Math.log(NOW.total))
      } else {
        return acc
      }
    }, 0) / (SPREAD - 1)
}

function parseCSV(data) {
  let rows = data.split('\n')
  const HEADINGS = rows.shift().split(',')
  return rows
    .map(row => {
      const COLUMNS = removeEscapedCommas(row).split(',')
      return HEADINGS.reduce((acc, value, index) => {
        if (COLUMN_MAPPING[value]) {
          acc[COLUMN_MAPPING[value]] = COLUMNS[index]
        }
        return acc
      }, {})
    })
}

function removeEscapedCommas(csvLine) {
  if (csvLine.split('"').length < 2) return csvLine
  let firstQuotes = csvLine.indexOf('"')
  if (firstQuotes !== -1) {
    let nextQuotes = csvLine.substring(firstQuotes + 1).indexOf('"')
    let target = csvLine.substring(firstQuotes + 1, firstQuotes + nextQuotes + 1)
    csvLine = csvLine.replace(`"${target}"`, target.replace(/,/g, ''))
    // Check for more quotes
    if (csvLine.split('"').length >= 2) {
      csvLine = removeEscapedCommas(csvLine)
    }
  }
  return csvLine
}

function angle(cx, cy, ex, ey) {
  let dy = ey - cy
  let dx = ex - cx
  let theta = Math.atan2(dy, dx) // range (-PI, PI]
  theta *= 180 / Math.PI // rads to degs, range (-180, 180]
  return theta
}

function setCurve(template, areaId, curve) {
  const PATTERNS = [`{{${areaId}-name}}`, `{{${areaId}-class}}`, `{{${areaId}-curve}}`]
  return PATTERNS.reduce((modifiedTemplate, pattern, index) => {
    switch (index) {
      case 0:
        return replaceValue(modifiedTemplate, pattern, AREAS[areaId])
        break
      case 1:
        return replaceValue(modifiedTemplate, pattern, getStyleClass(curve))
        break
      case 2:
        return replaceValue(modifiedTemplate, pattern, curve)
        break
      default:
        return modifiedTemplate
    }
  }, template)
}

function replaceValue(text, pattern, value) {
  const REGEX = new RegExp(pattern, 'gm')
  return text.replace(REGEX, value)
}

String.prototype.updateValue = function (regex, value) {
  return this.replace(regex, value)
}

Array.prototype.sortById = function () {
  return this.reduce((sorted, value) => {
    if (Array.isArray(sorted[value.id])) {
      sorted[value.id].push(value)
    } else {
      if (value.id.length > 0) {
        sorted[value.id] = [value]
      }
    }
    return sorted
  }, {})
}