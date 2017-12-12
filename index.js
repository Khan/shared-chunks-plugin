/**
 * This plugin allows creates shared chunks which contain all module
 * dependencies that don't already exist in an existing shared chunk.
 *
 * All dependencies required to load a shared chunk appear in the 'parents'
 * array on each chunk.
 *
 * A chunk is webpack terminology for a set of modules (.js files).  Entry
 * chunks are special chunks which initially contain the entry point (a .js
 * file) and all files in its dependency tree.
 *
 * As optimization of chunks occur, modules are moved out of entry chunks and
 * into new chunks that this plugin creates.  The plugin also updates
 * dependencies between chunks (via the 'parents' property on chunks) based on
 * whether a module already exists in shared chunk or not.
 *
 * Shared chunks are created in the order they are specified.
 *
 * A set of shared chunks can be specified in a webpack.config.js like so:
 *
 *  plugins: [
 *      new SharedChunkPlugin({
 *          specs: [
 *              {
 *                  name: "vendor",
 *                  selectedChunks: ["foo", "bar", "baz", "qux"],
 *                  moduleFilter: (module) =>
 *                      /vendor/.test(module.resource),
 *              },
 *              {
 *                  name: "components",
 *                  selectedChunks: ["foo", "bar", "baz", "qux"],
 *                  moduleFilter: (module) =>
 *                      /components/.test(module.resource),
 *              },
 *              {
 *                  name: "feature-shared",
 *                  selectedChunks: ["foo", "bar", "baz", "qux"],
 *                  moduleFilter: (module) =>
 *                      /features/.test(module.resource),
 *                  minChunks: 2,
 *              },
 *          ]
 *      })
 *  ],
 *
 * Each of the 'specs' can contain the following options:
 * - name: the name of the chunk being generated
 * - selectedChunks (optional): an array of entry chunks to consider when
 *                              looking for common modules
 * - moduleFilter (optional): a predicate which can be used to determine whether
 *                            a module should be included in the shared chunk
 *                            that is currently being created
 * - minChunks (optional): a number between 1 and Infinity that specifies how
 *                         many entry chunks it must appear in before it is
 *                         extracted to the shared chunk.
 */
class SharedChunkPlugin {
    constructor(options) {
        this.specs = options.specs;
    }

    apply(compiler) {
        compiler.plugin('compilation', compilation => {
            // The 'compilation' object has many different lifecyle hooks that
            // plugin developers can define callbacks for.  See the plugin
            // documentation: https://webpack.js.org/api/compilation/
            compilation.plugin(['optimize-chunks'], allChunks => {
                // The set of all modules that have already been added to a
                // shared chunk.
                const globalModulesSet = new Set();

                // The set of all shared chunks that have already been created.
                const sharedChunksSet = new Set();

                for (const spec of this.specs) {
                    this.createSharedChunk(
                        compilation,
                        allChunks,
                        globalModulesSet,
                        sharedChunksSet,
                        spec
                    );
                }
            });

            // additional-chunk-assets is the only unconditional hook that gets
            // passed all of the chunks that is called after sortItemsWithModuleIds
            // and sortItemsWithChunkIds which are two internal webpack methods
            // in Compilation.js that sort the order of the parents based on
            // chunk id.
            compilation.plugin(['additional-chunk-assets'], allChunks => {
                for (const chunk of allChunks) {
                    // Sort dependencies based on the order in which they should
                    // be loaded.
                    chunk.parents = chunk.parents.sort(
                        (a, b) => (a.parents.includes(b) ? 1 : -1)
                    );
                }
            });
        });
    }

    // Create a shared chunk
    //
    // The process involes the following steps:
    // - determine which modules should be added to the new shared chunk
    //   - if any of these module appear in an existing shared chunk, add that
    //     chunk as a dependency of the new chunk
    // - remove those modules from other chunks
    // - add those modules to the new chunk
    createSharedChunk(
        compilation,
        allChunks,
        globalModulesSet,
        sharedChunksSet,
        spec
    ) {
        // Create a map between chunks and their names.  The name corresponds
        // to either the name in the spec (shared chunks) or the name in the
        // 'entry' part of a webpack.config.js file.
        const allChunksNameMap = allChunks.reduce((map, chunk) => {
            if (chunk.name) {
                map.set(chunk.name, chunk);
            }
            return map;
        }, new Map());

        // Affected chunks will have one or more modules removed from them.
        // This will also include new chunks generated from previous calls to
        // processSharedSpec.
        const selectedChunks = spec.selectedChunks
            ? allChunks.filter(chunk => {
                  // We automatically include all async chunks which are chunks
                  // whose names are null.
                  return (
                      spec.selectedChunks.includes(chunk.name) ||
                      chunk.name === null
                  );
              })
            : allChunks;

        // Track how chunks each module appears in.
        const commonModulesToCountMap = new Map();
        for (const chunk of selectedChunks) {
            for (const module of chunk.modulesIterable) {
                // TODO(kevinb): add an option to also exclude modules that are
                // already part of globalModulesSet, currently our filters
                // produce a disjoint set of modules... or at the very least
                // warn when there an overlap in the set of entry modules
                // between shared chunks.
                const moduleFilter = spec.moduleFilter || (module => true);
                if (moduleFilter(module)) {
                    const count = commonModulesToCountMap.has(module)
                        ? commonModulesToCountMap.get(module)
                        : 0;
                    commonModulesToCountMap.set(module, count + 1);
                }
            }
        }

        // Some shared chunks may specify a minimum number of chunks that a
        // module must appear in before we move it to the shared chunk.
        const minChunks = spec.minChunks || 1;
        const commonModules = new Set();
        for (const [module, count] of commonModulesToCountMap) {
            // TODO(kevinb): have different counters and thresolds for modules
            // that appear in entry chunks, async chunks, or both.
            // TODO(kevinb): add a setting to allow a separate shared chunk to
            // be created from modules that appear in async chunks but not in
            // entry chunks.
            if (count >= minChunks) {
                commonModules.add(module);
                globalModulesSet.add(module);
            }
        }

        // Get chunk and module dependencies
        const { moduleDeps, chunkDeps } = this.getDependencies(
            commonModules,
            globalModulesSet,
            sharedChunksSet
        );

        // If there aren't any modules to add to the chunk don't bother
        // creating a shared chunk.
        if (commonModules.size === 0 && moduleDeps.size === 0) {
            console.warn(
                `'${spec.name}' chunk not created, contains no modules`
            );
            return;
        }

        if (allChunksNameMap.has(spec.name)) {
            // Note: this is different from how CommonsChunkPlugin works.
            throw new Error(
                `SharedChunksPlugin doesn't work with existing chunks`
            );
        }

        // This is the new shared chunk to which we'll be adding modules.
        const sharedChunk = compilation.addChunk(spec.name);

        // Add module dependencies.
        for (const dep of moduleDeps) {
            commonModules.add(dep);
            globalModulesSet.add(dep);
        }

        // Add all common modules to the target chunk.
        for (const module of commonModules) {
            sharedChunk.addModule(module);
            module.addChunk(sharedChunk); // modules can appear in multiple chunks
        }

        // Add chunk dependencies.
        sharedChunk.parents = [...chunkDeps];
        for (const chunk of chunkDeps) {
            chunk.addChunk(sharedChunk);
        }

        // It's possible that moduleFilter function filters out all modules
        // from a particular chunk in which case it isn't actually affected.
        const affectedChunks = new Set();
        for (const module of commonModules) {
            for (const chunk of allChunks) {
                if (!selectedChunks.includes(chunk) && chunk.name !== null) {
                    continue;
                }
                if (module.removeChunk(chunk)) {
                    affectedChunks.add(chunk);
                }
            }
        }

        // Copied from makeTargetChunkParentOfAffectedChunks in
        // CommonsChunkPlugin.js with targetChunk renamed to sharedChunk.
        for (const chunk of affectedChunks) {
            chunk.parents = [...chunk.parents, sharedChunk];
            sharedChunk.addChunk(chunk);

            for (const entrypoint of chunk.entrypoints) {
                entrypoint.insertChunk(sharedChunk, chunk);
            }
        }

        sharedChunksSet.add(sharedChunk);
    }

    // Return module and chunk dependencies for the given commonModules.
    // Module dependencies are determined recursively.  Whenever a module
    // appearing in globalModulesSet is encountered, recursion is terminated
    // and any chunks that the module appears in are return as chunk
    // dependencies.
    getDependencies(commonModules, globalModulesSet, sharedChunksSet) {
        const moduleDeps = new Set();
        const chunkDeps = new Set();

        const walkDeps = module => {
            for (const dep of module.dependencies) {
                if (dep.module) {
                    // Ignore dependencies that appear in either an existing
                    // shared chunk or are in commonModules.  In either case
                    // the module will have been added to globalModulesSet so
                    // we check that.
                    if (!globalModulesSet.has(dep.module)) {
                        // Avoid unnecessary recursion.
                        if (!moduleDeps.has(dep.module)) {
                            moduleDeps.add(dep.module);
                            walkDeps(dep.module);
                        }
                    } else {
                        for (const chunk of sharedChunksSet) {
                            if (chunk.containsModule(dep.module)) {
                                chunkDeps.add(chunk);
                            }
                        }
                    }
                }
            }
        };

        for (const module of commonModules) {
            walkDeps(module);
        }

        return {
            moduleDeps,
            chunkDeps,
        };
    }
}

module.exports = SharedChunkPlugin;
