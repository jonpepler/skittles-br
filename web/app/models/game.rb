class Game < ApplicationRecord
  has_many :players
  enum status: { init: 0, matchmaking: 1, starting: 2, active: 3, complete: 4 }

  MIN_PLAYER_COUNT = 2
  ACTIVATING_TIME = 5

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
    check_matchmaking_status
  end

  def check_matchmaking_status
    player_count = self.players.count
    if(self.status == "matchmaking")
      if(player_count == MIN_PLAYER_COUNT)
        self.reload
        StartGameJob.set(wait: 1.second).perform_later(self)
        ActivateGameJob.set(wait: ACTIVATING_TIME.seconds).perform_later(self)
      end
    end
    if player_count == 0
      CompleteGameJob.set(wait: 1.second).perform_later(self)
    end
  end

  def update_matchmaking_status
    GamesChannel.broadcast_to(
      self,
      { game_id: self.id, action: 'game_state_change', status: self.status }
    )
  end

  def player_info
    player_info = []
    self.reload
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
