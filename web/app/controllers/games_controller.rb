class GamesController < ApplicationController
  def index
    # games = Games.all
    # render json: games
  end

  def find_or_create
    g = Game.create
    g.players << current_or_guest_player
    render json: { id: g.id }
  end
end
