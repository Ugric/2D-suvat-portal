tsc script.ts --outDir ./static
npx uglifyjs --compress --mangle -- ./static/script.js > ./static/script.min.js
mv ./static/script.min.js ./static/script.js
npx serve ./static