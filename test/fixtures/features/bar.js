const comp1 = require('../components/comp1');
const comp2 = require('../components/comp2');
const percent = require('./percent');

module.exports = {
    render() {
        return `bar: ${comp1.render()} ${comp2.render()} ${percent(3,10)}`;
    }
};
