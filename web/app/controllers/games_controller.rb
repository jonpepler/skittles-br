class GamesController < ApplicationController
  def index
    games = Game.all
    render json: games
  end

  def find_or_create
    g = Game.create
    p = current_or_guest_player
    p.game = nil
    g.players << p
    render json: { id: g.id }
  end
end
