# Noland — movies, projects, and side quests

Nolan McDermott's movie-review site and personal portfolio, built with Jekyll and hosted by GitHub Pages at [noland.blog](https://noland.blog).

## Run locally

1. Install Ruby and Bundler.
2. Run `bundle install`.
3. Run `bundle exec jekyll serve`.
4. Open `http://localhost:4000`.

Posts live in `_posts` and use the `YYYY-MM-DD-title.md` filename format. Site-wide settings and navigation are in `_config.yml`; visual styles are in `_sass/style.scss`.

## Publish a movie review

Copy `_drafts/movie-review-template.md` into `_posts`, rename it using `YYYY-MM-DD-movie-title.md`, fill in the front matter, and write the review. Keep `categories: [movies]` so it appears automatically on the homepage and review archive.

Ratings use five whole-star categories: **Story, Directing, Theme, Cast, and Characters**. Award one gold star for each category that worked, then set `rating` to the total. There are no half stars. The template explains how to turn an unearned gold star into a hollow star. `poster` is optional.

## Custom domain

The canonical domain is `noland.blog`. The root `CNAME` file and `url` in
`_config.yml` must remain aligned with that domain. DNS points the apex domain
and `www` subdomain to GitHub Pages.
