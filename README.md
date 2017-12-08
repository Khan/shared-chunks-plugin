# shared-chunks-plugin

This plugin allows creates shared chunks which contain all module
dependencies that don't already exist in an existing shared chunk.

All dependencies required to load a shared chunk appear in the 'parents'
array on each chunk.

## Configuration

A set of shared chunks can be specified in a webpack.config.js like so:
```
plugins: [
    new SharedChunkPlugin({
        specs: [
            {
                name: "vendor",
                selectedChunks: ["foo", "bar", "baz", "qux"],
                moduleFilter: (module) =>
                    /vendor/.test(module.resource),
            },
            {
                name: "components",
                selectedChunks: ["foo", "bar", "baz", "qux"],
                moduleFilter: (module) =>
                    /components/.test(module.resource),
            },
            {
                name: "feature-shared",
                selectedChunks: ["foo", "bar", "baz", "qux"],
                moduleFilter: (module) =>
                    /features/.test(module.resource),
                minChunks: 2,
            },
        ]
    })
],
```

Each of the 'specs' can contain the following options:
 - name: the name of the chunk being generated
 - selectedChunks (optional): an array of entry chunks to consider when looking
   for common modules
 - moduleFilter (optional): a predicate which can be used to determine whether
   a module should be included in the shared chunk that is currently being
   created
 - minChunks (optional): a number between 1 and Infinity that specifies how
   many entry chunks it must appear in before it is extracted to the shared
   chunk
