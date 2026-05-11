/*** 12-05-26 00:25 - Flight Simulator Master Data **/

export const PLANETS_DATA = {
    MERCURY: {
        name: "MERCURY",
        radius: 233,
        orbitDistance: 23200,
        orbitSpeed: 0.0008,
        rotationSpeed: 0.001,
        segments: 64,
        texture: 'https://cdn.jsdelivr.net/gh/*/texture/2k_mercury.jpg',
        info: "Closest to the Sun. Extreme temperature swings. No atmosphere.",
        type: "solid"
    },
    VENUS: {
        name: "VENUS",
        radius: 578,
        orbitDistance: 43300,
        orbitSpeed: 0.0006,
        rotationSpeed: 0.0005,
        segments: 64,
        texture: 'https://cdn.jsdelivr.net/gh/*/texture/2k_venus_atmosphere.jpg',
        info: "Extreme greenhouse effect. Thick sulfuric acid clouds.",
        type: "solid"
    },
    EARTH: {
        name: "EARTH",
        radius: 608,
        orbitDistance: 60000,
        orbitSpeed: 0.0005,
        rotationSpeed: 0.002,
        segments: 64,
        texture: 'https://cdn.jsdelivr.net/gh/*/texture/2k_earth_daymap.jpg',
        info: "Home. The only known world with liquid water and life.",
        type: "solid"
    },
    MARS: {
        name: "MARS",
        radius: 323,
        orbitDistance: 91400,
        orbitSpeed: 0.0004,
        rotationSpeed: 0.002,
        segments: 64,
        texture: 'https://cdn.jsdelivr.net/gh/*/texture/2k_mars.jpg',
        info: "The Red Planet. Iron oxide dust and polar ice caps.",
        type: "solid"
    },
    JUPITER: {
        name: "JUPITER",
        radius: 3000,
        orbitDistance: 312000,
        orbitSpeed: 0.00025,
        rotationSpeed: 0.004,
        segments: 128,
        texture: 'https://cdn.jsdelivr.net/gh/*/texture/2k_jupiter.jpg',
        info: "Massive gas giant. Strongest magnetic field. Great Red Spot.",
        type: "gas"
    },
    SATURN: {
        name: "SATURN",
        radius: 2500,
        orbitDistance: 572400,
        orbitSpeed: 0.00015,
        rotationSpeed: 0.0035,
        segments: 128,
        texture: 'https://cdn.jsdelivr.net/gh/*/texture/2k_saturn.jpg',
        ringTexture: 'https://cdn.jsdelivr.net/gh/*/texture/2k_saturn_ring_alpha.png',
        ringInner: 3000,
        ringOuter: 5500,
        info: "Famous ring system. Lowest density of any planet.",
        type: "gas"
    },
    TITAN: {
        name: "TITAN",
        radius: 350,
        orbitDistance: 12000, // Local distance from Saturn
        orbitSpeed: 0.005,
        rotationSpeed: 0.005,
        segments: 64,
        texture: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/titan.jpg',
        info: "Saturn's largest moon. Thick nitrogen haze. Liquid methane lakes.",
        type: "solid"
    },
    URANUS: {
        name: "URANUS",
        radius: 1200,
        orbitDistance: 1152000,
        orbitSpeed: 0.0001,
        rotationSpeed: 0.003,
        segments: 128,
        texture: 'https://cdn.jsdelivr.net/gh/*/texture/2k_uranus.jpg',
        info: "Ice giant with an axial tilt of 98 degrees. Coldest atmosphere.",
        type: "gas"
    },
    NEPTUNE: {
        name: "NEPTUNE",
        radius: 1150,
        orbitDistance: 1800000,
        orbitSpeed: 0.00008,
        rotationSpeed: 0.003,
        segments: 128,
        texture: 'https://cdn.jsdelivr.net/gh/*/texture/2k_neptune.jpg',
        info: "Distant blue world. High-speed supersonic winds.",
        type: "gas"
    },
    PLUTO: {
        name: "PLUTO",
        radius: 112,
        orbitDistance: 2370000,
        orbitSpeed: 0.00005,
        rotationSpeed: 0.0008,
        segments: 64,
        texture: 'https://cdn.jsdelivr.net/gh/*/texture/2k_neptune.jpg', // Placeholder
        info: "Dwarf planet in the Kuiper Belt. Rocky core and nitrogen ice.",
        type: "solid"
    }
};
