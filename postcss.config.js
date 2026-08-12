// Tailwind 4 ships its PostCSS integration as its own package. Nesting and
// vendor prefixing are built in now, so `tailwindcss/nesting` and
// `autoprefixer` are gone, and there is no JS config file to point at —
// the theme lives in `@theme` in src/app/globals.css.
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
