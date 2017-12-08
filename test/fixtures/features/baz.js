const comp1 = require('../components/comp1');

module.exports = {
    render() {
        return `baz: ${comp1.render()}`;
    }
};
