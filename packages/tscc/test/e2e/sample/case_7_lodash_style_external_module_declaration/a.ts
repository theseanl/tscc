/**
 * @fileoverview This test case makes sure that module names appearing in external module type
 * declarations are correctly resolved so that several declaration files that contributes to the
 * same module declarations are defined on the same namespace.
 * Such a practice is not common and is not indicated in typescript documentations, but is used
 * by a popular library lodash. This caused the default tsickle implementation, now a "demo", to
 * generate externs that produces error when it is consumed by closure compiler.
 * All of these are illustrated in {@link https://github.com/angular/tsickle/issues/1039}, and a
 * demo repo is available at {@link https://github.com/theseanl/ts-declare-module-test}. This test
 * case is almost identical to the one in the demo repo.
 */
import * as lodash from 'lodash_style_module';

window["exported"] = lodash.exported;
window["exported_from_augment"] = lodash.exported_from_augment;
