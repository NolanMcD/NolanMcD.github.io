# Nolan McDermott — personal site

Personal portfolio and blog built with Jekyll and hosted by GitHub Pages at [nolanmcd.github.io](https://nolanmcd.github.io).

## Run locally

1. Install Ruby and Bundler.
2. Run `bundle install`.
3. Run `bundle exec jekyll serve`.
4. Open `http://localhost:4000`.

Posts live in `_posts` and use the `YYYY-MM-DD-title.md` filename format. Site-wide settings and navigation are in `_config.yml`; visual styles are in `assets/css/style.scss`.

## Custom domain

When you own a domain, add a file named `CNAME` containing only that domain, update `url` in `_config.yml`, and point the domain's DNS records to GitHub Pages. Do not rename `CNAME.example` until the domain and DNS are ready.
