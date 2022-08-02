const fs = require('fs');

const data = require('../data/adminNepalSimplified.json');

let readMunicipalities = [];
let duplicateMunicipalities = [];
data.features.forEach((feature) => {
    if (readMunicipalities.includes(feature.properties.GaPa_NaPa)) {
        if (!duplicateMunicipalities.includes(feature.properties.GaPa_NaPa)) {
            duplicateMunicipalities.push(feature.properties.GaPa_NaPa);
        }
    } else {
        readMunicipalities.push(feature.properties.GaPa_NaPa);
    }
});

data.features.forEach((feature) => {
    if (duplicateMunicipalities.includes(feature.properties.GaPa_NaPa)) {
        feature.properties.GaPa_NaPa += ` (${feature.properties.DISTRICT})`;
    }
});

readMunicipalities = [];
duplicateMunicipalities = [];
data.features.forEach((feature) => {
    if (readMunicipalities.includes(feature.properties.GaPa_NaPa)) {
        if (!duplicateMunicipalities.includes(feature.properties.GaPa_NaPa)) {
            duplicateMunicipalities.push(feature.properties.GaPa_NaPa);
        }
    } else {
        readMunicipalities.push(feature.properties.GaPa_NaPa);
    }
});

// fs.writeFileSync('./adminNepalDupliFixed.json', JSON.stringify(data));

console.log(JSON.stringify(duplicateMunicipalities.sort()));
