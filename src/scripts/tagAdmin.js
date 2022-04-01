const uuid = require('uuid');
const fs = require('fs');

const data = require('../../public/js/data/adminData.json');

data.features.forEach((feature) => {
    feature.properties.uuid = uuid.v4();
});

fs.writeFileSync('./adminNepal.json', JSON.stringify(data));
