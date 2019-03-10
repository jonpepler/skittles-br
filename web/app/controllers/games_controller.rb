class GamesController < ApplicationController
  def index
    games = Games.all
    render json: games
  end
end
