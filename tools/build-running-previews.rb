# Render temporary browser-test fixtures with Jekyll itself, never editing running.yml.
require 'jekyll'
require 'fileutils'
require 'digest'
require 'date'

root = File.expand_path('..', __dir__)
destination = File.join(root, '_site', '__running-preview')
if ARGV.include?('--clean')
  abort 'Unexpected preview directory' unless File.dirname(destination) == File.join(root, '_site')
  FileUtils.rm_rf(destination)
  exit
end

data_file = File.join(root, '_data', 'running.yml')
original_digest = Digest::SHA256.file(data_file).hexdigest
site = Jekyll::Site.new(Jekyll.configuration('source' => root, 'destination' => File.join(root, '_site')))
site.reset
site.read
running = site.data.fetch('running')
abort 'year must be a four-digit year' unless running['year'].is_a?(Integer) && (1900..9999).cover?(running['year'])
total = running['total_miles']
abort 'total_miles must be blank or a non-negative number' unless total.nil? || (total.is_a?(Numeric) && total.finite? && total >= 0)
if running['last_updated']
  Date.iso8601(running['last_updated'].to_s)
end

FileUtils.mkdir_p(destination)
cases = { 'blank' => [nil, '—'], 'zero' => [0, '0'], '125-4' => [125.4, '125.4'], '999-9' => [999.9, '999.9'], '1250-5' => [1250.5, '1,250.5'] }
cases.each do |slug, (value, expected)|
  site.data['running'] = { 'year' => 2026, 'total_miles' => value, 'last_updated' => value.nil? ? nil : '2026-11-08' }
  template = site.liquid_renderer.file('running-preview').parse('{% include running-mileage.html %}')
  component = template.render!(site.site_payload, registers: { site: site, page: {} }, strict_filters: true)
  abort "Unexpected rendered mileage for #{slug}" unless component.match?(/>#{Regexp.escape(expected)}<\/text>/)
  html = <<~HTML
    <!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Temporary mileage layout test</title><link rel="stylesheet" href="/assets/main.css"></head>
    <body><main class="wrapper"><div class="running-home"><div aria-hidden="true"></div>#{component}</div></main></body></html>
  HTML
  File.write(File.join(destination, "#{slug}.html"), html)
end
abort 'Source mileage data changed during preview rendering' unless Digest::SHA256.file(data_file).hexdigest == original_digest
puts 'Rendered five Jekyll mileage previews; source data unchanged.'
