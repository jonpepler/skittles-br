class GamesController < ApplicationController
  def index
    games = Game.all
    render json: games
  end

  def find_or_create
    open_games = Game.matchmaking

    if(open_games.count == 0)
      # In future
      # Specific matchmaking groups
      # Joining matchmaking puts you in a single player group
      # Groups can combine
      # Matchmaking service tries to merge groups to make X sized groups
      # Creates a game when a group gets big enough
      g = Game.create(status: "matchmaking")
    else
      g = open_games.first
    end
    p = current_or_guest_player
    p.leave_current_game unless p.game.nil?
    g.add_player p
    render json: { id: g.id, pid: p.id }
  end
end
