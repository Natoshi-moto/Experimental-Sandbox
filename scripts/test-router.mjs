import fs from 'node:fs'

const routes = JSON.parse(fs.readFileSync(new URL('../assistant/router/routes.json', import.meta.url), 'utf8'))

const byId = new Map(routes.routes.map((route) => [route.id, route]))
const cases = [
  ["let's fuck around in the sandbox", 'CATCH'],
  ['access the sandbox and let me go nuts', 'CATCH'],
  ["I've got a weird idea", 'CATCH'],
  ['fork this and see what happens', 'EXPERIMENT'],
  ['break this properly', 'EXPERIMENT'],
  ['put this somewhere public', 'PUBLISH'],
  ['show people what I found', 'PUBLISH'],
  ['could this help main?', 'PROMOTE'],
  ['make it real through Lab', 'PROMOTE'],
  ['ask Lab to look at this', 'PROMOTE']
]

function routeText(text) {
  const value = ` ${text.toLowerCase()} `
  const scored = routes.routes.map((route, index) => ({
    route,
    index,
    score: route.triggers.filter((trigger) => value.includes(trigger)).length
  }))
  scored.sort((a, b) => b.score - a.score || b.index - a.index)
  return scored[0].score ? scored[0].route : byId.get('CATCH')
}

for (const [input, expected] of cases) {
  const actual = routeText(input)
  if (actual.id !== expected) {
    throw new Error(`route mismatch: ${JSON.stringify(input)} expected=${expected} actual=${actual.id}`)
  }
}

for (const route of routes.routes) {
  if (!route.max_authority) throw new Error(`missing authority: ${route.id}`)
  if (route.max_authority === 'MERGE_LAB_MAIN') throw new Error(`forbidden authority: ${route.id}`)
}

const forbidden = new Set(routes.forbidden)
for (const required of ['MERGE_LAB_MAIN', 'BYPASS_LAB_PROTECTION', 'ALTER_FROZEN_SNAPSHOT', 'PUBLISH_SECRET', 'CLEAR_LAB_RED']) {
  if (!forbidden.has(required)) throw new Error(`missing forbidden boundary: ${required}`)
}

console.log(`router: PASS (${cases.length} loose-English cases, ${routes.routes.length} bounded routes)`)
