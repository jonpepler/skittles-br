class GamesController < ApplicationController
  def index
    games = Game.all
    render json: games
  end

  def find_or_create
    open_games = Game.matchmaking

    if(open_games.count == 0)
      # In future
      # Matchmaking queue
      # Web sends pids to the matchmaking service
      # Matchmaking service cuts queue into groups of 12
      # ...and sends the player info back to web
      g = Game.create(status: "matchmaking")
    else
      g = open_games.first
    end

    p = current_or_guest_player

    if p.game != g
      p.leave_current_game unless p.game.nil?
      g.add_player p
    end
    render json: { id: g.id, pid: p.id }
  end
end
