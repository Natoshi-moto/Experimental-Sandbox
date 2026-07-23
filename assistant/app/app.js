const ROUTES = [
  { id: 'CATCH', label: '🧠 Catch chaos', skill: 'catch-chaos', authority: 'SANDBOX_DRAFT', words: ['fuck around','access the sandbox','go nuts','weird idea','idea','thought','ramble','save','dribble','go'] },
  { id: 'ADVISE', label: '🧭 Advise me', skill: 'advise-operator', authority: 'READ_ONLY', words: ['translate','claude','opus','what matters','decision','report'] },
  { id: 'EXPERIMENT', label: '🧪 Run experiment', skill: 'run-public-experiment', authority: 'SANDBOX_WRITE', words: ['see what happens','fuck with','test','fork','break','try','reproduce','experiment'] },
  { id: 'PUBLISH', label: '📡 Publish findings', skill: 'publish-fastfoodai', authority: 'DRAFT_EXTERNAL', words: ['show people','somewhere public','write this up','make an article','reddit','fastfoodai','twitter',' x ','video','daily','weekly','publish'] },
  { id: 'PROMOTE', label: '🚨 Ask Lab', skill: 'request-lab-promotion', authority: 'DRAFT_LAB_PR', words: ['could this help main','make it real','ask lab','propose to main','promotion','package it'] }
]

const KEY = 'mithub.adjacent.v0'
const state = JSON.parse(localStorage.getItem(KEY) || '{"profile":null,"draft":"","log":[],"route":"CATCH"}')
const entry = document.querySelector('#entry-dialog')
const where = document.querySelector('#where-dialog')
const prompt = document.querySelector('#prompt')
const messages = document.querySelector('#messages')

function save() { localStorage.setItem(KEY, JSON.stringify(state)) }
function currentRoute() { return ROUTES.find(route => route.id === state.route) || ROUTES[0] }

function routeText(text) {
  const value = ` ${text.toLowerCase()} `
  const scored = ROUTES.map(route => ({ route, score: route.words.filter(word => value.includes(word)).length }))
  scored.sort((a,b) => b.score - a.score || ROUTES.indexOf(b.route) - ROUTES.indexOf(a.route))
  return scored[0].score ? scored[0].route : ROUTES[0]
}

function responseFor(route) {
  const responses = {
    CATCH: 'Caught. Your original words are preserved locally. Route: Sandbox draft. Lab impact: NO.\\n\\nNext: SHOW PEOPLE · TEST IT · PARK',
    ADVISE: 'Route: read-only adviser. I will return only: what is new, whether pushback is real, what changes, and the next move. Lab impact: NO.',
    EXPERIMENT: 'Route: public experiment. I will extract one claim, one falsifier and the smallest test, then preserve evidence and wreckage under an SBX ID. Lab impact: NO.',
    PUBLISH: 'Route: FastFoodAI publication desk. I will make an evidence-backed source report, then daily, weekly, Reddit, X and video variants. External publishing remains draft-only until the target is configured.',
    PROMOTE: '🚨 Route: Lab promotion request. Maximum authority: prepare a provenance-bound package and draft PR. I cannot approve, merge, bypass protection, rewrite snapshots or clear reds.'
  }
  return responses[route.id]
}

function addMessage(kind, text) {
  const article = document.createElement('article')
  article.className = kind === 'user' ? 'user-message' : 'assistant-message'
  const label = document.createElement('span')
  label.textContent = kind === 'user' ? (state.profile || 'YOU').toUpperCase() : 'ADJACENT'
  const body = document.createElement('p')
  body.textContent = text
  article.append(label, body)
  messages.append(article)
  messages.scrollTop = messages.scrollHeight
}

function renderRoutes() {
  const list = document.querySelector('#route-list')
  list.innerHTML = ''
  ROUTES.forEach(route => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `route-button${route.id === state.route ? ' active' : ''}`
    button.textContent = route.label
    button.addEventListener('click', () => {
      state.route = route.id
      state.log.push({ at: new Date().toISOString(), event: 'manual-route', route: route.id, authority: route.authority })
      save(); renderRoutes()
    })
    list.append(button)
  })
  document.querySelector('#authority').textContent = currentRoute().authority
}

document.querySelectorAll('[data-profile]').forEach(button => button.addEventListener('click', () => {
  state.profile = button.dataset.profile
  state.log.push({ at: new Date().toISOString(), event: 'profile-entry', profile: state.profile, authority: 'NONE' })
  save(); entry.close()
}))

document.querySelector('#profile-button').addEventListener('click', () => entry.showModal())
document.querySelector('#prompt-form').addEventListener('submit', event => {
  event.preventDefault()
  const text = prompt.value.trim()
  if (!text) return
  const route = routeText(text)
  state.route = route.id
  state.draft = text
  state.log.push({ at: new Date().toISOString(), event: 'routed', route: route.id, skill: route.skill, authority: route.authority, input_length: text.length })
  save()
  addMessage('user', text)
  addMessage('assistant', responseFor(route))
  prompt.value = ''
  state.draft = ''
  save(); renderRoutes()
})
prompt.addEventListener('input', () => { state.draft = prompt.value; save() })

document.querySelector('#where-button').addEventListener('click', () => {
  document.querySelector('#where-profile').textContent = state.profile || 'not selected'
  document.querySelector('#where-route').textContent = currentRoute().label
  where.showModal()
})
document.querySelector('#where-dialog .close').addEventListener('click', () => where.close())
document.querySelector('#export-log').addEventListener('click', () => {
  const payload = { schema: 'mithub.router-log/v0', status_authority: 'NONE', profile: state.profile, events: state.log }
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mithub-router-log-${new Date().toISOString().slice(0,10)}.json`
  link.click()
  URL.revokeObjectURL(url)
})

prompt.value = state.draft || ''
renderRoutes()
if (!state.profile) entry.showModal()
