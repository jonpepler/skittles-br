require_relative 'boot'

require 'rails/all'

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module SkittlesBr
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 6.0

    # Settings in config/environments/* take precedence over those specified here.
    # Application configuration can go into files in config/initializers
    # -- all .rb files in that directory are automatically loaded after loading
    # the framework and any gems in your application.

    # https://stackoverflow.com/a/53776638/7497632
    # Hack for allowing SVG files. While this hack is here, we should **not**
    # allow arbitrary SVG uploads. https://github.com/rails/rails/issues/34665

    ActiveStorage::Engine.config
    .active_storage
    .content_types_to_serve_as_binary
    .delete('image/svg+xml')
  end
end
