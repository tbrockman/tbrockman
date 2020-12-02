const state = {

    adjectives: [
        "softserve developer",
        "artist",
        "goof", 
        "introvert",
        "adventurer",
        "musician",
        "boyfriend",
        "dog dad",
        "friend",
        "brother",
        "dude"
    ],
    currentIndex: 0,
    maxRender: 3
}


const initializePage = () => {
    initializeAdjectives()
}

const createAdjectiveElement = (position, text) => {
    element = document.createElement("div")
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

let timer;
let interval = 3000;

const startInterval = () => {
    timer = window.setInterval(() => {
        state.currentIndex =  mod(state.currentIndex + 1, state.adjectives.length)
    
        renderAdjectives()
    }, interval)
}

const restartInterval = () => {
    clearInterval(timer);
    startInterval();
}

startInterval();

document.addEventListener('keydown', (e) => {
    console.log(e)

    restartInterval()    

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