Rails.application.routes.draw do
  devise_for :players
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
  root "home#main"
  mount ActionCable.server => '/cable'

  get '/game/find_or_create', to: 'games#find_or_create'
end
