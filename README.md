# TSCC

[![tscc npm version](https://img.shields.io/npm/v/@tscc/tscc.svg?style=popout&color=blue&label=%40tscc%2Ftscc)](https://www.npmjs.com/package/@tscc/tscc)
[![rollup-plugin-tscc npm version](https://img.shields.io/npm/v/@tscc/rollup-plugin-tscc.svg?style=popout&color=blue&label=%40tscc%2Frollup-plugin-tscc)](https://www.npmjs.com/package/@tscc/rollup-plugin-tscc)
[![CircleCI](https://circleci.com/gh/theseanl/tscc.svg?style=svg)](https://circleci.com/gh/theseanl/tscc)

TSCC is a collection of tools to seamlessly bundle, minify Typescript project with Closure Compiler.

## Migrate

It is easy to migrate an existing Typescript project to build with TSCC.
Check out [todomvc apps](https://github.com/theseanl/todomvc/) forked from the original [tastejs/todomvc](https://github.com/tastejs/todomvc) and modified to use TSCC to get a sense of what it is like.

---

## Features

 - Automatically configures settings for [tsickle](https://github.com/angular/tsickle) and [closure compiler](https://github.com/google/closure-compiler), wires up tsickle js outputs and sourcemaps to closure compiler, sorted in accordence with dependency information, as required by closure compiler.
 - Provides an alternative [rollup](https://rollupjs.org) build using `rollup-plugin-tscc` plugin, emulating chunking behaviour of closure compiler to get the same set of output files.
 - External module support - lookup `require`d nodejs modules, and wire them so that externs are generated, and transforms any code that uses externally imported variables. Think of it as an analogue of ["external" option of webpack](https://webpack.js.org/configuration/externals/#externals) or ["globls" option of rollup](https://rollupjs.org/guide/en/#outputglobals) for closure compiler.

## Background

Closure is a wonderful system of tools. The closure compiler is the best javascript minifier and bundler, but it is known to be very difficult to use. Documentations are scarce, and integration with external tools are not well-established.

Tsickle is another wonderful tool. It finally makes it ergonomic to write code that can naturally be consumed by closure compiler, in that it transforms `.ts` files to well-annotated `.js` files, which would otherwise not even be consumed by the compiler, and automatically generates [externs](https://developers.google.com/closure/compiler/docs/api-tutorial3#externs) file from declaration files. However, like closure compiler, one has to careful in setting it up, otherwise strange bugs can occur which are not actively worked on as of now. Also, it only performs transpilation, there is no tool to put transpiled files to closure compiler, which is another painful part.

TSCC aims to encapsulate these tools in a minimal, ergonomic API, and provide a faster, easier alternative bundling [Rollup](https://rollupjs.org), which is great for rapid development. It can be used as a drop-in replacement for rollup in existing project using rollup, after moving chunk information in `rollup.config.js` to [`tscc.spec.json`](#tscc-spec-files). TSCC spec file is a single source of truth for all of your module bundling information.

## Getting started

Suppose that we have a project with the following directory structure.
```
my_project
├───tsconfig.json
├───rollup.config.js
└───src
    ├───Components
    │    ...
    └───app.ts
```

1. Install tscc cli:
    ```
    yarn global add @tscc/tscc
    ```
2. Create a [_spec file_](#tscc-spec-file) `tscc.spec.json` next to `tsconfig.json`.
    ```jsonc
    {
        "modules": {
            "out": "src/app.ts" // entry file path
        }
    }
    ```
3. Execute at the project root:
    ```
    tscc
    ```
In order to setup an alternative rollup build,

1. In your project's directory, install `@tscc/rollup-plugin-tscc` by executing:
    ```
    yarn add -D @tscc/rollup-plugin-tscc
    ```
2. Import `rollup-plugin-tscc` plugin in rollup config file.
    ```js
    // rollup.config.js
    import tscc from '@tscc/rollup-plugin-tscc';
    export default {
        output: {
            ...,
            dir: '.'
        }
        plugins: [
            tscc(),
            typescript()
        ]
    }
    ```
3. Execute `rollup` at the project root.

## Usage

### Command line

@tscc/tscc package provides a single command line interface `tscc`.

```
tscc [--help] [--clean] [--spec <spec_file_path>] [-- <typescript_flags> [-- <closure_compiler_flags>]]
```

It will compile & bundle typescript sourced based on module spec described in `spec_file`. Alternatively, one can provide the spec file's key-value pairs via command line arguments, see below. Note that one have to provide a spec file or at least a value for a 'module' - if both are omitted, it will assume that the spec file's path is implicitly set as the current working directory.

Arguments passed after the first `--`, if exists, will be passed to the typescript compiler as one would pass to `tsc`, and arguments after the second `--` will be passed to the closure compiler. e.g. `tscc --spec src -- --target ES5 -- --assume_function_wrapper`. Note that `tsc` assumes that the project root (`--project`) is the current working directory when it is omitted, but `tscc` assumes that it is the containing directory of the spec file.

### JS API

Simply provide contents of spec file as an argument:

```js
import tscc from 'tscc';

tscc({
    modules: {
        bundle: 'entry.ts'
    },
    prefix: 'dist/'
    // ...
}).then(() => console.log('Done'));
```

The default export `tscc` function accepts up to 3 arguments.
```ts
tscc(
    json_content_of_spec_file_or_path_to_spec_file,
    path_to_search_for_tsconfig?:string,
    typescript_compiler_option_override?:
):Promise<void>
```
The first argument is either a string representing the path of the spec file or a JSON content of the spec file. The JSON object can additionally have `specFile` property, whose value is a path to a spec file. TSCC will lookup tscc spec file at that path and merge its contents.

```js
tscc({
    /* Contents of spec JSON */
    specFile: "path_to_spec_file"
})
// To load spec file from the path and override it.
```

The second argument should be self-explanatory; the third argument is what would you put in tsconfig.json's "compilerOption" key, it will override those provided with the second argument.

### Usage with rollup

@tscc/rollup-plugin-tscc package provides a rollup plugin which will provide chunking information in your spec file to rollup.

Install `rollup-plugin-tscc` by executing `yarn add -D @tscc/rollup-plugin-tscc`.
```js
// rollup.config.js
const tscc = require('@tscc/rollup-plugin-tscc');
module.exports = {
    output: {
        dir: '.' // output.dir option will be provided by the plugin, but
                 // rollup currently requires something to be present in order to
                 // work properly.
    },
    // ...
    plugins: [
        tscc({
            /* Contents of spec JSON */
            // or,
            specFile: "path_to_spec_file"
        })
    ]
};
```
Then it will provide the information in your spec file to rollup, and post-process code-splitting chunks produced by rollup to match the behavior of Closure Compiler, so that you can use `rollup` build interchangeably with `tscc` build.
The plugin will control the `input`, `output.dir`, `output.entryFileNames`, `output.chunkFileNames` option.
Note that it does not transpile TS to JS, one has to provide another plugin manually, such as [rollup-plugin-typescript2](https://github.com/ezolenko/rollup-plugin-typescript2).

## Tscc spec files

Tscc spec file is a single source of truth of your bundling information. It describes each of output bundle's entry file and dependencies among them. It also describes which modules imported in your source shall be treated as an external module and aliased with which global variable.

```js
{
    modules, /* required */
    external,
    prefix,
    compilerFlags,
    debug
}
```

### `modules`

```jsonc
    "modules": {
        "index": "index.ts",
        "dependent_a": {
            "entry": "dependent_a_entry_file.ts",
            "dependencies": [ "index" ],
            "extraSources": [ "css_renaming_map.js" ]
        }
    }
```
`modules` option is a key-value pair of module name and module's specification. If a specification only consists of a entry file name, it can simply be a string representing the entry file's path, which is sufficient for most of build situation where no code splitting is applied. In general, module's specification consists of `entry`, `dependencies`, and `extraSources`. `dependencies` is an array of module names that this module depends on. It can be omitted if empty. `extraSources` is an array of file names, which are not included in the Typescript project but still needed to be provided to the closure compiler, such as css renaming maps generated by [Closure Stylesheets](https://github.com/google/closure-stylesheets). It can be omitted if empty. A module's name is an identifier to be used as a output chunk's name. To control the output directory, use `prefix` option.

CLI equivalent is `--module <module_name>:<entry_file>:<comma_separated_dependencies>:<comma_separated_extra_sources>`.

### `external`

```jsonc
{
    "external": {
        "react": "React",
        "react-dom": "ReactDOM",
    }
}
```

It is identical to the [`output.global` option](https://rollupjs.org/guide/en#core-functionality) of rollup. It is a key-value pair, where key is a module name as used in `import ... from 'module_name'` statement, and value is a name of a global variable which this imported value will refer to.

CLI equivalent is `--external <module_name>:<global_variable_name>`.

### `prefix`

```jsonc
    "prefix": "dist/"
    // or,
    "prefix": { "rollup": "dev/", "cc": "dist/" }
```
It is a name that will be prepended to the output chunk's name. It is prepended _as is_, which means that if no trailing path separator was provided, it will modify the output file's name. If it is a relative path starting from the current directory ("."), it will be resolved relative to the spec file's location. Otherwise, any relative path will be resolved relative to the current working directory, and absolute paths are used as is.

CLI equivalent is `--prefix dist/` (or `--prefix.rollup dev/ --prefix.cc dist/`).

### `compilerFlags`

```jsonc
    "compilerFlags": {
        "assume_function_wrapper": true,
        "rewrite_polyfills": true,
        "language_out": "ECMASCRIPT_2019",
        "variable_renaming_report": "out/report.map"
    }
```
It is a key-value pair of flags to be passed to the closure compiler. Keys are literally [closure compiler options](https://github.com/google/closure-compiler/wiki/Flags-and-Options) minus the leading `--`. flags which accepts multiple values can be represented as an array of values. TSCC sets default values for many flags, in particular, the compilation works even without the `compilerOptions` key in the spec. Any values provided here will override default flags. TSCC will treat these values as opaque data.

### `debug`

```jsonc
    "debug": {
        "persistArtifacts": true,
        "ignoreWarningsPath": ["/node_modules/", "/vendor/"]
    }
```
It is a key-value pair of debugging options.
 - `persistArtifacts`: writes intermediate tsickle output to a directory `.tscc_temp`.
 - `ignoreWarningsPath`: Paths to ignore warnings produced by tsickle. It uses a simple substring search. This value defaults to `["/node_modules/"]`.

### Importing external libraries from NPM

Best practice is to provide them as a separate script tag instead of bundling it together, as such libraries do not in general safe to be compiled by Closure Compiler. Declare them as external modules in the spec file, and import them like you would usually do. Then you can benefit from IDE's type checking functionality while tscc can lookup their type definitions and include them as closure compiler's externs.

#### Detailed description of external modules handling

 1. Users write `import React from 'react'`, so that users' IDE can find necessary typings.
 2. TSCC configures tsickle to process type declaration files of module 'react' that Typescript located for us -- usually in node_modules directory.
 3. With the help of some Typescript transformers, TSCC removes the above import statements. Doing it requires suppressing `goog.requireType('react')` and substituting `const React = require('react')` to something like `const React_1 = React`.
 4. To inform Closure about such a user-provided global variable name, TSCC generates additional externs for such a global variable, like
    ```javascript
    /**
     * @const
     * @type {some$file$name$mangled$by$tsickle}
     */
    var React = {};
    ```
    tsickle writes module-scoped externs to certain mangled namespace like this, so I am grabbing that namespace to create externs like this. To my understanding, this will provide the required information to Closure, please correct me if I'm wrong.

### Things to know

#### Closure compiler handles modern javascript natively

Closure compiler is capable of minifying modern javascript up to ECMASCRIPT 2019. If you only support modern environments, you can set closure compiler output langauge to ES6 or higher, it will provide smaller output in general.

#### Sourcemaps

In order to enable sourcemaps, enable `compilerOptions.sourceMap` flag in `tsconfig.json`. Then TSCC will configure closure compiler to emit appropriate sourcemaps.

#### Using prebuilt closure compiler images

By default, `tscc` command will use the java version of the compiler, which requires `java` to exist in `PATH` environment variable. Platform specific binary images are available in npm: [google-closure-compiler-windows](https://www.npmjs.com/package/google-closure-compiler-windows), [google-closure-compiler-osx](https://www.npmjs.com/package/google-closure-compiler-osx), [google-closure-compiler-linux](https://www.npmjs.com/package/google-closure-compiler-linux), and these are optional dependency of @tscc/tscc package. If you install one of them, `tscc` command will use it and it will provide significantly faster compile time in most cases.

#### Rules imposed by closure compiler and tsickle

Although TSCC tries to hide closure compiler specifics as much as it can, it's good to have some knowledge on it:
 - Read the [official documentation](https://developers.google.com/closure/compiler/) in order to get used to some notions used.
 - Not all code works directly with closure compiler (even if it is well-annotated). Read about [compiler assumptions](https://github.com/google/closure-compiler/wiki/Compiler-Assumptions) from their wiki; Basically, you should not use some dynamic nature of JS (the bad part!). Below are some common situations.
   - Do not access an object's property with a string literal, as closure compiler won't try to rename it. If you access `foo.bar` in your code and also do `foo["bar"]` at another part of the code, closure compiler may rename `foo.bar` to something like `foo.a` whereas the latter to `foo.bar`, so it will break the code.
   - Circular references of Javascript modules are not allowed.
   - Output module spec must have a single root module, making it a connected tree.[Ref](https://stackoverflow.com/questions/10395810/how-do-i-split-my-javascript-into-modules-using-googles-closure-compiler/10401030#10401030)
 - Tsickle [officially states](https://github.com/angular/tsickle#warning-work-in-progress) that it is still in experimental phase, and there are some caveats.
   - Tsickle does not support annotation of all typescript types. For example, it does not convert indexed properties of Typescript to closure type, so if an interface is `declare`d with a property, such an interface won't be preserved -- keep an eye on tsickle warnings about unknown types. A good news is that closure compiler is still able to guess unknown types in most of cases, so it does not break the output code often.
   - TS `namespace`s are not converted to something like those in closure library, so it does not benefit from closure compiler's property flattening. (Apparently google internally prevents use of [namespaces](https://github.com/angular/tsickle/issues/713#issuecomment-358806943).)
 - Some objects are present in Typescript but not in closure compiler, so sometimes you may need to provide externs to those manually.

## Motivation

This project came out from an experience I have had with developing several Javascript software, both as a frontend project and browser extension, userscripts injected into client's browsers. In many cases "content script" are `eval`ed, so the source holds a string form of a JS code, so there was a rather strong motivation for squizing bundle size as much as one can in order to reduce client's memory footprint. Closure tools, albeit not "trendy", was the best tool for it -- the compiler is simply the best, Closure Templates directly compiles into JS and required runtime libraries are extremely small, and Closure Stylesheets provides class name shortening. However, incorporating all of these and at the same time providing an alternative build for debugging required a lot of work due to lack of support and community tooling.

On the other hand, currently most of available tooling using tsickle and closure compiler is limited to angular community. Tsickle is integrated into Angular's compiler and it provides some angular-specific code transformations (they are not enabled in TSCC). However, after all tsickle is a general-purpose transpiler. It seemed a pity that such a great tooling cannot benefit much broader audiences.

TSCC is meant to provide a framework-agnostic tooling that can be used to bridge this gap.

## Milestones

 - Integration with [Closure Templates](https://github.com/google/closure-templates) and [Closure Stylesheets](https://github.com/google/closure-stylesheets). Both tools produce Javascript sources that are meant to be consumed by Closure Compiler. As separate companion packages `tscc-templates` and `tscc-styles`, it will be possible to pipe these intermediate output to closure compiler, and produce typescript module declaration files that will provide type information of templates.
 - Providing an ergonomic API for using closure-annotated JS files together with transpiled TS files.
 - Providing an API for returning gulp stream.

