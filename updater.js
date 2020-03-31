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

const PROVINCE_NAME = {
  '1': 'Canada',
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
  const PROVINCE_DATA = parseCSV(data).sortByProvinceId()
  const PROVINCE_ANGLES = Object.keys(PROVINCE_DATA)
    .reduce((acc, province) => {
      acc[province] = averageAngle(PROVINCE_DATA[province])
      return acc
    }, {})

  // Update template HTML
  getTemplate(template => {
    // Update template values
    Object.keys(PROVINCE_ANGLES).forEach(key => {
      const NAME_PATTERN = new RegExp('{{' + key + '-name}}', 'gm')
      const CLASS_PATTERN = new RegExp('{{' + key + '-class}}', 'gm')
      const CURVE_PATTERN = new RegExp('{{' + key + '-curve}}', 'gm')
      const CURVE = normalizeCurve(PROVINCE_ANGLES[key])
      template = template.replace(NAME_PATTERN, PROVINCE_NAME[key])
      template = template.replace(CLASS_PATTERN, getStyleClass(CURVE))
      template = template.replace(CURVE_PATTERN, CURVE)
      if (key === '1') {
        // Update main text
        const MAIN_TEXT = new RegExp('{{main-text}}', 'gm')
        template = template.replace(MAIN_TEXT, getTextForValue(CURVE))
      }
    })
    // Update generated timestamp
    const GENERATED_TIMESTAMP = new RegExp('{{generated-timestamp}}', 'gm')
    template = template.replace(GENERATED_TIMESTAMP, new Date())
    // Save updated templated
    persistFile(template, 'index.html', () => {
      console.log('Done!')
    })
  })
}

function normalizeCurve(value) {
  if (isNaN(value)) return 0
  return parseFloat(value.toFixed(4))
}

function getStyleClass(value) {
  if (value > 8) {
    return 'progress'
  } else if (value <= 7.99 && value >= 5) {
    return 'working'
  } else if (value <= 4.99 && value >= 3) {
    return 'closer'
  } else if (value <= 2.99 && value >= 0.8) {
    return 'almost'
  } else {
    return 'flat'
  }
}

function getTextForValue(value) {
  if (value > 8) {
    return 'Making progress!'
  } else if (value <= 7.99 && value >= 5) {
    return 'It\'s working!'
  } else if (value <= 4.99 && value >= 3) {
    return 'Getting closer!'
  } else if (value <= 2.99 && value >= 0.8) {
    return 'Almost there!'
  } else {
    return 'YES!'
  }
}

function averageAngle(provinceData) {
  const SPREAD = 10
  const BUFFER = 1
  const DATA_LENGTH = provinceData.length
  // Check if province has enough data
  let cases = provinceData.reduce((sum, data) => {
    return sum + parseInt(data.total)
  }, 0)
  if (cases < 200 || DATA_LENGTH < SPREAD) {
    return NaN
  }
  return (new Array(SPREAD)).fill(undefined)
    .reduce((acc, _, index) => {
      const FROM = provinceData[DATA_LENGTH - (BUFFER + index)]
      const NOW = provinceData[DATA_LENGTH - index]
      if (FROM && NOW) {
        return acc + angle(0, Math.log(FROM.total), BUFFER, Math.log(NOW.total))
      } else {
        return acc
      }
    }, 0) / (SPREAD - 1)
}

function parseCSV(data) {
  let rows = data.split('\n')
  const VALUES = rows.shift().split(',')
  return rows.map(row => {
    const COLUMNS = row.split(',')
    return VALUES.reduce((acc, value, index) => {
      if (COLUMN_MAPPING[value]) {
        acc[COLUMN_MAPPING[value]] = COLUMNS[index]
      }
      return acc
    }, {})
  })
}

function angle(cx, cy, ex, ey) {
  let dy = ey - cy
  let dx = ex - cx
  let theta = Math.atan2(dy, dx) // range (-PI, PI]
  theta *= 180 / Math.PI // rads to degs, range (-180, 180]
  return theta
}

Array.prototype.sortByProvinceId = function () {
  return this.reduce((sorted, value) => {
    if (Array.isArray(sorted[value.id])) {
      sorted[value.id].push(value)
    } else {
      sorted[value.id] = [value]
    }
    return sorted
  }, {})
}