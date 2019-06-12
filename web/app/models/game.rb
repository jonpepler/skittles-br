class Game < ApplicationRecord
  has_many :players
  enum status: { init: 0, matchmaking: 1, starting: 2, active: 3, complete: 4 }

  def add_player(player)
    self.players << player
    update_game_info
  end

  def remove_player(player)
    self.players.delete(player)
    player.leave_current_game

    update_game_info
  end

  def update_game_info
    GamesChannel.broadcast_to(
      self,
      { game_id: self.id, action: 'player_update', players: player_info }
    )
    update_matchmaking_status
  end

  # Use delayed jobs here
  def update_matchmaking_status
    if(self.status == "matchmaking")
      player_count = self.players.count
      if(player_count == 0)
        self.status = "complete"
      else
        if(player_count >= 2)
          self.status = "starting"
        end
      end
    end
  end

  def player_info
    player_info = []
    self.players.each do |player|
      player_info.push(player.info)
    end
    return player_info
  end

  def self.with_players
    includes(:players).where.not(players: { id: nil })
  end

  def self.without_players
    includes(:players).where(players: { id: nil })
  end

  def self.active
    where(active: true)
  end
end
