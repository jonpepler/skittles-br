class Player < ApplicationRecord
  devise :database_authenticatable, :rememberable
  belongs_to :game, optional: true

  def leave_current_game
    game_id = self.game
    self.game = nil
    self.save
    return game_id
  end
end
