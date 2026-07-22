# Noland — movies, projects, and side quests

Nolan McDermott's movie-review site and personal portfolio, built with Jekyll and hosted by GitHub Pages at [nolanmcd.github.io](https://nolanmcd.github.io).

## Run locally

1. Install Ruby and Bundler.
2. Run `bundle install`.
3. Run `bundle exec jekyll serve`.
4. Open `http://localhost:4000`.

Posts live in `_posts` and use the `YYYY-MM-DD-title.md` filename format. Site-wide settings and navigation are in `_config.yml`; visual styles are in `_sass/style.scss`.

## Publish a movie review

Copy `_drafts/movie-review-template.md` into `_posts`, rename it using `YYYY-MM-DD-movie-title.md`, fill in the front matter, and write the review. Keep `categories: [movies]` so it appears automatically on the homepage and review archive. `rating` uses a five-point scale; `poster` is optional.

## Custom domain

When you own a domain, add a file named `CNAME` containing only that domain, update `url` in `_config.yml`, and point the domain's DNS records to GitHub Pages. Do not rename `CNAME.example` until the domain and DNS are ready.
