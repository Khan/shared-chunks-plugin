const {capitalize} = require('../util/util');
const percent = require('./percent');
const quux = require('./quux');

module.exports = {
    render() {
        return `${capitalize('qux')} (${quux}): ${percent(5, 10)}`;
    }
};
