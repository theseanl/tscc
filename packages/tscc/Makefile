.PHONY: fetch_tslib clean fetch_closure_lib fetch_tsickle_externs

all: $(shell find dist) fetch_tslib

dist/%.js: src/%.ts
	tsc;

WGET=wget --no-check-certificate --content-disposition
GH_USER_CONTENT=https://raw.githubusercontent.com/
THIRD_PARTY=third_party/

fetch_tslib:
	svn export https://github.com/angular/tsickle/trunk/${THIRD_PARTY}tslib ${THIRD_PARTY}tsickle/third_party/tslib --force

fetch_closure_lib:
	${WGET} ${GH_USER_CONTENT}google/closure-library/master/closure/goog/base.js \
		-O ${THIRD_PARTY}closure_library/base.js
	${WGET} ${GH_USER_CONTENT}google/closure-library/master/closure/goog/reflect/reflect.js \
		-O ${THIRD_PARTY}closure_library/reflect.js

fetch_tsickle_externs:
	${WGET} ${GH_USER_CONTENT}angular/tsickle/master/src/closure_externs.js \
		-O ${THIRD_PARTY}tsickle/closure_externs.js

upd_3rd_party: fetch_tslib fetch_tsickle_externs fetch_closure_lib

local_install: $(shell find dist) 
	npm i -g .

clean:
	sudo rm -rf dist

