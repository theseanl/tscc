# rollup-plugin-tscc

This is a companion plugin for tscc that enables using bundle information specified in tscc spec file in rollup. This works by creating several iife bundles for each of modules specified in the spec. For multiple modules, it merges non-entry chunks into appropriate entry chunk in order to emulate closure compiler's bundling strategy.

 - It only supports IIFE bundles - output.format will be overridden to `iife`.
 - It does not expect dynamic imports. As of writing, closure compiler [does not even parse](https://github.com/google/closure-compiler/issues/2770) dynamic import. When closure compiler add supports for it (probably it would provide some interoperability with `goog.loadModule` and such) we may update the plugin.

For more detailed deescription, we refer to the [README of the main package](https://github.com/theseanl/tscc).
