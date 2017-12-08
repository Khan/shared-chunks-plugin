const dep1 = require('../vendor/dep1');
const {capitalize} = require('../util/util');

module.exports = {
    render() {
        return `comp1: ${capitalize(dep1)}`;
    }
}
