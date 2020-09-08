import { Autocomplete } from './assets/js/common/autocomplete.js'

const state = {

    adjectives: [
        "softserve developer",
        "artist",
        "goof", 
        "adventurer",
        "introvert",
        "boyfriend",
        "dog dad",
        "musician",
        "friend",
        "fam"
    ],
    currentIndex: 0,
    maxRender: 3
}


const initializePage = () => {
    initializeAdjectives()
}

const createAdjectiveElement = (position, text) => {
    const element = document.createElement("div")
    element.className = "adjective"
    element.innerHTML = position == 0 ? "> " + text: text
    return element
}

const initializeAdjectives = () => {
    const adjectivesContainer = document.getElementById("adjectives")
    
    for (let i = 0; i < state.maxRender+1; i++) {

        console.log(state.currentIndex, state.adjectives.length, mod(state.currentIndex + i, state.adjectives.length))
        const adj = state.adjectives[mod(state.currentIndex + i, state.adjectives.length)]
        console.log(adj)
        const element = createAdjectiveElement(i, adj)
        adjectivesContainer.appendChild(element)
    }
}

const renderAdjectives = () => {
    const children = []
    const adjectivesContainer = document.getElementById("adjectives")
    for (let i = 0; i < state.maxRender+1; i++) {

        console.log(state.currentIndex, state.adjectives.length, mod(state.currentIndex + i, state.adjectives.length))
        const adj = state.adjectives[mod(state.currentIndex + i, state.adjectives.length)]
        console.log(adj)
        const element = createAdjectiveElement(i, adj)
        adjectivesContainer.replaceChild(element, adjectivesContainer.children[i])
    }
}

const cycleDownAdjectives = () => {
    const adjectivesContainer = document.getElementById("adjectives")
    adjectivesContainer.removeChild(adjectivesContainer.lastChild)
    const adj = state.adjectives[state.currentIndex]
    const element = createAdjectiveElement(mod(state.currentIndex + state.maxRender, state.adjectives.length), adj)

    adjectivesContainer.prepend(element)
}

const cycleUpAdjectives = () => {
    const adjectivesContainer = document.getElementById("adjectives")

    adjectivesContainer.removeChild(adjectivesContainer.firstChild)
    const adj = state.adjectives[state.currentIndex]
    const element = createAdjectiveElement(i, adj)

    adjectivesContainer.append(element)
}

const mod = (n, m) => {
    return ((n % m) + m) % m;
}

document.addEventListener('keydown', (e) => {
    
    if (e.code == "ArrowDown") {
        state.currentIndex =  mod(state.currentIndex + 1, state.adjectives.length)

        renderAdjectives()
    }

    else if (e.code == "ArrowUp") {
        state.currentIndex =  mod(state.currentIndex - 1, state.adjectives.length)
        
        renderAdjectives()
    }
})

window.addEventListener('load', initializePage);
window.addEventListener('hashchange', initializePage);

const autocomplete = document.getElementById("autocomplete")
const test = new Autocomplete(autocomplete, state.adjectives, 4)
test.renderSearch("")