class GamesController < ApplicationController
  def index
    games = Games.all
    render json: games
  end

  def find_or_create
    byebug
    g = Game.create
    render json: { id: g.id }
  end
end
