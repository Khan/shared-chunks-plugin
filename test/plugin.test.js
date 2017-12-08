/* global expect */
const path = require('path');
const webpack = require('webpack');
const MemoryFileSystem = require('memory-fs');

const SharedChunksPlugin = require('../index.js');

function compile(compiler) {
    return new Promise((resolve, reject) => {
        compiler.run((err, stats) => {
            if (err) {
                return reject(err);
            }
            resolve(stats);
        });
    });
}

function createCompiler(entryPoints) {
    return webpack({
        bail: true,
        cache: false,
        entry: entryPoints,
        output: {
            path: `${__dirname}/dist`,
            filename: '[name].[chunkhash].js',
            chunkFilename: '[id].[name].[chunkhash].js',
        },
        plugins: [
            new SharedChunksPlugin({
                specs: [
                    {
                        name: "vendor",
                        selectedChunks: Object.keys(entryPoints),
                        moduleFilter: (module) =>
                            /vendor/.test(module.resource),
                    },
                    {
                        name: "components",
                        selectedChunks: Object.keys(entryPoints),
                        moduleFilter: (module) =>
                            /components/.test(module.resource),
                    },
                    {
                        name: "feature-shared",
                        selectedChunks: Object.keys(entryPoints),
                        moduleFilter: (module) =>
                            /features/.test(module.resource),
                        minChunks: 2,
                    },
                ]
            }),
        ],
    });
}

describe('shared-chunk-plugin', () => {
    it('should generate chunks', () => {
        const compiler = createCompiler({
            foo: path.resolve(__dirname, 'fixtures/features/foo.js'),
            bar: path.resolve(__dirname, 'fixtures/features/bar.js'),
            baz: path.resolve(__dirname, 'fixtures/features/baz.js'),
            qux: path.resolve(__dirname, 'fixtures/features/qux.js'),
        });
        compiler.outputFileSystem = new MemoryFileSystem();

        return compile(compiler).then((stats) => {
            const {chunks, modules} = stats.compilation;
            const chunkToModulesMap = {};

            for (const module of modules) {
                for (const chunk of module.chunks) {
                    if (!chunkToModulesMap.hasOwnProperty(chunk.name)) {
                        chunkToModulesMap[chunk.name] = new Set();
                    }
                    chunkToModulesMap[chunk.name].add(module.portableId);
                }
            }

            expect([...chunkToModulesMap.foo].sort()).toEqual([
                'test/fixtures/features/foo.js'
            ]);

            expect([...chunkToModulesMap.bar].sort()).toEqual([
                'test/fixtures/features/bar.js'
            ]);

            expect([...chunkToModulesMap.baz].sort()).toEqual([
                'test/fixtures/features/baz.js'
            ]);

            expect([...chunkToModulesMap.qux].sort()).toEqual([
                'test/fixtures/features/quux.js',
                'test/fixtures/features/qux.js',
            ]);

            expect([...chunkToModulesMap.components].sort()).toEqual([
                'test/fixtures/components/comp1.js',
                'test/fixtures/components/comp2.js',
                'test/fixtures/util/util.js',
            ]);

            expect([...chunkToModulesMap.vendor].sort()).toEqual([
                'test/fixtures/vendor/dep1.js',
                'test/fixtures/vendor/dep2.js',
            ]);

            const chunkDependencies = {};
            for (const chunk of chunks) {
                chunkDependencies[chunk.name] = chunk.parents.map(dep => dep.name);
            }

            expect(chunkDependencies.foo).toEqual([
                'vendor', 'components', 'feature-shared']);
            expect(chunkDependencies.bar).toEqual([
                'vendor', 'components', 'feature-shared']);
            expect(chunkDependencies.baz).toEqual([
                'vendor', 'components']);
            expect(chunkDependencies.qux).toEqual([
                'components', 'feature-shared']);
            expect(chunkDependencies.components).toEqual(['vendor']);
            expect(chunkDependencies.vendor).toEqual([]);
            expect(chunkDependencies['feature-shared']).toEqual([]);
        });
    });

    it('should not generate empty shared chunks', () => {
        const compiler = createCompiler({
            foo: path.resolve(__dirname, 'fixtures/features/foo.js'),
            baz: path.resolve(__dirname, 'fixtures/features/baz.js'),
        });
        compiler.outputFileSystem = new MemoryFileSystem();

        return compile(compiler).then((stats) => {
            const {chunks, modules} = stats.compilation;
            const chunkToModulesMap = {};

            for (const module of modules) {
                for (const chunk of module.chunks) {
                    if (!chunkToModulesMap.hasOwnProperty(chunk.name)) {
                        chunkToModulesMap[chunk.name] = new Set();
                    }
                    chunkToModulesMap[chunk.name].add(module.portableId);
                }
            }

            expect([...chunkToModulesMap.foo].sort()).toEqual([
                'test/fixtures/features/foo.js',
                'test/fixtures/features/percent.js',
            ]);

            expect([...chunkToModulesMap.baz].sort()).toEqual([
                'test/fixtures/features/baz.js'
            ]);

            expect([...chunkToModulesMap.components].sort()).toEqual([
                'test/fixtures/components/comp1.js',
                'test/fixtures/components/comp2.js',
                'test/fixtures/util/util.js',
            ]);

            expect([...chunkToModulesMap.vendor].sort()).toEqual([
                'test/fixtures/vendor/dep1.js',
                'test/fixtures/vendor/dep2.js',
            ]);

            expect(chunkToModulesMap['feature-shared']).toBeUndefined();

            const chunkDependencies = {};
            for (const chunk of chunks) {
                chunkDependencies[chunk.name] = chunk.parents.map(dep => dep.name);
            }

            expect(chunkDependencies.foo).toEqual(['vendor', 'components']);
            expect(chunkDependencies.baz).toEqual(['vendor', 'components']);
            expect(chunkDependencies.components).toEqual(['vendor']);
            expect(chunkDependencies.vendor).toEqual([]);

            // feature-shared shared chunk was not generated
            expect(chunkDependencies['feature-shared']).toBeUndefined();
        });
    });

    it('should generate empty entry chunks', () => {
        const compiler = createCompiler({
            qux: path.resolve(__dirname, 'fixtures/features/qux.js'),
            quux: path.resolve(__dirname, 'fixtures/features/quux.js'),
        });
        compiler.outputFileSystem = new MemoryFileSystem();

        return compile(compiler).then((stats) => {
            const {chunks, modules} = stats.compilation;
            const chunkToModulesMap = {};

            for (const module of modules) {
                for (const chunk of module.chunks) {
                    if (!chunkToModulesMap.hasOwnProperty(chunk.name)) {
                        chunkToModulesMap[chunk.name] = new Set();
                    }
                    chunkToModulesMap[chunk.name].add(module.portableId);
                }
            }

            expect([...chunkToModulesMap.qux].sort()).toEqual([
                "test/fixtures/features/percent.js",
                "test/fixtures/features/qux.js",
                "test/fixtures/util/util.js",
            ]);

            // quux contains no modules
            expect(chunkToModulesMap.quux).toBeUndefined();

            expect([...chunkToModulesMap['feature-shared']].sort()).toEqual([
                "test/fixtures/features/quux.js",
            ]);

            const chunkDependencies = {};
            for (const chunk of chunks) {
                chunkDependencies[chunk.name] = chunk.parents.map(dep => dep.name);
            }

            expect(chunkDependencies.qux).toEqual(['feature-shared']);

            // quux chunk was still generated even though it has no modules
            expect(chunkDependencies.quux).toEqual(['feature-shared']);
            expect(chunkDependencies.components).toBeUndefined();
            expect(chunkDependencies.vendor).toBeUndefined();
            expect(chunkDependencies['feature-shared']).toEqual([]);
        });
    });
});
