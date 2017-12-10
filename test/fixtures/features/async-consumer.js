module.exports = {
    init() {
        this.value = 'initial value';
        import('./async-value').then(asyncValue => this.value = asyncValue);
    },
    render() {
        return `this.value = ${this.value}`;
    },
};
