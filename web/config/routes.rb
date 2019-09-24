Rails.application.routes.draw do
  devise_for :players

  root "home#main"
  mount ActionCable.server => '/cable'

  get '/game/find_or_create', to: 'games#find_or_create'
  get '/game/view', to: 'games#index'

  get '/flag_path', to: 'players#flag_path'
end
