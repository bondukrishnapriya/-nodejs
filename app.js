const express = require('express')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')
const app = express()
app.use(express.json())
let db = null
const initalizeDbandServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error :${e.message}`)
    process.exit(1)
  }
}
initalizeDbandServer()
const convertStateDbObjectToResponseObject = dbobject => {
  return {
    stateId: dbobject.state_id,
    stateName: dbobject.state_name,
    population: dbobject.population,
  }
}
const convertDistrictDbObjectToResponseObject = dbobject => {
  return {
    districtId: dbobject.district_id,
    districtName: dbobject.district_name,
    stateId: dbobject.state_id,
    cases: dbobject.cases,
    cured: dbobject.cured,
    active: dbobject.active,
    deaths: dbobject.deaths,
  }
}
function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectSqlQuery = `SELECT * FROM user WHERE username='${username}';`
  const dbuser = await db.get(selectSqlQuery)
  if (dbuser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbuser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }

      const jwtToken = jwt.sign(payload, 'My_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
app.get('/states/', authenticateToken, async (request, response) => {
  const getSqlQuery = `SELECT *FROM state;`
  const statesArray = await db.all(getSqlQuery)
  response.send(
    statesArray.map(eachState =>
      convertStateDbObjectToResponseObject(eachState),
    ),
  )
})
app.get('/states/:stateId', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `SELECT *FROM state WHERE state_id=${stateId};`
  const state = await db.get(getStateQuery)
  response.send(convertStateDbObjectToResponseObject(state))
})
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postDistrictQuery = `INSERT INTO 
  district(district_name,state_id,cases,cured,active,deaths) 
  VALUES('${districtName}',${stateId},${cases},${cured}${active},${deaths});`
  await db.run(postDistrictQuery)
  response.send('District Successfully Added')
})
app.get(
  'districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getSqlQuery = `SELET * FROM district WHERE district_id=${districtId};`
    const district = await db.get(getSqlQuery)
    response.send(convertDistrictDbObjectToResponseObject(district))
  },
)
app.delete(
  '/districts/:districtsId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteSqlQuery = `DELETE * FROM district WHERE district_id=${districtId};`
    await db.run(deleteSqlQuery)
    response.send('District Removed')
  },
)
app.put(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateSqlQuery = `UPDATE district
  SET
  district_name='${districtName}',
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths}
  WHERE 
  district_id=${districtId};
  }`
    await db.run(updateSqlQuery)
    response.send('District details Updated')
  },
)
app.get('/states/:stateId/stats', authenticateToken, (request, response) => {
  const {stateId} = request.params
  const selectSqlQuery = `SELECT  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths)
  FROM district
  WHERE
  state_id=${stateId};`
  const stats = await db.run(selectSqlQuery)
  response.send({
    totalCases: stats['SUM(cases)'],
    totalCured: stats['SUM(cured)'],
    totalActive: stats['SUM(active)'],
    totalDeaths: stats['SUM(deaths)'],
  })
})
module.exports=app;
